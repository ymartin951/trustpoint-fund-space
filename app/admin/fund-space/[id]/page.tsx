'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Banknote,
  CheckCircle2,
  Clock,
  HandCoins,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Users,
  Wallet,
  XCircle,
} from 'lucide-react';

import { supabase } from '@/lib/supabase/client';

type AppRole = 'USER' | 'AGENT' | 'ADMIN' | 'SUPER_ADMIN';

type AdminProfile = {
  id: string;
  full_name: string | null;
  role: string | null;
  status: string | null;
  is_blacklisted: boolean | null;
};

type FundSpace = {
  id: string;
  name: string | null;
  status: string | null;
  contribution_amount: number | string | null;
  member_limit: number | null;
  current_round_number: number | null;
  frequency: string | null;
  start_date: string | null;
  completed_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type Member = {
  id: string;
  fund_space_id: string;
  user_id: string;
  status: string | null;
  payout_order: number | null;
  position_number: number | null;
  received_round_number: number | null;
  has_received_payout: boolean | null;
  contribution_amount: number | string | null;
  joined_by_agent: string | null;
  joined_at: string | null;
  profile?: {
    id: string;
    full_name: string | null;
    phone: string | null;
    role: string | null;
    verification_status: string | null;
    status: string | null;
  } | null;
};

type Round = {
  id: string;
  fund_space_id: string;
  round_number: number;
  recipient_user_id: string;
  contribution_amount: number | string;
  expected_total_amount: number | string;
  week_start_date: string;
  contribution_deadline: string;
  week_end_date: string;
  status: string;
  approved_by: string | null;
  approved_at: string | null;
  completed_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  recipient?: {
    id: string;
    full_name: string | null;
    phone: string | null;
    role: string | null;
  } | null;
};

type Contribution = {
  id: string;
  fund_space_id: string;
  round_id: string;
  user_id: string;
  amount_due: number | string;
  amount_paid: number | string;
  status: string;
  payment_method: string | null;
  payment_reference: string | null;
  paid_at: string | null;
  confirmed_by: string | null;
  created_at: string | null;
  updated_at: string | null;
  payment_timing?: string | null;
  is_late?: boolean | null;
  late_fee_amount?: number | string | null;
  late_fee_status?: string | null;
};

type Payout = {
  id: string;
  fund_space_id: string;
  round_id: string;
  recipient_user_id: string;
  gross_amount: number | string;
  platform_fee: number | string;
  net_amount: number | string;
  status: string;
  approved_by: string | null;
  approved_at: string | null;
  paid_by: string | null;
  paid_at: string | null;
  payout_method: string | null;
  payout_reference: string | null;
  created_at: string | null;
  updated_at: string | null;
};

function normalizeRole(role: string | null | undefined): AppRole {
  const value = String(role || '').trim().toUpperCase();

  if (value === 'SUPER_ADMIN') return 'SUPER_ADMIN';
  if (value === 'ADMIN') return 'ADMIN';
  if (value === 'AGENT') return 'AGENT';

  return 'USER';
}

function normalizeStatus(status: string | null | undefined) {
  return String(status || '').trim().toUpperCase();
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

function formatDateTime(value: string | null | undefined) {
  if (!value) return 'Not set';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Invalid date';

  return date.toLocaleString('en-GH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
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
  const value = normalizeStatus(status);

  if (
    [
      'ACTIVE',
      'COLLECTING',
      'PAID',
      'APPROVED',
      'APPROVED_FOR_PAYOUT',
      'COMPLETED',
      'VERIFIED',
    ].includes(value)
  ) {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }

  if (
    [
      'PENDING',
      'FORMING',
      'PENDING_ADMIN_APPROVAL',
      'READY_FOR_ADMIN_APPROVAL',
      'READY_FOR_PAYOUT',
      'PENDING_REVIEW',
    ].includes(value)
  ) {
    return 'border-amber-200 bg-amber-50 text-amber-700';
  }

  if (
    [
      'FAILED',
      'CANCELLED',
      'REJECTED',
      'DEFAULTED',
      'OVERDUE',
      'PAUSED',
      'REMOVED',
    ].includes(value)
  ) {
    return 'border-red-200 bg-red-50 text-red-700';
  }

  return 'border-slate-200 bg-slate-50 text-slate-700';
}

function getFundSpaceState(status: string | null | undefined) {
  const value = normalizeStatus(status);

  if (value === 'ACTIVE') {
    return {
      title: 'Fund Space Active',
      description:
        'This group is currently running. Contributions and payouts can continue according to the active round.',
      className: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    };
  }

  if (value === 'FORMING') {
    return {
      title: 'Fund Space Forming',
      description:
        'This group is still accepting members. Activation should happen when the group reaches the required member limit.',
      className: 'border-amber-200 bg-amber-50 text-amber-800',
    };
  }

  if (value === 'COMPLETED') {
    return {
      title: 'Fund Space Completed',
      description:
        'This group has completed its full round and payout cycle. It is no longer collecting active contributions.',
      className: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    };
  }

  if (value === 'PAUSED') {
    return {
      title: 'Fund Space Paused',
      description:
        'This group is temporarily paused. Admin should review the cause before allowing new activity.',
      className: 'border-red-200 bg-red-50 text-red-800',
    };
  }

  if (value === 'CANCELLED') {
    return {
      title: 'Fund Space Cancelled',
      description:
        'This group has been cancelled. No further normal contribution or payout action should continue.',
      className: 'border-red-200 bg-red-50 text-red-800',
    };
  }

  return {
    title: formatLabel(status),
    description:
      'Review this Fund Space status before taking further admin action.',
    className: 'border-slate-200 bg-slate-50 text-slate-700',
  };
}

function StatusPill({ status }: { status: string | null | undefined }) {
  return (
    <span
      className={`inline-flex w-fit rounded-full border px-3 py-1 text-xs font-black ${statusClass(
        status
      )}`}
    >
      {formatLabel(status)}
    </span>
  );
}

function HeroStat({
  title,
  value,
  helper,
  icon,
}: {
  title: string;
  value: string | number;
  helper: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="group min-w-0 rounded-2xl border border-white/70 bg-white/10 p-4 text-white transition hover:-translate-y-0.5 hover:bg-white/20 hover:shadow-lg">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-[11px] font-black uppercase tracking-wide text-emerald-50/90">
          {title}
        </p>

        <span className="text-emerald-50/90">{icon}</span>
      </div>

      <p className="mt-2 truncate text-2xl font-black text-white md:text-3xl">
        {value}
      </p>

      <p className="mt-1 truncate text-xs font-semibold text-emerald-50/80">
        {helper}
      </p>
    </div>
  );
}

function InfoCard({
  title,
  value,
  helper,
  icon,
}: {
  title: string;
  value: string | number;
  helper: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-slate-400">
            {title}
          </p>
          <p className="mt-2 text-2xl font-black text-slate-900">{value}</p>
          <p className="mt-1 text-sm leading-5 text-slate-500">{helper}</p>
        </div>

        {icon && (
          <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-700">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}

function SmallBox({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
      <p className="text-xs font-black uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-1 break-words text-sm font-bold text-slate-900">
        {value ?? 'Not set'}
      </p>
    </div>
  );
}

export default function AdminFundSpaceDetailsPage() {
  const router = useRouter();
  const params = useParams();

  const fundSpaceId = String(params?.id || '');

  const [adminProfile, setAdminProfile] = useState<AdminProfile | null>(null);
  const [fundSpace, setFundSpace] = useState<FundSpace | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const currentRound = useMemo(() => {
    const collectingRound = rounds.find(
      (round) => normalizeStatus(round.status) === 'COLLECTING'
    );

    if (collectingRound) return collectingRound;

    const currentRoundNumber = Number(fundSpace?.current_round_number || 0);

    return (
      rounds.find((round) => Number(round.round_number) === currentRoundNumber) ||
      rounds[0] ||
      null
    );
  }, [fundSpace?.current_round_number, rounds]);

  const currentRecipientMember = useMemo(() => {
    if (!currentRound) return null;

    return (
      members.find((member) => member.user_id === currentRound.recipient_user_id) ||
      null
    );
  }, [currentRound, members]);

  const currentRoundContributions = useMemo(() => {
    if (!currentRound) return [];

    return contributions.filter((item) => item.round_id === currentRound.id);
  }, [contributions, currentRound]);

  const currentRoundPayout = useMemo(() => {
    if (!currentRound) return null;

    return payouts.find((item) => item.round_id === currentRound.id) || null;
  }, [currentRound, payouts]);

  const currentRoundStats = useMemo(() => {
    const total = currentRoundContributions.length;
    const paid = currentRoundContributions.filter(
      (item) => normalizeStatus(item.status) === 'PAID'
    ).length;
    const pending = currentRoundContributions.filter(
      (item) => normalizeStatus(item.status) !== 'PAID'
    ).length;
    const totalDue = currentRoundContributions.reduce(
      (sum, item) => sum + toNumber(item.amount_due),
      0
    );
    const totalPaid = currentRoundContributions.reduce(
      (sum, item) => sum + toNumber(item.amount_paid),
      0
    );

    return {
      total,
      paid,
      pending,
      totalDue,
      totalPaid,
      outstanding: Math.max(totalDue - totalPaid, 0),
    };
  }, [currentRoundContributions]);

  const memberStats = useMemo(() => {
    const active = members.filter(
      (member) => normalizeStatus(member.status) === 'ACTIVE'
    ).length;

    const paidOut = members.filter((member) => member.has_received_payout).length;
    const waiting = members.length - paidOut;
    const defaulted = members.filter(
      (member) => normalizeStatus(member.status) === 'DEFAULTED'
    ).length;

    return {
      active,
      paidOut,
      waiting,
      defaulted,
    };
  }, [members]);

  const roundSummaries = useMemo(() => {
    return rounds.map((round) => {
      const roundContributions = contributions.filter(
        (item) => item.round_id === round.id
      );
      const paid = roundContributions.filter(
        (item) => normalizeStatus(item.status) === 'PAID'
      ).length;
      const totalPaid = roundContributions.reduce(
        (sum, item) => sum + toNumber(item.amount_paid),
        0
      );
      const totalDue = roundContributions.reduce(
        (sum, item) => sum + toNumber(item.amount_due),
        0
      );
      const payout = payouts.find((item) => item.round_id === round.id) || null;

      return {
        round,
        contributionCount: roundContributions.length,
        paid,
        unpaid: roundContributions.length - paid,
        totalPaid,
        totalDue,
        payout,
      };
    });
  }, [contributions, payouts, rounds]);

  const nextRecipientMember = useMemo(() => {
    if (!members.length || !fundSpace?.current_round_number) return null;

    const nextRoundNumber = Number(fundSpace.current_round_number || 0) + 1;

    const nextRound =
      rounds.find((round) => Number(round.round_number) === nextRoundNumber) ||
      null;

    if (nextRound) {
      return (
        members.find((member) => member.user_id === nextRound.recipient_user_id) ||
        null
      );
    }

    const sortedMembers = [...members].sort(
      (a, b) =>
        Number(a.payout_order || a.position_number || 9999) -
        Number(b.payout_order || b.position_number || 9999)
    );

    return sortedMembers.find((member) => !member.has_received_payout) || null;
  }, [fundSpace?.current_round_number, members, rounds]);

  const fundSpaceState = getFundSpaceState(fundSpace?.status);

  const checkAdminAccess = useCallback(async () => {
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session?.user) {
      throw new Error('Your session has expired. Please log in again.');
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, role, status, is_blacklisted')
      .eq('id', session.user.id)
      .maybeSingle();

    if (error || !data) {
      throw new Error('Admin profile could not be found.');
    }

    const profile = data as AdminProfile;
    const role = normalizeRole(profile.role);

    if (!['ADMIN', 'SUPER_ADMIN'].includes(role)) {
      throw new Error('Only admins and super admins can access this page.');
    }

    if (normalizeStatus(profile.status) !== 'ACTIVE') {
      throw new Error('Your admin account must be active.');
    }

    if (profile.is_blacklisted) {
      throw new Error('This admin account cannot access Fund Space management.');
    }

    setAdminProfile(profile);
    return profile;
  }, []);

  const loadDetails = useCallback(
    async (showRefreshState = false) => {
      try {
        if (!fundSpaceId || fundSpaceId === 'undefined') {
          throw new Error('Invalid Fund Space ID.');
        }

        if (showRefreshState) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setErrorMessage('');

        await checkAdminAccess();

        const { data: fundSpaceData, error: fundSpaceError } = await supabase
          .from('fund_spaces')
          .select(
            'id, name, status, contribution_amount, member_limit, current_round_number, frequency, start_date, completed_at, created_at, updated_at'
          )
          .eq('id', fundSpaceId)
          .maybeSingle();

        if (fundSpaceError) throw fundSpaceError;

        if (!fundSpaceData) {
          throw new Error('Fund Space not found.');
        }

        const { data: memberRows, error: membersError } = await supabase
          .from('fund_space_members')
          .select(
            'id, fund_space_id, user_id, status, payout_order, position_number, received_round_number, has_received_payout, contribution_amount, joined_by_agent, joined_at'
          )
          .eq('fund_space_id', fundSpaceId)
          .order('payout_order', { ascending: true, nullsFirst: false });

        if (membersError) throw membersError;

        const memberUserIds = [
          ...new Set((memberRows || []).map((item) => item.user_id)),
        ];

        const { data: memberProfiles, error: profilesError } =
          memberUserIds.length
            ? await supabase
                .from('profiles')
                .select('id, full_name, phone, role, verification_status, status')
                .in('id', memberUserIds)
            : { data: [], error: null };

        if (profilesError) throw profilesError;

        const profileById = new Map(
          (memberProfiles || []).map((profile) => [profile.id, profile])
        );

        const mappedMembers = (memberRows || []).map((member) => ({
          ...(member as Member),
          profile: profileById.get(member.user_id) || null,
        }));

        const { data: roundRows, error: roundsError } = await supabase
          .from('fund_space_rounds')
          .select(
            'id, fund_space_id, round_number, recipient_user_id, contribution_amount, expected_total_amount, week_start_date, contribution_deadline, week_end_date, status, approved_by, approved_at, completed_at, created_at, updated_at'
          )
          .eq('fund_space_id', fundSpaceId)
          .order('round_number', { ascending: true });

        if (roundsError) throw roundsError;

        const recipientIds = [
          ...new Set(
            (roundRows || [])
              .map((round) => round.recipient_user_id)
              .filter(Boolean)
          ),
        ];

        const { data: recipientProfiles, error: recipientsError } =
          recipientIds.length
            ? await supabase
                .from('profiles')
                .select('id, full_name, phone, role')
                .in('id', recipientIds)
            : { data: [], error: null };

        if (recipientsError) throw recipientsError;

        const recipientById = new Map(
          (recipientProfiles || []).map((profile) => [profile.id, profile])
        );

        const mappedRounds = (roundRows || []).map((round) => ({
          ...(round as Round),
          recipient: recipientById.get(round.recipient_user_id) || null,
        }));

        const { data: contributionRows, error: contributionsError } =
          await supabase
            .from('fund_space_contributions')
            .select(
              'id, fund_space_id, round_id, user_id, amount_due, amount_paid, status, payment_method, payment_reference, paid_at, confirmed_by, created_at, updated_at, payment_timing, is_late, late_fee_amount, late_fee_status'
            )
            .eq('fund_space_id', fundSpaceId)
            .order('updated_at', { ascending: false });

        if (contributionsError) throw contributionsError;

        const { data: payoutRows, error: payoutsError } = await supabase
          .from('fund_space_payouts')
          .select(
            'id, fund_space_id, round_id, recipient_user_id, gross_amount, platform_fee, net_amount, status, approved_by, approved_at, paid_by, paid_at, payout_method, payout_reference, created_at, updated_at'
          )
          .eq('fund_space_id', fundSpaceId)
          .order('created_at', { ascending: false });

        if (payoutsError) throw payoutsError;

        setFundSpace(fundSpaceData as FundSpace);
        setMembers(mappedMembers);
        setRounds(mappedRounds);
        setContributions((contributionRows || []) as unknown as Contribution[]);
        setPayouts((payoutRows || []) as Payout[]);
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'Unable to load Fund Space details.'
        );
        setFundSpace(null);
        setMembers([]);
        setRounds([]);
        setContributions([]);
        setPayouts([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [checkAdminAccess, fundSpaceId]
  );

  useEffect(() => {
    loadDetails();
  }, [loadDetails]);

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-6">
        <div className="mx-auto flex min-h-[60vh] max-w-7xl items-center justify-center">
          <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-emerald-700" />
            <p className="mt-4 text-sm font-black text-slate-600">
              Loading Fund Space details...
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (!adminProfile && errorMessage) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-6">
        <div className="mx-auto max-w-4xl rounded-3xl border border-red-200 bg-red-50 p-6 text-red-700">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />

            <div>
              <h1 className="text-lg font-black">Unable to open Fund Space</h1>
              <p className="mt-2 text-sm font-semibold">{errorMessage}</p>

              <button
                type="button"
                onClick={() => router.back()}
                className="mt-4 inline-flex min-h-11 items-center justify-center rounded-2xl bg-red-600 px-4 text-sm font-black text-white"
              >
                Go Back
              </button>
            </div>
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
            href="/admin/fund-space"
            className="inline-flex min-h-11 w-fit items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-100"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Fund Spaces
          </Link>

          <button
            type="button"
            onClick={() => loadDetails(true)}
            disabled={refreshing}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {refreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Refresh
          </button>
        </div>

        <section className="overflow-hidden rounded-[2rem] bg-gradient-to-br from-emerald-950 via-emerald-900 to-emerald-800 text-white shadow-sm">
          <div className="p-5 md:p-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-xs font-black">
                    <ShieldCheck className="h-4 w-4" />
                    Admin Fund Space Details
                  </span>

                  <span className="inline-flex rounded-full bg-white/15 px-4 py-2 text-xs font-black">
                    Current Round {fundSpace?.current_round_number || 1}
                  </span>
                </div>

                <h1 className="mt-5 break-words text-3xl font-black tracking-tight md:text-5xl">
                  {fundSpace?.name || 'Fund Space Details'}
                </h1>

                <p className="mt-4 max-w-3xl text-sm font-semibold leading-7 text-emerald-50 md:text-base">
                  Track members, payout order, current round contributions,
                  payout status, and complete round history for this Fund Space.
                </p>

                <div className="mt-5 flex flex-wrap gap-2">
                  <StatusPill status={fundSpace?.status} />
                  <StatusPill status={fundSpace?.frequency} />
                  <span className="inline-flex w-fit rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-black text-white">
                    Weekly Amount: {formatCurrency(fundSpace?.contribution_amount)}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Link
                  href="/admin/fund-space"
                  className="inline-flex min-h-9 items-center justify-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 text-xs font-black text-white ring-1 ring-white/10 transition hover:bg-white/20"
                >
                  Fund Spaces
                </Link>

                <Link
                  href={`/admin/fund-space/contributions?fund_space_id=${fundSpaceId}`}
                  className="inline-flex min-h-9 items-center justify-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 text-xs font-black text-white ring-1 ring-white/10 transition hover:bg-white/20"
                >
                  Contributions
                </Link>

                <Link
                  href={`/admin/fund-space/payouts?fund_space_id=${fundSpaceId}`}
                  className="inline-flex min-h-9 items-center justify-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 text-xs font-black text-white ring-1 ring-white/10 transition hover:bg-white/20"
                >
                  Payouts
                </Link>

                <button
                  type="button"
                  onClick={() => loadDetails(true)}
                  disabled={refreshing}
                  className="inline-flex min-h-9 items-center justify-center gap-2 rounded-full bg-white px-4 text-xs font-black text-emerald-900 transition hover:bg-emerald-50 disabled:opacity-60"
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

            <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <HeroStat
                title="Members"
                value={`${members.length}/${fundSpace?.member_limit || 0}`}
                helper={`${memberStats.active} active members`}
                icon={<Users className="h-4 w-4" />}
              />

              <HeroStat
                title="Current Round Paid"
                value={`${currentRoundStats.paid}/${currentRoundStats.total}`}
                helper={`${currentRoundStats.pending} still unpaid`}
                icon={<CheckCircle2 className="h-4 w-4" />}
              />

              <HeroStat
                title="Collected"
                value={formatCurrency(currentRoundStats.totalPaid)}
                helper={`Expected: ${formatCurrency(currentRoundStats.totalDue)}`}
                icon={<HandCoins className="h-4 w-4" />}
              />

              <HeroStat
                title="Outstanding"
                value={formatCurrency(currentRoundStats.outstanding)}
                helper="Unpaid amount"
                icon={<Wallet className="h-4 w-4" />}
              />
            </div>
          </div>
        </section>

        {errorMessage && (
          <section className="rounded-3xl border border-red-200 bg-red-50 p-5 text-red-700">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
              <p className="text-sm font-bold">{errorMessage}</p>
            </div>
          </section>
        )}

        <section className="grid gap-5 xl:grid-cols-[1fr_380px]">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-wide text-emerald-700">
                  <Clock className="h-4 w-4" />
                  Current Round
                </p>

                <h2 className="mt-2 text-2xl font-black text-slate-900">
                  {currentRound
                    ? `Round ${currentRound.round_number}`
                    : 'No active round'}
                </h2>

                <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
                  {currentRound
                    ? `Payout recipient: ${
                        currentRound.recipient?.full_name ||
                        currentRecipientMember?.profile?.full_name ||
                        'Unknown member'
                      }`
                    : 'No round has been created yet.'}
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  <StatusPill status={currentRound?.status} />
                  {currentRoundPayout && (
                    <StatusPill status={currentRoundPayout.status} />
                  )}
                </div>
              </div>

              <div className={`rounded-2xl border p-4 ${fundSpaceState.className}`}>
                <p className="text-sm font-black">{fundSpaceState.title}</p>
                <p className="mt-1 max-w-md text-xs font-semibold leading-5">
                  {fundSpaceState.description}
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <SmallBox
                label="Week Start"
                value={formatDate(currentRound?.week_start_date)}
              />
              <SmallBox
                label="Deadline"
                value={formatDate(currentRound?.contribution_deadline)}
              />
              <SmallBox
                label="Week End"
                value={formatDate(currentRound?.week_end_date)}
              />
              <SmallBox
                label="Payout Amount"
                value={
                  currentRoundPayout
                    ? formatCurrency(currentRoundPayout.net_amount)
                    : 'Not created'
                }
              />
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Link
                href={`/admin/fund-space/contributions?fund_space_id=${fundSpaceId}&round_id=${
                  currentRound?.id || ''
                }`}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-4 text-sm font-black text-white hover:bg-emerald-800"
              >
                <HandCoins className="h-4 w-4" />
                Contributions
              </Link>

              <Link
                href={`/admin/fund-space/payouts?fund_space_id=${fundSpaceId}`}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 hover:bg-slate-50"
              >
                <Banknote className="h-4 w-4" />
                Payouts
              </Link>

              <Link
                href="/admin/manual-payment-submissions"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 hover:bg-slate-50"
              >
                <Smartphone className="h-4 w-4" />
                MoMo Reviews
              </Link>

              <Link
                href={`/admin/fund-space/disputes?fund_space_id=${fundSpaceId}`}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 text-sm font-black text-red-700 hover:bg-red-100"
              >
                <XCircle className="h-4 w-4" />
                Disputes
              </Link>
            </div>
          </div>

          <aside className="space-y-5">
            <InfoCard
              title="Weekly Amount"
              value={formatCurrency(fundSpace?.contribution_amount)}
              helper="Expected contribution from each active member"
              icon={<Wallet className="h-5 w-5" />}
            />

            <InfoCard
              title="Members Paid Out"
              value={`${memberStats.paidOut}/${members.length}`}
              helper={`${memberStats.waiting} members still waiting for payout`}
              icon={<Banknote className="h-5 w-5" />}
            />

            <InfoCard
              title="Defaulted Members"
              value={memberStats.defaulted}
              helper="Members needing admin attention"
              icon={<AlertCircle className="h-5 w-5" />}
            />

            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-black uppercase tracking-wide text-slate-400">
                Next Recipient
              </p>

              <p className="mt-2 text-lg font-black text-slate-900">
                {nextRecipientMember?.profile?.full_name || 'Not available'}
              </p>

              <p className="mt-1 text-sm font-semibold text-slate-500">
                {nextRecipientMember?.profile?.phone || 'No phone available'}
              </p>

              <div className="mt-3">
                <StatusPill
                  status={
                    nextRecipientMember?.has_received_payout
                      ? 'PAID'
                      : 'WAITING_PAYOUT'
                  }
                />
              </div>
            </div>
          </aside>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-emerald-700" />

              <div>
                <h2 className="text-xl font-black text-slate-900">Members</h2>
                <p className="text-sm text-slate-500">
                  Payout order and member status for this Fund Space.
                </p>
              </div>
            </div>

            <Link
              href={`/admin/fund-space/contributions?fund_space_id=${fundSpaceId}`}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-xs font-black text-slate-700 hover:bg-slate-50"
            >
              View All Contributions
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {members.length === 0 ? (
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-8 text-center">
              <Users className="mx-auto h-10 w-10 text-slate-300" />
              <h3 className="mt-3 text-lg font-black text-slate-900">
                No members found
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Members will appear here after they join this Fund Space.
              </p>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="rounded-3xl border border-slate-100 bg-slate-50 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="break-words text-sm font-black text-slate-900">
                        {member.profile?.full_name || 'Unknown member'}
                      </p>

                      <p className="mt-1 text-xs font-semibold text-slate-500">
                        {member.profile?.phone || 'No phone'} •{' '}
                        {formatLabel(member.profile?.role)}
                      </p>

                      <p className="mt-1 text-xs font-semibold text-slate-500">
                        Joined: {formatDate(member.joined_at)}
                      </p>
                    </div>

                    <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-emerald-700">
                      #{member.payout_order || member.position_number || '-'}
                    </span>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <StatusPill status={member.status} />
                    <StatusPill status={member.profile?.verification_status} />

                    {member.has_received_payout ? (
                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">
                        Paid out
                      </span>
                    ) : (
                      <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-black text-slate-500">
                        Waiting payout
                      </span>
                    )}
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <SmallBox
                      label="Contribution"
                      value={formatCurrency(member.contribution_amount)}
                    />
                    <SmallBox
                      label="Received Round"
                      value={member.received_round_number || 'Not yet'}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-black text-slate-900">
                Round History
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Every round stays visible, including contribution progress and
                payout status.
              </p>
            </div>

            <Link
              href={`/admin/fund-space/payouts?fund_space_id=${fundSpaceId}`}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-xs font-black text-slate-700 hover:bg-slate-50"
            >
              View All Payouts
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {roundSummaries.length === 0 ? (
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-8 text-center">
              <Clock className="mx-auto h-10 w-10 text-slate-300" />
              <h3 className="mt-3 text-lg font-black text-slate-900">
                No rounds found
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Rounds will appear here after the Fund Space becomes active.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {roundSummaries.map((item) => (
                <div
                  key={item.round.id}
                  className="rounded-3xl border border-slate-100 bg-slate-50 p-4"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap gap-2">
                        <StatusPill status={item.round.status} />
                        {item.payout && <StatusPill status={item.payout.status} />}
                      </div>

                      <h3 className="mt-3 text-lg font-black text-slate-900">
                        Round {item.round.round_number}
                      </h3>

                      <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">
                        Recipient: {item.round.recipient?.full_name || 'Unknown'} •
                        Deadline: {formatDate(item.round.contribution_deadline)}
                      </p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[560px] xl:grid-cols-4">
                      <SmallBox
                        label="Paid"
                        value={`${item.paid}/${item.contributionCount}`}
                      />
                      <SmallBox
                        label="Collected"
                        value={formatCurrency(item.totalPaid)}
                      />
                      <SmallBox
                        label="Expected"
                        value={formatCurrency(
                          item.totalDue || item.round.expected_total_amount
                        )}
                      />
                      <SmallBox
                        label="Payout"
                        value={
                          item.payout
                            ? formatCurrency(item.payout.net_amount)
                            : 'Not created'
                        }
                      />
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-3">
                    <Link
                      href={`/admin/fund-space/contributions?fund_space_id=${fundSpaceId}&round_id=${item.round.id}`}
                      className="inline-flex min-h-10 items-center justify-center rounded-2xl bg-white px-4 text-xs font-black text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100"
                    >
                      View Round Contributions
                    </Link>

                    {item.payout && (
                      <Link
                        href={`/admin/fund-space/payouts?fund_space_id=${fundSpaceId}`}
                        className="inline-flex min-h-10 items-center justify-center rounded-2xl bg-white px-4 text-xs font-black text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-50"
                      >
                        View Payout
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}