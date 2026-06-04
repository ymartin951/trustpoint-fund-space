import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

type GuarantorRow = {
  id: string;
  user_id: string;
  full_name: string;
  phone: string;
  relationship_to_member: string;
  location: string | null;
  id_type: string | null;
  id_number: string | null;
  consent_status: 'PENDING' | 'CONSENTED' | 'DECLINED' | string;
  verification_status: 'PENDING' | 'VERIFIED' | 'REJECTED' | string;
  admin_review_status: 'PENDING' | 'APPROVED' | 'REJECTED' | string;
  rejection_reason: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

type GuarantorBody = {
  full_name?: string;
  phone?: string;
  relationship_to_member?: string;
  location?: string;
  id_type?: string;
  id_number?: string;
};

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;

const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL');
}

if (!supabaseAnonKey) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY');
}

if (!serviceRoleKey) {
  throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
}

const serviceSupabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

function getBearerToken(request: NextRequest) {
  const authHeader =
    request.headers.get('authorization') ||
    request.headers.get('Authorization') ||
    '';

  const [scheme, token] = authHeader.split(' ');

  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return null;
  }

  return token.trim();
}

function createUserClient(accessToken: string) {
  return createClient(supabaseUrl!, supabaseAnonKey!, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}

function cleanText(value: string | null | undefined) {
  return String(value || '').trim();
}

function nullableText(value: string | null | undefined) {
  const clean = cleanText(value);
  return clean || null;
}

function errorResponse(message: string, status = 400) {
  return NextResponse.json(
    {
      success: false,
      message,
    },
    { status }
  );
}

async function getAuthenticatedUser(request: NextRequest) {
  const token = getBearerToken(request);

  if (!token) {
    return {
      user: null,
      response: errorResponse('Unauthorized. Please log in again.', 401),
    };
  }

  const userSupabase = createUserClient(token);

  const {
    data: { user },
    error,
  } = await userSupabase.auth.getUser(token);

  if (error || !user) {
    return {
      user: null,
      response: errorResponse(
        'Your session has expired. Please log in again.',
        401
      ),
    };
  }

  return {
    user,
    response: null,
  };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request);

    if (auth.response || !auth.user) {
      return auth.response;
    }

    const { data: profile, error: profileError } = await serviceSupabase
      .from('profiles')
      .select(
        `
        id,
        full_name,
        phone,
        email,
        role,
        status,
        verification_status,
        emergency_contact_name,
        emergency_contact_phone,
        business_name,
        business_type,
        business_location,
        employer_name,
        staff_id
      `
      )
      .eq('id', auth.user.id)
      .maybeSingle();

    if (profileError) {
      console.error('Guarantor profile lookup error:', profileError);

      return errorResponse(
        profileError.message || 'Unable to load your profile.',
        500
      );
    }

    if (!profile) {
      return errorResponse('Profile not found.', 404);
    }

    const { data: guarantors, error: guarantorError } = await serviceSupabase
      .from('fund_space_guarantors')
      .select('*')
      .eq('user_id', auth.user.id)
      .order('created_at', { ascending: false });

    if (guarantorError) {
      console.error('Guarantor lookup error:', guarantorError);

      return errorResponse(
        guarantorError.message || 'Unable to load guarantor information.',
        500
      );
    }

    const rpcClient = serviceSupabase as any;

    const [eligibility50, eligibility100, eligibility200, eligibility500] =
      await Promise.all([
        rpcClient.rpc('get_member_fund_space_eligibility', {
          p_user_id: auth.user.id,
          p_contribution_amount: 50,
        }),
        rpcClient.rpc('get_member_fund_space_eligibility', {
          p_user_id: auth.user.id,
          p_contribution_amount: 100,
        }),
        rpcClient.rpc('get_member_fund_space_eligibility', {
          p_user_id: auth.user.id,
          p_contribution_amount: 200,
        }),
        rpcClient.rpc('get_member_fund_space_eligibility', {
          p_user_id: auth.user.id,
          p_contribution_amount: 500,
        }),
      ]);

    const eligibilityErrors = [
      eligibility50.error,
      eligibility100.error,
      eligibility200.error,
      eligibility500.error,
    ].filter(Boolean);

    if (eligibilityErrors.length > 0) {
      console.error('Guarantor eligibility load warning:', eligibilityErrors);
    }

    return NextResponse.json({
      success: true,
      profile,
      guarantors: (guarantors || []) as GuarantorRow[],
      eligibility: {
        50: eligibility50.data || null,
        100: eligibility100.data || null,
        200: eligibility200.data || null,
        500: eligibility500.data || null,
      },
    });
  } catch (error) {
    console.error('Guarantor GET API error:', error);

    return errorResponse(
      error instanceof Error
        ? error.message
        : 'Unable to load guarantor information.',
      500
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request);

    if (auth.response || !auth.user) {
      return auth.response;
    }

    const body = (await request.json().catch(() => null)) as
      | GuarantorBody
      | null;

    if (!body) {
      return errorResponse('Invalid request body.');
    }

    const fullName = cleanText(body.full_name);
    const phone = cleanText(body.phone);
    const relationship = cleanText(body.relationship_to_member);

    if (!fullName) {
      return errorResponse('Guarantor full name is required.');
    }

    if (!phone) {
      return errorResponse('Guarantor phone number is required.');
    }

    if (!relationship) {
      return errorResponse('Relationship to member is required.');
    }

    const { data: profile, error: profileError } = await serviceSupabase
      .from('profiles')
      .select('id, status, verification_status')
      .eq('id', auth.user.id)
      .maybeSingle();

    if (profileError) {
      console.error('Guarantor submit profile lookup error:', profileError);

      return errorResponse(
        profileError.message || 'Unable to verify your profile.',
        500
      );
    }

    if (!profile) {
      return errorResponse('Profile not found.', 404);
    }

    if (profile.status !== 'ACTIVE') {
      return errorResponse(
        'Your account must be active before submitting guarantor information.',
        403
      );
    }

    if (profile.verification_status !== 'VERIFIED') {
      return errorResponse(
        'Your account must be verified before submitting guarantor information.',
        403
      );
    }

    const rpcClient = serviceSupabase as any;

    const { data, error } = await rpcClient.rpc('submit_member_guarantor', {
      p_user_id: auth.user.id,
      p_full_name: fullName,
      p_phone: phone,
      p_relationship_to_member: relationship,
      p_location: nullableText(body.location),
      p_id_type: nullableText(body.id_type),
      p_id_number: nullableText(body.id_number),
    });

    if (error) {
      console.error('Submit guarantor RPC error:', error);

      return errorResponse(
        error.message || 'Unable to submit guarantor information.',
        500
      );
    }

    const { data: admins } = await serviceSupabase
      .from('profiles')
      .select('id')
      .in('role', ['ADMIN', 'SUPER_ADMIN'])
      .eq('status', 'ACTIVE');

    if (admins && admins.length > 0) {
      const notifications = admins.map((admin) => ({
        user_id: admin.id,
        title: 'New guarantor submitted',
        message:
          'A member has submitted guarantor information for admin review.',
        type: 'INFO',
        related_entity_type: 'fund_space_guarantors',
        related_entity_id: data?.guarantor_id || null,
        dedupe_key: data?.guarantor_id
          ? `guarantor-submitted-${data.guarantor_id}-${admin.id}`
          : null,
        is_read: false,
      }));

      const { error: notificationError } = await serviceSupabase
        .from('notifications')
        .insert(notifications as never);

      if (notificationError) {
        console.error(
          'Guarantor admin notification warning:',
          notificationError
        );
      }
    }

    return NextResponse.json({
      success: true,
      message:
        data?.message ||
        'Guarantor information submitted successfully. Admin will review it.',
      result: data,
    });
  } catch (error) {
    console.error('Guarantor POST API error:', error);

    return errorResponse(
      error instanceof Error
        ? error.message
        : 'Unable to submit guarantor information.',
      500
    );
  }
}