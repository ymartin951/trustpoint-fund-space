'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Bell,
  CircleDollarSign,
  Clock,
  Home,
  LifeBuoy,
  Loader2,
  RefreshCw,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';

import { useAuth } from '@/contexts/AuthContext';
import type { Database } from '@/lib/database.types';
import { supabase } from '@/lib/supabase/client';

type FundSpaceMember = {
  id: string;
  user_id: string;
  fund_space_id: string;
  contribution_amount: number | null;
  status: string | null;
  joined_at: string | null;
  joined_by_agent?: string | null;
  has_received_payout?: boolean | null;
  payout_order?: number | null;
  position_number?: number | null;
  received_round_number?: number | null;
};

type FundSpace = {
  id: string;
  name: string | null;
  contribution_amount: number;
  status: string;
  member_limit: number | null;
  current_round_number: number | null;
  frequency?: string | null;
  start_date?: string | null;
  completed_at?: string | null;
  created_at: string | null;
};

type WalletAccount = {
  id: string;
  user_id: string;
  available_balance: number | null;
  locked_balance: number | null;
  currency: string | null;
};

type Contribution = {
  id: string;
  fund_space_id: string;
  round_id: string;
  user_id: string;
  amount_due: number;
  amount_paid: number;
  status: string;
  paid_at: string | null;
  payment_reference: string | null;
  created_at: string | null;
};

type Payout = {
  id: string;
  fund_space_id: string;
  round_id: string;
  recipient_user_id: string;
  gross_amount: number;
  net_amount: number;
  platform_fee: number;
  status: string;
  paid_at: string | null;
  created_at: string | null;
};

type NotificationRow = {
  id: string;
  title: string | null;
  message: string | null;
  type: string | null;
  category: string | null;
  priority: string | null;
  is_read: boolean | null;
  action_href?: string | null;
  created_at: string | null;
};

type Transaction = Database['public']['Tables']['transactions']['Row'];

function formatCurrency(amount: number | string | null | undefined) {
  const value = Number(amount || 0);
  const sign = value < 0 ? '-' : '';

  return `${sign}GH₵${Math.abs(value).toLocaleString('en-GH', {
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
  const value = String(status || 'PENDING').toUpperCase();

  if (
    ['ACTIVE', 'VERIFIED', 'PAID', 'COMPLETED', 'SUCCESS', 'APPROVED'].includes(
      value
    )
  ) {
    return 'border-emerald-100 bg-emerald-50 text-emerald-700';
  }

  if (
    [
      'PENDING',
      'PROCESSING',
      'FORMING',
      'PARTIALLY_PAID',
      'PENDING_ADMIN_APPROVAL',
      'PENDING_REVIEW',
      'OVERDUE',
    ].includes(value)
  ) {
    return 'border-amber-100 bg-amber-50 text-amber-700';
  }

  if (
    ['REJECTED', 'FAILED', 'SUSPENDED', 'BLACKLISTED', 'DEFAULTED'].includes(
      value
    )
  ) {
    return 'border-red-100 bg-red-50 text-red-700';
  }

  return 'border-slate-100 bg-slate-50 text-slate-700';
}

function getContributionRemaining(contribution: Contribution | null) {
  if (!contribution) return 0;

  return Math.max(
    Number(contribution.amount_due || 0) - Number(contribution.amount_paid || 0),
    0
  );
}

function getPayoutPosition(member: FundSpaceMember | null) {
  if (!member) return null;

  return member.payout_order || member.position_number || null;
}

function getTransactionDirectionValue(transaction: Transaction) {
  const direction = String(transaction.direction || '').toUpperCase();

  if (direction === 'CREDIT') {
    return Number(transaction.amount || 0);
  }

  if (direction === 'DEBIT') {
    return -Number(transaction.amount || 0);
  }

  return 0;
}

export default function DashboardPage() {
  const { profile, loading } = useAuth();

  const profileRecord = profile as
    | {
        id?: string | null;
        full_name?: string | null;
        status?: string | null;
        verification_status?: string | null;
        trust_score?: number | null;
      }
    | null;

  const [pageLoading, setPageLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const [fundSpaceMember, setFundSpaceMember] =
    useState<FundSpaceMember | null>(null);
  const [fundSpace, setFundSpace] = useState<FundSpace | null>(null);
  const [fundSpaceMemberCount, setFundSpaceMemberCount] = useState(0);

  const [wallet, setWallet] = useState<WalletAccount | null>(null);
  const [pendingContribution, setPendingContribution] =
    useState<Contribution | null>(null);
  const [latestPayout, setLatestPayout] = useState<Payout | null>(null);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>(
    []
  );
  const [recentNotifications, setRecentNotifications] = useState<
    NotificationRow[]
  >([]);

  const loadWallet = useCallback(async (userId: string) => {
    const { error: walletCreateError } = await supabase.rpc(
      'create_user_wallet_if_missing',
      {
        p_user_id: userId,
      }
    );

    if (walletCreateError) {
      console.warn('Wallet creation warning:', walletCreateError.message);
    }

    const { data, error } = await supabase
      .from('wallet_accounts')
      .select('id, user_id, available_balance, locked_balance, currency')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.warn('Wallet load warning:', error.message);
      setWallet(null);
      return;
    }

    setWallet((data as unknown as WalletAccount | null) || null);
  }, []);

  const loadMyFundSpace = useCallback(async (userId: string) => {
    const { data: memberData, error: memberError } = await supabase
      .from('fund_space_members')
      .select('*')
      .eq('user_id', userId)
      .in('status', ['ACTIVE', 'COMPLETED'])
      .order('joined_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (memberError) {
      console.warn('Fund Space member load warning:', memberError.message);
      setFundSpaceMember(null);
      setFundSpace(null);
      setFundSpaceMemberCount(0);
      return null;
    }

    if (!memberData) {
      setFundSpaceMember(null);
      setFundSpace(null);
      setFundSpaceMemberCount(0);
      return null;
    }

    const currentMember = memberData as unknown as FundSpaceMember;
    setFundSpaceMember(currentMember);

    const { data: fundSpaceData, error: fundSpaceError } = await supabase
      .from('fund_spaces')
      .select(
        'id, name, contribution_amount, status, member_limit, current_round_number, frequency, start_date, completed_at, created_at'
      )
      .eq('id', currentMember.fund_space_id)
      .maybeSingle();

    if (fundSpaceError) {
      console.warn('Fund Space load warning:', fundSpaceError.message);
      setFundSpace(null);
      setFundSpaceMemberCount(0);
      return currentMember;
    }

    setFundSpace((fundSpaceData as unknown as FundSpace | null) || null);

    const { count, error: countError } = await supabase
      .from('fund_space_members')
      .select('id', { count: 'exact', head: true })
      .eq('fund_space_id', currentMember.fund_space_id)
      .in('status', ['ACTIVE', 'COMPLETED']);

    if (countError) {
      console.warn('Fund Space member count warning:', countError.message);
      setFundSpaceMemberCount(0);
    } else {
      setFundSpaceMemberCount(count || 0);
    }

    return currentMember;
  }, []);

  const loadPendingContribution = useCallback(
    async (userId: string, fundSpaceId: string | null) => {
      if (!fundSpaceId) {
        setPendingContribution(null);
        return;
      }

      const { data, error } = await supabase
        .from('fund_space_contributions')
        .select(
          'id, fund_space_id, round_id, user_id, amount_due, amount_paid, status, paid_at, payment_reference, created_at'
        )
        .eq('fund_space_id', fundSpaceId)
        .eq('user_id', userId)
        .in('status', ['PENDING', 'PARTIALLY_PAID', 'OVERDUE'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.warn('Pending contribution load warning:', error.message);
        setPendingContribution(null);
        return;
      }

      setPendingContribution((data as unknown as Contribution | null) || null);
    },
    []
  );

  const loadLatestPayout = useCallback(
    async (userId: string, fundSpaceId: string | null) => {
      if (!fundSpaceId) {
        setLatestPayout(null);
        return;
      }

      const { data, error } = await supabase
        .from('fund_space_payouts')
        .select(
          'id, fund_space_id, round_id, recipient_user_id, gross_amount, net_amount, platform_fee, status, paid_at, created_at'
        )
        .eq('fund_space_id', fundSpaceId)
        .eq('recipient_user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.warn('Latest payout load warning:', error.message);
        setLatestPayout(null);
        return;
      }

      setLatestPayout((data as unknown as Payout | null) || null);
    },
    []
  );

  const loadRecentTransactions = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) {
      console.warn('Recent transactions load warning:', error.message);
      setRecentTransactions([]);
      return;
    }

    setRecentTransactions((data || []) as Transaction[]);
  }, []);

  const loadRecentNotifications = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('notifications')
      .select(
        'id, title, message, type, category, priority, is_read, action_href, created_at'
      )
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) {
      console.warn('Recent notifications load warning:', error.message);
      setRecentNotifications([]);
      return;
    }

    setRecentNotifications((data || []) as unknown as NotificationRow[]);
  }, []);

  const loadDashboard = useCallback(
    async (userId: string, showRefreshState = false) => {
      try {
        if (showRefreshState) {
          setRefreshing(true);
        } else {
          setPageLoading(true);
        }

        setErrorMessage('');

        const currentMember = await loadMyFundSpace(userId);
        const fundSpaceId = currentMember?.fund_space_id || null;

        await Promise.all([
          loadWallet(userId),
          loadPendingContribution(userId, fundSpaceId),
          loadLatestPayout(userId, fundSpaceId),
          loadRecentTransactions(userId),
          loadRecentNotifications(userId),
        ]);
      } catch (error: unknown) {
        console.error('Dashboard load error:', error);

        const message =
          error instanceof Error
            ? error.message
            : 'Unable to load dashboard information.';

        setErrorMessage(message);
      } finally {
        setPageLoading(false);
        setRefreshing(false);
      }
    },
    [
      loadMyFundSpace,
      loadWallet,
      loadPendingContribution,
      loadLatestPayout,
      loadRecentTransactions,
      loadRecentNotifications,
    ]
  );

  useEffect(() => {
    let cancelled = false;

    async function start() {
      try {
        setErrorMessage('');

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (cancelled) return;

        if (userError) {
          throw userError;
        }

        const userId = profileRecord?.id || user?.id;

        if (!userId) {
          setErrorMessage(
            'Unable to identify the logged-in user. Please log out and log in again.'
          );
          setPageLoading(false);
          return;
        }

        await loadDashboard(userId);
      } catch (error: unknown) {
        console.error('Dashboard start error:', error);

        if (!cancelled) {
          const message =
            error instanceof Error
              ? error.message
              : 'Unable to load dashboard information.';

          setErrorMessage(message);
          setPageLoading(false);
        }
      }
    }

    if (!loading) {
      start();
    }

    return () => {
      cancelled = true;
    };
  }, [loading, profileRecord?.id, loadDashboard]);

  const verificationStatus = profileRecord?.verification_status ?? 'PENDING';
  const accountStatus = profileRecord?.status ?? 'ACTIVE';
  const trustScore = Number(profileRecord?.trust_score || 0);

  const isVerified = verificationStatus === 'VERIFIED';
  const isActive = accountStatus === 'ACTIVE';

  const availableBalance = Number(wallet?.available_balance || 0);
  const lockedBalance = Number(wallet?.locked_balance || 0);
  const totalWalletBalance = availableBalance + lockedBalance;
  const walletCurrency = wallet?.currency ?? 'GHS';

  const maxMembers = fundSpace?.member_limit ?? 10;
  const formationProgress =
    maxMembers > 0
      ? Math.min((fundSpaceMemberCount / maxMembers) * 100, 100)
      : 0;

  const payoutPosition = getPayoutPosition(fundSpaceMember);
  const pendingContributionRemaining =
    getContributionRemaining(pendingContribution);

  const unreadNotificationCount = recentNotifications.filter(
    (notification) => !notification.is_read
  ).length;

  const confirmedTransactionStats = useMemo(() => {
    const successfulTransactions = recentTransactions.filter((transaction) =>
      ['SUCCESS', 'COMPLETED', 'PAID', 'APPROVED', 'CONFIRMED'].includes(
        String(transaction.status || '').toUpperCase()
      )
    );

    const netRecentMovement = successfulTransactions.reduce(
      (sum, transaction) => sum + getTransactionDirectionValue(transaction),
      0
    );

    const creditValue = successfulTransactions
      .filter(
        (transaction) =>
          String(transaction.direction || '').toUpperCase() === 'CREDIT'
      )
      .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);

    const debitValue = successfulTransactions
      .filter(
        (transaction) =>
          String(transaction.direction || '').toUpperCase() === 'DEBIT'
      )
      .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);

    return {
      successfulCount: successfulTransactions.length,
      netRecentMovement,
      creditValue,
      debitValue,
    };
  }, [recentTransactions]);

  if (loading || pageLoading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-sm rounded-[2rem] border border-slate-200 bg-white p-8 text-center shadow-sm">
          <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-emerald-700" />
          <p className="text-sm font-semibold text-slate-700">
            Loading your TrustPoint dashboard...
          </p>
          <p className="mt-2 text-xs leading-5 text-slate-500">
            Please wait while we check your Fund Space, wallet, payments, and
            notifications.
          </p>
        </div>
      </div>
    );
  }

  if (!isActive) {
    return (
      <main className="min-h-[70vh] bg-slate-50 px-4 py-8">
        <section className="mx-auto max-w-3xl rounded-[2rem] border border-red-100 bg-red-50 p-6 shadow-sm">
          <div className="flex gap-3">
            <AlertTriangle className="mt-1 h-6 w-6 shrink-0 text-red-600" />
            <div>
              <h1 className="text-xl font-black text-red-800">
                Account inactive
              </h1>
              <p className="mt-2 text-sm leading-6 text-red-700">
                Your account is currently inactive. Please contact TrustPoint
                support for help.
              </p>

              <Link
                href="/support"
                className="mt-5 inline-flex items-center justify-center gap-2 rounded-2xl bg-red-700 px-5 py-3 text-sm font-bold text-white hover:bg-red-800"
              >
                Contact Support
                <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="overflow-hidden rounded-[2rem] bg-gradient-to-br from-emerald-950 via-emerald-900 to-emerald-800 text-white shadow-sm">
          <div className="relative p-6 sm:p-8 lg:p-10">
            <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
            <div className="absolute -bottom-24 left-10 h-56 w-56 rounded-full bg-amber-300/10 blur-3xl" />

            <div className="relative flex flex-col justify-between gap-8 lg:flex-row lg:items-center">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex rounded-full bg-white/15 px-4 py-1.5 text-xs font-black uppercase tracking-[0.2em] text-emerald-50 ring-1 ring-white/15">
                    Member Dashboard
                  </span>

                  <span
                    className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${getStatusStyle(
                      verificationStatus
                    )}`}
                  >
                    {formatLabel(verificationStatus)}
                  </span>
                </div>

                <h1 className="mt-5 max-w-3xl break-words text-[clamp(2rem,5vw,3.75rem)] font-black leading-tight [overflow-wrap:anywhere]">
                  Welcome back,{' '}
                  {profileRecord?.full_name || 'TrustPoint Member'}
                </h1>

                <p className="mt-4 max-w-3xl text-sm leading-7 text-emerald-50 sm:text-base">
                  Track your verification, Fund Space group, weekly MoMo
                  payment status, wallet balance, payout position, notifications,
                  and recent transaction records from one clean dashboard.
                </p>

                <div className="mt-6 flex flex-wrap gap-3">
                  <Link
                    href="/"
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-white/10 px-5 py-3 text-sm font-bold text-white ring-1 ring-white/20 hover:bg-white/15"
                  >
                    <Home size={16} />
                    Home
                  </Link>

                  <Link
                    href="/support"
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-bold text-emerald-900 hover:bg-emerald-50"
                  >
                    <LifeBuoy size={16} />
                    Support
                  </Link>

                  <button
                    type="button"
                    onClick={() =>
                      profileRecord?.id
                        ? loadDashboard(profileRecord.id, true)
                        : undefined
                    }
                    disabled={refreshing}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-amber-300 px-5 py-3 text-sm font-black text-emerald-950 hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <RefreshCw
                      className={refreshing ? 'animate-spin' : ''}
                      size={16}
                    />
                    Refresh Records
                  </button>
                </div>
              </div>

              <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:w-[420px]">
                <HeroMiniCard
                  label="Trust Score"
                  value={`${trustScore}`}
                  helper="Build trust by paying on time."
                />

                <HeroMiniCard
                  label="Wallet Currency"
                  value={walletCurrency}
                  helper="Default currency for your wallet."
                />

                <HeroMiniCard
                  label="Unread Alerts"
                  value={`${unreadNotificationCount}`}
                  helper="Recent dashboard notifications."
                />

                <HeroMiniCard
                  label="Fund Space"
                  value={fundSpace ? formatLabel(fundSpace.status) : 'Not Joined'}
                  helper="Your active contribution group."
                />
              </div>
            </div>
          </div>
        </section>

        {errorMessage && (
          <section className="rounded-[1.5rem] border border-red-100 bg-red-50 p-4 text-sm font-medium leading-6 text-red-700">
            {errorMessage}
          </section>
        )}

        {!isVerified && (
          <section className="rounded-[2rem] border border-amber-200 bg-amber-50 p-5 shadow-sm sm:p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex min-w-0 gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                  <ShieldCheck size={24} />
                </div>

                <div className="min-w-0">
                  <h2 className="text-lg font-black text-amber-900">
                    Complete your verification
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-amber-800">
                    You must be verified before joining or paying into a Fund
                    Space contribution group.
                  </p>
                </div>
              </div>

              <Link
                href="/dashboard/verification"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-amber-600 px-5 py-3 text-sm font-black text-white hover:bg-amber-700"
              >
                Go to Verification
                <ArrowRight size={16} />
              </Link>
            </div>
          </section>
        )}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            title="Verification"
            value={formatLabel(verificationStatus)}
            icon={<BadgeCheck size={24} />}
            status={verificationStatus}
            source="Account verification status"
          />

          <MetricCard
            title="Available Wallet"
            value={formatCurrency(availableBalance)}
            icon={<Wallet size={24} />}
            status="ACTIVE"
            source={`Available balance in ${walletCurrency}`}
          />

          <MetricCard
            title="Fund Space Members"
            value={fundSpace ? `${fundSpaceMemberCount}/${maxMembers}` : '0/10'}
            icon={<Users size={24} />}
            status={fundSpace?.status || 'FORMING'}
            source="Active members in your group"
          />

          <MetricCard
            title="Current Round"
            value={`${fundSpace?.current_round_number ?? 0}`}
            icon={<Clock size={24} />}
            status={fundSpace?.status || 'NO_GROUP'}
            source="Current Fund Space round"
          />
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <InfoStatCard
            title="Total Wallet"
            value={formatCurrency(totalWalletBalance)}
            subtitle={`Available ${formatCurrency(
              availableBalance
            )} + Locked ${formatCurrency(lockedBalance)}`}
            icon={<Wallet size={22} />}
          />

          <InfoStatCard
            title="Pending Contribution"
            value={formatCurrency(pendingContributionRemaining)}
            subtitle={
              pendingContribution
                ? `${formatLabel(pendingContribution.status)} contribution`
                : 'No pending contribution'
            }
            icon={<CircleDollarSign size={22} />}
          />

          <InfoStatCard
            title="Latest Payout"
            value={
              latestPayout ? formatCurrency(latestPayout.net_amount) : 'None'
            }
            subtitle={
              latestPayout
                ? `${formatLabel(latestPayout.status)} • ${formatDate(
                    latestPayout.created_at
                  )}`
                : 'No payout record yet'
            }
            icon={<TrendingUp size={22} />}
          />

          <InfoStatCard
            title="Recent Net Movement"
            value={formatCurrency(confirmedTransactionStats.netRecentMovement)}
            subtitle={`${formatCurrency(
              confirmedTransactionStats.creditValue
            )} credits / ${formatCurrency(
              confirmedTransactionStats.debitValue
            )} debits`}
            icon={<TrendingDown size={22} />}
          />
        </section>

        <section className="grid gap-6 xl:grid-cols-3">
          <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6 xl:col-span-2">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-700">
                  My Fund Space
                </p>

                <h2 className="mt-2 break-words text-[clamp(1.5rem,4vw,2rem)] font-black text-slate-950 [overflow-wrap:anywhere]">
                  {fundSpace
                    ? fundSpace.name || 'My Fund Space'
                    : 'You have not joined a Fund Space yet'}
                </h2>

                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                  {fundSpace
                    ? `Weekly contribution: ${formatCurrency(
                        fundSpace.contribution_amount
                      )}`
                    : 'Complete verification and join a trusted rotational contribution group when registration is available.'}
                </p>
              </div>

              <Link
                href={
                  fundSpace
                    ? `/dashboard/fund-space/${fundSpace.id}`
                    : '/dashboard/verification'
                }
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-emerald-800 px-5 py-3 text-sm font-black text-white hover:bg-emerald-900"
              >
                {fundSpace ? 'View My Fund Space' : 'Start Verification'}
                <ArrowRight size={16} />
              </Link>
            </div>

            {fundSpace ? (
              <div className="mt-8">
                <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                  <span className="font-bold text-slate-700">
                    Member progress
                  </span>
                  <span className="font-black text-emerald-800">
                    {Math.round(formationProgress)}%
                  </span>
                </div>

                <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-emerald-700 transition-all"
                    style={{ width: `${formationProgress}%` }}
                  />
                </div>

                <p className="mt-2 text-xs leading-5 text-slate-500">
                  This count is calculated from active and completed Fund Space
                  member records.
                </p>

                <div className="mt-6 grid gap-4 md:grid-cols-3">
                  <DetailBox
                    label="Group Status"
                    value={formatLabel(fundSpace.status)}
                  />

                  <DetailBox
                    label="My Payout Position"
                    value={payoutPosition ? `#${payoutPosition}` : 'Pending'}
                  />

                  <DetailBox
                    label="My Member Status"
                    value={formatLabel(fundSpaceMember?.status || 'ACTIVE')}
                  />
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  <DetailBox
                    label="Current Round"
                    value={`${fundSpace.current_round_number ?? 0}`}
                  />

                  <DetailBox
                    label="Group Limit"
                    value={`${maxMembers} members`}
                  />

                  <DetailBox
                    label="Started"
                    value={formatDate(
                      fundSpace.start_date || fundSpace.created_at
                    )}
                  />
                </div>

                {pendingContribution && (
                  <div className="mt-6 rounded-[1.5rem] border border-amber-200 bg-amber-50 p-5">
                    <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                      <div className="min-w-0">
                        <h3 className="font-black text-amber-950">
                          Pending Weekly Contribution
                        </h3>
                        <p className="mt-1 break-words text-sm leading-6 text-amber-800 [overflow-wrap:anywhere]">
                          Due {formatCurrency(pendingContribution.amount_due)} •
                          Paid {formatCurrency(pendingContribution.amount_paid)} •
                          Remaining {formatCurrency(pendingContributionRemaining)}
                        </p>
                      </div>

                      <Link
                        href={`/dashboard/fund-space/${fundSpace.id}`}
                        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-amber-600 px-5 py-3 text-sm font-black text-white hover:bg-amber-700"
                      >
                        Submit MoMo Payment
                        <ArrowRight size={16} />
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-8 grid gap-4 md:grid-cols-3">
                <FeatureBox
                  icon={<ShieldCheck className="h-5 w-5 text-emerald-700" />}
                  title="Verify account"
                  description="Submit your ID details and selfie for admin approval."
                />

                <FeatureBox
                  icon={<Users className="h-5 w-5 text-emerald-700" />}
                  title="Join group"
                  description="After approval, you can be added to an active Fund Space."
                />

                <FeatureBox
                  icon={
                    <CircleDollarSign className="h-5 w-5 text-emerald-700" />
                  }
                  title="Pay weekly"
                  description="Submit your weekly MoMo payment and follow your payout turn."
                />
              </div>
            )}
          </div>

          <aside className="space-y-6">
            <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <h2 className="text-xl font-black text-slate-950">
                Quick Actions
              </h2>

              <div className="mt-5 space-y-3">
                <QuickAction
                  href={
                    fundSpace
                      ? `/dashboard/fund-space/${fundSpace.id}`
                      : '/dashboard/verification'
                  }
                  label="My Fund Space"
                />
                <QuickAction
                  href="/dashboard/verification"
                  label="Verification"
                />
                <QuickAction
                  href="/dashboard/fund-space/disputes"
                  label="Disputes & Complaints"
                />
                <QuickAction href="/support" label="Support Center" />
              </div>
            </div>

            <div className="rounded-[2rem] border border-emerald-100 bg-emerald-50 p-5 shadow-sm sm:p-6">
              <div className="flex gap-3">
                <ShieldCheck className="mt-1 h-6 w-6 shrink-0 text-emerald-800" />
                <div>
                  <h3 className="font-black text-emerald-950">
                    TrustPoint Reminder
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-emerald-800">
                    Pay your weekly contribution on time to protect your trust
                    score and keep your Fund Space healthy.
                  </p>
                </div>
              </div>
            </div>
          </aside>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Bell className="h-5 w-5 text-emerald-700" />
                  <h2 className="text-xl font-black text-slate-950">
                    Recent Notifications
                  </h2>
                </div>

                <p className="mt-1 text-sm leading-6 text-slate-500">
                  Latest alerts connected to your TrustPoint account.
                </p>
              </div>
            </div>

            <div className="mt-5 overflow-hidden rounded-[1.5rem] border border-slate-100">
              {recentNotifications.length === 0 ? (
                <div className="p-6 text-center text-sm text-slate-500">
                  No notifications yet.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {recentNotifications.map((notification) => {
                    const href = notification.action_href || '/dashboard';

                    return (
                      <Link
                        key={notification.id}
                        href={href}
                        className="block p-4 hover:bg-slate-50"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="break-words text-sm font-black text-slate-950 [overflow-wrap:anywhere]">
                              {notification.title || 'Notification'}
                            </p>
                            <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
                              {notification.message || 'Open to view details.'}
                            </p>
                            <p className="mt-2 text-xs font-semibold text-slate-400">
                              {formatDate(notification.created_at)}
                            </p>
                          </div>

                          {!notification.is_read && (
                            <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-600" />
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
              <div className="min-w-0">
                <h2 className="text-xl font-black text-slate-950">
                  Recent Confirmed Transactions
                </h2>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  Your latest wallet and system transaction records.
                </p>
              </div>

              <Link
                href="/dashboard/transactions"
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-2 text-sm font-black text-slate-700 hover:bg-slate-50"
              >
                View All
                <ArrowRight size={16} />
              </Link>
            </div>

            <div className="mt-5 overflow-hidden rounded-[1.5rem] border border-slate-100">
              {recentTransactions.length === 0 ? (
                <div className="p-6 text-center text-sm text-slate-500">
                  No confirmed transactions yet.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {recentTransactions.map((transaction) => {
                    const isCredit =
                      String(transaction.direction || '').toUpperCase() ===
                      'CREDIT';

                    return (
                      <div
                        key={transaction.id}
                        className="flex flex-col justify-between gap-3 p-4 md:flex-row md:items-center"
                      >
                        <div className="min-w-0">
                          <p className="break-words font-black text-slate-950 [overflow-wrap:anywhere]">
                            {formatLabel(transaction.type)}
                          </p>
                          <p className="mt-1 text-xs leading-5 text-slate-500">
                            {formatDate(transaction.created_at)} •{' '}
                            {formatLabel(transaction.channel)}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-full border px-3 py-1 text-xs font-black ${getStatusStyle(
                              transaction.status
                            )}`}
                          >
                            {formatLabel(transaction.status)}
                          </span>

                          <span
                            className={`rounded-full border px-3 py-1 text-xs font-black ${
                              isCredit
                                ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
                                : 'border-red-100 bg-red-50 text-red-700'
                            }`}
                          >
                            {isCredit ? '+' : '-'}
                            {formatCurrency(transaction.amount)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function HeroMiniCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="min-w-0 rounded-[1.5rem] bg-white/10 p-4 ring-1 ring-white/15 backdrop-blur">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-100">
        {label}
      </p>
      <p className="mt-2 break-words text-2xl font-black text-white [overflow-wrap:anywhere]">
        {value}
      </p>
      <p className="mt-1 text-xs leading-5 text-emerald-50">{helper}</p>
    </div>
  );
}

function MetricCard({
  title,
  value,
  icon,
  status,
  source,
}: {
  title: string;
  value: string;
  icon: ReactNode;
  status: string;
  source: string;
}) {
  return (
    <div className="min-w-0 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-4 inline-flex rounded-2xl bg-emerald-50 p-3 text-emerald-800">
        {icon}
      </div>

      <p className="text-sm font-semibold text-slate-500">{title}</p>

      <h3 className="mt-1 break-words text-[clamp(1.35rem,4vw,1.9rem)] font-black text-slate-950 [overflow-wrap:anywhere]">
        {value}
      </h3>

      <span
        className={`mt-3 inline-flex rounded-full border px-3 py-1 text-xs font-black ${getStatusStyle(
          status
        )}`}
      >
        {formatLabel(status)}
      </span>

      <p className="mt-3 text-xs leading-5 text-slate-400">{source}</p>
    </div>
  );
}

function InfoStatCard({
  title,
  value,
  subtitle,
  icon,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-4 inline-flex rounded-2xl bg-slate-50 p-3 text-slate-700">
        {icon}
      </div>

      <p className="text-sm font-semibold text-slate-500">{title}</p>
      <h3 className="mt-1 break-words text-[clamp(1.35rem,4vw,1.9rem)] font-black text-slate-950 [overflow-wrap:anywhere]">
        {value}
      </h3>
      <p className="mt-2 break-words text-xs leading-5 text-slate-500 [overflow-wrap:anywhere]">
        {subtitle}
      </p>
    </div>
  );
}

function DetailBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-[1.5rem] bg-slate-50 p-5">
      <p className="text-sm font-semibold text-slate-500">{label}</p>
      <p className="mt-1 break-words text-lg font-black text-slate-950 [overflow-wrap:anywhere]">
        {value}
      </p>
    </div>
  );
}

function FeatureBox({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-[1.5rem] bg-slate-50 p-5">
      <div className="mb-3">{icon}</div>
      <p className="text-sm font-black text-slate-900">{title}</p>
      <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
    </div>
  );
}

function QuickAction({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex min-h-14 items-center justify-between gap-3 rounded-[1.25rem] border border-slate-100 p-4 text-sm font-black text-slate-700 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800"
    >
      <span className="break-words [overflow-wrap:anywhere]">{label}</span>
      <ArrowRight className="shrink-0" size={16} />
    </Link>
  );
}