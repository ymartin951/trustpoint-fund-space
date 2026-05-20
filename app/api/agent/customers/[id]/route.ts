import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

import type { Database } from '@/lib/database.types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
  throw new Error('Missing Supabase environment variables.');
}

const supabaseAdmin = createClient<Database>(
  supabaseUrl,
  supabaseServiceRoleKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

type ExtendedProfile = Database['public']['Tables']['profiles']['Row'] & {
  id_type?: string | null;
  id_number?: string | null;
  id_document_front_url?: string | null;
  id_document_back_url?: string | null;
  selfie_url?: string | null;
};

type AgentCustomerRelationship =
  Database['public']['Tables']['agent_customers']['Row'];

type VerificationRequest =
  Database['public']['Tables']['verification_requests']['Row'];

type AuthenticatedAgentResult =
  | {
      success: true;
      userId: string;
    }
  | {
      success: false;
      response: NextResponse;
    };

type CustomerDetailsResult =
  | {
      success: true;
      customer: ExtendedProfile;
      verificationRequest: VerificationRequest | null;
      reviewedByProfile: {
        id: string;
        full_name: string | null;
        email: string | null;
        phone: string | null;
        role: string;
      } | null;
    }
  | {
      success: false;
      response: NextResponse;
    };

const KYC_BUCKET = 'kyc-documents';

function cleanText(value: FormDataEntryValue | null) {
  if (typeof value !== 'string') return null;
  const cleaned = value.trim();
  return cleaned ? cleaned : null;
}

function getFile(formData: FormData, key: string) {
  const value = formData.get(key);

  if (!value || typeof value === 'string') {
    return null;
  }

  if (value.size <= 0) {
    return null;
  }

  return value;
}

function isAllowedImage(file: File) {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  return allowedTypes.includes(file.type);
}

function getFileExtension(file: File) {
  const nameExtension = file.name.split('.').pop()?.toLowerCase();

  if (nameExtension) return nameExtension;
  if (file.type === 'image/png') return 'png';
  if (file.type === 'image/webp') return 'webp';

  return 'jpg';
}

function extractStoragePath(value?: string | null) {
  if (!value) return null;

  if (!value.startsWith('http')) {
    return value;
  }

  const publicMarker = `/storage/v1/object/public/${KYC_BUCKET}/`;
  const signedMarker = `/storage/v1/object/sign/${KYC_BUCKET}/`;
  const objectMarker = `/storage/v1/object/${KYC_BUCKET}/`;

  if (value.includes(publicMarker)) {
    return decodeURIComponent(
      value.split(publicMarker)[1]?.split('?')[0] || ''
    );
  }

  if (value.includes(signedMarker)) {
    return decodeURIComponent(
      value.split(signedMarker)[1]?.split('?')[0] || ''
    );
  }

  if (value.includes(objectMarker)) {
    return decodeURIComponent(
      value.split(objectMarker)[1]?.split('?')[0] || ''
    );
  }

  return null;
}

async function createSignedImageUrl(value?: string | null) {
  const path = extractStoragePath(value);

  if (!path) return null;

  const { data, error } = await supabaseAdmin.storage
    .from(KYC_BUCKET)
    .createSignedUrl(path, 60 * 60);

  if (error) {
    console.error('Signed image URL error:', error.message);
    return null;
  }

  return data.signedUrl;
}

async function uploadKycFile(params: {
  customerId: string;
  file: File;
  folder: 'id-front' | 'id-back' | 'selfie';
}) {
  const { customerId, file, folder } = params;

  if (!isAllowedImage(file)) {
    throw new Error(
      `${folder} must be a valid image file. Accepted formats are JPG, PNG, or WEBP.`
    );
  }

  const maxSize = 5 * 1024 * 1024;

  if (file.size > maxSize) {
    throw new Error(`${folder} is too large. Maximum allowed size is 5MB.`);
  }

  const extension = getFileExtension(file);
  const filePath = `${customerId}/${folder}-resubmit-${Date.now()}.${extension}`;
  const arrayBuffer = await file.arrayBuffer();

  const { error } = await supabaseAdmin.storage
    .from(KYC_BUCKET)
    .upload(filePath, arrayBuffer, {
      contentType: file.type,
      upsert: false,
    });

  if (error) {
    throw new Error(`Failed to upload ${folder}: ${error.message}`);
  }

  return filePath;
}

async function deleteUploadedFiles(paths: string[]) {
  const validPaths = paths.filter(Boolean);

  if (validPaths.length === 0) return;

  await supabaseAdmin.storage.from(KYC_BUCKET).remove(validPaths);
}

async function getAuthenticatedAgent(
  request: Request
): Promise<AuthenticatedAgentResult> {
  const authHeader =
    request.headers.get('authorization') ||
    request.headers.get('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      success: false,
      response: NextResponse.json(
        {
          success: false,
          message: 'Unauthorized request. Please login again.',
        },
        { status: 401 }
      ),
    };
  }

  const token = authHeader.replace('Bearer ', '').trim();

  const supabaseAuth = createClient<Database>(supabaseUrl!, supabaseAnonKey!, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });

  const {
    data: { user },
    error: userError,
  } = await supabaseAuth.auth.getUser(token);

  if (userError || !user) {
    return {
      success: false,
      response: NextResponse.json(
        {
          success: false,
          message: 'Your session has expired. Please login again.',
        },
        { status: 401 }
      ),
    };
  }

  const { data: agentProfile, error: agentError } = await supabaseAdmin
    .from('profiles')
    .select('id, role, status, full_name')
    .eq('id', user.id)
    .single();

  if (agentError || !agentProfile) {
    return {
      success: false,
      response: NextResponse.json(
        {
          success: false,
          message: 'Agent profile not found.',
        },
        { status: 404 }
      ),
    };
  }

  if (agentProfile.role !== 'AGENT') {
    return {
      success: false,
      response: NextResponse.json(
        {
          success: false,
          message: 'Only agents can access customer details.',
        },
        { status: 403 }
      ),
    };
  }

  if (agentProfile.status !== 'ACTIVE') {
    return {
      success: false,
      response: NextResponse.json(
        {
          success: false,
          message: 'Your agent account is not active.',
        },
        { status: 403 }
      ),
    };
  }

  return {
    success: true,
    userId: user.id,
  };
}

async function findAgentCustomerRelationship(params: {
  agentId: string;
  requestedId: string;
}) {
  const { agentId, requestedId } = params;

  const byCustomerId = await supabaseAdmin
    .from('agent_customers')
    .select(
      'id, agent_id, customer_id, relationship_status, notes, created_at, updated_at'
    )
    .eq('agent_id', agentId)
    .eq('customer_id', requestedId)
    .maybeSingle();

  if (byCustomerId.error) {
    return {
      relationship: null,
      error: byCustomerId.error.message,
    };
  }

  if (byCustomerId.data) {
    return {
      relationship: byCustomerId.data as AgentCustomerRelationship,
      error: null,
    };
  }

  const byRelationshipId = await supabaseAdmin
    .from('agent_customers')
    .select(
      'id, agent_id, customer_id, relationship_status, notes, created_at, updated_at'
    )
    .eq('agent_id', agentId)
    .eq('id', requestedId)
    .maybeSingle();

  if (byRelationshipId.error) {
    return {
      relationship: null,
      error: byRelationshipId.error.message,
    };
  }

  return {
    relationship: byRelationshipId.data as AgentCustomerRelationship | null,
    error: null,
  };
}

async function loadCustomerDetails(params: {
  relationship: AgentCustomerRelationship;
}): Promise<CustomerDetailsResult> {
  const { relationship } = params;

  const { data: profileData, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', relationship.customer_id)
    .single();

  if (profileError || !profileData) {
    return {
      success: false,
      response: NextResponse.json(
        {
          success: false,
          message:
            profileError?.message ||
            'Customer profile exists in agent customers but was not found in profiles.',
        },
        { status: 404 }
      ),
    };
  }

  const customer = profileData as ExtendedProfile;

  const { data: verificationRequestData, error: verificationRequestError } =
    await supabaseAdmin
      .from('verification_requests')
      .select('*')
      .eq('user_id', relationship.customer_id)
      .maybeSingle();

  if (verificationRequestError) {
    console.error(
      'Verification request load warning:',
      verificationRequestError.message
    );
  }

  const verificationRequest =
    (verificationRequestData as VerificationRequest | null) || null;

  let reviewedByProfile: {
    id: string;
    full_name: string | null;
    email: string | null;
    phone: string | null;
    role: string;
  } | null = null;

  if (verificationRequest?.reviewed_by) {
    const { data: reviewerData, error: reviewerError } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, email, phone, role')
      .eq('id', verificationRequest.reviewed_by)
      .maybeSingle();

    if (reviewerError) {
      console.error('Reviewer profile load warning:', reviewerError.message);
    } else {
      reviewedByProfile = reviewerData || null;
    }
  }

  return {
    success: true,
    customer,
    verificationRequest,
    reviewedByProfile,
  };
}

async function createAdminNotifications(params: {
  customerId: string;
  customerName: string;
  agentId: string;
}) {
  const { customerId, customerName } = params;

  const { data: admins, error: adminsError } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .in('role', ['ADMIN', 'SUPER_ADMIN'])
    .eq('status', 'ACTIVE');

  if (adminsError) {
    console.error('Admin notification profile load error:', adminsError.message);
    return;
  }

  if (!admins || admins.length === 0) return;

  const notifications: Database['public']['Tables']['notifications']['Insert'][] =
    admins.map((admin) => ({
      user_id: admin.id,
      title: 'Verification Resubmitted',
      message: `${customerName} has been resubmitted for verification by an agent.`,
      type: 'VERIFICATION',
      related_entity_id: customerId,
      related_entity_type: 'customer',
      is_read: false,
    }));

  const { error } = await supabaseAdmin
    .from('notifications')
    .insert(notifications);

  if (error) {
    console.error('Admin verification resubmission notification error:', error);
  }
}

export async function GET(
  request: Request,
  context: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const requestedId = context.params.id;

    if (!requestedId) {
      return NextResponse.json(
        {
          success: false,
          message: 'Customer ID is required.',
        },
        { status: 400 }
      );
    }

    const authResult = await getAuthenticatedAgent(request);

    if (!authResult.success) {
      return authResult.response;
    }

    const { relationship, error: relationshipError } =
      await findAgentCustomerRelationship({
        agentId: authResult.userId,
        requestedId,
      });

    if (relationshipError) {
      return NextResponse.json(
        {
          success: false,
          message: `Could not check customer relationship: ${relationshipError}`,
        },
        { status: 500 }
      );
    }

    if (!relationship) {
      return NextResponse.json(
        {
          success: false,
          message:
            'Customer not found or this customer is not assigned to your agent account.',
        },
        { status: 404 }
      );
    }

    const customerDetails = await loadCustomerDetails({ relationship });

    if (!customerDetails.success) {
      return customerDetails.response;
    }

    const { customer, verificationRequest, reviewedByProfile } =
      customerDetails;

    const [idFrontSignedUrl, idBackSignedUrl, selfieSignedUrl] =
      await Promise.all([
        createSignedImageUrl(customer.id_document_front_url),
        createSignedImageUrl(customer.id_document_back_url),
        createSignedImageUrl(customer.selfie_url),
      ]);

    return NextResponse.json({
      success: true,
      customer,
      relationship,
      verification_request: verificationRequest,
      reviewed_by_profile: reviewedByProfile,
      documents: {
        id_front_url: idFrontSignedUrl,
        id_back_url: idBackSignedUrl,
        selfie_url: selfieSignedUrl,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Something went wrong.';

    return NextResponse.json(
      {
        success: false,
        message,
      },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  context: { params: { id: string } }
): Promise<NextResponse> {
  const uploadedPaths: string[] = [];

  try {
    const requestedId = context.params.id;

    if (!requestedId) {
      return NextResponse.json(
        {
          success: false,
          message: 'Customer ID is required.',
        },
        { status: 400 }
      );
    }

    const authResult = await getAuthenticatedAgent(request);

    if (!authResult.success) {
      return authResult.response;
    }

    const { relationship, error: relationshipError } =
      await findAgentCustomerRelationship({
        agentId: authResult.userId,
        requestedId,
      });

    if (relationshipError) {
      return NextResponse.json(
        {
          success: false,
          message: `Could not check customer relationship: ${relationshipError}`,
        },
        { status: 500 }
      );
    }

    if (!relationship) {
      return NextResponse.json(
        {
          success: false,
          message:
            'Customer not found or this customer is not assigned to your agent account.',
        },
        { status: 404 }
      );
    }

    const customerDetails = await loadCustomerDetails({ relationship });

    if (!customerDetails.success) {
      return customerDetails.response;
    }

    const { customer, verificationRequest } = customerDetails;

    if (
      customer.verification_status !== 'REJECTED' &&
      verificationRequest?.status !== 'REJECTED'
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            'Only rejected customers can be resubmitted for verification.',
        },
        { status: 400 }
      );
    }

    const formData = await request.formData();

    const idFrontFile = getFile(formData, 'id_document_front');
    const idBackFile = getFile(formData, 'id_document_back');
    const selfieFile = getFile(formData, 'selfie');
    const resubmissionNote = cleanText(formData.get('resubmission_note'));

    if (!idFrontFile && !idBackFile && !selfieFile && !resubmissionNote) {
      return NextResponse.json(
        {
          success: false,
          message:
            'Please upload at least one corrected document or add a resubmission note.',
        },
        { status: 400 }
      );
    }

    let idFrontPath = customer.id_document_front_url || null;
    let idBackPath = customer.id_document_back_url || null;
    let selfiePath = customer.selfie_url || null;

    if (idFrontFile) {
      idFrontPath = await uploadKycFile({
        customerId: customer.id,
        file: idFrontFile,
        folder: 'id-front',
      });
      uploadedPaths.push(idFrontPath);
    }

    if (idBackFile) {
      idBackPath = await uploadKycFile({
        customerId: customer.id,
        file: idBackFile,
        folder: 'id-back',
      });
      uploadedPaths.push(idBackPath);
    }

    if (selfieFile) {
      selfiePath = await uploadKycFile({
        customerId: customer.id,
        file: selfieFile,
        folder: 'selfie',
      });
      uploadedPaths.push(selfiePath);
    }

    const now = new Date().toISOString();

    const { error: profileUpdateError } = await supabaseAdmin
      .from('profiles')
      .update({
        verification_status: 'PENDING',
        ghana_card_verified: false,
        id_document_front_url: idFrontPath,
        id_document_back_url: idBackPath,
        selfie_url: selfiePath,
        updated_at: now,
      })
      .eq('id', customer.id);

    if (profileUpdateError) {
      await deleteUploadedFiles(uploadedPaths);

      return NextResponse.json(
        {
          success: false,
          message:
            profileUpdateError.message ||
            'Could not update customer profile for resubmission.',
        },
        { status: 500 }
      );
    }

    const verificationPayload: Database['public']['Tables']['verification_requests']['Insert'] =
      {
        user_id: customer.id,
        full_name: customer.full_name,
        phone: customer.phone || 'Not provided',
        email: customer.email,
        country: customer.country,
        region: customer.region,
        city: customer.city,
        location: customer.location,
        gender: customer.gender,
        date_of_birth: customer.date_of_birth,
        user_category: customer.user_category,
        occupation: customer.occupation,
        employer_name: customer.employer_name,
        staff_id: customer.staff_id,
        business_name: customer.business_name,
        business_type: customer.business_type,
        business_location: customer.business_location,
        ghana_card_number:
          customer.ghana_card || customer.id_number || 'Not provided',
        ghana_card_front_url: idFrontPath,
        ghana_card_back_url: idBackPath,
        selfie_url: selfiePath,
        business_proof_url: null,
        employment_proof_url: null,
        momo_number: customer.momo_number,
        bank_name: customer.bank_name,
        bank_account_name: customer.bank_account_name,
        bank_account_number: customer.bank_account_number,
        emergency_contact_name:
          customer.emergency_contact_name || 'Not provided',
        emergency_contact_phone:
          customer.emergency_contact_phone || 'Not provided',
        submitted_by_agent: authResult.userId,
        status: 'PENDING',
        rejection_reason: resubmissionNote
          ? `Resubmitted by agent. Note: ${resubmissionNote}`
          : null,
        reviewed_at: null,
        reviewed_by: null,
      };

    const { data: updatedVerificationRequest, error: verificationError } =
      await supabaseAdmin
        .from('verification_requests')
        .upsert(verificationPayload, {
          onConflict: 'user_id',
        })
        .select('*')
        .single();

    if (verificationError || !updatedVerificationRequest) {
      await deleteUploadedFiles(uploadedPaths);

      return NextResponse.json(
        {
          success: false,
          message:
            verificationError?.message ||
            'Could not resubmit customer verification request.',
        },
        { status: 500 }
      );
    }

    await createAdminNotifications({
      customerId: customer.id,
      customerName: customer.full_name,
      agentId: authResult.userId,
    });

    return NextResponse.json({
      success: true,
      message:
        'Customer verification has been resubmitted successfully and is now pending admin review.',
      verification_request: updatedVerificationRequest,
    });
  } catch (error) {
    await deleteUploadedFiles(uploadedPaths);

    const message =
      error instanceof Error ? error.message : 'Something went wrong.';

    return NextResponse.json(
      {
        success: false,
        message,
      },
      { status: 500 }
    );
  }
}