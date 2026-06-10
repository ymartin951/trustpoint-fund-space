import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

type AppRole = 'USER' | 'AGENT' | 'ADMIN' | 'SUPER_ADMIN';

type DisputeCategory =
  | 'MISSED_PAYOUT'
  | 'WRONG_PAYMENT_RECORD'
  | 'AGENT_MISCONDUCT'
  | 'SUSPICIOUS_MEMBER'
  | 'WRONG_CONTRIBUTION_STATUS'
  | 'VERIFICATION_ISSUE'
  | 'LATE_FEE_OR_PENALTY'
  | 'OTHER';

type DisputePriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

const allowedCategories: DisputeCategory[] = [
  'MISSED_PAYOUT',
  'WRONG_PAYMENT_RECORD',
  'AGENT_MISCONDUCT',
  'SUSPICIOUS_MEMBER',
  'WRONG_CONTRIBUTION_STATUS',
  'VERIFICATION_ISSUE',
  'LATE_FEE_OR_PENALTY',
  'OTHER',
];

const allowedPriorities: DisputePriority[] = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];

function getBearerToken(request: NextRequest) {
  const authHeader = request.headers.get('authorization') || '';
  const [scheme, token] = authHeader.split(' ');

  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return null;
  }

  return token;
}

function normalizeText(value: unknown) {
  return String(value || '').trim();
}

function normalizeUuid(value: unknown) {
  const text = normalizeText(value);

  if (!text) return null;

  return text;
}

function normalizeRole(role: string | null | undefined): AppRole {
  const value = String(role || '').trim().toUpperCase();

  if (value === 'SUPER_ADMIN') return 'SUPER_ADMIN';
  if (value === 'ADMIN') return 'ADMIN';
  if (value === 'AGENT') return 'AGENT';

  return 'USER';
}

function normalizeCategory(value: unknown): DisputeCategory {
  const category = normalizeText(value).toUpperCase() as DisputeCategory;

  if (allowedCategories.includes(category)) {
    return category;
  }

  return 'OTHER';
}

function normalizePriority(value: unknown): DisputePriority {
  const priority = normalizeText(value).toUpperCase() as DisputePriority;

  if (allowedPriorities.includes(priority)) {
    return priority;
  }

  return 'NORMAL';
}

function isAdminRole(role: AppRole) {
  return role === 'ADMIN' || role === 'SUPER_ADMIN';
}

function makeSubject(category: DisputeCategory, providedSubject: string) {
  if (providedSubject) return providedSubject;

  return category
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export async function GET(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        {
          success: false,
          message: 'Server configuration is missing.',
        },
        { status: 500 }
      );
    }

    const token = getBearerToken(request);

    if (!token) {
      return NextResponse.json(
        {
          success: false,
          message: 'Unauthorized request. Please log in again.',
        },
        { status: 401 }
      );
    }

    const adminSupabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const {
      data: { user },
      error: userError,
    } = await adminSupabase.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json(
        {
          success: false,
          message: 'Your session has expired. Please log in again.',
        },
        { status: 401 }
      );
    }

    const { data: profile, error: profileError } = await adminSupabase
      .from('profiles')
      .select('id, full_name, phone, email, role, status, verification_status')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError || !profile) {
      return NextResponse.json(
        {
          success: false,
          message: 'Could not verify your profile.',
        },
        { status: 403 }
      );
    }

    const role = normalizeRole(profile.role);
    const { searchParams } = new URL(request.url);

    const status = normalizeText(searchParams.get('status')).toUpperCase();
    const category = normalizeText(searchParams.get('category')).toUpperCase();
    const fundSpaceId = normalizeText(searchParams.get('fund_space_id'));
    const roundId = normalizeText(searchParams.get('round_id'));
    const mineOnly = normalizeText(searchParams.get('mine')).toLowerCase() === 'true';
    const limit = Math.min(Number(searchParams.get('limit') || 100), 500);

    let query = adminSupabase
      .from('fund_space_disputes')
      .select(
        `
        id,
        user_id,
        fund_space_id,
        round_id,
        contribution_id,
        payout_id,
        related_user_id,
        subject,
        message,
        category,
        priority,
        evidence_url,
        status,
        admin_note,
        assigned_to,
        resolved_by,
        resolved_at,
        resolution_note,
        last_response_at,
        created_at,
        updated_at
        `
      )
      .order('created_at', { ascending: false })
      .limit(limit);

    if (!isAdminRole(role) || mineOnly) {
      query = query.eq('user_id', user.id);
    }

    if (status && status !== 'ALL') {
      query = query.eq('status', status);
    }

    if (category && category !== 'ALL') {
      query = query.eq('category', category);
    }

    if (fundSpaceId) {
      query = query.eq('fund_space_id', fundSpaceId);
    }

    if (roundId) {
      query = query.eq('round_id', roundId);
    }

    const { data: disputes, error: disputesError } = await query;

    if (disputesError) {
      return NextResponse.json(
        {
          success: false,
          message: disputesError.message || 'Unable to load disputes.',
        },
        { status: 500 }
      );
    }

    const rows = disputes || [];

    const userIds = [
      ...new Set(
        rows
          .flatMap((item: any) => [
            item.user_id,
            item.related_user_id,
            item.assigned_to,
            item.resolved_by,
          ])
          .filter(Boolean)
      ),
    ];

    const fundSpaceIds = [
      ...new Set(rows.map((item: any) => item.fund_space_id).filter(Boolean)),
    ];

    const roundIds = [
      ...new Set(rows.map((item: any) => item.round_id).filter(Boolean)),
    ];

    const contributionIds = [
      ...new Set(rows.map((item: any) => item.contribution_id).filter(Boolean)),
    ];

    const payoutIds = [
      ...new Set(rows.map((item: any) => item.payout_id).filter(Boolean)),
    ];

    const [
      profilesResult,
      fundSpacesResult,
      roundsResult,
      contributionsResult,
      payoutsResult,
    ] = await Promise.all([
      userIds.length
        ? adminSupabase
            .from('profiles')
            .select('id, full_name, phone, email, role, status, verification_status')
            .in('id', userIds)
        : Promise.resolve({ data: [], error: null }),

      fundSpaceIds.length
        ? adminSupabase
            .from('fund_spaces')
            .select('id, name, status, contribution_amount, current_round_number')
            .in('id', fundSpaceIds)
        : Promise.resolve({ data: [], error: null }),

      roundIds.length
        ? adminSupabase
            .from('fund_space_rounds')
            .select('id, fund_space_id, round_number, status, contribution_deadline')
            .in('id', roundIds)
        : Promise.resolve({ data: [], error: null }),

      contributionIds.length
        ? adminSupabase
            .from('fund_space_contributions')
            .select('id, fund_space_id, round_id, user_id, status, amount_due, amount_paid, payment_reference, paid_at')
            .in('id', contributionIds)
        : Promise.resolve({ data: [], error: null }),

      payoutIds.length
        ? adminSupabase
            .from('fund_space_payouts')
            .select('id, fund_space_id, round_id, recipient_user_id, status, gross_amount, net_amount, paid_at')
            .in('id', payoutIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (profilesResult.error) throw profilesResult.error;
    if (fundSpacesResult.error) throw fundSpacesResult.error;
    if (roundsResult.error) throw roundsResult.error;
    if (contributionsResult.error) throw contributionsResult.error;
    if (payoutsResult.error) throw payoutsResult.error;

    const profileById = new Map(
      ((profilesResult.data || []) as any[]).map((item) => [item.id, item])
    );

    const fundSpaceById = new Map(
      ((fundSpacesResult.data || []) as any[]).map((item) => [item.id, item])
    );

    const roundById = new Map(
      ((roundsResult.data || []) as any[]).map((item) => [item.id, item])
    );

    const contributionById = new Map(
      ((contributionsResult.data || []) as any[]).map((item) => [item.id, item])
    );

    const payoutById = new Map(
      ((payoutsResult.data || []) as any[]).map((item) => [item.id, item])
    );

    const enrichedDisputes = rows.map((item: any) => ({
      ...item,
      reporter: profileById.get(item.user_id) || null,
      related_user: item.related_user_id
        ? profileById.get(item.related_user_id) || null
        : null,
      assigned_admin: item.assigned_to
        ? profileById.get(item.assigned_to) || null
        : null,
      resolved_by_profile: item.resolved_by
        ? profileById.get(item.resolved_by) || null
        : null,
      fund_space: item.fund_space_id
        ? fundSpaceById.get(item.fund_space_id) || null
        : null,
      round: item.round_id ? roundById.get(item.round_id) || null : null,
      contribution: item.contribution_id
        ? contributionById.get(item.contribution_id) || null
        : null,
      payout: item.payout_id ? payoutById.get(item.payout_id) || null : null,
    }));

    const summary = {
      total: enrichedDisputes.length,
      open: enrichedDisputes.filter((item: any) => item.status === 'OPEN').length,
      under_review: enrichedDisputes.filter(
        (item: any) => item.status === 'UNDER_REVIEW'
      ).length,
      waiting_for_user: enrichedDisputes.filter(
        (item: any) => item.status === 'WAITING_FOR_USER'
      ).length,
      resolved: enrichedDisputes.filter((item: any) => item.status === 'RESOLVED')
        .length,
      rejected: enrichedDisputes.filter((item: any) => item.status === 'REJECTED')
        .length,
      urgent: enrichedDisputes.filter((item: any) => item.priority === 'URGENT')
        .length,
      high: enrichedDisputes.filter((item: any) => item.priority === 'HIGH').length,
    };

    return NextResponse.json({
      success: true,
      profile,
      role,
      summary,
      disputes: enrichedDisputes,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : 'Something went wrong while loading disputes.',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        {
          success: false,
          message: 'Server configuration is missing.',
        },
        { status: 500 }
      );
    }

    const token = getBearerToken(request);

    if (!token) {
      return NextResponse.json(
        {
          success: false,
          message: 'Unauthorized request. Please log in again.',
        },
        { status: 401 }
      );
    }

    const adminSupabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const {
      data: { user },
      error: userError,
    } = await adminSupabase.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json(
        {
          success: false,
          message: 'Your session has expired. Please log in again.',
        },
        { status: 401 }
      );
    }

    const { data: profile, error: profileError } = await adminSupabase
      .from('profiles')
      .select('id, full_name, phone, email, role, status')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError || !profile) {
      return NextResponse.json(
        {
          success: false,
          message: 'Could not verify your profile.',
        },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));

    const category = normalizeCategory(body.category);
    const priority = normalizePriority(body.priority);
    const subject = makeSubject(category, normalizeText(body.subject));
    const message = normalizeText(body.message || body.description);
    const fundSpaceId = normalizeUuid(body.fund_space_id);
    const roundId = normalizeUuid(body.round_id);
    const contributionId = normalizeUuid(body.contribution_id);
    const payoutId = normalizeUuid(body.payout_id);
    const relatedUserId = normalizeUuid(body.related_user_id);
    const evidenceUrl = normalizeText(body.evidence_url);

    if (!message || message.length < 10) {
      return NextResponse.json(
        {
          success: false,
          message: 'Please describe the issue clearly with at least 10 characters.',
        },
        { status: 400 }
      );
    }

    if (!subject || subject.length < 3) {
      return NextResponse.json(
        {
          success: false,
          message: 'Please provide a short subject for the complaint.',
        },
        { status: 400 }
      );
    }

    if (subject.length > 120) {
      return NextResponse.json(
        {
          success: false,
          message: 'Subject is too long. Keep it under 120 characters.',
        },
        { status: 400 }
      );
    }

    const insertPayload = {
      user_id: user.id,
      fund_space_id: fundSpaceId,
      round_id: roundId,
      contribution_id: contributionId,
      payout_id: payoutId,
      related_user_id: relatedUserId,
      category,
      priority,
      subject,
      message,
      evidence_url: evidenceUrl || null,
      status: 'OPEN',
      last_response_at: new Date().toISOString(),
    };

    const { data: dispute, error: insertError } = await adminSupabase
      .from('fund_space_disputes')
      .insert(insertPayload)
      .select('*')
      .single();

    if (insertError) {
      return NextResponse.json(
        {
          success: false,
          message: insertError.message || 'Unable to create dispute.',
        },
        { status: 500 }
      );
    }

    const { data: admins } = await adminSupabase
      .from('profiles')
      .select('id')
      .in('role', ['ADMIN', 'SUPER_ADMIN'])
      .eq('status', 'ACTIVE');

    const adminNotifications =
      admins?.map((admin) => ({
        user_id: admin.id,
        title: 'New Fund Space Complaint',
        message: `${profile.full_name || 'A user'} reported: ${subject}`,
        type: 'DISPUTE_CREATED',
        related_entity_type: 'fund_space_disputes',
        related_entity_id: dispute.id,
        is_read: false,
      })) || [];

    const userNotification = {
      user_id: user.id,
      title: 'Complaint Submitted',
      message: 'Your complaint has been submitted. TrustPoint will review it.',
      type: 'DISPUTE_CREATED',
      related_entity_type: 'fund_space_disputes',
      related_entity_id: dispute.id,
      is_read: false,
    };

    const notifications = [userNotification, ...adminNotifications];

    await adminSupabase.from('notifications').insert(notifications);

    return NextResponse.json({
      success: true,
      message: 'Complaint submitted successfully.',
      dispute,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : 'Something went wrong while submitting complaint.',
      },
      { status: 500 }
    );
  }
}