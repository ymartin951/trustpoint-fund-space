'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  AlertCircle,
  ArrowLeft,
  Banknote,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  Clock,
  HandCoins,
  Info,
  Loader2,
  Phone,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  TimerReset,
  UserRound,
  Users,
  Wallet,
} from 'lucide-react';

import ManualMerchantPaymentModal from '@/components/fund-space/ManualMerchantPaymentModal';
import { FundSpaceTransparencyDashboard } from '@/components/fund-space/FundSpaceTransparencyDashboard';
import { supabase } from '@/lib/supabase/client';

type ActiveSection = 'collect' | 'transparency' | 'members' | 'records';

type CurrentProfile = {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  role: string | null;
  status: string | null;
  verification_status: string | null;
  is_blacklisted?: boolean | null;
};

type FundSpace = {
  id: string;
  name: string | null;
  contribution_amount: number | null;
  status: string | null;
  member_limit?: number | null;
  current_round_number?: number | null;
  frequency?: string | null;
  start_date?: string | null;
  completed_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type FundSpaceMember = {
  id: string;
  user_id: string;
  fund_space_id: string;
  contribution_amount: number | null;
  status: string | null;
  joined_at: string | null;
  joined_by_agent: string | null;
  has_received_payout?: boolean | null;
  payout_order?: number | null;
  position_number?: number | null;
  received_round_number?: number | null;
};

type ProfileSummary = {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  role: string | null;
  status: string | null;
  verification_status: string | null;
  registered_by_agent?: string | null;
};

type Round = {
  id: string;
  fund_space_id: string;
  round_number: number;
  recipient_user_id?: string | null;
  contribution_deadline?: string | null;
  due_date?: string | null;
  week_start_date?: string | null;
  week_end_date?: string | null;
  payout_date?: string | null;
  status: string | null;
  created_at?: string | null;
};

type Contribution = {
  id: string;
  fund_space_id: string;
  round_id: string;
  user_id: string;
  amount_due: number;
  amount_paid: number;
  status: string;
  payment_method: string | null;
  payment_reference: string | null;
  paid_at: string | null;
  confirmed_by: string | null;
  created_at: string | null;
  updated_at: string | null;
  payment_timing?: string | null;
  is_late?: boolean | null;
  late_fee_amount?: number | null;
  late_fee_status?: string | null;
  late_fee_paid_at?: string | null;
  late_fee_waived_at?: string | null;
  late_fee_waiver_reason?: string | null;
};

type Payout = {
  id: string;
  fund_space_id: string;
  round_id: string;
  recipient_user_id: string | null;
  gross_amount?: number | null;
  platform_fee?: number | null;
  net_amount?: number | null;
  status: string | null;
  approved_at?: string | null;
  paid_at?: string | null;
  created_at?: string | null;
};

type AgentCustomer = {
  id: string;
  agent_id: string;
  customer_id: string;
  relationship_status: string | null;
};

type MemberWithProfile = FundSpaceMember & {
  profile: ProfileSummary | null;
  contributions: Contribution[];
  payouts: Payout[];
  is_visible_to_agent: boolean;
  relationship_label: string;
};

function isValidUuid(value: string | null | undefined) {
  if (!value) return false;

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function normalizeRole(role: string | null | undefined) {
  return String(role || '').toUpperCase();
}

function isAllowedRole(role: string | null | undefined) {
  const value = normalizeRole(role);
  return value === 'AGENT' || value === 'ADMIN' || value === 'SUPER_ADMIN';
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

function getStatusStyle(status: string | null | undefined) {
  const value = String(status || '').toUpperCase();

  if (
    [
      'ACTIVE',
      'PAID',
      'ON_TIME',
      'APPROVED',
      'VERIFIED',
      'COMPLETED',
      'SUCCESS',
      'PAID_OUT',
      'WAIVED',
    ].includes(value)
  ) {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }

  if (
    [
      'PENDING',
      'PENDING_REVIEW',
      'PARTIALLY_PAID',
      'FORMING',
      'APPLIED',
      'COLLECTING',
      'READY_FOR_PAYOUT',
      'READY_FOR_ADMIN_APPROVAL',
      'PENDING_ADMIN_APPROVAL',
    ].includes(value)
  ) {
    return 'border-amber-200 bg-amber-50 text-amber-700';
  }

  if (
    [
      'LATE',
      'MISSED',
      'REJECTED',
      'FAILED',
      'CANCELLED',
      'DEFAULTED',
      'SUSPENDED',
      'REMOVED',
    ].includes(value)
  ) {
    return 'border-red-200 bg-red-50 text-red-700';
  }

  if (value === 'PAUSED') {
    return 'border-purple-200 bg-purple-50 text-purple-700';
  }

  return 'border-slate-200 bg-slate-50 text-slate-700';
}

function getMemberOrder(member: MemberWithProfile) {
  return Number(member.payout_order || member.position_number || 999999);
}

function getRoundDeadline(round: Round | null | undefined) {
  return round?.contribution_deadline || round?.due_date || null;
}

function getContributionForRound(
  member: MemberWithProfile,
  roundId: string | null
) {
  if (!roundId) return null;
  return member.contributions.find((item) => item.round_id === roundId) || null;
}

function getAmountRemaining(contribution: Contribution | null | undefined) {
  if (!contribution) return 0;

  return Math.max(
    Number(contribution.amount_due || 0) - Number(contribution.amount_paid || 0),
    0
  );
}

function canSubmitPayment(contribution: Contribution | null | undefined) {
  if (!contribution) return false;

  const status = String(contribution.status || '').toUpperCase();
  const remaining = getAmountRemaining(contribution);

  return (
    remaining > 0 &&
    ['PENDING', 'PARTIALLY_PAID', 'LATE', 'MISSED', 'OVERDUE'].includes(status)
  );
}

function StatusPill({ status }: { status: string | null | undefined }) {
  return (
    <span
      className={`inline-flex max-w-full items-center rounded-full border px-3 py-1 text-xs font-black ${getStatusStyle(
        status
      )}`}
    >
      <span className="truncate">{formatLabel(status)}</span>
    </span>
  );
}

function DetailBox({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-slate-100 bg-slate-50 p-4">
      <p className="break-words text-[11px] font-black uppercase leading-4 tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-1 break-words text-sm font-bold leading-6 text-slate-900">
        {value ?? 'Not provided'}
      </p>
    </div>
  );
}

function EmptyBlock({ message }: { message: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-8 text-center">
      <Users className="mx-auto mb-3 h-10 w-10 text-slate-300" />
      <p className="text-sm font-bold text-slate-500">{message}</p>
    </div>
  );
}

export default function AgentFundSpaceDetailsPage() {
  const params = useParams();

  const routeId = useMemo(() => {
    const possibleValues = [
      params?.id,
      params?.fundSpaceId,
      params?.fund_space_id,
      params?.customerId,
      params?.customer_id,
      params?.slug,
    ];

    for (const value of possibleValues) {
      if (Array.isArray(value) && typeof value[0] === 'string') {
        return decodeURIComponent(value[0]).trim();
      }

      if (typeof value === 'string') {
        return decodeURIComponent(value).trim();
      }
    }

    const firstStringValue = Object.values(params || {}).find((value) => {
      return typeof value === 'string' || Array.isArray(value);
    });

    if (Array.isArray(firstStringValue)) {
      return decodeURIComponent(String(firstStringValue[0] || '')).trim();
    }

    return decodeURIComponent(String(firstStringValue || '')).trim();
  }, [params]);

  const [currentProfile, setCurrentProfile] = useState<CurrentProfile | null>(
    null
  );
  const [fundSpace, setFundSpace] = useState<FundSpace | null>(null);
  const [resolvedFundSpaceId, setResolvedFundSpaceId] = useState('');
  const [members, setMembers] = useState<MemberWithProfile[]>([]);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [selectedRoundId, setSelectedRoundId] = useState('');
  const [activeSection, setActiveSection] = useState<ActiveSection>('collect');

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedContribution, setSelectedContribution] =
    useState<Contribution | null>(null);
  const [selectedCustomerName, setSelectedCustomerName] = useState('');

  const selectedRound = useMemo(() => {
    if (!selectedRoundId) return rounds[0] || null;
    return rounds.find((round) => round.id === selectedRoundId) || null;
  }, [rounds, selectedRoundId]);

  const visibleMembers = useMemo(() => {
    if (!currentProfile) return [];
    if (isAdminRole(currentProfile.role)) return members;
    return members.filter((member) => member.is_visible_to_agent);
  }, [currentProfile, members]);

  const currentRecipient = useMemo(() => {
    if (!selectedRound?.recipient_user_id) return null;

    return (
      members.find(
        (member) => member.user_id === selectedRound.recipient_user_id
      ) || null
    );
  }, [members, selectedRound?.recipient_user_id]);

  const targetCustomer = useMemo(() => {
    if (isValidUuid(routeId)) {
      const customerFromRoute = visibleMembers.find(
        (member) => member.user_id === routeId
      );

      if (customerFromRoute) return customerFromRoute;
    }

    const unpaidCustomer = visibleMembers.find((member) => {
      const contribution = getContributionForRound(
        member,
        selectedRound?.id || null
      );

      return member.relationship_label === 'Your customer' && canSubmitPayment(contribution);
    });

    if (unpaidCustomer) return unpaidCustomer;

    const firstCustomer = visibleMembers.find(
      (member) => member.relationship_label === 'Your customer'
    );

    return firstCustomer || visibleMembers[0] || null;
  }, [routeId, selectedRound?.id, visibleMembers]);

  const targetContribution = useMemo(() => {
    return getContributionForRound(targetCustomer as MemberWithProfile, selectedRound?.id || null);
  }, [selectedRound?.id, targetCustomer]);

  const targetCanPay = canSubmitPayment(targetContribution);
  const targetAmountRemaining = getAmountRemaining(targetContribution);

  const stats = useMemo(() => {
    const currentRoundId = selectedRound?.id || null;

    const roundContributions = visibleMembers
      .map((member) => getContributionForRound(member, currentRoundId))
      .filter(Boolean) as Contribution[];

    const paid = roundContributions.filter(
      (item) => String(item.status || '').toUpperCase() === 'PAID'
    );

    const pending = roundContributions.filter((item) =>
      ['PENDING', 'PARTIALLY_PAID', 'OVERDUE'].includes(
        String(item.status || '').toUpperCase()
      )
    );

    const late = roundContributions.filter(
      (item) => String(item.payment_timing || '').toUpperCase() === 'LATE'
    );

    const missed = roundContributions.filter(
      (item) => String(item.status || '').toUpperCase() === 'MISSED'
    );

    return {
      members: visibleMembers.length,
      paid: paid.length,
      pending: pending.length,
      late: late.length,
      missed: missed.length,
      collectedAmount: paid.reduce(
        (sum, item) => sum + Number(item.amount_paid || 0),
        0
      ),
      expectedAmount: visibleMembers.reduce((sum, member) => {
        const contribution = getContributionForRound(member, currentRoundId);

        return (
          sum +
          Number(
            contribution?.amount_due ||
              member.contribution_amount ||
              fundSpace?.contribution_amount ||
              0
          )
        );
      }, 0),
    };
  }, [fundSpace?.contribution_amount, selectedRound?.id, visibleMembers]);

  const loadPage = useCallback(
    async (showRefresh = false) => {
      try {
        if (showRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setErrorMessage('');
        setSuccessMessage('');

        if (!isValidUuid(routeId)) {
          throw new Error(`Invalid ID in URL: ${routeId || 'missing'}`);
        }

        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError || !session?.user) {
          throw new Error('Your session has expired. Please login again.');
        }

        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select(
            'id, full_name, phone, email, role, status, verification_status, is_blacklisted'
          )
          .eq('id', session.user.id)
          .maybeSingle();

        if (profileError) throw profileError;

        if (!profileData) {
          throw new Error('Profile could not be found.');
        }

        const profile = profileData as CurrentProfile;

        if (!isAllowedRole(profile.role)) {
          throw new Error('You do not have permission to view this Fund Space.');
        }

        if (String(profile.status || '').toUpperCase() !== 'ACTIVE') {
          throw new Error('Your account must be active to view this Fund Space.');
        }

        if (profile.is_blacklisted) {
          throw new Error('This account cannot view Fund Space groups.');
        }

        let finalFundSpaceId = routeId;

        let { data: fundSpaceData, error: fundSpaceError } = await supabase
          .from('fund_spaces')
          .select('*')
          .eq('id', finalFundSpaceId)
          .maybeSingle();

        if (fundSpaceError) throw fundSpaceError;

        if (!fundSpaceData) {
          const { data: customerMembership, error: membershipLookupError } =
            await supabase
              .from('fund_space_members')
              .select('fund_space_id, user_id, status, joined_at')
              .eq('user_id', routeId)
              .order('joined_at', { ascending: false })
              .limit(1)
              .maybeSingle();

          if (membershipLookupError) throw membershipLookupError;

          if (!customerMembership?.fund_space_id) {
            throw new Error(
              'Unable to load Fund Space details. The ID in the URL is not a Fund Space ID, and no Fund Space membership was found for this customer.'
            );
          }

          finalFundSpaceId = customerMembership.fund_space_id;

          const retryResult = await supabase
            .from('fund_spaces')
            .select('*')
            .eq('id', finalFundSpaceId)
            .maybeSingle();

          if (retryResult.error) throw retryResult.error;

          fundSpaceData = retryResult.data;
        }

        if (!fundSpaceData) {
          throw new Error('Unable to load Fund Space details.');
        }

        const loadedFundSpace = fundSpaceData as FundSpace;

        const { data: roundData, error: roundError } = await supabase
          .from('fund_space_rounds')
          .select('*')
          .eq('fund_space_id', finalFundSpaceId)
          .order('round_number', { ascending: true });

        if (roundError) throw roundError;

        const loadedRounds = (roundData || []) as Round[];

        const { data: memberData, error: memberError } = await supabase
          .from('fund_space_members')
          .select('*')
          .eq('fund_space_id', finalFundSpaceId)
          .order('position_number', { ascending: true });

        if (memberError) throw memberError;

        const loadedMembers = (memberData || []) as FundSpaceMember[];
        const memberUserIds = loadedMembers
          .map((member) => member.user_id)
          .filter(Boolean);

        const { data: profileRows, error: memberProfilesError } =
          memberUserIds.length > 0
            ? await supabase
                .from('profiles')
                .select(
                  'id, full_name, phone, email, role, status, verification_status, registered_by_agent'
                )
                .in('id', memberUserIds)
            : { data: [], error: null };

        if (memberProfilesError) throw memberProfilesError;

        const { data: contributionRows, error: contributionError } =
          memberUserIds.length > 0
            ? await supabase
                .from('fund_space_contributions')
                .select('*')
                .eq('fund_space_id', finalFundSpaceId)
                .in('user_id', memberUserIds)
                .order('created_at', { ascending: false })
            : { data: [], error: null };

        if (contributionError) throw contributionError;

        const { data: payoutRows, error: payoutError } =
          memberUserIds.length > 0
            ? await supabase
                .from('fund_space_payouts')
                .select('*')
                .eq('fund_space_id', finalFundSpaceId)
                .in('recipient_user_id', memberUserIds)
                .order('created_at', { ascending: false })
            : { data: [], error: null };

        if (payoutError) throw payoutError;

        let agentCustomers: AgentCustomer[] = [];

        if (normalizeRole(profile.role) === 'AGENT' && memberUserIds.length > 0) {
          const { data: agentCustomerRows, error: agentCustomerError } =
            await supabase
              .from('agent_customers')
              .select('id, agent_id, customer_id, relationship_status')
              .eq('agent_id', profile.id)
              .in('customer_id', memberUserIds);

          if (agentCustomerError) throw agentCustomerError;

          agentCustomers = (agentCustomerRows || []) as AgentCustomer[];
        }

        const profileMap = new Map(
          ((profileRows || []) as ProfileSummary[]).map((item) => [
            item.id,
            item,
          ])
        );

        const contributionMap = new Map<string, Contribution[]>();

        ((contributionRows || []) as Contribution[]).forEach((contribution) => {
          const current = contributionMap.get(contribution.user_id) || [];
          current.push(contribution);
          contributionMap.set(contribution.user_id, current);
        });

        const payoutMap = new Map<string, Payout[]>();

        ((payoutRows || []) as Payout[]).forEach((payout) => {
          const recipientId = payout.recipient_user_id || '';
          const current = payoutMap.get(recipientId) || [];
          current.push(payout);
          payoutMap.set(recipientId, current);
        });

        const activeAgentCustomerIds = new Set(
          agentCustomers
            .filter((item) =>
              ['ACTIVE', 'APPROVED', 'VERIFIED'].includes(
                String(item.relationship_status || '').toUpperCase()
              )
            )
            .map((item) => item.customer_id)
        );

        const mappedMembers: MemberWithProfile[] = loadedMembers.map(
          (member) => {
            const memberProfile = profileMap.get(member.user_id) || null;

            const isSelf = member.user_id === profile.id;
            const joinedByThisAgent = member.joined_by_agent === profile.id;
            const registeredByThisAgent =
              memberProfile?.registered_by_agent === profile.id ||
              activeAgentCustomerIds.has(member.user_id);

            const isVisibleToAgent =
              isAdminRole(profile.role) ||
              isSelf ||
              joinedByThisAgent ||
              registeredByThisAgent;

            let relationshipLabel = 'Group member';

            if (isSelf) {
              relationshipLabel = 'You';
            } else if (joinedByThisAgent || registeredByThisAgent) {
              relationshipLabel = 'Your customer';
            }

            return {
              ...member,
              profile: memberProfile,
              contributions: contributionMap.get(member.user_id) || [],
              payouts: payoutMap.get(member.user_id) || [],
              is_visible_to_agent: isVisibleToAgent,
              relationship_label: relationshipLabel,
            };
          }
        );

        if (normalizeRole(profile.role) === 'AGENT') {
          const canViewFundSpace = mappedMembers.some(
            (member) => member.is_visible_to_agent
          );

          if (!canViewFundSpace) {
            throw new Error(
              'You can only view Fund Spaces that include you or customers registered under you.'
            );
          }
        }

        setCurrentProfile(profile);
        setFundSpace(loadedFundSpace);
        setResolvedFundSpaceId(finalFundSpaceId);
        setRounds(loadedRounds);
        setMembers(mappedMembers);

        setSelectedRoundId((current) => {
          if (current && loadedRounds.some((round) => round.id === current)) {
            return current;
          }

          const currentRound =
            loadedRounds.find(
              (round) =>
                round.round_number === loadedFundSpace.current_round_number
            ) ||
            loadedRounds.find(
              (round) =>
                String(round.status || '').toUpperCase() === 'COLLECTING'
            ) ||
            loadedRounds.find(
              (round) =>
                String(round.status || '').toUpperCase() === 'ACTIVE'
            ) ||
            loadedRounds[loadedRounds.length - 1] ||
            loadedRounds[0];

          return currentRound?.id || '';
        });
      } catch (error) {
        console.error('Agent Fund Space details load error:', error);

        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'Unable to load Fund Space details.'
        );

        setCurrentProfile(null);
        setFundSpace(null);
        setResolvedFundSpaceId('');
        setMembers([]);
        setRounds([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [routeId]
  );

  useEffect(() => {
    loadPage();
  }, [loadPage]);

  function openPaymentModal(
    member: MemberWithProfile,
    contribution: Contribution
  ) {
    setSelectedContribution(contribution);
    setSelectedCustomerName(member.profile?.full_name || 'Customer');
    setPaymentModalOpen(true);
    setErrorMessage('');
    setSuccessMessage('');
  }

  async function handleSubmittedPayment() {
    setSuccessMessage('Payment submitted successfully. Admin will review it.');
    setPaymentModalOpen(false);
    setSelectedContribution(null);
    setSelectedCustomerName('');
    await loadPage(true);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-6 md:px-8">
        <div className="mx-auto flex min-h-[60vh] max-w-7xl items-center justify-center">
          <div className="text-center">
            <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-emerald-700" />
            <h1 className="text-lg font-black text-slate-900">
              Loading customer Fund Space...
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Please wait while TrustPoint loads the agent payment page.
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (errorMessage && !fundSpace) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-6 md:px-8">
        <div className="mx-auto max-w-3xl">
          <Link
            href="/agent/fund-space"
            className="mb-5 inline-flex min-h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Fund Space Customers
          </Link>

          <section className="rounded-3xl border border-red-200 bg-red-50 p-6 text-red-700 shadow-sm">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-1 h-6 w-6 shrink-0" />
              <div>
                <h1 className="text-xl font-black">Could not load details</h1>
                <p className="mt-2 text-sm font-bold leading-6">
                  {errorMessage}
                </p>
              </div>
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-5 md:px-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <Link
            href="/agent/fund-space"
            className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Fund Space Customers
          </Link>

          <button
            type="button"
            onClick={() => loadPage(true)}
            disabled={refreshing}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {refreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Refresh
          </button>
        </div>

        {successMessage && (
          <AlertBox type="success">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
            <p>{successMessage}</p>
          </AlertBox>
        )}

        {errorMessage && fundSpace && (
          <AlertBox type="error">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <p>{errorMessage}</p>
          </AlertBox>
        )}

        <section className="grid gap-5 xl:grid-cols-[1fr_420px]">
          <div className="rounded-3xl bg-gradient-to-br from-emerald-800 via-emerald-700 to-teal-700 p-5 text-white shadow-sm md:p-7">
            <div className="flex h-full flex-col justify-between gap-6">
              <div className="min-w-0">
                <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-black">
                  <Users className="h-4 w-4" />
                  Agent Customer Fund Space
                </p>

                <h1 className="break-words text-2xl font-black tracking-tight md:text-4xl">
                  {targetCustomer?.profile?.full_name ||
                    fundSpace?.name ||
                    'Customer Fund Space'}
                </h1>

                <p className="mt-3 max-w-3xl text-sm leading-7 text-emerald-50 md:text-base">
                  Collect weekly contribution, check payment status, and view
                  live group transparency for this customer.
                </p>

                <div className="mt-5 flex flex-wrap gap-2">
                  <StatusPill status={fundSpace?.status} />
                  <span className="rounded-full border border-white/20 bg-white/15 px-3 py-1 text-xs font-black text-white">
                    {formatCurrency(fundSpace?.contribution_amount)} weekly
                  </span>
                  <span className="rounded-full border border-white/20 bg-white/15 px-3 py-1 text-xs font-black text-white">
                    Round{' '}
                    {selectedRound?.round_number ||
                      fundSpace?.current_round_number ||
                      'N/A'}
                  </span>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <HeroMiniCard
                  label="Customer Phone"
                  value={targetCustomer?.profile?.phone || 'No phone'}
                  helper={targetCustomer?.relationship_label || 'Customer'}
                />

                <HeroMiniCard
                  label="Current Recipient"
                  value={
                    currentRecipient?.profile?.full_name ||
                    'No recipient set'
                  }
                  helper={
                    selectedRound
                      ? `Round ${selectedRound.round_number}`
                      : 'No active round'
                  }
                />
              </div>
            </div>
          </div>

          <QuickPaymentCard
            targetCustomer={targetCustomer}
            targetContribution={targetContribution}
            amountRemaining={targetAmountRemaining}
            canPay={targetCanPay}
            selectedRound={selectedRound}
            onPay={() => {
              if (targetCustomer && targetContribution) {
                openPaymentModal(targetCustomer, targetContribution);
              }
            }}
          />
        </section>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <SummaryCard
            title="Visible Members"
            value={stats.members}
            helper="You and linked customers"
            icon={<Users className="h-5 w-5" />}
          />

          <SummaryCard
            title="Paid"
            value={stats.paid}
            helper="Paid in selected round"
            icon={<CheckCircle2 className="h-5 w-5" />}
          />

          <SummaryCard
            title="Pending"
            value={stats.pending}
            helper="Not fully paid"
            icon={<Clock className="h-5 w-5" />}
          />

          <SummaryCard
            title="Late / Missed"
            value={`${stats.late}/${stats.missed}`}
            helper="Late and missed"
            icon={<TimerReset className="h-5 w-5" />}
          />

          <SummaryCard
            title="Collected"
            value={formatCurrency(stats.collectedAmount)}
            helper={`Expected ${formatCurrency(stats.expectedAmount)}`}
            icon={<Wallet className="h-5 w-5" />}
          />
        </section>

        <section className="grid gap-5 lg:grid-cols-[1fr_360px]">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-start gap-3">
              <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-700">
                <CalendarClock className="h-6 w-6" />
              </div>

              <div className="min-w-0">
                <h2 className="text-lg font-black text-slate-900">
                  Current Round
                </h2>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  The selected round controls the customer payment action and
                  member contribution list.
                </p>
              </div>
            </div>

            <select
              value={selectedRoundId}
              onChange={(event) => setSelectedRoundId(event.target.value)}
              className="min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-700 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            >
              {rounds.length === 0 && <option value="">No rounds found</option>}

              {rounds.map((round) => (
                <option key={round.id} value={round.id}>
                  Round {round.round_number} • {formatLabel(round.status)} •
                  Deadline {formatDate(getRoundDeadline(round))}
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-amber-800 shadow-sm">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-1 h-5 w-5 shrink-0" />
              <div>
                <h2 className="font-black">Agent visibility rule</h2>
                <p className="mt-2 text-sm font-semibold leading-6">
                  Agents see themselves and their own registered customers.
                  Admins and super admins can see all group members.
                </p>
              </div>
            </div>
          </div>
        </section>

        <SectionTabs activeSection={activeSection} onChange={setActiveSection} />

        {activeSection === 'collect' && (
          <MembersContributionList
            members={visibleMembers}
            selectedRound={selectedRound}
            fundSpace={fundSpace}
            onPay={openPaymentModal}
          />
        )}

        {activeSection === 'transparency' && resolvedFundSpaceId && (
          <FundSpaceTransparencyDashboard
            fundSpaceId={resolvedFundSpaceId}
            compact
          />
        )}

        {activeSection === 'members' && (
          <section className="grid gap-5 lg:grid-cols-2">
            <CurrentRecipientCard recipient={currentRecipient} />
            <CollectionSummaryCard stats={stats} />
          </section>
        )}

        {activeSection === 'records' && (
          <CustomerRecordsPanel customer={targetCustomer} />
        )}
      </div>

      {selectedContribution && (
        <ManualMerchantPaymentModal
          open={paymentModalOpen}
          onClose={() => {
            setPaymentModalOpen(false);
            setSelectedContribution(null);
            setSelectedCustomerName('');
          }}
          onSubmitted={handleSubmittedPayment}
          contributionId={selectedContribution.id}
          customerName={selectedCustomerName}
          amountDue={getAmountRemaining(selectedContribution)}
          title="Submit Fund Space Contribution"
        />
      )}
    </main>
  );
}

function AlertBox({
  type,
  children,
}: {
  type: 'success' | 'error';
  children: ReactNode;
}) {
  return (
    <div
      className={`rounded-3xl border p-5 text-sm font-bold ${
        type === 'success'
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
          : 'border-red-200 bg-red-50 text-red-700'
      }`}
    >
      <div className="flex items-start gap-3">{children}</div>
    </div>
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
    <div className="min-w-0 rounded-2xl bg-white/15 p-4 backdrop-blur">
      <p className="text-sm text-emerald-50">{label}</p>
      <p className="mt-1 break-words text-xl font-black">{value}</p>
      <p className="mt-1 break-words text-xs text-emerald-50">{helper}</p>
    </div>
  );
}

function SummaryCard({
  title,
  value,
  helper,
  icon,
}: {
  title: string;
  value: string | number;
  helper: string;
  icon: ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 inline-flex rounded-2xl bg-emerald-50 p-3 text-emerald-700">
        {icon}
      </div>

      <p className="break-words text-sm font-bold text-slate-500">{title}</p>
      <p className="mt-1 break-words text-xl font-black text-slate-900">
        {value}
      </p>
      <p className="mt-1 break-words text-xs leading-5 text-slate-500">
        {helper}
      </p>
    </div>
  );
}

function QuickPaymentCard({
  targetCustomer,
  targetContribution,
  amountRemaining,
  canPay,
  selectedRound,
  onPay,
}: {
  targetCustomer: MemberWithProfile | null;
  targetContribution: Contribution | null;
  amountRemaining: number;
  canPay: boolean;
  selectedRound: Round | null;
  onPay: () => void;
}) {
  return (
    <section className="rounded-3xl border border-emerald-100 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
          <Smartphone className="h-5 w-5" />
        </div>

        <div className="min-w-0">
          <h2 className="text-xl font-black text-slate-900">
            Collect Weekly Payment
          </h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            Submit the customer’s MoMo reference from here.
          </p>
        </div>
      </div>

      <div className="mt-5 rounded-3xl bg-slate-50 p-4">
        <p className="text-xs font-black uppercase tracking-wide text-slate-400">
          Selected Customer
        </p>
        <p className="mt-1 break-words text-lg font-black text-slate-900">
          {targetCustomer?.profile?.full_name || 'No customer selected'}
        </p>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-500">
          <Phone className="h-4 w-4" />
          {targetCustomer?.profile?.phone || 'No phone'}
        </p>
      </div>

      {targetContribution ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <DetailBox
            label="Amount Due"
            value={formatCurrency(targetContribution.amount_due)}
          />
          <DetailBox
            label="Amount Paid"
            value={formatCurrency(targetContribution.amount_paid)}
          />
          <DetailBox
            label="Remaining"
            value={formatCurrency(amountRemaining)}
          />
        </div>
      ) : (
        <div className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm font-bold leading-6 text-amber-700">
          No contribution record was found for Round{' '}
          {selectedRound?.round_number || 'N/A'}.
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <StatusPill status={targetContribution?.status || 'NO_RECORD'} />
        <StatusPill status={targetContribution?.payment_timing || 'PENDING'} />
        <StatusPill status={targetContribution?.late_fee_status || 'NONE'} />
      </div>

      <button
        type="button"
        disabled={!canPay}
        onClick={onPay}
        className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-4 text-sm font-black text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Smartphone className="h-4 w-4" />
        {canPay ? 'Pay with MoMo' : 'Payment Not Available'}
      </button>

      {!canPay && targetContribution && (
        <p className="mt-3 text-xs font-semibold leading-5 text-slate-500">
          This contribution is not open for manual payment. It may already be
          paid or awaiting admin review.
        </p>
      )}
    </section>
  );
}

function SectionTabs({
  activeSection,
  onChange,
}: {
  activeSection: ActiveSection;
  onChange: (section: ActiveSection) => void;
}) {
  const tabs: { label: string; value: ActiveSection; helper: string }[] = [
    {
      label: 'Collect Payment',
      value: 'collect',
      helper: 'Customer payment list',
    },
    {
      label: 'Transparency',
      value: 'transparency',
      helper: 'Live group status',
    },
    {
      label: 'Round Summary',
      value: 'members',
      helper: 'Recipient and collection',
    },
    {
      label: 'Customer Records',
      value: 'records',
      helper: 'Customer payouts and contributions',
    },
  ];

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="grid gap-2 md:grid-cols-4">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => onChange(tab.value)}
            className={`min-w-0 rounded-2xl px-4 py-3 text-left transition ${
              activeSection === tab.value
                ? 'bg-emerald-700 text-white'
                : 'bg-slate-50 text-slate-700 hover:bg-emerald-50 hover:text-emerald-700'
            }`}
          >
            <p className="truncate text-sm font-black">{tab.label}</p>
            <p
              className={`mt-1 truncate text-xs font-semibold ${
                activeSection === tab.value ? 'text-emerald-50' : 'text-slate-400'
              }`}
            >
              {tab.helper}
            </p>
          </button>
        ))}
      </div>
    </section>
  );
}

function MembersContributionList({
  members,
  selectedRound,
  fundSpace,
  onPay,
}: {
  members: MemberWithProfile[];
  selectedRound: Round | null;
  fundSpace: FundSpace | null;
  onPay: (member: MemberWithProfile, contribution: Contribution) => void;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-black text-slate-900">
            Customer Payments
          </h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            Contribution status for Round {selectedRound?.round_number || 'N/A'}.
          </p>
        </div>

        <StatusPill status={selectedRound?.status} />
      </div>

      {members.length === 0 ? (
        <EmptyBlock message="No visible members found for your agent account." />
      ) : (
        <div className="space-y-4">
          {[...members]
            .sort((a, b) => getMemberOrder(a) - getMemberOrder(b))
            .map((member) => {
              const contribution = getContributionForRound(
                member,
                selectedRound?.id || null
              );

              const lateFeeAmount = Number(contribution?.late_fee_amount || 0);
              const canPay = canSubmitPayment(contribution);

              return (
                <article
                  key={member.id}
                  className="rounded-3xl border border-slate-200 bg-slate-50 p-4 md:p-5"
                >
                  <div className="grid gap-5 xl:grid-cols-[1fr_260px]">
                    <div className="min-w-0">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <p className="mb-2 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-black text-emerald-700">
                            <UserRound className="h-4 w-4" />
                            {member.relationship_label}
                          </p>

                          <h3 className="break-words text-lg font-black text-slate-900">
                            {member.profile?.full_name || 'Unknown member'}
                          </h3>

                          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-500">
                            <Phone className="h-4 w-4" />
                            {member.profile?.phone || 'No phone'}
                            <span>•</span>
                            Position{' '}
                            {member.position_number ||
                              member.payout_order ||
                              'N/A'}
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <StatusPill status={member.status} />
                          <StatusPill status={member.profile?.verification_status} />
                        </div>
                      </div>

                      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        <DetailBox
                          label="Amount Due"
                          value={formatCurrency(
                            contribution?.amount_due ||
                              member.contribution_amount ||
                              fundSpace?.contribution_amount
                          )}
                        />

                        <DetailBox
                          label="Amount Paid"
                          value={formatCurrency(contribution?.amount_paid)}
                        />

                        <DetailBox
                          label="Payment Status"
                          value={formatLabel(contribution?.status)}
                        />

                        <DetailBox
                          label="Payment Timing"
                          value={formatLabel(contribution?.payment_timing)}
                        />

                        <DetailBox
                          label="Paid At"
                          value={formatDateTime(contribution?.paid_at)}
                        />

                        <DetailBox
                          label="Late Fee"
                          value={formatCurrency(lateFeeAmount)}
                        />

                        <DetailBox
                          label="Late Fee Status"
                          value={formatLabel(contribution?.late_fee_status)}
                        />

                        <DetailBox
                          label="Reference"
                          value={contribution?.payment_reference || 'Not set'}
                        />
                      </div>

                      {contribution?.late_fee_waiver_reason && (
                        <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-emerald-700">
                          <p className="text-xs font-black uppercase tracking-wide">
                            Late Fee Waiver Reason
                          </p>
                          <p className="mt-2 text-sm font-semibold leading-6">
                            {contribution.late_fee_waiver_reason}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="rounded-3xl border border-slate-200 bg-white p-4">
                      <p className="mb-3 text-sm font-black text-slate-900">
                        Payment Action
                      </p>

                      {contribution ? (
                        <>
                          <button
                            type="button"
                            disabled={!canPay}
                            onClick={() => onPay(member, contribution)}
                            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-4 text-sm font-black text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Smartphone className="h-4 w-4" />
                            {canPay ? 'Pay with MoMo' : 'Payment Submitted'}
                          </button>

                          {!canPay && (
                            <p className="mt-3 text-xs font-semibold leading-5 text-slate-500">
                              This contribution is not open for manual payment.
                              If it is pending admin review, wait for admin
                              approval.
                            </p>
                          )}
                        </>
                      ) : (
                        <p className="rounded-2xl bg-amber-50 p-4 text-sm font-bold leading-6 text-amber-700">
                          No contribution record found for this round.
                        </p>
                      )}

                      {member.payouts.length > 0 && (
                        <div className="mt-4 rounded-2xl bg-slate-50 p-4">
                          <p className="text-xs font-black uppercase tracking-wide text-slate-400">
                            Latest Payout
                          </p>
                          <p className="mt-1 text-sm font-black text-slate-900">
                            {formatCurrency(member.payouts[0]?.net_amount)}
                          </p>
                          <p className="mt-1 text-xs font-semibold text-slate-500">
                            {formatLabel(member.payouts[0]?.status)} •{' '}
                            {formatDate(member.payouts[0]?.paid_at)}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
        </div>
      )}
    </section>
  );
}

function CurrentRecipientCard({
  recipient,
}: {
  recipient: MemberWithProfile | null;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-start gap-3">
        <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-700">
          <HandCoins className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-lg font-black text-slate-900">
            Current Payout Recipient
          </h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            Member expected to receive payout for the selected round.
          </p>
        </div>
      </div>

      {recipient ? (
        <div className="rounded-2xl bg-slate-50 p-4">
          <p className="break-words text-lg font-black text-slate-900">
            {recipient.profile?.full_name || 'Unknown recipient'}
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            {recipient.profile?.phone || 'No phone'} • Position{' '}
            {recipient.position_number || recipient.payout_order || 'N/A'}
          </p>
        </div>
      ) : (
        <p className="rounded-2xl bg-slate-50 p-4 text-sm font-bold text-slate-500">
          No payout recipient is set for this round.
        </p>
      )}
    </div>
  );
}

function CollectionSummaryCard({
  stats,
}: {
  stats: {
    expectedAmount: number;
    collectedAmount: number;
    paid: number;
    pending: number;
  };
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-start gap-3">
        <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-700">
          <CircleDollarSign className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-lg font-black text-slate-900">
            Collection Summary
          </h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            Selected round collection progress.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <DetailBox label="Expected" value={formatCurrency(stats.expectedAmount)} />
        <DetailBox label="Collected" value={formatCurrency(stats.collectedAmount)} />
        <DetailBox label="Paid Members" value={stats.paid} />
        <DetailBox label="Pending Members" value={stats.pending} />
      </div>
    </div>
  );
}

function CustomerRecordsPanel({
  customer,
}: {
  customer: MemberWithProfile | null;
}) {
  if (!customer) {
    return <EmptyBlock message="No customer selected for records." />;
  }

  return (
    <section className="grid gap-5 xl:grid-cols-2">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-start gap-3">
          <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-700">
            <Info className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900">
              Customer Contribution Records
            </h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              Payment records for {customer.profile?.full_name || 'customer'}.
            </p>
          </div>
        </div>

        {customer.contributions.length === 0 ? (
          <EmptyBlock message="No contribution records found." />
        ) : (
          <div className="space-y-3">
            {customer.contributions.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl border border-slate-100 bg-slate-50 p-4"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-black text-slate-900">
                      Due: {formatCurrency(item.amount_due)}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">
                      Paid: {formatCurrency(item.amount_paid)} •{' '}
                      {formatDateTime(item.paid_at)}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">
                      Ref: {item.payment_reference || 'Not set'}
                    </p>
                  </div>

                  <StatusPill status={item.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-start gap-3">
          <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-700">
            <Banknote className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900">
              Customer Payout Records
            </h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              Payout records for this customer.
            </p>
          </div>
        </div>

        {customer.payouts.length === 0 ? (
          <EmptyBlock message="No payout records found." />
        ) : (
          <div className="space-y-3">
            {customer.payouts.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl border border-slate-100 bg-slate-50 p-4"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-black text-slate-900">
                      Net: {formatCurrency(item.net_amount)}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">
                      Gross: {formatCurrency(item.gross_amount)} • Fee:{' '}
                      {formatCurrency(item.platform_fee)}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">
                      Paid: {formatDateTime(item.paid_at)}
                    </p>
                  </div>

                  <StatusPill status={item.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}