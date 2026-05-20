'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Clock,
  Loader2,
  RefreshCw,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';

import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Database } from '@/lib/database.types';

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

type Transaction = Database['public']['Tables']['transactions']['Row'];

function formatCurrency(amount: number | string | null | undefined) {
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

  return 'border-gray-100 bg-gray-50 text-gray-700';
}

function getPayoutPosition(member: FundSpaceMember | null) {
  if (!member) return null;

  return member.payout_order || member.position_number || null;
}

function getContributionRemaining(contribution: Contribution | null) {
  if (!contribution) return 0;

  return Math.max(
    Number(contribution.amount_due || 0) - Number(contribution.amount_paid || 0),
    0
  );
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

  const [pageLoading, setPageLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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

  const [errorMessage, setErrorMessage] = useState('');

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

        const userId = profile?.id || user?.id;

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
  }, [loading, profile?.id, loadDashboard]);

  const verificationStatus = profile?.verification_status ?? 'PENDING';
  const accountStatus = profile?.status ?? 'ACTIVE';
  const trustScore = profile?.trust_score ?? 0;

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
      .filter((transaction) => String(transaction.direction).toUpperCase() === 'CREDIT')
      .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);

    const debitValue = successfulTransactions
      .filter((transaction) => String(transaction.direction).toUpperCase() === 'DEBIT')
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
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-emerald-600" />
          <p className="text-sm text-gray-500">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!isActive) {
    return (
      <div className="rounded-2xl border border-red-100 bg-red-50 p-6">
        <h2 className="text-xl font-bold text-red-700">Account inactive</h2>
        <p className="mt-2 text-sm text-red-600">
          Your account is currently inactive. Please contact support.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="rounded-3xl bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-600 p-8 text-white shadow-sm">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
          <div>
            <p className="mb-3 inline-flex rounded-full bg-white/15 px-4 py-1 text-sm font-medium">
              Welcome back
            </p>

            <h1 className="text-3xl font-bold md:text-4xl">
              {profile?.full_name || 'TrustPoint Member'}
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-7 text-emerald-50 md:text-base">
              Your dashboard uses confirmed system records only. Wallet balance
              comes from your wallet account, Fund Space member count comes from
              the actual members table, and contributions come from your active
              Fund Space records.
            </p>
          </div>

          <div className="flex flex-col gap-3 md:min-w-[240px]">
            <div className="rounded-2xl bg-white/15 p-5 text-left backdrop-blur">
              <p className="text-sm text-emerald-50">Trust Score</p>
              <p className="mt-1 text-3xl font-black">{trustScore}</p>
              <p className="mt-1 text-xs text-emerald-50">
                Higher score builds more trust.
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                profile?.id ? loadDashboard(profile.id, true) : undefined
              }
              disabled={refreshing}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-bold text-emerald-700 hover:bg-emerald-50 disabled:opacity-60"
            >
              <RefreshCw
                className={refreshing ? 'animate-spin' : ''}
                size={16}
              />
              Refresh Records
            </button>
          </div>
        </div>
      </div>

      {errorMessage && (
        <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      {!isVerified && (
        <div className="rounded-3xl border border-amber-100 bg-amber-50 p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex gap-3">
              <ShieldCheck className="mt-1 h-6 w-6 text-amber-600" />
              <div>
                <h2 className="text-lg font-bold text-amber-800">
                  Complete your verification
                </h2>
                <p className="mt-1 text-sm leading-6 text-amber-700">
                  You must be verified before joining or paying into a Fund
                  Space contribution group.
                </p>
              </div>
            </div>

            <Link
              href="/dashboard/verification"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-600 px-5 py-3 text-sm font-semibold text-white hover:bg-amber-700"
            >
              Go to Verification
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Verification"
          value={formatLabel(verificationStatus)}
          icon={<BadgeCheck size={24} />}
          status={verificationStatus}
          source="Source: profiles.verification_status"
        />

        <MetricCard
          title="Available Wallet"
          value={formatCurrency(availableBalance)}
          icon={<Wallet size={24} />}
          status="ACTIVE"
          source={`Source: wallet_accounts.available_balance (${walletCurrency})`}
        />

        <MetricCard
          title="Fund Space Members"
          value={fundSpace ? `${fundSpaceMemberCount}/${maxMembers}` : '0/10'}
          icon={<Users size={24} />}
          status={fundSpace?.status || 'FORMING'}
          source="Source: fund_space_members active/completed count"
        />

        <MetricCard
          title="Current Round"
          value={`${fundSpace?.current_round_number ?? 0}`}
          icon={<Clock size={24} />}
          status={fundSpace?.status || 'NO_GROUP'}
          source="Source: fund_spaces.current_round_number"
        />
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
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
          value={latestPayout ? formatCurrency(latestPayout.net_amount) : 'None'}
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
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm xl:col-span-2">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-emerald-600">
                Fund Space
              </p>
              <h2 className="mt-2 text-2xl font-bold text-gray-900">
                {fundSpace
                  ? fundSpace.name || 'My Fund Space'
                  : 'You have not joined yet'}
              </h2>
              <p className="mt-2 text-sm leading-6 text-gray-500">
                {fundSpace
                  ? `Weekly contribution: ${formatCurrency(
                      fundSpace.contribution_amount
                    )}`
                  : 'Join a trusted rotational contribution group and start your contribution journey.'}
              </p>
            </div>

            <Link
              href={
                fundSpace
                  ? `/dashboard/fund-space/${fundSpace.id}`
                  : '/dashboard/fund-space/join'
              }
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              {fundSpace ? 'View My Fund Space' : 'Join Fund Space'}
              <ArrowRight size={16} />
            </Link>
          </div>

          {fundSpace ? (
            <div className="mt-8">
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="font-medium text-gray-600">
                  Member progress
                </span>
                <span className="font-bold text-emerald-700">
                  {Math.round(formationProgress)}%
                </span>
              </div>

              <div className="h-3 overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-full rounded-full bg-emerald-600 transition-all"
                  style={{ width: `${formationProgress}%` }}
                />
              </div>

              <p className="mt-2 text-xs text-gray-500">
                Count is calculated directly from active/completed records in
                `fund_space_members`, not from a saved member_count field.
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

              <div className="mt-6 grid gap-4 md:grid-cols-3">
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
                  value={formatDate(fundSpace.start_date || fundSpace.created_at)}
                />
              </div>

              {pendingContribution && (
                <div className="mt-6 rounded-2xl border border-amber-100 bg-amber-50 p-5">
                  <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
                    <div>
                      <h3 className="font-bold text-amber-900">
                        Pending Contribution
                      </h3>
                      <p className="mt-1 text-sm text-amber-700">
                        Due {formatCurrency(pendingContribution.amount_due)} •
                        Paid {formatCurrency(pendingContribution.amount_paid)} •
                        Remaining {formatCurrency(pendingContributionRemaining)}
                      </p>
                    </div>

                    <Link
                      href={`/dashboard/fund-space/${fundSpace.id}`}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-2 text-sm font-bold text-white hover:bg-amber-700"
                    >
                      Pay Contribution
                      <ArrowRight size={16} />
                    </Link>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              <FeatureBox
                icon={<CircleDollarSign className="h-5 w-5 text-gray-500" />}
                title="Choose amount"
                description="Join based on your preferred weekly contribution amount."
              />

              <FeatureBox
                icon={<Users className="h-5 w-5 text-gray-500" />}
                title="Join group"
                description="System places you into a forming or active group."
              />

              <FeatureBox
                icon={<BadgeCheck className="h-5 w-5 text-gray-500" />}
                title="Receive payout"
                description="Receive payout when it reaches your turn."
              />
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-gray-900">Quick Actions</h2>

          <div className="mt-5 space-y-3">
            <QuickAction href="/dashboard/deposit" label="Deposit Money" />
            <QuickAction href="/dashboard/fund-space" label="Fund Space" />
            <QuickAction href="/dashboard/transactions" label="Transactions" />
            <QuickAction href="/dashboard/withdrawals" label="Withdrawals" />
            <QuickAction href="/dashboard/verification" label="Verification" />
          </div>

          <div className="mt-6 rounded-2xl bg-emerald-50 p-5">
            <h3 className="font-bold text-emerald-800">TrustPoint Reminder</h3>
            <p className="mt-2 text-sm leading-6 text-emerald-700">
              Always contribute on time to protect your trust score and keep
              your Fund Space active.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              Recent Confirmed Transactions
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              These records come from the `transactions` table only. Provider
              payment attempts are shown separately on the transactions page.
            </p>
          </div>

          <Link
            href="/dashboard/transactions"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50"
          >
            View All
            <ArrowRight size={16} />
          </Link>
        </div>

        <div className="mt-5 overflow-hidden rounded-2xl border border-gray-100">
          {recentTransactions.length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-500">
              No confirmed transactions yet.
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {recentTransactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex flex-col justify-between gap-3 p-4 md:flex-row md:items-center"
                >
                  <div>
                    <p className="font-bold text-gray-900">
                      {formatLabel(transaction.type)}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      {formatDate(transaction.created_at)} •{' '}
                      {formatLabel(transaction.channel)}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-bold ${getStatusStyle(
                        transaction.status
                      )}`}
                    >
                      {formatLabel(transaction.status)}
                    </span>

                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-bold ${
                        String(transaction.direction).toUpperCase() === 'CREDIT'
                          ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
                          : 'border-red-100 bg-red-50 text-red-700'
                      }`}
                    >
                      {String(transaction.direction).toUpperCase() === 'CREDIT'
                        ? '+'
                        : '-'}
                      {formatCurrency(transaction.amount)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
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
  icon: React.ReactNode;
  status: string;
  source: string;
}) {
  return (
    <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
      <div className="mb-4 inline-flex rounded-2xl bg-emerald-50 p-3 text-emerald-700">
        {icon}
      </div>

      <p className="text-sm text-gray-500">{title}</p>

      <h3 className="mt-1 text-2xl font-black text-gray-900">{value}</h3>

      <span
        className={`mt-3 inline-flex rounded-full border px-3 py-1 text-xs font-bold ${getStatusStyle(
          status
        )}`}
      >
        {formatLabel(status)}
      </span>

      <p className="mt-3 text-xs leading-5 text-gray-400">{source}</p>
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
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
      <div className="mb-4 inline-flex rounded-2xl bg-slate-50 p-3 text-slate-700">
        {icon}
      </div>

      <p className="text-sm text-gray-500">{title}</p>
      <h3 className="mt-1 text-2xl font-black text-gray-900">{value}</h3>
      <p className="mt-2 text-xs leading-5 text-gray-500">{subtitle}</p>
    </div>
  );
}

function DetailBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-gray-50 p-5">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1 text-lg font-bold text-gray-900">{value}</p>
    </div>
  );
}

function FeatureBox({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl bg-gray-50 p-5">
      <div className="mb-3">{icon}</div>
      <p className="text-sm font-semibold text-gray-800">{title}</p>
      <p className="mt-1 text-sm text-gray-500">{description}</p>
    </div>
  );
}

function QuickAction({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-2xl border border-gray-100 p-4 text-sm font-semibold text-gray-700 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
    >
      {label}
      <ArrowRight size={16} />
    </Link>
  );
}