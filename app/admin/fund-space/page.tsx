'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  AlertCircle,
  ArrowRight,
  Banknote,
  BellRing,
  CheckCircle2,
  Clock,
  HandCoins,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  Users,
} from 'lucide-react';

import { supabase } from '@/lib/supabase/client';

type FundSpaceOverviewRow = {
  id: string | null;
  name: string | null;
  status: string | null;
  contribution_amount: number | string | null;
  member_count: number | string | null;
  member_limit: number | string | null;
  current_round_number: number | string | null;
  members_paid_out: number | string | null;
  defaulted_members: number | string | null;
  start_date: string | null;
  created_at: string | null;
};

type AdminProfile = {
  id: string;
  role: string | null;
  status: string | null;
  is_blacklisted: boolean | null;
};

type FundSpaceAction =
  | 'SEND_DEADLINE_REMINDERS'
  | 'PROCESS_DUE_ROUNDS'
  | 'START_NEXT_ROUND';

type Message = {
  type: 'success' | 'error' | 'info';
  text: string;
};

type OverviewStats = {
  total_groups: number;
  active_groups: number;
  forming_groups: number;
  completed_groups: number;
  paused_groups: number;
  cancelled_groups: number;
  total_members: number;
  paid_out_members: number;
  waiting_members: number;
  defaulted_members: number;
  weekly_volume: number;
};

type SummaryLinkItem = {
  label: string;
  value: string | number;
  helper?: string;
  href: string;
};

const statusTabs = [
  { label: 'All', value: 'ALL', href: '/admin/fund-space' },
  { label: 'Active', value: 'ACTIVE', href: '/admin/fund-space?status=ACTIVE' },
  { label: 'Forming', value: 'FORMING', href: '/admin/fund-space?status=FORMING' },
  {
    label: 'Completed',
    value: 'COMPLETED',
    href: '/admin/fund-space?status=COMPLETED',
  },
  { label: 'Paused', value: 'PAUSED', href: '/admin/fund-space?status=PAUSED' },
  {
    label: 'Cancelled',
    value: 'CANCELLED',
    href: '/admin/fund-space?status=CANCELLED',
  },
];

const emptyStats: OverviewStats = {
  total_groups: 0,
  active_groups: 0,
  forming_groups: 0,
  completed_groups: 0,
  paused_groups: 0,
  cancelled_groups: 0,
  total_members: 0,
  paid_out_members: 0,
  waiting_members: 0,
  defaulted_members: 0,
  weekly_volume: 0,
};

function normalize(value: string | null | undefined) {
  return String(value || '').trim().toUpperCase();
}

function isAdminRole(role: string | null | undefined) {
  const value = normalize(role);
  return value === 'ADMIN' || value === 'SUPER_ADMIN';
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

function formatNumber(value: number | string | null | undefined) {
  return toNumber(value).toLocaleString('en-GH');
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

function formatLabel(value: string | null | undefined) {
  if (!value) return 'Not set';

  return value
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusClass(status: string | null | undefined) {
  const value = normalize(status);

  if (value === 'ACTIVE') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }

  if (value === 'FORMING') {
    return 'border-amber-200 bg-amber-50 text-amber-700';
  }

  if (value === 'COMPLETED') {
    return 'border-blue-200 bg-blue-50 text-blue-700';
  }

  if (value === 'PAUSED') {
    return 'border-purple-200 bg-purple-50 text-purple-700';
  }

  if (['DEFAULTED', 'CANCELLED', 'FAILED'].includes(value)) {
    return 'border-red-200 bg-red-50 text-red-700';
  }

  return 'border-slate-200 bg-slate-50 text-slate-700';
}

function getProgress(
  memberCount: number | string | null | undefined,
  memberLimit: number | string | null | undefined
) {
  const count = toNumber(memberCount);
  const limit = toNumber(memberLimit);

  if (limit <= 0) return 0;

  return Math.min(Math.round((count / limit) * 100), 100);
}

function calculateStats(rows: FundSpaceOverviewRow[]): OverviewStats {
  const stats = rows.reduce<OverviewStats>(
    (acc, row) => {
      const status = normalize(row.status);
      const memberCount = toNumber(row.member_count);
      const paidOutMembers = toNumber(row.members_paid_out);
      const contributionAmount = toNumber(row.contribution_amount);

      acc.total_groups += 1;
      acc.total_members += memberCount;
      acc.paid_out_members += paidOutMembers;
      acc.defaulted_members += toNumber(row.defaulted_members);
      acc.weekly_volume += contributionAmount * memberCount;

      if (status === 'ACTIVE') acc.active_groups += 1;
      if (status === 'FORMING') acc.forming_groups += 1;
      if (status === 'COMPLETED') acc.completed_groups += 1;
      if (status === 'PAUSED') acc.paused_groups += 1;
      if (status === 'CANCELLED') acc.cancelled_groups += 1;

      return acc;
    },
    { ...emptyStats }
  );

  stats.waiting_members = Math.max(
    stats.total_members - stats.paid_out_members,
    0
  );

  return stats;
}

function SummaryItem({ item }: { item: SummaryLinkItem }) {
  return (
    <Link
      href={item.href}
      className="group min-w-0 rounded-2xl border border-white/70 bg-white/10 p-4 text-white transition hover:-translate-y-0.5 hover:bg-white/20 hover:shadow-lg"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-[11px] font-black uppercase tracking-wide text-emerald-50/90">
          {item.label}
        </p>

        <ArrowRight className="h-4 w-4 shrink-0 text-emerald-50/80 transition group-hover:translate-x-0.5" />
      </div>

      <p className="mt-2 truncate text-2xl font-black text-white md:text-3xl">
        {item.value}
      </p>

      {item.helper && (
        <p className="mt-1 truncate text-xs font-semibold text-emerald-50/80">
          {item.helper}
        </p>
      )}
    </Link>
  );
}

function MessageBox({ message }: { message: Message }) {
  const isSuccess = message.type === 'success';
  const isInfo = message.type === 'info';

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
        <p className="min-w-0 break-words leading-6">{message.text}</p>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string | null | undefined }) {
  return (
    <span
      className={`inline-flex max-w-full rounded-full border px-3 py-1 text-xs font-black ${statusClass(
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
  value: string | number;
}) {
  return (
    <div className="min-w-0">
      <p className="truncate text-[11px] font-black uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="truncate text-sm font-black text-slate-900">{value}</p>
    </div>
  );
}

export default function AdminFundSpacePage() {
  const searchParams = useSearchParams();

  const [adminProfile, setAdminProfile] = useState<AdminProfile | null>(null);
  const [fundSpaces, setFundSpaces] = useState<FundSpaceOverviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [actionMessage, setActionMessage] = useState<Message | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  useEffect(() => {
    const urlStatus = normalize(searchParams.get('status'));

    if (
      ['ACTIVE', 'FORMING', 'COMPLETED', 'PAUSED', 'CANCELLED'].includes(
        urlStatus
      )
    ) {
      setStatusFilter(urlStatus);
    } else {
      setStatusFilter('ALL');
    }
  }, [searchParams]);

  useEffect(() => {
    loadOverview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function checkAdminAccess() {
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session?.user) {
      throw new Error('Your session has expired. Please log in again.');
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('id, role, status, is_blacklisted')
      .eq('id', session.user.id)
      .maybeSingle();

    if (error || !data) {
      throw new Error('Admin profile could not be found.');
    }

    const profile = data as AdminProfile;

    if (!isAdminRole(profile.role)) {
      throw new Error('Only admins and super admins can access this page.');
    }

    if (normalize(profile.status) !== 'ACTIVE') {
      throw new Error('Your admin account must be active.');
    }

    if (profile.is_blacklisted) {
      throw new Error('This admin account cannot access Fund Space management.');
    }

    setAdminProfile(profile);
    return profile;
  }

  async function loadOverview(showRefreshState = false) {
    try {
      if (showRefreshState) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setErrorMessage('');
      await checkAdminAccess();

      const { data, error } = await supabase
        .from('admin_fund_space_overview')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setFundSpaces((data || []) as FundSpaceOverviewRow[]);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to load Fund Space overview.'
      );
      setFundSpaces([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function runFundSpaceAction(
    action: FundSpaceAction,
    payload?: { fund_space_id?: string }
  ) {
    try {
      const confirmation =
        action === 'SEND_DEADLINE_REMINDERS'
          ? 'Send reminders to unpaid members?'
          : action === 'PROCESS_DUE_ROUNDS'
            ? 'Process due rounds now? This may mark unpaid contributions as overdue.'
            : 'Start the next round for this Fund Space?';

      if (!window.confirm(confirmation)) return;

      const loadingKey = payload?.fund_space_id
        ? `${action}_${payload.fund_space_id}`
        : action;

      setActionLoading(loadingKey);
      setActionMessage(null);
      setErrorMessage('');

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.access_token) {
        throw new Error('Your session has expired. Please log in again.');
      }

      const response = await fetch('/api/admin/fund-space/overview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ action, ...payload }),
      });

      const rawText = await response.text();
      const contentType = response.headers.get('content-type') || '';

      if (!contentType.includes('application/json')) {
        throw new Error(
          `Server returned a non-JSON response. Status: ${response.status}`
        );
      }

      const result = rawText
        ? (JSON.parse(rawText) as { success?: boolean; message?: string })
        : {};

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Fund Space action failed.');
      }

      setActionMessage({
        type: 'success',
        text: result.message || 'Action completed successfully.',
      });

      await loadOverview(true);
    } catch (error) {
      setActionMessage({
        type: 'error',
        text:
          error instanceof Error ? error.message : 'Unable to complete action.',
      });
    } finally {
      setActionLoading(null);
    }
  }

  const stats = useMemo(() => calculateStats(fundSpaces), [fundSpaces]);

  const topSummaryItems: SummaryLinkItem[] = [
    {
      label: 'Total Groups',
      value: stats.total_groups,
      helper: `${stats.active_groups} active`,
      href: '/admin/fund-space',
    },
    {
      label: 'Total Members',
      value: stats.total_members,
      helper: 'All joined members',
      href: '/admin/fund-space?focus=members',
    },
    {
      label: 'Paid Out',
      value: stats.paid_out_members,
      helper: 'Members paid',
      href: '/admin/fund-space?focus=paid-out',
    },
    {
      label: 'Waiting',
      value: stats.waiting_members,
      helper: 'Awaiting payout',
      href: '/admin/fund-space?focus=waiting',
    },
    {
      label: 'Defaulted',
      value: stats.defaulted_members,
      helper: 'Need attention',
      href: '/admin/fund-space?focus=defaulted',
    },
    {
      label: 'Weekly Volume',
      value: formatCurrency(stats.weekly_volume),
      helper: 'Expected weekly',
      href: '/admin/fund-space/contributions',
    },
  ];

  const statusSummaryItems: SummaryLinkItem[] = [
    {
      label: 'Forming',
      value: stats.forming_groups,
      href: '/admin/fund-space?status=FORMING',
    },
    {
      label: 'Completed',
      value: stats.completed_groups,
      href: '/admin/fund-space?status=COMPLETED',
    },
    {
      label: 'Paused',
      value: stats.paused_groups,
      href: '/admin/fund-space?status=PAUSED',
    },
    {
      label: 'Cancelled',
      value: stats.cancelled_groups,
      href: '/admin/fund-space?status=CANCELLED',
    },
  ];

  const filteredFundSpaces = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return fundSpaces.filter((item) => {
      const status = normalize(item.status);
      const matchesStatus = statusFilter === 'ALL' || status === statusFilter;

      const haystack = [
        item.id,
        item.name,
        item.status,
        item.current_round_number,
        item.contribution_amount,
        item.member_count,
        item.member_limit,
        item.members_paid_out,
        item.defaulted_members,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      const matchesSearch = !query || haystack.includes(query);

      return matchesStatus && matchesSearch;
    });
  }, [fundSpaces, searchTerm, statusFilter]);

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-6">
        <div className="mx-auto flex min-h-[60vh] max-w-6xl items-center justify-center">
          <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-emerald-700" />
            <p className="mt-4 text-sm font-black text-slate-600">
              Loading Fund Space groups...
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (!adminProfile && errorMessage) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-6">
        <div className="mx-auto max-w-3xl rounded-3xl border border-red-200 bg-red-50 p-6 text-red-700">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="min-w-0">
              <h1 className="text-lg font-black">
                Unable to load Fund Space management
              </h1>
              <p className="mt-2 break-words text-sm font-semibold">
                {errorMessage}
              </p>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-5 md:px-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <section className="overflow-hidden rounded-[2rem] bg-gradient-to-br from-emerald-950 via-emerald-900 to-emerald-800 text-white shadow-sm">
          <div className="p-5 md:p-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <p className="inline-flex rounded-full bg-white/15 px-4 py-2 text-xs font-black">
                  Admin Fund Space
                </p>

                <h1 className="mt-5 text-3xl font-black tracking-tight md:text-5xl">
                  Fund Space Control Center
                </h1>

                <p className="mt-4 max-w-3xl text-sm font-semibold leading-7 text-emerald-50 md:text-base">
                  One simple control page for groups, members, rounds,
                  contributions, payouts, and admin actions.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => runFundSpaceAction('SEND_DEADLINE_REMINDERS')}
                  disabled={actionLoading === 'SEND_DEADLINE_REMINDERS'}
                  className="inline-flex min-h-9 items-center justify-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 text-xs font-black text-white ring-1 ring-white/10 transition hover:bg-white/20 disabled:opacity-60"
                >
                  {actionLoading === 'SEND_DEADLINE_REMINDERS' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <BellRing className="h-3.5 w-3.5" />
                  )}
                  Remind
                </button>

                <button
                  type="button"
                  onClick={() => runFundSpaceAction('PROCESS_DUE_ROUNDS')}
                  disabled={actionLoading === 'PROCESS_DUE_ROUNDS'}
                  className="inline-flex min-h-9 items-center justify-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 text-xs font-black text-white ring-1 ring-white/10 transition hover:bg-white/20 disabled:opacity-60"
                >
                  {actionLoading === 'PROCESS_DUE_ROUNDS' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Clock className="h-3.5 w-3.5" />
                  )}
                  Process
                </button>

                <button
                  type="button"
                  onClick={() => loadOverview(true)}
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
              {topSummaryItems.map((item) => (
                <SummaryItem key={item.label} item={item} />
              ))}
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {statusSummaryItems.map((item) => (
                <SummaryItem key={item.label} item={item} />
              ))}
            </div>
          </div>
        </section>

        {errorMessage && <MessageBox message={{ type: 'error', text: errorMessage }} />}
        {actionMessage && <MessageBox message={actionMessage} />}

        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="relative min-w-0">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search group name, status, round, amount..."
                className="min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm font-semibold outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-100"
              />
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1">
              {statusTabs.map((tab) => (
                <Link
                  key={tab.value}
                  href={tab.href}
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
            Showing {filteredFundSpaces.length} of {fundSpaces.length} groups.
          </p>
        </section>

        <section className="space-y-3">
          {filteredFundSpaces.length === 0 ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
              <Users className="mx-auto h-10 w-10 text-slate-300" />
              <h3 className="mt-4 text-lg font-black text-slate-900">
                No groups found
              </h3>
              <p className="mt-2 text-sm text-slate-500">
                Clear the search or choose another tab.
              </p>
            </div>
          ) : (
            filteredFundSpaces.map((fundSpace) => {
              const id = String(fundSpace.id || '');
              const status = normalize(fundSpace.status) || 'FORMING';
              const memberCount = toNumber(fundSpace.member_count);
              const memberLimit = toNumber(fundSpace.member_limit);
              const progress = getProgress(
                fundSpace.member_count,
                fundSpace.member_limit
              );
              const startNextLoading = actionLoading === `START_NEXT_ROUND_${id}`;
              const canStartNext = status === 'ACTIVE';

              return (
                <article
                  key={id}
                  className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:border-emerald-200 hover:shadow-md"
                >
                  <div className="grid gap-4 p-4 xl:grid-cols-[1fr_auto] xl:items-center">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusPill status={fundSpace.status} />

                        <span className="max-w-full rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
                          <span className="truncate">
                            Round {fundSpace.current_round_number || 1}
                          </span>
                        </span>

                        <span className="max-w-full rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">
                          <span className="truncate">
                            {formatCurrency(fundSpace.contribution_amount)}
                          </span>
                        </span>
                      </div>

                      <h3 className="mt-3 break-words text-lg font-black leading-6 text-slate-900">
                        {fundSpace.name || 'Unnamed Fund Space'}
                      </h3>

                      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <CompactInfo
                          label="Members"
                          value={`${memberCount}/${memberLimit || '-'}`}
                        />
                        <CompactInfo
                          label="Start"
                          value={formatDate(fundSpace.start_date)}
                        />
                        <CompactInfo
                          label="Paid Out"
                          value={`${toNumber(fundSpace.members_paid_out)} members`}
                        />
                        <CompactInfo
                          label="Defaulted"
                          value={`${toNumber(fundSpace.defaulted_members)} members`}
                        />
                      </div>

                      <div className="mt-3">
                        <div className="mb-1 flex items-center justify-between gap-3 text-[11px] font-black text-slate-400">
                          <span className="truncate">Membership Progress</span>
                          <span className="shrink-0">{progress}%</span>
                        </div>

                        <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-emerald-600 transition-all"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2 xl:w-[420px]">
                      <Link
                        href={`/admin/fund-space/${id}`}
                        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-4 text-sm font-black text-white hover:bg-emerald-800"
                      >
                        Details
                        <ArrowRight className="h-4 w-4" />
                      </Link>

                      <Link
                        href={`/admin/fund-space/contributions?fund_space_id=${id}`}
                        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 hover:bg-slate-50"
                      >
                        <HandCoins className="h-4 w-4" />
                        Contributions
                      </Link>

                      <Link
                        href={`/admin/fund-space/payouts?fund_space_id=${id}`}
                        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 hover:bg-slate-50"
                      >
                        <Banknote className="h-4 w-4" />
                        Payouts
                      </Link>

                      <button
                        type="button"
                        disabled={startNextLoading || !canStartNext}
                        onClick={() =>
                          runFundSpaceAction('START_NEXT_ROUND', {
                            fund_space_id: id,
                          })
                        }
                        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-blue-200 bg-blue-50 px-4 text-sm font-black text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {startNextLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <ShieldCheck className="h-4 w-4" />
                        )}
                        Next Round
                      </button>
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </section>
      </div>
    </main>
  );
}