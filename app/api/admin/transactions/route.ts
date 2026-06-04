import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

type TransactionSource =
  | 'ALL'
  | 'MANUAL_PAYMENT'
  | 'SYSTEM_TRANSACTION'
  | 'PROVIDER_TRANSACTION';

type StatusGroup = 'ALL' | 'SUCCESSFUL' | 'PENDING' | 'FAILED' | 'OTHER';

type ProfileRow = {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  role: string | null;
  status: string | null;
};

type FundSpaceRow = {
  id: string;
  name: string | null;
  contribution_amount: number | null;
  current_round_number: number | null;
  member_limit: number | null;
  status: string | null;
};

type ManualPaymentSubmissionRow = {
  id: string;
  agent_id: string | null;
  amount_due: number | null;
  company_payment_account_id: string | null;
  contribution_id: string;
  created_at: string | null;
  fund_space_id: string;
  payer_relationship: string | null;
  payer_type: string | null;
  payment_note: string | null;
  rejection_reason: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  round_id: string | null;
  sender_name: string | null;
  sender_network: string | null;
  sender_phone: string | null;
  service_fee: number | null;
  status: string;
  submitted_by: string | null;
  submitted_by_role: string | null;
  total_amount_paid: number | null;
  transaction_reference: string;
  user_id: string;
};

type TransactionRow = {
  id: string;
  amount: number;
  channel: string | null;
  contribution_id: string | null;
  created_at: string | null;
  created_by: string | null;
  currency: string | null;
  direction: string | null;
  fund_space_id: string | null;
  fund_space_round_id: string | null;
  metadata: unknown | null;
  note: string | null;
  payment_reference: string | null;
  payout_id: string | null;
  status: string;
  type: string;
  user_id: string;
  wallet_id: string | null;
  withdrawal_request_id: string | null;
};

type PaymentTransactionRow = {
  id: string;
  agent_id: string | null;
  amount: number;
  channel: string | null;
  contribution_id: string | null;
  created_at: string | null;
  currency: string | null;
  customer_id: string | null;
  direction: string | null;
  failure_reason: string | null;
  fee_amount: number | null;
  fund_space_id: string | null;
  fund_space_round_id: string | null;
  initiated_by: string | null;
  internal_reference: string;
  mobile_network: string | null;
  payer_name: string | null;
  payer_phone: string | null;
  payment_type: string;
  provider: string;
  provider_reference: string | null;
  provider_status: string | null;
  status: string;
  user_id: string;
};

type AdminTransactionRecord = {
  id: string;
  source: 'MANUAL_PAYMENT' | 'SYSTEM_TRANSACTION' | 'PROVIDER_TRANSACTION';
  status_group: Exclude<StatusGroup, 'ALL'>;
  title: string;
  description: string;
  amount: number;
  service_fee: number | null;
  currency: string;
  status: string;
  direction: string;
  channel: string;
  reference: string;
  secondary_reference: string | null;
  customer_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  agent_id: string | null;
  agent_name: string | null;
  fund_space_id: string | null;
  fund_space_name: string | null;
  contribution_id: string | null;
  created_at: string | null;
  action_href: string;
  action_label: string;
  rejection_reason: string | null;

  /**
   * Internal matching IDs used by this API to support:
   * /admin/transactions?user=USER_ID
   */
  related_user_ids: string[];
};

type TransactionStats = {
  total_records: number;
  manual_payment_records: number;
  momo_awaiting_review: number;
  momo_rejected: number;
  momo_approved: number;
  system_transactions: number;
  provider_attempts: number;
  successful_system_value: number;
  pending_value: number;
  rejected_value: number;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL');
}

if (!serviceRoleKey) {
  throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
}

/**
 * This route intentionally uses an untyped service-role client because some
 * generated database types may not yet include the latest manual payment fields.
 */
const adminSupabase = createClient(supabaseUrl, serviceRoleKey, {
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

function isAdminRole(role?: string | null) {
  const value = String(role || '').toUpperCase();

  return value === 'ADMIN' || value === 'SUPER_ADMIN';
}

function normalizeSource(value: string | null): TransactionSource {
  const source = String(value || 'ALL').toUpperCase();

  const allowed: TransactionSource[] = [
    'ALL',
    'MANUAL_PAYMENT',
    'SYSTEM_TRANSACTION',
    'PROVIDER_TRANSACTION',
  ];

  return allowed.includes(source as TransactionSource)
    ? (source as TransactionSource)
    : 'ALL';
}

function normalizeStatusGroup(value: string | null): StatusGroup {
  const status = String(value || 'ALL').toUpperCase();

  const allowed: StatusGroup[] = [
    'ALL',
    'SUCCESSFUL',
    'PENDING',
    'FAILED',
    'OTHER',
  ];

  return allowed.includes(status as StatusGroup)
    ? (status as StatusGroup)
    : 'ALL';
}

function getStatusGroup(
  status: string | null | undefined
): Exclude<StatusGroup, 'ALL'> {
  const value = String(status || 'PENDING').toUpperCase();

  if (
    [
      'SUCCESS',
      'SUCCESSFUL',
      'COMPLETED',
      'PAID',
      'APPROVED',
      'CONFIRMED',
    ].includes(value)
  ) {
    return 'SUCCESSFUL';
  }

  if (
    [
      'PENDING',
      'PROCESSING',
      'PENDING_REVIEW',
      'PENDING_ADMIN_APPROVAL',
      'READY_FOR_ADMIN_APPROVAL',
      'READY_FOR_PAYOUT',
    ].includes(value)
  ) {
    return 'PENDING';
  }

  if (
    [
      'FAILED',
      'REJECTED',
      'CANCELLED',
      'ABANDONED',
      'REVERSED',
      'DEFAULTED',
    ].includes(value)
  ) {
    return 'FAILED';
  }

  return 'OTHER';
}

function normalizeNumber(value: string | null, fallback: number) {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue) || numberValue <= 0) {
    return fallback;
  }

  return Math.floor(numberValue);
}

function normalizeUuid(value: string | null) {
  const clean = String(value || '').trim();

  if (!clean) return '';

  return clean;
}

function uniqueIds(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      values
        .map((value) => String(value || '').trim())
        .filter(Boolean)
    )
  );
}

async function getAdminProfile(request: NextRequest) {
  const token = getBearerToken(request);

  if (!token) {
    return {
      profile: null,
      error: NextResponse.json(
        {
          success: false,
          message: 'Unauthorized request. Please log in again.',
        },
        { status: 401 }
      ),
    };
  }

  const {
    data: { user },
    error: userError,
  } = await adminSupabase.auth.getUser(token);

  if (userError || !user) {
    return {
      profile: null,
      error: NextResponse.json(
        {
          success: false,
          message: 'Your session has expired. Please log in again.',
        },
        { status: 401 }
      ),
    };
  }

  const { data: profile, error: profileError } = await adminSupabase
    .from('profiles')
    .select('id, full_name, phone, email, role, status')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError || !profile || !isAdminRole(profile.role)) {
    return {
      profile: null,
      error: NextResponse.json(
        {
          success: false,
          message: 'Only admins and super admins can view transaction records.',
        },
        { status: 403 }
      ),
    };
  }

  return {
    profile: profile as ProfileRow,
    error: null,
  };
}

function itemMatchesSearch(item: AdminTransactionRecord, search: string) {
  if (!search.trim()) return true;

  const value = search.trim().toLowerCase();

  const haystack = [
    item.id,
    item.title,
    item.description,
    item.status,
    item.status_group,
    item.source,
    item.direction,
    item.channel,
    item.reference,
    item.secondary_reference,
    item.customer_name,
    item.customer_phone,
    item.agent_name,
    item.fund_space_name,
    item.contribution_id,
    item.rejection_reason,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return haystack.includes(value);
}

function itemMatchesSelectedUser(item: AdminTransactionRecord, selectedUserId: string) {
  if (!selectedUserId) return true;

  return item.related_user_ids.includes(selectedUserId);
}

function buildManualRecord({
  submission,
  customer,
  agent,
  fundSpace,
}: {
  submission: ManualPaymentSubmissionRow;
  customer: ProfileRow | null;
  agent: ProfileRow | null;
  fundSpace: FundSpaceRow | null;
}): AdminTransactionRecord {
  const customerName = customer?.full_name || submission.sender_name || 'Unknown customer';
  const fundSpaceName = fundSpace?.name || 'Unknown Fund Space';
  const agentId = submission.agent_id || submission.submitted_by || null;

  return {
    id: `manual-${submission.id}`,
    source: 'MANUAL_PAYMENT',
    status_group: getStatusGroup(submission.status),
    title: 'Manual MoMo Payment Submission',
    description:
      submission.status === 'PENDING_REVIEW'
        ? `${customerName} submitted a MoMo reference for admin verification.`
        : submission.status === 'REJECTED'
          ? `${customerName}'s manual MoMo payment was rejected.`
          : `${customerName}'s manual MoMo payment record.`,
    amount: Number(submission.total_amount_paid || 0),
    service_fee: Number(submission.service_fee || 0),
    currency: 'GHS',
    status: submission.status,
    direction: 'INCOMING',
    channel: submission.sender_network || 'MOMO',
    reference: submission.transaction_reference,
    secondary_reference: submission.payer_type || null,
    customer_id: submission.user_id,
    customer_name: customerName,
    customer_phone: customer?.phone || submission.sender_phone || null,
    agent_id: agentId,
    agent_name: agent?.full_name || null,
    fund_space_id: submission.fund_space_id,
    fund_space_name: fundSpaceName,
    contribution_id: submission.contribution_id,
    created_at: submission.created_at,
    action_href: `/admin/manual-payment-submissions?submission_id=${encodeURIComponent(
      submission.id
    )}`,
    action_label:
      submission.status === 'PENDING_REVIEW'
        ? 'Review MoMo Payment'
        : 'View MoMo Record',
    rejection_reason: submission.rejection_reason,
    related_user_ids: uniqueIds([
      submission.user_id,
      submission.agent_id,
      submission.submitted_by,
      submission.reviewed_by,
    ]),
  };
}

function buildSystemRecord({
  transaction,
  customer,
  createdByProfile,
  fundSpace,
}: {
  transaction: TransactionRow;
  customer: ProfileRow | null;
  createdByProfile: ProfileRow | null;
  fundSpace: FundSpaceRow | null;
}): AdminTransactionRecord {
  return {
    id: `system-${transaction.id}`,
    source: 'SYSTEM_TRANSACTION',
    status_group: getStatusGroup(transaction.status),
    title: 'Confirmed TrustPoint Transaction',
    description:
      transaction.note ||
      'Confirmed TrustPoint system transaction after payment processing.',
    amount: Number(transaction.amount || 0),
    service_fee: null,
    currency: transaction.currency || 'GHS',
    status: transaction.status,
    direction: transaction.direction || 'NEUTRAL',
    channel: transaction.channel || 'SYSTEM',
    reference: transaction.payment_reference || transaction.id.slice(0, 8),
    secondary_reference: transaction.type,
    customer_id: transaction.user_id,
    customer_name: customer?.full_name || null,
    customer_phone: customer?.phone || null,
    agent_id: transaction.created_by,
    agent_name: createdByProfile?.full_name || null,
    fund_space_id: transaction.fund_space_id,
    fund_space_name: fundSpace?.name || null,
    contribution_id: transaction.contribution_id,
    created_at: transaction.created_at,
    action_href: transaction.contribution_id
      ? `/admin/fund-space/contributions?search=${encodeURIComponent(
          transaction.payment_reference || transaction.contribution_id
        )}`
      : '/admin/transactions',
    action_label: 'View Related Record',
    rejection_reason: null,
    related_user_ids: uniqueIds([
      transaction.user_id,
      transaction.created_by,
    ]),
  };
}

function buildProviderRecord({
  payment,
  customer,
  agent,
  fundSpace,
}: {
  payment: PaymentTransactionRow;
  customer: ProfileRow | null;
  agent: ProfileRow | null;
  fundSpace: FundSpaceRow | null;
}): AdminTransactionRecord {
  const agentId = payment.agent_id || payment.initiated_by || null;
  const customerId = payment.customer_id || payment.user_id || null;

  return {
    id: `provider-${payment.id}`,
    source: 'PROVIDER_TRANSACTION',
    status_group: getStatusGroup(payment.status),
    title: 'Payment Provider Attempt',
    description:
      payment.failure_reason ||
      `${payment.provider || 'Provider'} payment attempt for ${payment.payment_type}.`,
    amount: Number(payment.amount || 0),
    service_fee: Number(payment.fee_amount || 0),
    currency: payment.currency || 'GHS',
    status: payment.status,
    direction: payment.direction || 'NEUTRAL',
    channel: payment.channel || payment.mobile_network || 'PROVIDER',
    reference: payment.provider_reference || payment.internal_reference,
    secondary_reference: payment.internal_reference,
    customer_id: customerId,
    customer_name: payment.payer_name || customer?.full_name || null,
    customer_phone: payment.payer_phone || customer?.phone || null,
    agent_id: agentId,
    agent_name: agent?.full_name || null,
    fund_space_id: payment.fund_space_id,
    fund_space_name: fundSpace?.name || null,
    contribution_id: payment.contribution_id,
    created_at: payment.created_at,
    action_href: payment.contribution_id
      ? `/admin/fund-space/contributions?search=${encodeURIComponent(
          payment.provider_reference || payment.internal_reference
        )}`
      : '/admin/transactions',
    action_label: 'View Provider Record',
    rejection_reason: payment.failure_reason,
    related_user_ids: uniqueIds([
      payment.user_id,
      payment.customer_id,
      payment.agent_id,
      payment.initiated_by,
    ]),
  };
}

function calculateStats(records: AdminTransactionRecord[]): TransactionStats {
  const manual = records.filter((item) => item.source === 'MANUAL_PAYMENT');
  const system = records.filter((item) => item.source === 'SYSTEM_TRANSACTION');
  const provider = records.filter(
    (item) => item.source === 'PROVIDER_TRANSACTION'
  );

  return {
    total_records: records.length,
    manual_payment_records: manual.length,
    momo_awaiting_review: manual.filter(
      (item) => String(item.status).toUpperCase() === 'PENDING_REVIEW'
    ).length,
    momo_rejected: manual.filter(
      (item) => String(item.status).toUpperCase() === 'REJECTED'
    ).length,
    momo_approved: manual.filter((item) =>
      ['APPROVED', 'CONFIRMED', 'PAID'].includes(String(item.status).toUpperCase())
    ).length,
    system_transactions: system.length,
    provider_attempts: provider.length,
    successful_system_value: system
      .filter((item) => item.status_group === 'SUCCESSFUL')
      .reduce((sum, item) => sum + Number(item.amount || 0), 0),
    pending_value: records
      .filter((item) => item.status_group === 'PENDING')
      .reduce((sum, item) => sum + Number(item.amount || 0), 0),
    rejected_value: records
      .filter((item) => item.status_group === 'FAILED')
      .reduce((sum, item) => sum + Number(item.amount || 0), 0),
  };
}

export async function GET(request: NextRequest) {
  try {
    const { profile, error } = await getAdminProfile(request);

    if (error || !profile) {
      return error;
    }

    const { searchParams } = new URL(request.url);

    const source = normalizeSource(searchParams.get('source'));
    const statusGroup = normalizeStatusGroup(searchParams.get('statusGroup'));
    const search = String(searchParams.get('search') || '').trim();
    const selectedUserId = normalizeUuid(searchParams.get('user'));
    const limit = Math.min(normalizeNumber(searchParams.get('limit'), 400), 800);

    const [manualResult, transactionsResult, providerResult] =
      await Promise.all([
        adminSupabase
          .from('manual_payment_submissions')
          .select(
            'id, agent_id, amount_due, company_payment_account_id, contribution_id, created_at, fund_space_id, payer_relationship, payer_type, payment_note, rejection_reason, reviewed_at, reviewed_by, round_id, sender_name, sender_network, sender_phone, service_fee, status, submitted_by, submitted_by_role, total_amount_paid, transaction_reference, user_id'
          )
          .order('created_at', { ascending: false })
          .limit(limit),

        adminSupabase
          .from('transactions')
          .select(
            'id, amount, channel, contribution_id, created_at, created_by, currency, direction, fund_space_id, fund_space_round_id, metadata, note, payment_reference, payout_id, status, type, user_id, wallet_id, withdrawal_request_id'
          )
          .order('created_at', { ascending: false })
          .limit(limit),

        adminSupabase
          .from('payment_transactions')
          .select(
            'id, agent_id, amount, channel, contribution_id, created_at, currency, customer_id, direction, failure_reason, fee_amount, fund_space_id, fund_space_round_id, initiated_by, internal_reference, mobile_network, payer_name, payer_phone, payment_type, provider, provider_reference, provider_status, status, user_id'
          )
          .order('created_at', { ascending: false })
          .limit(limit),
      ]);

    if (manualResult.error) {
      return NextResponse.json(
        {
          success: false,
          message:
            manualResult.error.message || 'Could not load manual payment records.',
        },
        { status: 500 }
      );
    }

    if (transactionsResult.error) {
      return NextResponse.json(
        {
          success: false,
          message:
            transactionsResult.error.message ||
            'Could not load system transaction records.',
        },
        { status: 500 }
      );
    }

    if (providerResult.error) {
      return NextResponse.json(
        {
          success: false,
          message:
            providerResult.error.message ||
            'Could not load payment provider records.',
        },
        { status: 500 }
      );
    }

    const manualPayments =
      (manualResult.data || []) as ManualPaymentSubmissionRow[];
    const transactions = (transactionsResult.data || []) as TransactionRow[];
    const providerPayments =
      (providerResult.data || []) as PaymentTransactionRow[];

    const profileIds = uniqueIds([
      ...manualPayments.map((item) => item.user_id),
      ...manualPayments.map((item) => item.agent_id),
      ...manualPayments.map((item) => item.submitted_by),
      ...manualPayments.map((item) => item.reviewed_by),

      ...transactions.map((item) => item.user_id),
      ...transactions.map((item) => item.created_by),

      ...providerPayments.map((item) => item.customer_id),
      ...providerPayments.map((item) => item.user_id),
      ...providerPayments.map((item) => item.agent_id),
      ...providerPayments.map((item) => item.initiated_by),
    ]);

    const fundSpaceIds = uniqueIds([
      ...manualPayments.map((item) => item.fund_space_id),
      ...transactions.map((item) => item.fund_space_id),
      ...providerPayments.map((item) => item.fund_space_id),
    ]);

    const [profilesResult, fundSpacesResult] = await Promise.all([
      profileIds.length
        ? adminSupabase
            .from('profiles')
            .select('id, full_name, phone, email, role, status')
            .in('id', profileIds)
        : Promise.resolve({ data: [], error: null }),

      fundSpaceIds.length
        ? adminSupabase
            .from('fund_spaces')
            .select(
              'id, name, contribution_amount, current_round_number, member_limit, status'
            )
            .in('id', fundSpaceIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (profilesResult.error) {
      return NextResponse.json(
        {
          success: false,
          message: profilesResult.error.message,
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

    const profiles = (profilesResult.data || []) as ProfileRow[];
    const fundSpaces = (fundSpacesResult.data || []) as FundSpaceRow[];

    const profileById = new Map(profiles.map((item) => [item.id, item]));
    const fundSpaceById = new Map(fundSpaces.map((item) => [item.id, item]));

    const manualRecords = manualPayments.map((submission) =>
      buildManualRecord({
        submission,
        customer: profileById.get(submission.user_id) || null,
        agent:
          profileById.get(submission.agent_id || '') ||
          profileById.get(submission.submitted_by || '') ||
          null,
        fundSpace: fundSpaceById.get(submission.fund_space_id) || null,
      })
    );

    const systemRecords = transactions.map((transaction) =>
      buildSystemRecord({
        transaction,
        customer: profileById.get(transaction.user_id) || null,
        createdByProfile: transaction.created_by
          ? profileById.get(transaction.created_by) || null
          : null,
        fundSpace: transaction.fund_space_id
          ? fundSpaceById.get(transaction.fund_space_id) || null
          : null,
      })
    );

    const providerRecords = providerPayments.map((payment) =>
      buildProviderRecord({
        payment,
        customer:
          profileById.get(payment.customer_id || '') ||
          profileById.get(payment.user_id || '') ||
          null,
        agent:
          profileById.get(payment.agent_id || '') ||
          profileById.get(payment.initiated_by || '') ||
          null,
        fundSpace: payment.fund_space_id
          ? fundSpaceById.get(payment.fund_space_id) || null
          : null,
      })
    );

    const combinedRecords = [
      ...manualRecords,
      ...systemRecords,
      ...providerRecords,
    ].sort((a, b) => {
      const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;

      return bTime - aTime;
    });

    /**
     * Important fix:
     * If /admin/transactions?user=USER_ID is opened from the users page,
     * the API must scope everything to that selected user first.
     */
    const userScopedRecords = combinedRecords.filter((item) =>
      itemMatchesSelectedUser(item, selectedUserId)
    );

    const stats = calculateStats(userScopedRecords);

    const filteredRecords = userScopedRecords
      .filter((item) => source === 'ALL' || item.source === source)
      .filter(
        (item) => statusGroup === 'ALL' || item.status_group === statusGroup
      )
      .filter((item) => itemMatchesSearch(item, search));

    const safeRecords = filteredRecords.map(({ related_user_ids, ...record }) => record);

    return NextResponse.json({
      success: true,
      selected_user_id: selectedUserId || null,
      stats,
      records: safeRecords,
    });
  } catch (error) {
    console.error('Admin transactions API error:', error);

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : 'Something went wrong while loading admin transaction records.',
      },
      { status: 500 }
    );
  }
}