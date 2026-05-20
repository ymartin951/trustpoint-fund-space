'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  AlertCircle,
  ArrowLeft,
  Banknote,
  CalendarDays,
  CheckCircle2,
  HandCoins,
  Loader2,
  PauseCircle,
  PlayCircle,
  RefreshCw,
  Rocket,
  ShieldAlert,
  Trophy,
  Users,
  Wallet,
  XCircle,
} from 'lucide-react';

import { supabase } from '@/lib/supabase/client';
import type { Database, Json } from '@/lib/supabase/database.types';

type FundSpace = Database['public']['Tables']['fund_spaces']['Row'];
type FundSpaceMember =
  Database['public']['Tables']['fund_space_members']['Row'];
type Round = Database['public']['Tables']['fund_space_rounds']['Row'];
type Contribution =
  Database['public']['Tables']['fund_space_contributions']['Row'];
type Payout = Database['public']['Tables']['fund_space_payouts']['Row'];

type AdminProfile = {
  id: string;
  role: string | null;
  status: string | null;
  is_blacklisted: boolean | null;
};

type FundSpaceStatus =
  | 'FORMING'
  | 'ACTIVE'
  | 'PAUSED'
  | 'COMPLETED'
  | 'CANCELLED';

type MemberStatus = 'ACTIVE' | 'DEFAULTED';

type ProfileSummary = Pick<
  Database['public']['Tables']['profiles']['Row'],
  'id' | 'full_name' | 'phone' | 'email' | 'verification_status' | 'trust_score'
>;

type MemberWithProfile = FundSpaceMember & {
  profile: ProfileSummary | null;
};

type ContributionWithProfile = Contribution & {
  profile: ProfileSummary | null;
};

type PayoutWithProfile = Payout & {
  profile: ProfileSummary | null;
};

type RpcResponse = {
  success?: boolean;
  message?: string;
  error?: string;
};

type ActivateFundSpaceRpcSupabase = typeof supabase & {
  rpc: (
    fn: 'activate_fund_space',
    args: { p_fund_space_id: string }
  ) => Promise<{
    data: Json | null;
    error: Error | null;
  }>;
};

type MemberRiskSummary = MemberWithProfile & {
  totalDue: number;
  totalPaid: number;
  balance: number;
  riskyContributionCount: number;
  overdueContributionCount: number;
  failedContributionCount: number;
  defaultedContributionCount: number;
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
  const value = String(status || 'PENDING').toUpperCase();

  if (
    [
      'ACTIVE',
      'PAID',
      'CONFIRMED',
      'APPROVED',
      'COMPLETED',
      'VERIFIED',
      'APPROVED_FOR_PAYOUT',
    ].includes(value)
  ) {
    return 'bg-emerald-50 text-emerald-700 border-emerald-100';
  }

  if (
    [
      'PENDING',
      'FORMING',
      'PENDING_ADMIN_APPROVAL',
      'COLLECTING',
      'READY_FOR_PAYOUT',
      'READY_FOR_ADMIN_APPROVAL',
      'PARTIALLY_PAID',
    ].includes(value)
  ) {
    return 'bg-amber-50 text-amber-700 border-amber-100';
  }

  if (value === 'PAUSED') {
    return 'bg-purple-50 text-purple-700 border-purple-100';
  }

  if (
    [
      'REJECTED',
      'FAILED',
      'OVERDUE',
      'DEFAULTED',
      'SUSPENDED',
      'CANCELLED',
      'REMOVED',
    ].includes(value)
  ) {
    return 'bg-red-50 text-red-700 border-red-100';
  }

  return 'bg-gray-50 text-gray-700 border-gray-100';
}

function getSafeOrderValue(member: MemberWithProfile) {
  return member.payout_order || member.position_number || 999999;
}

function parseRpcResponse(data: Json | null): RpcResponse {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return {};
  }

  return data as RpcResponse;
}

function isAdminRole(role?: string | null) {
  return role === 'ADMIN' || role === 'SUPER_ADMIN';
}

export default function AdminFundSpaceDetailsPage() {
  const router = useRouter();
  const params = useParams();

  const rawFundSpaceId = Array.isArray(params.id)
    ? params.id[0]
    : typeof params.id === 'string'
      ? params.id
      : '';

  const fundSpaceId = decodeURIComponent(rawFundSpaceId || '').trim();

  const [adminProfile, setAdminProfile] = useState<AdminProfile | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [memberActionLoadingId, setMemberActionLoadingId] = useState<
    string | null
  >(null);

  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [fundSpace, setFundSpace] = useState<FundSpace | null>(null);
  const [members, setMembers] = useState<MemberWithProfile[]>([]);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [contributions, setContributions] = useState<
    ContributionWithProfile[]
  >([]);
  const [payouts, setPayouts] = useState<PayoutWithProfile[]>([]);

  useEffect(() => {
    if (!fundSpaceId || fundSpaceId === 'undefined' || fundSpaceId === 'null') {
      setErrorMessage(
        'Fund Space ID is missing. Please go back and open the group again.'
      );
      setLoading(false);
      return;
    }

    loadPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fundSpaceId]);

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
      throw new Error('You do not have permission to view this Fund Space.');
    }

    if (profile.status !== 'ACTIVE') {
      throw new Error('Your admin account must be active.');
    }

    if (profile.is_blacklisted) {
      throw new Error('This admin account cannot manage Fund Space groups.');
    }

    setAdminProfile(profile);

    return profile;
  }

  async function loadProfiles(userIds: string[]) {
    const cleanUserIds = Array.from(new Set(userIds.filter(Boolean)));

    if (cleanUserIds.length === 0) {
      return new Map<string, ProfileSummary>();
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, phone, email, verification_status, trust_score')
      .in('id', cleanUserIds);

    if (error) {
      console.warn('Profile load warning:', error.message);
      return new Map<string, ProfileSummary>();
    }

    return new Map(
      ((data || []) as ProfileSummary[]).map((profile) => [
        profile.id,
        profile,
      ])
    );
  }

  async function loadPage(showRefreshState = false) {
    try {
      if (showRefreshState) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setErrorMessage('');
      setSuccessMessage('');

      await checkAdminAccess();

      const { data: fundSpaceData, error: fundSpaceError } = await supabase
        .from('fund_spaces')
        .select('*')
        .eq('id', fundSpaceId)
        .maybeSingle();

      if (fundSpaceError) {
        throw fundSpaceError;
      }

      if (!fundSpaceData) {
        setErrorMessage('Fund Space group was not found.');
        setFundSpace(null);
        return;
      }

      const [
        memberResponse,
        roundResponse,
        contributionResponse,
        payoutResponse,
      ] = await Promise.all([
        supabase
          .from('fund_space_members')
          .select('*')
          .eq('fund_space_id', fundSpaceId)
          .order('payout_order', { ascending: true, nullsFirst: false }),

        supabase
          .from('fund_space_rounds')
          .select('*')
          .eq('fund_space_id', fundSpaceId)
          .order('round_number', { ascending: true }),

        supabase
          .from('fund_space_contributions')
          .select('*')
          .eq('fund_space_id', fundSpaceId)
          .order('created_at', { ascending: false }),

        supabase
          .from('fund_space_payouts')
          .select('*')
          .eq('fund_space_id', fundSpaceId)
          .order('created_at', { ascending: false }),
      ]);

      if (memberResponse.error) {
        throw memberResponse.error;
      }

      if (roundResponse.error) {
        console.warn('Rounds load warning:', roundResponse.error.message);
      }

      if (contributionResponse.error) {
        console.warn(
          'Contributions load warning:',
          contributionResponse.error.message
        );
      }

      if (payoutResponse.error) {
        console.warn('Payouts load warning:', payoutResponse.error.message);
      }

      const rawMembers = (memberResponse.data || []) as FundSpaceMember[];
      const rawRounds = (roundResponse.data || []) as Round[];
      const rawContributions = (contributionResponse.data ||
        []) as Contribution[];
      const rawPayouts = (payoutResponse.data || []) as Payout[];

      const profileMap = await loadProfiles([
        ...rawMembers.map((item) => item.user_id),
        ...rawContributions.map((item) => item.user_id),
        ...rawPayouts.map((item) => item.recipient_user_id),
      ]);

      setFundSpace(fundSpaceData as FundSpace);

      setMembers(
        rawMembers.map((member) => ({
          ...member,
          profile: profileMap.get(member.user_id) || null,
        }))
      );

      setRounds(rawRounds);

      setContributions(
        rawContributions.map((contribution) => ({
          ...contribution,
          profile: profileMap.get(contribution.user_id) || null,
        }))
      );

      setPayouts(
        rawPayouts.map((payout) => ({
          ...payout,
          profile: profileMap.get(payout.recipient_user_id) || null,
        }))
      );
    } catch (error: unknown) {
      console.error('Admin Fund Space details load error:', error);

      const message =
        error instanceof Error
          ? error.message
          : 'Unable to load Fund Space details.';

      setErrorMessage(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function updateGroupStatus(nextStatus: FundSpaceStatus) {
    if (!fundSpaceId) return;

    const confirmed = window.confirm(
      `Are you sure you want to change this Fund Space status to ${nextStatus}?`
    );

    if (!confirmed) return;

    try {
      setActionLoading(true);
      setErrorMessage('');
      setSuccessMessage('');

      const { error } = await supabase
        .from('fund_spaces')
        .update({
          status: nextStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', fundSpaceId);

      if (error) {
        throw error;
      }

      setSuccessMessage(
        `Fund Space status changed to ${formatLabel(nextStatus)}.`
      );
      await loadPage(true);
    } catch (error: unknown) {
      console.error('Fund Space status update error:', error);

      const message =
        error instanceof Error
          ? error.message
          : 'Unable to update Fund Space status.';

      setErrorMessage(message);
    } finally {
      setActionLoading(false);
    }
  }

  async function updateMemberStatus(
    member: MemberWithProfile,
    nextStatus: MemberStatus
  ) {
    const name = member.profile?.full_name || 'this member';

    const confirmed = window.confirm(
      `Are you sure you want to change ${name}'s member status to ${nextStatus}?`
    );

    if (!confirmed) return;

    try {
      setMemberActionLoadingId(member.id);
      setErrorMessage('');
      setSuccessMessage('');

      const { error } = await supabase
        .from('fund_space_members')
        .update({
          status: nextStatus,
        })
        .eq('id', member.id)
        .eq('fund_space_id', fundSpaceId);

      if (error) {
        throw error;
      }

      setSuccessMessage(`${name} has been marked as ${formatLabel(nextStatus)}.`);
      await loadPage(true);
    } catch (error: unknown) {
      console.error('Member status update error:', error);

      const message =
        error instanceof Error
          ? error.message
          : 'Unable to update member status.';

      setErrorMessage(message);
    } finally {
      setMemberActionLoadingId(null);
    }
  }

  async function activateGroup() {
    if (!fundSpaceId) return;

    const confirmed = window.confirm(
      'Are you sure you want to activate this Fund Space group? This should only be done when the group is full and ready.'
    );

    if (!confirmed) return;

    try {
      setActionLoading(true);
      setErrorMessage('');
      setSuccessMessage('');

      const typedSupabase = supabase as ActivateFundSpaceRpcSupabase;

      const { data, error } = await typedSupabase.rpc('activate_fund_space', {
        p_fund_space_id: fundSpaceId,
      });

      if (error) {
        throw error;
      }

      const result = parseRpcResponse(data);

      if (result.success === false) {
        throw new Error(result.message || result.error || 'Activation failed.');
      }

      setSuccessMessage(result.message || 'Fund Space activated successfully.');
      await loadPage(true);
    } catch (error: unknown) {
      console.error('Activate Fund Space error:', error);

      const message =
        error instanceof Error
          ? error.message
          : 'Unable to activate Fund Space.';

      setErrorMessage(message);
    } finally {
      setActionLoading(false);
    }
  }

  const sortedMembers = useMemo(() => {
    return [...members].sort(
      (a, b) => getSafeOrderValue(a) - getSafeOrderValue(b)
    );
  }, [members]);

  const roundByRecipientUserId = useMemo(() => {
    return new Map(rounds.map((round) => [round.recipient_user_id, round]));
  }, [rounds]);

  const roundByRoundNumber = useMemo(() => {
    return new Map(rounds.map((round) => [round.round_number, round]));
  }, [rounds]);

  const payoutOrderSchedule = useMemo(() => {
    return sortedMembers.map((member, index) => {
      const payoutOrder =
        member.payout_order || member.position_number || index + 1;

      const matchingRound =
        roundByRecipientUserId.get(member.user_id) ||
        roundByRoundNumber.get(payoutOrder) ||
        null;

      return {
        ...member,
        payoutOrder,
        matchingRound,
      };
    });
  }, [sortedMembers, roundByRecipientUserId, roundByRoundNumber]);

  const memberRiskSummaries = useMemo<MemberRiskSummary[]>(() => {
    return sortedMembers
      .map((member) => {
        const memberContributions = contributions.filter(
          (item) => item.user_id === member.user_id
        );

        const riskyContributions = memberContributions.filter((item) =>
          ['OVERDUE', 'FAILED', 'DEFAULTED'].includes(item.status || '')
        );

        const totalDue = memberContributions.reduce(
          (sum, item) => sum + Number(item.amount_due || 0),
          0
        );

        const totalPaid = memberContributions.reduce(
          (sum, item) => sum + Number(item.amount_paid || 0),
          0
        );

        return {
          ...member,
          totalDue,
          totalPaid,
          balance: Math.max(totalDue - totalPaid, 0),
          riskyContributionCount: riskyContributions.length,
          overdueContributionCount: memberContributions.filter(
            (item) => item.status === 'OVERDUE'
          ).length,
          failedContributionCount: memberContributions.filter(
            (item) => item.status === 'FAILED'
          ).length,
          defaultedContributionCount: memberContributions.filter(
            (item) => item.status === 'DEFAULTED'
          ).length,
        };
      })
      .filter(
        (member) =>
          member.status === 'DEFAULTED' ||
          member.riskyContributionCount > 0 ||
          member.balance > 0
      )
      .sort((a, b) => {
        if (a.status === 'DEFAULTED' && b.status !== 'DEFAULTED') return -1;
        if (a.status !== 'DEFAULTED' && b.status === 'DEFAULTED') return 1;
        return b.balance - a.balance;
      });
  }, [contributions, sortedMembers]);

  const activeMembers = members.filter(
    (member) => member.status === 'ACTIVE'
  ).length;

  const defaultedMembers = members.filter(
    (member) => member.status === 'DEFAULTED'
  ).length;

  const paidOutMembers = members.filter(
    (member) => member.has_received_payout
  ).length;

  const totalContributionDue = contributions.reduce(
    (total, item) => total + Number(item.amount_due || 0),
    0
  );

  const totalContributionPaid = contributions.reduce(
    (total, item) => total + Number(item.amount_paid || 0),
    0
  );

  const totalNetPayout = payouts.reduce(
    (total, item) => total + Number(item.net_amount || 0),
    0
  );

  const currentRound =
    rounds.find(
      (round) => round.round_number === fundSpace?.current_round_number
    ) || null;

  const memberLimit = fundSpace?.member_limit || 10;

  const groupProgress =
    memberLimit > 0
      ? Math.min(Math.round((activeMembers / memberLimit) * 100), 100)
      : 0;

  const canActivate =
    fundSpace?.status === 'FORMING' && activeMembers >= memberLimit;

  const canPause =
    fundSpace?.status === 'ACTIVE' || fundSpace?.status === 'FORMING';

  const canResume = fundSpace?.status === 'PAUSED';

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-emerald-600" />
          <p className="text-sm text-gray-500">
            Loading Fund Space details...
          </p>
        </div>
      </div>
    );
  }

  if (!adminProfile && errorMessage) {
    return (
      <div className="space-y-5">
        <button
          type="button"
          onClick={() => router.push('/admin/fund-space')}
          className="inline-flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-gray-900"
        >
          <ArrowLeft size={16} />
          Back to Fund Space
        </button>

        <div className="rounded-3xl border border-red-100 bg-red-50 p-6 text-red-700">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />

            <div>
              <h2 className="text-xl font-black">
                Unable to load Fund Space
              </h2>

              <p className="mt-2 text-sm">{errorMessage}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (errorMessage && !fundSpace) {
    return (
      <div className="space-y-5">
        <button
          type="button"
          onClick={() => router.push('/admin/fund-space')}
          className="inline-flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-gray-900"
        >
          <ArrowLeft size={16} />
          Back to Fund Space
        </button>

        <div className="rounded-3xl border border-red-100 bg-red-50 p-6 text-red-700">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />

            <div>
              <h2 className="text-xl font-black">
                Unable to load Fund Space
              </h2>

              <p className="mt-2 text-sm">{errorMessage}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <button
        type="button"
        onClick={() => router.push('/admin/fund-space')}
        className="inline-flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-gray-900"
      >
        <ArrowLeft size={16} />
        Back to Fund Space
      </button>

      {successMessage && <AlertBox type="success" message={successMessage} />}

      {errorMessage && <AlertBox type="error" message={errorMessage} />}

      <div className="rounded-3xl bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-600 p-6 text-white shadow-sm md:p-8">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
          <div>
            <p className="mb-3 inline-flex rounded-full bg-white/15 px-4 py-1 text-sm font-medium">
              Admin Fund Space Details
            </p>

            <h1 className="text-3xl font-black md:text-4xl">
              {fundSpace?.name || 'TrustPoint Fund Space'}
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-7 text-emerald-50 md:text-base">
              Weekly contribution of{' '}
              <span className="font-bold">
                {formatCurrency(fundSpace?.contribution_amount)}
              </span>{' '}
              with a {memberLimit}-member rotational payout structure.
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              <span
                className={`rounded-full border px-3 py-1 text-xs font-bold ${getStatusStyle(
                  fundSpace?.status
                )}`}
              >
                {formatLabel(fundSpace?.status || 'FORMING')}
              </span>

              <span className="rounded-full border border-white/20 bg-white/15 px-3 py-1 text-xs font-bold text-white">
                Round {fundSpace?.current_round_number || 0}
              </span>

              <span className="rounded-full border border-white/20 bg-white/15 px-3 py-1 text-xs font-bold text-white">
                Started: {formatDate(fundSpace?.start_date)}
              </span>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/admin/fund-space/payouts"
                className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-bold text-emerald-700 hover:bg-emerald-50"
              >
                <Banknote size={16} />
                Payout Approvals
              </Link>

              <Link
                href="/admin/fund-space/contributions"
                className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-4 py-3 text-sm font-bold text-white ring-1 ring-white/20 hover:bg-white/20"
              >
                <HandCoins size={16} />
                Contributions
              </Link>

              {canActivate && (
                <button
                  type="button"
                  onClick={activateGroup}
                  disabled={actionLoading}
                  className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-4 py-3 text-sm font-bold text-white ring-1 ring-white/20 hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Rocket size={16} />
                  Activate Group
                </button>
              )}

              {canPause && (
                <button
                  type="button"
                  onClick={() => updateGroupStatus('PAUSED')}
                  disabled={actionLoading}
                  className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-4 py-3 text-sm font-bold text-white ring-1 ring-white/20 hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <PauseCircle size={16} />
                  Pause Group
                </button>
              )}

              {canResume && (
                <button
                  type="button"
                  onClick={() => updateGroupStatus('ACTIVE')}
                  disabled={actionLoading}
                  className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-4 py-3 text-sm font-bold text-white ring-1 ring-white/20 hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <PlayCircle size={16} />
                  Resume Group
                </button>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => loadPage(true)}
            disabled={refreshing || actionLoading}
            className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw
              size={16}
              className={refreshing || actionLoading ? 'animate-spin' : ''}
            />
            Refresh
          </button>
        </div>
      </div>

      {!canActivate && fundSpace?.status === 'FORMING' && (
        <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm font-semibold text-amber-700">
          This group can be activated after it reaches {memberLimit} active
          members. Current active members: {activeMembers}/{memberLimit}.
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="Active Members"
          value={`${activeMembers}/${memberLimit}`}
          icon={<Users size={24} />}
          progress={groupProgress}
          color="emerald"
        />

        <SummaryCard
          title="Members Paid Out"
          value={String(paidOutMembers)}
          icon={<Trophy size={24} />}
          color="emerald"
        />

        <SummaryCard
          title="Defaulted Members"
          value={String(defaultedMembers)}
          icon={<ShieldAlert size={24} />}
          color="red"
        />

        <SummaryCard
          title="Net Payout Total"
          value={formatCurrency(totalNetPayout)}
          icon={<Wallet size={24} />}
          color="emerald"
        />
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <ValuePanel
          title="Contribution Due"
          value={formatCurrency(totalContributionDue)}
        />

        <ValuePanel
          title="Contribution Paid"
          value={formatCurrency(totalContributionPaid)}
          variant="emerald"
        />

        <ValuePanel
          title="Current Round"
          value={`Round ${fundSpace?.current_round_number || 0}`}
          description={`Deadline: ${formatDate(
            currentRound?.contribution_deadline
          )}`}
        />
      </div>

      {memberRiskSummaries.length > 0 && (
        <div className="rounded-3xl border border-red-100 bg-red-50 p-5 shadow-sm md:p-6">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div>
              <h2 className="text-xl font-black text-red-800">
                Member Default Management
              </h2>

              <p className="mt-1 text-sm text-red-700">
                Review risky members, mark them as defaulted, or restore them to
                active after payment is resolved.
              </p>
            </div>

            <span className="rounded-full border border-red-200 bg-white px-4 py-2 text-sm font-bold text-red-700">
              {memberRiskSummaries.length} member
              {memberRiskSummaries.length === 1 ? '' : 's'}
            </span>
          </div>

          <div className="mt-6 overflow-hidden rounded-2xl border border-red-100 bg-white">
            <div className="divide-y divide-red-50">
              {memberRiskSummaries.map((member) => (
                <RiskMemberRow
                  key={member.id}
                  member={member}
                  loading={memberActionLoadingId === member.id}
                  onUpdateStatus={updateMemberStatus}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm md:p-6 xl:col-span-2">
          <h2 className="text-xl font-black text-gray-900">
            Payout Order Schedule
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Full weekly receiver order for this Fund Space.
          </p>

          <div className="mt-6 overflow-hidden rounded-2xl border border-gray-100">
            {payoutOrderSchedule.length === 0 ? (
              <EmptyBlock message="No payout order has been generated yet." />
            ) : (
              <div className="divide-y divide-gray-100">
                {payoutOrderSchedule.map((member) => {
                  const round = member.matchingRound;

                  return (
                    <div
                      key={member.id}
                      className="flex flex-col justify-between gap-4 p-4 md:flex-row md:items-center"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-sm font-black text-emerald-700">
                          #{member.payoutOrder}
                        </div>

                        <div>
                          <p className="font-bold text-gray-900">
                            Week {member.payoutOrder} →{' '}
                            {member.profile?.full_name ||
                              `Member ${member.payoutOrder}`}
                          </p>

                          <p className="mt-1 text-xs text-gray-500">
                            {member.profile?.phone || 'No phone'} • Trust
                            Score: {member.profile?.trust_score ?? 0}
                          </p>

                          {round ? (
                            <p className="mt-1 text-xs text-gray-500">
                              Round {round.round_number} •{' '}
                              {formatDate(round.week_start_date)} -{' '}
                              {formatDate(round.week_end_date)}
                            </p>
                          ) : (
                            <p className="mt-1 text-xs text-gray-500">
                              Round date will appear when generated.
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {member.has_received_payout && (
                          <span className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                            Received
                          </span>
                        )}

                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-bold ${getStatusStyle(
                            round?.status || member.status
                          )}`}
                        >
                          {formatLabel(round?.status || member.status)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm md:p-6">
          <h2 className="text-xl font-black text-gray-900">Current Round</h2>

          {currentRound ? (
            <div className="mt-5 space-y-4">
              <InfoPanel
                label="Round Number"
                value={`Round ${currentRound.round_number}`}
              />

              <InfoPanel
                label="Recipient"
                value={
                  members.find(
                    (member) => member.user_id === currentRound.recipient_user_id
                  )?.profile?.full_name || 'Unknown recipient'
                }
              />

              <InfoPanel
                label="Expected Total"
                value={formatCurrency(currentRound.expected_total_amount)}
              />

              <InfoPanel
                label="Deadline"
                value={formatDate(currentRound.contribution_deadline)}
              />

              <span
                className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${getStatusStyle(
                  currentRound.status
                )}`}
              >
                {formatLabel(currentRound.status)}
              </span>
            </div>
          ) : (
            <p className="mt-4 text-sm leading-6 text-gray-500">
              No current round is available yet.
            </p>
          )}
        </div>
      </div>

      <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm md:p-6">
        <h2 className="text-xl font-black text-gray-900">Members</h2>

        <div className="mt-6 space-y-4 lg:hidden">
          {sortedMembers.length === 0 ? (
            <EmptyBlock message="No members found." />
          ) : (
            sortedMembers.map((member) => (
              <MemberMobileCard
                key={member.id}
                member={member}
                loading={memberActionLoadingId === member.id}
                onUpdateStatus={updateMemberStatus}
              />
            ))
          )}
        </div>

        <div className="mt-6 hidden overflow-hidden rounded-2xl border border-gray-100 lg:block">
          {sortedMembers.length === 0 ? (
            <EmptyBlock message="No members found." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-left">
                <thead className="bg-gray-50">
                  <tr>
                    <TableHead>Member</TableHead>
                    <TableHead>Payout Order</TableHead>
                    <TableHead>Contribution</TableHead>
                    <TableHead>Received Payout</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead align="right">Action</TableHead>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                  {sortedMembers.map((member) => (
                    <MemberTableRow
                      key={member.id}
                      member={member}
                      loading={memberActionLoadingId === member.id}
                      onUpdateStatus={updateMemberStatus}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <RecordList
          title="Recent Contributions"
          emptyMessage="No contribution records found."
          items={contributions.slice(0, 15)}
          renderItem={(item) => (
            <div
              key={item.id}
              className="flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-center"
            >
              <div>
                <p className="font-semibold text-gray-900">
                  {item.profile?.full_name || 'Unknown Member'}
                </p>

                <p className="text-xs text-gray-500">
                  Due: {formatCurrency(item.amount_due)} • Paid:{' '}
                  {formatCurrency(item.amount_paid)}
                </p>

                <p className="mt-1 text-xs text-gray-500">
                  Method: {item.payment_method || 'Not set'} • Ref:{' '}
                  {item.payment_reference || 'None'}
                </p>
              </div>

              <span
                className={`w-fit rounded-full border px-3 py-1 text-xs font-bold ${getStatusStyle(
                  item.status
                )}`}
              >
                {formatLabel(item.status)}
              </span>
            </div>
          )}
        />

        <RecordList
          title="Recent Payouts"
          emptyMessage="No payout records found."
          items={payouts.slice(0, 15)}
          renderItem={(item) => (
            <div
              key={item.id}
              className="flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-center"
            >
              <div>
                <p className="font-semibold text-gray-900">
                  {item.profile?.full_name || 'Unknown Recipient'}
                </p>

                <p className="text-xs text-gray-500">
                  Net: {formatCurrency(item.net_amount)} • Gross:{' '}
                  {formatCurrency(item.gross_amount)} • Fee:{' '}
                  {formatCurrency(item.platform_fee)}
                </p>

                <p className="mt-1 text-xs text-gray-500">
                  Method: {item.payout_method || 'Not set'} • Ref:{' '}
                  {item.payout_reference || 'None'}
                </p>
              </div>

              <span
                className={`w-fit rounded-full border px-3 py-1 text-xs font-bold ${getStatusStyle(
                  item.status
                )}`}
              >
                {formatLabel(item.status)}
              </span>
            </div>
          )}
        />
      </div>

      <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-6">
        <h2 className="text-lg font-black text-emerald-800">Admin Note</h2>

        <p className="mt-2 text-sm leading-6 text-emerald-700">
          This page is for monitoring and basic admin control of one Fund Space
          group. Payout approval, rejection, and marking payout as paid should
          still be handled from the Fund Space Payouts page.
        </p>
      </div>
    </div>
  );
}

function AlertBox({
  type,
  message,
}: {
  type: 'success' | 'error';
  message: string;
}) {
  const isSuccess = type === 'success';

  return (
    <div
      className={`flex items-start gap-3 rounded-2xl border p-4 text-sm font-semibold ${
        isSuccess
          ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
          : 'border-red-100 bg-red-50 text-red-700'
      }`}
    >
      {isSuccess ? (
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
      ) : (
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
      )}
      <span>{message}</span>
    </div>
  );
}

function SummaryCard({
  title,
  value,
  icon,
  progress,
  color,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  progress?: number;
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

      <h3 className="mt-1 text-2xl font-black text-gray-900">{value}</h3>

      {typeof progress === 'number' && (
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-100">
          <div
            className="h-full rounded-full bg-emerald-600"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
}

function ValuePanel({
  title,
  value,
  description,
  variant = 'default',
}: {
  title: string;
  value: string;
  description?: string;
  variant?: 'default' | 'emerald';
}) {
  return (
    <div
      className={`rounded-3xl border p-6 shadow-sm ${
        variant === 'emerald'
          ? 'border-emerald-100 bg-emerald-50'
          : 'border-gray-100 bg-white'
      }`}
    >
      <p
        className={`text-sm ${
          variant === 'emerald' ? 'text-emerald-700' : 'text-gray-500'
        }`}
      >
        {title}
      </p>

      <h3
        className={`mt-1 text-2xl font-black ${
          variant === 'emerald' ? 'text-emerald-800' : 'text-gray-900'
        }`}
      >
        {value}
      </h3>

      {description && <p className="mt-2 text-xs text-gray-500">{description}</p>}
    </div>
  );
}

function RiskMemberRow({
  member,
  loading,
  onUpdateStatus,
}: {
  member: MemberRiskSummary;
  loading: boolean;
  onUpdateStatus: (member: MemberWithProfile, nextStatus: MemberStatus) => void;
}) {
  return (
    <div className="flex flex-col justify-between gap-4 p-4 xl:flex-row xl:items-center">
      <div>
        <p className="font-bold text-gray-900">
          {member.profile?.full_name || 'Unknown Member'}
        </p>

        <p className="mt-1 text-xs text-gray-500">
          {member.profile?.phone || 'No phone'} •{' '}
          {member.profile?.email || 'No email'}
        </p>

        <p className="mt-1 text-xs text-gray-500">
          Payout Order: #{member.payout_order || member.position_number || '-'}{' '}
          • Trust Score: {member.profile?.trust_score ?? 0}
        </p>

        <div className="mt-2 flex flex-wrap gap-2">
          <span
            className={`rounded-full border px-3 py-1 text-xs font-bold ${getStatusStyle(
              member.status
            )}`}
          >
            {formatLabel(member.status)}
          </span>

          {member.overdueContributionCount > 0 && (
            <RiskPill label={`${member.overdueContributionCount} overdue`} />
          )}

          {member.failedContributionCount > 0 && (
            <RiskPill label={`${member.failedContributionCount} failed`} />
          )}

          {member.defaultedContributionCount > 0 && (
            <RiskPill
              label={`${member.defaultedContributionCount} defaulted contribution`}
            />
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <MiniAmount label="Balance" value={formatCurrency(member.balance)} red />

        <MiniAmount
          label="Due / Paid"
          value={`${formatCurrency(member.totalDue)} / ${formatCurrency(
            member.totalPaid
          )}`}
        />

        {member.status !== 'DEFAULTED' ? (
          <button
            type="button"
            disabled={loading}
            onClick={() => onUpdateStatus(member, 'DEFAULTED')}
            className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {loading && <Loader2 className="h-3 w-3 animate-spin" />}
            Mark Defaulted
          </button>
        ) : (
          <button
            type="button"
            disabled={loading}
            onClick={() => onUpdateStatus(member, 'ACTIVE')}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {loading && <Loader2 className="h-3 w-3 animate-spin" />}
            Restore Active
          </button>
        )}
      </div>
    </div>
  );
}

function RiskPill({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-red-100 bg-red-50 px-3 py-1 text-xs font-bold text-red-700">
      {label}
    </span>
  );
}

function MiniAmount({
  label,
  value,
  red = false,
}: {
  label: string;
  value: string;
  red?: boolean;
}) {
  return (
    <div className={`rounded-xl px-4 py-2 ${red ? 'bg-red-50' : 'bg-gray-50'}`}>
      <p
        className={`text-xs font-semibold ${
          red ? 'text-red-600' : 'text-gray-500'
        }`}
      >
        {label}
      </p>

      <p
        className={`text-sm font-black ${
          red ? 'text-red-800' : 'text-gray-900'
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function InfoPanel({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-gray-50 p-4">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1 text-lg font-bold text-gray-900">{value}</p>
    </div>
  );
}

function EmptyBlock({ message }: { message: string }) {
  return <div className="p-6 text-center text-sm text-gray-500">{message}</div>;
}

function MemberMobileCard({
  member,
  loading,
  onUpdateStatus,
}: {
  member: MemberWithProfile;
  loading: boolean;
  onUpdateStatus: (member: MemberWithProfile, nextStatus: MemberStatus) => void;
}) {
  return (
    <div className="rounded-2xl border border-gray-100 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-bold text-gray-900">
            {member.profile?.full_name || 'Unknown Member'}
          </p>

          <p className="mt-1 text-xs text-gray-500">
            {member.profile?.phone || 'No phone'} •{' '}
            {member.profile?.email || 'No email'}
          </p>
        </div>

        <span
          className={`rounded-full border px-3 py-1 text-xs font-bold ${getStatusStyle(
            member.status
          )}`}
        >
          {formatLabel(member.status)}
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <InfoPanel
          label="Payout Order"
          value={`#${member.payout_order || member.position_number || '-'}`}
        />

        <InfoPanel
          label="Contribution"
          value={formatCurrency(member.contribution_amount)}
        />

        <InfoPanel
          label="Received Payout"
          value={member.has_received_payout ? 'Yes' : 'No'}
        />

        <InfoPanel label="Joined" value={formatDate(member.joined_at)} />
      </div>

      <div className="mt-4">
        {member.status === 'DEFAULTED' ? (
          <button
            type="button"
            disabled={loading}
            onClick={() => onUpdateStatus(member, 'ACTIVE')}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {loading && <Loader2 className="h-3 w-3 animate-spin" />}
            Restore Active
          </button>
        ) : (
          <button
            type="button"
            disabled={loading}
            onClick={() => onUpdateStatus(member, 'DEFAULTED')}
            className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {loading && <Loader2 className="h-3 w-3 animate-spin" />}
            Mark Defaulted
          </button>
        )}
      </div>
    </div>
  );
}

function MemberTableRow({
  member,
  loading,
  onUpdateStatus,
}: {
  member: MemberWithProfile;
  loading: boolean;
  onUpdateStatus: (member: MemberWithProfile, nextStatus: MemberStatus) => void;
}) {
  return (
    <tr className="hover:bg-gray-50">
      <td className="px-4 py-4">
        <p className="font-bold text-gray-900">
          {member.profile?.full_name || 'Unknown Member'}
        </p>

        <p className="mt-1 text-xs text-gray-500">
          {member.profile?.phone || 'No phone'} •{' '}
          {member.profile?.email || 'No email'}
        </p>
      </td>

      <td className="px-4 py-4">
        <p className="font-bold text-gray-900">
          #{member.payout_order || member.position_number || '-'}
        </p>
      </td>

      <td className="px-4 py-4">
        <p className="font-bold text-gray-900">
          {formatCurrency(member.contribution_amount)}
        </p>
      </td>

      <td className="px-4 py-4">
        {member.has_received_payout ? (
          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
        ) : (
          <XCircle className="h-5 w-5 text-gray-300" />
        )}
      </td>

      <td className="px-4 py-4">
        <span
          className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${getStatusStyle(
            member.status
          )}`}
        >
          {formatLabel(member.status)}
        </span>
      </td>

      <td className="px-4 py-4 text-sm text-gray-600">
        {formatDate(member.joined_at)}
      </td>

      <td className="px-4 py-4 text-right">
        {member.status === 'DEFAULTED' ? (
          <button
            type="button"
            disabled={loading}
            onClick={() => onUpdateStatus(member, 'ACTIVE')}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {loading && <Loader2 className="h-3 w-3 animate-spin" />}
            Restore
          </button>
        ) : (
          <button
            type="button"
            disabled={loading}
            onClick={() => onUpdateStatus(member, 'DEFAULTED')}
            className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {loading && <Loader2 className="h-3 w-3 animate-spin" />}
            Default
          </button>
        )}
      </td>
    </tr>
  );
}

function RecordList<T>({
  title,
  emptyMessage,
  items,
  renderItem,
}: {
  title: string;
  emptyMessage: string;
  items: T[];
  renderItem: (item: T) => React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm md:p-6">
      <h2 className="text-xl font-black text-gray-900">{title}</h2>

      <div className="mt-6 overflow-hidden rounded-2xl border border-gray-100">
        {items.length === 0 ? (
          <EmptyBlock message={emptyMessage} />
        ) : (
          <div className="divide-y divide-gray-100">
            {items.map((item) => renderItem(item))}
          </div>
        )}
      </div>
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