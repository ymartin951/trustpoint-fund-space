'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  Clock,
  FileCheck2,
  Loader2,
  Phone,
  RefreshCw,
  Search,
  ShieldCheck,
  Smartphone,
  TimerReset,
  UserRound,
  Users,
  Wallet,
  XCircle,
} from 'lucide-react';

import { ManualMerchantPaymentModal } from '@/components/fund-space/ManualMerchantPaymentModal';
import { supabase } from '@/lib/supabase/client';
import { useToast } from '@/hooks/use-toast';

type FilterType =
  | 'ALL'
  | 'NEEDS_PAYMENT'
  | 'PENDING_REVIEW'
  | 'PAID'
  | 'OVERDUE'
  | 'FAILED';

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
  contribution_deadline: string | null;
  week_start_date: string | null;
  week_end_date: string | null;
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
  payment_timing?: string | null;
  is_late?: boolean | null;
  late_fee_amount?: number | null;
  late_fee_status?: string | null;
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

type ManualSubmissionsApiResponse = {
  success?: boolean;
  message?: string;
  submissions?: ManualPaymentSubmission[];
};

const filters: { label: string; value: FilterType }[] = [
  { label: 'All', value: 'ALL' },
  { label: 'Needs Payment', value: 'NEEDS_PAYMENT' },
  { label: 'Pending Review', value: 'PENDING_REVIEW' },
  { label: 'Paid', value: 'PAID' },
  { label: 'Overdue', value: 'OVERDUE' },
  { label: 'Failed', value: 'FAILED' },
];

function normalize(value: string | null | undefined) {
  return String(value || '').trim().toUpperCase();
}

function formatCurrency(amount: number | null | undefined) {
  return `GH₵${Number(amount || 0).toLocaleString('en-GH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(dateString: string | null | undefined) {
  if (!dateString) return 'Not set';

  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) return 'Invalid date';

  return date.toLocaleDateString('en-GH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatDateTime(dateString: string | null | undefined) {
  if (!dateString) return 'Not set';

  const date = new Date(dateString);

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
  const value = normalize(status || 'PENDING');

  if (
    ['ACTIVE', 'VERIFIED', 'APPROVED', 'COMPLETED', 'PAID', 'SUCCESS'].includes(
      value
    )
  ) {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
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
      'LATE',
    ].includes(value)
  ) {
    return 'border-amber-200 bg-amber-50 text-amber-700';
  }

  if (
    [
      'REJECTED',
      'FAILED',
      'INACTIVE',
      'SUSPENDED',
      'BLACKLISTED',
      'CANCELLED',
      'DEFAULTED',
      'REMOVED',
      'MISSED',
    ].includes(value)
  ) {
    return 'border-red-200 bg-red-50 text-red-700';
  }

  return 'border-slate-200 bg-slate-50 text-slate-700';
}

function getCustomerName(contribution: Contribution) {
  return contribution.customer?.full_name || 'Unnamed customer';
}

function getCustomerPhone(contribution: Contribution) {
  return contribution.customer?.phone || 'No phone';
}

function getCustomerLocation(contribution: Contribution) {
  return (
    contribution.customer?.location ||
    contribution.customer?.city ||
    contribution.customer?.region ||
    'No location'
  );
}

function getAmountRemaining(contribution: Contribution | null | undefined) {
  if (!contribution) return 0;

  return Math.max(
    Number(contribution.amount_due || 0) - Number(contribution.amount_paid || 0),
    0
  );
}

function isPaymentOpen(contribution: Contribution) {
  const status = normalize(contribution.status);
  const remaining = getAmountRemaining(contribution);

  return (
    remaining > 0 &&
    ['PENDING', 'PARTIALLY_PAID', 'OVERDUE', 'LATE', 'MISSED'].includes(status)
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

export default function AgentFundSpaceContributionsPage() {
  const { toast } = useToast();

  const [summary, setSummary] = useState<Summary>({
    total_contributions: 0,
    pending_contributions: 0,
    paid_contributions: 0,
    failed_contributions: 0,
    total_amount_due: 0,
    total_amount_paid: 0,
  });

  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [manualSubmissions, setManualSubmissions] = useState<
    ManualPaymentSubmission[]
  >([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [errorMessage, setErrorMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('ALL');

  const [selectedContribution, setSelectedContribution] =
    useState<Contribution | null>(null);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);

  const getAccessToken = useCallback(async () => {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error || !session?.access_token) {
      throw new Error('Your session has expired. Please log in again.');
    }

    return session.access_token;
  }, []);

  const loadManualSubmissions = useCallback(
    async (token: string, contributionIds: string[]) => {
      try {
        if (contributionIds.length === 0) {
          setManualSubmissions([]);
          return;
        }

        const params = new URLSearchParams();
        params.set('contribution_ids', contributionIds.slice(0, 120).join(','));

        const response = await fetch(
          `/api/agent/fund-space/manual-payment-submissions?${params.toString()}`,
          {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const result = (await response.json().catch(() => null)) as
          | ManualSubmissionsApiResponse
          | null;

        if (!response.ok || !result?.success) {
          setManualSubmissions([]);
          return;
        }

        setManualSubmissions(result.submissions || []);
      } catch (error) {
        console.warn(
          'Agent contribution manual submissions warning:',
          error instanceof Error ? error.message : error
        );
        setManualSubmissions([]);
      }
    },
    []
  );

  const loadContributions = useCallback(
    async (showRefresh = false) => {
      try {
        if (showRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setErrorMessage('');

        const token = await getAccessToken();

        const response = await fetch('/api/agent/fund-space/contributions', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const result = (await response.json().catch(() => null)) as
          | ContributionsApiResponse
          | null;

        if (!response.ok || !result?.success) {
          throw new Error(
            result?.message || 'Unable to load customer contributions.'
          );
        }

        const loadedContributions = result.contributions || [];

        setSummary(
          result.summary || {
            total_contributions: loadedContributions.length,
            pending_contributions: loadedContributions.filter((item) =>
              isPaymentOpen(item)
            ).length,
            paid_contributions: loadedContributions.filter(
              (item) => normalize(item.status) === 'PAID'
            ).length,
            failed_contributions: loadedContributions.filter((item) =>
              ['FAILED', 'REJECTED', 'MISSED'].includes(normalize(item.status))
            ).length,
            total_amount_due: loadedContributions.reduce(
              (sum, item) => sum + Number(item.amount_due || 0),
              0
            ),
            total_amount_paid: loadedContributions.reduce(
              (sum, item) => sum + Number(item.amount_paid || 0),
              0
            ),
          }
        );

        setContributions(loadedContributions);

        await loadManualSubmissions(
          token,
          loadedContributions.map((item) => item.id)
        );
      } catch (error) {
        console.error('Agent contributions load error:', error);

        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'Unable to load contribution queue.'
        );

        setContributions([]);
        setManualSubmissions([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [getAccessToken, loadManualSubmissions]
  );

  useEffect(() => {
    loadContributions();
  }, [loadContributions]);

  const manualSubmissionByContributionId = useMemo(() => {
    const map = new Map<string, ManualPaymentSubmission>();

    const sorted = [...manualSubmissions].sort((a, b) => {
      const aPending = normalize(a.status) === 'PENDING_REVIEW' ? 1 : 0;
      const bPending = normalize(b.status) === 'PENDING_REVIEW' ? 1 : 0;

      if (aPending !== bPending) return bPending - aPending;

      const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;

      return bTime - aTime;
    });

    for (const submission of sorted) {
      if (!map.has(submission.contribution_id)) {
        map.set(submission.contribution_id, submission);
      }
    }

    return map;
  }, [manualSubmissions]);

  const stats = useMemo(() => {
    const needsPayment = contributions.filter((item) => isPaymentOpen(item));
    const paid = contributions.filter((item) => normalize(item.status) === 'PAID');
    const overdue = contributions.filter((item) =>
      ['OVERDUE', 'LATE', 'MISSED'].includes(normalize(item.status))
    );
    const pendingReview = contributions.filter((item) => {
      const submission = manualSubmissionByContributionId.get(item.id);

      return normalize(submission?.status) === 'PENDING_REVIEW';
    });
    const rejectedManual = contributions.filter((item) => {
      const submission = manualSubmissionByContributionId.get(item.id);

      return normalize(submission?.status) === 'REJECTED';
    });

    return {
      total: contributions.length,
      needsPayment: needsPayment.length,
      paid: paid.length,
      overdue: overdue.length,
      pendingReview: pendingReview.length,
      rejectedManual: rejectedManual.length,
      amountDue: contributions.reduce(
        (sum, item) => sum + Number(item.amount_due || 0),
        0
      ),
      amountPaid: contributions.reduce(
        (sum, item) => sum + Number(item.amount_paid || 0),
        0
      ),
      amountRemaining: contributions.reduce(
        (sum, item) => sum + getAmountRemaining(item),
        0
      ),
    };
  }, [contributions, manualSubmissionByContributionId]);

  const filteredContributions = useMemo(() => {
    const searchValue = searchTerm.trim().toLowerCase();

    return contributions.filter((contribution) => {
      const manualSubmission = manualSubmissionByContributionId.get(
        contribution.id
      );

      const customerName = getCustomerName(contribution);
      const customerPhone = getCustomerPhone(contribution);
      const fundSpaceName = contribution.fund_space?.name || '';
      const roundNumber = contribution.round?.round_number || '';

      const matchesSearch =
        !searchValue ||
        [
          customerName,
          customerPhone,
          getCustomerLocation(contribution),
          fundSpaceName,
          roundNumber,
          contribution.status,
          contribution.payment_reference,
          manualSubmission?.transaction_reference,
        ].some((value) =>
          String(value || '').toLowerCase().includes(searchValue)
        );

      const status = normalize(contribution.status);
      const manualStatus = normalize(manualSubmission?.status);

      const matchesFilter =
        activeFilter === 'ALL' ||
        (activeFilter === 'NEEDS_PAYMENT' &&
          isPaymentOpen(contribution) &&
          manualStatus !== 'PENDING_REVIEW') ||
        (activeFilter === 'PENDING_REVIEW' &&
          manualStatus === 'PENDING_REVIEW') ||
        (activeFilter === 'PAID' && status === 'PAID') ||
        (activeFilter === 'OVERDUE' &&
          ['OVERDUE', 'LATE', 'MISSED'].includes(status)) ||
        (activeFilter === 'FAILED' &&
          ['FAILED', 'REJECTED', 'CANCELLED'].includes(status));

      return matchesSearch && matchesFilter;
    });
  }, [
    activeFilter,
    contributions,
    manualSubmissionByContributionId,
    searchTerm,
  ]);

  function openPaymentModal(contribution: Contribution) {
    setSelectedContribution(contribution);
    setPaymentModalOpen(true);
  }

  async function handlePaymentSubmitted() {
    toast({
      title: 'MoMo payment submitted',
      description:
        'The customer payment reference has been submitted for admin verification.',
    });

    setSelectedContribution(null);
    setPaymentModalOpen(false);
    await loadContributions(true);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-6 md:px-8">
        <div className="mx-auto flex min-h-[60vh] max-w-7xl items-center justify-center">
          <div className="text-center">
            <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-emerald-700" />
            <h1 className="text-lg font-black text-slate-900">
              Loading weekly contribution queue...
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Please wait while TrustPoint loads your assigned customer payments.
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <>
      <main className="min-h-screen bg-slate-50 px-4 py-5 md:px-8">
        <div className="mx-auto max-w-7xl space-y-5">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <Link
              href="/agent"
              className="inline-flex min-h-11 w-fit items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-100"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Agent Control Center
            </Link>

            <button
              type="button"
              onClick={() => loadContributions(true)}
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

          <section className="rounded-3xl bg-gradient-to-br from-emerald-800 via-emerald-700 to-teal-700 p-5 text-white shadow-sm md:p-8">
            <div className="flex flex-col justify-between gap-6 xl:flex-row xl:items-center">
              <div className="min-w-0 max-w-4xl">
                <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-xs font-black">
                  <Smartphone className="h-4 w-4" />
                  Weekly Contribution Queue
                </p>

                <h1 className="break-words text-2xl font-black md:text-4xl">
                  Collect customer Fund Space payments
                </h1>

                <p className="mt-4 max-w-3xl text-sm font-semibold leading-7 text-emerald-50 md:text-base">
                  Use this page as your daily agent payment queue. See who has
                  paid, who still needs to pay, and which MoMo references are
                  waiting for admin verification.
                </p>

                <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <HeroStat label="Total Records" value={stats.total} />
                  <HeroStat label="Need Payment" value={stats.needsPayment} />
                  <HeroStat label="Pending Review" value={stats.pendingReview} />
                  <HeroStat label="Paid" value={stats.paid} />
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row xl:flex-col">
                <Link
                  href="/agent/fund-space"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-white px-5 text-sm font-black text-emerald-700 shadow-sm hover:bg-emerald-50"
                >
                  <Users className="h-4 w-4" />
                  Customer Fund Space
                </Link>

                <Link
                  href="/agent/customers"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-white/15 px-5 text-sm font-black text-white transition hover:bg-white/20"
                >
                  <UserRound className="h-4 w-4" />
                  View Customers
                </Link>
              </div>
            </div>
          </section>

          {errorMessage && (
            <section className="rounded-3xl border border-red-200 bg-red-50 p-5 text-sm font-bold text-red-700">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                <div className="min-w-0">
                  <p className="break-words">{errorMessage}</p>

                  {errorMessage.toLowerCase().includes('session') && (
                    <Link
                      href="/auth/login"
                      className="mt-3 inline-flex rounded-xl bg-white px-4 py-2 text-xs font-black text-red-700 shadow-sm"
                    >
                      Go to login
                    </Link>
                  )}
                </div>
              </div>
            </section>
          )}

          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-7">
            <StatCard
              title="Total"
              value={stats.total}
              description="Contribution records"
              icon={<FileCheck2 className="h-5 w-5" />}
            />
            <StatCard
              title="Need Payment"
              value={stats.needsPayment}
              description="Open for MoMo payment"
              icon={<Smartphone className="h-5 w-5" />}
            />
            <StatCard
              title="Pending Review"
              value={stats.pendingReview}
              description="Admin must verify"
              icon={<Clock className="h-5 w-5" />}
            />
            <StatCard
              title="Paid"
              value={stats.paid}
              description="Confirmed paid"
              icon={<CheckCircle2 className="h-5 w-5" />}
            />
            <StatCard
              title="Overdue"
              value={stats.overdue}
              description="Late or missed"
              icon={<TimerReset className="h-5 w-5" />}
            />
            <StatCard
              title="Amount Paid"
              value={formatCurrency(summary.total_amount_paid || stats.amountPaid)}
              description="Confirmed payments"
              icon={<Wallet className="h-5 w-5" />}
            />
            <StatCard
              title="Remaining"
              value={formatCurrency(stats.amountRemaining)}
              description="Still expected"
              icon={<BadgeCheck className="h-5 w-5" />}
            />
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
            <div className="grid gap-4 xl:grid-cols-[1fr_auto] xl:items-center">
              <div className="min-w-0">
                <h2 className="text-xl font-black text-slate-900">
                  Payment Queue
                </h2>
                <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">
                  Search and filter customer contribution records. Use “Collect
                  Payment” to submit a MoMo transaction reference.
                </p>
              </div>

              <Link
                href="/agent/fund-space"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-5 text-sm font-black text-white transition hover:bg-emerald-800"
              >
                Open Customer Fund Space
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="relative mt-5">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search by customer name, phone, Fund Space, round, status, or reference..."
                className="min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm font-bold text-slate-700 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-50"
              />
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {filters.map((filter) => (
                <button
                  key={filter.value}
                  type="button"
                  onClick={() => setActiveFilter(filter.value)}
                  className={`rounded-xl px-4 py-2.5 text-sm font-black transition ${
                    activeFilter === filter.value
                      ? 'bg-emerald-700 text-white shadow-sm hover:bg-emerald-800'
                      : 'bg-slate-100 text-slate-700 hover:bg-emerald-50 hover:text-emerald-700'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
            {filteredContributions.length === 0 ? (
              <EmptyQueueBlock />
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredContributions.map((contribution) => {
                  const manualSubmission = manualSubmissionByContributionId.get(
                    contribution.id
                  );

                  return (
                    <ContributionRow
                      key={contribution.id}
                      contribution={contribution}
                      manualSubmission={manualSubmission || null}
                      onCollect={() => openPaymentModal(contribution)}
                    />
                  );
                })}
              </div>
            )}
          </section>

          <section className="rounded-3xl border border-amber-100 bg-amber-50 p-5">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-1 h-5 w-5 shrink-0 text-amber-700" />

              <div className="min-w-0">
                <h2 className="text-base font-black text-amber-900">
                  Payment collection reminder
                </h2>

                <p className="mt-2 break-words text-sm font-semibold leading-6 text-amber-700">
                  Always confirm the customer’s name, phone number, amount, and
                  MoMo transaction reference before submitting. Admin approval is
                  required before a contribution becomes paid.
                </p>
              </div>
            </div>
          </section>
        </div>
      </main>

      {selectedContribution && (
        <ManualMerchantPaymentModal
          open={paymentModalOpen}
          onClose={() => {
            setPaymentModalOpen(false);
            setSelectedContribution(null);
          }}
          onSubmitted={handlePaymentSubmitted}
          contributionId={selectedContribution.id}
          customerName={getCustomerName(selectedContribution)}
          amountDue={getAmountRemaining(selectedContribution)}
          title="Submit Customer Fund Space Payment"
        />
      )}
    </>
  );
}

function HeroStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-0 rounded-2xl bg-white/15 px-4 py-3 backdrop-blur">
      <p className="break-words text-xs font-bold text-emerald-50">{label}</p>
      <p className="mt-1 text-2xl font-black text-white">{value}</p>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
  description,
}: {
  title: string;
  value: string | number;
  icon: ReactNode;
  description: string;
}) {
  return (
    <div className="min-w-0 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 inline-flex rounded-2xl bg-emerald-50 p-3 text-emerald-700">
        {icon}
      </div>

      <p className="break-words text-sm font-bold text-slate-500">{title}</p>
      <h3 className="mt-1 break-words text-2xl font-black text-slate-900">
        {value}
      </h3>
      <p className="mt-1 break-words text-xs font-semibold leading-5 text-slate-500">
        {description}
      </p>
    </div>
  );
}

function MiniInfo({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0 rounded-2xl bg-slate-50 p-4">
      <p className="break-words text-[11px] font-black uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <div className="mt-1 break-words text-sm font-bold leading-6 text-slate-800">
        {value}
      </div>
    </div>
  );
}

function ContributionRow({
  contribution,
  manualSubmission,
  onCollect,
}: {
  contribution: Contribution;
  manualSubmission: ManualPaymentSubmission | null;
  onCollect: () => void;
}) {
  const customerName = getCustomerName(contribution);
  const customerPhone = getCustomerPhone(contribution);
  const customerLocation = getCustomerLocation(contribution);
  const remaining = getAmountRemaining(contribution);

  const manualStatus = normalize(manualSubmission?.status);
  const contributionStatus = normalize(contribution.status);

  const lockedByPendingReview = manualStatus === 'PENDING_REVIEW';
  const canCollect = isPaymentOpen(contribution) && !lockedByPendingReview;

  return (
    <article className="p-5 md:p-6">
      <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
        <div className="min-w-0">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-sm font-black text-emerald-700">
                {customerName.slice(0, 1).toUpperCase()}
              </div>

              <div className="min-w-0">
                <h3 className="break-words text-xl font-black text-slate-900">
                  {customerName}
                </h3>

                <p className="mt-1 break-words text-sm font-semibold text-slate-500">
                  {customerPhone} • {customerLocation}
                </p>

                <p className="mt-1 break-words text-xs font-semibold text-slate-500">
                  {contribution.fund_space?.name || 'Fund Space'} • Round{' '}
                  {contribution.round?.round_number || 'N/A'} • Deadline:{' '}
                  {formatDate(contribution.round?.contribution_deadline)}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <StatusPill status={contribution.status} />
              {manualSubmission && <StatusPill status={manualSubmission.status} />}
              {contribution.payment_timing && (
                <StatusPill status={contribution.payment_timing} />
              )}
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MiniInfo
              label="Amount Due"
              value={formatCurrency(contribution.amount_due)}
            />
            <MiniInfo
              label="Amount Paid"
              value={formatCurrency(contribution.amount_paid)}
            />
            <MiniInfo label="Remaining" value={formatCurrency(remaining)} />
            <MiniInfo
              label="Paid At"
              value={formatDateTime(contribution.paid_at)}
            />
            <MiniInfo
              label="Payment Method"
              value={formatLabel(contribution.payment_method)}
            />
            <MiniInfo
              label="Payment Reference"
              value={contribution.payment_reference || 'Not set'}
            />
            <MiniInfo
              label="Late Fee"
              value={formatCurrency(contribution.late_fee_amount || 0)}
            />
            <MiniInfo
              label="Late Fee Status"
              value={formatLabel(contribution.late_fee_status)}
            />
          </div>

          {manualSubmission && (
            <div
              className={`mt-5 rounded-3xl border p-5 ${
                manualStatus === 'PENDING_REVIEW'
                  ? 'border-amber-100 bg-amber-50 text-amber-800'
                  : manualStatus === 'REJECTED'
                    ? 'border-red-100 bg-red-50 text-red-800'
                    : 'border-slate-200 bg-slate-50 text-slate-700'
              }`}
            >
              <p className="text-sm font-black">
                Manual MoMo Submission: {formatLabel(manualSubmission.status)}
              </p>

              <p className="mt-2 text-sm font-semibold leading-6">
                Reference: {manualSubmission.transaction_reference} • Submitted:{' '}
                {formatDateTime(manualSubmission.created_at)}
              </p>

              {manualSubmission.rejection_reason && (
                <p className="mt-2 text-sm font-semibold leading-6">
                  Rejection reason: {manualSubmission.rejection_reason}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
          <p className="mb-4 text-sm font-black text-slate-900">
            Payment Action
          </p>

          <div className="space-y-3">
            <button
              type="button"
              onClick={onCollect}
              disabled={!canCollect}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-5 text-sm font-black text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              <Smartphone className="h-4 w-4" />
              {lockedByPendingReview
                ? 'Awaiting Admin Review'
                : contributionStatus === 'PAID'
                  ? 'Already Paid'
                  : 'Collect Payment'}
            </button>

            <Link
              href={`/agent/fund-space/${contribution.user_id}`}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 text-sm font-black text-slate-700 transition hover:bg-slate-50"
            >
              Open Customer Fund Space
              <ArrowRight className="h-4 w-4" />
            </Link>

            <Link
              href={`/agent/customers/${contribution.user_id}`}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 text-sm font-black text-slate-700 transition hover:bg-slate-50"
            >
              View Customer Profile
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-5 grid gap-3">
            <MiniInfo
              label="Trust Visibility"
              value={
                normalize(contribution.customer?.verification_status) ===
                'VERIFIED'
                  ? 'Verified customer'
                  : formatLabel(contribution.customer?.verification_status)
              }
            />

            <MiniInfo
              label="Transparency"
              value={
                contribution.fund_space
                  ? `Round ${contribution.fund_space.current_round_number || 0}`
                  : 'Not available'
              }
            />

            <MiniInfo
              label="Group Status"
              value={formatLabel(contribution.fund_space?.status)}
            />
          </div>
        </div>
      </div>
    </article>
  );
}

function EmptyQueueBlock() {
  return (
    <div className="flex min-h-[360px] flex-col items-center justify-center p-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-50">
        <FileCheck2 className="h-9 w-9 text-slate-400" />
      </div>

      <h2 className="mt-4 text-lg font-black text-slate-900">
        No contribution records found
      </h2>

      <p className="mt-2 max-w-md text-sm font-semibold leading-6 text-slate-500">
        No customer contribution matches your current search or filter. Try
        refreshing or changing the selected filter.
      </p>

      <Link
        href="/agent/fund-space"
        className="mt-5 inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-5 text-sm font-black text-white transition hover:bg-emerald-800"
      >
        Open Customer Fund Space
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}