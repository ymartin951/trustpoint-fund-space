'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  CircleDollarSign,
  Clock,
  CreditCard,
  FileCheck2,
  Info,
  Loader2,
  RefreshCw,
  Search,
  Smartphone,
  UserRound,
  Wallet,
} from 'lucide-react';

import { supabase } from '@/lib/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ManualMerchantPaymentModal } from '@/components/fund-space/ManualMerchantPaymentModal';

type Summary = {
  total_contributions: number;
  pending_contributions: number;
  paid_contributions: number;
  failed_contributions: number;
  total_amount_due: number;
  total_amount_paid: number;
};

type CustomerLite = {
  id: string;
  full_name: string;
  phone: string | null;
  location: string | null;
  city: string | null;
  region: string | null;
  verification_status: string;
  status: string;
};

type FundSpaceLite = {
  id: string;
  name: string;
  contribution_amount: number;
  status: string;
  member_limit: number;
  current_round_number: number;
};

type RoundLite = {
  id: string;
  round_number: number;
  recipient_user_id: string;
  contribution_amount: number;
  expected_total_amount: number;
  contribution_deadline: string;
  week_start_date: string;
  week_end_date: string;
  status: string;
};

type Contribution = {
  id: string;
  fund_space_id: string;
  round_id: string;
  user_id: string;
  amount_due: number;
  amount_paid: number;
  confirmed_by: string | null;
  paid_at: string | null;
  payment_method: string | null;
  payment_reference: string | null;
  status: string;
  created_at: string | null;
  updated_at: string | null;
  customer: CustomerLite | null;
  fund_space: FundSpaceLite | null;
  round: RoundLite | null;
};

type ManualPaymentSubmission = {
  id: string;
  contribution_id: string;
  fund_space_id: string;
  user_id: string;
  agent_id: string | null;
  status: string;
  transaction_reference: string;
  total_amount_paid: number;
  rejection_reason: string | null;
  created_at: string | null;
  reviewed_at: string | null;
};

type ContributionsApiResponse = {
  success: boolean;
  message?: string;
  summary?: Summary;
  contributions?: Contribution[];
};

type VerifyPaymentResponse = {
  success?: boolean;
  message?: string;
  already_processed?: boolean;
  payment_status?: string;
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

  return new Intl.DateTimeFormat('en-GH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
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
    ['ACTIVE', 'VERIFIED', 'APPROVED', 'COMPLETED', 'PAID', 'SUCCESS'].includes(
      value
    )
  ) {
    return 'border-emerald-100 bg-emerald-50 text-emerald-700';
  }

  if (
    [
      'PENDING',
      'PENDING_REVIEW',
      'FORMING',
      'COLLECTING',
      'READY_FOR_PAYOUT',
      'PROCESSING',
      'PARTIALLY_PAID',
      'OVERDUE',
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
      'DEFAULTED',
      'REFUNDED',
      'CANCELLED',
      'ABANDONED',
      'REVERSED',
    ].includes(value)
  ) {
    return 'border-red-100 bg-red-50 text-red-700';
  }

  return 'border-gray-100 bg-gray-50 text-gray-700';
}

function getAmountRemaining(contribution: Contribution) {
  return Math.max(
    Number(contribution.amount_due || 0) - Number(contribution.amount_paid || 0),
    0
  );
}

function canPayContribution(contribution: Contribution) {
  return (
    ['PENDING', 'OVERDUE', 'PARTIALLY_PAID'].includes(
      String(contribution.status || '').toUpperCase()
    ) && getAmountRemaining(contribution) > 0
  );
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

function sortManualSubmissionsByPriority(
  submissions: ManualPaymentSubmission[]
) {
  return [...submissions].sort((a, b) => {
    const aPending = a.status === 'PENDING_REVIEW' ? 1 : 0;
    const bPending = b.status === 'PENDING_REVIEW' ? 1 : 0;

    if (aPending !== bPending) return bPending - aPending;

    const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
    const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;

    return bTime - aTime;
  });
}

function StatCard({
  title,
  value,
  description,
  icon,
}: {
  title: string;
  value: string | number;
  description: string;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-gray-500">{title}</p>
          <h3 className="mt-2 text-3xl font-bold text-gray-900">{value}</h3>
          <p className="mt-1 text-sm leading-6 text-gray-500">{description}</p>
        </div>

        <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-700">
          {icon}
        </div>
      </div>
    </div>
  );
}

export default function AgentFundSpaceContributionsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const verificationAttemptedRef = useRef(false);

  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [summary, setSummary] = useState<Summary>({
    total_contributions: 0,
    pending_contributions: 0,
    paid_contributions: 0,
    failed_contributions: 0,
    total_amount_due: 0,
    total_amount_paid: 0,
  });

  const [manualPaymentSubmissions, setManualPaymentSubmissions] = useState<
    ManualPaymentSubmission[]
  >([]);

  const [loading, setLoading] = useState(true);
  const [verifyingPayment, setVerifyingPayment] = useState(false);
  const [momoPaymentContribution, setMomoPaymentContribution] =
    useState<Contribution | null>(null);

  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'PAID' | 'FAILED'>(
    'ALL'
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [message, setMessage] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

  const getAccessToken = async () => {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error || !session?.access_token) {
      throw new Error('Your session has expired. Please login again.');
    }

    return session.access_token;
  };

  const loadManualPaymentSubmissions = useCallback(
    async (contributionIds: string[]) => {
      if (contributionIds.length === 0) {
        setManualPaymentSubmissions([]);
        return;
      }

      const { data, error } = await supabase
        .from('manual_payment_submissions')
        .select(
          'id, contribution_id, fund_space_id, user_id, agent_id, status, transaction_reference, total_amount_paid, rejection_reason, created_at, reviewed_at'
        )
        .in('contribution_id', contributionIds)
        .in('status', ['PENDING_REVIEW', 'REJECTED'])
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Agent manual MoMo submissions load warning:', error.message);
        setManualPaymentSubmissions([]);
        return;
      }

      setManualPaymentSubmissions(
        (data || []) as unknown as ManualPaymentSubmission[]
      );
    },
    []
  );

  const loadContributions = useCallback(async () => {
    try {
      setLoading(true);
      setMessage(null);

      const token = await getAccessToken();
      const params = new URLSearchParams();

      if (filter !== 'ALL') {
        params.set('status', filter);
      }

      if (searchTerm.trim()) {
        params.set('search', searchTerm.trim());
      }

      const response = await fetch(
        `/api/agent/fund-space/contributions?${params.toString()}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const result = (await response.json()) as ContributionsApiResponse;

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Could not load contributions.');
      }

      const loadedContributions = result.contributions || [];

      setContributions(loadedContributions);
      setSummary(
        result.summary || {
          total_contributions: 0,
          pending_contributions: 0,
          paid_contributions: 0,
          failed_contributions: 0,
          total_amount_due: 0,
          total_amount_paid: 0,
        }
      );

      await loadManualPaymentSubmissions(
        loadedContributions.map((item) => item.id)
      );
    } catch (error) {
      setMessage({
        type: 'error',
        text:
          error instanceof Error
            ? error.message
            : 'Something went wrong while loading contribution records.',
      });
    } finally {
      setLoading(false);
    }
  }, [filter, searchTerm, loadManualPaymentSubmissions]);

  const verifyReturnedPayment = useCallback(
    async (reference: string) => {
      if (!reference || verificationAttemptedRef.current) return;

      verificationAttemptedRef.current = true;

      try {
        setVerifyingPayment(true);

        const token = await getAccessToken();

        const response = await fetch(
          `/api/payments/verify?reference=${encodeURIComponent(reference)}`,
          {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${token}`,
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

        const text = result.already_processed
          ? 'This weekly contribution payment was already processed.'
          : 'Weekly contribution payment verified successfully. The contribution has been updated.';

        setMessage({
          type: 'success',
          text,
        });

        toast({
          title: result.already_processed
            ? 'Payment already processed'
            : 'Contribution payment verified',
          description: result.message || text,
        });

        await loadContributions();

        router.replace('/agent/fund-space/contributions');
      } catch (error) {
        const text =
          error instanceof Error
            ? error.message
            : 'Unable to verify returned payment.';

        setMessage({
          type: 'error',
          text,
        });

        toast({
          title: 'Payment verification failed',
          description: text,
          variant: 'destructive',
        });
      } finally {
        setVerifyingPayment(false);
      }
    },
    [loadContributions, router, toast]
  );

  useEffect(() => {
    loadContributions();
  }, [loadContributions]);

  useEffect(() => {
    if (loading) return;

    const reference = getPaymentReferenceFromUrl(searchParams);

    if (reference) {
      verifyReturnedPayment(reference);
    }
  }, [loading, searchParams, verifyReturnedPayment]);

  const visibleContributions = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    if (!normalizedSearch) return contributions;

    return contributions.filter((contribution) => {
      const customer = contribution.customer;
      const fundSpace = contribution.fund_space;
      const round = contribution.round;

      return (
        customer?.full_name?.toLowerCase().includes(normalizedSearch) ||
        customer?.phone?.toLowerCase().includes(normalizedSearch) ||
        customer?.location?.toLowerCase().includes(normalizedSearch) ||
        customer?.city?.toLowerCase().includes(normalizedSearch) ||
        customer?.region?.toLowerCase().includes(normalizedSearch) ||
        fundSpace?.name?.toLowerCase().includes(normalizedSearch) ||
        String(round?.round_number || '').includes(normalizedSearch) ||
        contribution.payment_reference?.toLowerCase().includes(normalizedSearch)
      );
    });
  }, [contributions, searchTerm]);

  const manualSubmissionByContributionId = useMemo(() => {
    const map = new Map<string, ManualPaymentSubmission>();

    for (const submission of sortManualSubmissionsByPriority(
      manualPaymentSubmissions
    )) {
      if (!map.has(submission.contribution_id)) {
        map.set(submission.contribution_id, submission);
      }
    }

    return map;
  }, [manualPaymentSubmissions]);

  function handleOnlinePaymentComingSoon() {
    const text =
      'Online payment will be available soon. For now, please use Pay with MoMo and submit the transaction reference for verification.';

    setMessage({
      type: 'info',
      text,
    });

    toast({
      title: 'Online payment coming soon',
      description: text,
    });
  }

  const handleMomoPaymentSubmitted = async () => {
    setMomoPaymentContribution(null);

    setMessage({
      type: 'success',
      text:
        'MoMo payment reference submitted successfully. Pay with MoMo is locked until admin reviews the transaction.',
    });

    toast({
      title: 'MoMo payment submitted',
      description:
        'The transaction reference has been sent for admin verification.',
    });

    await loadContributions();
  };

  return (
    <>
      <div className="space-y-8">
        <Link
          href="/agent/fund-space"
          className="inline-flex items-center gap-2 text-sm font-bold text-emerald-700 hover:text-emerald-800"
        >
          <ArrowLeft size={16} />
          Back to Agent Fund Space
        </Link>

        <div className="rounded-3xl bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-600 p-6 text-white shadow-sm md:p-8">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
            <div className="max-w-3xl">
              <p className="mb-3 inline-flex rounded-full bg-white/15 px-4 py-1 text-sm font-medium">
                Fund Space Weekly Contributions
              </p>

              <h1 className="text-3xl font-bold md:text-4xl">
                Customer weekly contributions
              </h1>

              <p className="mt-4 max-w-2xl text-sm leading-7 text-emerald-50 md:text-base">
                Use this page to help assigned customers complete their weekly
                Fund Space contribution. Once a MoMo reference is submitted, Pay
                with MoMo will be locked until admin approves or rejects it.
              </p>
            </div>

            <button
              type="button"
              onClick={loadContributions}
              disabled={loading || verifyingPayment}
              className="inline-flex min-h-12 w-fit items-center justify-center gap-2 rounded-xl bg-white/15 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <RefreshCw size={16} />
              )}
              Refresh
            </button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-5">
            <div className="flex gap-3">
              <Smartphone className="mt-1 h-6 w-6 shrink-0 text-emerald-700" />
              <div>
                <h2 className="font-black text-emerald-900">
                  Pay with MoMo
                </h2>
                <p className="mt-1 text-sm leading-6 text-emerald-700">
                  Customer pays to the TrustPoint MoMo account, then the
                  transaction reference is submitted for admin verification.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-amber-100 bg-amber-50 p-5">
            <div className="flex gap-3">
              <CreditCard className="mt-1 h-6 w-6 shrink-0 text-amber-700" />
              <div>
                <h2 className="font-black text-amber-900">
                  Online Payment Coming Soon
                </h2>
                <p className="mt-1 text-sm leading-6 text-amber-700">
                  Online checkout is temporarily disabled while TrustPoint focuses
                  on verified MoMo contribution payments.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-gray-100 bg-gray-50 p-5">
            <div className="flex gap-3">
              <FileCheck2 className="mt-1 h-6 w-6 shrink-0 text-gray-700" />
              <div>
                <h2 className="font-black text-gray-900">
                  Admin Verification
                </h2>
                <p className="mt-1 text-sm leading-6 text-gray-600">
                  Contributions are marked as paid only after admin confirms the
                  transaction from the TrustPoint merchant MoMo statement.
                </p>
              </div>
            </div>
          </div>
        </div>

        {message && (
          <div
            className={`flex items-start gap-3 rounded-2xl border p-4 text-sm font-semibold ${
              message.type === 'success'
                ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
                : message.type === 'info'
                  ? 'border-blue-100 bg-blue-50 text-blue-700'
                  : 'border-red-100 bg-red-50 text-red-700'
            }`}
          >
            {message.type === 'success' ? (
              <CheckCircle2 className="mt-0.5 h-5 w-5 flex-none" />
            ) : message.type === 'info' ? (
              <Info className="mt-0.5 h-5 w-5 flex-none" />
            ) : (
              <AlertCircle className="mt-0.5 h-5 w-5 flex-none" />
            )}
            <p>{message.text}</p>
          </div>
        )}

        {verifyingPayment && (
          <div className="flex items-start gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">
            <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin" />
            <span>
              Verifying weekly contribution payment before updating the Fund
              Space contribution record.
            </span>
          </div>
        )}

        <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-5">
          <StatCard
            title="Total Records"
            value={summary.total_contributions}
            description="All contribution records"
            icon={<Wallet className="h-5 w-5" />}
          />
          <StatCard
            title="Contribution Due"
            value={summary.pending_contributions}
            description="Waiting for weekly payment"
            icon={<Clock className="h-5 w-5" />}
          />
          <StatCard
            title="Paid"
            value={summary.paid_contributions}
            description="Verified payments"
            icon={<CheckCircle2 className="h-5 w-5" />}
          />
          <StatCard
            title="Amount Due"
            value={formatCurrency(summary.total_amount_due)}
            description="Expected weekly collection"
            icon={<CircleDollarSign className="h-5 w-5" />}
          />
          <StatCard
            title="Amount Paid"
            value={formatCurrency(summary.total_amount_paid)}
            description="Confirmed weekly collection"
            icon={<CheckCircle2 className="h-5 w-5" />}
          />
        </section>

        <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-md">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    loadContributions();
                  }
                }}
                placeholder="Search customer, phone, group, round, reference..."
                className="w-full rounded-2xl border border-gray-200 bg-gray-50 py-3 pl-11 pr-4 text-sm outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-50"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {(['ALL', 'PENDING', 'PAID', 'FAILED'] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setFilter(item)}
                  className={`rounded-xl px-4 py-2.5 text-sm font-bold transition ${
                    filter === item
                      ? 'bg-emerald-600 text-white shadow-sm hover:bg-emerald-700'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {item === 'ALL'
                    ? 'All'
                    : item === 'PENDING'
                      ? 'Contribution Due'
                      : item === 'PAID'
                        ? 'Paid'
                        : 'Failed'}
                </button>
              ))}

              <button
                type="button"
                onClick={loadContributions}
                className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-bold text-gray-700 transition hover:bg-gray-50"
              >
                Search
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-gray-100 bg-white shadow-sm">
          {loading ? (
            <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 p-8 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
              </div>
              <p className="text-sm font-medium text-gray-500">
                Loading customer contributions...
              </p>
            </div>
          ) : visibleContributions.length === 0 ? (
            <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 p-8 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-50">
                <Wallet className="h-8 w-8 text-gray-400" />
              </div>
              <h2 className="text-lg font-bold text-gray-900">
                No contribution records found
              </h2>
              <p className="max-w-md text-sm leading-6 text-gray-500">
                Weekly contribution records will appear here when Fund Space
                rounds are generated for your assigned customers.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {visibleContributions.map((contribution) => {
                const customer = contribution.customer;
                const fundSpace = contribution.fund_space;
                const round = contribution.round;
                const remaining = getAmountRemaining(contribution);
                const basePayable = canPayContribution(contribution);
                const manualSubmission =
                  manualSubmissionByContributionId.get(contribution.id) || null;
                const pendingManualSubmission =
                  manualSubmission?.status === 'PENDING_REVIEW'
                    ? manualSubmission
                    : null;
                const rejectedManualSubmission =
                  manualSubmission?.status === 'REJECTED'
                    ? manualSubmission
                    : null;
                const payable = basePayable && !pendingManualSubmission;

                return (
                  <div key={contribution.id} className="p-5 md:p-6">
                    <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-xl font-bold text-gray-900">
                            {customer?.full_name || 'Unknown customer'}
                          </h3>

                          <span
                            className={`rounded-full border px-3 py-1 text-xs font-bold ${getStatusStyle(
                              pendingManualSubmission
                                ? 'PENDING_REVIEW'
                                : contribution.status
                            )}`}
                          >
                            {pendingManualSubmission
                              ? 'Awaiting Verification'
                              : formatLabel(contribution.status)}
                          </span>

                          {round && (
                            <span className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                              Round {round.round_number}
                            </span>
                          )}
                        </div>

                        <div className="mt-4 grid gap-3 text-sm text-gray-600 sm:grid-cols-2 lg:grid-cols-4">
                          <div className="rounded-2xl bg-gray-50 p-4">
                            <p className="text-xs font-semibold uppercase text-gray-400">
                              Phone
                            </p>
                            <p className="mt-1 font-bold text-gray-800">
                              {customer?.phone || 'Not provided'}
                            </p>
                          </div>

                          <div className="rounded-2xl bg-gray-50 p-4">
                            <p className="text-xs font-semibold uppercase text-gray-400">
                              Amount Due
                            </p>
                            <p className="mt-1 font-bold text-gray-800">
                              {formatCurrency(contribution.amount_due)}
                            </p>
                          </div>

                          <div className="rounded-2xl bg-gray-50 p-4">
                            <p className="text-xs font-semibold uppercase text-gray-400">
                              Amount Paid
                            </p>
                            <p className="mt-1 font-bold text-gray-800">
                              {formatCurrency(contribution.amount_paid)}
                            </p>
                          </div>

                          <div className="rounded-2xl bg-gray-50 p-4">
                            <p className="text-xs font-semibold uppercase text-gray-400">
                              Remaining
                            </p>
                            <p className="mt-1 font-bold text-gray-800">
                              {formatCurrency(remaining)}
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 rounded-2xl bg-gray-50 p-4 text-sm text-gray-600">
                          <p>
                            <span className="font-bold text-gray-800">
                              Fund Space:
                            </span>{' '}
                            {fundSpace?.name || 'Not available'}
                          </p>
                          <p className="mt-1">
                            <span className="font-bold text-gray-800">
                              Deadline:
                            </span>{' '}
                            {formatDate(round?.contribution_deadline)}
                          </p>
                          <p className="mt-1">
                            <span className="font-bold text-gray-800">
                              Payment Ref:
                            </span>{' '}
                            {contribution.payment_reference || 'Not paid yet'}
                          </p>
                        </div>

                        {pendingManualSubmission && (
                          <div className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm text-amber-700">
                            <Clock className="mt-0.5 h-5 w-5 shrink-0" />
                            <div>
                              <p className="font-black">
                                MoMo payment awaiting verification
                              </p>
                              <p className="mt-1 leading-6">
                                This contribution already has a MoMo payment
                                request awaiting admin review. Another reference
                                cannot be submitted until admin rejects or
                                approves it.
                              </p>
                              <p className="mt-2 text-xs font-semibold">
                                Reference:{' '}
                                {pendingManualSubmission.transaction_reference}
                              </p>
                            </div>
                          </div>
                        )}

                        {rejectedManualSubmission && !pendingManualSubmission && (
                          <div className="mt-4 flex items-start gap-3 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
                            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                            <div>
                              <p className="font-black">
                                Previous MoMo payment was rejected
                              </p>
                              <p className="mt-1 leading-6">
                                You can submit a corrected MoMo payment
                                reference for this customer.
                              </p>
                              {rejectedManualSubmission.rejection_reason && (
                                <p className="mt-2 text-xs font-semibold">
                                  Reason:{' '}
                                  {rejectedManualSubmission.rejection_reason}
                                </p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="w-full rounded-3xl border border-gray-100 bg-gray-50 p-5 xl:w-[380px]">
                        <div className="flex items-center gap-3">
                          <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-700">
                            <UserRound className="h-5 w-5" />
                          </div>

                          <div>
                            <p className="text-sm font-bold text-gray-900">
                              Weekly Contribution Action
                            </p>
                            <p className="text-xs text-gray-500">
                              Use MoMo verification for now
                            </p>
                          </div>
                        </div>

                        {basePayable ? (
                          <div className="mt-5 grid gap-3">
                            <button
                              type="button"
                              disabled={!payable || verifyingPayment}
                              onClick={() =>
                                payable && setMomoPaymentContribution(contribution)
                              }
                              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                            >
                              <Smartphone size={16} />
                              {pendingManualSubmission
                                ? 'Awaiting Verification'
                                : 'Pay with MoMo'}
                            </button>

                            <button
                              type="button"
                              disabled
                              title="Online payment will be available soon. Please use Pay with MoMo for now."
                              onClick={handleOnlinePaymentComingSoon}
                              className="group relative inline-flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-gray-200 bg-gray-100 px-5 py-3 text-sm font-bold text-gray-400 shadow-sm"
                            >
                              <CreditCard size={16} />
                              Pay Online

                              <span className="pointer-events-none absolute -top-12 left-1/2 hidden w-72 -translate-x-1/2 rounded-xl bg-gray-900 px-3 py-2 text-xs font-semibold leading-5 text-white shadow-lg group-hover:block">
                                Online payment will be available soon. Use Pay
                                with MoMo for now.
                              </span>
                            </button>

                            {pendingManualSubmission ? (
                              <p className="text-xs leading-5 text-amber-700">
                                Pay with MoMo is locked because a payment request
                                is already awaiting admin verification.
                              </p>
                            ) : (
                              <p className="text-xs leading-5 text-gray-500">
                                The customer pays to the TrustPoint MoMo account.
                                After submission, admin verifies the transaction
                                before marking the contribution as paid.
                              </p>
                            )}
                          </div>
                        ) : (
                          <div className="mt-5 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">
                            This contribution is already paid or not payable now.
                          </div>
                        )}

                        <Link
                          href={`/agent/fund-space/${contribution.user_id}`}
                          className="mt-4 inline-flex w-full items-center justify-center rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold text-gray-700 transition hover:bg-gray-50"
                        >
                          View Customer Fund Space
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {momoPaymentContribution && (
        <ManualMerchantPaymentModal
          open={Boolean(momoPaymentContribution)}
          onClose={() => setMomoPaymentContribution(null)}
          onSubmitted={handleMomoPaymentSubmitted}
          contributionId={momoPaymentContribution.id}
          customerName={momoPaymentContribution.customer?.full_name}
          amountDue={getAmountRemaining(momoPaymentContribution)}
          title="Complete Customer MoMo Payment"
        />
      )}
    </>
  );
}