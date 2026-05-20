import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

import type { Database } from '@/lib/database.types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type SupabaseServiceClient = ReturnType<typeof createServiceClient>;

type CustomerLite = {
  id: string;
  full_name: string;
  phone: string | null;
  location: string | null;
  city: string | null;
  region: string | null;
  verification_status: string;
  status: string;
};

type FundSpaceLite = {
  id: string;
  name: string;
  contribution_amount: number;
  status: string;
  member_limit: number;
  current_round_number: number;
};

type RoundLite = {
  id: string;
  round_number: number;
  recipient_user_id: string;
  contribution_amount: number;
  expected_total_amount: number;
  contribution_deadline: string;
  week_start_date: string;
  week_end_date: string;
  status: string;
};

type ContributionRecord = {
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
  customer: CustomerLite | CustomerLite[] | null;
  fund_space: FundSpaceLite | FundSpaceLite[] | null;
  round: RoundLite | RoundLite[] | null;
};

type NormalizedContribution = Omit<
  ContributionRecord,
  'customer' | 'fund_space' | 'round'
> & {
  customer: CustomerLite | null;
  fund_space: FundSpaceLite | null;
  round: RoundLite | null;
};

function createServiceClient() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL is not configured.'
    );
  }

  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured.');
  }

  return createClient<Database>(supabaseUrl, serviceRoleKey, {
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
  return value?.trim() || '';
}

function normalizeRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] || null;
  return value;
}

function isPendingLikeStatus(status: string | null | undefined) {
  return ['PENDING', 'OVERDUE', 'PARTIALLY_PAID'].includes(
    String(status || '').toUpperCase()
  );
}

function isFailedLikeStatus(status: string | null | undefined) {
  return ['FAILED', 'CANCELLED', 'REJECTED', 'DEFAULTED'].includes(
    String(status || '').toUpperCase()
  );
}

function normalizeContribution(
  contribution: ContributionRecord
): NormalizedContribution {
  return {
    id: contribution.id,
    fund_space_id: contribution.fund_space_id,
    round_id: contribution.round_id,
    user_id: contribution.user_id,
    amount_due: Number(contribution.amount_due || 0),
    amount_paid: Number(contribution.amount_paid || 0),
    confirmed_by: contribution.confirmed_by,
    paid_at: contribution.paid_at,
    payment_method: contribution.payment_method,
    payment_reference: contribution.payment_reference,
    status: contribution.status,
    created_at: contribution.created_at,
    updated_at: contribution.updated_at,
    customer: normalizeRelation(contribution.customer),
    fund_space: normalizeRelation(contribution.fund_space),
    round: normalizeRelation(contribution.round),
  };
}

function matchesSearch(contribution: NormalizedContribution, search: string) {
  const normalizedSearch = search.trim().toLowerCase();

  if (!normalizedSearch) return true;

  const customer = contribution.customer;
  const fundSpace = contribution.fund_space;
  const round = contribution.round;

  const searchableValues = [
    customer?.full_name,
    customer?.phone,
    customer?.location,
    customer?.city,
    customer?.region,
    customer?.verification_status,
    customer?.status,
    fundSpace?.name,
    fundSpace?.status,
    round?.round_number ? String(round.round_number) : null,
    round?.status,
    contribution.status,
    contribution.payment_reference,
  ];

  return searchableValues.some((value) =>
    String(value || '').toLowerCase().includes(normalizedSearch)
  );
}

function buildSummary(contributions: NormalizedContribution[]) {
  return contributions.reduce(
    (summary, contribution) => {
      const status = String(contribution.status || '').toUpperCase();

      summary.total_contributions += 1;
      summary.total_amount_due += Number(contribution.amount_due || 0);
      summary.total_amount_paid += Number(contribution.amount_paid || 0);

      if (status === 'PAID') {
        summary.paid_contributions += 1;
      } else if (isPendingLikeStatus(status)) {
        summary.pending_contributions += 1;
      } else if (isFailedLikeStatus(status)) {
        summary.failed_contributions += 1;
      }

      return summary;
    },
    {
      total_contributions: 0,
      pending_contributions: 0,
      paid_contributions: 0,
      failed_contributions: 0,
      total_amount_due: 0,
      total_amount_paid: 0,
    }
  );
}

async function getAuthenticatedUser({
  supabase,
  accessToken,
}: {
  supabase: SupabaseServiceClient;
  accessToken: string;
}) {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(accessToken);

  if (error || !user) {
    return null;
  }

  return user;
}

export async function GET(request: NextRequest) {
  try {
    const authorizationHeader = request.headers.get('authorization');

    if (!authorizationHeader?.startsWith('Bearer ')) {
      return errorResponse('Unauthorized request. Please log in again.', 401);
    }

    const accessToken = authorizationHeader.replace('Bearer ', '').trim();

    if (!accessToken) {
      return errorResponse('Missing access token. Please log in again.', 401);
    }

    const statusFilter = normalizeText(
      request.nextUrl.searchParams.get('status')
    ).toUpperCase();

    const searchTerm = normalizeText(request.nextUrl.searchParams.get('search'));

    const supabase = createServiceClient();

    const user = await getAuthenticatedUser({
      supabase,
      accessToken,
    });

    if (!user) {
      return errorResponse('Your session has expired. Please log in again.', 401);
    }

    const { data: agentProfile, error: agentProfileError } = await supabase
      .from('profiles')
      .select('id, full_name, role, status, verification_status')
      .eq('id', user.id)
      .maybeSingle();

    if (agentProfileError) {
      console.error('Agent profile lookup error:', agentProfileError);
      return errorResponse('Unable to verify agent profile.', 500);
    }

    if (!agentProfile) {
      return errorResponse('Agent profile could not be found.', 404);
    }

    if (agentProfile.role !== 'AGENT') {
      return errorResponse(
        'Only agents can view customer contribution records.',
        403
      );
    }

    if (agentProfile.status !== 'ACTIVE') {
      return errorResponse('Your agent account is not active.', 403);
    }

    if (agentProfile.verification_status !== 'VERIFIED') {
      return errorResponse(
        'Your agent account must be verified before viewing contribution records.',
        403
      );
    }

    const { data: assignedCustomers, error: assignedCustomersError } =
      await supabase
        .from('agent_customers')
        .select('customer_id, relationship_status')
        .eq('agent_id', user.id)
        .eq('relationship_status', 'ACTIVE');

    if (assignedCustomersError) {
      console.error('Assigned customer lookup error:', assignedCustomersError);

      return errorResponse(
        'Unable to load your assigned customers. Please try again.',
        500
      );
    }

    const customerIds = Array.from(
      new Set((assignedCustomers || []).map((item) => item.customer_id))
    ).filter(Boolean);

    if (customerIds.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No active assigned customers found.',
        summary: buildSummary([]),
        contributions: [],
      });
    }

    let query = supabase
      .from('fund_space_contributions')
      .select(
        `
        id,
        fund_space_id,
        round_id,
        user_id,
        amount_due,
        amount_paid,
        confirmed_by,
        paid_at,
        payment_method,
        payment_reference,
        status,
        created_at,
        updated_at,
        customer:profiles!fund_space_contributions_user_id_fkey (
          id,
          full_name,
          phone,
          location,
          city,
          region,
          verification_status,
          status
        ),
        fund_space:fund_spaces!fund_space_contributions_fund_space_id_fkey (
          id,
          name,
          contribution_amount,
          status,
          member_limit,
          current_round_number
        ),
        round:fund_space_rounds!fund_space_contributions_round_id_fkey (
          id,
          round_number,
          recipient_user_id,
          contribution_amount,
          expected_total_amount,
          contribution_deadline,
          week_start_date,
          week_end_date,
          status
        )
      `
      )
      .in('user_id', customerIds);

    if (statusFilter === 'PENDING') {
      query = query.in('status', ['PENDING', 'OVERDUE', 'PARTIALLY_PAID']);
    } else if (statusFilter === 'PAID') {
      query = query.eq('status', 'PAID');
    } else if (statusFilter === 'FAILED') {
      query = query.in('status', [
        'FAILED',
        'CANCELLED',
        'REJECTED',
        'DEFAULTED',
      ]);
    }

    const { data: rawContributions, error: contributionsError } = await query
      .order('created_at', { ascending: false })
      .limit(500);

    if (contributionsError) {
      console.error('Agent contribution records lookup error:', contributionsError);

      return errorResponse(
        'Unable to load customer weekly contribution records.',
        500
      );
    }

    const contributions = ((rawContributions || []) as unknown as ContributionRecord[])
      .map(normalizeContribution)
      .filter((contribution) => matchesSearch(contribution, searchTerm));

    return NextResponse.json({
      success: true,
      message: 'Customer weekly contribution records loaded successfully.',
      summary: buildSummary(contributions),
      contributions,
    });
  } catch (error) {
    console.error('Agent contribution records route error:', error);

    const message =
      error instanceof Error
        ? error.message
        : 'Something went wrong while loading contribution records.';

    return NextResponse.json(
      {
        success: false,
        message,
      },
      { status: 500 }
    );
  }
}