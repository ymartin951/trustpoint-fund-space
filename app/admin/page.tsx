'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Banknote,
  CheckCircle2,
  Clock,
  HandCoins,
  Loader2,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';

import { supabase } from '@/lib/supabase/client';

type DashboardStats = {
  totalUsers: number;
  pendingVerifications: number;
  verifiedUsers: number;
  activeFundSpaces: number;
  formingFundSpaces: number;
  pausedFundSpaces: number;
  completedFundSpaces: number;
  pendingPayouts: number;
  pendingContributions: number;
  overdueContributions: number;
  pendingWithdrawals: number;
  totalTransactions: number;
};

const initialStats: DashboardStats = {
  totalUsers: 0,
  pendingVerifications: 0,
  verifiedUsers: 0,
  activeFundSpaces: 0,
  formingFundSpaces: 0,
  pausedFundSpaces: 0,
  completedFundSpaces: 0,
  pendingPayouts: 0,
  pendingContributions: 0,
  overdueContributions: 0,
  pendingWithdrawals: 0,
  totalTransactions: 0,
};

type ColorType =
  | 'blue'
  | 'green'
  | 'yellow'
  | 'purple'
  | 'red'
  | 'emerald'
  | 'amber';

async function getCount(
  tableName: string,
  filters?: {
    column: string;
    value: string;
  }[]
) {
  let query = supabase
    .from(tableName as never)
    .select('*', { count: 'exact', head: true });

  if (filters) {
    filters.forEach((filter) => {
      query = query.eq(filter.column, filter.value);
    });
  }

  const { count, error } = await query;

  if (error) {
    console.warn(`Admin dashboard count warning for ${tableName}:`, error.message);
    return 0;
  }

  return count || 0;
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats>(initialStats);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    loadDashboardStats();
  }, []);

  async function loadDashboardStats() {
    try {
      setRefreshing(true);
      setErrorMessage('');

      const [
        totalUsers,
        pendingVerifications,
        verifiedUsers,
        activeFundSpaces,
        formingFundSpaces,
        pausedFundSpaces,
        completedFundSpaces,
        pendingPayouts,
        pendingContributions,
        overdueContributions,
        pendingWithdrawals,
        totalTransactions,
      ] = await Promise.all([
        getCount('profiles'),
        getCount('verification_requests', [
          { column: 'status', value: 'PENDING' },
        ]),
        getCount('profiles', [
          { column: 'verification_status', value: 'VERIFIED' },
        ]),
        getCount('fund_spaces', [{ column: 'status', value: 'ACTIVE' }]),
        getCount('fund_spaces', [{ column: 'status', value: 'FORMING' }]),
        getCount('fund_spaces', [{ column: 'status', value: 'PAUSED' }]),
        getCount('fund_spaces', [{ column: 'status', value: 'COMPLETED' }]),
        getCount('fund_space_payouts', [
          { column: 'status', value: 'PENDING_ADMIN_APPROVAL' },
        ]),
        getCount('fund_space_contributions', [
          { column: 'status', value: 'PENDING' },
        ]),
        getCount('fund_space_contributions', [
          { column: 'status', value: 'OVERDUE' },
        ]),
        getCount('withdrawal_requests', [
          { column: 'status', value: 'PENDING' },
        ]),
        getCount('transactions'),
      ]);

      setStats({
        totalUsers,
        pendingVerifications,
        verifiedUsers,
        activeFundSpaces,
        formingFundSpaces,
        pausedFundSpaces,
        completedFundSpaces,
        pendingPayouts,
        pendingContributions,
        overdueContributions,
        pendingWithdrawals,
        totalTransactions,
      });
    } catch (error: unknown) {
      console.error('Admin dashboard error:', error);

      const message =
        error instanceof Error
          ? error.message
          : 'Something went wrong while loading admin dashboard.';

      setErrorMessage(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[500px] items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto h-10 w-10 animate-spin text-emerald-600" />
          <p className="mt-3 text-sm text-gray-500">
            Loading admin dashboard...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {errorMessage && (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">
          {errorMessage}
        </div>
      )}

      <div className="rounded-3xl bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-600 p-6 text-white shadow-sm md:p-8">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm font-semibold text-emerald-50">
              <ShieldCheck className="h-4 w-4" />
              Super Admin Control Center
            </div>

            <h1 className="text-3xl font-black md:text-4xl">
              TrustPoint Fund Space Admin
            </h1>

            <p className="mt-4 max-w-3xl text-sm leading-7 text-emerald-50 md:text-base">
              Monitor users, verification requests, Fund Space groups, contributions,
              payouts, withdrawals, and transaction activity from one admin dashboard.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/admin/fund-space"
                className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-emerald-700 hover:bg-emerald-50"
              >
                <Users size={16} />
                Fund Space Management
              </Link>

              <Link
                href="/admin/fund-space/contributions"
                className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-5 py-3 text-sm font-bold text-white ring-1 ring-white/20 hover:bg-white/20"
              >
                <HandCoins size={16} />
                Contributions
              </Link>

              <Link
                href="/admin/fund-space/payouts"
                className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-5 py-3 text-sm font-bold text-white ring-1 ring-white/20 hover:bg-white/20"
              >
                <Banknote size={16} />
                Payouts
              </Link>
            </div>
          </div>

          <button
            type="button"
            onClick={loadDashboardStats}
            disabled={refreshing}
            className="inline-flex min-h-12 w-fit items-center justify-center gap-2 rounded-xl bg-white/15 px-5 py-3 text-sm font-bold text-white hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            Refresh Dashboard
          </button>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total Users"
          value={stats.totalUsers}
          icon={<Users className="h-5 w-5" />}
          color="blue"
        />

        <StatCard
          title="Verified Users"
          value={stats.verifiedUsers}
          icon={<BadgeCheck className="h-5 w-5" />}
          color="green"
        />

        <StatCard
          title="Pending Verifications"
          value={stats.pendingVerifications}
          icon={<Clock className="h-5 w-5" />}
          color="yellow"
          href="/admin/verifications"
        />

        <StatCard
          title="Transactions"
          value={stats.totalTransactions}
          icon={<Banknote className="h-5 w-5" />}
          color="purple"
          href="/admin/transactions"
        />
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Active Fund Spaces"
          value={stats.activeFundSpaces}
          icon={<CheckCircle2 className="h-5 w-5" />}
          color="emerald"
          href="/admin/fund-space"
        />

        <StatCard
          title="Forming Fund Spaces"
          value={stats.formingFundSpaces}
          icon={<Users className="h-5 w-5" />}
          color="blue"
          href="/admin/fund-space"
        />

        <StatCard
          title="Paused Fund Spaces"
          value={stats.pausedFundSpaces}
          icon={<ShieldAlert className="h-5 w-5" />}
          color="purple"
          href="/admin/fund-space"
        />

        <StatCard
          title="Completed Fund Spaces"
          value={stats.completedFundSpaces}
          icon={<BadgeCheck className="h-5 w-5" />}
          color="green"
          href="/admin/fund-space"
        />
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Pending Payouts"
          value={stats.pendingPayouts}
          icon={<Wallet className="h-5 w-5" />}
          color="yellow"
          href="/admin/fund-space/payouts"
        />

        <StatCard
          title="Pending Contributions"
          value={stats.pendingContributions}
          icon={<HandCoins className="h-5 w-5" />}
          color="amber"
          href="/admin/fund-space/contributions"
        />

        <StatCard
          title="Overdue Contributions"
          value={stats.overdueContributions}
          icon={<AlertTriangle className="h-5 w-5" />}
          color="red"
          href="/admin/fund-space/contributions"
        />

        <StatCard
          title="Pending Withdrawals"
          value={stats.pendingWithdrawals}
          icon={<TrendingUp className="h-5 w-5" />}
          color="red"
          href="/admin/withdrawals"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <AdminActionCard
          title="Review Verifications"
          description="Approve or reject customer verification requests before users can join Fund Space groups."
          href="/admin/verifications"
          icon={<BadgeCheck className="h-6 w-6" />}
          buttonText="Open Verifications"
          color="emerald"
        />

        <AdminActionCard
          title="Manage Fund Spaces"
          description="View forming groups, active groups, member payout order, rounds, and member default management."
          href="/admin/fund-space"
          icon={<Users className="h-6 w-6" />}
          buttonText="Open Fund Space"
          color="emerald"
        />

        <AdminActionCard
          title="Approve Fund Space Payouts"
          description="Review completed contribution rounds and approve or mark member payouts as paid."
          href="/admin/fund-space/payouts"
          icon={<Wallet className="h-6 w-6" />}
          buttonText="Open Payouts"
          color="amber"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <AdminActionCard
          title="Monitor Contributions"
          description="Track pending, paid, overdue, failed, and defaulted contribution records across all Fund Space groups."
          href="/admin/fund-space/contributions"
          icon={<HandCoins className="h-6 w-6" />}
          buttonText="Open Contributions"
          color="emerald"
        />

        <AdminActionCard
          title="Withdrawal Requests"
          description="Review withdrawal requests and monitor pending customer or agent withdrawals."
          href="/admin/withdrawals"
          icon={<TrendingUp className="h-6 w-6" />}
          buttonText="Open Withdrawals"
          color="red"
        />

        <AdminActionCard
          title="System Transactions"
          description="View wallet movements, payments, deductions, payout records, and transaction history."
          href="/admin/transactions"
          icon={<Banknote className="h-6 w-6" />}
          buttonText="Open Transactions"
          color="purple"
        />
      </div>

      <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-6">
        <h2 className="text-lg font-bold text-emerald-800">
          Admin Workflow Reminder
        </h2>
        <p className="mt-2 text-sm leading-6 text-emerald-700">
          Start with verification requests, monitor Fund Space group formation, confirm
          contributions, check overdue/default-risk members, then approve payouts when rounds
          become ready.
        </p>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
  color,
  href,
}: {
  title: string;
  value: number;
  icon: ReactNode;
  color: ColorType;
  href?: string;
}) {
  const colorClasses: Record<ColorType, string> = {
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
    green: 'bg-green-50 text-green-700 border-green-100',
    yellow: 'bg-yellow-50 text-yellow-700 border-yellow-100',
    purple: 'bg-purple-50 text-purple-700 border-purple-100',
    red: 'bg-red-50 text-red-700 border-red-100',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
  };

  const card = (
    <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-gray-500">{title}</p>
          <p className="mt-3 text-3xl font-black text-gray-950">{value}</p>
        </div>

        <div
          className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${colorClasses[color]}`}
        >
          {icon}
        </div>
      </div>
    </div>
  );

  if (!href) return card;

  return (
    <Link href={href} className="block">
      {card}
    </Link>
  );
}

function AdminActionCard({
  title,
  description,
  href,
  icon,
  buttonText,
  color,
}: {
  title: string;
  description: string;
  href: string;
  icon: ReactNode;
  buttonText: string;
  color: 'emerald' | 'amber' | 'red' | 'purple';
}) {
  const iconClasses = {
    emerald: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    red: 'bg-red-50 text-red-700',
    purple: 'bg-purple-50 text-purple-700',
  };

  const buttonClasses = {
    emerald: 'bg-emerald-600 hover:bg-emerald-700',
    amber: 'bg-amber-600 hover:bg-amber-700',
    red: 'bg-red-600 hover:bg-red-700',
    purple: 'bg-purple-600 hover:bg-purple-700',
  };

  return (
    <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
      <div
        className={`flex h-12 w-12 items-center justify-center rounded-2xl ${iconClasses[color]}`}
      >
        {icon}
      </div>

      <h2 className="mt-5 text-xl font-black text-gray-950">{title}</h2>

      <p className="mt-3 text-sm leading-6 text-gray-500">{description}</p>

      <Link
        href={href}
        className={`mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold text-white ${buttonClasses[color]}`}
      >
        {buttonText}
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}