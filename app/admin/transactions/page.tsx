'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
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
  UserRound,
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

type SelectedUser = {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  role: string | null;
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

function formatCurrency(amount: number | string | null | undefined) {
  return `GH₵${Number(amount || 0).toLocaleString('en-GH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDateTime(dateString: string | null | undefined) {
  if (!dateString) return 'Not set';

  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) {
    return 'Invalid date';
  }

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

function getStatusStyle(statusGroup: string) {
  if (statusGroup === 'SUCCESSFUL') {
    return 'border-emerald-100 bg-emerald-50 text-emerald-700';
  }

  if (statusGroup === 'PENDING') {
    return 'border-amber-100 bg-amber-50 text-amber-700';
  }

  if (statusGroup === 'FAILED') {
    return 'border-red-100 bg-red-50 text-red-700';
  }

  return 'border-gray-100 bg-gray-50 text-gray-700';
}

function getSourceStyle(source: AdminTransactionRecord['source']) {
  if (source === 'MANUAL_PAYMENT') {
    return 'border-emerald-100 bg-emerald-50 text-emerald-700';
  }

  if (source === 'SYSTEM_TRANSACTION') {
    return 'border-blue-100 bg-blue-50 text-blue-700';
  }

  return 'border-purple-100 bg-purple-50 text-purple-700';
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

function getDirectionIcon(direction: string) {
  const value = String(direction || '').toUpperCase();

  if (['CREDIT', 'INCOMING'].includes(value)) {
    return <TrendingUp className="h-4 w-4" />;
  }

  if (['DEBIT', 'OUTGOING'].includes(value)) {
    return <TrendingDown className="h-4 w-4" />;
  }

  return <Wallet className="h-4 w-4" />;
}

function buildStats(records: AdminTransactionRecord[]): TransactionStats {
  return records.reduce<TransactionStats>(
    (stats, record) => {
      const amount = Number(record.amount || 0);

      stats.total_records += 1;

      if (record.source === 'MANUAL_PAYMENT') {
        stats.manual_payment_records += 1;

        if (record.status_group === 'PENDING') {
          stats.momo_awaiting_review += 1;
        }

        if (record.status_group === 'FAILED') {
          stats.momo_rejected += 1;
          stats.rejected_value += amount;
        }

        if (record.status_group === 'SUCCESSFUL') {
          stats.momo_approved += 1;
        }
      }

      if (record.source === 'SYSTEM_TRANSACTION') {
        stats.system_transactions += 1;

        if (record.status_group === 'SUCCESSFUL') {
          stats.successful_system_value += amount;
        }
      }

      if (record.source === 'PROVIDER_TRANSACTION') {
        stats.provider_attempts += 1;
      }

      if (record.status_group === 'PENDING') {
        stats.pending_value += amount;
      }

      return stats;
    },
    { ...defaultStats }
  );
}

function isRecordForSelectedUser(
  record: AdminTransactionRecord,
  selectedUserId: string
) {
  return (
    record.customer_id === selectedUserId ||
    record.agent_id === selectedUserId
  );
}

function buildUrl(params: {
  source?: TransactionSource;
  statusGroup?: StatusGroup;
  search?: string;
  user?: string | null;
}) {
  const query = new URLSearchParams();

  if (params.user?.trim()) {
    query.set('user', params.user.trim());
  }

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

function StatCard({
  title,
  value,
  description,
  icon,
  href,
}: {
  title: string;
  value: string | number;
  description: string;
  icon: ReactNode;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group block rounded-3xl border border-gray-100 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md md:p-6"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-gray-500">{title}</p>
          <h3 className="mt-2 text-2xl font-black text-gray-900 md:text-3xl">
            {value}
          </h3>
          <p className="mt-1 text-sm leading-6 text-gray-500">{description}</p>
          <p className="mt-3 inline-flex items-center gap-1 text-xs font-black text-emerald-700 opacity-0 transition group-hover:opacity-100">
            Open filtered records <ArrowRight className="h-3.5 w-3.5" />
          </p>
        </div>

        <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-700 transition group-hover:bg-emerald-600 group-hover:text-white">
          {icon}
        </div>
      </div>
    </Link>
  );
}

export default function AdminTransactionsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [records, setRecords] = useState<AdminTransactionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState('');

  const [sourceFilter, setSourceFilter] = useState<TransactionSource>('ALL');
  const [statusFilter, setStatusFilter] = useState<StatusGroup>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<SelectedUser | null>(null);

  const selectedUserId = searchParams.get('user')?.trim() || '';

  const getToken = async () => {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error || !session?.access_token) {
      throw new Error('Your session has expired. Please log in again.');
    }

    return session.access_token;
  };

  const syncFiltersFromUrl = useCallback(() => {
    const urlSource = String(searchParams.get('source') || 'ALL').toUpperCase();
    const urlStatusGroup = String(
      searchParams.get('statusGroup') || 'ALL'
    ).toUpperCase();
    const urlSearch = searchParams.get('search') || '';

    const sources: TransactionSource[] = [
      'ALL',
      'MANUAL_PAYMENT',
      'SYSTEM_TRANSACTION',
      'PROVIDER_TRANSACTION',
    ];

    const statuses: StatusGroup[] = [
      'ALL',
      'SUCCESSFUL',
      'PENDING',
      'FAILED',
      'OTHER',
    ];

    setSourceFilter(
      sources.includes(urlSource as TransactionSource)
        ? (urlSource as TransactionSource)
        : 'ALL'
    );

    setStatusFilter(
      statuses.includes(urlStatusGroup as StatusGroup)
        ? (urlStatusGroup as StatusGroup)
        : 'ALL'
    );

    setSearchTerm(urlSearch);
  }, [searchParams]);

  const loadSelectedUser = useCallback(
    async (userId: string) => {
      if (!userId) {
        setSelectedUser(null);
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, phone, email, role')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.warn('Selected user profile lookup warning:', error.message);
        setSelectedUser({
          id: userId,
          full_name: null,
          phone: null,
          email: null,
          role: null,
        });
        return;
      }

      setSelectedUser((data || {
        id: userId,
        full_name: null,
        phone: null,
        email: null,
        role: null,
      }) as SelectedUser);
    },
    []
  );

  const loadRecords = useCallback(
    async (showRefresh = false) => {
      try {
        if (showRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setMessage('');

        const token = await getToken();

        const params = new URLSearchParams();

        const urlUser = searchParams.get('user');
        const urlSource = searchParams.get('source');
        const urlStatusGroup = searchParams.get('statusGroup');
        const urlSearch = searchParams.get('search');

        if (urlUser) params.set('user', urlUser);
        if (urlSource) params.set('source', urlSource);
        if (urlStatusGroup) params.set('statusGroup', urlStatusGroup);
        if (urlSearch) params.set('search', urlSearch);

        await loadSelectedUser(urlUser || '');

        const response = await fetch(
          `/api/admin/transactions?${params.toString()}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const result = (await response.json()) as ApiResponse;

        if (!response.ok || !result.success) {
          throw new Error(result.message || 'Could not load transaction records.');
        }

        const loadedRecords = result.records || [];

        setRecords(loadedRecords);
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : 'Something went wrong while loading transaction records.'
        );
        setRecords([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [searchParams, loadSelectedUser]
  );

  useEffect(() => {
    syncFiltersFromUrl();
    loadRecords();
  }, [syncFiltersFromUrl, loadRecords]);

  const scopedRecords = useMemo(() => {
    if (!selectedUserId) return records;

    return records.filter((record) =>
      isRecordForSelectedUser(record, selectedUserId)
    );
  }, [records, selectedUserId]);

  const visibleRecords = useMemo(() => {
    const searchValue = searchTerm.trim().toLowerCase();

    if (!searchValue) return scopedRecords;

    return scopedRecords.filter((item) => {
      return [
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
        item.rejection_reason,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(searchValue);
    });
  }, [scopedRecords, searchTerm]);

  const stats = useMemo(() => buildStats(scopedRecords), [scopedRecords]);

  function applyFilters(next: {
    source?: TransactionSource;
    statusGroup?: StatusGroup;
    search?: string;
  }) {
    router.push(
      buildUrl({
        user: selectedUserId || null,
        source: next.source ?? sourceFilter,
        statusGroup: next.statusGroup ?? statusFilter,
        search: next.search ?? searchTerm,
      })
    );
  }

  function submitSearch() {
    applyFilters({
      search: searchTerm,
    });
  }

  function clearUserScope() {
    router.push(
      buildUrl({
        source: sourceFilter,
        statusGroup: statusFilter,
        search: searchTerm,
        user: null,
      })
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto h-10 w-10 animate-spin text-emerald-600" />
          <p className="mt-4 text-sm font-medium text-gray-500">
            Loading transaction records...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="rounded-3xl bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-600 p-6 text-white shadow-sm md:p-8">
        <div className="flex flex-col justify-between gap-6 xl:flex-row xl:items-center">
          <div className="max-w-4xl">
            <p className="mb-3 inline-flex rounded-full bg-white/15 px-4 py-1 text-sm font-semibold">
              Admin Transaction Center
            </p>

            <h1 className="text-3xl font-black md:text-4xl">
              {selectedUserId
                ? 'Selected User Transaction Records'
                : 'Manual MoMo, system transactions, and provider attempts'}
            </h1>

            <p className="mt-4 max-w-3xl text-sm leading-7 text-emerald-50 md:text-base">
              {selectedUserId
                ? 'This page is showing transaction records connected to the selected user only.'
                : 'Monitor all important TrustPoint transaction records from one place. Manual MoMo records are shown for admin review, confirmed system transactions show actual money movement, and provider attempts are shown for tracking only.'}
            </p>

            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href="/admin/users"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-bold text-emerald-700 hover:bg-emerald-50"
              >
                <ArrowLeft size={16} />
                Back to Users
              </Link>

              <Link
                href="/admin"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white/15 px-4 text-sm font-bold text-white ring-1 ring-white/20 hover:bg-white/20"
              >
                Admin Dashboard
                <ArrowRight size={16} />
              </Link>
            </div>
          </div>

          <button
            type="button"
            onClick={() => loadRecords(true)}
            disabled={refreshing}
            className="inline-flex min-h-12 w-fit items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw
              className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`}
            />
            Refresh
          </button>
        </div>
      </div>

      {selectedUserId && (
        <section className="rounded-3xl border border-emerald-100 bg-emerald-50 p-5 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-emerald-600 p-3 text-white">
                <UserRound className="h-5 w-5" />
              </div>

              <div>
                <p className="text-xs font-black uppercase tracking-wide text-emerald-700">
                  Viewing one user only
                </p>
                <h2 className="mt-1 text-xl font-black text-emerald-950">
                  {selectedUser?.full_name || 'Selected User'}
                </h2>
                <p className="mt-1 text-sm font-semibold text-emerald-700">
                  {selectedUser?.phone || 'No phone'} •{' '}
                  {selectedUser?.email || 'No email'} •{' '}
                  {formatLabel(selectedUser?.role || 'USER')}
                </p>
                <p className="mt-1 text-xs text-emerald-700">
                  User ID: {selectedUserId}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={clearUserScope}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-white px-4 text-sm font-black text-emerald-700 hover:bg-emerald-100"
            >
              <X className="h-4 w-4" />
              Show All Transactions
            </button>
          </div>
        </section>
      )}

      {message && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-700">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <p>{message}</p>
        </div>
      )}

      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total Records"
          value={stats.total_records}
          description={
            selectedUserId
              ? 'Records connected to selected user'
              : 'All transaction-related records'
          }
          icon={<Wallet className="h-5 w-5" />}
          href={buildUrl({
            user: selectedUserId || null,
            source: 'ALL',
            statusGroup: 'ALL',
          })}
        />

        <StatCard
          title="MoMo Awaiting Review"
          value={stats.momo_awaiting_review}
          description="Manual MoMo references waiting for admin"
          icon={<Clock className="h-5 w-5" />}
          href={buildUrl({
            user: selectedUserId || null,
            source: 'MANUAL_PAYMENT',
            statusGroup: 'PENDING',
          })}
        />

        <StatCard
          title="Manual MoMo Records"
          value={stats.manual_payment_records}
          description="All manual payment submissions"
          icon={<Smartphone className="h-5 w-5" />}
          href={buildUrl({
            user: selectedUserId || null,
            source: 'MANUAL_PAYMENT',
            statusGroup: 'ALL',
          })}
        />

        <StatCard
          title="Rejected MoMo"
          value={stats.momo_rejected}
          description="Rejected manual payment submissions"
          icon={<XCircle className="h-5 w-5" />}
          href={buildUrl({
            user: selectedUserId || null,
            source: 'MANUAL_PAYMENT',
            statusGroup: 'FAILED',
          })}
        />

        <StatCard
          title="Approved MoMo"
          value={stats.momo_approved}
          description="Approved or confirmed manual payments"
          icon={<CheckCircle2 className="h-5 w-5" />}
          href={buildUrl({
            user: selectedUserId || null,
            source: 'MANUAL_PAYMENT',
            statusGroup: 'SUCCESSFUL',
          })}
        />

        <StatCard
          title="System Transactions"
          value={stats.system_transactions}
          description="Confirmed TrustPoint money movement"
          icon={<Wallet className="h-5 w-5" />}
          href={buildUrl({
            user: selectedUserId || null,
            source: 'SYSTEM_TRANSACTION',
            statusGroup: 'ALL',
          })}
        />

        <StatCard
          title="Provider Attempts"
          value={stats.provider_attempts}
          description="Paystack/payment gateway tracking records"
          icon={<CreditCard className="h-5 w-5" />}
          href={buildUrl({
            user: selectedUserId || null,
            source: 'PROVIDER_TRANSACTION',
            statusGroup: 'ALL',
          })}
        />

        <StatCard
          title="Confirmed Value"
          value={formatCurrency(stats.successful_system_value)}
          description="Successful system transaction value only"
          icon={<TrendingUp className="h-5 w-5" />}
          href={buildUrl({
            user: selectedUserId || null,
            source: 'SYSTEM_TRANSACTION',
            statusGroup: 'SUCCESSFUL',
          })}
        />
      </section>

      <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="relative w-full xl:max-w-md">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />

            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  submitSearch();
                }
              }}
              placeholder="Search customer, phone, reference, Fund Space..."
              className="w-full rounded-2xl border border-gray-200 bg-gray-50 py-3 pl-11 pr-4 text-sm outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-50"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {(
              [
                ['ALL', 'All'],
                ['MANUAL_PAYMENT', 'Manual MoMo'],
                ['SYSTEM_TRANSACTION', 'System'],
                ['PROVIDER_TRANSACTION', 'Provider'],
              ] as [TransactionSource, string][]
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => applyFilters({ source: value })}
                className={`rounded-xl px-4 py-2.5 text-sm font-black transition ${
                  sourceFilter === value
                    ? 'bg-emerald-600 text-white shadow-sm hover:bg-emerald-700'
                    : 'border border-gray-100 bg-gray-50 text-gray-600 hover:bg-gray-100'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            {(
              [
                ['ALL', 'All Status'],
                ['SUCCESSFUL', 'Successful'],
                ['PENDING', 'Pending'],
                ['FAILED', 'Failed'],
                ['OTHER', 'Other'],
              ] as [StatusGroup, string][]
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => applyFilters({ statusGroup: value })}
                className={`rounded-xl px-4 py-2.5 text-sm font-black transition ${
                  statusFilter === value
                    ? 'bg-slate-900 text-white shadow-sm hover:bg-slate-800'
                    : 'border border-gray-100 bg-gray-50 text-gray-600 hover:bg-gray-100'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-gray-100 bg-white shadow-sm">
        <div className="border-b border-gray-100 p-5">
          <h2 className="text-xl font-black text-gray-900">
            Transaction Records
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Showing {visibleRecords.length} of {scopedRecords.length} records
            {selectedUserId ? ' for the selected user.' : '.'}
          </p>
        </div>

        {visibleRecords.length === 0 ? (
          <div className="p-8 text-center">
            <Wallet className="mx-auto mb-3 h-10 w-10 text-gray-300" />
            <h3 className="text-lg font-black text-gray-900">
              No transaction records found
            </h3>
            <p className="mt-2 text-sm text-gray-500">
              Try changing the filters or refreshing the page.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {visibleRecords.map((record) => (
              <div key={`${record.source}-${record.id}`} className="p-5">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="flex items-start gap-4">
                    <div
                      className={`rounded-2xl border p-3 ${getSourceStyle(
                        record.source
                      )}`}
                    >
                      {getSourceIcon(record.source)}
                    </div>

                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-black text-gray-900">
                          {record.title}
                        </h3>

                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-black ${getStatusStyle(
                            record.status_group
                          )}`}
                        >
                          {formatLabel(record.status)}
                        </span>
                      </div>

                      <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-500">
                        {record.description}
                      </p>

                      <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold text-gray-500">
                        <span>Customer: {record.customer_name || 'Not set'}</span>
                        <span>•</span>
                        <span>Phone: {record.customer_phone || 'Not set'}</span>
                        {record.agent_name && (
                          <>
                            <span>•</span>
                            <span>Agent: {record.agent_name}</span>
                          </>
                        )}
                        {record.fund_space_name && (
                          <>
                            <span>•</span>
                            <span>{record.fund_space_name}</span>
                          </>
                        )}
                      </div>

                      <div className="mt-3 grid gap-2 text-xs text-gray-500 sm:grid-cols-2 xl:grid-cols-4">
                        <p>
                          <span className="font-bold text-gray-700">Ref:</span>{' '}
                          {record.reference || 'Not set'}
                        </p>
                        <p>
                          <span className="font-bold text-gray-700">
                            Secondary:
                          </span>{' '}
                          {record.secondary_reference || 'Not set'}
                        </p>
                        <p>
                          <span className="font-bold text-gray-700">
                            Channel:
                          </span>{' '}
                          {formatLabel(record.channel)}
                        </p>
                        <p>
                          <span className="font-bold text-gray-700">Date:</span>{' '}
                          {formatDateTime(record.created_at)}
                        </p>
                      </div>

                      {record.rejection_reason && (
                        <div className="mt-3 rounded-2xl border border-red-100 bg-red-50 p-3 text-xs font-semibold text-red-700">
                          Rejection reason: {record.rejection_reason}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 xl:min-w-[220px] xl:items-end">
                    <div className="text-left xl:text-right">
                      <p className="text-xs font-bold uppercase tracking-wide text-gray-400">
                        Amount
                      </p>
                      <p className="mt-1 text-2xl font-black text-gray-900">
                        {formatCurrency(record.amount)}
                      </p>
                      {Number(record.service_fee || 0) > 0 && (
                        <p className="text-xs font-semibold text-gray-500">
                          Fee: {formatCurrency(record.service_fee)}
                        </p>
                      )}
                    </div>

                    <div className="inline-flex items-center gap-2 rounded-full border border-gray-100 bg-gray-50 px-3 py-1 text-xs font-black text-gray-600">
                      {getDirectionIcon(record.direction)}
                      {formatLabel(record.direction)}
                    </div>

                    {record.action_href && (
                      <Link
                        href={record.action_href}
                        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-xs font-black text-white hover:bg-emerald-700"
                      >
                        <Eye className="h-4 w-4" />
                        {record.action_label || 'View'}
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}