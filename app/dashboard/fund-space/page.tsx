'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Clock,
  CreditCard,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Trophy,
  Users,
  Wallet,
  XCircle,
} from 'lucide-react';

import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

type FundSpace = {
  id: string;
  name: string | null;
  contribution_amount: number;
  status: string;
  member_limit: number;
  current_round_number: number;
  frequency?: string | null;
  start_date?: string | null;
  completed_at?: string | null;
  created_by?: string | null;
  created_at: string | null;
  updated_at?: string | null;
};

type FundSpaceMember = {
  id: string;
  user_id: string;
  fund_space_id: string;
  contribution_amount: number;
  status: string | null;
  joined_at: string | null;
  joined_by_agent?: string | null;
  has_received_payout?: boolean | null;
  payout_order?: number | null;
  position_number?: number | null;
  received_round_number?: number | null;
};

type Round = {
  id: string;
  fund_space_id: string;
  round_number: number;
  recipient_user_id: string;
  contribution_amount: number;
  expected_total_amount: number;
  contribution_deadline: string | null;
  week_start_date: string | null;
  week_end_date: string | null;
  status: string;
  completed_at: string | null;
  created_at: string | null;
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
      'VERIFIED',
      'APPROVED',
      'COMPLETED',
      'PAID',
      'APPROVED_FOR_PAYOUT',
    ].includes(value)
  ) {
    return 'border-emerald-100 bg-emerald-50 text-emerald-700';
  }

  if (
    [
      'PENDING',
      'FORMING',
      'PENDING_VERIFICATION',
      'PENDING_ADMIN_APPROVAL',
      'COLLECTING',
      'READY_FOR_PAYOUT',
      'READY_FOR_ADMIN_APPROVAL',
    ].includes(value)
  ) {
    return 'border-amber-100 bg-amber-50 text-amber-700';
  }

  if (
    [
      'REJECTED',
      'FAILED',
      'INACTIVE',
      'SUSPENDED',
      'BLACKLISTED',
      'DEFAULTED',
      'REMOVED',
    ].includes(value)
  ) {
    return 'border-red-100 bg-red-50 text-red-700';
  }

  return 'border-gray-100 bg-gray-50 text-gray-700';
}

function getReadableGroupMessage({
  hasMember,
  fundSpace,
  payoutPosition,
  maxMembers,
}: {
  hasMember: boolean;
  fundSpace: FundSpace | null;
  payoutPosition: number | null;
  maxMembers: number;
}) {
  if (!hasMember || !fundSpace) {
    return 'Choose a weekly contribution plan and join a verified rotational savings group.';
  }

  if (fundSpace.status === 'ACTIVE') {
    return payoutPosition
      ? `Your group is active. Your payout position is #${payoutPosition}.`
      : 'Your group is active. Weekly contribution rounds have started.';
  }

  if (fundSpace.status === 'COMPLETED') {
    return 'This Fund Space cycle has been completed successfully.';
  }

  return `Your group will activate automatically when it reaches ${maxMembers} verified members.`;
}

export default function FundSpacePage() {
  const { profile, loading } = useAuth();

  const [member, setMember] = useState<FundSpaceMember | null>(null);
  const [fundSpace, setFundSpace] = useState<FundSpace | null>(null);
  const [myPayoutRound, setMyPayoutRound] = useState<Round | null>(null);
  const [totalMembers, setTotalMembers] = useState(0);
  const [myJoinPosition, setMyJoinPosition] = useState<number | null>(null);

  const [pageLoading, setPageLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (loading) return;

    if (!profile?.id) {
      setPageLoading(false);
      setErrorMessage('Unable to identify your account. Please log in again.');
      return;
    }

    loadMyFundSpace(profile.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, profile?.id]);

  async function getFundSpaceMemberCount(fundSpaceId: string) {
    const { count, error } = await supabase
      .from('fund_space_members')
      .select('id', { count: 'exact', head: true })
      .eq('fund_space_id', fundSpaceId)
      .in('status', ['ACTIVE', 'COMPLETED']);

    if (error) {
      throw error;
    }

    return count || 0;
  }

  async function getMyJoinPosition(fundSpaceId: string, memberId: string) {
    const { data, error } = await supabase
      .from('fund_space_members')
      .select('id, joined_at')
      .eq('fund_space_id', fundSpaceId)
      .in('status', ['ACTIVE', 'COMPLETED'])
      .order('joined_at', { ascending: true });

    if (error) {
      console.warn('Join position load warning:', error.message);
      return null;
    }

    const index = (data || []).findIndex((item) => item.id === memberId);

    return index >= 0 ? index + 1 : null;
  }

  async function loadMyPayoutRound(fundSpaceId: string, userId: string) {
    const { data, error } = await supabase
      .from('fund_space_rounds')
      .select('*')
      .eq('fund_space_id', fundSpaceId)
      .eq('recipient_user_id', userId)
      .maybeSingle();

    if (error) {
      console.warn('Payout round load warning:', error.message);
      setMyPayoutRound(null);
      return;
    }

    setMyPayoutRound((data || null) as unknown as Round | null);
  }

  async function loadMyFundSpace(userId: string, showRefreshState = false) {
    try {
      if (showRefreshState) {
        setRefreshing(true);
      } else {
        setPageLoading(true);
      }

      setErrorMessage('');

      const { data: memberData, error: memberError } = await supabase
        .from('fund_space_members')
        .select('*')
        .eq('user_id', userId)
        .in('status', ['ACTIVE', 'COMPLETED'])
        .order('joined_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (memberError) {
        throw memberError;
      }

      if (!memberData) {
        setMember(null);
        setFundSpace(null);
        setMyPayoutRound(null);
        setTotalMembers(0);
        setMyJoinPosition(null);
        return;
      }

      const currentMember = memberData as unknown as FundSpaceMember;

      setMember(currentMember);

      const { data: fundSpaceData, error: fundSpaceError } = await supabase
        .from('fund_spaces')
        .select('*')
        .eq('id', currentMember.fund_space_id)
        .maybeSingle();

      if (fundSpaceError) {
        throw fundSpaceError;
      }

      if (!fundSpaceData) {
        setFundSpace(null);
        setMyPayoutRound(null);
        setTotalMembers(0);
        setMyJoinPosition(null);
        setErrorMessage('Your Fund Space group could not be found.');
        return;
      }

      const currentFundSpace = fundSpaceData as unknown as FundSpace;

      setFundSpace(currentFundSpace);

      const [memberCount, joinPosition] = await Promise.all([
        getFundSpaceMemberCount(currentFundSpace.id),
        getMyJoinPosition(currentFundSpace.id, currentMember.id),
      ]);

      setTotalMembers(memberCount);
      setMyJoinPosition(joinPosition);

      await loadMyPayoutRound(currentFundSpace.id, userId);
    } catch (error: unknown) {
      console.error('Fund Space load error:', error);

      const message =
        error instanceof Error
          ? error.message
          : 'Unable to load your Fund Space information.';

      setErrorMessage(message);
    } finally {
      setPageLoading(false);
      setRefreshing(false);
    }
  }

  const verificationStatus = profile?.verification_status ?? '';
  const accountStatus = profile?.status ?? '';

  const isVerified = verificationStatus === 'VERIFIED';
  const isActive = accountStatus === 'ACTIVE';

  const maxMembers = fundSpace?.member_limit ?? 10;
  const progress =
    maxMembers > 0 ? Math.min((totalMembers / maxMembers) * 100, 100) : 0;

  const groupStatusLabel = fundSpace?.status || 'FORMING';
  const memberStatusLabel = member?.status || 'ACTIVE';

  const canJoin = isActive && isVerified && !member;

  const payoutPosition =
    member?.payout_order || member?.position_number || myJoinPosition || null;

  const payoutWeekLabel = payoutPosition ? `Week ${payoutPosition}` : 'Pending';

  const dashboardMessage = useMemo(() => {
    return getReadableGroupMessage({
      hasMember: Boolean(member),
      fundSpace,
      payoutPosition,
      maxMembers,
    });
  }, [member, fundSpace, payoutPosition, maxMembers]);

  if (loading || pageLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-emerald-600" />
          <p className="text-sm text-gray-500">Loading Fund Space...</p>
        </div>
      </div>
    );
  }

  if (!isActive) {
    return (
      <div className="rounded-3xl border border-red-100 bg-red-50 p-6">
        <div className="flex items-start gap-3">
          <XCircle className="mt-1 h-6 w-6 shrink-0 text-red-600" />

          <div>
            <h2 className="text-xl font-black text-red-700">
              Account inactive
            </h2>

            <p className="mt-2 text-sm leading-6 text-red-600">
              Your account is currently inactive. Please contact support before
              joining a Fund Space.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!isVerified) {
    return (
      <div className="rounded-3xl border border-amber-100 bg-amber-50 p-6">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-1 h-6 w-6 shrink-0 text-amber-600" />

          <div>
            <h2 className="text-xl font-black text-amber-800">
              Verification required
            </h2>

            <p className="mt-2 text-sm leading-6 text-amber-700">
              You must complete verification before joining TrustPoint Fund
              Space. Verification protects every member and prevents fake
              accounts from joining contribution groups.
            </p>

            <Link
              href="/dashboard/verification"
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-amber-600 px-5 py-3 text-sm font-bold text-white hover:bg-amber-700"
            >
              Complete Verification
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="rounded-3xl bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-600 p-6 text-white shadow-sm md:p-8">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
          <div className="max-w-3xl">
            <p className="mb-3 inline-flex rounded-full bg-white/15 px-4 py-1 text-sm font-medium">
              TrustPoint Fund Space
            </p>

            <h1 className="text-3xl font-black md:text-4xl">
              {member && fundSpace
                ? 'Your Fund Space dashboard'
                : 'Join a trusted contribution group'}
            </h1>

            <p className="mt-4 max-w-2xl text-sm leading-7 text-emerald-50 md:text-base">
              {dashboardMessage}
            </p>

            {member && fundSpace && (
              <div className="mt-6 flex flex-wrap gap-3">
                <HeroMiniCard
                  label="My Payout Position"
                  value={payoutPosition ? `#${payoutPosition}` : 'Pending'}
                />

                <HeroMiniCard label="Payout Week" value={payoutWeekLabel} />

                <HeroMiniCard
                  label="Weekly Amount"
                  value={formatCurrency(fundSpace.contribution_amount)}
                />
              </div>
            )}

            {canJoin && (
              <Link
                href="/dashboard/fund-space/join"
                className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-emerald-700 hover:bg-emerald-50"
              >
                Join Fund Space
                <ArrowRight size={16} />
              </Link>
            )}
          </div>

          {member && fundSpace && (
            <button
              type="button"
              onClick={() =>
                profile?.id && loadMyFundSpace(profile.id, true)
              }
              disabled={refreshing}
              className="inline-flex min-h-12 w-fit items-center justify-center gap-2 rounded-xl bg-white/15 px-5 py-3 text-sm font-bold text-white hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw
                size={16}
                className={refreshing ? 'animate-spin' : ''}
              />
              Refresh
            </button>
          )}
        </div>
      </div>

      {errorMessage && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-700">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {!member || !fundSpace ? (
        <div className="space-y-8">
          <div className="grid gap-6 md:grid-cols-3">
            <IntroCard
              icon={<CircleDollarSign className="h-8 w-8" />}
              title="Choose your plan"
              description="Select GH₵50, GH₵100, GH₵200, or GH₵500 as your weekly contribution amount."
            />

            <IntroCard
              icon={<Users className="h-8 w-8" />}
              title="Join a verified group"
              description="The system automatically places you into a forming group with other verified members."
            />

            <IntroCard
              icon={<CalendarDays className="h-8 w-8" />}
              title="Receive your payout"
              description="Once your group activates, payout order and contribution rounds are generated transparently."
            />
          </div>

          <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-6">
            <div className="flex flex-col justify-between gap-5 md:flex-row md:items-center">
              <div>
                <h2 className="text-xl font-black text-emerald-900">
                  Ready to join your first Fund Space?
                </h2>

                <p className="mt-2 max-w-2xl text-sm leading-6 text-emerald-700">
                  You are verified and eligible to join. Choose a weekly plan
                  and the system will place you into a trusted contribution
                  group.
                </p>
              </div>

              <Link
                href="/dashboard/fund-space/join"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-700"
              >
                Join Fund Space
                <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
            <div className="flex flex-col justify-between gap-5 md:flex-row md:items-center">
              <div>
                <p className="text-sm font-bold uppercase tracking-wide text-emerald-600">
                  My Current Fund Space
                </p>

                <h2 className="mt-2 text-2xl font-black text-gray-900">
                  {fundSpace.name || 'TrustPoint Fund Space'}
                </h2>

                <div className="mt-4 flex flex-wrap gap-2">
                  <StatusBadge
                    label={`Weekly: ${formatCurrency(
                      fundSpace.contribution_amount
                    )}`}
                    status="ACTIVE"
                  />

                  <StatusBadge
                    label={`Group: ${formatLabel(groupStatusLabel)}`}
                    status={groupStatusLabel}
                  />

                  <StatusBadge
                    label={`My Status: ${formatLabel(memberStatusLabel)}`}
                    status={memberStatusLabel}
                  />
                </div>

                <p className="mt-3 text-sm text-gray-500">
                  Joined: {formatDate(member.joined_at)}
                </p>
              </div>

              <div className="rounded-2xl bg-emerald-50 px-5 py-4 text-center">
                <p className="text-xs font-bold uppercase text-emerald-600">
                  Payout Week
                </p>

                <p className="mt-1 text-lg font-black text-emerald-800">
                  {payoutWeekLabel}
                </p>
              </div>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-4">
              <InfoCard
                icon={<Users className="h-5 w-5" />}
                title="Members"
                value={`${totalMembers}/${maxMembers}`}
              />

              <InfoCard
                icon={<Clock className="h-5 w-5" />}
                title="Current Round"
                value={`${fundSpace.current_round_number || 0}`}
              />

              <InfoCard
                icon={<Trophy className="h-5 w-5" />}
                title="My Payout Position"
                value={payoutPosition ? `#${payoutPosition}` : 'Pending'}
              />

              <InfoCard
                icon={<Wallet className="h-5 w-5" />}
                title="Weekly Amount"
                value={formatCurrency(fundSpace.contribution_amount)}
              />
            </div>

            {fundSpace.status === 'ACTIVE' && (
              <div className="mt-8 rounded-3xl border border-emerald-100 bg-emerald-50 p-6">
                <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
                  <div className="flex items-start gap-3">
                    <div className="rounded-2xl bg-white p-3 text-emerald-700 shadow-sm">
                      <Smartphone className="h-6 w-6" />
                    </div>

                    <div>
                      <h3 className="text-xl font-black text-emerald-900">
                        Weekly Contribution
                      </h3>

                      <p className="mt-2 max-w-2xl text-sm leading-6 text-emerald-700">
                        Your group is active. Open your contribution page to pay
                        with MoMo, submit your transaction reference, or continue
                        with online payment.
                      </p>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <span className="rounded-full border border-emerald-100 bg-white px-3 py-1 text-xs font-bold text-emerald-700">
                          Amount: {formatCurrency(fundSpace.contribution_amount)}
                        </span>

                        <span className="rounded-full border border-emerald-100 bg-white px-3 py-1 text-xs font-bold text-emerald-700">
                          Round: {fundSpace.current_round_number || 0}
                        </span>
                      </div>
                    </div>
                  </div>

                  <Link
                    href={`/dashboard/fund-space/${fundSpace.id}`}
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-800"
                  >
                    Pay Contribution
                    <ArrowRight size={16} />
                  </Link>
                </div>
              </div>
            )}

            {myPayoutRound && (
              <div className="mt-8 rounded-2xl border border-emerald-100 bg-emerald-50 p-5">
                <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                  <div>
                    <p className="text-sm font-bold text-emerald-700">
                      Your expected payout round
                    </p>

                    <p className="mt-1 text-lg font-black text-emerald-900">
                      Week {myPayoutRound.round_number} / Round{' '}
                      {myPayoutRound.round_number}
                    </p>

                    <p className="mt-1 text-sm text-emerald-700">
                      {formatDate(myPayoutRound.week_start_date)} -{' '}
                      {formatDate(myPayoutRound.week_end_date)}
                    </p>
                  </div>

                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-bold ${getStatusStyle(
                      myPayoutRound.status
                    )}`}
                  >
                    {formatLabel(myPayoutRound.status)}
                  </span>
                </div>
              </div>
            )}

            <div className="mt-8">
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="font-medium text-gray-600">
                  Group formation progress
                </span>
                <span className="font-bold text-emerald-700">
                  {Math.round(progress)}%
                </span>
              </div>

              <div className="h-3 overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-full rounded-full bg-emerald-600 transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>

              {fundSpace.status === 'FORMING' && (
                <p className="mt-3 text-sm text-gray-500">
                  Your group will activate automatically when it reaches{' '}
                  {maxMembers} verified members.
                </p>
              )}

              {fundSpace.status === 'ACTIVE' && (
                <p className="mt-3 text-sm font-semibold text-emerald-700">
                  Your group is active. Weekly contribution rounds have started.
                </p>
              )}

              {fundSpace.status === 'COMPLETED' && (
                <p className="mt-3 text-sm font-semibold text-emerald-700">
                  This Fund Space cycle has been completed successfully.
                </p>
              )}
            </div>

            <Link
              href={`/dashboard/fund-space/${fundSpace.id}`}
              className="mt-8 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-700"
            >
              Open Fund Space Details
              <ArrowRight size={16} />
            </Link>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <GuideCard
              icon={<CheckCircle2 className="h-6 w-6" />}
              title="Pay weekly"
              description="Make your weekly contribution on time to protect your trust score."
            />

            <GuideCard
              icon={<ShieldCheck className="h-6 w-6" />}
              title="Stay verified"
              description="Only verified members can participate in active Fund Space groups."
            />

            <GuideCard
              icon={<Trophy className="h-6 w-6" />}
              title="Follow payout order"
              description="The system-generated payout order keeps the group transparent."
            />
          </div>

          <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
            <div className="flex items-start gap-3">
              <CreditCard className="mt-1 h-6 w-6 shrink-0 text-emerald-600" />

              <div>
                <h2 className="text-xl font-black text-gray-900">
                  How contribution payment works
                </h2>

                <p className="mt-2 text-sm leading-6 text-gray-500">
                  You can pay with MoMo through the TrustPoint merchant line and
                  submit your transaction reference for verification. Once admin
                  confirms your transaction, your contribution will be marked as
                  paid.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function HeroMiniCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/15 px-4 py-3">
      <p className="text-xs font-medium text-emerald-50">{label}</p>
      <p className="mt-1 text-2xl font-black">{value}</p>
    </div>
  );
}

function IntroCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
      <div className="mb-4 inline-flex rounded-2xl bg-emerald-50 p-3 text-emerald-700">
        {icon}
      </div>

      <h3 className="text-lg font-black text-gray-900">{title}</h3>

      <p className="mt-2 text-sm leading-6 text-gray-500">{description}</p>
    </div>
  );
}

function InfoCard({
  icon,
  title,
  value,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl bg-gray-50 p-5">
      <div className="mb-3 text-gray-500">{icon}</div>

      <p className="text-sm text-gray-500">{title}</p>

      <p className="mt-1 text-xl font-black text-gray-900">{value}</p>
    </div>
  );
}

function GuideCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
      <div className="mb-4 inline-flex rounded-2xl bg-emerald-50 p-3 text-emerald-700">
        {icon}
      </div>

      <h3 className="text-lg font-black text-gray-900">{title}</h3>

      <p className="mt-2 text-sm leading-6 text-gray-500">{description}</p>
    </div>
  );
}

function StatusBadge({ label, status }: { label: string; status: string }) {
  return (
    <span
      className={`rounded-full border px-3 py-1 text-xs font-bold ${getStatusStyle(
        status
      )}`}
    >
      {label}
    </span>
  );
}