import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

type AppRole = 'USER' | 'AGENT' | 'ADMIN' | 'SUPER_ADMIN';

type ProfileRow = {
  id: string;
  full_name: string | null;
  phone: string | null;
  location: string | null;
  city: string | null;
  region: string | null;
  role: string | null;
  verification_status: string | null;
  status: string | null;
  registered_by_agent: string | null;
};

type AgentCustomerRow = {
  id: string;
  agent_id: string;
  customer_id: string;
  relationship_status: string;
  created_at: string | null;
  updated_at: string | null;
};

type ContributionRow = {
  id: string;
  fund_space_id: string;
  round_id: string;
  user_id: string;
  amount_due: number;
  amount_paid: number;
  confirmed_by: string | null;
  paid_at: string | null;
  payment_method: string | null;
  payment_reference: string | null;
  status: string;
  created_at: string | null;
  updated_at: string | null;
};

type FundSpaceRow = {
  id: string;
  name: string;
  contribution_amount: number;
  status: string;
  member_limit: number;
  current_round_number: number;
};

type RoundRow = {
  id: string;
  fund_space_id: string;
  round_number: number;
  recipient_user_id: string;
  contribution_amount: number;
  expected_total_amount: number;
  contribution_deadline: string;
  week_start_date: string;
  week_end_date: string;
  status: string;
};

type ManualPaymentSubmissionRow = {
  id: string;
  contribution_id: string;
  fund_space_id: string;
  round_id: string;
  user_id: string;
  agent_id: string | null;
  status: string;
  transaction_reference: string;
  total_amount_paid: number;
  amount_due: number;
  service_fee: number;
  payer_type: string;
  payer_relationship: string | null;
  sender_name: string | null;
  sender_phone: string | null;
  sender_network: string | null;
  payment_note: string | null;
  rejection_reason: string | null;
  created_at: string;
  reviewed_at: string | null;
};

function getBearerToken(request: NextRequest) {
  const authHeader = request.headers.get('authorization') || '';
  const [scheme, token] = authHeader.split(' ');

  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return null;
  }

  return token;
}

function normalizeRole(role: string | null | undefined): AppRole {
  const value = String(role || '').toUpperCase();

  if (value === 'SUPER_ADMIN') return 'SUPER_ADMIN';
  if (value === 'ADMIN') return 'ADMIN';
  if (value === 'AGENT') return 'AGENT';

  return 'USER';
}

function normalizeStatus(status: string | null | undefined) {
  return String(status || 'PENDING').toUpperCase();
}

function pickLatestManualSubmission(
  submissions: ManualPaymentSubmissionRow[]
) {
  const sorted = [...submissions].sort((a, b) => {
    const aPending = normalizeStatus(a.status) === 'PENDING_REVIEW' ? 1 : 0;
    const bPending = normalizeStatus(b.status) === 'PENDING_REVIEW' ? 1 : 0;

    if (aPending !== bPending) {
      return bPending - aPending;
    }

    const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
    const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;

    return bTime - aTime;
  });

  return sorted[0] || null;
}

function matchesSearch({
  search,
  contribution,
  customer,
  agent,
  fundSpace,
  round,
  manualSubmission,
}: {
  search: string;
  contribution: ContributionRow;
  customer: ProfileRow | null;
  agent: ProfileRow | null;
  fundSpace: FundSpaceRow | null;
  round: RoundRow | null;
  manualSubmission: ManualPaymentSubmissionRow | null;
}) {
  if (!search) return true;

  const value = search.toLowerCase();

  const haystack = [
    contribution.id,
    contribution.status,
    contribution.payment_reference,
    contribution.payment_method,
    customer?.full_name,
    customer?.phone,
    customer?.location,
    customer?.city,
    customer?.region,
    agent?.full_name,
    agent?.phone,
    fundSpace?.name,
    round?.round_number ? String(round.round_number) : '',
    manualSubmission?.transaction_reference,
    manualSubmission?.status,
    manualSubmission?.sender_name,
    manualSubmission?.sender_phone,
    manualSubmission?.sender_network,
    manualSubmission?.payer_type,
    manualSubmission?.payer_relationship,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return haystack.includes(value);
}

export async function GET(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        {
          success: false,
          message:
            'Server configuration is missing. Please check Supabase environment variables.',
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
      .select(
        'id, full_name, phone, location, city, region, role, verification_status, status, registered_by_agent'
      )
      .eq('id', user.id)
      .maybeSingle();

    if (profileError || !profile) {
      return NextResponse.json(
        {
          success: false,
          message: 'Could not verify your admin profile.',
        },
        { status: 403 }
      );
    }

    const role = normalizeRole(profile.role);

    if (!['ADMIN', 'SUPER_ADMIN'].includes(role)) {
      return NextResponse.json(
        {
          success: false,
          message:
            'Only admins and super admins can view all contribution records.',
        },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);

    const statusFilter = String(
      searchParams.get('status') || 'ALL'
    ).toUpperCase();

    const verificationFilter = String(
      searchParams.get('verification') || 'ALL'
    ).toUpperCase();

    const search = String(searchParams.get('search') || '').trim();
    const limit = Math.min(Number(searchParams.get('limit') || 300), 500);

    let contributionQuery = adminSupabase
      .from('fund_space_contributions')
      .select(
        'id, fund_space_id, round_id, user_id, amount_due, amount_paid, confirmed_by, paid_at, payment_method, payment_reference, status, created_at, updated_at'
      )
      .order('created_at', { ascending: false })
      .limit(limit);

    if (statusFilter !== 'ALL') {
      contributionQuery = contributionQuery.eq('status', statusFilter);
    }

    const { data: contributionRows, error: contributionError } =
      await contributionQuery;

    if (contributionError) {
      return NextResponse.json(
        {
          success: false,
          message:
            contributionError.message || 'Could not load contribution records.',
        },
        { status: 500 }
      );
    }

    const contributions = (contributionRows || []) as ContributionRow[];

    const contributionIds = contributions.map((item) => item.id);
    const customerIds = [...new Set(contributions.map((item) => item.user_id))];
    const fundSpaceIds = [
      ...new Set(contributions.map((item) => item.fund_space_id)),
    ];
    const roundIds = [...new Set(contributions.map((item) => item.round_id))];

    const [
      customersResult,
      fundSpacesResult,
      roundsResult,
      manualSubmissionsResult,
      agentCustomersResult,
    ] = await Promise.all([
      customerIds.length
        ? adminSupabase
            .from('profiles')
            .select(
              'id, full_name, phone, location, city, region, role, verification_status, status, registered_by_agent'
            )
            .in('id', customerIds)
        : Promise.resolve({ data: [], error: null }),

      fundSpaceIds.length
        ? adminSupabase
            .from('fund_spaces')
            .select(
              'id, name, contribution_amount, status, member_limit, current_round_number'
            )
            .in('id', fundSpaceIds)
        : Promise.resolve({ data: [], error: null }),

      roundIds.length
        ? adminSupabase
            .from('fund_space_rounds')
            .select(
              'id, fund_space_id, round_number, recipient_user_id, contribution_amount, expected_total_amount, contribution_deadline, week_start_date, week_end_date, status'
            )
            .in('id', roundIds)
        : Promise.resolve({ data: [], error: null }),

      contributionIds.length
        ? adminSupabase
            .from('manual_payment_submissions')
            .select(
              'id, contribution_id, fund_space_id, round_id, user_id, agent_id, status, transaction_reference, total_amount_paid, amount_due, service_fee, payer_type, payer_relationship, sender_name, sender_phone, sender_network, payment_note, rejection_reason, created_at, reviewed_at'
            )
            .in('contribution_id', contributionIds)
            .order('created_at', { ascending: false })
        : Promise.resolve({ data: [], error: null }),

      customerIds.length
        ? adminSupabase
            .from('agent_customers')
            .select(
              'id, agent_id, customer_id, relationship_status, created_at, updated_at'
            )
            .in('customer_id', customerIds)
            .order('created_at', { ascending: false })
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (customersResult.error) {
      return NextResponse.json(
        {
          success: false,
          message: customersResult.error.message,
        },
        { status: 500 }
      );
    }

    if (fundSpacesResult.error) {
      return NextResponse.json(
        {
          success: false,
          message: fundSpacesResult.error.message,
        },
        { status: 500 }
      );
    }

    if (roundsResult.error) {
      return NextResponse.json(
        {
          success: false,
          message: roundsResult.error.message,
        },
        { status: 500 }
      );
    }

    if (manualSubmissionsResult.error) {
      return NextResponse.json(
        {
          success: false,
          message: manualSubmissionsResult.error.message,
        },
        { status: 500 }
      );
    }

    if (agentCustomersResult.error) {
      return NextResponse.json(
        {
          success: false,
          message: agentCustomersResult.error.message,
        },
        { status: 500 }
      );
    }

    const customers = (customersResult.data || []) as ProfileRow[];
    const fundSpaces = (fundSpacesResult.data || []) as FundSpaceRow[];
    const rounds = (roundsResult.data || []) as RoundRow[];
    const manualSubmissions =
      (manualSubmissionsResult.data || []) as ManualPaymentSubmissionRow[];
    const agentCustomerRows =
      (agentCustomersResult.data || []) as AgentCustomerRow[];

    const customerById = new Map(customers.map((item) => [item.id, item]));
    const fundSpaceById = new Map(fundSpaces.map((item) => [item.id, item]));
    const roundById = new Map(rounds.map((item) => [item.id, item]));

    const manualSubmissionsByContributionId = new Map<
      string,
      ManualPaymentSubmissionRow[]
    >();

    for (const submission of manualSubmissions) {
      const existing =
        manualSubmissionsByContributionId.get(submission.contribution_id) || [];

      existing.push(submission);
      manualSubmissionsByContributionId.set(
        submission.contribution_id,
        existing
      );
    }

    const agentCustomerByCustomerId = new Map<string, AgentCustomerRow>();

    for (const relationship of agentCustomerRows) {
      const existing = agentCustomerByCustomerId.get(relationship.customer_id);

      if (!existing) {
        agentCustomerByCustomerId.set(relationship.customer_id, relationship);
        continue;
      }

      const currentIsActive =
        normalizeStatus(existing.relationship_status) === 'ACTIVE';
      const nextIsActive =
        normalizeStatus(relationship.relationship_status) === 'ACTIVE';

      if (!currentIsActive && nextIsActive) {
        agentCustomerByCustomerId.set(relationship.customer_id, relationship);
      }
    }

    const agentIdsFromSubmissions = manualSubmissions
      .map((item) => item.agent_id)
      .filter(Boolean) as string[];

    const agentIdsFromAgentCustomers = agentCustomerRows
      .map((item) => item.agent_id)
      .filter(Boolean);

    const agentIdsFromRegisteredByAgent = customers
      .map((item) => item.registered_by_agent)
      .filter(Boolean) as string[];

    const agentIds = [
      ...new Set([
        ...agentIdsFromSubmissions,
        ...agentIdsFromAgentCustomers,
        ...agentIdsFromRegisteredByAgent,
      ]),
    ];

    const { data: agentRows, error: agentsError } = agentIds.length
      ? await adminSupabase
          .from('profiles')
          .select(
            'id, full_name, phone, location, city, region, role, verification_status, status, registered_by_agent'
          )
          .in('id', agentIds)
      : { data: [], error: null };

    if (agentsError) {
      return NextResponse.json(
        {
          success: false,
          message: agentsError.message,
        },
        { status: 500 }
      );
    }

    const agents = (agentRows || []) as ProfileRow[];
    const agentById = new Map(agents.map((item) => [item.id, item]));

    const mappedContributions = contributions
      .map((contribution) => {
        const customer = customerById.get(contribution.user_id) || null;
        const fundSpace = fundSpaceById.get(contribution.fund_space_id) || null;
        const round = roundById.get(contribution.round_id) || null;

        const manualSubmission = pickLatestManualSubmission(
          manualSubmissionsByContributionId.get(contribution.id) || []
        );

        const agentCustomerRelationship = agentCustomerByCustomerId.get(
          contribution.user_id
        );

        const agentId =
          manualSubmission?.agent_id ||
          agentCustomerRelationship?.agent_id ||
          customer?.registered_by_agent ||
          null;

        const agent = agentId ? agentById.get(agentId) || null : null;

        return {
          ...contribution,
          customer,
          agent,
          fund_space: fundSpace,
          round,
          manual_submission: manualSubmission,
        };
      })
      .filter((item) => {
        const manualStatus = normalizeStatus(item.manual_submission?.status);
        const contributionStatus = normalizeStatus(item.status);

        if (verificationFilter === 'PENDING_REVIEW') {
          return manualStatus === 'PENDING_REVIEW';
        }

        if (verificationFilter === 'REJECTED') {
          return manualStatus === 'REJECTED';
        }

        if (verificationFilter === 'APPROVED') {
          return (
            contributionStatus === 'PAID' &&
            Boolean(item.payment_reference || item.paid_at)
          );
        }

        return true;
      })
      .filter((item) =>
        matchesSearch({
          search,
          contribution: item,
          customer: item.customer,
          agent: item.agent,
          fundSpace: item.fund_space,
          round: item.round,
          manualSubmission: item.manual_submission,
        })
      );

    const totalAmountDue = mappedContributions.reduce(
      (sum, item) => sum + Number(item.amount_due || 0),
      0
    );

    const totalAmountPaid = mappedContributions.reduce(
      (sum, item) => sum + Number(item.amount_paid || 0),
      0
    );

    const pendingReviewCount = mappedContributions.filter(
      (item) =>
        normalizeStatus(item.manual_submission?.status) === 'PENDING_REVIEW'
    ).length;

    const rejectedCount = mappedContributions.filter(
      (item) => normalizeStatus(item.manual_submission?.status) === 'REJECTED'
    ).length;

    const summary = {
      total_contributions: mappedContributions.length,
      pending_contributions: mappedContributions.filter((item) =>
        ['PENDING', 'OVERDUE', 'PARTIALLY_PAID'].includes(
          normalizeStatus(item.status)
        )
      ).length,
      paid_contributions: mappedContributions.filter(
        (item) => normalizeStatus(item.status) === 'PAID'
      ).length,
      failed_contributions: mappedContributions.filter((item) =>
        ['FAILED', 'REJECTED', 'DEFAULTED', 'CANCELLED'].includes(
          normalizeStatus(item.status)
        )
      ).length,
      pending_review_submissions: pendingReviewCount,
      rejected_submissions: rejectedCount,
      total_amount_due: totalAmountDue,
      total_amount_paid: totalAmountPaid,
    };

    return NextResponse.json({
      success: true,
      summary,
      contributions: mappedContributions,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : 'Something went wrong while loading admin contribution records.',
      },
      { status: 500 }
    );
  }
}