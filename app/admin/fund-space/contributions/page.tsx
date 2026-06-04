'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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
  Eye,
  FileCheck2,
  Filter,
  Info,
  Loader2,
  RefreshCw,
  Search,
  Smartphone,
  UserRound,
  UsersRound,
  Wallet,
  XCircle,
} from 'lucide-react';

import { supabase } from '@/lib/supabase/client';
import { useToast } from '@/hooks/use-toast';

type Summary = {
  total_contributions: number;
  pending_contributions: number;
  paid_contributions: number;
  failed_contributions: number;
  pending_review_submissions: number;
  rejected_submissions: number;
  total_amount_due: number;
  total_amount_paid: number;
};

type CustomerLite = {
  id: string;
  full_name: string | null;
  phone: string | null;
  location: string | null;
  city: string | null;
  region: string | null;
  verification_status: string | null;
  status: string | null;
};

type AgentLite = {
  id: string;
  full_name: string | null;
  phone: string | null;
  role: string | null;
  status: string | null;
};

type FundSpaceLite = {
  id: string;
  name: string | null;
  contribution_amount: number | null;
  status: string | null;
  member_limit: number | null;
  current_round_number: number | null;
};

type RoundLite = {
  id: string;
  fund_space_id: string;
  round_number: number | null;
  recipient_user_id: string | null;
  contribution_amount: number | null;
  expected_total_amount: number | null;
  contribution_deadline: string | null;
  week_start_date: string | null;
  week_end_date: string | null;
  status: string | null;
};

type ManualPaymentSubmission = {
  id: string;
  contribution_id: string;
  fund_space_id: string;
  user_id: string;
  agent_id: string | null;
  status: string | null;
  transaction_reference: string | null;
  total_amount_paid: number | null;
  rejection_reason: string | null;
  created_at: string | null;
  reviewed_at: string | null;
};

type Contribution = {
  id: string;
  fund_space_id: string;
  round_id: string;
  user_id: string;
  amount_due: number | null;
  amount_paid: number | null;
  confirmed_by: string | null;
  paid_at: string | null;
  payment_method: string | null;
  payment_reference: string | null;
  status: string | null;
  created_at: string | null;
  updated_at: string | null;
  customer: CustomerLite | null;
  agent: AgentLite | null;
  fund_space: FundSpaceLite | null;
  round: RoundLite | null;
  manual_submission: ManualPaymentSubmission | null;
};

type ContributionsApiResponse = {
  success: boolean;
  message?: string;
  summary?: Summary;
  contributions?: Contribution[];
};

type ContributionStatusFilter =
  | 'ALL'
  | 'PENDING'
  | 'PAID'
  | 'FAILED'
  | 'OVERDUE'
  | 'PARTIALLY_PAID';

type VerificationFilter =
  | 'ALL'
  | 'PENDING_REVIEW'
  | 'REJECTED'
  | 'APPROVED';

const defaultSummary: Summary = {
  total_contributions: 0,
  pending_contributions: 0,
  paid_contributions: 0,
  failed_contributions: 0,
  pending_review_submissions: 0,
  rejected_submissions: 0,
  total_amount_due: 0,
  total_amount_paid: 0,
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

function formatDateTime(dateString: string | null | undefined) {
  if (!dateString) return 'Not set';

  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) {
    return 'Invalid date';
  }

  return new Intl.DateTimeFormat('en-GH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatLabel(value: string | null | undefined) {
  if (!value) return 'Not set';

  return value
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function normalizeStatus(value: string | null | undefined) {
  return String(value || 'PENDING').toUpperCase();
}

function getStatusStyle(status: string | null | undefined) {
  const value = normalizeStatus(status);

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

function getContributionDestination(contribution: Contribution) {
  const submission = contribution.manual_submission;

  if (normalizeStatus(submission?.status) === 'PENDING_REVIEW') {
    return `/admin/manual-payment-submissions?contribution_id=${encodeURIComponent(
      contribution.id
    )}`;
  }

  if (submission?.id) {
    return `/admin/manual-payment-submissions?contribution_id=${encodeURIComponent(
      contribution.id
    )}`;
  }

  if (contribution.fund_space_id) {
    return `/admin/fund-space?fund_space_id=${encodeURIComponent(
      contribution.fund_space_id
    )}`;
  }

  return '/admin/fund-space';
}

function buildQuery(params: {
  status?: ContributionStatusFilter;
  verification?: VerificationFilter;
  search?: string;
}) {
  const next = new URLSearchParams();

  if (params.status && params.status !== 'ALL') {
    next.set('status', params.status);
  }

  if (params.verification && params.verification !== 'ALL') {
    next.set('verification', params.verification);
  }

  if (params.search?.trim()) {
    next.set('search', params.search.trim());
  }

  const query = next.toString();

  return query ? `/admin/fund-space/contributions?${query}` : '/admin/fund-space/contributions';
}

function StatCard({
  title,
  value,
  description,
  icon,
  href,
}: {
  title: string;
  value: string | number;
  description: string;
  icon: ReactNode;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group block rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-gray-500">{title}</p>
          <h3 className="mt-2 text-3xl font-bold text-gray-900">{value}</h3>
          <p className="mt-1 text-sm leading-6 text-gray-500">{description}</p>
          <p className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-emerald-700 opacity-0 transition group-hover:opacity-100">
            Open records <Eye className="h-3.5 w-3.5" />
          </p>
        </div>

        <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-700 transition group-hover:bg-emerald-600 group-hover:text-white">
          {icon}
        </div>
      </div>
    </Link>
  );
}

function InfoCard({
  title,
  description,
  icon,
  href,
  tone,
}: {
  title: string;
  description: string;
  icon: ReactNode;
  href: string;
  tone: 'emerald' | 'amber' | 'gray';
}) {
  const styles = {
    emerald:
      'border-emerald-100 bg-emerald-50 text-emerald-700 hover:border-emerald-200 hover:bg-emerald-100',
    amber:
      'border-amber-100 bg-amber-50 text-amber-700 hover:border-amber-200 hover:bg-amber-100',
    gray:
      'border-gray-100 bg-gray-50 text-gray-700 hover:border-gray-200 hover:bg-gray-100',
  };

  const titleStyles = {
    emerald: 'text-emerald-900',
    amber: 'text-amber-900',
    gray: 'text-gray-900',
  };

  return (
    <Link
      href={href}
      className={`group block rounded-3xl border p-5 transition hover:-translate-y-0.5 hover:shadow-sm ${styles[tone]}`}
    >
      <div className="flex gap-3">
        <div className="mt-1 shrink-0">{icon}</div>
        <div>
          <h2 className={`font-black ${titleStyles[tone]}`}>{title}</h2>
          <p className="mt-1 text-sm leading-6">{description}</p>
          <p className="mt-3 inline-flex items-center gap-1 text-xs font-black">
            View related information <Eye className="h-3.5 w-3.5" />
          </p>
        </div>
      </div>
    </Link>
  );
}

export default function AdminFundSpaceContributionsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [summary, setSummary] = useState<Summary>(defaultSummary);
  const [loading, setLoading] = useState(true);

  const [statusFilter, setStatusFilter] = useState<ContributionStatusFilter>(
    'ALL'
  );
  const [verificationFilter, setVerificationFilter] =
    useState<VerificationFilter>('ALL');
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

  const syncFiltersFromUrl = useCallback(() => {
    const urlStatus = normalizeStatus(searchParams.get('status'));
    const urlVerification = normalizeStatus(searchParams.get('verification'));
    const urlSearch = searchParams.get('search') || '';

    const validStatuses: ContributionStatusFilter[] = [
      'ALL',
      'PENDING',
      'PAID',
      'FAILED',
      'OVERDUE',
      'PARTIALLY_PAID',
    ];

    const validVerificationStatuses: VerificationFilter[] = [
      'ALL',
      'PENDING_REVIEW',
      'REJECTED',
      'APPROVED',
    ];

    setStatusFilter(
      validStatuses.includes(urlStatus as ContributionStatusFilter)
        ? (urlStatus as ContributionStatusFilter)
        : 'ALL'
    );

    setVerificationFilter(
      validVerificationStatuses.includes(
        urlVerification as VerificationFilter
      )
        ? (urlVerification as VerificationFilter)
        : 'ALL'
    );

    setSearchTerm(urlSearch);
  }, [searchParams]);

  const loadContributions = useCallback(async () => {
    try {
      setLoading(true);
      setMessage(null);

      const token = await getAccessToken();

      const params = new URLSearchParams();

      const urlStatus = searchParams.get('status');
      const urlVerification = searchParams.get('verification');
      const urlSearch = searchParams.get('search');

      if (urlStatus) {
        params.set('status', urlStatus);
      }

      if (urlVerification) {
        params.set('verification', urlVerification);
      }

      if (urlSearch) {
        params.set('search', urlSearch);
      }

      const response = await fetch(
        `/api/admin/fund-space/contributions?${params.toString()}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const result = (await response.json()) as ContributionsApiResponse;

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Could not load contribution records.');
      }

      setContributions(result.contributions || []);
      setSummary(result.summary || defaultSummary);
    } catch (error) {
      const text =
        error instanceof Error
          ? error.message
          : 'Something went wrong while loading admin contribution records.';

      setMessage({
        type: 'error',
        text,
      });

      toast({
        title: 'Could not load contributions',
        description: text,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [searchParams, toast]);

  useEffect(() => {
    syncFiltersFromUrl();
    loadContributions();
  }, [syncFiltersFromUrl, loadContributions]);

  const visibleContributions = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    if (!normalizedSearch) return contributions;

    return contributions.filter((contribution) => {
      const customer = contribution.customer;
      const agent = contribution.agent;
      const fundSpace = contribution.fund_space;
      const round = contribution.round;
      const manualSubmission = contribution.manual_submission;

      return [
        customer?.full_name,
        customer?.phone,
        customer?.location,
        customer?.city,
        customer?.region,
        agent?.full_name,
        agent?.phone,
        fundSpace?.name,
        round?.round_number ? String(round.round_number) : '',
        contribution.payment_reference,
        contribution.status,
        manualSubmission?.transaction_reference,
        manualSubmission?.status,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(normalizedSearch);
    });
  }, [contributions, searchTerm]);

  function applyFilters(next: {
    status?: ContributionStatusFilter;
    verification?: VerificationFilter;
    search?: string;
  }) {
    const href = buildQuery({
      status: next.status ?? statusFilter,
      verification: next.verification ?? verificationFilter,
      search: next.search ?? searchTerm,
    });

    router.push(href);
  }

  function submitSearch() {
    applyFilters({
      search: searchTerm,
    });
  }

  return (
    <div className="space-y-8">
      <Link
        href="/admin/fund-space"
        className="inline-flex items-center gap-2 text-sm font-bold text-emerald-700 hover:text-emerald-800"
      >
        <ArrowLeft size={16} />
        Back to Fund Space Management
      </Link>

      <div className="rounded-3xl bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-600 p-6 text-white shadow-sm md:p-8">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
          <div className="max-w-3xl">
            <p className="mb-3 inline-flex rounded-full bg-white/15 px-4 py-1 text-sm font-medium">
              Admin Weekly Contributions
            </p>

            <h1 className="text-3xl font-bold md:text-4xl">
              Monitor all Fund Space contribution records
            </h1>

            <p className="mt-4 max-w-2xl text-sm leading-7 text-emerald-50 md:text-base">
              View customer weekly contribution records across all Fund Spaces,
              agents, payment statuses, and MoMo verification states. Approval
              and rejection still happen on the MoMo Verification page.
            </p>
          </div>

          <button
            type="button"
            onClick={loadContributions}
            disabled={loading}
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
        <InfoCard
          title="Pay with MoMo Records"
          description="Open contribution records that are connected to manual MoMo payment submission and verification."
          icon={<Smartphone className="h-6 w-6" />}
          href={buildQuery({ verification: 'PENDING_REVIEW' })}
          tone="emerald"
        />

        <InfoCard
          title="Online Payment Coming Soon"
          description="Online checkout is still disabled. Admin can monitor records here while TrustPoint uses verified MoMo payments."
          icon={<CreditCard className="h-6 w-6" />}
          href={buildQuery({ status: 'ALL' })}
          tone="amber"
        />

        <InfoCard
          title="Admin MoMo Verification"
          description="Go to the approval and rejection page for pending MoMo payment references."
          icon={<FileCheck2 className="h-6 w-6" />}
          href="/admin/manual-payment-submissions"
          tone="gray"
        />
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

      <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-6">
        <StatCard
          title="Total Records"
          value={summary.total_contributions}
          description="All contribution records"
          icon={<Wallet className="h-5 w-5" />}
          href={buildQuery({ status: 'ALL', verification: 'ALL' })}
        />

        <StatCard
          title="Contribution Due"
          value={summary.pending_contributions}
          description="Pending, overdue, or partially paid"
          icon={<Clock className="h-5 w-5" />}
          href={buildQuery({ status: 'PENDING', verification: 'ALL' })}
        />

        <StatCard
          title="Paid"
          value={summary.paid_contributions}
          description="Confirmed paid contributions"
          icon={<CheckCircle2 className="h-5 w-5" />}
          href={buildQuery({ status: 'PAID', verification: 'ALL' })}
        />

        <StatCard
          title="Awaiting Review"
          value={summary.pending_review_submissions}
          description="MoMo references waiting for admin"
          icon={<FileCheck2 className="h-5 w-5" />}
          href={buildQuery({ status: 'ALL', verification: 'PENDING_REVIEW' })}
        />

        <StatCard
          title="Rejected MoMo"
          value={summary.rejected_submissions}
          description="Rejected payment references"
          icon={<XCircle className="h-5 w-5" />}
          href={buildQuery({ status: 'ALL', verification: 'REJECTED' })}
        />

        <StatCard
          title="Amount Paid"
          value={formatCurrency(summary.total_amount_paid)}
          description="Confirmed weekly collection"
          icon={<CircleDollarSign className="h-5 w-5" />}
          href={buildQuery({ status: 'PAID', verification: 'ALL' })}
        />
      </section>

      <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="relative w-full xl:max-w-md">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  submitSearch();
                }
              }}
              placeholder="Search customer, agent, phone, group, round, reference..."
              className="w-full rounded-2xl border border-gray-200 bg-gray-50 py-3 pl-11 pr-4 text-sm outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-50"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {(['ALL', 'PENDING', 'PAID', 'FAILED'] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => applyFilters({ status: item })}
                className={`rounded-xl px-4 py-2.5 text-sm font-bold transition ${
                  statusFilter === item
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

            {(['ALL', 'PENDING_REVIEW', 'REJECTED'] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => applyFilters({ verification: item })}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition ${
                  verificationFilter === item
                    ? 'bg-gray-900 text-white shadow-sm hover:bg-gray-800'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Filter className="h-4 w-4" />
                {item === 'ALL'
                  ? 'All Verification'
                  : item === 'PENDING_REVIEW'
                    ? 'Awaiting Review'
                    : 'Rejected'}
              </button>
            ))}

            <button
              type="button"
              onClick={submitSearch}
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
              Loading admin contribution records...
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
              Try clearing the filters or search term. Weekly contribution
              records will appear here when Fund Space rounds are generated.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {visibleContributions.map((contribution) => {
              const customer = contribution.customer;
              const agent = contribution.agent;
              const fundSpace = contribution.fund_space;
              const round = contribution.round;
              const manualSubmission = contribution.manual_submission;
              const remaining = getAmountRemaining(contribution);
              const destination = getContributionDestination(contribution);
              const verificationStatus = normalizeStatus(manualSubmission?.status);

              return (
                <div
                  key={contribution.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => router.push(destination)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      router.push(destination);
                    }
                  }}
                  className="group cursor-pointer p-5 transition hover:bg-emerald-50/40 md:p-6"
                >
                  <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-xl font-bold text-gray-900 group-hover:text-emerald-800">
                          {customer?.full_name || 'Unknown customer'}
                        </h3>

                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-bold ${getStatusStyle(
                            contribution.status
                          )}`}
                        >
                          {formatLabel(contribution.status)}
                        </span>

                        {manualSubmission && (
                          <span
                            className={`rounded-full border px-3 py-1 text-xs font-bold ${getStatusStyle(
                              manualSubmission.status
                            )}`}
                          >
                            MoMo: {formatLabel(manualSubmission.status)}
                          </span>
                        )}

                        {round && (
                          <span className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                            Round {round.round_number || 'N/A'}
                          </span>
                        )}
                      </div>

                      <div className="mt-4 grid gap-3 text-sm text-gray-600 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="rounded-2xl bg-gray-50 p-4 transition group-hover:bg-white">
                          <p className="text-xs font-semibold uppercase text-gray-400">
                            Customer Phone
                          </p>
                          <p className="mt-1 font-bold text-gray-800">
                            {customer?.phone || 'Not provided'}
                          </p>
                        </div>

                        <div className="rounded-2xl bg-gray-50 p-4 transition group-hover:bg-white">
                          <p className="text-xs font-semibold uppercase text-gray-400">
                            Amount Due
                          </p>
                          <p className="mt-1 font-bold text-gray-800">
                            {formatCurrency(contribution.amount_due)}
                          </p>
                        </div>

                        <div className="rounded-2xl bg-gray-50 p-4 transition group-hover:bg-white">
                          <p className="text-xs font-semibold uppercase text-gray-400">
                            Amount Paid
                          </p>
                          <p className="mt-1 font-bold text-gray-800">
                            {formatCurrency(contribution.amount_paid)}
                          </p>
                        </div>

                        <div className="rounded-2xl bg-gray-50 p-4 transition group-hover:bg-white">
                          <p className="text-xs font-semibold uppercase text-gray-400">
                            Remaining
                          </p>
                          <p className="mt-1 font-bold text-gray-800">
                            {formatCurrency(remaining)}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 text-sm text-gray-600 lg:grid-cols-3">
                        <div className="rounded-2xl bg-gray-50 p-4 transition group-hover:bg-white">
                          <p>
                            <span className="font-bold text-gray-800">
                              Fund Space:
                            </span>{' '}
                            {fundSpace?.name || 'Not available'}
                          </p>
                          <p className="mt-1">
                            <span className="font-bold text-gray-800">
                              Fund Space Status:
                            </span>{' '}
                            {formatLabel(fundSpace?.status)}
                          </p>
                        </div>

                        <div className="rounded-2xl bg-gray-50 p-4 transition group-hover:bg-white">
                          <p>
                            <span className="font-bold text-gray-800">
                              Agent:
                            </span>{' '}
                            {agent?.full_name || 'Not assigned'}
                          </p>
                          <p className="mt-1">
                            <span className="font-bold text-gray-800">
                              Agent Phone:
                            </span>{' '}
                            {agent?.phone || 'Not available'}
                          </p>
                        </div>

                        <div className="rounded-2xl bg-gray-50 p-4 transition group-hover:bg-white">
                          <p>
                            <span className="font-bold text-gray-800">
                              Deadline:
                            </span>{' '}
                            {formatDate(round?.contribution_deadline)}
                          </p>
                          <p className="mt-1">
                            <span className="font-bold text-gray-800">
                              Paid At:
                            </span>{' '}
                            {formatDateTime(contribution.paid_at)}
                          </p>
                        </div>
                      </div>

                      {manualSubmission && (
                        <div
                          className={`mt-4 flex items-start gap-3 rounded-2xl border p-4 text-sm ${
                            verificationStatus === 'PENDING_REVIEW'
                              ? 'border-amber-100 bg-amber-50 text-amber-700'
                              : verificationStatus === 'REJECTED'
                                ? 'border-red-100 bg-red-50 text-red-700'
                                : 'border-emerald-100 bg-emerald-50 text-emerald-700'
                          }`}
                        >
                          {verificationStatus === 'REJECTED' ? (
                            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                          ) : verificationStatus === 'PENDING_REVIEW' ? (
                            <Clock className="mt-0.5 h-5 w-5 shrink-0" />
                          ) : (
                            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
                          )}

                          <div>
                            <p className="font-black">
                              MoMo verification information
                            </p>
                            <p className="mt-1 leading-6">
                              Reference:{' '}
                              <span className="font-bold">
                                {manualSubmission.transaction_reference ||
                                  'Not provided'}
                              </span>
                            </p>
                            <p className="mt-1 leading-6">
                              Submitted Amount:{' '}
                              <span className="font-bold">
                                {formatCurrency(
                                  manualSubmission.total_amount_paid
                                )}
                              </span>
                            </p>

                            {manualSubmission.rejection_reason && (
                              <p className="mt-1 leading-6">
                                Rejection Reason:{' '}
                                <span className="font-bold">
                                  {manualSubmission.rejection_reason}
                                </span>
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="w-full rounded-3xl border border-gray-100 bg-gray-50 p-5 xl:w-[360px]">
                      <div className="flex items-center gap-3">
                        <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-700">
                          <UserRound className="h-5 w-5" />
                        </div>

                        <div>
                          <p className="text-sm font-bold text-gray-900">
                            Admin Record Actions
                          </p>
                          <p className="text-xs text-gray-500">
                            Open related record details
                          </p>
                        </div>
                      </div>

                      <div className="mt-5 grid gap-3">
                        <Link
                          href={destination}
                          onClick={(event) => event.stopPropagation()}
                          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700"
                        >
                          <Eye size={16} />
                          View Related Details
                        </Link>

                        <Link
                          href={`/admin/manual-payment-submissions?contribution_id=${encodeURIComponent(
                            contribution.id
                          )}`}
                          onClick={(event) => event.stopPropagation()}
                          className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-bold text-gray-700 shadow-sm transition hover:bg-gray-50"
                        >
                          <FileCheck2 size={16} />
                          View MoMo Verification
                        </Link>

                        <Link
                          href={`/admin/users?search=${encodeURIComponent(
                            customer?.phone || customer?.full_name || ''
                          )}`}
                          onClick={(event) => event.stopPropagation()}
                          className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-bold text-gray-700 shadow-sm transition hover:bg-gray-50"
                        >
                          <UsersRound size={16} />
                          View Customer
                        </Link>

                        <Link
                          href={`/admin/fund-space?search=${encodeURIComponent(
                            fundSpace?.name || ''
                          )}`}
                          onClick={(event) => event.stopPropagation()}
                          className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-bold text-gray-700 shadow-sm transition hover:bg-gray-50"
                        >
                          <Wallet size={16} />
                          View Fund Space
                        </Link>
                      </div>
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