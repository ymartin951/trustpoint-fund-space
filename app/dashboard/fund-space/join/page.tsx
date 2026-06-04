'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CircleDollarSign,
  Clock,
  FileText,
  Loader2,
  ShieldCheck,
  Sparkles,
  Users,
  Wallet,
  XCircle,
} from 'lucide-react';

import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

type FundSpaceMember = {
  id: string;
  user_id: string;
  fund_space_id: string;
  contribution_amount: number;
  status: string | null;
  joined_at: string | null;
};

type AgreementVersion = {
  id: string;
  version: string;
  title: string;
  content: string;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
};

type JoinResponse = {
  success?: boolean;
  message?: string;
  fund_space_id?: string;
  eligibility?: EligibilityResult;
};

type EligibilityResult = {
  user_id?: string;
  contribution_amount?: number;
  is_eligible?: boolean;
  missing_requirements?: string[];
  has_verified_identity?: boolean;
  has_emergency_contact?: boolean;
  has_approved_guarantor?: boolean;
  approved_guarantor_count?: number;
  has_business_or_employment_proof?: boolean;
  eligible_for_50?: boolean;
  eligible_for_100?: boolean;
  eligible_for_200?: boolean;
  eligible_for_500?: boolean;
};

const plans = [
  {
    amount: 50,
    title: 'Starter Group',
    description: 'Best for beginners and small weekly savings.',
    highlight: 'Low commitment',
    requirements: ['Verified identity'],
  },
  {
    amount: 100,
    title: 'Standard Group',
    description: 'A balanced plan for regular contributors.',
    highlight: 'Most flexible',
    requirements: ['Verified identity', 'Emergency contact'],
  },
  {
    amount: 200,
    title: 'Growth Group',
    description: 'Good for business owners and serious savers.',
    highlight: 'Business friendly',
    requirements: ['Verified identity', 'Emergency contact', 'Approved guarantor'],
  },
  {
    amount: 500,
    title: 'Premium Group',
    description: 'For high-value weekly contribution groups.',
    highlight: 'High-value savings',
    requirements: [
      'Verified identity',
      'Emergency contact',
      'Approved guarantor',
      'Business or employment details',
    ],
  },
];

function formatCurrency(amount: number | null | undefined) {
  return `GH₵${Number(amount || 0).toLocaleString('en-GH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function getAgreementSummaryLines(selectedAmount: number | null) {
  const weeklyAmount = selectedAmount
    ? formatCurrency(selectedAmount)
    : 'your selected amount';

  const estimatedPayout = selectedAmount
    ? formatCurrency(selectedAmount * 10)
    : 'the full group payout';

  return [
    `I understand that I will contribute ${weeklyAmount} every week.`,
    'I understand that each Fund Space group has 10 members.',
    `I understand that the estimated group payout pool is ${estimatedPayout}.`,
    'I understand that payout follows the approved payout order.',
    'I understand that manual Mobile Money payments must be verified by admin.',
    'I understand that late, missed, or false payments can affect my access and trust record.',
    'I understand that Fund Space is a rotational contribution system, not an investment scheme.',
  ];
}

function getEligibilityStatusForPlan(
  eligibility: EligibilityResult | null,
  amount: number
) {
  if (!eligibility) return null;

  if (amount === 50) return eligibility.eligible_for_50;
  if (amount === 100) return eligibility.eligible_for_100;
  if (amount === 200) return eligibility.eligible_for_200;
  if (amount === 500) return eligibility.eligible_for_500;

  return false;
}

function getRequirementStatus(
  requirement: string,
  eligibility: EligibilityResult | null,
  isVerified: boolean
) {
  if (requirement === 'Verified identity') {
    return Boolean(eligibility?.has_verified_identity ?? isVerified);
  }

  if (requirement === 'Emergency contact') {
    return Boolean(eligibility?.has_emergency_contact);
  }

  if (requirement === 'Approved guarantor') {
    return Boolean(eligibility?.has_approved_guarantor);
  }

  if (requirement === 'Business or employment details') {
    return Boolean(eligibility?.has_business_or_employment_proof);
  }

  return false;
}

function getPlanRequirementText(amount: number) {
  if (amount === 50) {
    return 'This plan requires verified identity only.';
  }

  if (amount === 100) {
    return 'This plan requires verified identity and emergency contact.';
  }

  if (amount === 200) {
    return 'This plan requires verified identity, emergency contact, and an approved guarantor.';
  }

  return 'This plan requires verified identity, emergency contact, approved guarantor, and business or employment details.';
}

export default function JoinFundSpacePage() {
  const router = useRouter();
  const { profile, loading } = useAuth();

  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [existingMember, setExistingMember] =
    useState<FundSpaceMember | null>(null);

  const [agreement, setAgreement] = useState<AgreementVersion | null>(null);
  const [agreementAccepted, setAgreementAccepted] = useState(false);
  const [showFullAgreement, setShowFullAgreement] = useState(false);

  const [eligibility, setEligibility] = useState<EligibilityResult | null>(null);
  const [eligibilityLoading, setEligibilityLoading] = useState(false);
  const [eligibilityError, setEligibilityError] = useState('');

  const [checkingMembership, setCheckingMembership] = useState(true);
  const [agreementLoading, setAgreementLoading] = useState(true);
  const [joining, setJoining] = useState(false);

  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const verificationStatus = profile?.verification_status ?? '';
  const accountStatus = profile?.status ?? '';

  const isVerified = verificationStatus === 'VERIFIED';
  const isActive = accountStatus === 'ACTIVE';

  const selectedPlan = useMemo(() => {
    return plans.find((plan) => plan.amount === selectedAmount) || null;
  }, [selectedAmount]);

  const estimatedCycleValue = selectedAmount ? selectedAmount * 10 : 0;

  const agreementSummaryLines = useMemo(
    () => getAgreementSummaryLines(selectedAmount),
    [selectedAmount]
  );

  const selectedPlanIsEligible = useMemo(() => {
    if (!selectedAmount) return false;

    if (!eligibility) return false;

    return eligibility.is_eligible === true;
  }, [selectedAmount, eligibility]);

  const missingRequirements = useMemo(() => {
    if (!selectedAmount || !eligibility) return [];

    return Array.isArray(eligibility.missing_requirements)
      ? eligibility.missing_requirements
      : [];
  }, [selectedAmount, eligibility]);

  const canSubmitJoin =
    Boolean(selectedAmount) &&
    selectedPlanIsEligible &&
    agreementAccepted &&
    !joining &&
    !eligibilityLoading &&
    isActive &&
    isVerified &&
    !existingMember;

  const loadActiveAgreement = useCallback(async () => {
    try {
      setAgreementLoading(true);

      const rpcClient = supabase as any;
      const { data, error } = await rpcClient.rpc(
        'get_active_fund_space_agreement'
      );

      if (error) {
        throw error;
      }

      const activeAgreement = Array.isArray(data) ? data[0] : data;

      setAgreement((activeAgreement || null) as AgreementVersion | null);
    } catch (error) {
      console.error('Active Fund Space agreement load error:', error);

      setAgreement(null);
      setErrorMessage(
        'Could not load the Fund Space agreement. Please refresh and try again.'
      );
    } finally {
      setAgreementLoading(false);
    }
  }, []);

  useEffect(() => {
    loadActiveAgreement();
  }, [loadActiveAgreement]);

  useEffect(() => {
    if (loading) return;

    if (!profile?.id) {
      setCheckingMembership(false);
      return;
    }

    checkExistingMembership(profile.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, profile?.id]);

  useEffect(() => {
    if (!profile?.id || !selectedAmount || !isVerified || !isActive) {
      setEligibility(null);
      setEligibilityError('');
      return;
    }

    checkEligibility(profile.id, selectedAmount);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, selectedAmount, isVerified, isActive]);

  async function checkExistingMembership(userId: string) {
    try {
      setCheckingMembership(true);
      setErrorMessage('');

      const { data, error } = await supabase
        .from('fund_space_members')
        .select('id, user_id, fund_space_id, contribution_amount, status, joined_at')
        .eq('user_id', userId)
        .in('status', ['ACTIVE'])
        .order('joined_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        throw error;
      }

      setExistingMember((data || null) as FundSpaceMember | null);
    } catch (error) {
      console.error('Existing Fund Space membership check error:', error);

      setErrorMessage(
        'Could not check your current Fund Space membership. Please refresh and try again.'
      );
    } finally {
      setCheckingMembership(false);
    }
  }

  async function checkEligibility(userId: string, amount: number) {
    try {
      setEligibilityLoading(true);
      setEligibilityError('');

      const rpcClient = supabase as any;

      const { data, error } = await rpcClient.rpc(
        'get_member_fund_space_eligibility',
        {
          p_user_id: userId,
          p_contribution_amount: amount,
        }
      );

      if (error) {
        throw error;
      }

      setEligibility((data || null) as EligibilityResult | null);
    } catch (error) {
      console.error('Fund Space eligibility check error:', error);

      setEligibility(null);
      setEligibilityError(
        error instanceof Error
          ? error.message
          : 'Could not check your Fund Space eligibility.'
      );
    } finally {
      setEligibilityLoading(false);
    }
  }

  async function handleJoin() {
    try {
      setJoining(true);
      setErrorMessage('');
      setSuccessMessage('');

      if (!profile?.id) {
        throw new Error('Unable to identify your account. Please login again.');
      }

      if (!isActive) {
        throw new Error('Your account must be active before joining Fund Space.');
      }

      if (!isVerified) {
        throw new Error('You must complete verification before joining Fund Space.');
      }

      if (existingMember) {
        throw new Error(
          'You already have an active Fund Space group. Open your Fund Space dashboard instead.'
        );
      }

      if (!selectedAmount) {
        throw new Error('Please select a Fund Space contribution amount.');
      }

      if (eligibilityLoading) {
        throw new Error('Please wait while we check your eligibility.');
      }

      if (!eligibility || eligibility.is_eligible !== true) {
        const requirements =
          missingRequirements.length > 0
            ? missingRequirements.join(' ')
            : 'Please complete all required safety information before joining this plan.';

        throw new Error(
          `You are not eligible to join the ${formatCurrency(
            selectedAmount
          )} weekly plan yet. ${requirements}`
        );
      }

      if (!agreementAccepted) {
        throw new Error(
          'Please read and accept the TrustPoint Fund Space agreement before joining.'
        );
      }

      if (!agreement) {
        throw new Error(
          'The Fund Space agreement could not be loaded. Please refresh and try again.'
        );
      }

      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error || !session?.access_token) {
        throw new Error('Your session has expired. Please login again.');
      }

      const response = await fetch('/api/fund-space/join', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contribution_amount: selectedAmount,
          agreement_accepted: agreementAccepted,
          agreement_version_id: agreement.id,
        }),
      });

      const responseText = await response.text();

      let result: JoinResponse | null = null;

      try {
        result = responseText ? JSON.parse(responseText) : null;
      } catch {
        result = null;
      }

      if (!response.ok || !result?.success) {
        throw new Error(result?.message || 'Could not join Fund Space.');
      }

      setSuccessMessage(
        result.message ||
          'You joined Fund Space successfully. Redirecting to your dashboard...'
      );

      if (result.fund_space_id) {
        router.push(`/dashboard/fund-space/${result.fund_space_id}`);
        return;
      }

      router.push('/dashboard/fund-space');
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Something went wrong.';

      setErrorMessage(message);
    } finally {
      setJoining(false);
    }
  }

  if (loading || checkingMembership || agreementLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-emerald-600" />
          <p className="text-sm text-gray-500">Loading join page...</p>
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
              joining Fund Space.
            </p>

            <Link
              href="/dashboard"
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-red-600 px-5 py-3 text-sm font-bold text-white hover:bg-red-700"
            >
              Back to Dashboard
              <ArrowRight size={16} />
            </Link>
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
              Space. This protects every group from fake accounts and risky
              members.
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

  if (existingMember) {
    return (
      <div className="space-y-6">
        <Link
          href="/dashboard/fund-space"
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50"
        >
          <ArrowLeft size={16} />
          Back to Fund Space
        </Link>

        <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-6">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-1 h-6 w-6 shrink-0 text-emerald-600" />

            <div>
              <h2 className="text-xl font-black text-emerald-900">
                You already have an active Fund Space
              </h2>

              <p className="mt-2 text-sm leading-6 text-emerald-700">
                You cannot join another active Fund Space group at the same
                time. Open your current group dashboard to view your payout
                position, contribution status, and payout schedule.
              </p>

              <Link
                href={`/dashboard/fund-space/${existingMember.fund_space_id}`}
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-700"
              >
                Open My Fund Space
                <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/dashboard/fund-space"
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50"
        >
          <ArrowLeft size={16} />
          Back to Fund Space
        </Link>
      </div>

      <div className="rounded-3xl bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-600 p-6 text-white shadow-sm md:p-8">
        <div className="max-w-3xl">
          <p className="mb-3 inline-flex rounded-full bg-white/15 px-4 py-1 text-sm font-medium">
            Join TrustPoint Fund Space
          </p>

          <h1 className="text-3xl font-black md:text-4xl">
            Choose your weekly contribution plan
          </h1>

          <p className="mt-4 max-w-2xl text-sm leading-7 text-emerald-50 md:text-base">
            Select how much you can contribute every week. Higher plans require
            stronger safety information such as emergency contact, guarantor, or
            business/employment details.
          </p>
        </div>
      </div>

      {errorMessage && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-700">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {successMessage && (
        <div className="flex items-start gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {plans.map((plan) => {
          const selected = selectedAmount === plan.amount;
          const planEligible = getEligibilityStatusForPlan(
            eligibility,
            plan.amount
          );

          return (
            <button
              key={plan.amount}
              type="button"
              onClick={() => {
                setSelectedAmount(plan.amount);
                setAgreementAccepted(false);
                setErrorMessage('');
                setSuccessMessage('');
              }}
              className={`rounded-3xl border p-6 text-left shadow-sm transition ${
                selected
                  ? 'border-emerald-400 bg-emerald-50 ring-2 ring-emerald-100'
                  : 'border-gray-100 bg-white hover:border-emerald-200 hover:bg-emerald-50/40'
              }`}
            >
              <div className="mb-5 flex items-center justify-between">
                <div className="rounded-2xl bg-emerald-100 p-3 text-emerald-700">
                  <CircleDollarSign size={24} />
                </div>

                {selected ? (
                  <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                ) : (
                  <Sparkles className="h-5 w-5 text-gray-300" />
                )}
              </div>

              <div className="mb-3 inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
                {plan.highlight}
              </div>

              <h3 className="text-lg font-black text-gray-900">{plan.title}</h3>

              <p className="mt-2 text-3xl font-black text-emerald-700">
                {formatCurrency(plan.amount)}
              </p>

              <p className="mt-1 text-sm font-semibold text-gray-500">
                Weekly contribution
              </p>

              <p className="mt-4 text-sm leading-6 text-gray-500">
                {plan.description}
              </p>

              <div className="mt-5 rounded-2xl bg-gray-50 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-gray-400">
                  Estimated group value
                </p>
                <p className="mt-1 text-lg font-black text-gray-900">
                  {formatCurrency(plan.amount * 10)}
                </p>
              </div>

              <div className="mt-4 rounded-2xl border border-gray-100 bg-white p-4">
                <p className="text-xs font-black uppercase tracking-wide text-gray-400">
                  Requirements
                </p>

                <div className="mt-3 space-y-2">
                  {plan.requirements.map((requirement) => {
                    const requirementMet =
                      selected && eligibility
                        ? getRequirementStatus(
                            requirement,
                            eligibility,
                            isVerified
                          )
                        : false;

                    return (
                      <div
                        key={requirement}
                        className="flex items-start gap-2 text-xs font-semibold text-gray-600"
                      >
                        {selected && eligibility ? (
                          requirementMet ? (
                            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                          ) : (
                            <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                          )
                        ) : (
                          <Clock className="mt-0.5 h-4 w-4 shrink-0 text-gray-300" />
                        )}

                        <span>{requirement}</span>
                      </div>
                    );
                  })}
                </div>

                {selected && eligibilityLoading && (
                  <p className="mt-3 flex items-center gap-2 text-xs font-bold text-emerald-700">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Checking eligibility...
                  </p>
                )}

                {selected && !eligibilityLoading && eligibility && (
                  <p
                    className={`mt-3 text-xs font-bold ${
                      planEligible
                        ? 'text-emerald-700'
                        : 'text-red-600'
                    }`}
                  >
                    {planEligible
                      ? 'You meet the requirements for this plan.'
                      : 'You do not meet all requirements for this plan yet.'}
                  </p>
                )}
              </div>
            </button>
          );
        })}
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
            <div className="grid gap-5 md:grid-cols-3">
              <InfoBox
                icon={<Users className="h-6 w-6" />}
                title="10 members"
                description="Each group is formed with 10 verified members."
              />

              <InfoBox
                icon={<ShieldCheck className="h-6 w-6" />}
                title="Safety checked"
                description="Higher plans require emergency contact, guarantor, or business details."
              />

              <InfoBox
                icon={<Clock className="h-6 w-6" />}
                title="Weekly contribution"
                description="Your selected amount becomes your weekly payment."
              />
            </div>
          </div>

          {selectedPlan && (
            <EligibilityCard
              selectedAmount={selectedPlan.amount}
              eligibility={eligibility}
              loading={eligibilityLoading}
              error={eligibilityError}
              missingRequirements={missingRequirements}
            />
          )}

          <AgreementCard
            agreement={agreement}
            selectedPlan={selectedPlan}
            estimatedCycleValue={estimatedCycleValue}
            summaryLines={agreementSummaryLines}
            accepted={agreementAccepted}
            disabled={!selectedPlanIsEligible}
            showFullAgreement={showFullAgreement}
            onToggleAccepted={() => {
              if (!selectedPlanIsEligible) return;
              setAgreementAccepted((current) => !current);
            }}
            onToggleFullAgreement={() =>
              setShowFullAgreement((current) => !current)
            }
          />
        </div>

        <aside className="space-y-5">
          <div className="rounded-3xl border border-emerald-100 bg-white p-6 shadow-sm">
            <div className="mb-4 inline-flex rounded-2xl bg-emerald-50 p-3 text-emerald-700">
              <Wallet size={24} />
            </div>

            <h2 className="text-lg font-black text-gray-900">
              Ready to join?
            </h2>

            <p className="mt-2 text-sm leading-6 text-gray-500">
              Select a plan, complete the safety requirements, read the
              agreement, tick the acceptance box, then continue.
            </p>

            <div className="mt-5 rounded-2xl bg-gray-50 p-4">
              <p className="text-sm font-semibold text-gray-500">
                Selected plan
              </p>

              <p className="mt-1 text-xl font-black text-gray-900">
                {selectedPlan
                  ? `${formatCurrency(selectedPlan.amount)} weekly`
                  : 'No plan selected'}
              </p>

              {selectedPlan && (
                <p className="mt-1 text-sm text-gray-500">
                  Estimated group payout pool:{' '}
                  <span className="font-bold text-gray-700">
                    {formatCurrency(estimatedCycleValue)}
                  </span>
                </p>
              )}
            </div>

            {selectedPlan && !selectedPlanIsEligible && !eligibilityLoading && (
              <div className="mt-4 rounded-2xl border border-red-100 bg-red-50 p-4">
                <p className="text-sm font-black text-red-700">
                  You cannot join this plan yet
                </p>

                <p className="mt-1 text-xs leading-5 text-red-600">
                  Complete the missing requirements before joining the{' '}
                  {formatCurrency(selectedPlan.amount)} weekly plan.
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={handleJoin}
              disabled={!canSubmitJoin}
              className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {joining ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <CheckCircle2 size={18} />
              )}
              {joining ? 'Joining Fund Space...' : 'Accept and Join'}
            </button>

            {!selectedPlan && (
              <p className="mt-3 text-xs leading-5 text-amber-700">
                Select a contribution plan first.
              </p>
            )}

            {selectedPlan && !selectedPlanIsEligible && (
              <p className="mt-3 text-xs leading-5 text-red-600">
                Your selected plan has missing safety requirements.
              </p>
            )}

            {selectedPlanIsEligible && !agreementAccepted && (
              <p className="mt-3 text-xs leading-5 text-amber-700">
                You must tick the agreement box before joining.
              </p>
            )}
          </div>

          <div className="rounded-3xl border border-amber-100 bg-amber-50 p-6 shadow-sm">
            <div className="mb-4 inline-flex rounded-2xl bg-white p-3 text-amber-700">
              <AlertCircle size={24} />
            </div>

            <h2 className="text-lg font-black text-gray-900">
              Before you join
            </h2>

            <ul className="mt-4 space-y-3 text-sm leading-6 text-gray-700">
              <li>• Choose an amount you can pay every week.</li>
              <li>• Higher plans need stronger safety requirements.</li>
              <li>• Missing payments can affect your trust record.</li>
              <li>• Payout follows the approved order.</li>
              <li>• Fund Space is not an investment or profit scheme.</li>
              <li>• Manual MoMo payments require admin verification.</li>
            </ul>
          </div>
        </aside>
      </section>
    </div>
  );
}

function InfoBox({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl bg-gray-50 p-5">
      <div className="mb-3 inline-flex rounded-xl bg-emerald-100 p-3 text-emerald-700">
        {icon}
      </div>

      <h3 className="font-black text-gray-900">{title}</h3>

      <p className="mt-2 text-sm leading-6 text-gray-500">{description}</p>
    </div>
  );
}

function EligibilityCard({
  selectedAmount,
  eligibility,
  loading,
  error,
  missingRequirements,
}: {
  selectedAmount: number;
  eligibility: EligibilityResult | null;
  loading: boolean;
  error: string;
  missingRequirements: string[];
}) {
  if (loading) {
    return (
      <div className="rounded-3xl border border-emerald-100 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <Loader2 className="mt-1 h-5 w-5 shrink-0 animate-spin text-emerald-600" />

          <div>
            <h2 className="text-xl font-black text-gray-900">
              Checking plan eligibility
            </h2>
            <p className="mt-2 text-sm leading-6 text-gray-500">
              Please wait while TrustPoint checks your safety requirements for{' '}
              {formatCurrency(selectedAmount)} weekly.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-3xl border border-red-100 bg-red-50 p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-1 h-5 w-5 shrink-0 text-red-600" />

          <div>
            <h2 className="text-xl font-black text-red-700">
              Eligibility check failed
            </h2>
            <p className="mt-2 text-sm leading-6 text-red-600">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!eligibility) return null;

  const eligible = eligibility.is_eligible === true;

  return (
    <div
      className={`rounded-3xl border p-6 shadow-sm ${
        eligible
          ? 'border-emerald-100 bg-emerald-50'
          : 'border-red-100 bg-red-50'
      }`}
    >
      <div className="flex items-start gap-3">
        {eligible ? (
          <CheckCircle2 className="mt-1 h-6 w-6 shrink-0 text-emerald-600" />
        ) : (
          <XCircle className="mt-1 h-6 w-6 shrink-0 text-red-600" />
        )}

        <div>
          <h2
            className={`text-xl font-black ${
              eligible ? 'text-emerald-900' : 'text-red-700'
            }`}
          >
            {eligible ? 'You are eligible for this plan' : 'Requirements needed'}
          </h2>

          <p
            className={`mt-2 text-sm leading-6 ${
              eligible ? 'text-emerald-700' : 'text-red-600'
            }`}
          >
            {eligible
              ? `You meet the safety requirements for the ${formatCurrency(
                  selectedAmount
                )} weekly Fund Space plan.`
              : `You cannot join the ${formatCurrency(
                  selectedAmount
                )} weekly plan until the missing requirements are completed.`}
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <RequirementRow
          label="Verified identity"
          checked={Boolean(eligibility.has_verified_identity)}
        />
        <RequirementRow
          label="Emergency contact"
          checked={Boolean(eligibility.has_emergency_contact)}
        />
        <RequirementRow
          label="Approved guarantor"
          checked={Boolean(eligibility.has_approved_guarantor)}
        />
        <RequirementRow
          label="Business/employment details"
          checked={Boolean(eligibility.has_business_or_employment_proof)}
        />
      </div>

      {!eligible && missingRequirements.length > 0 && (
        <div className="mt-5 rounded-2xl border border-red-200 bg-white p-4">
          <p className="text-sm font-black text-red-700">
            Missing requirements
          </p>

          <ul className="mt-3 space-y-2 text-sm leading-6 text-red-600">
            {missingRequirements.map((requirement) => (
              <li key={requirement}>• {requirement}</li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-4 text-xs font-semibold text-gray-500">
        Plan rule: {getPlanRequirementText(selectedAmount)}
      </p>
    </div>
  );
}

function RequirementRow({
  label,
  checked,
}: {
  label: string;
  checked: boolean;
}) {
  return (
    <div className="flex items-start gap-2 rounded-2xl bg-white p-3">
      {checked ? (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
      ) : (
        <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
      )}

      <span className="text-sm font-bold text-gray-700">{label}</span>
    </div>
  );
}

function AgreementCard({
  agreement,
  selectedPlan,
  estimatedCycleValue,
  summaryLines,
  accepted,
  disabled,
  showFullAgreement,
  onToggleAccepted,
  onToggleFullAgreement,
}: {
  agreement: AgreementVersion | null;
  selectedPlan: (typeof plans)[number] | null;
  estimatedCycleValue: number;
  summaryLines: string[];
  accepted: boolean;
  disabled: boolean;
  showFullAgreement: boolean;
  onToggleAccepted: () => void;
  onToggleFullAgreement: () => void;
}) {
  return (
    <div
      className={`rounded-3xl border bg-white p-6 shadow-sm ${
        disabled ? 'border-gray-100 opacity-80' : 'border-emerald-100'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-700">
          <FileText className="h-6 w-6" />
        </div>

        <div>
          <h2 className="text-xl font-black text-gray-900">
            TrustPoint Fund Space Agreement
          </h2>

          <p className="mt-1 text-sm leading-6 text-gray-500">
            This agreement protects you, the group, and TrustPoint. Please read
            it before joining.
          </p>

          {agreement && (
            <p className="mt-2 text-xs font-bold text-emerald-700">
              Agreement version: {agreement.version}
            </p>
          )}
        </div>
      </div>

      {disabled && (
        <div className="mt-5 rounded-2xl border border-amber-100 bg-amber-50 p-4">
          <p className="text-sm font-bold text-amber-700">
            Complete your selected plan requirements before accepting the
            agreement and joining.
          </p>
        </div>
      )}

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <MiniSummary
          label="Weekly contribution"
          value={
            selectedPlan ? formatCurrency(selectedPlan.amount) : 'Select a plan'
          }
        />
        <MiniSummary label="Group size" value="10 members" />
        <MiniSummary
          label="Estimated group value"
          value={selectedPlan ? formatCurrency(estimatedCycleValue) : '—'}
        />
      </div>

      <div className="mt-5 rounded-2xl bg-gray-50 p-5">
        <p className="mb-3 text-sm font-black text-gray-900">
          By joining, you confirm:
        </p>

        <ul className="space-y-3 text-sm leading-6 text-gray-700">
          {summaryLines.map((line) => (
            <li key={line} className="flex gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </div>

      {agreement?.content && (
        <div className="mt-5">
          <button
            type="button"
            onClick={onToggleFullAgreement}
            className="text-sm font-black text-emerald-700 hover:text-emerald-800"
          >
            {showFullAgreement ? 'Hide full agreement' : 'Read full agreement'}
          </button>

          {showFullAgreement && (
            <div className="mt-3 max-h-80 overflow-y-auto whitespace-pre-line rounded-2xl border border-gray-100 bg-gray-50 p-5 text-sm leading-7 text-gray-700">
              {agreement.content}
            </div>
          )}
        </div>
      )}

      <label
        className={`mt-5 flex items-start gap-3 rounded-2xl border p-4 transition ${
          disabled
            ? 'cursor-not-allowed border-gray-200 bg-gray-50'
            : accepted
              ? 'cursor-pointer border-emerald-200 bg-emerald-50'
              : 'cursor-pointer border-gray-200 bg-white hover:border-emerald-200'
        }`}
      >
        <input
          type="checkbox"
          checked={accepted}
          disabled={disabled}
          onChange={onToggleAccepted}
          className="mt-1 h-5 w-5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 disabled:cursor-not-allowed"
        />

        <span>
          <span className="block text-sm font-black text-gray-900">
            I understand and accept the TrustPoint Fund Space agreement.
          </span>
          <span className="mt-1 block text-xs leading-5 text-gray-500">
            I confirm that Fund Space is a rotational contribution system and I
            agree to follow the payment, payout, and verification rules.
          </span>
        </span>
      </label>
    </div>
  );
}

function MiniSummary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-gray-400">
        {label}
      </p>
      <p className="mt-1 text-sm font-black text-gray-900">{value}</p>
    </div>
  );
}