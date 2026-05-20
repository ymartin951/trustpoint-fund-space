import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

import type { Database } from '@/lib/supabase/database.types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const supabaseUrl: string = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey: string =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
const serviceRoleKey: string = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

if (!supabaseUrl) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL');
}

if (!supabaseAnonKey) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY');
}

if (!serviceRoleKey) {
  throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
}

const supabaseAdmin = createClient<Database>(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const KYC_BUCKET = 'kyc-documents';

type UserCategory =
  | 'INDIVIDUAL'
  | 'GOVERNMENT_WORKER'
  | 'TEACHER'
  | 'NURSE'
  | 'BUSINESS_OWNER'
  | 'MARKET_WOMAN'
  | 'TRADER'
  | 'STUDENT'
  | 'OTHER';

type Gender = 'MALE' | 'FEMALE' | 'OTHER';

type IdType =
  | 'GHANA_CARD'
  | 'PASSPORT'
  | 'VOTER_ID'
  | 'DRIVER_LICENSE'
  | 'NATIONAL_ID'
  | 'OTHER';

type VerificationInsert =
  Database['public']['Tables']['verification_requests']['Insert'];

type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];

type AdminVerificationNotificationInsert = {
  user_id: string;
  title: string;
  message: string;
  type: 'VERIFICATION';
  is_read: boolean;
  related_entity_id: string;
  related_entity_type: string;
};

const validUserCategories: UserCategory[] = [
  'INDIVIDUAL',
  'GOVERNMENT_WORKER',
  'TEACHER',
  'NURSE',
  'BUSINESS_OWNER',
  'MARKET_WOMAN',
  'TRADER',
  'STUDENT',
  'OTHER',
];

const validGenders: Gender[] = ['MALE', 'FEMALE', 'OTHER'];

const validIdTypes: IdType[] = [
  'GHANA_CARD',
  'PASSPORT',
  'VOTER_ID',
  'DRIVER_LICENSE',
  'NATIONAL_ID',
  'OTHER',
];

function getBearerToken(request: Request): string | null {
  const authHeader =
    request.headers.get('authorization') ||
    request.headers.get('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.replace('Bearer ', '').trim();

  return token || null;
}

function cleanText(value: FormDataEntryValue | null): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const cleaned = value.trim();

  return cleaned || null;
}

function requiredText(value: FormDataEntryValue | null): string {
  return cleanText(value) || '';
}

function normalizeUserCategory(value: FormDataEntryValue | null): UserCategory {
  const cleaned = requiredText(value).toUpperCase();

  if (validUserCategories.includes(cleaned as UserCategory)) {
    return cleaned as UserCategory;
  }

  return 'INDIVIDUAL';
}

function normalizeGender(value: FormDataEntryValue | null): Gender {
  const cleaned = requiredText(value).toUpperCase();

  if (validGenders.includes(cleaned as Gender)) {
    return cleaned as Gender;
  }

  return 'MALE';
}

function normalizeIdType(value: FormDataEntryValue | null): IdType | null {
  const cleaned = requiredText(value).toUpperCase();

  if (validIdTypes.includes(cleaned as IdType)) {
    return cleaned as IdType;
  }

  return null;
}

function getFile(formData: FormData, key: string): File | null {
  const value = formData.get(key);

  if (!value || typeof value === 'string') {
    return null;
  }

  if (value.size <= 0) {
    return null;
  }

  return value;
}

function isAllowedImage(file: File): boolean {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

  return allowedTypes.includes(file.type);
}

function getFileExtension(file: File): string {
  const parts = file.name.split('.');
  const extension = parts.length > 1 ? parts.pop() : null;

  if (extension) {
    return extension.toLowerCase();
  }

  if (file.type === 'image/png') {
    return 'png';
  }

  if (file.type === 'image/webp') {
    return 'webp';
  }

  if (file.type === 'image/jpeg' || file.type === 'image/jpg') {
    return 'jpg';
  }

  return 'jpg';
}

async function uploadKycFile({
  userId,
  file,
  folder,
}: {
  userId: string;
  file: File;
  folder: 'id-front' | 'id-back' | 'selfie';
}): Promise<string> {
  if (!isAllowedImage(file)) {
    throw new Error(
      `${folder} must be a valid image file. Accepted formats are JPG, PNG, or WEBP.`
    );
  }

  const maxSize = 5 * 1024 * 1024;

  if (file.size > maxSize) {
    throw new Error(`${folder} is too large. Maximum allowed size is 5MB.`);
  }

  const extension: string = getFileExtension(file);
  const filePath: string = `${userId}/${folder}-${Date.now()}.${extension}`;
  const arrayBuffer = await file.arrayBuffer();

  const { error } = await supabaseAdmin.storage
    .from(KYC_BUCKET)
    .upload(filePath, arrayBuffer, {
      contentType: file.type || 'image/jpeg',
      upsert: false,
    });

  if (error) {
    throw new Error(`Failed to upload ${folder}: ${error.message}`);
  }

  return filePath;
}

async function deleteUploadedFiles(paths: string[]) {
  const validPaths: string[] = paths.filter(
    (path): path is string => typeof path === 'string' && path.length > 0
  );

  if (validPaths.length === 0) {
    return;
  }

  await supabaseAdmin.storage.from(KYC_BUCKET).remove(validPaths);
}

function buildVerificationNotificationMessage({
  fullName,
  phone,
  userCategory,
  idType,
  isResubmission,
}: {
  fullName: string;
  phone: string;
  userCategory: UserCategory;
  idType: IdType;
  isResubmission: boolean;
}) {
  const actionText = isResubmission
    ? 'resubmitted their verification details'
    : 'submitted a new verification request';

  return `${fullName} has ${actionText}. Phone: ${phone}. Category: ${userCategory}. ID Type: ${idType}. Please review the uploaded ID front, ID back, and selfie photo.`;
}

async function createAdminNotifications({
  customerId,
  fullName,
  phone,
  userCategory,
  idType,
  isResubmission,
}: {
  customerId: string;
  fullName: string;
  phone: string;
  userCategory: UserCategory;
  idType: IdType;
  isResubmission: boolean;
}) {
  const { data: admins, error: adminsError } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .in('role', ['ADMIN', 'SUPER_ADMIN'])
    .eq('status', 'ACTIVE');

  if (adminsError) {
    console.error(
      'Admin lookup for verification notification failed:',
      adminsError
    );
    return;
  }

  if (!admins || admins.length === 0) {
    console.warn('No active admin found for verification notification.');
    return;
  }

  const title = isResubmission
    ? 'Verification Resubmitted'
    : 'New Verification Request';

  const message = buildVerificationNotificationMessage({
    fullName,
    phone,
    userCategory,
    idType,
    isResubmission,
  });

  const notifications: AdminVerificationNotificationInsert[] = admins.map(
    (admin) => ({
      user_id: admin.id,
      title,
      message,
      type: 'VERIFICATION',
      is_read: false,
      related_entity_id: customerId,
      related_entity_type: 'verification',
    })
  );

  const { error: notificationError } = await supabaseAdmin
    .from('notifications')
    .insert(notifications);

  if (notificationError) {
    console.error(
      'Verification submitted, but admin notification creation failed:',
      notificationError
    );
  }
}

export async function POST(request: Request) {
  const uploadedPaths: string[] = [];

  try {
    const token = getBearerToken(request);

    if (!token) {
      return NextResponse.json(
        {
          success: false,
          message: 'Unauthorized request. Please login again.',
        },
        { status: 401 }
      );
    }

    const supabaseAuth = createClient<Database>(supabaseUrl, supabaseAnonKey, {
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
      return NextResponse.json(
        {
          success: false,
          message: 'Your session has expired. Please login again.',
        },
        { status: 401 }
      );
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select(
        'id, full_name, phone, email, role, status, verification_status, user_category'
      )
      .eq('id', user.id)
      .maybeSingle();

    if (profileError || !profile) {
      return NextResponse.json(
        {
          success: false,
          message: 'Your account profile could not be found.',
        },
        { status: 404 }
      );
    }

    if (profile.status !== 'ACTIVE') {
      return NextResponse.json(
        {
          success: false,
          message: 'Your account is not active.',
        },
        { status: 403 }
      );
    }

    if (profile.role === 'ADMIN' || profile.role === 'SUPER_ADMIN') {
      return NextResponse.json(
        {
          success: false,
          message:
            'Admin accounts cannot submit customer verification from this page.',
        },
        { status: 403 }
      );
    }

    if (profile.role === 'AGENT') {
      return NextResponse.json(
        {
          success: false,
          message:
            'Agent accounts should use the agent customer verification flow.',
        },
        { status: 403 }
      );
    }

    if (profile.verification_status === 'VERIFIED') {
      return NextResponse.json(
        {
          success: false,
          message: 'Your account is already verified.',
        },
        { status: 400 }
      );
    }

    const { data: existingRequest, error: existingRequestError } =
      await supabaseAdmin
        .from('verification_requests')
        .select('id, status')
        .eq('user_id', profile.id)
        .maybeSingle();

    if (existingRequestError) {
      return NextResponse.json(
        {
          success: false,
          message:
            existingRequestError.message ||
            'Could not check existing verification request.',
        },
        { status: 500 }
      );
    }

    if (
      existingRequest?.status === 'PENDING' &&
      profile.verification_status === 'PENDING'
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            'Your verification is already under review. Please wait for admin approval.',
        },
        { status: 400 }
      );
    }

    const formData = await request.formData();

    const fullName = requiredText(formData.get('full_name'));
    const phone = requiredText(formData.get('phone'));
    const email = cleanText(formData.get('email'));

    const userCategory = normalizeUserCategory(formData.get('user_category'));
    const gender = normalizeGender(formData.get('gender'));
    const idType = normalizeIdType(formData.get('id_type'));
    const idNumber = requiredText(formData.get('id_number'));

    const country = cleanText(formData.get('country')) || 'Ghana';
    const region = cleanText(formData.get('region'));
    const city = cleanText(formData.get('city'));
    const location = cleanText(formData.get('location'));
    const dateOfBirth = cleanText(formData.get('date_of_birth'));

    const occupation = cleanText(formData.get('occupation'));
    const employerName = cleanText(formData.get('employer_name'));
    const staffId = cleanText(formData.get('staff_id'));

    const businessName = cleanText(formData.get('business_name'));
    const businessType = cleanText(formData.get('business_type'));
    const businessLocation = cleanText(formData.get('business_location'));

    const emergencyContactName = requiredText(
      formData.get('emergency_contact_name')
    );
    const emergencyContactPhone = requiredText(
      formData.get('emergency_contact_phone')
    );

    const momoNumber = cleanText(formData.get('momo_number'));
    const bankName = cleanText(formData.get('bank_name'));
    const bankAccountName = cleanText(formData.get('bank_account_name'));
    const bankAccountNumber = cleanText(formData.get('bank_account_number'));

    const idFrontFile = getFile(formData, 'id_document_front');
    const idBackFile = getFile(formData, 'id_document_back');
    const selfieFile = getFile(formData, 'selfie');

    if (!fullName) {
      return NextResponse.json(
        { success: false, message: 'Please enter your full name.' },
        { status: 400 }
      );
    }

    if (!phone) {
      return NextResponse.json(
        { success: false, message: 'Please enter your phone number.' },
        { status: 400 }
      );
    }

    if (!idType) {
      return NextResponse.json(
        { success: false, message: 'Please select the ID type you are using.' },
        { status: 400 }
      );
    }

    if (!idNumber) {
      return NextResponse.json(
        { success: false, message: 'Please enter the selected ID number.' },
        { status: 400 }
      );
    }

    if (!idFrontFile) {
      return NextResponse.json(
        {
          success: false,
          message: 'Please upload the front picture of the selected ID.',
        },
        { status: 400 }
      );
    }

    if (!idBackFile) {
      return NextResponse.json(
        {
          success: false,
          message: 'Please upload the back picture of the selected ID.',
        },
        { status: 400 }
      );
    }

    if (!selfieFile) {
      return NextResponse.json(
        {
          success: false,
          message: 'Please upload your selfie or passport photo.',
        },
        { status: 400 }
      );
    }

    if (
      ['GOVERNMENT_WORKER', 'TEACHER', 'NURSE'].includes(userCategory) &&
      !employerName
    ) {
      return NextResponse.json(
        {
          success: false,
          message: 'Please enter your employer or institution name.',
        },
        { status: 400 }
      );
    }

    if (
      ['BUSINESS_OWNER', 'MARKET_WOMAN', 'TRADER'].includes(userCategory) &&
      !businessLocation
    ) {
      return NextResponse.json(
        { success: false, message: 'Please enter your business location.' },
        { status: 400 }
      );
    }

    if (!emergencyContactName) {
      return NextResponse.json(
        {
          success: false,
          message: 'Please enter your emergency contact name.',
        },
        { status: 400 }
      );
    }

    if (!emergencyContactPhone) {
      return NextResponse.json(
        {
          success: false,
          message: 'Please enter your emergency contact phone number.',
        },
        { status: 400 }
      );
    }

    const isResubmission =
      profile.verification_status === 'REJECTED' ||
      existingRequest?.status === 'REJECTED';

    const idFrontPath = await uploadKycFile({
      userId: profile.id,
      file: idFrontFile,
      folder: 'id-front',
    });

    uploadedPaths.push(idFrontPath);

    const idBackPath = await uploadKycFile({
      userId: profile.id,
      file: idBackFile,
      folder: 'id-back',
    });

    uploadedPaths.push(idBackPath);

    const selfiePath = await uploadKycFile({
      userId: profile.id,
      file: selfieFile,
      folder: 'selfie',
    });

    uploadedPaths.push(selfiePath);

    const verificationPayload: VerificationInsert = {
      user_id: profile.id,
      full_name: fullName,
      phone,
      email,

      user_category: userCategory,
      country,
      region,
      city,
      location,

      date_of_birth: dateOfBirth,
      gender,

      ghana_card_number: idNumber,

      occupation,
      employer_name: employerName,
      staff_id: staffId,

      business_name: businessName,
      business_type: businessType,
      business_location: businessLocation,

      emergency_contact_name: emergencyContactName,
      emergency_contact_phone: emergencyContactPhone,

      momo_number: momoNumber,
      bank_name: bankName,
      bank_account_name: bankAccountName,
      bank_account_number: bankAccountNumber,

      ghana_card_front_url: idFrontPath,
      ghana_card_back_url: idBackPath,
      selfie_url: selfiePath,
      employment_proof_url: null,
      business_proof_url: null,

      submitted_by_agent: null,
      status: 'PENDING',
      rejection_reason: null,
      reviewed_by: null,
      reviewed_at: null,
      updated_at: new Date().toISOString(),
    };

    const { data: verificationRequest, error: verificationError } =
      await supabaseAdmin
        .from('verification_requests')
        .upsert(verificationPayload, {
          onConflict: 'user_id',
        })
        .select('id, user_id, status')
        .single();

    if (verificationError || !verificationRequest) {
      await deleteUploadedFiles(uploadedPaths);

      return NextResponse.json(
        {
          success: false,
          message:
            verificationError?.message ||
            'Could not submit your verification request.',
        },
        { status: 500 }
      );
    }

    const profilePayload: ProfileUpdate = {
      full_name: fullName,
      phone,
      email,
      user_category: userCategory,
      verification_status: 'PENDING',
      country,
      region,
      city,
      location,
      date_of_birth: dateOfBirth,
      gender,
      ghana_card: idType === 'GHANA_CARD' ? idNumber : null,
      ghana_card_verified: false,
      occupation,
      employer_name: employerName,
      staff_id: staffId,
      business_name: businessName,
      business_type: businessType,
      business_location: businessLocation,
      emergency_contact_name: emergencyContactName,
      emergency_contact_phone: emergencyContactPhone,
      momo_number: momoNumber,
      bank_name: bankName,
      bank_account_name: bankAccountName,
      bank_account_number: bankAccountNumber,
      updated_at: new Date().toISOString(),
    };

    const { error: profileUpdateError } = await supabaseAdmin
      .from('profiles')
      .update(profilePayload)
      .eq('id', profile.id);

    if (profileUpdateError) {
      return NextResponse.json(
        {
          success: false,
          message:
            profileUpdateError.message ||
            'Verification was submitted but profile update failed.',
        },
        { status: 500 }
      );
    }

    await createAdminNotifications({
      customerId: profile.id,
      fullName,
      phone,
      userCategory,
      idType,
      isResubmission,
    });

    return NextResponse.json({
      success: true,
      message: isResubmission
        ? 'Verification resubmitted successfully. Admin will review your documents again.'
        : 'Verification submitted successfully. Admin will review your documents before you can join a Fund Space group.',
      verification_request: verificationRequest,
      verification_status: 'PENDING',
    });
  } catch (error) {
    await deleteUploadedFiles(uploadedPaths);

    console.error('Customer verification submit API error:', error);

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