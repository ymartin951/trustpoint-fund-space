'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  BadgeCheck,
  Banknote,
  Bell,
  CheckCircle2,
  FileWarning,
  HandCoins,
  LayoutDashboard,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Users,
  WalletCards,
} from 'lucide-react';

import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

type AdminStats = {
  totalUsers: number;
  pendingVerifications: number;
  verifiedUsers: number;

  totalFundSpaces: number;
  activeFundSpaces: number;
  formingFundSpaces: number;
  completedFundSpaces: number;
  pausedFundSpaces: number;
  cancelledFundSpaces: number;

  pendingManualPayments: number;
  approvedManualPayments: number;
  rejectedManualPayments: number;

  payoutsPendingApproval: number;
  payoutsApprovedNotPaid: number;
  payoutsPaid: number;

  openDisputes: number;
  underReviewDisputes: number;
  resolvedDisputes: number;

  pendingWithdrawals: number;
  transactions: number;
};

type CountFilter = {
  column: string;
  value: string | number | boolean | null;
};

type ControlCard = {
  title: string;
  value: number | string;
  subtitle: string;
  href: string;
  icon?: ReactNode;
};

type AdminAction = {
  title: string;
  description: string;
  href: string;
  buttonText: string;
  value: number;
  icon: ReactNode;
  tone: 'emerald' | 'amber' | 'red' | 'slate';
};

const initialStats: AdminStats = {
  totalUsers: 0,
  pendingVerifications: 0,
  verifiedUsers: 0,

  totalFundSpaces: 0,
  activeFundSpaces: 0,
  formingFundSpaces: 0,
  completedFundSpaces: 0,
  pausedFundSpaces: 0,
  cancelledFundSpaces: 0,

  pendingManualPayments: 0,
  approvedManualPayments: 0,
  rejectedManualPayments: 0,

  payoutsPendingApproval: 0,
  payoutsApprovedNotPaid: 0,
  payoutsPaid: 0,

  openDisputes: 0,
  underReviewDisputes: 0,
  resolvedDisputes: 0,

  pendingWithdrawals: 0,
  transactions: 0,
};

function normalize(value: string | null | undefined) {
  return String(value || '').trim().toUpperCase();
}

function formatNumber(value: number | string | null | undefined) {
  if (typeof value === 'string') return value;
  return Number(value || 0).toLocaleString('en-GH');
}

function getToneClass(tone: 'emerald' | 'amber' | 'red' | 'slate') {
  if (tone === 'emerald') {
    return {
      icon: 'border-emerald-200 bg-emerald-50 text-emerald-700',
      card: 'hover:border-emerald-200',
      button: 'bg-emerald-700 hover:bg-emerald-800 text-white',
    };
  }

  if (tone === 'amber') {
    return {
      icon: 'border-amber-200 bg-amber-50 text-amber-700',
      card: 'hover:border-amber-200',
      button: 'bg-amber-600 hover:bg-amber-700 text-white',
    };
  }

  if (tone === 'red') {
    return {
      icon: 'border-red-200 bg-red-50 text-red-700',
      card: 'hover:border-red-200',
      button: 'bg-red-600 hover:bg-red-700 text-white',
    };
  }

  return {
    icon: 'border-slate-200 bg-slate-50 text-slate-700',
    card: 'hover:border-slate-300',
    button: 'bg-slate-900 hover:bg-slate-800 text-white',
  };
}

async function getExactCount(tableName: string, filters: CountFilter[] = []) {
  let query = supabase
    .from(tableName as never)
    .select('*', { count: 'exact', head: true }) as any;

  filters.forEach((filter) => {
    query = query.eq(filter.column, filter.value);
  });

  const { count, error } = await query;

  if (error) {
    console.warn(`Admin count warning for ${tableName}:`, error.message);
    return 0;
  }

  return count || 0;
}

export default function AdminDashboardPage() {
  const { profile, loading } = useAuth();

  const [stats, setStats] = useState<AdminStats>(initialStats);
  const [pageLoading, setPageLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const isAdmin = useMemo(() => {
    const role = normalize(profile?.role);
    return role === 'ADMIN' || role === 'SUPER_ADMIN';
  }, [profile?.role]);

  const loadStats = useCallback(async (showRefresh = false) => {
    try {
      if (showRefresh) {
        setRefreshing(true);
      } else {
        setPageLoading(true);
      }

      setErrorMessage('');

      const [
        totalUsers,
        pendingVerifications,
        verifiedUsers,

        totalFundSpaces,
        activeFundSpaces,
        formingFundSpaces,
        completedFundSpaces,
        pausedFundSpaces,
        cancelledFundSpaces,

        pendingManualPayments,
        approvedManualPayments,
        rejectedManualPayments,

        payoutsPendingApproval,
        payoutsApprovedNotPaid,
        payoutsPaid,

        openDisputes,
        underReviewDisputes,
        resolvedDisputes,

        pendingWithdrawals,
        transactions,
      ] = await Promise.all([
        getExactCount('profiles'),
        getExactCount('verification_requests', [
          { column: 'status', value: 'PENDING' },
        ]),
        getExactCount('profiles', [
          { column: 'verification_status', value: 'VERIFIED' },
        ]),

        getExactCount('fund_spaces'),
        getExactCount('fund_spaces', [{ column: 'status', value: 'ACTIVE' }]),
        getExactCount('fund_spaces', [{ column: 'status', value: 'FORMING' }]),
        getExactCount('fund_spaces', [{ column: 'status', value: 'COMPLETED' }]),
        getExactCount('fund_spaces', [{ column: 'status', value: 'PAUSED' }]),
        getExactCount('fund_spaces', [{ column: 'status', value: 'CANCELLED' }]),

        getExactCount('manual_payment_submissions', [
          { column: 'status', value: 'PENDING_REVIEW' },
        ]),
        getExactCount('manual_payment_submissions', [
          { column: 'status', value: 'APPROVED' },
        ]),
        getExactCount('manual_payment_submissions', [
          { column: 'status', value: 'REJECTED' },
        ]),

        getExactCount('fund_space_payouts', [
          { column: 'status', value: 'PENDING' },
        ]),
        getExactCount('fund_space_payouts', [
          { column: 'status', value: 'APPROVED' },
        ]),
        getExactCount('fund_space_payouts', [{ column: 'status', value: 'PAID' }]),

        getExactCount('fund_space_disputes', [{ column: 'status', value: 'OPEN' }]),
        getExactCount('fund_space_disputes', [
          { column: 'status', value: 'UNDER_REVIEW' },
        ]),
        getExactCount('fund_space_disputes', [
          { column: 'status', value: 'RESOLVED' },
        ]),

        getExactCount('withdrawals', [{ column: 'status', value: 'PENDING' }]),
        getExactCount('transactions'),
      ]);

      setStats({
        totalUsers,
        pendingVerifications,
        verifiedUsers,

        totalFundSpaces,
        activeFundSpaces,
        formingFundSpaces,
        completedFundSpaces,
        pausedFundSpaces,
        cancelledFundSpaces,

        pendingManualPayments,
        approvedManualPayments,
        rejectedManualPayments,

        payoutsPendingApproval,
        payoutsApprovedNotPaid,
        payoutsPaid,

        openDisputes,
        underReviewDisputes,
        resolvedDisputes,

        pendingWithdrawals,
        transactions,
      });
    } catch (error) {
      console.error('Admin dashboard load error:', error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to load admin control center.'
      );
    } finally {
      setPageLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (loading) return;

    if (!profile?.id) {
      setPageLoading(false);
      setErrorMessage('Unable to identify your admin account. Please log in again.');
      return;
    }

    if (!isAdmin) {
      setPageLoading(false);
      setErrorMessage('You are not authorized to access the admin control center.');
      return;
    }

    loadStats();
  }, [loading, profile?.id, isAdmin, loadStats]);

  const attentionTotal =
    stats.pendingVerifications +
    stats.pendingManualPayments +
    stats.payoutsPendingApproval +
    stats.payoutsApprovedNotPaid +
    stats.openDisputes +
    stats.underReviewDisputes +
    stats.pendingWithdrawals;

  const controlCards: ControlCard[] = [
    {
      title: 'Total Groups',
      value: stats.totalFundSpaces,
      subtitle: `${stats.activeFundSpaces} active`,
      href: '/admin/fund-space',
      icon: <WalletCards className="h-4 w-4" />,
    },
    {
      title: 'Total Users',
      value: stats.totalUsers,
      subtitle: 'All registered profiles',
      href: '/admin/users',
      icon: <Users className="h-4 w-4" />,
    },
    {
      title: 'Pending KYC',
      value: stats.pendingVerifications,
      subtitle: 'Need verification review',
      href: '/admin/verifications?status=PENDING',
      icon: <ShieldCheck className="h-4 w-4" />,
    },
    {
      title: 'MoMo Reviews',
      value: stats.pendingManualPayments,
      subtitle: 'Payment submissions',
      href: '/admin/manual-payment-submissions?status=PENDING_REVIEW',
      icon: <Smartphone className="h-4 w-4" />,
    },
    {
      title: 'Payout Actions',
      value: stats.payoutsPendingApproval + stats.payoutsApprovedNotPaid,
      subtitle: 'Approve or mark paid',
      href: '/admin/fund-space/payouts',
      icon: <HandCoins className="h-4 w-4" />,
    },
    {
      title: 'Open Disputes',
      value: stats.openDisputes + stats.underReviewDisputes,
      subtitle: 'Support cases',
      href: '/admin/fund-space/disputes?status=OPEN',
      icon: <FileWarning className="h-4 w-4" />,
    },
    {
      title: 'Active Groups',
      value: stats.activeFundSpaces,
      subtitle: 'Currently running',
      href: '/admin/fund-space?status=ACTIVE',
      icon: <CheckCircle2 className="h-4 w-4" />,
    },
    {
      title: 'Forming',
      value: stats.formingFundSpaces,
      subtitle: 'Still filling members',
      href: '/admin/fund-space?status=FORMING',
      icon: <BadgeCheck className="h-4 w-4" />,
    },
    {
      title: 'Completed',
      value: stats.completedFundSpaces,
      subtitle: 'Finished all cycles',
      href: '/admin/fund-space?status=COMPLETED',
      icon: <CheckCircle2 className="h-4 w-4" />,
    },
    {
      title: 'Paused',
      value: stats.pausedFundSpaces,
      subtitle: 'Temporarily stopped',
      href: '/admin/fund-space?status=PAUSED',
      icon: <AlertCircle className="h-4 w-4" />,
    },
    {
      title: 'Cancelled',
      value: stats.cancelledFundSpaces,
      subtitle: 'Stopped groups',
      href: '/admin/fund-space?status=CANCELLED',
      icon: <AlertCircle className="h-4 w-4" />,
    },
  ];

  const adminActions: AdminAction[] = [
    {
      title: 'Customer Verification Review',
      description:
        'Approve or reject customer KYC requests submitted by agents and users.',
      href: '/admin/verifications',
      buttonText: 'Review Verifications',
      value: stats.pendingVerifications,
      icon: <ShieldCheck className="h-5 w-5" />,
      tone: stats.pendingVerifications > 0 ? 'amber' : 'emerald',
    },
    {
      title: 'Manual MoMo Payment Submissions',
      description:
        'Check transaction references submitted by members and agents before marking contributions as paid.',
      href: '/admin/manual-payment-submissions',
      buttonText: 'Review Payments',
      value: stats.pendingManualPayments,
      icon: <Smartphone className="h-5 w-5" />,
      tone: stats.pendingManualPayments > 0 ? 'amber' : 'emerald',
    },
    {
      title: 'Fund Space Payout Approval',
      description:
        'Approve ready payouts, then mark approved payouts as paid after money is sent.',
      href: '/admin/fund-space/payouts',
      buttonText: 'Manage Payouts',
      value: stats.payoutsPendingApproval + stats.payoutsApprovedNotPaid,
      icon: <HandCoins className="h-5 w-5" />,
      tone:
        stats.payoutsPendingApproval + stats.payoutsApprovedNotPaid > 0
          ? 'amber'
          : 'emerald',
    },
    {
      title: 'Fund Space Disputes',
      description:
        'Review payment, payout, contribution status, late fee, and customer support cases.',
      href: '/admin/fund-space/disputes',
      buttonText: 'Resolve Disputes',
      value: stats.openDisputes + stats.underReviewDisputes,
      icon: <FileWarning className="h-5 w-5" />,
      tone: stats.openDisputes + stats.underReviewDisputes > 0 ? 'red' : 'emerald',
    },
    {
      title: 'Withdrawal Requests',
      description:
        'Review pending withdrawal requests and make sure user balances are protected.',
      href: '/admin/withdrawals',
      buttonText: 'Review Withdrawals',
      value: stats.pendingWithdrawals,
      icon: <Banknote className="h-5 w-5" />,
      tone: stats.pendingWithdrawals > 0 ? 'amber' : 'emerald',
    },
  ];

  if (loading || pageLoading) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-6 md:px-8">
        <div className="mx-auto flex min-h-[60vh] max-w-7xl items-center justify-center">
          <div className="text-center">
            <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-emerald-700" />
            <h1 className="text-lg font-black text-slate-900">
              Loading admin control center...
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Please wait while TrustPoint loads platform activity.
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-5 md:px-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <section className="rounded-[2rem] bg-gradient-to-br from-emerald-950 via-emerald-900 to-emerald-800 p-5 text-white shadow-sm md:p-8">
          <div className="flex flex-col justify-between gap-6 xl:flex-row xl:items-start">
            <div className="min-w-0 max-w-4xl">
              <p className="mb-5 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-black">
                <LayoutDashboard className="h-4 w-4" />
                Admin Control Center
              </p>

              <h1 className="break-words text-3xl font-black tracking-tight md:text-5xl">
                TrustPoint Admin Dashboard
              </h1>

              <p className="mt-4 max-w-3xl text-sm font-semibold leading-7 text-emerald-50 md:text-base">
                One simple control page for verifications, Fund Spaces, members,
                rounds, MoMo payment submissions, payouts, disputes, and admin
                actions.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href="/admin/fund-space"
                className="inline-flex min-h-9 items-center justify-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 text-xs font-black text-white transition hover:bg-white/20"
              >
                <Bell className="h-3.5 w-3.5" />
                Fund Space
              </Link>

              <Link
                href="/admin/manual-payment-submissions"
                className="inline-flex min-h-9 items-center justify-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 text-xs font-black text-white transition hover:bg-white/20"
              >
                <Smartphone className="h-3.5 w-3.5" />
                Process
              </Link>

              <button
                type="button"
                onClick={() => loadStats(true)}
                disabled={refreshing}
                className="inline-flex min-h-9 items-center justify-center gap-2 rounded-full bg-white px-4 text-xs font-black text-emerald-900 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {refreshing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                Refresh
              </button>
            </div>
          </div>

          <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {controlCards.slice(0, 6).map((card) => (
              <ControlStatCard key={card.title} card={card} />
            ))}
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
            {controlCards.slice(6).map((card) => (
              <ControlStatCard key={card.title} card={card} />
            ))}
          </div>
        </section>

        {errorMessage && (
          <section className="rounded-3xl border border-red-200 bg-red-50 p-5 text-sm font-bold text-red-700">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
              <div className="min-w-0">
                <p className="break-words">{errorMessage}</p>

                {errorMessage.toLowerCase().includes('session') && (
                  <Link
                    href="/auth/login"
                    className="mt-3 inline-flex rounded-xl bg-white px-4 py-2 text-xs font-black text-red-700 shadow-sm"
                  >
                    Go to login
                  </Link>
                )}
              </div>
            </div>
          </section>
        )}

        <section className="grid gap-5 xl:grid-cols-[1fr_380px]">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="min-w-0">
                <h2 className="text-xl font-black text-slate-900">
                  Admin Work Queue
                </h2>
                <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">
                  Start from items that affect customer trust: KYC, payment
                  approval, payout release, and disputes.
                </p>
              </div>

              {attentionTotal > 0 && (
                <span className="inline-flex w-fit rounded-full bg-red-600 px-4 py-2 text-xs font-black text-white">
                  {formatNumber(attentionTotal)} need attention
                </span>
              )}
            </div>

            <div className="mt-5 space-y-3">
              {adminActions.map((action) => (
                <ActionRow key={action.href} action={action} />
              ))}
            </div>
          </div>

          <aside className="space-y-5">
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-black text-slate-900">
                Status Meaning
              </h2>
              <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">
                Completed groups are not the same as active groups.
              </p>

              <div className="mt-5 space-y-3">
                <MiniInfo label="Active" value="Currently running" />
                <MiniInfo label="Forming" value="Still accepting members" />
                <MiniInfo label="Completed" value="Finished all payout cycles" />
                <MiniInfo label="Paused" value="Temporarily stopped" />
                <MiniInfo label="Cancelled" value="Stopped before completion" />
              </div>
            </section>

            <section className="rounded-3xl border border-amber-100 bg-amber-50 p-5">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-1 h-5 w-5 shrink-0 text-amber-700" />

                <div className="min-w-0">
                  <h2 className="text-base font-black text-amber-900">
                    Admin Responsibility Reminder
                  </h2>

                  <p className="mt-2 break-words text-sm font-semibold leading-6 text-amber-700">
                    Verify identities carefully, approve only real MoMo
                    transactions, release payouts only after confirming group
                    readiness, and resolve disputes with clear notes.
                  </p>
                </div>
              </div>
            </section>
          </aside>
        </section>
      </div>
    </main>
  );
}

function ControlStatCard({ card }: { card: ControlCard }) {
  return (
    <Link
      href={card.href}
      className="group min-w-0 rounded-2xl border border-white/70 bg-white/10 p-4 text-white transition hover:-translate-y-0.5 hover:bg-white/20 hover:shadow-lg"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="break-words text-[11px] font-black uppercase tracking-wide text-emerald-50">
          {card.title}
        </p>
        <span className="text-emerald-50 opacity-80 transition group-hover:translate-x-0.5">
          {card.icon || <ArrowRight className="h-4 w-4" />}
        </span>
      </div>

      <p className="mt-3 truncate text-2xl font-black text-white">
        {formatNumber(card.value)}
      </p>

      <p className="mt-2 break-words text-xs font-bold leading-5 text-emerald-50/90">
        {card.subtitle}
      </p>
    </Link>
  );
}

function ActionRow({ action }: { action: AdminAction }) {
  const tone = getToneClass(action.tone);

  return (
    <Link
      href={action.href}
      className={`block rounded-3xl border border-slate-200 bg-slate-50 p-4 transition hover:bg-white hover:shadow-sm ${tone.card}`}
    >
      <div className="grid gap-4 xl:grid-cols-[1fr_auto] xl:items-center">
        <div className="flex min-w-0 items-start gap-3">
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border ${tone.icon}`}
          >
            {action.icon}
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="break-words text-base font-black text-slate-900">
                {action.title}
              </h3>

              {action.value > 0 && (
                <span className="rounded-full bg-red-600 px-2.5 py-1 text-xs font-black text-white">
                  {formatNumber(action.value)}
                </span>
              )}
            </div>

            <p className="mt-1 break-words text-sm font-semibold leading-6 text-slate-500">
              {action.description}
            </p>
          </div>
        </div>

        <div
          className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-black xl:w-56 ${tone.button}`}
        >
          {action.buttonText}
          <ArrowRight className="h-4 w-4" />
        </div>
      </div>
    </Link>
  );
}

function MiniInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-1 break-words text-sm font-black text-slate-900">
        {value}
      </p>
    </div>
  );
}