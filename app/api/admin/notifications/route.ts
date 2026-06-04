import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

type AdminNotificationFilter =
  | 'ALL'
  | 'UNREAD'
  | 'READ'
  | 'MANUAL_PAYMENT'
  | 'AWAITING_REVIEW'
  | 'REJECTED_PAYMENT'
  | 'APPROVED_PAYMENT'
  | 'PAYOUT'
  | 'VERIFICATION'
  | 'FUND_SPACE'
  | 'GENERAL';

type ProfileRow = {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  role: string;
  status: string;
};

type NotificationRow = {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  related_entity_id: string | null;
  related_entity_type: string | null;
  created_at: string | null;
};

type ManualPaymentSubmissionRow = {
  id: string;
  agent_id: string | null;
  amount_due: number;
  company_payment_account_id: string | null;
  contribution_id: string;
  created_at: string;
  fund_space_id: string;
  payer_relationship: string | null;
  payer_type: string;
  payment_note: string | null;
  rejection_reason: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  round_id: string;
  sender_name: string | null;
  sender_network: string | null;
  sender_phone: string | null;
  service_fee: number;
  status: string;
  submitted_by: string | null;
  submitted_by_role: string | null;
  total_amount_paid: number;
  transaction_reference: string;
  user_id: string;
};

type FundSpaceRow = {
  id: string;
  name: string;
  contribution_amount: number;
  current_round_number: number;
  member_limit: number;
  status: string;
};

type ContributionRow = {
  id: string;
  amount_due: number;
  amount_paid: number;
  fund_space_id: string;
  paid_at: string | null;
  payment_method: string | null;
  payment_reference: string | null;
  round_id: string;
  status: string;
  user_id: string;
};

type AdminNotificationItem = {
  id: string;
  source: 'DATABASE' | 'MANUAL_PAYMENT_SYSTEM';
  real_notification_id: string | null;
  title: string;
  message: string;
  type: string;
  category: AdminNotificationFilter;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  is_read: boolean;
  related_entity_id: string | null;
  related_entity_type: string | null;
  created_at: string | null;
  action_label: string;
  action_href: string;
  customer_name?: string | null;
  customer_phone?: string | null;
  agent_name?: string | null;
  fund_space_name?: string | null;
  amount_due?: number | null;
  service_fee?: number | null;
  total_amount_paid?: number | null;
  transaction_reference?: string | null;
  manual_payment_status?: string | null;
  rejection_reason?: string | null;
};

type NotificationStats = {
  all: number;
  unread: number;
  read: number;
  manual_payment: number;
  awaiting_review: number;
  rejected_payment: number;
  approved_payment: number;
  payout: number;
  verification: number;
  fund_space: number;
  general: number;
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
 * Important:
 * Do not pass the generated Database type here yet.
 * Your current project type file appears outdated and does not include
 * manual_payment_submissions in the imported union, even though the table exists.
 */
const adminSupabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

function getBearerToken(request: NextRequest) {
  const authHeader = request.headers.get('authorization') || '';
  const [scheme, token] = authHeader.split(' ');

  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return null;
  }

  return token;
}

function isAdminRole(role?: string | null) {
  return role === 'ADMIN' || role === 'SUPER_ADMIN';
}

function normalizeFilter(value: string | null): AdminNotificationFilter {
  const filter = String(value || 'ALL').toUpperCase();

  const allowed: AdminNotificationFilter[] = [
    'ALL',
    'UNREAD',
    'READ',
    'MANUAL_PAYMENT',
    'AWAITING_REVIEW',
    'REJECTED_PAYMENT',
    'APPROVED_PAYMENT',
    'PAYOUT',
    'VERIFICATION',
    'FUND_SPACE',
    'GENERAL',
  ];

  return allowed.includes(filter as AdminNotificationFilter)
    ? (filter as AdminNotificationFilter)
    : 'ALL';
}

function normalizeStatus(value: string | null | undefined) {
  return String(value || '').toUpperCase();
}

function normalizePositiveNumber(value: string | null, fallback: number) {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue) || numberValue <= 0) {
    return fallback;
  }

  return Math.floor(numberValue);
}

function formatMoney(amount: number | null | undefined) {
  return `GH₵${Number(amount || 0).toLocaleString('en-GH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
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
          message: 'Only admins and super admins can manage admin notifications.',
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

function getDatabaseNotificationCategory(
  notification: NotificationRow
): AdminNotificationFilter {
  const combined = `${notification.type || ''} ${notification.title || ''} ${
    notification.message || ''
  } ${notification.related_entity_type || ''}`.toUpperCase();

  if (
    combined.includes('MANUAL_PAYMENT') ||
    combined.includes('MANUAL PAYMENT') ||
    combined.includes('MOMO') ||
    combined.includes('PAYMENT SUBMISSION')
  ) {
    return 'MANUAL_PAYMENT';
  }

  if (combined.includes('PAYOUT')) {
    return 'PAYOUT';
  }

  if (
    combined.includes('VERIFICATION') ||
    combined.includes('CUSTOMER VERIFICATION') ||
    combined.includes('KYC')
  ) {
    return 'VERIFICATION';
  }

  if (
    combined.includes('FUND_SPACE') ||
    combined.includes('FUND SPACE') ||
    combined.includes('CONTRIBUTION') ||
    combined.includes('ROUND')
  ) {
    return 'FUND_SPACE';
  }

  return 'GENERAL';
}

function getDatabaseAction(notification: NotificationRow) {
  const entityType = String(notification.related_entity_type || '').toUpperCase();
  const type = String(notification.type || '').toUpperCase();
  const title = String(notification.title || '').toUpperCase();
  const combined = `${entityType} ${type} ${title}`;

  if (
    combined.includes('MANUAL_PAYMENT') ||
    combined.includes('MANUAL PAYMENT') ||
    combined.includes('MOMO')
  ) {
    return {
      label: 'Open MoMo Verification',
      href: notification.related_entity_id
        ? `/admin/manual-payment-submissions?submission_id=${encodeURIComponent(
            notification.related_entity_id
          )}`
        : '/admin/manual-payment-submissions',
    };
  }

  if (combined.includes('PAYOUT')) {
    return {
      label: 'Open Payout Approvals',
      href: '/admin/fund-space/payouts',
    };
  }

  if (combined.includes('VERIFICATION')) {
    return {
      label: 'Open Verifications',
      href: '/admin/verifications',
    };
  }

  if (combined.includes('CONTRIBUTION')) {
    return {
      label: 'Open Contributions',
      href: '/admin/fund-space/contributions',
    };
  }

  if (combined.includes('FUND_SPACE') || combined.includes('FUND SPACE')) {
    return {
      label: 'Open Fund Space',
      href: '/admin/fund-space',
    };
  }

  return {
    label: 'Open Admin Dashboard',
    href: '/admin',
  };
}

function getPriority(item: {
  category: AdminNotificationFilter;
  title?: string | null;
  message?: string | null;
  is_read?: boolean | null;
}) {
  const combined = `${item.title || ''} ${item.message || ''}`.toUpperCase();

  if (
    item.category === 'AWAITING_REVIEW' ||
    item.category === 'REJECTED_PAYMENT' ||
    combined.includes('REJECTED') ||
    combined.includes('FAILED') ||
    combined.includes('OVERDUE') ||
    combined.includes('PAYOUT READY')
  ) {
    return 'HIGH';
  }

  if (item.is_read === false || item.category === 'MANUAL_PAYMENT') {
    return 'MEDIUM';
  }

  return 'LOW';
}

function buildManualPaymentNotification({
  submission,
  customer,
  agent,
  fundSpace,
  contribution,
}: {
  submission: ManualPaymentSubmissionRow;
  customer: ProfileRow | null;
  agent: ProfileRow | null;
  fundSpace: FundSpaceRow | null;
  contribution: ContributionRow | null;
}): AdminNotificationItem {
  const status = normalizeStatus(submission.status);
  const customerName = customer?.full_name || 'Unknown customer';
  const fundSpaceName = fundSpace?.name || 'Unknown Fund Space';
  const amountText = formatMoney(submission.total_amount_paid);
  const reference = submission.transaction_reference || 'No reference';

  let category: AdminNotificationFilter = 'MANUAL_PAYMENT';
  let title = 'Manual MoMo Payment Update';
  let message = `${customerName} submitted a MoMo payment record for ${fundSpaceName}.`;
  let priority: 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM';
  let isRead = true;

  if (status === 'PENDING_REVIEW') {
    category = 'AWAITING_REVIEW';
    title = 'MoMo Payment Awaiting Admin Verification';
    message = `${customerName} submitted ${amountText} for ${fundSpaceName}. Reference: ${reference}. Please verify this against the TrustPoint merchant MoMo statement.`;
    priority = 'HIGH';
    isRead = false;
  } else if (status === 'REJECTED') {
    category = 'REJECTED_PAYMENT';
    title = 'MoMo Payment Rejected';
    message = `${customerName}'s MoMo payment for ${fundSpaceName} was rejected. Reason: ${
      submission.rejection_reason || 'No reason provided'
    }.`;
    priority = 'HIGH';
    isRead = false;
  } else if (
    status === 'APPROVED' ||
    status === 'CONFIRMED' ||
    normalizeStatus(contribution?.status) === 'PAID'
  ) {
    category = 'APPROVED_PAYMENT';
    title = 'MoMo Payment Confirmed';
    message = `${customerName}'s contribution for ${fundSpaceName} has been confirmed. Reference: ${reference}.`;
    priority = 'LOW';
    isRead = true;
  }

  return {
    id: `manual-payment-${submission.id}`,
    source: 'MANUAL_PAYMENT_SYSTEM',
    real_notification_id: null,
    title,
    message,
    type: 'MANUAL_PAYMENT',
    category,
    priority,
    is_read: isRead,
    related_entity_id: submission.id,
    related_entity_type: 'manual_payment_submissions',
    created_at: submission.created_at,
    action_label:
      status === 'PENDING_REVIEW'
        ? 'Review MoMo Payment'
        : 'View MoMo Verification',
    action_href: `/admin/manual-payment-submissions?submission_id=${encodeURIComponent(
      submission.id
    )}`,
    customer_name: customerName,
    customer_phone: customer?.phone || null,
    agent_name: agent?.full_name || null,
    fund_space_name: fundSpaceName,
    amount_due: submission.amount_due,
    service_fee: submission.service_fee,
    total_amount_paid: submission.total_amount_paid,
    transaction_reference: submission.transaction_reference,
    manual_payment_status: submission.status,
    rejection_reason: submission.rejection_reason,
  };
}

function itemMatchesFilter(
  item: AdminNotificationItem,
  filter: AdminNotificationFilter
) {
  if (filter === 'ALL') return true;
  if (filter === 'UNREAD') return item.is_read === false;
  if (filter === 'READ') return item.is_read === true;

  if (filter === 'MANUAL_PAYMENT') {
    return [
      'MANUAL_PAYMENT',
      'AWAITING_REVIEW',
      'REJECTED_PAYMENT',
      'APPROVED_PAYMENT',
    ].includes(item.category);
  }

  return item.category === filter;
}

function itemMatchesSearch(item: AdminNotificationItem, search: string) {
  if (!search.trim()) return true;

  const value = search.trim().toLowerCase();

  const haystack = [
    item.title,
    item.message,
    item.type,
    item.category,
    item.related_entity_type,
    item.customer_name,
    item.customer_phone,
    item.agent_name,
    item.fund_space_name,
    item.transaction_reference,
    item.manual_payment_status,
    item.rejection_reason,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return haystack.includes(value);
}

function calculateStats(items: AdminNotificationItem[]): NotificationStats {
  return {
    all: items.length,
    unread: items.filter((item) => item.is_read === false).length,
    read: items.filter((item) => item.is_read === true).length,
    manual_payment: items.filter((item) =>
      [
        'MANUAL_PAYMENT',
        'AWAITING_REVIEW',
        'REJECTED_PAYMENT',
        'APPROVED_PAYMENT',
      ].includes(item.category)
    ).length,
    awaiting_review: items.filter((item) => item.category === 'AWAITING_REVIEW')
      .length,
    rejected_payment: items.filter((item) => item.category === 'REJECTED_PAYMENT')
      .length,
    approved_payment: items.filter((item) => item.category === 'APPROVED_PAYMENT')
      .length,
    payout: items.filter((item) => item.category === 'PAYOUT').length,
    verification: items.filter((item) => item.category === 'VERIFICATION').length,
    fund_space: items.filter((item) => item.category === 'FUND_SPACE').length,
    general: items.filter((item) => item.category === 'GENERAL').length,
  };
}

export async function GET(request: NextRequest) {
  try {
    const { profile, error } = await getAdminProfile(request);

    if (error || !profile) {
      return error;
    }

    const { searchParams } = new URL(request.url);
    const filter = normalizeFilter(searchParams.get('filter'));
    const search = String(searchParams.get('search') || '').trim();
    const page = normalizePositiveNumber(searchParams.get('page'), 1);
    const limit = Math.min(
      normalizePositiveNumber(searchParams.get('limit'), 20),
      50
    );

    const [notificationsResult, manualPaymentsResult] = await Promise.all([
      adminSupabase
        .from('notifications')
        .select(
          'id, user_id, title, message, type, is_read, related_entity_id, related_entity_type, created_at'
        )
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(250),

      adminSupabase
        .from('manual_payment_submissions')
        .select(
          'id, agent_id, amount_due, company_payment_account_id, contribution_id, created_at, fund_space_id, payer_relationship, payer_type, payment_note, rejection_reason, reviewed_at, reviewed_by, round_id, sender_name, sender_network, sender_phone, service_fee, status, submitted_by, submitted_by_role, total_amount_paid, transaction_reference, user_id'
        )
        .in('status', ['PENDING_REVIEW', 'REJECTED', 'APPROVED', 'CONFIRMED'])
        .order('created_at', { ascending: false })
        .limit(200),
    ]);

    if (notificationsResult.error) {
      return NextResponse.json(
        {
          success: false,
          message:
            notificationsResult.error.message ||
            'Could not load admin notifications.',
        },
        { status: 500 }
      );
    }

    if (manualPaymentsResult.error) {
      return NextResponse.json(
        {
          success: false,
          message:
            manualPaymentsResult.error.message ||
            'Could not load manual payment notifications.',
        },
        { status: 500 }
      );
    }

    const notifications = (notificationsResult.data || []) as NotificationRow[];
    const manualPayments =
      (manualPaymentsResult.data || []) as ManualPaymentSubmissionRow[];

    const customerIds = [...new Set(manualPayments.map((item) => item.user_id))];

    const agentIds = [
      ...new Set(
        manualPayments
          .map((item) => item.agent_id || item.submitted_by)
          .filter(Boolean) as string[]
      ),
    ];

    const profileIds = [...new Set([...customerIds, ...agentIds])];

    const fundSpaceIds = [
      ...new Set(manualPayments.map((item) => item.fund_space_id)),
    ];

    const contributionIds = [
      ...new Set(manualPayments.map((item) => item.contribution_id)),
    ];

    const [profilesResult, fundSpacesResult, contributionsResult] =
      await Promise.all([
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

        contributionIds.length
          ? adminSupabase
              .from('fund_space_contributions')
              .select(
                'id, amount_due, amount_paid, fund_space_id, paid_at, payment_method, payment_reference, round_id, status, user_id'
              )
              .in('id', contributionIds)
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

    if (contributionsResult.error) {
      return NextResponse.json(
        {
          success: false,
          message: contributionsResult.error.message,
        },
        { status: 500 }
      );
    }

    const profiles = (profilesResult.data || []) as ProfileRow[];
    const fundSpaces = (fundSpacesResult.data || []) as FundSpaceRow[];
    const contributions = (contributionsResult.data || []) as ContributionRow[];

    const profileById = new Map(profiles.map((item) => [item.id, item]));
    const fundSpaceById = new Map(fundSpaces.map((item) => [item.id, item]));
    const contributionById = new Map(
      contributions.map((item) => [item.id, item])
    );

    const databaseItems: AdminNotificationItem[] = notifications.map(
      (notification) => {
        const category = getDatabaseNotificationCategory(notification);
        const action = getDatabaseAction(notification);

        return {
          id: notification.id,
          source: 'DATABASE',
          real_notification_id: notification.id,
          title: notification.title,
          message: notification.message,
          type: notification.type,
          category,
          priority: getPriority({
            category,
            title: notification.title,
            message: notification.message,
            is_read: notification.is_read,
          }),
          is_read: notification.is_read,
          related_entity_id: notification.related_entity_id,
          related_entity_type: notification.related_entity_type,
          created_at: notification.created_at,
          action_label: action.label,
          action_href: action.href,
        };
      }
    );

    const manualPaymentItems = manualPayments.map((submission) =>
      buildManualPaymentNotification({
        submission,
        customer: profileById.get(submission.user_id) || null,
        agent:
          profileById.get(submission.agent_id || '') ||
          profileById.get(submission.submitted_by || '') ||
          null,
        fundSpace: fundSpaceById.get(submission.fund_space_id) || null,
        contribution: contributionById.get(submission.contribution_id) || null,
      })
    );

    const combinedItems = [...manualPaymentItems, ...databaseItems].sort(
      (a, b) => {
        const priorityRank = {
          HIGH: 3,
          MEDIUM: 2,
          LOW: 1,
        };

        if (priorityRank[a.priority] !== priorityRank[b.priority]) {
          return priorityRank[b.priority] - priorityRank[a.priority];
        }

        const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;

        return bTime - aTime;
      }
    );

    const stats = calculateStats(combinedItems);

    const filteredItems = combinedItems
      .filter((item) => itemMatchesFilter(item, filter))
      .filter((item) => itemMatchesSearch(item, search));

    const total = filteredItems.length;
    const totalPages = Math.max(Math.ceil(total / limit), 1);
    const safePage = Math.min(page, totalPages);
    const from = (safePage - 1) * limit;
    const to = from + limit;

    return NextResponse.json({
      success: true,
      stats,
      notifications: filteredItems.slice(from, to),
      pagination: {
        page: safePage,
        limit,
        total,
        totalPages,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : 'Something went wrong while loading admin notifications.',
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { profile, error } = await getAdminProfile(request);

    if (error || !profile) {
      return error;
    }

    const body = await request.json().catch(() => ({}));

    const action = String(body.action || '').toUpperCase();
    const notificationId = String(body.notification_id || '');

    if (action === 'MARK_ALL_READ') {
      const { error: updateError } = await adminSupabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', profile.id)
        .eq('is_read', false);

      if (updateError) {
        return NextResponse.json(
          {
            success: false,
            message:
              updateError.message || 'Could not mark notifications as read.',
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'All database notifications have been marked as read.',
      });
    }

    if (action === 'MARK_ONE_READ') {
      if (!notificationId || notificationId.startsWith('manual-payment-')) {
        return NextResponse.json(
          {
            success: false,
            message:
              'This is a live manual payment alert. Open the MoMo verification page to manage it.',
          },
          { status: 400 }
        );
      }

      const { error: updateError } = await adminSupabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId)
        .eq('user_id', profile.id);

      if (updateError) {
        return NextResponse.json(
          {
            success: false,
            message:
              updateError.message || 'Could not mark notification as read.',
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Notification marked as read.',
      });
    }

    return NextResponse.json(
      {
        success: false,
        message: 'Unsupported notification action.',
      },
      { status: 400 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : 'Something went wrong while updating notifications.',
      },
      { status: 500 }
    );
  }
}