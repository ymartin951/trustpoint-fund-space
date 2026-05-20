'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Banknote,
  CalendarDays,
  CheckCircle2,
  Clock,
  Eye,
  HandCoins,
  Loader2,
  RefreshCw,
  Search,
  ShieldAlert,
  TrendingUp,
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

function formatCurrency(amount: number | null | undefined) {
  return `GH₵${Number(amount || 0).toLocaleString('en-GH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(dateString: string | null | undefined) {
  if (!dateString) return 'Not set';

  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) {
    return 'Invalid date';
  }

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

function getStatusStyle(status: string | null | undefined) {
  const value = String(status || 'FORMING').toUpperCase();

  if (value === 'ACTIVE') {
    return 'bg-emerald-50 text-emerald-700 border-emerald-100';
  }

  if (value === 'FORMING') {
    return 'bg-amber-50 text-amber-700 border-amber-100';
  }

  if (value === 'COMPLETED') {
    return 'bg-blue-50 text-blue-700 border-blue-100';
  }

  if (value === 'PAUSED') {
    return 'bg-purple-50 text-purple-700 border-purple-100';
  }

  if (value === 'DEFAULTED' || value === 'CANCELLED' || value === 'FAILED') {
    return 'bg-red-50 text-red-700 border-red-100';
  }

  return 'bg-gray-50 text-gray-700 border-gray-100';
}

function getProgress(
  memberCount: number | null | undefined,
  memberLimit: number | null | undefined
) {
  const count = Number(memberCount || 0);
  const limit = Number(memberLimit || 0);

  if (limit <= 0) return 0;

  return Math.min(Math.round((count / limit) * 100), 100);
}

function isAdminRole(role: string | null | undefined) {
  return role === 'ADMIN' || role === 'SUPER_ADMIN';
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

export default function AdminFundSpacePage() {
  const [adminProfile, setAdminProfile] = useState<AdminProfile | null>(null);
  const [fundSpaces, setFundSpaces] = useState<FundSpaceOverviewRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

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
      throw new Error('Your session has expired. Please login again.');
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
      throw new Error('You do not have permission to view Fund Space management.');
    }

    if (profile.status !== 'ACTIVE') {
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

      if (error) {
        throw error;
      }

      setFundSpaces((data || []) as FundSpaceOverviewRow[]);
    } catch (error: unknown) {
      console.error('Admin Fund Space overview load error:', error);

      const message =
        error instanceof Error
          ? error.message
          : 'Unable to load Fund Space overview.';

      setErrorMessage(message);
      setFundSpaces([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  const stats = useMemo(() => calculateStats(fundSpaces), [fundSpaces]);

  const filteredFundSpaces = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return fundSpaces.filter((item) => {
      const name = (item.name || '').toLowerCase();
      const id = String(item.id || '').toLowerCase();
      const status = String(item.status || 'FORMING');

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

  const statusOptions = useMemo(() => {
    const statuses = Array.from(
      new Set(fundSpaces.map((item) => String(item.status || 'FORMING')))
    );

    return ['ALL', ...statuses.sort()];
  }, [fundSpaces]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-emerald-600" />
          <p className="text-sm text-gray-500">
            Loading Fund Space management...
          </p>
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
    <div className="space-y-8">
      <div className="rounded-3xl bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-600 p-6 text-white shadow-sm md:p-8">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
          <div>
            <p className="mb-3 inline-flex rounded-full bg-white/15 px-4 py-1 text-sm font-medium">
              Admin Management
            </p>

            <h1 className="text-3xl font-black md:text-4xl">
              Fund Space Management
            </h1>

            <p className="mt-4 max-w-3xl text-sm leading-7 text-emerald-50 md:text-base">
              Monitor all Fund Space groups, member growth, payout progress,
              defaulted members, and weekly contribution volume.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/admin/fund-space/payouts"
                className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-emerald-700 hover:bg-emerald-50"
              >
                <Banknote size={16} />
                Payout Approvals
              </Link>

              <Link
                href="/admin/fund-space/contributions"
                className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-5 py-3 text-sm font-bold text-white ring-1 ring-white/20 hover:bg-white/20"
              >
                <HandCoins size={16} />
                Contributions
              </Link>
            </div>
          </div>

          <button
            type="button"
            onClick={() => loadOverview(true)}
            disabled={refreshing}
            className="inline-flex min-h-12 w-fit items-center justify-center gap-2 rounded-xl bg-white/15 px-5 py-3 text-sm font-bold text-white hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-700">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total Fund Spaces"
          value={stats.total_groups}
          description="All created Fund Space groups"
          icon={<Users size={24} />}
          color="emerald"
        />

        <StatCard
          title="Active Groups"
          value={stats.active_groups}
          description="Currently running contribution cycles"
          icon={<CheckCircle2 size={24} />}
          color="emerald"
        />

        <StatCard
          title="Forming Groups"
          value={stats.forming_groups}
          description="Waiting to reach member limit"
          icon={<Clock size={24} />}
          color="amber"
        />

        <StatCard
          title="Completed Groups"
          value={stats.completed_groups}
          description="Successfully completed Fund Spaces"
          icon={<BadgeCheck size={24} />}
          color="blue"
        />
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total Members"
          value={stats.total_members}
          icon={<Users size={24} />}
          color="emerald"
        />

        <ValueCard
          title="Weekly Volume"
          value={stats.expected_weekly_volume}
          icon={<Banknote size={24} />}
          color="emerald"
        />

        <StatCard
          title="Defaulted Members"
          value={stats.defaulted_members}
          icon={<ShieldAlert size={24} />}
          color="red"
        />

        <StatCard
          title="Members Paid Out"
          value={stats.members_paid_out}
          icon={<TrendingUp size={24} />}
          color="emerald"
        />
      </div>

      <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm md:p-6">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
          <div>
            <h2 className="text-xl font-black text-gray-900">
              All Fund Space Groups
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Search, filter, view details, and monitor all Fund Space groups.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />

              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search by name, ID, amount..."
                className="min-h-11 w-full rounded-xl border border-gray-200 bg-white pl-10 pr-4 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 sm:w-72"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="min-h-11 rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-700 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            >
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status === 'ALL' ? 'All Statuses' : formatLabel(status)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-6 space-y-4 lg:hidden">
          {filteredFundSpaces.length === 0 ? (
            <EmptyState />
          ) : (
            filteredFundSpaces.map((item) => (
              <FundSpaceMobileCard key={String(item.id)} item={item} />
            ))
          )}
        </div>

        <div className="mt-6 hidden overflow-hidden rounded-2xl border border-gray-100 lg:block">
          {filteredFundSpaces.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1150px] text-left">
                <thead className="border-b border-gray-100 bg-gray-50">
                  <tr>
                    <TableHead>Fund Space</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Members</TableHead>
                    <TableHead>Contribution</TableHead>
                    <TableHead>Current Round</TableHead>
                    <TableHead>Paid Out</TableHead>
                    <TableHead>Defaults</TableHead>
                    <TableHead>Start Date</TableHead>
                    <TableHead align="right">Actions</TableHead>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                  {filteredFundSpaces.map((item) => (
                    <FundSpaceTableRow key={String(item.id)} item={item} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="mt-5 flex flex-col justify-between gap-3 text-sm text-gray-500 sm:flex-row sm:items-center">
          <p>
            Showing {filteredFundSpaces.length} of {fundSpaces.length} Fund
            Spaces
          </p>

          <button
            type="button"
            onClick={() => {
              setSearchTerm('');
              setStatusFilter('ALL');
            }}
            className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50"
          >
            Clear Filters
          </button>
        </div>
      </div>

      <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-6">
        <h2 className="text-lg font-black text-emerald-800">
          Admin Reminder
        </h2>

        <p className="mt-2 text-sm leading-6 text-emerald-700">
          Use this page to monitor group health. Click View to inspect one
          group’s members, payout order, rounds, contributions, and payout
          records. Use Payouts when a round becomes ready for approval,
          rejection, or payment marking.
        </p>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  description,
  icon,
  color,
}: {
  title: string;
  value: number;
  description?: string;
  icon: React.ReactNode;
  color: 'emerald' | 'amber' | 'blue' | 'red';
}) {
  const classes = {
    emerald: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    blue: 'bg-blue-50 text-blue-700',
    red: 'bg-red-50 text-red-700',
  };

  return (
    <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
      <div className={`mb-4 inline-flex rounded-2xl p-3 ${classes[color]}`}>
        {icon}
      </div>

      <p className="text-sm text-gray-500">{title}</p>

      <h3 className="mt-1 text-2xl font-black text-gray-900">{value}</h3>

      {description && (
        <p className="mt-2 text-xs text-gray-500">{description}</p>
      )}
    </div>
  );
}

function ValueCard({
  title,
  value,
  icon,
  color,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
  color: 'emerald' | 'red';
}) {
  const classes = {
    emerald: 'bg-emerald-50 text-emerald-700',
    red: 'bg-red-50 text-red-700',
  };

  return (
    <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
      <div className={`mb-4 inline-flex rounded-2xl p-3 ${classes[color]}`}>
        {icon}
      </div>

      <p className="text-sm text-gray-500">{title}</p>

      <h3 className="mt-1 text-2xl font-black text-gray-900">
        {formatCurrency(value)}
      </h3>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="p-10 text-center">
      <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-amber-500" />

      <h3 className="text-lg font-black text-gray-900">
        No Fund Spaces found
      </h3>

      <p className="mt-2 text-sm text-gray-500">
        Try changing the search or status filter.
      </p>
    </div>
  );
}

function FundSpaceMobileCard({ item }: { item: FundSpaceOverviewRow }) {
  const fundSpaceId = String(item.id || '');
  const memberCount = Number(item.member_count || 0);
  const memberLimit = Number(item.member_limit || 0);
  const progress = getProgress(memberCount, memberLimit);

  return (
    <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-black text-gray-900">
            {item.name || 'Unnamed Fund Space'}
          </h3>

          <p className="mt-1 max-w-[220px] truncate text-xs text-gray-500">
            {fundSpaceId || 'No ID'}
          </p>
        </div>

        <span
          className={`shrink-0 rounded-full border px-3 py-1 text-xs font-bold ${getStatusStyle(
            item.status
          )}`}
        >
          {formatLabel(item.status || 'FORMING')}
        </span>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <MiniInfo label="Members" value={`${memberCount}/${memberLimit || 0}`} />
        <MiniInfo
          label="Weekly"
          value={formatCurrency(item.contribution_amount)}
        />
        <MiniInfo
          label="Round"
          value={`Round ${item.current_round_number || 0}`}
        />
        <MiniInfo label="Paid Out" value={String(item.members_paid_out || 0)} />
      </div>

      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between text-xs">
          <span className="font-semibold text-gray-500">Progress</span>
          <span className="font-black text-emerald-700">{progress}%</span>
        </div>

        <div className="h-2 overflow-hidden rounded-full bg-gray-100">
          <div
            className="h-full rounded-full bg-emerald-600"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <Link
          href={`/admin/fund-space/${fundSpaceId}`}
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700"
        >
          <Eye size={14} />
          View
        </Link>

        <Link
          href="/admin/fund-space/payouts"
          className="inline-flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100"
        >
          <Banknote size={14} />
          Payouts
        </Link>

        <Link
          href="/admin/fund-space/contributions"
          className="inline-flex items-center gap-2 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700 hover:bg-amber-100"
        >
          <HandCoins size={14} />
          Contributions
        </Link>
      </div>
    </div>
  );
}

function FundSpaceTableRow({ item }: { item: FundSpaceOverviewRow }) {
  const memberCount = Number(item.member_count || 0);
  const memberLimit = Number(item.member_limit || 0);
  const progress = getProgress(memberCount, memberLimit);
  const fundSpaceId = String(item.id || '');

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-4 py-4">
        <div>
          <p className="font-bold text-gray-900">
            {item.name || 'Unnamed Fund Space'}
          </p>

          <p className="mt-1 max-w-[220px] truncate text-xs text-gray-500">
            {fundSpaceId || 'No ID'}
          </p>
        </div>
      </td>

      <td className="px-4 py-4">
        <span
          className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${getStatusStyle(
            item.status
          )}`}
        >
          {formatLabel(item.status || 'FORMING')}
        </span>
      </td>

      <td className="px-4 py-4">
        <div>
          <p className="font-bold text-gray-900">
            {memberCount}/{memberLimit || 0}
          </p>

          <div className="mt-2 h-2 w-28 overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-emerald-600"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </td>

      <td className="px-4 py-4">
        <p className="font-bold text-gray-900">
          {formatCurrency(item.contribution_amount)}
        </p>

        <p className="mt-1 text-xs text-gray-500">Weekly per member</p>
      </td>

      <td className="px-4 py-4">
        <p className="font-bold text-gray-900">
          Round {item.current_round_number || 0}
        </p>
      </td>

      <td className="px-4 py-4">
        <p className="font-bold text-emerald-700">
          {item.members_paid_out || 0}
        </p>
      </td>

      <td className="px-4 py-4">
        <p
          className={
            Number(item.defaulted_members || 0) > 0
              ? 'font-bold text-red-700'
              : 'font-bold text-gray-900'
          }
        >
          {item.defaulted_members || 0}
        </p>
      </td>

      <td className="px-4 py-4">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <CalendarDays size={14} />
          {formatDate(item.start_date)}
        </div>
      </td>

      <td className="px-4 py-4">
        <div className="flex justify-end gap-2">
          <Link
            href={`/admin/fund-space/${fundSpaceId}`}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700"
          >
            <Eye size={14} />
            View
          </Link>

          <Link
            href="/admin/fund-space/payouts"
            className="inline-flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100"
          >
            <Banknote size={14} />
            Payouts
          </Link>

          <Link
            href="/admin/fund-space/contributions"
            className="inline-flex items-center gap-2 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700 hover:bg-amber-100"
          >
            <HandCoins size={14} />
            Contributions
          </Link>
        </div>
      </td>
    </tr>
  );
}

function MiniInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-gray-50 p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-gray-400">
        {label}
      </p>

      <p className="mt-1 font-black text-gray-900">{value}</p>
    </div>
  );
}

function TableHead({
  children,
  align = 'left',
}: {
  children: React.ReactNode;
  align?: 'left' | 'right';
}) {
  return (
    <th
      className={`px-4 py-4 text-xs font-black uppercase tracking-wide text-gray-500 ${
        align === 'right' ? 'text-right' : 'text-left'
      }`}
    >
      {children}
    </th>
  );
}