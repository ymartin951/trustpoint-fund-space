'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  Clock,
  Eye,
  HandCoins,
  Loader2,
  RefreshCw,
  Search,
  UserRound,
  Wallet,
  X,
  XCircle,
} from 'lucide-react';

import { supabase } from '@/lib/supabase/client';

type PayoutStatusFilter =
  | 'ALL'
  | 'PENDING_ADMIN_APPROVAL'
  | 'APPROVED'
  | 'APPROVED_FOR_PAYOUT'
  | 'PAID'
  | 'REJECTED'
  | 'FAILED'
  | 'CANCELLED';

type ActionType = 'APPROVE' | 'REJECT' | 'MARK_PAID' | null;

type ProfileLite = {
  id: string;
  full_name: string | null;
  phone: string | null;
  email?: string | null;
  momo_number?: string | null;
  bank_name?: string | null;
  bank_account_number?: string | null;
  bank_account_name?: string | null;
  registered_by_agent?: string | null;
  verification_status?: string | null;
  status?: string | null;
};

type FundSpaceLite = {
  id: string;
  name: string | null;
  contribution_amount: number | string | null;
  status: string | null;
  current_round_number?: number | null;
};

type RoundLite = {
  id: string;
  fund_space_id: string;
  round_number: number | null;
  contribution_deadline: string | null;
  week_start_date?: string | null;
  week_end_date?: string | null;
  status: string | null;
};

type Payout = {
  id: string;
  fund_space_id: string;
  round_id: string;
  user_id?: string | null;
  recipient_user_id?: string | null;
  amount?: number | string | null;
  gross_amount?: number | string | null;
  net_amount?: number | string | null;
  platform_fee?: number | string | null;
  status: string | null;
  payout_method?: string | null;
  payout_reference?: string | null;
  approved_at: string | null;
  approved_by?: string | null;
  paid_at: string | null;
  paid_by?: string | null;
  rejection_reason?: string | null;
  failure_reason?: string | null;
  created_at: string | null;
  updated_at?: string | null;

  fund_space?: FundSpaceLite | null;
  round?: RoundLite | null;
  profile?: ProfileLite | null;
  recipient?: ProfileLite | null;
};

type PayoutStats = {
  total: number;
  pendingApproval: number;
  approved: number;
  paid: number;
  rejected: number;
  failed: number;
  cancelled: number;
  totalValue: number;
  pendingValue: number;
  paidValue: number;
};

type SummaryItemData = {
  label: string;
  value: string | number;
  helper?: string;
  href: string;
  status: PayoutStatusFilter;
};

const defaultStats: PayoutStats = {
  total: 0,
  pendingApproval: 0,
  approved: 0,
  paid: 0,
  rejected: 0,
  failed: 0,
  cancelled: 0,
  totalValue: 0,
  pendingValue: 0,
  paidValue: 0,
};

const statusTabs: { label: string; value: PayoutStatusFilter; href: string }[] = [
  { label: 'All', value: 'ALL', href: '/admin/fund-space/payouts' },
  {
    label: 'Pending',
    value: 'PENDING_ADMIN_APPROVAL',
    href: '/admin/fund-space/payouts?status=PENDING_ADMIN_APPROVAL',
  },
  {
    label: 'Approved',
    value: 'APPROVED',
    href: '/admin/fund-space/payouts?status=APPROVED',
  },
  { label: 'Paid', value: 'PAID', href: '/admin/fund-space/payouts?status=PAID' },
  {
    label: 'Rejected',
    value: 'REJECTED',
    href: '/admin/fund-space/payouts?status=REJECTED',
  },
  {
    label: 'Failed',
    value: 'FAILED',
    href: '/admin/fund-space/payouts?status=FAILED',
  },
  {
    label: 'Cancelled',
    value: 'CANCELLED',
    href: '/admin/fund-space/payouts?status=CANCELLED',
  },
];

function normalizeStatus(status: string | null | undefined) {
  return String(status || '').trim().toUpperCase();
}

function toNumber(value: number | string | null | undefined) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCurrency(amount: number | string | null | undefined) {
  return `GH₵${toNumber(amount).toLocaleString('en-GH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'Not set';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Invalid date';

  return date.toLocaleDateString('en-GH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return 'Not set';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Invalid date';

  return date.toLocaleString('en-GH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatLabel(value: string | null | undefined) {
  if (!value) return 'Not set';

  return value
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getPayoutAmount(payout: Payout | null | undefined) {
  if (!payout) return 0;
  return toNumber(payout.net_amount ?? payout.amount ?? payout.gross_amount);
}

function getGrossAmount(payout: Payout | null | undefined) {
  if (!payout) return 0;
  return toNumber(payout.gross_amount ?? payout.amount ?? payout.net_amount);
}

function getRecipientUserId(payout: Payout | null | undefined) {
  if (!payout) return '';
  return payout.recipient_user_id || payout.user_id || '';
}

function getRecipientProfile(payout: Payout | null | undefined) {
  if (!payout) return null;
  return payout.profile || payout.recipient || null;
}

function getStatusStyle(status: string | null | undefined) {
  const value = normalizeStatus(status);

  if (['PAID', 'COMPLETED', 'SUCCESS'].includes(value)) {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }

  if (['APPROVED', 'APPROVED_FOR_PAYOUT'].includes(value)) {
    return 'border-blue-200 bg-blue-50 text-blue-700';
  }

  if (
    [
      'PENDING',
      'PENDING_ADMIN_APPROVAL',
      'READY_FOR_ADMIN_APPROVAL',
      'READY_FOR_PAYOUT',
    ].includes(value)
  ) {
    return 'border-amber-200 bg-amber-50 text-amber-700';
  }

  if (['REJECTED', 'FAILED', 'CANCELLED'].includes(value)) {
    return 'border-red-200 bg-red-50 text-red-700';
  }

  return 'border-slate-200 bg-slate-50 text-slate-700';
}

function canApprovePayout(payout: Payout) {
  return [
    'PENDING_ADMIN_APPROVAL',
    'READY_FOR_ADMIN_APPROVAL',
    'READY_FOR_PAYOUT',
  ].includes(normalizeStatus(payout.status));
}

function canRejectPayout(payout: Payout) {
  return [
    'PENDING_ADMIN_APPROVAL',
    'READY_FOR_ADMIN_APPROVAL',
    'READY_FOR_PAYOUT',
  ].includes(normalizeStatus(payout.status));
}

function canMarkPaid(payout: Payout) {
  return ['APPROVED', 'APPROVED_FOR_PAYOUT'].includes(
    normalizeStatus(payout.status)
  );
}

function getPayoutReviewState(payout: Payout) {
  const status = normalizeStatus(payout.status);

  if (
    ['PENDING_ADMIN_APPROVAL', 'READY_FOR_ADMIN_APPROVAL', 'READY_FOR_PAYOUT'].includes(
      status
    )
  ) {
    return {
      title: 'Pending Admin Approval',
      description:
        'This payout is waiting for admin approval. Review the recipient and round details before approving.',
      className: 'border-amber-200 bg-amber-50 text-amber-800',
    };
  }

  if (['APPROVED', 'APPROVED_FOR_PAYOUT'].includes(status)) {
    return {
      title: 'Payout Approved',
      description:
        'This payout has been approved. The next action is to send the money and mark it as paid.',
      className: 'border-blue-200 bg-blue-50 text-blue-800',
    };
  }

  if (status === 'PAID') {
    return {
      title: 'Payout Paid',
      description:
        'This payout has already been marked as paid. No further payout action is required.',
      className: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    };
  }

  if (status === 'REJECTED') {
    return {
      title: 'Payout Rejected',
      description:
        payout.rejection_reason ||
        'This payout was rejected. Check the rejection reason before taking any further action.',
      className: 'border-red-200 bg-red-50 text-red-800',
    };
  }

  if (status === 'FAILED') {
    return {
      title: 'Payout Failed',
      description:
        payout.failure_reason ||
        'This payout failed. Review the payout details and payment reference.',
      className: 'border-red-200 bg-red-50 text-red-800',
    };
  }

  if (status === 'CANCELLED') {
    return {
      title: 'Payout Cancelled',
      description: 'This payout was cancelled and cannot be processed.',
      className: 'border-red-200 bg-red-50 text-red-800',
    };
  }

  return {
    title: formatLabel(status),
    description: 'This payout is not currently open for admin processing.',
    className: 'border-slate-200 bg-white text-slate-700',
  };
}

function getApproveButtonText(status: string, loading: boolean) {
  if (loading) return 'Approving...';

  if (
    ['PENDING_ADMIN_APPROVAL', 'READY_FOR_ADMIN_APPROVAL', 'READY_FOR_PAYOUT'].includes(
      status
    )
  ) {
    return 'Approve Payout';
  }

  if (['APPROVED', 'APPROVED_FOR_PAYOUT'].includes(status)) {
    return 'Payout Approved';
  }

  if (status === 'PAID') return 'Already Approved';
  if (status === 'REJECTED') return 'Cannot Approve — Rejected';
  if (status === 'FAILED') return 'Cannot Approve — Failed';
  if (status === 'CANCELLED') return 'Cannot Approve — Cancelled';

  return `Cannot Approve — ${formatLabel(status)}`;
}

function getMarkPaidButtonText(status: string, loading: boolean) {
  if (loading) return 'Marking Paid...';

  if (['APPROVED', 'APPROVED_FOR_PAYOUT'].includes(status)) {
    return 'Mark as Paid';
  }

  if (status === 'PAID') return 'Payout Paid';
  if (
    ['PENDING_ADMIN_APPROVAL', 'READY_FOR_ADMIN_APPROVAL', 'READY_FOR_PAYOUT'].includes(
      status
    )
  ) {
    return 'Cannot Mark Paid — Pending';
  }

  if (status === 'REJECTED') return 'Cannot Mark Paid — Rejected';
  if (status === 'FAILED') return 'Cannot Mark Paid — Failed';
  if (status === 'CANCELLED') return 'Cannot Mark Paid — Cancelled';

  return `Cannot Mark Paid — ${formatLabel(status)}`;
}

function getRejectButtonText(status: string, loading: boolean) {
  if (loading) return 'Rejecting...';

  if (
    ['PENDING_ADMIN_APPROVAL', 'READY_FOR_ADMIN_APPROVAL', 'READY_FOR_PAYOUT'].includes(
      status
    )
  ) {
    return 'Reject Payout';
  }

  if (['APPROVED', 'APPROVED_FOR_PAYOUT'].includes(status)) {
    return 'Cannot Reject — Approved';
  }

  if (status === 'PAID') return 'Cannot Reject — Paid';
  if (status === 'REJECTED') return 'Payout Rejected';
  if (status === 'FAILED') return 'Cannot Reject — Failed';
  if (status === 'CANCELLED') return 'Cannot Reject — Cancelled';

  return `Cannot Reject — ${formatLabel(status)}`;
}

function buildStats(payouts: Payout[]): PayoutStats {
  return payouts.reduce<PayoutStats>(
    (stats, payout) => {
      const status = normalizeStatus(payout.status);
      const amount = getPayoutAmount(payout);

      stats.total += 1;
      stats.totalValue += amount;

      if (
        [
          'PENDING_ADMIN_APPROVAL',
          'READY_FOR_ADMIN_APPROVAL',
          'READY_FOR_PAYOUT',
        ].includes(status)
      ) {
        stats.pendingApproval += 1;
        stats.pendingValue += amount;
      }

      if (['APPROVED', 'APPROVED_FOR_PAYOUT'].includes(status)) {
        stats.approved += 1;
      }

      if (status === 'PAID') {
        stats.paid += 1;
        stats.paidValue += amount;
      }

      if (status === 'REJECTED') stats.rejected += 1;
      if (status === 'FAILED') stats.failed += 1;
      if (status === 'CANCELLED') stats.cancelled += 1;

      return stats;
    },
    { ...defaultStats }
  );
}

function matchesSearch(payout: Payout, search: string) {
  if (!search) return true;

  const recipient = getRecipientProfile(payout);

  const haystack = [
    payout.id,
    payout.status,
    payout.payout_method,
    payout.payout_reference,
    payout.fund_space?.name,
    payout.fund_space?.status,
    payout.round?.round_number ? `round ${payout.round.round_number}` : '',
    payout.round?.status,
    recipient?.full_name,
    recipient?.phone,
    recipient?.email,
    recipient?.momo_number,
    recipient?.verification_status,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return haystack.includes(search.toLowerCase());
}

function SummaryItem({
  item,
  active,
}: {
  item: SummaryItemData;
  active: boolean;
}) {
  return (
    <Link
      href={item.href}
      className={`group min-w-0 rounded-2xl border border-white/70 bg-white/10 p-4 text-white transition hover:-translate-y-0.5 hover:bg-white/20 hover:shadow-lg ${
        active ? 'bg-white/20 ring-2 ring-white/40' : ''
      }`}
    >
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-black uppercase tracking-wide text-emerald-50/90">
            {item.label}
          </p>

          <p className="mt-2 truncate text-2xl font-black text-white md:text-3xl">
            {item.value}
          </p>

          {item.helper && (
            <p className="mt-1 truncate text-xs font-semibold text-emerald-50/80">
              {item.helper}
            </p>
          )}
        </div>

        <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-emerald-50/80 transition group-hover:translate-x-1 group-hover:text-white" />
      </div>
    </Link>
  );
}

function StatusPill({ status }: { status: string | null | undefined }) {
  return (
    <span
      className={`inline-flex max-w-full rounded-full border px-3 py-1 text-xs font-black ${getStatusStyle(
        status
      )}`}
    >
      <span className="truncate">{formatLabel(status)}</span>
    </span>
  );
}

function CompactInfo({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  return (
    <div className="min-w-0">
      <p className="truncate text-[11px] font-black uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="truncate text-sm font-black text-slate-900">
        {value ?? 'Not set'}
      </p>
    </div>
  );
}

function MessageBox({
  type,
  message,
}: {
  type: 'success' | 'error' | 'info';
  message: string;
}) {
  const isSuccess = type === 'success';
  const isInfo = type === 'info';

  return (
    <div
      className={`rounded-2xl border p-4 text-sm font-semibold ${
        isSuccess
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
          : isInfo
            ? 'border-blue-200 bg-blue-50 text-blue-700'
            : 'border-red-200 bg-red-50 text-red-700'
      }`}
    >
      <div className="flex items-start gap-3">
        {isSuccess ? (
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
        ) : (
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
        )}
        <p className="min-w-0 break-words leading-6">{message}</p>
      </div>
    </div>
  );
}

export default function AdminFundSpacePayoutsPage() {
  const searchParams = useSearchParams();

  const fundSpaceId = searchParams.get('fund_space_id') || '';

  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [statusFilter, setStatusFilter] = useState<PayoutStatusFilter>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPayout, setSelectedPayout] = useState<Payout | null>(null);
  const [rejectPayout, setRejectPayout] = useState<Payout | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [actionType, setActionType] = useState<ActionType>(null);
  const [message, setMessage] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

  useEffect(() => {
    const urlStatus = normalizeStatus(searchParams.get('status') || 'ALL');

    if (
      [
        'PENDING_ADMIN_APPROVAL',
        'APPROVED',
        'APPROVED_FOR_PAYOUT',
        'PAID',
        'REJECTED',
        'FAILED',
        'CANCELLED',
      ].includes(urlStatus)
    ) {
      setStatusFilter(urlStatus as PayoutStatusFilter);
    } else {
      setStatusFilter('ALL');
    }
  }, [searchParams]);

  const loadPayoutsFallback = useCallback(async () => {
    const db = supabase as any;

    let payoutQuery = db
      .from('fund_space_payouts')
      .select('*')
      .order('created_at', { ascending: false });

    if (fundSpaceId) {
      payoutQuery = payoutQuery.eq('fund_space_id', fundSpaceId);
    }

    const { data: payoutRows, error: payoutError } = await payoutQuery;

    if (payoutError) throw payoutError;

    const basePayouts = (payoutRows || []) as Payout[];

    if (basePayouts.length === 0) {
      setPayouts([]);
      return;
    }

    const fundSpaceIds = [
      ...new Set(basePayouts.map((item) => item.fund_space_id).filter(Boolean)),
    ];
    const roundIds = [
      ...new Set(basePayouts.map((item) => item.round_id).filter(Boolean)),
    ];
    const recipientIds = [
      ...new Set(basePayouts.map((item) => getRecipientUserId(item)).filter(Boolean)),
    ];

    const [fundSpacesResult, roundsResult, profilesResult] = await Promise.all([
      fundSpaceIds.length
        ? db
            .from('fund_spaces')
            .select('id, name, contribution_amount, status, current_round_number')
            .in('id', fundSpaceIds)
        : Promise.resolve({ data: [], error: null }),

      roundIds.length
        ? db
            .from('fund_space_rounds')
            .select(
              'id, fund_space_id, round_number, contribution_deadline, week_start_date, week_end_date, status'
            )
            .in('id', roundIds)
        : Promise.resolve({ data: [], error: null }),

      recipientIds.length
        ? db
            .from('profiles')
            .select(
              'id, full_name, phone, email, momo_number, bank_name, bank_account_number, bank_account_name, registered_by_agent, verification_status, status'
            )
            .in('id', recipientIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (fundSpacesResult.error) throw fundSpacesResult.error;
    if (roundsResult.error) throw roundsResult.error;
    if (profilesResult.error) throw profilesResult.error;

    const fundSpaceById = new Map(
      ((fundSpacesResult.data || []) as FundSpaceLite[]).map((item) => [
        item.id,
        item,
      ])
    );
    const roundById = new Map(
      ((roundsResult.data || []) as RoundLite[]).map((item) => [item.id, item])
    );
    const profileById = new Map(
      ((profilesResult.data || []) as ProfileLite[]).map((item) => [
        item.id,
        item,
      ])
    );

    const mappedPayouts = basePayouts.map((payout) => ({
      ...payout,
      fund_space: fundSpaceById.get(payout.fund_space_id) || null,
      round: roundById.get(payout.round_id) || null,
      profile: profileById.get(getRecipientUserId(payout)) || null,
    }));

    setPayouts(mappedPayouts);
  }, [fundSpaceId]);

  const loadPayouts = useCallback(
    async (showRefresh = false) => {
      try {
        if (showRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setMessage(null);

        const db = supabase as any;

        let query = db
          .from('fund_space_payouts')
          .select(
            `
            *,
            fund_space:fund_spaces (
              id,
              name,
              contribution_amount,
              status,
              current_round_number
            ),
            round:fund_space_rounds (
              id,
              fund_space_id,
              round_number,
              contribution_deadline,
              week_start_date,
              week_end_date,
              status
            ),
            profile:profiles (
              id,
              full_name,
              phone,
              email,
              momo_number,
              bank_name,
              bank_account_number,
              bank_account_name,
              registered_by_agent,
              verification_status,
              status
            )
          `
          )
          .order('created_at', { ascending: false });

        if (fundSpaceId) {
          query = query.eq('fund_space_id', fundSpaceId);
        }

        const { data, error } = await query;

        if (error) {
          console.warn(
            'Payout relationship query failed. Using fallback:',
            error.message
          );
          await loadPayoutsFallback();
          return;
        }

        setPayouts((data || []) as Payout[]);
      } catch (error) {
        setPayouts([]);
        setMessage({
          type: 'error',
          text:
            error instanceof Error
              ? error.message
              : 'Unable to load Fund Space payouts.',
        });
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [fundSpaceId, loadPayoutsFallback]
  );

  useEffect(() => {
    loadPayouts();
  }, [loadPayouts]);

  const stats = useMemo(() => buildStats(payouts), [payouts]);

  const summaryItems: SummaryItemData[] = [
    {
      label: 'Total Payouts',
      value: stats.total,
      helper: formatCurrency(stats.totalValue),
      href: fundSpaceId
        ? `/admin/fund-space/payouts?fund_space_id=${fundSpaceId}`
        : '/admin/fund-space/payouts',
      status: 'ALL',
    },
    {
      label: 'Pending Approval',
      value: stats.pendingApproval,
      helper: formatCurrency(stats.pendingValue),
      href: fundSpaceId
        ? `/admin/fund-space/payouts?fund_space_id=${fundSpaceId}&status=PENDING_ADMIN_APPROVAL`
        : '/admin/fund-space/payouts?status=PENDING_ADMIN_APPROVAL',
      status: 'PENDING_ADMIN_APPROVAL',
    },
    {
      label: 'Approved',
      value: stats.approved,
      helper: 'Ready to pay',
      href: fundSpaceId
        ? `/admin/fund-space/payouts?fund_space_id=${fundSpaceId}&status=APPROVED`
        : '/admin/fund-space/payouts?status=APPROVED',
      status: 'APPROVED',
    },
    {
      label: 'Paid',
      value: stats.paid,
      helper: formatCurrency(stats.paidValue),
      href: fundSpaceId
        ? `/admin/fund-space/payouts?fund_space_id=${fundSpaceId}&status=PAID`
        : '/admin/fund-space/payouts?status=PAID',
      status: 'PAID',
    },
    {
      label: 'Rejected',
      value: stats.rejected,
      helper: 'Rejected payouts',
      href: fundSpaceId
        ? `/admin/fund-space/payouts?fund_space_id=${fundSpaceId}&status=REJECTED`
        : '/admin/fund-space/payouts?status=REJECTED',
      status: 'REJECTED',
    },
    {
      label: 'Failed',
      value: stats.failed,
      helper: 'Problem payouts',
      href: fundSpaceId
        ? `/admin/fund-space/payouts?fund_space_id=${fundSpaceId}&status=FAILED`
        : '/admin/fund-space/payouts?status=FAILED',
      status: 'FAILED',
    },
  ];

  const filteredPayouts = useMemo(() => {
    const search = searchTerm.trim();

    return payouts.filter((payout) => {
      const status = normalizeStatus(payout.status);

      const matchesStatus =
        statusFilter === 'ALL' ||
        status === statusFilter ||
        (statusFilter === 'PENDING_ADMIN_APPROVAL' &&
          [
            'PENDING_ADMIN_APPROVAL',
            'READY_FOR_ADMIN_APPROVAL',
            'READY_FOR_PAYOUT',
          ].includes(status)) ||
        (statusFilter === 'APPROVED' &&
          ['APPROVED', 'APPROVED_FOR_PAYOUT'].includes(status));

      return matchesStatus && matchesSearch(payout, search);
    });
  }, [payouts, searchTerm, statusFilter]);

  async function handleApprovePayout(payout: Payout) {
    const confirmed = window.confirm(
      'Approve this payout after reviewing recipient details and payout risk?'
    );

    if (!confirmed) return;

    try {
      setActionLoadingId(payout.id);
      setActionType('APPROVE');
      setMessage(null);

      const { error } = await supabase.rpc('approve_fund_space_payout', {
        p_payout_id: payout.id,
      });

      if (error) throw error;

      setMessage({
        type: 'success',
        text: 'Payout approved successfully.',
      });

      await loadPayouts(true);
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Unable to approve payout.',
      });
    } finally {
      setActionLoadingId(null);
      setActionType(null);
    }
  }

  async function handleRejectPayout() {
    if (!rejectPayout) {
      setMessage({
        type: 'error',
        text: 'No payout selected for rejection.',
      });
      return;
    }

    if (!rejectReason.trim()) {
      setMessage({
        type: 'error',
        text: 'Please enter a rejection reason.',
      });
      return;
    }

    try {
      setActionLoadingId(rejectPayout.id);
      setActionType('REJECT');
      setMessage(null);

      const { error } = await supabase.rpc('reject_fund_space_payout', {
        p_payout_id: rejectPayout.id,
        p_reason: rejectReason.trim(),
      });

      if (error) throw error;

      setMessage({
        type: 'success',
        text: 'Payout rejected successfully.',
      });

      setRejectPayout(null);
      setRejectReason('');
      await loadPayouts(true);
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Unable to reject payout.',
      });
    } finally {
      setActionLoadingId(null);
      setActionType(null);
    }
  }

  async function handleMarkAsPaid(payout: Payout) {
    const reference = window.prompt(
      'Enter the MoMo payout transaction/reference number, or leave blank if unavailable.'
    );

    try {
      setActionLoadingId(payout.id);
      setActionType('MARK_PAID');
      setMessage(null);

      const rpcClient = supabase as any;

      const { error } = await rpcClient.rpc('mark_fund_space_payout_paid', {
        p_payout_id: payout.id,
        p_payout_method: 'MOMO',
        p_payment_reference: reference?.trim() || null,
      });

      if (error) {
        const fallback = await rpcClient.rpc('mark_fund_space_payout_paid', {
          p_payout_id: payout.id,
          p_payout_method: 'MOMO',
        });

        if (fallback.error) throw fallback.error;
      }

      setMessage({
        type: 'success',
        text: 'Payout marked as paid successfully.',
      });

      await loadPayouts(true);
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Unable to mark payout as paid.',
      });
    } finally {
      setActionLoadingId(null);
      setActionType(null);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-6">
        <div className="mx-auto flex min-h-[60vh] max-w-6xl items-center justify-center">
          <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-emerald-700" />
            <p className="mt-4 text-sm font-black text-slate-600">
              Loading payout records...
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-5 md:px-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <Link
            href="/admin/fund-space"
            className="inline-flex min-h-11 w-fit items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-100"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Fund Spaces
          </Link>

          <button
            type="button"
            onClick={() => loadPayouts(true)}
            disabled={refreshing}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        <section className="overflow-hidden rounded-[2rem] bg-gradient-to-br from-emerald-950 via-emerald-900 to-emerald-800 text-white shadow-sm">
          <div className="p-5 md:p-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <p className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-xs font-black">
                  <Wallet className="h-4 w-4" />
                  Admin Fund Space Payouts
                </p>

                <h1 className="mt-5 text-3xl font-black tracking-tight md:text-5xl">
                  Fund Space Payouts
                </h1>

                <p className="mt-4 max-w-3xl text-sm font-semibold leading-7 text-emerald-50 md:text-base">
                  Review, approve, reject, and mark member payouts as paid.
                  Every button clearly shows the payout status so admins know
                  what has already happened.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Link
                  href="/admin/fund-space"
                  className="inline-flex min-h-9 items-center justify-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 text-xs font-black text-white ring-1 ring-white/10 transition hover:bg-white/20"
                >
                  Fund Space
                </Link>

                <Link
                  href="/admin/manual-payment-submissions"
                  className="inline-flex min-h-9 items-center justify-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 text-xs font-black text-white ring-1 ring-white/10 transition hover:bg-white/20"
                >
                  MoMo Reviews
                </Link>

                <button
                  type="button"
                  onClick={() => loadPayouts(true)}
                  disabled={refreshing}
                  className="inline-flex min-h-9 items-center justify-center gap-2 rounded-full bg-white px-4 text-xs font-black text-emerald-900 transition hover:bg-emerald-50 disabled:opacity-60"
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`}
                  />
                  Refresh
                </button>
              </div>
            </div>

            <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              {summaryItems.map((item) => (
                <SummaryItem
                  key={item.label}
                  item={item}
                  active={statusFilter === item.status}
                />
              ))}
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <SummaryItem
                item={{
                  label: 'Cancelled',
                  value: stats.cancelled,
                  helper: 'Stopped payouts',
                  href: fundSpaceId
                    ? `/admin/fund-space/payouts?fund_space_id=${fundSpaceId}&status=CANCELLED`
                    : '/admin/fund-space/payouts?status=CANCELLED',
                  status: 'CANCELLED',
                }}
                active={statusFilter === 'CANCELLED'}
              />

              <SummaryItem
                item={{
                  label: 'Showing',
                  value: filteredPayouts.length,
                  helper: 'Current result',
                  href: fundSpaceId
                    ? `/admin/fund-space/payouts?fund_space_id=${fundSpaceId}`
                    : '/admin/fund-space/payouts',
                  status: 'ALL',
                }}
                active={false}
              />

              <SummaryItem
                item={{
                  label: 'Payout Value',
                  value: formatCurrency(stats.totalValue),
                  helper: 'All records',
                  href: fundSpaceId
                    ? `/admin/fund-space/payouts?fund_space_id=${fundSpaceId}`
                    : '/admin/fund-space/payouts',
                  status: 'ALL',
                }}
                active={false}
              />
            </div>
          </div>
        </section>

        {message && <MessageBox type={message.type} message={message.text} />}

        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="relative min-w-0">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search recipient, phone, reference, group, round..."
                className="min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm font-semibold outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-100"
              />
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1">
              {statusTabs.map((tab) => (
                <Link
                  key={tab.value}
                  href={
                    fundSpaceId
                      ? `${tab.href}${
                          tab.href.includes('?') ? '&' : '?'
                        }fund_space_id=${fundSpaceId}`
                      : tab.href
                  }
                  className={`shrink-0 rounded-2xl px-4 py-3 text-xs font-black transition ${
                    statusFilter === tab.value
                      ? 'bg-emerald-700 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {tab.label}
                </Link>
              ))}
            </div>
          </div>

          <p className="mt-3 text-xs font-bold text-slate-500">
            Showing {filteredPayouts.length} of {payouts.length} payout records.
          </p>
        </section>

        <section className="space-y-3">
          {filteredPayouts.length === 0 ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
              <Wallet className="mx-auto h-10 w-10 text-slate-300" />
              <h2 className="mt-4 text-lg font-black text-slate-900">
                No payout records found
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                Try another status tab, search term, or refresh the page.
              </p>
            </div>
          ) : (
            filteredPayouts.map((payout) => {
              const recipient = getRecipientProfile(payout);
              const amount = getPayoutAmount(payout);
              const loadingThis = actionLoadingId === payout.id;
              const status = normalizeStatus(payout.status);
              const reviewState = getPayoutReviewState(payout);
              const approveLoading = loadingThis && actionType === 'APPROVE';
              const rejectLoading = loadingThis && actionType === 'REJECT';
              const markPaidLoading = loadingThis && actionType === 'MARK_PAID';

              return (
                <article
                  key={payout.id}
                  className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:border-emerald-200 hover:shadow-md"
                >
                  <div className="grid gap-5 p-4 xl:grid-cols-[1fr_300px] xl:items-start">
                    <div className="min-w-0">
                      <div className="flex flex-wrap gap-2">
                        <StatusPill status={payout.status} />
                        <StatusPill status={payout.round?.status} />
                      </div>

                      <div className="mt-3 flex items-start gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                          <UserRound className="h-5 w-5" />
                        </div>

                        <div className="min-w-0">
                          <h2 className="line-clamp-2 break-words text-base font-black leading-6 text-slate-900">
                            {recipient?.full_name || 'Unknown recipient'}
                          </h2>

                          <p className="mt-1 truncate text-sm font-semibold text-slate-500">
                            {recipient?.phone || 'No phone'} •{' '}
                            {payout.fund_space?.name || 'Fund Space'}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <CompactInfo
                          label="Round"
                          value={
                            payout.round?.round_number
                              ? `Round ${payout.round.round_number}`
                              : 'Not set'
                          }
                        />
                        <CompactInfo label="Net Amount" value={formatCurrency(amount)} />
                        <CompactInfo
                          label="Gross Amount"
                          value={formatCurrency(getGrossAmount(payout))}
                        />
                        <CompactInfo
                          label="Platform Fee"
                          value={formatCurrency(payout.platform_fee)}
                        />
                        <CompactInfo
                          label="Approved At"
                          value={formatDateTime(payout.approved_at)}
                        />
                        <CompactInfo
                          label="Paid At"
                          value={formatDateTime(payout.paid_at)}
                        />
                        <CompactInfo label="Method" value={formatLabel(payout.payout_method)} />
                        <CompactInfo
                          label="Reference"
                          value={payout.payout_reference || 'None'}
                        />
                      </div>

                      {payout.rejection_reason && (
                        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4">
                          <p className="text-xs font-black uppercase tracking-wide text-red-500">
                            Rejection Reason
                          </p>
                          <p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-6 text-red-700">
                            {payout.rejection_reason}
                          </p>
                        </div>
                      )}

                      {payout.failure_reason && (
                        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4">
                          <p className="text-xs font-black uppercase tracking-wide text-red-500">
                            Failure Reason
                          </p>
                          <p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-6 text-red-700">
                            {payout.failure_reason}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                      <p className="mb-4 text-sm font-black text-slate-900">
                        Payout Actions
                      </p>

                      <div className={`mb-4 rounded-2xl border p-4 ${reviewState.className}`}>
                        <p className="text-sm font-black">{reviewState.title}</p>
                        <p className="mt-1 text-xs font-semibold leading-5">
                          {reviewState.description}
                        </p>
                      </div>

                      <div className="grid gap-3">
                        <button
                          type="button"
                          onClick={() => setSelectedPayout(payout)}
                          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-4 text-sm font-black text-white hover:bg-emerald-800"
                        >
                          <Eye className="h-4 w-4" />
                          View Details
                        </button>

                        <button
                          type="button"
                          disabled={!canApprovePayout(payout) || loadingThis}
                          onClick={() => handleApprovePayout(payout)}
                          className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border px-4 text-sm font-black transition disabled:cursor-not-allowed ${
                            canApprovePayout(payout)
                              ? 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-60'
                              : ['APPROVED', 'APPROVED_FOR_PAYOUT'].includes(status)
                                ? 'border-blue-200 bg-blue-100 text-blue-800'
                                : status === 'PAID'
                                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                  : status === 'REJECTED'
                                    ? 'border-red-200 bg-red-50 text-red-700'
                                    : 'border-slate-200 bg-slate-200 text-slate-600'
                          }`}
                        >
                          {approveLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <BadgeCheck className="h-4 w-4" />
                          )}
                          {getApproveButtonText(status, approveLoading)}
                        </button>

                        <button
                          type="button"
                          disabled={!canMarkPaid(payout) || loadingThis}
                          onClick={() => handleMarkAsPaid(payout)}
                          className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border px-4 text-sm font-black transition disabled:cursor-not-allowed ${
                            canMarkPaid(payout)
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-60'
                              : status === 'PAID'
                                ? 'border-emerald-200 bg-emerald-100 text-emerald-800'
                                : ['REJECTED', 'FAILED', 'CANCELLED'].includes(status)
                                  ? 'border-red-200 bg-red-50 text-red-700'
                                  : 'border-slate-200 bg-slate-200 text-slate-600'
                          }`}
                        >
                          {markPaidLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <HandCoins className="h-4 w-4" />
                          )}
                          {getMarkPaidButtonText(status, markPaidLoading)}
                        </button>

                        <button
                          type="button"
                          disabled={!canRejectPayout(payout) || loadingThis}
                          onClick={() => {
                            setRejectPayout(payout);
                            setRejectReason('');
                          }}
                          className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border px-4 text-sm font-black transition disabled:cursor-not-allowed ${
                            canRejectPayout(payout)
                              ? 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-60'
                              : status === 'REJECTED'
                                ? 'border-red-200 bg-red-100 text-red-800'
                                : status === 'PAID'
                                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                  : 'border-slate-200 bg-slate-200 text-slate-600'
                          }`}
                        >
                          {rejectLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <XCircle className="h-4 w-4" />
                          )}
                          {getRejectButtonText(status, rejectLoading)}
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </section>
      </div>

      {selectedPayout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-3 py-4">
          <div className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
              <div className="min-w-0">
                <h2 className="text-lg font-black text-slate-900">
                  Payout Details
                </h2>
                <p className="mt-1 truncate text-sm text-slate-500">
                  {getRecipientProfile(selectedPayout)?.full_name || 'Unknown recipient'}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedPayout(null)}
                className="rounded-2xl p-2 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <CompactInfo
                  label="Recipient"
                  value={getRecipientProfile(selectedPayout)?.full_name || 'Unknown'}
                />
                <CompactInfo
                  label="Phone"
                  value={getRecipientProfile(selectedPayout)?.phone || 'No phone'}
                />
                <CompactInfo
                  label="MoMo Number"
                  value={getRecipientProfile(selectedPayout)?.momo_number || 'Not set'}
                />
                <CompactInfo
                  label="Verification"
                  value={formatLabel(
                    getRecipientProfile(selectedPayout)?.verification_status
                  )}
                />
                <CompactInfo
                  label="Fund Space"
                  value={selectedPayout.fund_space?.name || 'Not set'}
                />
                <CompactInfo
                  label="Round"
                  value={
                    selectedPayout.round?.round_number
                      ? `Round ${selectedPayout.round.round_number}`
                      : 'Not set'
                  }
                />
                <CompactInfo
                  label="Payout Status"
                  value={formatLabel(selectedPayout.status)}
                />
                <CompactInfo
                  label="Round Status"
                  value={formatLabel(selectedPayout.round?.status)}
                />
                <CompactInfo
                  label="Gross Amount"
                  value={formatCurrency(getGrossAmount(selectedPayout))}
                />
                <CompactInfo
                  label="Platform Fee"
                  value={formatCurrency(selectedPayout.platform_fee)}
                />
                <CompactInfo
                  label="Net Amount"
                  value={formatCurrency(getPayoutAmount(selectedPayout))}
                />
                <CompactInfo
                  label="Method"
                  value={formatLabel(selectedPayout.payout_method)}
                />
                <CompactInfo
                  label="Reference"
                  value={selectedPayout.payout_reference || 'None'}
                />
                <CompactInfo
                  label="Approved At"
                  value={formatDateTime(selectedPayout.approved_at)}
                />
                <CompactInfo
                  label="Paid At"
                  value={formatDateTime(selectedPayout.paid_at)}
                />
                <CompactInfo
                  label="Created"
                  value={formatDate(selectedPayout.created_at)}
                />
              </div>

              {selectedPayout.rejection_reason && (
                <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4">
                  <p className="text-xs font-black uppercase tracking-wide text-red-500">
                    Rejection Reason
                  </p>
                  <p className="mt-2 whitespace-pre-wrap break-words text-sm font-semibold leading-6 text-red-700">
                    {selectedPayout.rejection_reason}
                  </p>
                </div>
              )}

              {selectedPayout.failure_reason && (
                <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4">
                  <p className="text-xs font-black uppercase tracking-wide text-red-500">
                    Failure Reason
                  </p>
                  <p className="mt-2 whitespace-pre-wrap break-words text-sm font-semibold leading-6 text-red-700">
                    {selectedPayout.failure_reason}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {rejectPayout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-3 py-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="text-lg font-black text-slate-900">
                  Reject Payout
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Give a clear reason for rejecting this payout.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setRejectPayout(null);
                  setRejectReason('');
                }}
                className="rounded-2xl p-2 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <textarea
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
              rows={5}
              placeholder="Example: Recipient payout details are not confirmed."
              className="mt-5 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-100"
            />

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => {
                  setRejectPayout(null);
                  setRejectReason('');
                }}
                className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleRejectPayout}
                disabled={Boolean(actionLoadingId)}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-red-700 px-4 text-sm font-black text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {actionType === 'REJECT' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                Reject Payout
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}