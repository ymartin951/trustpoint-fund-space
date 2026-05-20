'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  AlertCircle,
  ArrowLeft,
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
import { useToast } from '@/hooks/use-toast';

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
  updated_at: string | null;
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

type ProfileSummary = {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  verification_status?: string | null;
};

type MemberWithProfile = FundSpaceMember & {
  profile: ProfileSummary | null;
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

type Contribution = {
  id: string;
  fund_space_id: string;
  round_id: string;
  user_id: string;
  amount_due: number;
  amount_paid: number;
  status: string;
  paid_at: string | null;
  payment_method: string | null;
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
  approved_at: string | null;
  paid_at: string | null;
  payout_method: string | null;
  payout_reference: string | null;
  created_at: string | null;
};

type PaymentTransaction = {
  id: string;
  payment_type: string;
  contribution_id: string | null;
  status: string;
  amount: number;
  provider: string;
  channel: string;
  internal_reference: string;
  provider_reference: string | null;
  checkout_url: string | null;
  created_at: string | null;
};

type ContributionPaymentResponse = {
  success?: boolean;
  message?: string;
  authorization_url?: string;
  reference?: string;
  payment_transaction_id?: string;
  contribution_id?: string;
  amount?: number;
  existing_payment?: boolean;
};

type VerifyPaymentResponse = {
  success?: boolean;
  message?: string;
  already_processed?: boolean;
  payment_status?: string;
  verification_mismatch?: boolean;
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
      'SUCCESS',
      'COMPLETED',
      'APPROVED_FOR_PAYOUT',
    ].includes(value)
  ) {
    return 'bg-emerald-50 text-emerald-700 border-emerald-100';
  }

  if (
    [
      'PENDING',
      'PROCESSING',
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

  if (
    [
      'REJECTED',
      'FAILED',
      'OVERDUE',
      'DEFAULTED',
      'SUSPENDED',
      'REMOVED',
      'CANCELLED',
      'ABANDONED',
      'REVERSED',
    ].includes(value)
  ) {
    return 'bg-red-50 text-red-700 border-red-100';
  }

  return 'bg-gray-50 text-gray-700 border-gray-100';
}

function getSafeOrderValue(member: MemberWithProfile) {
  return member.payout_order || member.position_number || 999999;
}

function getPaymentProgress(amountPaid: number, amountDue: number) {
  if (!amountDue || amountDue <= 0) return 0;

  return Math.min((Number(amountPaid || 0) / Number(amountDue || 0)) * 100, 100);
}

function getPaymentReferenceFromUrl(searchParams: {
  get: (name: string) => string | null;
}) {
  return (
    searchParams.get('payment_reference') ||
    searchParams.get('reference') ||
    searchParams.get('trxref') ||
    ''
  ).trim();
}

function getAmountRemaining(contribution: Contribution | null) {
  if (!contribution) return 0;

  return Math.max(
    Number(contribution.amount_due || 0) - Number(contribution.amount_paid || 0),
    0
  );
}

export default function FundSpaceDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const { profile, loading } = useAuth();
  const { toast } = useToast();

  const verificationAttemptedRef = useRef(false);

  const fundSpaceId = typeof params.id === 'string' ? params.id : '';

  const [pageLoading, setPageLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [payingContribution, setPayingContribution] = useState(false);
  const [verifyingPayment, setVerifyingPayment] = useState(false);

  const [fundSpace, setFundSpace] = useState<FundSpace | null>(null);
  const [myMemberRecord, setMyMemberRecord] =
    useState<FundSpaceMember | null>(null);
  const [members, setMembers] = useState<MemberWithProfile[]>([]);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [myContributions, setMyContributions] = useState<Contribution[]>([]);
  const [myPayouts, setMyPayouts] = useState<Payout[]>([]);
  const [paymentAttempts, setPaymentAttempts] = useState<PaymentTransaction[]>(
    []
  );
  const [errorMessage, setErrorMessage] = useState('');

  const loadFundSpace = useCallback(async () => {
    const { data, error } = await supabase
      .from('fund_spaces')
      .select('*')
      .eq('id', fundSpaceId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    const loaded = data as unknown as FundSpace | null;

    setFundSpace(loaded);

    return loaded;
  }, [fundSpaceId]);

  const loadMyMemberRecord = useCallback(
    async (userId: string) => {
      const { data, error } = await supabase
        .from('fund_space_members')
        .select('*')
        .eq('fund_space_id', fundSpaceId)
        .eq('user_id', userId)
        .in('status', ['ACTIVE', 'COMPLETED'])
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (!data) {
        setErrorMessage('You are not an active member of this Fund Space.');
        setMyMemberRecord(null);
        return null;
      }

      const memberRecord = data as unknown as FundSpaceMember;

      setMyMemberRecord(memberRecord);

      return memberRecord;
    },
    [fundSpaceId]
  );

  const loadMembers = useCallback(async () => {
    const { data: memberData, error: memberError } = await supabase
      .from('fund_space_members')
      .select('*')
      .eq('fund_space_id', fundSpaceId)
      .in('status', ['ACTIVE', 'COMPLETED'])
      .order('payout_order', { ascending: true, nullsFirst: false });

    if (memberError) {
      throw memberError;
    }

    const rawMembers = (memberData || []) as unknown as FundSpaceMember[];

    if (rawMembers.length === 0) {
      setMembers([]);
      return;
    }

    const userIds = Array.from(
      new Set(rawMembers.map((member) => member.user_id).filter(Boolean))
    );

    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('id, full_name, phone, email, verification_status')
      .in('id', userIds);

    if (profileError) {
      console.warn('Member profiles load warning:', profileError.message);

      setMembers(
        rawMembers.map((member) => ({
          ...member,
          profile: null,
        }))
      );
      return;
    }

    const profileMap = new Map(
      ((profileData || []) as ProfileSummary[]).map((item) => [item.id, item])
    );

    const mergedMembers = rawMembers.map((member) => ({
      ...member,
      profile: profileMap.get(member.user_id) || null,
    }));

    setMembers(mergedMembers);
  }, [fundSpaceId]);

  const loadRounds = useCallback(async () => {
    const { data, error } = await supabase
      .from('fund_space_rounds')
      .select('*')
      .eq('fund_space_id', fundSpaceId)
      .order('round_number', { ascending: true });

    if (error) {
      console.warn('Rounds load warning:', error.message);
      setRounds([]);
      return;
    }

    setRounds((data || []) as unknown as Round[]);
  }, [fundSpaceId]);

  const loadMyContributions = useCallback(
    async (userId: string) => {
      const { data, error } = await supabase
        .from('fund_space_contributions')
        .select('*')
        .eq('fund_space_id', fundSpaceId)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Contributions load warning:', error.message);
        setMyContributions([]);
        return;
      }

      setMyContributions((data || []) as unknown as Contribution[]);
    },
    [fundSpaceId]
  );

  const loadMyPayouts = useCallback(
    async (userId: string) => {
      const { data, error } = await supabase
        .from('fund_space_payouts')
        .select('*')
        .eq('fund_space_id', fundSpaceId)
        .eq('recipient_user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Payouts load warning:', error.message);
        setMyPayouts([]);
        return;
      }

      setMyPayouts((data || []) as unknown as Payout[]);
    },
    [fundSpaceId]
  );

  const loadPaymentAttempts = useCallback(
    async (userId: string) => {
      const { data, error } = await supabase
        .from('payment_transactions')
        .select(
          'id, payment_type, contribution_id, status, amount, provider, channel, internal_reference, provider_reference, checkout_url, created_at'
        )
        .eq('user_id', userId)
        .eq('fund_space_id', fundSpaceId)
        .in('payment_type', [
          'FUND_SPACE_CONTRIBUTION',
          'AGENT_CUSTOMER_CONTRIBUTION',
        ])
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        console.warn('Payment attempts load warning:', error.message);
        setPaymentAttempts([]);
        return;
      }

      setPaymentAttempts((data || []) as unknown as PaymentTransaction[]);
    },
    [fundSpaceId]
  );

  const loadPage = useCallback(
    async (showRefreshState = false) => {
      try {
        if (showRefreshState) {
          setRefreshing(true);
        } else {
          setPageLoading(true);
        }

        setErrorMessage('');

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) {
          throw userError;
        }

        const userId = profile?.id || user?.id;

        if (!userId) {
          setErrorMessage('Unable to identify your account. Please log in again.');
          return;
        }

        const loadedFundSpace = await loadFundSpace();

        if (!loadedFundSpace) {
          setErrorMessage('Fund Space group was not found.');
          return;
        }

        const memberRecord = await loadMyMemberRecord(userId);

        if (!memberRecord) {
          return;
        }

        await Promise.all([
          loadMembers(),
          loadRounds(),
          loadMyContributions(userId),
          loadMyPayouts(userId),
          loadPaymentAttempts(userId),
        ]);
      } catch (error: unknown) {
        console.error('Fund Space details load error:', error);

        const message =
          error instanceof Error
            ? error.message
            : 'Unable to load Fund Space details.';

        setErrorMessage(message);
      } finally {
        setPageLoading(false);
        setRefreshing(false);
      }
    },
    [
      profile?.id,
      loadFundSpace,
      loadMyMemberRecord,
      loadMembers,
      loadRounds,
      loadMyContributions,
      loadMyPayouts,
      loadPaymentAttempts,
    ]
  );

  const verifyReturnedPayment = useCallback(
    async (reference: string) => {
      if (!reference || verificationAttemptedRef.current) return;

      verificationAttemptedRef.current = true;

      try {
        setVerifyingPayment(true);

        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError || !session?.access_token) {
          throw new Error('Your session has expired. Please log in again.');
        }

        const response = await fetch(
          `/api/payments/verify?reference=${encodeURIComponent(reference)}`,
          {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
          }
        );

        const result = (await response.json()) as VerifyPaymentResponse;

        if (!response.ok || !result.success) {
          throw new Error(
            result.message ||
              'Payment could not be verified. Please refresh or contact support.'
          );
        }

        toast({
          title: result.already_processed
            ? 'Payment already processed'
            : 'Payment verified',
          description:
            result.message ||
            'Your contribution payment has been verified successfully.',
        });

        await loadPage(true);

        router.replace(`/dashboard/fund-space/${fundSpaceId}`);
      } catch (error) {
        console.error('Returned contribution payment verification error:', error);

        toast({
          title: 'Payment verification failed',
          description:
            error instanceof Error
              ? error.message
              : 'Unable to verify the returned payment.',
          variant: 'destructive',
        });
      } finally {
        setVerifyingPayment(false);
      }
    },
    [fundSpaceId, loadPage, router, toast]
  );

  useEffect(() => {
    if (loading) return;

    if (!fundSpaceId) {
      setErrorMessage('Invalid Fund Space ID.');
      setPageLoading(false);
      return;
    }

    loadPage();
  }, [loading, fundSpaceId, profile?.id, loadPage]);

  useEffect(() => {
    if (!profile?.id || pageLoading) return;

    const reference = getPaymentReferenceFromUrl(searchParams);

    if (reference) {
      verifyReturnedPayment(reference);
    }
  }, [profile?.id, pageLoading, searchParams, verifyReturnedPayment]);

  const memberPosition = useMemo(() => {
    if (!myMemberRecord) return null;

    if (myMemberRecord.payout_order) {
      return myMemberRecord.payout_order;
    }

    const sorted = [...members].sort(
      (a, b) => getSafeOrderValue(a) - getSafeOrderValue(b)
    );

    const index = sorted.findIndex((member) => member.id === myMemberRecord.id);

    if (index === -1) return null;

    return index + 1;
  }, [members, myMemberRecord]);

  const currentRound = useMemo(() => {
    return (
      rounds.find(
        (round) => round.round_number === fundSpace?.current_round_number
      ) || null
    );
  }, [rounds, fundSpace?.current_round_number]);

  const currentRoundRecipient = useMemo(() => {
    if (!currentRound) return null;

    return (
      members.find((member) => member.user_id === currentRound.recipient_user_id) ||
      null
    );
  }, [members, currentRound]);

  const currentContribution = useMemo(() => {
    if (!currentRound) return null;

    return (
      myContributions.find(
        (contribution) => contribution.round_id === currentRound.id
      ) || null
    );
  }, [currentRound, myContributions]);

  const roundByRecipientUserId = useMemo(() => {
    return new Map(rounds.map((round) => [round.recipient_user_id, round]));
  }, [rounds]);

  const roundByRoundNumber = useMemo(() => {
    return new Map(rounds.map((round) => [round.round_number, round]));
  }, [rounds]);

  const payoutOrderSchedule = useMemo(() => {
    const sorted = [...members].sort(
      (a, b) => getSafeOrderValue(a) - getSafeOrderValue(b)
    );

    return sorted.map((member, index) => {
      const payoutOrder = member.payout_order || member.position_number || index + 1;
      const matchingRound =
        roundByRecipientUserId.get(member.user_id) ||
        roundByRoundNumber.get(payoutOrder) ||
        null;

      return {
        ...member,
        payoutOrder,
        matchingRound,
        isMe: member.user_id === profile?.id,
        isCurrentRecipient:
          currentRound?.recipient_user_id === member.user_id || false,
      };
    });
  }, [
    members,
    profile?.id,
    roundByRecipientUserId,
    roundByRoundNumber,
    currentRound,
  ]);

  const myPayoutRound = useMemo(() => {
    if (!myMemberRecord) return null;

    return (
      roundByRecipientUserId.get(myMemberRecord.user_id) ||
      (myMemberRecord.payout_order
        ? roundByRoundNumber.get(myMemberRecord.payout_order)
        : null) ||
      null
    );
  }, [myMemberRecord, roundByRecipientUserId, roundByRoundNumber]);

  const myNextContribution = useMemo(() => {
    return (
      myContributions.find((item) =>
        ['PENDING', 'OVERDUE', 'PARTIALLY_PAID'].includes(item.status)
      ) || null
    );
  }, [myContributions]);

  const paymentTargetContribution = currentContribution || myNextContribution;
  const amountRemaining = getAmountRemaining(paymentTargetContribution);

  const pendingPaymentForTarget = useMemo(() => {
    if (!paymentTargetContribution) return null;

    return (
      paymentAttempts.find(
        (payment) =>
          payment.contribution_id === paymentTargetContribution.id &&
          ['PENDING', 'PROCESSING'].includes(payment.status)
      ) || null
    );
  }, [paymentAttempts, paymentTargetContribution]);

  const canPayContribution =
    Boolean(paymentTargetContribution) &&
    amountRemaining > 0 &&
    profile?.status === 'ACTIVE' &&
    profile?.verification_status === 'VERIFIED' &&
    (profile?.role === 'USER' || profile?.role === 'AGENT') &&
    fundSpace?.status === 'ACTIVE' &&
    !['PAID', 'WAIVED'].includes(paymentTargetContribution?.status || '');

  const myLatestPayout = myPayouts[0] || null;

  const memberCount = members.length;
  const maxMembers = fundSpace?.member_limit ?? 10;
  const progress =
    maxMembers > 0 ? Math.min((memberCount / maxMembers) * 100, 100) : 0;

  const currentContributionProgress = currentContribution
    ? getPaymentProgress(
        currentContribution.amount_paid,
        currentContribution.amount_due
      )
    : 0;

  async function handlePayContribution() {
    if (!paymentTargetContribution) {
      toast({
        title: 'No contribution found',
        description: 'There is no pending contribution to pay.',
        variant: 'destructive',
      });
      return;
    }

    if (!canPayContribution) {
      toast({
        title: 'Payment not available',
        description:
          'This contribution cannot be paid right now. Please check your verification, group status, or contribution status.',
        variant: 'destructive',
      });
      return;
    }

    if (pendingPaymentForTarget?.checkout_url) {
      window.location.href = pendingPaymentForTarget.checkout_url;
      return;
    }

    try {
      setPayingContribution(true);

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.access_token) {
        throw new Error('Your session has expired. Please log in again.');
      }

      const response = await fetch(
        '/api/payments/fund-space-contribution/initiate',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contribution_id: paymentTargetContribution.id,
            momo_number: profile?.momo_number || profile?.phone,
          }),
        }
      );

      const result = (await response.json()) as ContributionPaymentResponse;

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || 'Unable to initialize contribution payment.'
        );
      }

      if (!result.authorization_url) {
        throw new Error('Payment checkout URL was not returned.');
      }

      toast({
        title: result.existing_payment
          ? 'Continuing pending payment'
          : 'Payment started',
        description:
          result.message ||
          'Redirecting you to complete your Mobile Money contribution payment.',
      });

      window.location.href = result.authorization_url;
    } catch (error) {
      console.error('Pay contribution error:', error);

      toast({
        title: 'Payment error',
        description:
          error instanceof Error
            ? error.message
            : 'Failed to start contribution payment.',
        variant: 'destructive',
      });
    } finally {
      setPayingContribution(false);
    }
  }

  if (loading || pageLoading) {
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

  if (errorMessage && !fundSpace) {
    return (
      <div className="space-y-5">
        <button
          type="button"
          onClick={() => router.push('/dashboard/fund-space')}
          className="inline-flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-gray-900"
        >
          <ArrowLeft size={16} />
          Back to Fund Space
        </button>

        <div className="rounded-2xl border border-red-100 bg-red-50 p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-1 h-5 w-5 shrink-0 text-red-600" />

            <div>
              <h2 className="text-xl font-bold text-red-700">
                Unable to load Fund Space
              </h2>

              <p className="mt-2 text-sm text-red-600">{errorMessage}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={() => router.push('/dashboard/fund-space')}
          className="inline-flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-gray-900"
        >
          <ArrowLeft size={16} />
          Back to Fund Space
        </button>

        <button
          type="button"
          onClick={() => loadPage(true)}
          disabled={refreshing || verifyingPayment}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {verifyingPayment && (
        <div className="flex items-start gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">
          <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin" />
          <span>
            Verifying your contribution payment with Paystack before updating
            your Fund Space record.
          </span>
        </div>
      )}

      {errorMessage && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm font-semibold text-amber-700">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <div className="rounded-3xl bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-600 p-6 text-white shadow-sm md:p-8">
        <div className="flex flex-col justify-between gap-6 xl:flex-row xl:items-center">
          <div>
            <p className="mb-3 inline-flex rounded-full bg-white/15 px-4 py-1 text-sm font-medium">
              My Fund Space
            </p>

            <h1 className="text-3xl font-black md:text-4xl">
              {fundSpace?.name || 'TrustPoint Fund Space'}
            </h1>

            <p className="mt-3 max-w-3xl text-sm leading-7 text-emerald-50 md:text-base">
              Weekly contribution of{' '}
              <span className="font-bold">
                {formatCurrency(fundSpace?.contribution_amount)}
              </span>{' '}
              with a trusted {maxMembers}-member rotational payout structure.
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              <StatusPill label={fundSpace?.status || 'FORMING'} />
              <StatusPill
                label={`${memberCount}/${maxMembers} Members`}
                light
              />
              <StatusPill
                label={`Round ${fundSpace?.current_round_number || 0}`}
                light
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:w-[520px]">
            <div className="rounded-2xl bg-white/15 p-5 backdrop-blur">
              <p className="text-sm text-emerald-50">My Payout Position</p>
              <p className="mt-1 text-3xl font-black">
                {memberPosition ? `#${memberPosition}` : 'Pending'}
              </p>
              <p className="mt-1 text-xs text-emerald-50">
                {myPayoutRound
                  ? `Expected in Week ${myPayoutRound.round_number}`
                  : 'Position appears after activation.'}
              </p>
            </div>

            <div className="rounded-2xl bg-white/15 p-5 backdrop-blur">
              <p className="text-sm text-emerald-50">Current Recipient</p>
              <p className="mt-1 text-lg font-black">
                {currentRoundRecipient?.user_id === profile?.id
                  ? 'You'
                  : currentRoundRecipient?.profile?.full_name || 'Not set'}
              </p>
              <p className="mt-1 text-xs text-emerald-50">
                {currentRound
                  ? `Round ${currentRound.round_number}`
                  : 'No active round yet.'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="Members"
          value={`${memberCount}/${maxMembers}`}
          icon={<Users size={24} />}
        />

        <SummaryCard
          title="Weekly Amount"
          value={formatCurrency(fundSpace?.contribution_amount)}
          icon={<CircleDollarSign size={24} />}
        />

        <SummaryCard
          title="Current Round"
          value={`${fundSpace?.current_round_number ?? 0}`}
          icon={<Clock size={24} />}
        />

        <SummaryCard
          title="Group Status"
          value={formatLabel(fundSpace?.status || 'FORMING')}
          icon={<BadgeCheck size={24} />}
        />
      </div>

      <div className="rounded-3xl border border-emerald-100 bg-white p-6 shadow-sm">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-black text-gray-900">
              <Wallet className="h-5 w-5 text-emerald-600" />
              Pay Weekly Contribution
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Pay securely with Mobile Money. Contribution status updates only
              after Paystack verification.
            </p>

            {paymentTargetContribution ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <InfoPanel
                  label="Amount Due"
                  value={formatCurrency(paymentTargetContribution.amount_due)}
                />
                <InfoPanel
                  label="Amount Paid"
                  value={formatCurrency(paymentTargetContribution.amount_paid)}
                />
                <InfoPanel
                  label="Remaining"
                  value={formatCurrency(amountRemaining)}
                />
              </div>
            ) : (
              <p className="mt-4 text-sm text-gray-500">
                No pending contribution is available for payment.
              </p>
            )}

            {pendingPaymentForTarget && (
              <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm text-amber-700">
                <p className="font-bold">Pending payment found</p>
                <p className="mt-1">
                  Reference:{' '}
                  {pendingPaymentForTarget.provider_reference ||
                    pendingPaymentForTarget.internal_reference}
                </p>
              </div>
            )}
          </div>

          <div className="lg:w-[260px]">
            <button
              type="button"
              onClick={handlePayContribution}
              disabled={!canPayContribution || payingContribution || verifyingPayment}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {payingContribution ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Starting Payment...
                </>
              ) : pendingPaymentForTarget?.checkout_url ? (
                <>
                  <Smartphone className="h-4 w-4" />
                  Continue Payment
                </>
              ) : (
                <>
                  <CreditCard className="h-4 w-4" />
                  Pay with MoMo
                </>
              )}
            </button>

            {!canPayContribution && paymentTargetContribution && (
              <p className="mt-3 text-xs leading-5 text-gray-500">
                Payment may be unavailable because your account is not verified,
                the group is not active, or this contribution is already paid.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-medium text-gray-600">Group progress</span>
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

        <p className="mt-3 text-sm text-gray-500">
          {fundSpace?.status === 'FORMING'
            ? `This group will activate automatically when it reaches ${maxMembers} members.`
            : 'This group is active and contribution rounds are available.'}
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm xl:col-span-2">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
            <div>
              <h2 className="text-xl font-black text-gray-900">
                Current Round Overview
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                See who receives this round and your own payment status.
              </p>
            </div>

            {currentRound && (
              <span
                className={`rounded-full border px-3 py-1 text-xs font-bold ${getStatusStyle(
                  currentRound.status
                )}`}
              >
                {formatLabel(currentRound.status)}
              </span>
            )}
          </div>

          {currentRound ? (
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <InfoPanel
                label="Round Number"
                value={`Round ${currentRound.round_number}`}
              />

              <InfoPanel
                label="Contribution Deadline"
                value={formatDate(currentRound.contribution_deadline)}
              />

              <InfoPanel
                label="Week Period"
                value={`${formatDate(currentRound.week_start_date)} - ${formatDate(
                  currentRound.week_end_date
                )}`}
              />

              <InfoPanel
                label="Expected Total"
                value={formatCurrency(currentRound.expected_total_amount)}
              />

              <div className="rounded-2xl bg-emerald-50 p-4 md:col-span-2">
                <div className="flex items-start gap-3">
                  <Trophy className="mt-1 h-5 w-5 shrink-0 text-emerald-700" />

                  <div>
                    <p className="text-sm text-emerald-700">
                      Current Round Recipient
                    </p>
                    <p className="mt-1 text-lg font-black text-emerald-900">
                      {currentRoundRecipient?.user_id === profile?.id
                        ? 'You are the recipient for this round'
                        : currentRoundRecipient?.profile?.full_name ||
                          'Recipient not found'}
                    </p>
                    <p className="mt-1 text-xs text-emerald-700">
                      {currentRoundRecipient?.profile?.phone || 'No phone'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-gray-100 p-4 md:col-span-2">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                  <div>
                    <p className="text-sm text-gray-500">
                      My Payment For This Round
                    </p>
                    <p className="mt-1 text-lg font-black text-gray-900">
                      {currentContribution
                        ? `${formatCurrency(
                            currentContribution.amount_paid
                          )} / ${formatCurrency(currentContribution.amount_due)}`
                        : 'No contribution record found'}
                    </p>
                  </div>

                  {currentContribution && (
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-bold ${getStatusStyle(
                        currentContribution.status
                      )}`}
                    >
                      {formatLabel(currentContribution.status)}
                    </span>
                  )}
                </div>

                {currentContribution && (
                  <>
                    <div className="mt-4 h-3 overflow-hidden rounded-full bg-gray-100">
                      <div
                        className="h-full rounded-full bg-emerald-600 transition-all"
                        style={{ width: `${currentContributionProgress}%` }}
                      />
                    </div>

                    <p className="mt-2 text-xs text-gray-500">
                      Payment reference:{' '}
                      {currentContribution.payment_reference || 'Not set'}
                    </p>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="mt-6 rounded-2xl bg-gray-50 p-6 text-sm text-gray-500">
              No current round yet. Rounds will appear when the group activates.
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-black text-gray-900">
              My Next Contribution
            </h2>

            {myNextContribution ? (
              <div className="mt-5 space-y-4">
                <InfoPanel
                  label="Amount Due"
                  value={formatCurrency(myNextContribution.amount_due)}
                />

                <InfoPanel
                  label="Amount Paid"
                  value={formatCurrency(myNextContribution.amount_paid)}
                />

                <div>
                  <p className="text-sm text-gray-500">Status</p>
                  <span
                    className={`mt-2 inline-flex rounded-full border px-3 py-1 text-xs font-bold ${getStatusStyle(
                      myNextContribution.status
                    )}`}
                  >
                    {formatLabel(myNextContribution.status)}
                  </span>
                </div>
              </div>
            ) : (
              <p className="mt-4 text-sm leading-6 text-gray-500">
                You do not have a pending contribution yet.
              </p>
            )}
          </div>

          {myPayoutRound && (
            <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-6 shadow-sm">
              <h2 className="text-xl font-black text-emerald-900">
                My Expected Payout
              </h2>

              <p className="mt-2 text-sm text-emerald-700">
                Week {myPayoutRound.round_number} / Round{' '}
                {myPayoutRound.round_number}
              </p>

              <p className="mt-2 text-sm text-emerald-700">
                {formatDate(myPayoutRound.week_start_date)} -{' '}
                {formatDate(myPayoutRound.week_end_date)}
              </p>

              <span
                className={`mt-4 inline-flex rounded-full border px-3 py-1 text-xs font-bold ${getStatusStyle(
                  myPayoutRound.status
                )}`}
              >
                {formatLabel(myPayoutRound.status)}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-black text-gray-900">
          Payout Order Schedule
        </h2>

        <p className="mt-1 text-sm text-gray-500">
          Weekly receiver order for this Fund Space group.
        </p>

        <div className="mt-6 overflow-hidden rounded-2xl border border-gray-100">
          {payoutOrderSchedule.length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-500">
              Payout order will appear when the group activates.
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {payoutOrderSchedule.map((member) => {
                const round = member.matchingRound;

                return (
                  <div
                    key={member.id}
                    className={`flex flex-col justify-between gap-4 p-4 md:flex-row md:items-center ${
                      member.isMe
                        ? 'bg-emerald-50'
                        : member.isCurrentRecipient
                          ? 'bg-blue-50'
                          : 'bg-white'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`flex h-11 w-11 items-center justify-center rounded-2xl text-sm font-black ${
                          member.isMe
                            ? 'bg-emerald-600 text-white'
                            : member.isCurrentRecipient
                              ? 'bg-blue-600 text-white'
                              : 'bg-emerald-100 text-emerald-700'
                        }`}
                      >
                        #{member.payoutOrder}
                      </div>

                      <div>
                        <p className="font-bold text-gray-900">
                          Week {member.payoutOrder} →{' '}
                          {member.isMe
                            ? 'You'
                            : member.profile?.full_name ||
                              `Member ${member.payoutOrder}`}
                        </p>

                        <p className="mt-1 text-xs text-gray-500">
                          {member.profile?.phone || 'No phone'} • Joined:{' '}
                          {formatDate(member.joined_at)}
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
                      {member.isMe && (
                        <span className="rounded-full border border-emerald-100 bg-white px-3 py-1 text-xs font-bold text-emerald-700">
                          You
                        </span>
                      )}

                      {member.isCurrentRecipient && (
                        <span className="rounded-full border border-blue-100 bg-white px-3 py-1 text-xs font-bold text-blue-700">
                          Current Recipient
                        </span>
                      )}

                      {member.has_received_payout && (
                        <span className="rounded-full border border-emerald-100 bg-white px-3 py-1 text-xs font-bold text-emerald-700">
                          Received
                        </span>
                      )}

                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-bold ${getStatusStyle(
                          round?.status || member.status
                        )}`}
                      >
                        {formatLabel(round?.status || member.status || 'ACTIVE')}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-black text-gray-900">
            My Contributions
          </h2>

          <div className="mt-6 overflow-hidden rounded-2xl border border-gray-100">
            {myContributions.length === 0 ? (
              <div className="p-6 text-center text-sm text-gray-500">
                No contribution records yet.
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {myContributions.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-center"
                  >
                    <div>
                      <p className="font-semibold text-gray-900">
                        Due: {formatCurrency(item.amount_due)}
                      </p>

                      <p className="text-xs text-gray-500">
                        Paid: {formatCurrency(item.amount_paid)} • Created:{' '}
                        {formatDate(item.created_at)}
                      </p>

                      {item.payment_reference && (
                        <p className="mt-1 text-xs text-gray-500">
                          Ref: {item.payment_reference}
                        </p>
                      )}
                    </div>

                    <span
                      className={`w-fit rounded-full border px-3 py-1 text-xs font-bold ${getStatusStyle(
                        item.status
                      )}`}
                    >
                      {formatLabel(item.status)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-black text-gray-900">My Payouts</h2>

          <div className="mt-6 overflow-hidden rounded-2xl border border-gray-100">
            {myPayouts.length === 0 ? (
              <div className="p-6 text-center text-sm text-gray-500">
                No payout record yet.
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {myPayouts.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-center"
                  >
                    <div>
                      <p className="font-semibold text-gray-900">
                        Net: {formatCurrency(item.net_amount)}
                      </p>

                      <p className="text-xs text-gray-500">
                        Gross: {formatCurrency(item.gross_amount)} • Fee:{' '}
                        {formatCurrency(item.platform_fee)}
                      </p>

                      <p className="mt-1 text-xs text-gray-500">
                        Created: {formatDate(item.created_at)}
                      </p>

                      {item.payout_reference && (
                        <p className="mt-1 text-xs text-gray-500">
                          Ref: {item.payout_reference}
                        </p>
                      )}
                    </div>

                    <span
                      className={`w-fit rounded-full border px-3 py-1 text-xs font-bold ${getStatusStyle(
                        item.status
                      )}`}
                    >
                      {formatLabel(item.status)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {myLatestPayout && (
            <div className="mt-5 rounded-2xl bg-emerald-50 p-4">
              <div className="flex items-start gap-3">
                {myLatestPayout.status === 'PAID' ? (
                  <CheckCircle2 className="mt-1 h-5 w-5 text-emerald-600" />
                ) : myLatestPayout.status === 'REJECTED' ? (
                  <XCircle className="mt-1 h-5 w-5 text-red-600" />
                ) : (
                  <CalendarDays className="mt-1 h-5 w-5 text-emerald-600" />
                )}

                <div>
                  <p className="font-bold text-emerald-800">
                    Latest payout status
                  </p>
                  <p className="mt-1 text-sm text-emerald-700">
                    Your latest payout is currently marked as{' '}
                    {formatLabel(myLatestPayout.status)}.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-6">
        <h2 className="text-lg font-bold text-emerald-800">
          Important Reminder
        </h2>

        <p className="mt-2 text-sm leading-6 text-emerald-700">
          Pay your contribution on time every week. Late or missed payments can
          reduce your trust score and may affect your ability to participate in
          future Fund Space groups.
        </p>
      </div>
    </div>
  );
}

function StatusPill({
  label,
  light = false,
}: {
  label: string;
  light?: boolean;
}) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-bold ${
        light ? 'bg-white/10 text-white' : 'bg-white text-emerald-700'
      }`}
    >
      {formatLabel(label)}
    </span>
  );
}

function SummaryCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
      <div className="mb-4 inline-flex rounded-2xl bg-emerald-50 p-3 text-emerald-700">
        {icon}
      </div>

      <p className="text-sm text-gray-500">{title}</p>

      <h3 className="mt-1 text-2xl font-black text-gray-900">{value}</h3>
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