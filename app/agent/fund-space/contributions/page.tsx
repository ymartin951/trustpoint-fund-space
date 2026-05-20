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
  Loader2,
  RefreshCw,
  Search,
  Smartphone,
  UserRound,
  Wallet,
} from 'lucide-react';

import { supabase } from '@/lib/supabase/client';
import { useToast } from '@/hooks/use-toast';

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

type ContributionsApiResponse = {
  success: boolean;
  message?: string;
  summary?: Summary;
  contributions?: Contribution[];
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
};

function formatCurrency(amount: number | null | undefined) {
  return `GH₵${Number(amount || 0).toLocaleString('en-GH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(dateString: string | null | undefined) {
  if (!dateString) return 'Not set';

  return new Intl.DateTimeFormat('en-GH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(dateString));
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

  const [loading, setLoading] = useState(true);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [verifyingPayment, setVerifyingPayment] = useState(false);

  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'PAID' | 'FAILED'>(
    'ALL'
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
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

      setContributions(result.contributions || []);
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
  }, [filter, searchTerm]);

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

  async function handlePayWeeklyContribution(contribution: Contribution) {
    try {
      setPayingId(contribution.id);
      setMessage(null);

      if (!canPayContribution(contribution)) {
        throw new Error('This weekly contribution is not payable right now.');
      }

      const token = await getAccessToken();

      const response = await fetch(
        '/api/payments/agent-customer-contribution/initiate',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            contribution_id: contribution.id,
            momo_number: contribution.customer?.phone,
          }),
        }
      );

      const result = (await response.json()) as ContributionPaymentResponse;

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || 'Could not start weekly contribution payment.'
        );
      }

      if (!result.authorization_url) {
        throw new Error('Payment checkout URL was not returned.');
      }

      toast({
        title: result.existing_payment
          ? 'Continuing pending payment'
          : 'Weekly contribution payment started',
        description:
          result.message ||
          'Redirecting to Paystack Mobile Money checkout for weekly contribution payment.',
      });

      window.location.href = result.authorization_url;
    } catch (error) {
      const text =
        error instanceof Error
          ? error.message
          : 'Something went wrong while starting contribution payment.';

      setMessage({
        type: 'error',
        text,
      });

      toast({
        title: 'Contribution payment failed',
        description: text,
        variant: 'destructive',
      });
    } finally {
      setPayingId(null);
    }
  }

  return (
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
              Fund Space Contribution Payments
            </p>

            <h1 className="text-3xl font-bold md:text-4xl">
              Customer weekly contributions
            </h1>

            <p className="mt-4 max-w-2xl text-sm leading-7 text-emerald-50 md:text-base">
              Use this page only when a customer needs to pay their weekly Fund
              Space contribution. For wallet top-ups, use Customer Wallet
              Deposit instead.
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

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-3xl border border-amber-100 bg-amber-50 p-5">
          <div className="flex gap-3">
            <CreditCard className="mt-1 h-6 w-6 shrink-0 text-amber-700" />
            <div>
              <h2 className="font-black text-amber-900">
                Weekly Contribution Payment
              </h2>
              <p className="mt-1 text-sm leading-6 text-amber-700">
                Use this when the customer says: “I want to pay my weekly Fund
                Space contribution.”
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-5">
          <div className="flex gap-3">
            <Wallet className="mt-1 h-6 w-6 shrink-0 text-emerald-700" />
            <div>
              <h2 className="font-black text-emerald-900">
                Not Wallet Deposit
              </h2>
              <p className="mt-1 text-sm leading-6 text-emerald-700">
                If the customer wants to add money to their wallet, use the
                Customer Wallet Deposit page instead.
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
              : 'border-red-100 bg-red-50 text-red-700'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle2 className="mt-0.5 h-5 w-5 flex-none" />
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
            Verifying weekly contribution payment before updating the Fund Space
            contribution record.
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
              const payable = canPayContribution(contribution);
              const isPaying = payingId === contribution.id;

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
                            contribution.status
                          )}`}
                        >
                          {formatLabel(contribution.status)}
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
                    </div>

                    <div className="w-full rounded-3xl border border-gray-100 bg-gray-50 p-5 xl:w-[360px]">
                      <div className="flex items-center gap-3">
                        <div className="rounded-2xl bg-amber-50 p-3 text-amber-700">
                          <UserRound className="h-5 w-5" />
                        </div>

                        <div>
                          <p className="text-sm font-bold text-gray-900">
                            Weekly Contribution Action
                          </p>
                          <p className="text-xs text-gray-500">
                            Pay contribution due
                          </p>
                        </div>
                      </div>

                      {payable ? (
                        <button
                          type="button"
                          disabled={isPaying || verifyingPayment}
                          onClick={() =>
                            handlePayWeeklyContribution(contribution)
                          }
                          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-amber-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                        >
                          {isPaying ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Starting Payment...
                            </>
                          ) : (
                            <>
                              <Smartphone size={16} />
                              Pay Weekly Contribution
                            </>
                          )}
                        </button>
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
  );
}