import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

type ReviewBody = {
  guarantor_id?: string;
  action?: 'APPROVE' | 'REJECT' | string;
  rejection_reason?: string;
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

function isAdminRole(role: string | null | undefined) {
  const value = String(role || '').toUpperCase();

  return value === 'ADMIN' || value === 'SUPER_ADMIN';
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

async function getAuthenticatedAdmin(request: NextRequest) {
  const token = getBearerToken(request);

  if (!token) {
    return {
      user: null,
      profile: null,
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
      profile: null,
      response: errorResponse(
        'Your session has expired. Please log in again.',
        401
      ),
    };
  }

  const { data: profile, error: profileError } = await serviceSupabase
    .from('profiles')
    .select('id, full_name, phone, email, role, status')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) {
    console.error('Admin guarantor profile lookup error:', profileError);

    return {
      user,
      profile: null,
      response: errorResponse(
        profileError.message || 'Unable to verify admin profile.',
        500
      ),
    };
  }

  if (!profile || !isAdminRole(profile.role)) {
    return {
      user,
      profile,
      response: errorResponse('Access denied. Admin account required.', 403),
    };
  }

  if (String(profile.status || '').toUpperCase() !== 'ACTIVE') {
    return {
      user,
      profile,
      response: errorResponse('Admin account must be active.', 403),
    };
  }

  return {
    user,
    profile,
    response: null,
  };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedAdmin(request);

    if (auth.response || !auth.user || !auth.profile) {
      return auth.response;
    }

    const { searchParams } = new URL(request.url);
    const status = cleanText(searchParams.get('status')).toUpperCase();
    const search = cleanText(searchParams.get('search')).toLowerCase();

    let query = serviceSupabase
      .from('fund_space_guarantors')
      .select(
        `
        id,
        user_id,
        full_name,
        phone,
        relationship_to_member,
        location,
        id_type,
        id_number,
        consent_status,
        verification_status,
        admin_review_status,
        rejection_reason,
        reviewed_by,
        reviewed_at,
        created_at,
        updated_at
      `
      )
      .order('created_at', { ascending: false });

    if (['PENDING', 'APPROVED', 'REJECTED'].includes(status)) {
      query = query.eq('admin_review_status', status);
    }

    const { data: guarantors, error: guarantorError } = await query;

    if (guarantorError) {
      console.error('Admin guarantors lookup error:', guarantorError);

      return errorResponse(
        guarantorError.message || 'Unable to load guarantor submissions.',
        500
      );
    }

    const memberIds = Array.from(
      new Set((guarantors || []).map((item) => item.user_id).filter(Boolean))
    );

    const reviewerIds = Array.from(
      new Set((guarantors || []).map((item) => item.reviewed_by).filter(Boolean))
    );

    const profileIds = Array.from(new Set([...memberIds, ...reviewerIds]));

    const { data: profiles, error: profileError } = profileIds.length
      ? await serviceSupabase
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
          .in('id', profileIds)
      : { data: [], error: null };

    if (profileError) {
      console.error('Admin guarantors profiles lookup error:', profileError);

      return errorResponse(
        profileError.message || 'Unable to load member profiles.',
        500
      );
    }

    const profileMap = new Map((profiles || []).map((item) => [item.id, item]));

    const records = (guarantors || []).map((guarantor) => ({
      ...guarantor,
      member: profileMap.get(guarantor.user_id) || null,
      reviewed_by_profile: guarantor.reviewed_by
        ? profileMap.get(guarantor.reviewed_by) || null
        : null,
    }));

    const filteredRecords = search
      ? records.filter((record) => {
          const haystack = [
            record.full_name,
            record.phone,
            record.relationship_to_member,
            record.location,
            record.id_type,
            record.id_number,
            record.admin_review_status,
            record.verification_status,
            record.consent_status,
            record.member?.full_name,
            record.member?.phone,
            record.member?.email,
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();

          return haystack.includes(search);
        })
      : records;

    const stats = {
      total: records.length,
      pending: records.filter((item) => item.admin_review_status === 'PENDING')
        .length,
      approved: records.filter((item) => item.admin_review_status === 'APPROVED')
        .length,
      rejected: records.filter((item) => item.admin_review_status === 'REJECTED')
        .length,
    };

    return NextResponse.json({
      success: true,
      records: filteredRecords,
      stats,
    });
  } catch (error) {
    console.error('Admin guarantors GET error:', error);

    return errorResponse(
      error instanceof Error
        ? error.message
        : 'Unable to load guarantor submissions.',
      500
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedAdmin(request);

    if (auth.response || !auth.user || !auth.profile) {
      return auth.response;
    }

    const body = (await request.json().catch(() => null)) as ReviewBody | null;

    if (!body) {
      return errorResponse('Invalid request body.');
    }

    const guarantorId = cleanText(body.guarantor_id);
    const action = cleanText(body.action).toUpperCase();
    const rejectionReason = cleanText(body.rejection_reason);

    if (!guarantorId) {
      return errorResponse('Guarantor ID is required.');
    }

    if (!['APPROVE', 'REJECT'].includes(action)) {
      return errorResponse('Action must be APPROVE or REJECT.');
    }

    if (action === 'REJECT' && !rejectionReason) {
      return errorResponse('Rejection reason is required.');
    }

    const { data: guarantor, error: guarantorError } = await serviceSupabase
      .from('fund_space_guarantors')
      .select('id, user_id, full_name, phone, admin_review_status')
      .eq('id', guarantorId)
      .maybeSingle();

    if (guarantorError) {
      console.error('Guarantor lookup before review error:', guarantorError);

      return errorResponse(
        guarantorError.message || 'Unable to find guarantor record.',
        500
      );
    }

    if (!guarantor) {
      return errorResponse('Guarantor record not found.', 404);
    }

    const rpcClient = serviceSupabase as any;

    const { data, error } = await rpcClient.rpc('review_member_guarantor', {
      p_guarantor_id: guarantorId,
      p_admin_id: auth.user.id,
      p_action: action,
      p_rejection_reason: action === 'REJECT' ? rejectionReason : null,
    });

    if (error) {
      console.error('Review guarantor RPC error:', error);

      return errorResponse(
        error.message || 'Unable to review guarantor.',
        500
      );
    }

    const notificationTitle =
      action === 'APPROVE'
        ? 'Guarantor approved'
        : 'Guarantor rejected';

    const notificationMessage =
      action === 'APPROVE'
        ? 'Your guarantor information has been approved. You can now meet the guarantor requirement for higher-value Fund Spaces.'
        : `Your guarantor information was rejected. Reason: ${rejectionReason}`;

    const { error: notificationError } = await serviceSupabase
      .from('notifications')
      .insert({
        user_id: guarantor.user_id,
        title: notificationTitle,
        message: notificationMessage,
        type: action === 'APPROVE' ? 'SUCCESS' : 'WARNING',
        related_entity_type: 'fund_space_guarantors',
        related_entity_id: guarantorId,
        dedupe_key: `guarantor-${action.toLowerCase()}-${guarantorId}-${guarantor.user_id}`,
        is_read: false,
      } as never);

    if (notificationError) {
      console.error('Guarantor user notification warning:', notificationError);
    }

    return NextResponse.json({
      success: true,
      message:
        data?.message ||
        (action === 'APPROVE'
          ? 'Guarantor approved successfully.'
          : 'Guarantor rejected successfully.'),
      result: data,
    });
  } catch (error) {
    console.error('Admin guarantors POST error:', error);

    return errorResponse(
      error instanceof Error ? error.message : 'Unable to review guarantor.',
      500
    );
  }
}