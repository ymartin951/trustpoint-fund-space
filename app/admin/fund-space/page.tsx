'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
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
import type { Database } from '@/lib/supabase/database.types';

type FundSpaceOverviewRow =
  Database['public']['Views']['admin_fund_space_overview']['Row'];

type AdminProfile = {
  id: string;
  role: string | null;
  status: string | null;
  is_blacklisted: boolean | null;
};

type OverviewStats = {
  total_groups: number;
  forming_groups: number;
  active_groups: number;
  completed_groups: number;
  paused_groups: number;
  defaulted_groups: number;
  total_members: number;
  defaulted_members: number;
  members_paid_out: number;
  expected_weekly_volume: number;
};

type FundSpaceAction =
  | 'SEND_DEADLINE_REMINDERS'
  | 'PROCESS_DUE_ROUNDS'
  | 'START_NEXT_ROUND';

type Message = {
  type: 'success' | 'error' | 'info';
  text: string;
};

const emptyStats: OverviewStats = {
  total_groups: 0,
  forming_groups: 0,
  active_groups: 0,
  completed_groups: 0,
  paused_groups: 0,
  defaulted_groups: 0,
  total_members: 0,
  defaulted_members: 0,
  members_paid_out: 0,
  expected_weekly_volume: 0,
};

const quickFilters = [
  { label: 'All', value: 'ALL' },
  { label: 'Active', value: 'ACTIVE' },
  { label: 'Forming', value: 'FORMING' },
  { label: 'Paused', value: 'PAUSED' },
  { label: 'Completed', value: 'COMPLETED' },
];

function normalizeRole(role: string | null | undefined) {
  return String(role || '').trim().toUpperCase().replaceAll(' ', '_');
}

function isAdminRole(role: string | null | undefined) {
  const value = normalizeRole(role);
  return value === 'ADMIN' || value === 'SUPER_ADMIN';
}

function formatCurrency(amount: number | string | null | undefined) {
  return `GH₵${Number(amount || 0).toLocaleString('en-GH', {
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

function formatLabel(value: string | null | undefined) {
  if (!value) return 'Not set';

  return value
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getStatusClass(status: string | null | undefined) {
  const value = String(status || 'FORMING').toUpperCase();

  if (value === 'ACTIVE') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (value === 'FORMING') return 'border-amber-200 bg-amber-50 text-amber-700';
  if (value === 'COMPLETED') return 'border-blue-200 bg-blue-50 text-blue-700';
  if (value === 'PAUSED') return 'border-purple-200 bg-purple-50 text-purple-700';
  if (value === 'DEFAULTED' || value === 'CANCELLED' || value === 'FAILED') {
    return 'border-red-200 bg-red-50 text-red-700';
  }

  return 'border-gray-200 bg-gray-50 text-gray-700';
}

function getProgress(memberCount: number | null | undefined, memberLimit: number | null | undefined) {
  const count = Number(memberCount || 0);
  const limit = Number(memberLimit || 0);

  if (limit <= 0) return 0;

  return Math.min(Math.round((count / limit) * 100), 100);
}

function calculateStats(rows: FundSpaceOverviewRow[]): OverviewStats {
  return rows.reduce<OverviewStats>(
    (stats, row) => {
      const status = String(row.status || 'FORMING').toUpperCase();
      const memberCount = Number(row.member_count || 0);
      const defaultedMembers = Number(row.defaulted_members || 0);
      const membersPaidOut = Number(row.members_paid_out || 0);
      const contributionAmount = Number(row.contribution_amount || 0);

      stats.total_groups += 1;
      stats.total_members += memberCount;
      stats.defaulted_members += defaultedMembers;
      stats.members_paid_out += membersPaidOut;
      stats.expected_weekly_volume += contributionAmount * memberCount;

      if (status === 'FORMING') stats.forming_groups += 1;
      if (status === 'ACTIVE') stats.active_groups += 1;
      if (status === 'COMPLETED') stats.completed_groups += 1;
      if (status === 'PAUSED') stats.paused_groups += 1;
      if (status === 'DEFAULTED') stats.defaulted_groups += 1;

      return stats;
    },
    { ...emptyStats }
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
        <p>{message.text}</p>
      </div>
    </div>
  );
}

function StatButton({
  title,
  value,
  description,
  active,
  onClick,
}: {
  title: string;
  value: string | number;
  description: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
        active
          ? 'border-emerald-300 bg-emerald-50'
          : 'border-gray-100 bg-white hover:border-emerald-200'
      }`}
    >
      <p className="text-xs font-black uppercase tracking-wide text-gray-500">{title}</p>
      <p className="mt-2 text-2xl font-black text-gray-950">{value}</p>
      <p className="mt-1 text-sm leading-5 text-gray-500">{description}</p>
    </button>
  );
}

export default function AdminFundSpacePage() {
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
    loadOverview();
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

    if (String(profile.status || '').toUpperCase() !== 'ACTIVE') {
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
      console.error('Admin Fund Space overview load error:', error);

      setErrorMessage(
        error instanceof Error ? error.message : 'Unable to load Fund Space overview.'
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
          ? 'Send payment reminders to unpaid members and their agents?'
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
        throw new Error(`Server returned a non-JSON response. Status: ${response.status}`);
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
      console.error('Admin Fund Space action error:', error);
      setActionMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Unable to complete action.',
      });
    } finally {
      setActionLoading(null);
    }
  }

  const stats = useMemo(() => calculateStats(fundSpaces), [fundSpaces]);

  const filteredFundSpaces = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return fundSpaces.filter((item) => {
      const name = String(item.name || '').toLowerCase();
      const id = String(item.id || '').toLowerCase();
      const status = String(item.status || 'FORMING').toUpperCase();

      const matchesSearch =
        !query ||
        name.includes(query) ||
        id.includes(query) ||
        status.toLowerCase().includes(query) ||
        String(item.contribution_amount || '').includes(query) ||
        String(item.current_round_number || '').includes(query);

      const matchesStatus = statusFilter === 'ALL' || status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [fundSpaces, searchTerm, statusFilter]);

  if (loading) {
    return (
      <div className="flex min-h-[65vh] items-center justify-center p-6">
        <div className="rounded-3xl border border-gray-100 bg-white p-8 text-center shadow-sm">
          <Loader2 className="mx-auto h-10 w-10 animate-spin text-emerald-600" />
          <p className="mt-4 text-sm font-bold text-gray-600">Loading Fund Space groups...</p>
        </div>
      </div>
    );
  }

  if (!adminProfile && errorMessage) {
    return (
      <div className="rounded-3xl border border-red-100 bg-red-50 p-6 text-red-700">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <h2 className="font-black">Unable to load Fund Space management</h2>
            <p className="mt-1 text-sm">{errorMessage}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-10">
      <section className="rounded-3xl bg-gradient-to-br from-emerald-700 via-emerald-600 to-teal-600 p-5 text-white shadow-sm sm:p-6 lg:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-3xl">
            <p className="inline-flex rounded-full bg-white/15 px-4 py-1 text-sm font-bold">
              Admin Fund Space
            </p>
            <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">
              Manage Fund Space Groups
            </h1>
            <p className="mt-3 text-sm leading-7 text-emerald-50 sm:text-base">
              Simple controls for contributions, reminders, weekly rounds, and payouts.
              All important actions are visible and easy to use on mobile.
            </p>
          </div>

          <button
            type="button"
            onClick={() => loadOverview(true)}
            disabled={refreshing}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-black text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh Page
          </button>
        </div>
      </section>

      {errorMessage && <MessageBox message={{ type: 'error', text: errorMessage }} />}
      {actionMessage && <MessageBox message={actionMessage} />}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatButton
          title="Groups"
          value={stats.total_groups}
          description="All Fund Space groups"
          active={statusFilter === 'ALL'}
          onClick={() => setStatusFilter('ALL')}
        />
        <StatButton
          title="Active"
          value={stats.active_groups}
          description="Currently running groups"
          active={statusFilter === 'ACTIVE'}
          onClick={() => setStatusFilter('ACTIVE')}
        />
        <StatButton
          title="Members"
          value={stats.total_members}
          description="Total group members"
        />
        <StatButton
          title="Weekly Volume"
          value={formatCurrency(stats.expected_weekly_volume)}
          description="Expected weekly contribution"
        />
      </section>

      <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-amber-700 shadow-sm">
              <BellRing className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-amber-950">Weekly Round Actions</h2>
              <p className="mt-1 text-sm leading-6 text-amber-800">
                Use these buttons to remind unpaid members and process due weekly rounds.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[520px]">
            <button
              type="button"
              disabled={actionLoading === 'SEND_DEADLINE_REMINDERS'}
              onClick={() => runFundSpaceAction('SEND_DEADLINE_REMINDERS')}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-amber-600 px-4 py-3 text-sm font-black text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {actionLoading === 'SEND_DEADLINE_REMINDERS' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <BellRing className="h-4 w-4" />
              )}
              Send Reminders
            </button>

            <button
              type="button"
              disabled={actionLoading === 'PROCESS_DUE_ROUNDS'}
              onClick={() => runFundSpaceAction('PROCESS_DUE_ROUNDS')}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-red-600 px-4 py-3 text-sm font-black text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {actionLoading === 'PROCESS_DUE_ROUNDS' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Clock className="h-4 w-4" />
              )}
              Process Due Rounds
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-md">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search group name, round, amount..."
              className="w-full rounded-2xl border border-gray-200 bg-gray-50 py-3 pl-11 pr-4 text-sm font-semibold outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-50"
            />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1">
            {quickFilters.map((filter) => (
              <button
                key={filter.value}
                type="button"
                onClick={() => setStatusFilter(filter.value)}
                className={`shrink-0 rounded-2xl px-4 py-3 text-sm font-black transition ${
                  statusFilter === filter.value
                    ? 'bg-emerald-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-gray-950">Fund Space Groups</h2>
            <p className="mt-1 text-sm text-gray-500">
              Showing {filteredFundSpaces.length} of {fundSpaces.length} groups.
            </p>
          </div>
        </div>

        {filteredFundSpaces.length === 0 ? (
          <div className="rounded-3xl border border-gray-100 bg-white p-8 text-center shadow-sm">
            <Users className="mx-auto h-10 w-10 text-gray-300" />
            <h3 className="mt-4 text-lg font-black text-gray-950">No groups found</h3>
            <p className="mt-2 text-sm text-gray-500">
              Try clearing the search box or selecting another filter.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {filteredFundSpaces.map((fundSpace) => {
              const id = String(fundSpace.id || '');
              const status = String(fundSpace.status || 'FORMING').toUpperCase();
              const memberCount = Number(fundSpace.member_count || 0);
              const memberLimit = Number(fundSpace.member_limit || 0);
              const progress = getProgress(fundSpace.member_count, fundSpace.member_limit);
              const startNextLoading = actionLoading === `START_NEXT_ROUND_${id}`;

              return (
                <article
                  key={id}
                  className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm transition hover:border-emerald-200 hover:shadow-md"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-black ${getStatusClass(
                            fundSpace.status
                          )}`}
                        >
                          {formatLabel(status)}
                        </span>
                        <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-black text-gray-600">
                          Round {fundSpace.current_round_number || 1}
                        </span>
                      </div>

                      <h3 className="mt-3 text-xl font-black text-gray-950">
                        {fundSpace.name || 'Unnamed Fund Space'}
                      </h3>

                      <p className="mt-2 text-sm leading-6 text-gray-500">
                        {memberCount} of {memberLimit || 'not set'} members joined · Weekly contribution{' '}
                        <span className="font-black text-gray-800">
                          {formatCurrency(fundSpace.contribution_amount)}
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="mt-5">
                    <div className="mb-2 flex items-center justify-between text-xs font-black text-gray-500">
                      <span>Membership progress</span>
                      <span>{progress}%</span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-gray-100">
                      <div
                        className="h-full rounded-full bg-emerald-600 transition-all"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl bg-gray-50 p-4">
                      <p className="text-xs font-black text-gray-500">Start Date</p>
                      <p className="mt-1 text-sm font-black text-gray-900">
                        {formatDate(fundSpace.start_date)}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-gray-50 p-4">
                      <p className="text-xs font-black text-gray-500">Paid Out</p>
                      <p className="mt-1 text-sm font-black text-gray-900">
                        {Number(fundSpace.members_paid_out || 0)} members
                      </p>
                    </div>
                    <div className="rounded-2xl bg-gray-50 p-4">
                      <p className="text-xs font-black text-gray-500">Defaulted</p>
                      <p className="mt-1 text-sm font-black text-gray-900">
                        {Number(fundSpace.defaulted_members || 0)} members
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <Link
                      href={`/admin/fund-space/${id}`}
                      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-black text-white transition hover:bg-emerald-700"
                    >
                      View Details
                      <ArrowRight className="h-4 w-4" />
                    </Link>

                    <Link
                      href={`/admin/fund-space/contributions?fund_space_id=${id}`}
                      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-black text-gray-700 transition hover:bg-gray-50"
                    >
                      <HandCoins className="h-4 w-4" />
                      Contributions
                    </Link>

                    <Link
                      href={`/admin/fund-space/payouts?fund_space_id=${id}`}
                      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-black text-gray-700 transition hover:bg-gray-50"
                    >
                      <Banknote className="h-4 w-4" />
                      Payouts
                    </Link>

                    <button
                      type="button"
                      disabled={startNextLoading || status !== 'ACTIVE'}
                      onClick={() =>
                        runFundSpaceAction('START_NEXT_ROUND', {
                          fund_space_id: id,
                        })
                      }
                      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-black text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {startNextLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ShieldCheck className="h-4 w-4" />
                      )}
                      Next Round
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
