'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  CreditCard,
  Eye,
  Loader2,
  RefreshCw,
  Search,
  Smartphone,
  TrendingDown,
  TrendingUp,
  Wallet,
  X,
  XCircle,
} from 'lucide-react';

import { supabase } from '@/lib/supabase/client';

type TransactionSource =
  | 'ALL'
  | 'MANUAL_PAYMENT'
  | 'SYSTEM_TRANSACTION'
  | 'PROVIDER_TRANSACTION';

type StatusGroup = 'ALL' | 'SUCCESSFUL' | 'PENDING' | 'FAILED' | 'OTHER';

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

type ApiResponse = {
  success: boolean;
  message?: string;
  stats?: TransactionStats;
  records?: AdminTransactionRecord[];
};

type SummaryItem = {
  title: string;
  value: string | number;
  helper: string;
  href: string;
  icon: ReactNode;
  active?: boolean;
};

const defaultStats: TransactionStats = {
  total_records: 0,
  manual_payment_records: 0,
  momo_awaiting_review: 0,
  momo_rejected: 0,
  momo_approved: 0,
  system_transactions: 0,
  provider_attempts: 0,
  successful_system_value: 0,
  pending_value: 0,
  rejected_value: 0,
};

const sourceTabs: { label: string; value: TransactionSource }[] = [
  { label: 'All Records', value: 'ALL' },
  { label: 'MoMo Payments', value: 'MANUAL_PAYMENT' },
  { label: 'System Transactions', value: 'SYSTEM_TRANSACTION' },
  { label: 'Provider Records', value: 'PROVIDER_TRANSACTION' },
];

const statusTabs: { label: string; value: StatusGroup }[] = [
  { label: 'All Status', value: 'ALL' },
  { label: 'Successful', value: 'SUCCESSFUL' },
  { label: 'Pending', value: 'PENDING' },
  { label: 'Failed / Rejected', value: 'FAILED' },
  { label: 'Other', value: 'OTHER' },
];

function normalize(value: string | null | undefined) {
  return String(value || '').trim().toUpperCase();
}

function formatCurrency(amount: number | string | null | undefined) {
  return `GH₵${Number(amount || 0).toLocaleString('en-GH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDateTime(dateString: string | null | undefined) {
  if (!dateString) return 'Not set';

  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) return 'Invalid date';

  return new Intl.DateTimeFormat('en-GH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatLabel(value: string | null | undefined) {
  if (!value) return 'Not set';

  return value
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function buildUrl(params: {
  source?: TransactionSource;
  statusGroup?: StatusGroup;
  search?: string;
}) {
  const query = new URLSearchParams();

  if (params.source && params.source !== 'ALL') {
    query.set('source', params.source);
  }

  if (params.statusGroup && params.statusGroup !== 'ALL') {
    query.set('statusGroup', params.statusGroup);
  }

  if (params.search?.trim()) {
    query.set('search', params.search.trim());
  }

  const value = query.toString();

  return value ? `/admin/transactions?${value}` : '/admin/transactions';
}

function getSourceLabel(source: string | null | undefined) {
  const value = normalize(source);

  if (value === 'MANUAL_PAYMENT') return 'MoMo Payment';
  if (value === 'SYSTEM_TRANSACTION') return 'System Transaction';
  if (value === 'PROVIDER_TRANSACTION') return 'Provider Record';

  return formatLabel(source);
}

function getActionLabel(label: string | null | undefined) {
  const value = String(label || '').trim();

  if (!value) return 'Open Related Page';

  return value
    .replaceAll('Manual Payment', 'MoMo Payment')
    .replaceAll('Manual MoMo', 'MoMo Payment')
    .replaceAll('Manual', 'MoMo');
}

function getDescriptionText(record: AdminTransactionRecord) {
  const source = normalize(record.source);

  if (source === 'MANUAL_PAYMENT') {
    const statusGroup = normalize(record.status_group);

    if (statusGroup === 'PENDING') {
      return 'A MoMo payment reference has been submitted and is waiting for admin review.';
    }

    if (statusGroup === 'SUCCESSFUL') {
      return 'This MoMo payment has been reviewed and approved by admin.';
    }

    if (statusGroup === 'FAILED') {
      return (
        record.rejection_reason ||
        'This MoMo payment reference was reviewed and rejected.'
      );
    }

    return 'This is a MoMo payment record connected to a Fund Space contribution.';
  }

  return record.description;
}

function getTitleText(record: AdminTransactionRecord) {
  const source = normalize(record.source);

  if (source === 'MANUAL_PAYMENT') {
    const statusGroup = normalize(record.status_group);

    if (statusGroup === 'PENDING') return 'MoMo Payment Awaiting Review';
    if (statusGroup === 'SUCCESSFUL') return 'MoMo Payment Approved';
    if (statusGroup === 'FAILED') return 'MoMo Payment Rejected';

    return 'MoMo Payment Record';
  }

  return record.title;
}

function getStatusStyle(statusGroup: string | null | undefined) {
  const value = normalize(statusGroup);

  if (value === 'SUCCESSFUL') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }

  if (value === 'PENDING') {
    return 'border-amber-200 bg-amber-50 text-amber-700';
  }

  if (value === 'FAILED') {
    return 'border-red-200 bg-red-50 text-red-700';
  }

  return 'border-slate-200 bg-slate-50 text-slate-700';
}

function getSourceStyle(source: AdminTransactionRecord['source']) {
  if (source === 'MANUAL_PAYMENT') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }

  if (source === 'SYSTEM_TRANSACTION') {
    return 'border-blue-200 bg-blue-50 text-blue-700';
  }

  return 'border-purple-200 bg-purple-50 text-purple-700';
}

function getSourceIcon(source: AdminTransactionRecord['source']) {
  if (source === 'MANUAL_PAYMENT') {
    return <Smartphone className="h-5 w-5" />;
  }

  if (source === 'SYSTEM_TRANSACTION') {
    return <Wallet className="h-5 w-5" />;
  }

  return <CreditCard className="h-5 w-5" />;
}

function getDirectionIcon(direction: string | null | undefined) {
  const value = normalize(direction);

  if (['CREDIT', 'INCOMING', 'DEPOSIT'].includes(value)) {
    return <TrendingUp className="h-4 w-4" />;
  }

  if (['DEBIT', 'OUTGOING', 'WITHDRAWAL', 'PAYOUT'].includes(value)) {
    return <TrendingDown className="h-4 w-4" />;
  }

  return <Wallet className="h-4 w-4" />;
}

function getRecordState(record: AdminTransactionRecord) {
  const source = normalize(record.source);
  const statusGroup = normalize(record.status_group);

  if (source === 'MANUAL_PAYMENT' && statusGroup === 'PENDING') {
    return {
      title: 'MoMo Payment Review Pending',
      description:
        'This MoMo payment still needs admin review before it can count as paid.',
      className: 'border-amber-200 bg-amber-50 text-amber-800',
    };
  }

  if (source === 'MANUAL_PAYMENT' && statusGroup === 'SUCCESSFUL') {
    return {
      title: 'MoMo Payment Approved',
      description:
        'This MoMo payment has been approved and should already reflect in contribution records.',
      className: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    };
  }

  if (source === 'MANUAL_PAYMENT' && statusGroup === 'FAILED') {
    return {
      title: 'MoMo Payment Rejected',
      description:
        record.rejection_reason ||
        'This MoMo payment reference was rejected by admin.',
      className: 'border-red-200 bg-red-50 text-red-800',
    };
  }

  if (source === 'SYSTEM_TRANSACTION' && statusGroup === 'SUCCESSFUL') {
    return {
      title: 'System Transaction Recorded',
      description:
        'This is a successful system transaction record. It is part of the platform money history.',
      className: 'border-blue-200 bg-blue-50 text-blue-800',
    };
  }

  if (source === 'PROVIDER_TRANSACTION') {
    return {
      title: 'Provider Transaction Record',
      description:
        'This record came from a payment provider attempt or external payment process.',
      className: 'border-purple-200 bg-purple-50 text-purple-800',
    };
  }

  if (statusGroup === 'FAILED') {
    return {
      title: 'Failed Transaction',
      description:
        record.rejection_reason ||
        'This transaction failed, was rejected, or did not complete successfully.',
      className: 'border-red-200 bg-red-50 text-red-800',
    };
  }

  if (statusGroup === 'PENDING') {
    return {
      title: 'Pending Transaction',
      description:
        'This transaction is pending and may need review or provider confirmation.',
      className: 'border-amber-200 bg-amber-50 text-amber-800',
    };
  }

  return {
    title: formatLabel(record.status),
    description: 'Review this transaction record for more details.',
    className: 'border-slate-200 bg-white text-slate-700',
  };
}

async function readApiResponse(response: Response): Promise<ApiResponse> {
  const text = await response.text();

  if (!text) {
    return {
      success: false,
      message: 'The server returned an empty response.',
    };
  }

  try {
    return JSON.parse(text) as ApiResponse;
  } catch {
    return {
      success: false,
      message: 'The server returned an invalid response.',
    };
  }
}

function StatusPill({
  label,
  className,
}: {
  label: string | null | undefined;
  className: string;
}) {
  return (
    <span
      className={`inline-flex max-w-full rounded-full border px-3 py-1 text-xs font-black ${className}`}
    >
      <span className="min-w-0 break-words">{label}</span>
    </span>
  );
}

function CompactInfo({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-slate-100 bg-slate-50 p-4">
      <p className="break-words text-[11px] font-black uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <div className="mt-1 min-w-0 break-words text-sm font-black leading-5 text-slate-900 [overflow-wrap:anywhere]">
        {value ?? 'Not set'}
      </div>
    </div>
  );
}

function SummaryCard({ item }: { item: SummaryItem }) {
  return (
    <Link
      href={item.href}
      className={`group block min-w-0 rounded-2xl border border-white/70 bg-white/10 p-4 text-white transition hover:-translate-y-0.5 hover:bg-white/20 hover:shadow-lg ${
        item.active ? 'bg-white/20 ring-2 ring-white/40' : ''
      }`}
    >
      <div className="flex min-w-0 items-start justify-between gap-2">
        <p className="min-w-0 break-words text-[11px] font-black uppercase tracking-wide text-emerald-50/90 [overflow-wrap:anywhere]">
          {item.title}
        </p>

        <span className="shrink-0 text-emerald-50/90 transition group-hover:translate-x-0.5">
          {item.icon}
        </span>
      </div>

      <p className="mt-3 min-w-0 break-words text-[clamp(1.25rem,4vw,1.875rem)] font-black leading-tight text-white [overflow-wrap:anywhere]">
        {item.value}
      </p>

      <p className="mt-2 min-w-0 break-words text-xs font-semibold leading-5 text-emerald-50/80 [overflow-wrap:anywhere]">
        {item.helper}
      </p>
    </Link>
  );
}

function MessageBox({ message }: { message: string }) {
  return (
    <div className="rounded-3xl border border-red-200 bg-red-50 p-5 text-red-700">
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
        <p className="break-words text-sm font-bold leading-6 [overflow-wrap:anywhere]">
          {message}
        </p>
      </div>
    </div>
  );
}

export default function AdminTransactionsPage() {
  const searchParams = useSearchParams();

  const [records, setRecords] = useState<AdminTransactionRecord[]>([]);
  const [stats, setStats] = useState<TransactionStats>(defaultStats);

  const [sourceFilter, setSourceFilter] = useState<TransactionSource>('ALL');
  const [statusFilter, setStatusFilter] = useState<StatusGroup>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  const [selectedRecord, setSelectedRecord] =
    useState<AdminTransactionRecord | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const urlSource = normalize(searchParams.get('source'));
    const urlStatusGroup = normalize(searchParams.get('statusGroup'));
    const urlSearch = searchParams.get('search') || '';

    if (
      [
        'ALL',
        'MANUAL_PAYMENT',
        'SYSTEM_TRANSACTION',
        'PROVIDER_TRANSACTION',
      ].includes(urlSource)
    ) {
      setSourceFilter(urlSource as TransactionSource);
    }

    if (
      ['ALL', 'SUCCESSFUL', 'PENDING', 'FAILED', 'OTHER'].includes(
        urlStatusGroup
      )
    ) {
      setStatusFilter(urlStatusGroup as StatusGroup);
    }

    if (urlSearch) {
      setSearchTerm(urlSearch);
    }
  }, [searchParams]);

  const loadTransactions = useCallback(
    async (showRefresh = false) => {
      try {
        if (showRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setMessage('');

        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError || !session?.access_token) {
          throw new Error('Your session has expired. Please log in again.');
        }

        const params = new URLSearchParams();
        params.set('limit', '1000');

        if (sourceFilter !== 'ALL') {
          params.set('source', sourceFilter);
        }

        if (statusFilter !== 'ALL') {
          params.set('statusGroup', statusFilter);
        }

        if (searchTerm.trim()) {
          params.set('search', searchTerm.trim());
        }

        const response = await fetch(
          `/api/admin/transactions?${params.toString()}`,
          {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
          }
        );

        const result = await readApiResponse(response);

        if (!response.ok || !result.success) {
          throw new Error(result.message || 'Unable to load transaction records.');
        }

        setStats(result.stats || defaultStats);
        setRecords(result.records || []);
      } catch (error) {
        setRecords([]);
        setStats(defaultStats);
        setMessage(
          error instanceof Error
            ? error.message
            : 'Unable to load transaction records.'
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [searchTerm, sourceFilter, statusFilter]
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadTransactions();
    }, 250);

    return () => window.clearTimeout(timer);
  }, [loadTransactions]);

  const summaryItems: SummaryItem[] = [
    {
      title: 'All Transactions',
      value: stats.total_records,
      helper: 'Every money record',
      href: '/admin/transactions',
      icon: <Wallet className="h-4 w-4" />,
      active: sourceFilter === 'ALL' && statusFilter === 'ALL',
    },
    {
      title: 'MoMo Payments',
      value: stats.manual_payment_records,
      helper: 'MoMo payment records',
      href: buildUrl({ source: 'MANUAL_PAYMENT' }),
      icon: <Smartphone className="h-4 w-4" />,
      active: sourceFilter === 'MANUAL_PAYMENT',
    },
    {
      title: 'Awaiting Review',
      value: stats.momo_awaiting_review,
      helper: 'MoMo payments to review',
      href: buildUrl({
        source: 'MANUAL_PAYMENT',
        statusGroup: 'PENDING',
      }),
      icon: <Clock className="h-4 w-4" />,
      active: sourceFilter === 'MANUAL_PAYMENT' && statusFilter === 'PENDING',
    },
    {
      title: 'Approved MoMo',
      value: stats.momo_approved,
      helper: 'Confirmed MoMo payments',
      href: buildUrl({
        source: 'MANUAL_PAYMENT',
        statusGroup: 'SUCCESSFUL',
      }),
      icon: <CheckCircle2 className="h-4 w-4" />,
      active:
        sourceFilter === 'MANUAL_PAYMENT' && statusFilter === 'SUCCESSFUL',
    },
    {
      title: 'Rejected MoMo',
      value: stats.momo_rejected,
      helper: 'Rejected MoMo payments',
      href: buildUrl({
        source: 'MANUAL_PAYMENT',
        statusGroup: 'FAILED',
      }),
      icon: <XCircle className="h-4 w-4" />,
      active: sourceFilter === 'MANUAL_PAYMENT' && statusFilter === 'FAILED',
    },
    {
      title: 'System Records',
      value: stats.system_transactions,
      helper: 'Internal transaction rows',
      href: buildUrl({ source: 'SYSTEM_TRANSACTION' }),
      icon: <CreditCard className="h-4 w-4" />,
      active: sourceFilter === 'SYSTEM_TRANSACTION',
    },
  ];

  const valueItems: SummaryItem[] = [
    {
      title: 'Successful Value',
      value: formatCurrency(stats.successful_system_value),
      helper: 'Successful system value',
      href: buildUrl({
        source: 'SYSTEM_TRANSACTION',
        statusGroup: 'SUCCESSFUL',
      }),
      icon: <TrendingUp className="h-4 w-4" />,
      active: false,
    },
    {
      title: 'Pending Value',
      value: formatCurrency(stats.pending_value),
      helper: 'Still waiting',
      href: buildUrl({ statusGroup: 'PENDING' }),
      icon: <Clock className="h-4 w-4" />,
      active: statusFilter === 'PENDING',
    },
    {
      title: 'Rejected Value',
      value: formatCurrency(stats.rejected_value),
      helper: 'Rejected/failed value',
      href: buildUrl({ statusGroup: 'FAILED' }),
      icon: <TrendingDown className="h-4 w-4" />,
      active: statusFilter === 'FAILED',
    },
    {
      title: 'Provider Records',
      value: stats.provider_attempts,
      helper: 'External payment logs',
      href: buildUrl({ source: 'PROVIDER_TRANSACTION' }),
      icon: <CreditCard className="h-4 w-4" />,
      active: sourceFilter === 'PROVIDER_TRANSACTION',
    },
  ];

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-6">
        <div className="mx-auto flex min-h-[60vh] max-w-7xl items-center justify-center">
          <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-emerald-700" />
            <p className="mt-4 text-sm font-black text-slate-600">
              Loading transaction records...
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
            href="/admin"
            className="inline-flex min-h-11 w-fit items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-100"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Admin Control Center
          </Link>

          <button
            type="button"
            onClick={() => loadTransactions(true)}
            disabled={refreshing}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw
              className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`}
            />
            Refresh
          </button>
        </div>

        <section className="overflow-hidden rounded-[2rem] bg-gradient-to-br from-emerald-950 via-emerald-900 to-emerald-800 text-white shadow-sm">
          <div className="p-5 md:p-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <p className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-xs font-black">
                  <Wallet className="h-4 w-4" />
                  Admin Transaction Control Center
                </p>

                <h1 className="mt-5 break-words text-3xl font-black tracking-tight md:text-5xl">
                  Transactions
                </h1>

                <p className="mt-4 max-w-3xl break-words text-sm font-semibold leading-7 text-emerald-50 md:text-base">
                  Review every money movement across TrustPoint Fund Space:
                  MoMo payments, approved contribution records, rejected payment
                  references, system transactions, and provider records.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Link
                  href="/admin/manual-payment-submissions"
                  className="inline-flex min-h-9 items-center justify-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 text-xs font-black text-white ring-1 ring-white/10 transition hover:bg-white/20"
                >
                  MoMo Reviews
                </Link>

                <Link
                  href="/admin/fund-space/contributions"
                  className="inline-flex min-h-9 items-center justify-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 text-xs font-black text-white ring-1 ring-white/10 transition hover:bg-white/20"
                >
                  Contributions
                </Link>

                <Link
                  href="/admin/fund-space/payouts"
                  className="inline-flex min-h-9 items-center justify-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 text-xs font-black text-white ring-1 ring-white/10 transition hover:bg-white/20"
                >
                  Payouts
                </Link>
              </div>
            </div>

            <div className="mt-7 grid auto-rows-fr gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              {summaryItems.map((item) => (
                <SummaryCard key={item.title} item={item} />
              ))}
            </div>

            <div className="mt-3 grid auto-rows-fr gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {valueItems.map((item) => (
                <SummaryCard key={item.title} item={item} />
              ))}
            </div>
          </div>
        </section>

        {message && <MessageBox message={message} />}

        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="space-y-3">
            <div className="relative min-w-0">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search reference, customer, phone, agent, Fund Space..."
                className="min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm font-semibold outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-100"
              />
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1">
              {sourceTabs.map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setSourceFilter(tab.value)}
                  className={`shrink-0 rounded-2xl px-4 py-3 text-xs font-black transition ${
                    sourceFilter === tab.value
                      ? 'bg-emerald-700 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1">
              {statusTabs.map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setStatusFilter(tab.value)}
                  className={`shrink-0 rounded-2xl px-4 py-3 text-xs font-black transition ${
                    statusFilter === tab.value
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <p className="mt-3 rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-600">
            Showing {records.length} transaction records.
          </p>
        </section>

        <section className="space-y-4">
          {records.length === 0 ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
              <Wallet className="mx-auto h-10 w-10 text-slate-300" />
              <h2 className="mt-4 text-lg font-black text-slate-900">
                No transaction records found
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                Try another filter, search term, or refresh the page.
              </p>
            </div>
          ) : (
            records.map((record) => {
              const recordState = getRecordState(record);

              return (
                <article
                  key={`${record.source}-${record.id}`}
                  className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:border-emerald-200 hover:shadow-md"
                >
                  <div className="grid gap-5 p-5 xl:grid-cols-[1fr_280px] xl:items-start">
                    <div className="min-w-0">
                      <div className="flex flex-wrap gap-2">
                        <StatusPill
                          label={getSourceLabel(record.source)}
                          className={getSourceStyle(record.source)}
                        />
                        <StatusPill
                          label={formatLabel(record.status_group)}
                          className={getStatusStyle(record.status_group)}
                        />
                        <StatusPill
                          label={formatLabel(record.status)}
                          className={getStatusStyle(record.status_group)}
                        />
                      </div>

                      <div className="mt-4 flex items-start gap-3">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                          {getSourceIcon(record.source)}
                        </div>

                        <div className="min-w-0">
                          <h2 className="line-clamp-2 break-words text-lg font-black leading-6 text-slate-900">
                            {getTitleText(record)}
                          </h2>

                          <p className="mt-1 line-clamp-2 break-words text-sm font-semibold leading-6 text-slate-500">
                            {getDescriptionText(record)}
                          </p>
                        </div>
                      </div>

                      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        <CompactInfo
                          label="Amount"
                          value={formatCurrency(record.amount)}
                        />

                        <CompactInfo
                          label="Service Fee"
                          value={formatCurrency(record.service_fee)}
                        />

                        <CompactInfo
                          label="Customer"
                          value={record.customer_name || 'Not linked'}
                        />

                        <CompactInfo
                          label="Customer Phone"
                          value={record.customer_phone || 'No phone'}
                        />

                        <CompactInfo
                          label="Agent"
                          value={record.agent_name || 'No agent'}
                        />

                        <CompactInfo
                          label="Fund Space"
                          value={record.fund_space_name || 'Not linked'}
                        />

                        <CompactInfo
                          label="Reference"
                          value={record.reference || 'No reference'}
                        />

                        <CompactInfo
                          label="Date"
                          value={formatDateTime(record.created_at)}
                        />
                      </div>

                      {record.rejection_reason && (
                        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4">
                          <p className="text-xs font-black uppercase tracking-wide text-red-500">
                            Rejection / Failure Reason
                          </p>
                          <p className="mt-2 whitespace-pre-wrap break-words text-sm font-semibold leading-6 text-red-700 [overflow-wrap:anywhere]">
                            {record.rejection_reason}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                      <p className="mb-4 text-sm font-black text-slate-900">
                        Transaction Actions
                      </p>

                      <div
                        className={`mb-4 rounded-2xl border p-4 ${recordState.className}`}
                      >
                        <p className="break-words text-sm font-black [overflow-wrap:anywhere]">
                          {recordState.title}
                        </p>
                        <p className="mt-1 break-words text-xs font-semibold leading-5 [overflow-wrap:anywhere]">
                          {recordState.description}
                        </p>
                      </div>

                      <div className="grid gap-3">
                        <button
                          type="button"
                          onClick={() => setSelectedRecord(record)}
                          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-4 text-sm font-black text-white hover:bg-emerald-800"
                        >
                          <Eye className="h-4 w-4" />
                          View Details
                        </button>

                        {record.action_href && (
                          <Link
                            href={record.action_href}
                            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-center text-sm font-black text-slate-700 hover:bg-slate-50"
                          >
                            <span className="min-w-0 break-words [overflow-wrap:anywhere]">
                              {getActionLabel(record.action_label)}
                            </span>
                            <ArrowRight className="h-4 w-4 shrink-0" />
                          </Link>
                        )}

                        {record.source === 'MANUAL_PAYMENT' &&
                          record.status_group === 'PENDING' && (
                            <Link
                              href="/admin/manual-payment-submissions?status=PENDING_REVIEW"
                              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 text-center text-sm font-black text-amber-700 hover:bg-amber-100"
                            >
                              <Smartphone className="h-4 w-4 shrink-0" />
                              <span className="min-w-0 break-words">
                                Review MoMo Payment
                              </span>
                            </Link>
                          )}

                        {record.fund_space_id && (
                          <Link
                            href={`/admin/fund-space/${record.fund_space_id}`}
                            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 text-center text-sm font-black text-emerald-700 hover:bg-emerald-100"
                          >
                            <span>Open Fund Space</span>
                            <ArrowRight className="h-4 w-4 shrink-0" />
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </section>
      </div>

      {selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-3 py-4">
          <div className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
              <div className="min-w-0">
                <h2 className="break-words text-lg font-black text-slate-900">
                  Transaction Details
                </h2>
                <p className="mt-1 break-words text-sm text-slate-500 [overflow-wrap:anywhere]">
                  {selectedRecord.reference || selectedRecord.id}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedRecord(null)}
                className="rounded-2xl p-2 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5">
              <div className="mb-5 flex flex-wrap gap-2">
                <StatusPill
                  label={getSourceLabel(selectedRecord.source)}
                  className={getSourceStyle(selectedRecord.source)}
                />
                <StatusPill
                  label={formatLabel(selectedRecord.status_group)}
                  className={getStatusStyle(selectedRecord.status_group)}
                />
                <StatusPill
                  label={formatLabel(selectedRecord.status)}
                  className={getStatusStyle(selectedRecord.status_group)}
                />
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="break-words text-sm font-black text-slate-900 [overflow-wrap:anywhere]">
                  {getTitleText(selectedRecord)}
                </p>
                <p className="mt-2 whitespace-pre-wrap break-words text-sm font-semibold leading-6 text-slate-600 [overflow-wrap:anywhere]">
                  {getDescriptionText(selectedRecord)}
                </p>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <CompactInfo label="Transaction ID" value={selectedRecord.id} />

                <CompactInfo
                  label="Source"
                  value={getSourceLabel(selectedRecord.source)}
                />

                <CompactInfo
                  label="Status"
                  value={formatLabel(selectedRecord.status)}
                />

                <CompactInfo
                  label="Amount"
                  value={formatCurrency(selectedRecord.amount)}
                />

                <CompactInfo
                  label="Service Fee"
                  value={formatCurrency(selectedRecord.service_fee)}
                />

                <CompactInfo
                  label="Direction"
                  value={
                    <span className="inline-flex min-w-0 flex-wrap items-center gap-2">
                      {getDirectionIcon(selectedRecord.direction)}
                      <span className="break-words">
                        {formatLabel(selectedRecord.direction)}
                      </span>
                    </span>
                  }
                />

                <CompactInfo
                  label="Channel"
                  value={formatLabel(selectedRecord.channel)}
                />

                <CompactInfo label="Reference" value={selectedRecord.reference} />

                <CompactInfo
                  label="Secondary Reference"
                  value={selectedRecord.secondary_reference || 'Not set'}
                />

                <CompactInfo
                  label="Customer"
                  value={selectedRecord.customer_name || 'Not linked'}
                />

                <CompactInfo
                  label="Customer Phone"
                  value={selectedRecord.customer_phone || 'No phone'}
                />

                <CompactInfo
                  label="Agent"
                  value={selectedRecord.agent_name || 'No agent'}
                />

                <CompactInfo
                  label="Fund Space"
                  value={selectedRecord.fund_space_name || 'Not linked'}
                />

                <CompactInfo
                  label="Contribution ID"
                  value={selectedRecord.contribution_id || 'Not linked'}
                />

                <CompactInfo
                  label="Created"
                  value={formatDateTime(selectedRecord.created_at)}
                />
              </div>

              {selectedRecord.rejection_reason && (
                <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4">
                  <p className="text-xs font-black uppercase tracking-wide text-red-500">
                    Rejection / Failure Reason
                  </p>
                  <p className="mt-2 whitespace-pre-wrap break-words text-sm font-semibold leading-6 text-red-700 [overflow-wrap:anywhere]">
                    {selectedRecord.rejection_reason}
                  </p>
                </div>
              )}

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {selectedRecord.action_href && (
                  <Link
                    href={selectedRecord.action_href}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-4 text-center text-sm font-black text-white hover:bg-emerald-800"
                  >
                    <span className="min-w-0 break-words [overflow-wrap:anywhere]">
                      {getActionLabel(selectedRecord.action_label)}
                    </span>
                    <ArrowRight className="h-4 w-4 shrink-0" />
                  </Link>
                )}

                {selectedRecord.fund_space_id && (
                  <Link
                    href={`/admin/fund-space/${selectedRecord.fund_space_id}`}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-center text-sm font-black text-slate-700 hover:bg-slate-50"
                  >
                    <span>Open Fund Space</span>
                    <ArrowRight className="h-4 w-4 shrink-0" />
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}