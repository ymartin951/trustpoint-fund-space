import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ManualSubmissionActionBody = {
  submission_id?: string;
  action?: 'APPROVE' | 'REJECT' | string;
  rejection_reason?: string;
};

type AdminProfile = {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  role: string | null;
  status: string | null;
  is_blacklisted?: boolean | null;
};

type ManualPaymentSubmission = {
  id: string;
  contribution_id: string;
  fund_space_id: string;
  round_id: string;
  user_id: string;
  agent_id: string | null;
  company_payment_account_id: string | null;
  amount_due: number | string | null;
  service_fee: number | string | null;
  total_amount_paid: number | string | null;
  sender_name: string | null;
  sender_phone: string | null;
  sender_network: string | null;
  transaction_reference: string;
  payment_note: string | null;
  screenshot_url: string | null;
  submitted_by: string | null;
  submitted_by_role: string | null;
  status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  approved_contribution_transaction_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  payer_type?: string | null;
  payer_relationship?: string | null;
  actual_payment_date?: string | null;
  actual_payment_time?: string | null;
  actual_payment_at?: string | null;
  actual_payment_source?: string | null;
};

type ContributionRow = {
  id: string;
  fund_space_id: string;
  round_id: string;
  user_id: string;
  amount_due: number | string | null;
  amount_paid: number | string | null;
  status: string | null;
  payment_method: string | null;
  payment_reference: string | null;
  paid_at: string | null;
  confirmed_by: string | null;
};

function getSupabaseUrl() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;

  if (!supabaseUrl) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL is not configured.'
    );
  }

  return supabaseUrl;
}

function getAnonKey() {
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!anonKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is not configured.');
  }

  return anonKey;
}

function getServiceRoleKey() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured.');
  }

  return serviceRoleKey;
}

function createUserClient(accessToken: string) {
  return createClient(getSupabaseUrl(), getAnonKey(), {
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

function createServiceClient() {
  return createClient(getSupabaseUrl(), getServiceRoleKey(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
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

function normalizeText(value: string | null | undefined) {
  return String(value || '').trim();
}

function normalizeRole(role: string | null | undefined) {
  return String(role || '').trim().toUpperCase().replaceAll('-', '_');
}

function isAdminRole(role: string | null | undefined) {
  const value = normalizeRole(role);

  return value === 'ADMIN' || value === 'SUPER_ADMIN';
}

function toMoney(value: number | string | null | undefined) {
  const amount =
    typeof value === 'string' ? Number(value.replace(/,/g, '')) : Number(value);

  if (!Number.isFinite(amount)) return 0;

  return amount;
}

function getAccessToken(request: NextRequest) {
  const authorizationHeader =
    request.headers.get('authorization') ||
    request.headers.get('Authorization');

  if (!authorizationHeader?.startsWith('Bearer ')) {
    return '';
  }

  return authorizationHeader.replace('Bearer ', '').trim();
}

async function getAuthenticatedAdmin(request: NextRequest) {
  const accessToken = getAccessToken(request);

  if (!accessToken) {
    return {
      user: null,
      profile: null,
      response: errorResponse('Unauthorized request. Please log in again.', 401),
    };
  }

  const userSupabase = createUserClient(accessToken);

  const {
    data: { user },
    error: userError,
  } = await userSupabase.auth.getUser(accessToken);

  if (userError || !user) {
    return {
      user: null,
      profile: null,
      response: errorResponse(
        'Your session has expired. Please log in again.',
        401
      ),
    };
  }

  const serviceSupabase = createServiceClient();

  const { data: profile, error: profileError } = await serviceSupabase
    .from('profiles')
    .select('id, full_name, phone, email, role, status, is_blacklisted')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) {
    console.error('Admin profile lookup error:', profileError);

    return {
      user,
      profile: null,
      response: errorResponse('Unable to verify admin profile.', 500),
    };
  }

  if (!profile) {
    return {
      user,
      profile: null,
      response: errorResponse('Admin profile not found.', 404),
    };
  }

  const adminProfile = profile as AdminProfile;

  if (!isAdminRole(adminProfile.role)) {
    return {
      user,
      profile: adminProfile,
      response: errorResponse(
        'Only admins can manage manual payment submissions.',
        403
      ),
    };
  }

  if (normalizeRole(adminProfile.status) !== 'ACTIVE') {
    return {
      user,
      profile: adminProfile,
      response: errorResponse('Your admin account must be active.', 403),
    };
  }

  if (adminProfile.is_blacklisted) {
    return {
      user,
      profile: adminProfile,
      response: errorResponse(
        'This admin account cannot manage submissions.',
        403
      ),
    };
  }

  return {
    user,
    profile: adminProfile,
    response: null,
  };
}

async function safeNotify({
  supabase,
  userId,
  title,
  message,
  relatedEntityId,
  dedupeKey,
}: {
  supabase: ReturnType<typeof createServiceClient>;
  userId: string | null | undefined;
  title: string;
  message: string;
  relatedEntityId: string;
  dedupeKey: string;
}) {
  if (!userId) return;

  try {
    const rpcClient = supabase as any;

    await rpcClient.rpc('create_deduped_notification', {
      p_user_id: userId,
      p_title: title,
      p_message: message,
      p_type: 'INFO',
      p_related_entity_type: 'manual_payment_submissions',
      p_related_entity_id: relatedEntityId,
      p_dedupe_key: dedupeKey,
    });
  } catch (error) {
    console.error('Manual payment notification warning:', error);
  }
}

async function syncContributionTiming({
  supabase,
  contributionId,
}: {
  supabase: ReturnType<typeof createServiceClient>;
  contributionId: string;
}) {
  try {
    const rpcClient = supabase as any;

    await rpcClient.rpc('sync_contribution_payment_timing', {
      p_contribution_id: contributionId,
    });
  } catch (error) {
    console.error('Contribution timing sync warning:', error);
  }
}

async function loadProfilesMap(
  supabase: ReturnType<typeof createServiceClient>,
  userIds: string[]
) {
  const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));

  if (uniqueIds.length === 0) {
    return new Map<string, any>();
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, phone, email, role, status, verification_status')
    .in('id', uniqueIds);

  if (error) {
    throw error;
  }

  return new Map((data || []).map((item: any) => [item.id, item]));
}

async function loadFundSpacesMap(
  supabase: ReturnType<typeof createServiceClient>,
  fundSpaceIds: string[]
) {
  const uniqueIds = Array.from(new Set(fundSpaceIds.filter(Boolean)));

  if (uniqueIds.length === 0) {
    return new Map<string, any>();
  }

  const { data, error } = await supabase
    .from('fund_spaces')
    .select('id, name, contribution_amount, status')
    .in('id', uniqueIds);

  if (error) {
    throw error;
  }

  return new Map((data || []).map((item: any) => [item.id, item]));
}

async function loadRoundsMap(
  supabase: ReturnType<typeof createServiceClient>,
  roundIds: string[]
) {
  const uniqueIds = Array.from(new Set(roundIds.filter(Boolean)));

  if (uniqueIds.length === 0) {
    return new Map<string, any>();
  }

  const { data, error } = await supabase
    .from('fund_space_rounds')
    .select('id, round_number, contribution_deadline, status')
    .in('id', uniqueIds);

  if (error) {
    throw error;
  }

  return new Map((data || []).map((item: any) => [item.id, item]));
}

async function loadCompanyAccountsMap(
  supabase: ReturnType<typeof createServiceClient>,
  accountIds: string[]
) {
  const uniqueIds = Array.from(new Set(accountIds.filter(Boolean)));

  if (uniqueIds.length === 0) {
    return new Map<string, any>();
  }

  const { data, error } = await supabase
    .from('company_payment_accounts')
    .select('id, account_name, provider, network, merchant_number, merchant_id')
    .in('id', uniqueIds);

  if (error) {
    throw error;
  }

  return new Map((data || []).map((item: any) => [item.id, item]));
}

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedAdmin(request);

    if (auth.response || !auth.user || !auth.profile) {
      return auth.response;
    }

    const status = normalizeText(request.nextUrl.searchParams.get('status'));
    const search = normalizeText(
      request.nextUrl.searchParams.get('search')
    ).toLowerCase();

    const supabase = createServiceClient();

    let query = supabase
      .from('manual_payment_submissions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);

    if (status && status !== 'ALL') {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Manual payment submissions load error:', error);

      return errorResponse('Unable to load manual payment submissions.', 500);
    }

    const rows = (data || []) as ManualPaymentSubmission[];

    const customerIds = rows.map((item) => item.user_id).filter(Boolean);
    const agentIds = rows.map((item) => item.agent_id || '').filter(Boolean);
    const submittedByIds = rows
      .map((item) => item.submitted_by || '')
      .filter(Boolean);
    const reviewedByIds = rows.map((item) => item.reviewed_by || '').filter(Boolean);

    const profileMap = await loadProfilesMap(supabase, [
      ...customerIds,
      ...agentIds,
      ...submittedByIds,
      ...reviewedByIds,
    ]);

    const fundSpaceMap = await loadFundSpacesMap(
      supabase,
      rows.map((item) => item.fund_space_id).filter(Boolean)
    );

    const roundMap = await loadRoundsMap(
      supabase,
      rows.map((item) => item.round_id).filter(Boolean)
    );

    const companyAccountMap = await loadCompanyAccountsMap(
      supabase,
      rows
        .map((item) => item.company_payment_account_id || '')
        .filter(Boolean)
    );

    const submissions = rows.map((item) => ({
      ...item,
      customer: profileMap.get(item.user_id) || null,
      agent: item.agent_id ? profileMap.get(item.agent_id) || null : null,
      submitted_by_profile: item.submitted_by
        ? profileMap.get(item.submitted_by) || null
        : null,
      reviewed_by_profile: item.reviewed_by
        ? profileMap.get(item.reviewed_by) || null
        : null,
      fund_space: fundSpaceMap.get(item.fund_space_id) || null,
      round: roundMap.get(item.round_id) || null,
      company_account: item.company_payment_account_id
        ? companyAccountMap.get(item.company_payment_account_id) || null
        : null,
    }));

    const filteredSubmissions = search
      ? submissions.filter((item: any) => {
          const values = [
            item.transaction_reference,
            item.sender_name,
            item.sender_phone,
            item.sender_network,
            item.status,
            item.customer?.full_name,
            item.customer?.phone,
            item.customer?.email,
            item.agent?.full_name,
            item.agent?.phone,
            item.fund_space?.name,
            item.round?.round_number ? `round ${item.round.round_number}` : '',
          ];

          return values
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
            .includes(search);
        })
      : submissions;

    const stats = {
      total: submissions.length,
      pending: submissions.filter((item) => item.status === 'PENDING_REVIEW')
        .length,
      approved: submissions.filter((item) => item.status === 'APPROVED').length,
      rejected: submissions.filter((item) => item.status === 'REJECTED').length,
      cancelled: submissions.filter((item) => item.status === 'CANCELLED')
        .length,
      total_pending_value: submissions
        .filter((item) => item.status === 'PENDING_REVIEW')
        .reduce((sum, item) => sum + toMoney(item.total_amount_paid), 0),
      total_approved_value: submissions
        .filter((item) => item.status === 'APPROVED')
        .reduce((sum, item) => sum + toMoney(item.total_amount_paid), 0),
    };

    return NextResponse.json({
      success: true,
      submissions: filteredSubmissions,
      stats,
    });
  } catch (error) {
    console.error('Admin manual submissions GET error:', error);

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : 'Unable to load manual payment submissions.',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedAdmin(request);

    if (auth.response || !auth.user || !auth.profile) {
      return auth.response;
    }

    const body = (await request.json().catch(() => null)) as
      | ManualSubmissionActionBody
      | null;

    if (!body) {
      return errorResponse('Invalid request body.', 400);
    }

    const submissionId = normalizeText(body.submission_id);
    const action = normalizeText(body.action).toUpperCase();
    const rejectionReason = normalizeText(body.rejection_reason);

    if (!submissionId) {
      return errorResponse('Submission ID is required.');
    }

    if (!['APPROVE', 'REJECT'].includes(action)) {
      return errorResponse('Invalid action. Use APPROVE or REJECT.');
    }

    if (action === 'REJECT' && !rejectionReason) {
      return errorResponse('Rejection reason is required.');
    }

    const supabase = createServiceClient();

    const { data: submissionData, error: submissionError } = await supabase
      .from('manual_payment_submissions')
      .select('*')
      .eq('id', submissionId)
      .maybeSingle();

    if (submissionError) {
      console.error('Manual payment submission lookup error:', submissionError);

      return errorResponse('Unable to load manual payment submission.', 500);
    }

    if (!submissionData) {
      return errorResponse('Manual payment submission not found.', 404);
    }

    const submission = submissionData as ManualPaymentSubmission;

    if (submission.status !== 'PENDING_REVIEW') {
      return errorResponse(
        `This submission cannot be reviewed because its current status is ${submission.status}.`,
        409
      );
    }

    const { data: contributionData, error: contributionError } = await supabase
      .from('fund_space_contributions')
      .select(
        'id, fund_space_id, round_id, user_id, amount_due, amount_paid, status, payment_method, payment_reference, paid_at, confirmed_by'
      )
      .eq('id', submission.contribution_id)
      .maybeSingle();

    if (contributionError) {
      console.error('Contribution lookup during approval error:', contributionError);

      return errorResponse('Unable to load contribution record.', 500);
    }

    if (!contributionData) {
      return errorResponse('Contribution record not found.', 404);
    }

    const contribution = contributionData as ContributionRow;

    if (action === 'REJECT') {
      const { data: rejectedSubmission, error: rejectError } = await supabase
        .from('manual_payment_submissions')
        .update({
          status: 'REJECTED',
          reviewed_by: auth.user.id,
          reviewed_at: new Date().toISOString(),
          rejection_reason: rejectionReason,
          updated_at: new Date().toISOString(),
        })
        .eq('id', submission.id)
        .eq('status', 'PENDING_REVIEW')
        .select('*')
        .single();

      if (rejectError) {
        console.error('Manual payment rejection error:', rejectError);

        return errorResponse('Unable to reject manual payment submission.', 500);
      }

      await safeNotify({
        supabase,
        userId: submission.user_id,
        title: 'MoMo payment rejected',
        message: `Your MoMo payment reference was rejected. Reason: ${rejectionReason}`,
        relatedEntityId: submission.id,
        dedupeKey: `manual_payment_rejected:${submission.id}:customer`,
      });

      if (submission.agent_id) {
        await safeNotify({
          supabase,
          userId: submission.agent_id,
          title: 'Customer MoMo payment rejected',
          message: `A customer MoMo payment reference was rejected. Reason: ${rejectionReason}`,
          relatedEntityId: submission.id,
          dedupeKey: `manual_payment_rejected:${submission.id}:agent`,
        });
      }

      return NextResponse.json({
        success: true,
        message: 'Manual payment submission rejected successfully.',
        submission: rejectedSubmission,
      });
    }

    const amountDue = toMoney(contribution.amount_due);
    const submissionAmountDue = toMoney(submission.amount_due);
    const contributionAmountToRecord =
      amountDue > 0 ? amountDue : submissionAmountDue;

    if (contributionAmountToRecord <= 0) {
      return errorResponse(
        'Payment amount must be greater than zero. Contribution amount due was not found.',
        400
      );
    }

    const actualPaymentAt =
      submission.actual_payment_at || submission.created_at || new Date().toISOString();

    const { data: updatedContribution, error: updateContributionError } =
      await supabase
        .from('fund_space_contributions')
        .update({
          amount_paid: contributionAmountToRecord,
          status: 'PAID',
          payment_method: 'MANUAL_ADMIN',
          payment_reference: submission.transaction_reference,
          paid_at: actualPaymentAt,
          confirmed_by: auth.user.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', contribution.id)
        .select('*')
        .single();

    if (updateContributionError) {
      console.error(
        'Contribution update during manual payment approval error:',
        updateContributionError
      );

      return errorResponse(
        updateContributionError.message ||
          'Unable to confirm contribution payment.',
        500
      );
    }

    const { data: approvedSubmission, error: approveError } = await supabase
      .from('manual_payment_submissions')
      .update({
        status: 'APPROVED',
        reviewed_by: auth.user.id,
        reviewed_at: new Date().toISOString(),
        rejection_reason: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', submission.id)
      .eq('status', 'PENDING_REVIEW')
      .select('*')
      .single();

    if (approveError) {
      console.error('Manual payment approval update error:', approveError);

      return errorResponse('Contribution was paid, but approval record failed.', 500);
    }

    await syncContributionTiming({
      supabase,
      contributionId: contribution.id,
    });

    await safeNotify({
      supabase,
      userId: submission.user_id,
      title: 'MoMo payment approved',
      message:
        'Your MoMo payment has been approved and your contribution has been confirmed.',
      relatedEntityId: submission.id,
      dedupeKey: `manual_payment_approved:${submission.id}:customer`,
    });

    if (submission.agent_id) {
      await safeNotify({
        supabase,
        userId: submission.agent_id,
        title: 'Customer MoMo payment approved',
        message:
          'Your customer MoMo payment submission has been approved by admin.',
        relatedEntityId: submission.id,
        dedupeKey: `manual_payment_approved:${submission.id}:agent`,
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Manual payment approved successfully.',
      submission: approvedSubmission,
      contribution: updatedContribution,
      actual_payment_at_used: actualPaymentAt,
    });
  } catch (error) {
    console.error('Admin manual submissions POST error:', error);

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : 'Unable to review manual payment submission.',
      },
      { status: 500 }
    );
  }
}