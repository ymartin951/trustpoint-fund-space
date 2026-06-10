'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { ReactNode } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  Eye,
  HandCoins,
  Loader2,
  RefreshCw,
  Search,
  Smartphone,
  UserRound,
  Wallet,
  X,
  XCircle,
} from 'lucide-react';

import { supabase } from '@/lib/supabase/client';

type ContributionStatusFilter =
  | 'ALL'
  | 'PENDING'
  | 'PAID'
  | 'OVERDUE'
  | 'PARTIALLY_PAID'
  | 'LATE';

type VerificationFilter =
  | 'ALL'
  | 'PENDING_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'NO_SUBMISSION';

type ProfileLite = {
  id: string;
  full_name: string | null;
  phone: string | null;
  location?: string | null;
  city?: string | null;
  region?: string | null;
  role?: string | null;
  verification_status?: string | null;
  status?: string | null;
};

type FundSpaceLite = {
  id: string;
  name: string | null;
  contribution_amount: number | string | null;
  status: string | null;
  member_limit?: number | null;
  current_round_number?: number | null;
};

type RoundLite = {
  id: string;
  fund_space_id: string;
  round_number: number | null;
  recipient_user_id?: string | null;
  contribution_amount?: number | string | null;
  expected_total_amount?: number | string | null;
  contribution_deadline: string | null;
  week_start_date?: string | null;
  week_end_date?: string | null;
  status: string | null;
};

type ManualSubmissionLite = {
  id: string;
  contribution_id: string;
  fund_space_id: string;
  round_id: string;
  user_id: string;
  agent_id: string | null;
  status: string;
  transaction_reference: string;
  total_amount_paid: number | string;
  amount_due: number | string;
  service_fee: number | string;
  payer_type: string;
  payer_relationship: string | null;
  sender_name: string | null;
  sender_phone: string | null;
  sender_network: string | null;
  payment_note: string | null;
  rejection_reason: string | null;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by?: string | null;
  actual_payment_date?: string | null;
  actual_payment_time?: string | null;
  actual_payment_at?: string | null;
  actual_payment_source?: string | null;
};

type ContributionRecord = {
  id: string;
  fund_space_id: string;
  round_id: string;
  user_id: string;
  amount_due: number | string;
  amount_paid: number | string;
  confirmed_by: string | null;
  paid_at: string | null;
  payment_method: string | null;
  payment_reference: string | null;
  status: string;
  created_at: string | null;
  updated_at: string | null;
  payment_timing?: string | null;
  is_late?: boolean | null;
  late_fee_amount?: number | string | null;
  late_fee_status?: string | null;
  customer?: ProfileLite | null;
  agent?: ProfileLite | null;
  fund_space?: FundSpaceLite | null;
  round?: RoundLite | null;
  manual_submission?: ManualSubmissionLite | null;
};

type ApiSummary = {
  total_contributions: number;
  pending_contributions: number;
  paid_contributions: number;
  failed_contributions: number;
  pending_review_submissions: number;
  approved_submissions: number;
  rejected_submissions: number;
  total_amount_due: number;
  total_amount_paid: number;
  outstanding_amount: number;
};

type ApiResponse = {
  success: boolean;
  message?: string;
  summary?: ApiSummary;
  all_summary?: ApiSummary;
  contributions?: ContributionRecord[];
};

type SummaryLinkItem = {
  label: string;
  value: string | number;
  helper?: string;
  href?: string;
  icon?: ReactNode;
};

const emptySummary: ApiSummary = {
  total_contributions: 0,
  pending_contributions: 0,
  paid_contributions: 0,
  failed_contributions: 0,
  pending_review_submissions: 0,
  approved_submissions: 0,
  rejected_submissions: 0,
  total_amount_due: 0,
  total_amount_paid: 0,
  outstanding_amount: 0,
};

const statusTabs: {
  label: string;
  value: ContributionStatusFilter;
}[] = [
  { label: 'All', value: 'ALL' },
  { label: 'Due', value: 'PENDING' },
  { label: 'Paid', value: 'PAID' },
  { label: 'Overdue', value: 'OVERDUE' },
  { label: 'Partial', value: 'PARTIALLY_PAID' },
  { label: 'Late', value: 'LATE' },
];

const verificationTabs: {
  label: string;
  value: VerificationFilter;
}[] = [
  { label: 'All Records', value: 'ALL' },
  { label: 'Awaiting Review', value: 'PENDING_REVIEW' },
  { label: 'Approved MoMo', value: 'APPROVED' },
  { label: 'Rejected MoMo', value: 'REJECTED' },
  { label: 'No MoMo Ref', value: 'NO_SUBMISSION' },
];

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

  if (['PAID', 'APPROVED', 'ON_TIME'].includes(value)) {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }

  if (['PENDING', 'PENDING_REVIEW', 'PARTIALLY_PAID'].includes(value)) {
    return 'border-amber-200 bg-amber-50 text-amber-700';
  }

  if (['OVERDUE', 'LATE', 'REJECTED', 'FAILED', 'DEFAULTED'].includes(value)) {
    return 'border-red-200 bg-red-50 text-red-700';
  }

  if (value === 'NO_SUBMISSION') {
    return 'border-slate-200 bg-slate-50 text-slate-700';
  }

  return 'border-slate-200 bg-slate-50 text-slate-700';
}

function getContributionActionState(item: ContributionRecord) {
  const contributionStatus = normalizeStatus(item.status);
  const manualStatus = normalizeStatus(item.manual_submission?.status);

  if (contributionStatus === 'PAID') {
    return {
      label: 'Contribution Paid',
      description:
        'This contribution has been confirmed as paid and counted for the round.',
      className: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    };
  }

  if (manualStatus === 'PENDING_REVIEW') {
    return {
      label: 'MoMo Review Pending',
      description:
        'A manual MoMo reference has been submitted and needs admin review.',
      className: 'border-amber-200 bg-amber-50 text-amber-800',
    };
  }

  if (manualStatus === 'REJECTED') {
    return {
      label: 'MoMo Reference Rejected',
      description:
        item.manual_submission?.rejection_reason ||
        'The submitted MoMo reference was rejected.',
      className: 'border-red-200 bg-red-50 text-red-800',
    };
  }

  if (['OVERDUE', 'LATE', 'FAILED', 'DEFAULTED'].includes(contributionStatus)) {
    return {
      label: 'Contribution Needs Attention',
      description:
        'This contribution is not fully paid and may be late, overdue, failed, or defaulted.',
      className: 'border-red-200 bg-red-50 text-red-800',
    };
  }

  if (contributionStatus === 'PARTIALLY_PAID') {
    return {
      label: 'Partially Paid',
      description: 'The member has paid part of the expected contribution.',
      className: 'border-amber-200 bg-amber-50 text-amber-800',
    };
  }

  return {
    label: 'Waiting for Payment',
    description:
      'No approved payment has been recorded for this contribution yet.',
    className: 'border-slate-200 bg-white text-slate-700',
  };
}

async function readApiResponse(response: Response): Promise<ApiResponse> {
  const text = await response.text();

  if (!text) {
    return {
      success: false,
      message: 'The server returned an empty response.',
    };
  }

  try {
    return JSON.parse(text) as ApiResponse;
  } catch {
    return {
      success: false,
      message: 'The server returned an invalid response.',
    };
  }
}

function SummaryLine({ item }: { item: SummaryLinkItem }) {
  const content = (
    <div className="group min-w-0 rounded-2xl border border-white/70 bg-white/10 p-4 text-white transition hover:-translate-y-0.5 hover:bg-white/20 hover:shadow-lg">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-[11px] font-black uppercase tracking-wide text-emerald-50/90">
          {item.label}
        </p>

        <span className="text-emerald-50/90 transition group-hover:translate-x-0.5">
          {item.icon || <ArrowRight className="h-4 w-4" />}
        </span>
      </div>

      <p className="mt-2 truncate text-2xl font-black text-white md:text-3xl">
        {item.value}
      </p>

      {item.helper && (
        <p className="mt-1 truncate text-xs font-semibold text-emerald-50/80">
          {item.helper}
        </p>
      )}
    </div>
  );

  if (!item.href) return content;

  return <Link href={item.href}>{content}</Link>;
}

function StatusPill({ status }: { status: string | null | undefined }) {
  return (
    <span
      className={`inline-flex max-w-full rounded-full border px-3 py-1 text-xs font-black ${statusClass(
        status
      )}`}
    >
      <span className="truncate">{formatLabel(status)}</span>
    </span>
  );
}

function CompactInfo({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-slate-100 bg-slate-50 p-4">
      <p className="truncate text-[11px] font-black uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-1 break-words text-sm font-black text-slate-900">
        {value ?? 'Not set'}
      </p>
    </div>
  );
}

function MessageBox({
  type,
  message,
}: {
  type: 'success' | 'error';
  message: string;
}) {
  const isSuccess = type === 'success';

  return (
    <div
      className={`rounded-3xl border p-5 ${
        isSuccess
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
          : 'border-red-200 bg-red-50 text-red-700'
      }`}
    >
      <div className="flex items-start gap-3">
        {isSuccess ? (
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
        ) : (
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
        )}
        <p className="min-w-0 break-words text-sm font-bold leading-6">
          {message}
        </p>
      </div>
    </div>
  );
}

export default function AdminFundSpaceContributionsPage() {
  const searchParams = useSearchParams();

  const initialFundSpaceId = searchParams.get('fund_space_id') || '';
  const initialRoundId = searchParams.get('round_id') || '';

  const [contributions, setContributions] = useState<ContributionRecord[]>([]);
  const [summary, setSummary] = useState<ApiSummary>(emptySummary);

  const [statusFilter, setStatusFilter] =
    useState<ContributionStatusFilter>('ALL');
  const [verificationFilter, setVerificationFilter] =
    useState<VerificationFilter>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedContribution, setSelectedContribution] =
    useState<ContributionRecord | null>(null);

  const loadContributions = useCallback(
    async (showRefreshState = false) => {
      try {
        if (showRefreshState) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setErrorMessage('');

        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError || !session?.access_token) {
          throw new Error('Your session has expired. Please log in again.');
        }

        const params = new URLSearchParams();

        params.set('limit', '2000');

        if (statusFilter !== 'ALL') {
          params.set('status', statusFilter);
        }

        if (verificationFilter !== 'ALL') {
          params.set('verification', verificationFilter);
        }

        if (searchTerm.trim()) {
          params.set('search', searchTerm.trim());
        }

        if (initialFundSpaceId) {
          params.set('fund_space_id', initialFundSpaceId);
        }

        if (initialRoundId) {
          params.set('round_id', initialRoundId);
        }

        const response = await fetch(
          `/api/admin/fund-space/contributions?${params.toString()}`,
          {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
          }
        );

        const result = await readApiResponse(response);

        if (!response.ok || !result.success) {
          throw new Error(result.message || 'Unable to load contribution records.');
        }

        setContributions(result.contributions || []);
        setSummary(result.summary || emptySummary);
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'Unable to load contribution records.'
        );
        setContributions([]);
        setSummary(emptySummary);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [
      initialFundSpaceId,
      initialRoundId,
      searchTerm,
      statusFilter,
      verificationFilter,
    ]
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadContributions();
    }, 250);

    return () => window.clearTimeout(timer);
  }, [loadContributions]);

  const pageTitle = useMemo(() => {
    if (initialRoundId) return 'Round Contribution Records';
    if (initialFundSpaceId) return 'Fund Space Contribution Records';

    return 'All Fund Space Contributions';
  }, [initialFundSpaceId, initialRoundId]);

  const baseContributionHref = useMemo(() => {
    const params = new URLSearchParams();

    if (initialFundSpaceId) params.set('fund_space_id', initialFundSpaceId);
    if (initialRoundId) params.set('round_id', initialRoundId);

    const query = params.toString();

    return query
      ? `/admin/fund-space/contributions?${query}`
      : '/admin/fund-space/contributions';
  }, [initialFundSpaceId, initialRoundId]);

  const summaryItems: SummaryLinkItem[] = [
    {
      label: 'Total Records',
      value: summary.total_contributions,
      helper: 'All contributions',
      href: baseContributionHref,
      icon: <Wallet className="h-4 w-4" />,
    },
    {
      label: 'Contribution Due',
      value: summary.pending_contributions,
      helper: 'Pending/overdue',
      href: `${baseContributionHref}${
        baseContributionHref.includes('?') ? '&' : '?'
      }status=PENDING`,
      icon: <Clock className="h-4 w-4" />,
    },
    {
      label: 'Paid Members',
      value: summary.paid_contributions,
      helper: 'Confirmed paid',
      href: `${baseContributionHref}${
        baseContributionHref.includes('?') ? '&' : '?'
      }status=PAID`,
      icon: <CheckCircle2 className="h-4 w-4" />,
    },
    {
      label: 'Awaiting Review',
      value: summary.pending_review_submissions,
      helper: 'MoMo references',
      href: `${baseContributionHref}${
        baseContributionHref.includes('?') ? '&' : '?'
      }verification=PENDING_REVIEW`,
      icon: <Smartphone className="h-4 w-4" />,
    },
    {
      label: 'Rejected MoMo',
      value: summary.rejected_submissions,
      helper: 'Rejected refs',
      href: `${baseContributionHref}${
        baseContributionHref.includes('?') ? '&' : '?'
      }verification=REJECTED`,
      icon: <XCircle className="h-4 w-4" />,
    },
    {
      label: 'Amount Paid',
      value: formatCurrency(summary.total_amount_paid),
      helper: 'Confirmed',
      href: `${baseContributionHref}${
        baseContributionHref.includes('?') ? '&' : '?'
      }status=PAID`,
      icon: <HandCoins className="h-4 w-4" />,
    },
  ];

  useEffect(() => {
    const urlStatus = normalizeStatus(searchParams.get('status'));
    const urlVerification = normalizeStatus(searchParams.get('verification'));

    if (
      ['ALL', 'PENDING', 'PAID', 'OVERDUE', 'PARTIALLY_PAID', 'LATE'].includes(
        urlStatus
      )
    ) {
      setStatusFilter(urlStatus as ContributionStatusFilter);
    }

    if (
      [
        'ALL',
        'PENDING_REVIEW',
        'APPROVED',
        'REJECTED',
        'NO_SUBMISSION',
      ].includes(urlVerification)
    ) {
      setVerificationFilter(urlVerification as VerificationFilter);
    }
  }, [searchParams]);

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-6">
        <div className="mx-auto flex min-h-[60vh] max-w-7xl items-center justify-center">
          <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-emerald-700" />
            <p className="mt-4 text-sm font-black text-slate-600">
              Loading contribution records...
            </p>
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
            onClick={() => loadContributions(true)}
            disabled={refreshing}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        <section className="overflow-hidden rounded-[2rem] bg-gradient-to-br from-emerald-950 via-emerald-900 to-emerald-800 text-white shadow-sm">
          <div className="p-5 md:p-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <p className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-xs font-black">
                  <HandCoins className="h-4 w-4" />
                  Admin Fund Space Contributions
                </p>

                <h1 className="mt-5 text-3xl font-black tracking-tight md:text-5xl">
                  {pageTitle}
                </h1>

                <p className="mt-4 max-w-3xl text-sm font-semibold leading-7 text-emerald-50 md:text-base">
                  Track contribution payments, MoMo review status, paid members,
                  pending members, rejected references, and total amount collected.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Link
                  href="/admin/fund-space"
                  className="inline-flex min-h-9 items-center justify-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 text-xs font-black text-white ring-1 ring-white/10 transition hover:bg-white/20"
                >
                  Fund Space
                </Link>

                <Link
                  href="/admin/manual-payment-submissions"
                  className="inline-flex min-h-9 items-center justify-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 text-xs font-black text-white ring-1 ring-white/10 transition hover:bg-white/20"
                >
                  MoMo Reviews
                </Link>

                <Link
                  href="/admin/fund-space/payouts"
                  className="inline-flex min-h-9 items-center justify-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 text-xs font-black text-white ring-1 ring-white/10 transition hover:bg-white/20"
                >
                  Payouts
                </Link>
              </div>
            </div>

            <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              {summaryItems.map((item) => (
                <SummaryLine key={item.label} item={item} />
              ))}
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <SummaryLine
                item={{
                  label: 'Expected Amount',
                  value: formatCurrency(summary.total_amount_due),
                  helper: 'Total due',
                  icon: <Wallet className="h-4 w-4" />,
                }}
              />

              <SummaryLine
                item={{
                  label: 'Outstanding',
                  value: formatCurrency(summary.outstanding_amount),
                  helper: 'Still unpaid',
                  icon: <Clock className="h-4 w-4" />,
                }}
              />

              <SummaryLine
                item={{
                  label: 'Approved MoMo',
                  value: summary.approved_submissions,
                  helper: 'Approved refs',
                  icon: <CheckCircle2 className="h-4 w-4" />,
                }}
              />
            </div>
          </div>
        </section>

        {errorMessage && <MessageBox type="error" message={errorMessage} />}

        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="relative min-w-0">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search member, phone, reference, group, round..."
                className="min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm font-semibold outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-100"
              />
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1">
              {statusTabs.map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setStatusFilter(tab.value)}
                  className={`shrink-0 rounded-2xl px-4 py-3 text-xs font-black transition ${
                    statusFilter === tab.value
                      ? 'bg-emerald-700 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {verificationTabs.map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setVerificationFilter(tab.value)}
                className={`shrink-0 rounded-2xl px-4 py-3 text-xs font-black transition ${
                  verificationFilter === tab.value
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <p className="mt-3 rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-600">
            Showing {contributions.length} contribution records.
          </p>
        </section>

        <section className="space-y-4">
          {contributions.length === 0 ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
              <HandCoins className="mx-auto h-10 w-10 text-slate-300" />

              <h2 className="mt-4 text-lg font-black text-slate-900">
                No contribution records found
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Try another tab, search term, or refresh the page.
              </p>
            </div>
          ) : (
            contributions.map((item) => {
              const manualStatus =
                item.manual_submission?.status || 'NO_SUBMISSION';
              const isPaid = normalizeStatus(item.status) === 'PAID';
              const actionState = getContributionActionState(item);

              return (
                <article
                  key={item.id}
                  className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:border-emerald-200 hover:shadow-md"
                >
                  <div className="grid gap-5 p-5 xl:grid-cols-[1fr_280px] xl:items-start">
                    <div className="min-w-0">
                      <div className="flex flex-wrap gap-2">
                        <StatusPill status={item.status} />
                        <StatusPill status={manualStatus} />
                        {item.payment_timing && (
                          <StatusPill status={item.payment_timing} />
                        )}
                      </div>

                      <div className="mt-4 flex items-start gap-3">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                          <UserRound className="h-5 w-5" />
                        </div>

                        <div className="min-w-0">
                          <h2 className="line-clamp-2 break-words text-lg font-black leading-6 text-slate-900">
                            {item.customer?.full_name || 'Unknown member'}
                          </h2>

                          <p className="mt-1 truncate text-sm font-semibold text-slate-500">
                            {item.customer?.phone || 'No phone'} •{' '}
                            {item.fund_space?.name || 'Fund Space'}
                          </p>
                        </div>
                      </div>

                      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        <CompactInfo
                          label="Round"
                          value={
                            item.round?.round_number
                              ? `Round ${item.round.round_number}`
                              : 'Not set'
                          }
                        />

                        <CompactInfo
                          label="Amount Due"
                          value={formatCurrency(item.amount_due)}
                        />

                        <CompactInfo
                          label="Amount Paid"
                          value={formatCurrency(item.amount_paid)}
                        />

                        <CompactInfo
                          label="Outstanding"
                          value={formatCurrency(
                            Math.max(
                              toNumber(item.amount_due) - toNumber(item.amount_paid),
                              0
                            )
                          )}
                        />

                        <CompactInfo
                          label="Deadline"
                          value={formatDate(item.round?.contribution_deadline)}
                        />

                        <CompactInfo
                          label="Paid At"
                          value={formatDateTime(item.paid_at)}
                        />

                        <CompactInfo
                          label="Reference"
                          value={
                            item.payment_reference ||
                            item.manual_submission?.transaction_reference ||
                            'None'
                          }
                        />

                        <CompactInfo
                          label="Agent"
                          value={item.agent?.full_name || 'No agent'}
                        />
                      </div>
                    </div>

                    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                      <p className="mb-4 text-sm font-black text-slate-900">
                        Contribution Actions
                      </p>

                      <div className={`mb-4 rounded-2xl border p-4 ${actionState.className}`}>
                        <p className="text-sm font-black">{actionState.label}</p>
                        <p className="mt-1 text-xs font-semibold leading-5">
                          {actionState.description}
                        </p>
                      </div>

                      <div className="grid gap-3">
                        <button
                          type="button"
                          onClick={() => setSelectedContribution(item)}
                          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-4 text-sm font-black text-white hover:bg-emerald-800"
                        >
                          <Eye className="h-4 w-4" />
                          View Details
                        </button>

                        {item.fund_space_id && (
                          <Link
                            href={`/admin/fund-space/${item.fund_space_id}`}
                            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 hover:bg-slate-50"
                          >
                            Fund Space
                            <ArrowRight className="h-4 w-4" />
                          </Link>
                        )}

                        {item.manual_submission?.status === 'PENDING_REVIEW' && (
                          <Link
                            href="/admin/manual-payment-submissions?status=PENDING_REVIEW"
                            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 text-sm font-black text-amber-700 hover:bg-amber-100"
                          >
                            <Smartphone className="h-4 w-4" />
                            Review MoMo
                          </Link>
                        )}

                        {isPaid && (
                          <div className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 text-sm font-black text-emerald-700">
                            <CheckCircle2 className="h-4 w-4" />
                            Contribution Paid
                          </div>
                        )}

                        {!isPaid && !item.manual_submission && (
                          <div className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-100 px-4 text-sm font-black text-slate-600">
                            <Clock className="h-4 w-4" />
                            Waiting for Payment
                          </div>
                        )}

                        {item.manual_submission?.status === 'REJECTED' && (
                          <div className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 text-sm font-black text-red-700">
                            <XCircle className="h-4 w-4" />
                            MoMo Rejected
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </section>
      </div>

      {selectedContribution && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-3 py-4">
          <div className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
              <div className="min-w-0">
                <h2 className="text-lg font-black text-slate-900">
                  Contribution Details
                </h2>

                <p className="mt-1 truncate text-sm text-slate-500">
                  {selectedContribution.customer?.full_name || 'Unknown member'}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedContribution(null)}
                className="rounded-2xl p-2 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <CompactInfo
                  label="Member"
                  value={selectedContribution.customer?.full_name || 'Unknown'}
                />

                <CompactInfo
                  label="Phone"
                  value={selectedContribution.customer?.phone || 'No phone'}
                />

                <CompactInfo
                  label="Fund Space"
                  value={selectedContribution.fund_space?.name || 'Not set'}
                />

                <CompactInfo
                  label="Round"
                  value={
                    selectedContribution.round?.round_number
                      ? `Round ${selectedContribution.round.round_number}`
                      : 'Not set'
                  }
                />

                <CompactInfo
                  label="Contribution Status"
                  value={formatLabel(selectedContribution.status)}
                />

                <CompactInfo
                  label="MoMo Review"
                  value={formatLabel(
                    selectedContribution.manual_submission?.status ||
                      'NO_SUBMISSION'
                  )}
                />

                <CompactInfo
                  label="Amount Due"
                  value={formatCurrency(selectedContribution.amount_due)}
                />

                <CompactInfo
                  label="Amount Paid"
                  value={formatCurrency(selectedContribution.amount_paid)}
                />

                <CompactInfo
                  label="Payment Method"
                  value={formatLabel(selectedContribution.payment_method)}
                />

                <CompactInfo
                  label="Reference"
                  value={
                    selectedContribution.payment_reference ||
                    selectedContribution.manual_submission?.transaction_reference ||
                    'None'
                  }
                />

                <CompactInfo
                  label="Paid At"
                  value={formatDateTime(selectedContribution.paid_at)}
                />

                <CompactInfo
                  label="Deadline"
                  value={formatDate(
                    selectedContribution.round?.contribution_deadline
                  )}
                />

                <CompactInfo
                  label="Payment Timing"
                  value={formatLabel(selectedContribution.payment_timing)}
                />

                <CompactInfo
                  label="Late Fee"
                  value={formatCurrency(selectedContribution.late_fee_amount)}
                />

                <CompactInfo
                  label="Late Fee Status"
                  value={formatLabel(selectedContribution.late_fee_status)}
                />

                <CompactInfo
                  label="Agent"
                  value={selectedContribution.agent?.full_name || 'No agent'}
                />
              </div>

              {selectedContribution.manual_submission?.payment_note && (
                <div className="mt-5 rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-black uppercase tracking-wide text-slate-400">
                    Payment Note
                  </p>

                  <p className="mt-2 whitespace-pre-wrap break-words text-sm font-semibold leading-6 text-slate-700">
                    {selectedContribution.manual_submission.payment_note}
                  </p>
                </div>
              )}

              {selectedContribution.manual_submission?.rejection_reason && (
                <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4">
                  <p className="text-xs font-black uppercase tracking-wide text-red-500">
                    Rejection Reason
                  </p>

                  <p className="mt-2 whitespace-pre-wrap break-words text-sm font-semibold leading-6 text-red-700">
                    {selectedContribution.manual_submission.rejection_reason}
                  </p>
                </div>
              )}

              {selectedContribution.manual_submission && (
                <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-black uppercase tracking-wide text-slate-400">
                    Manual MoMo Submission
                  </p>

                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <CompactInfo
                      label="Sender Name"
                      value={selectedContribution.manual_submission.sender_name}
                    />

                    <CompactInfo
                      label="Sender Phone"
                      value={selectedContribution.manual_submission.sender_phone}
                    />

                    <CompactInfo
                      label="Network"
                      value={formatLabel(
                        selectedContribution.manual_submission.sender_network
                      )}
                    />

                    <CompactInfo
                      label="Submitted At"
                      value={formatDateTime(
                        selectedContribution.manual_submission.created_at
                      )}
                    />

                    <CompactInfo
                      label="Actual Payment Date"
                      value={formatDate(
                        selectedContribution.manual_submission
                          .actual_payment_date
                      )}
                    />

                    <CompactInfo
                      label="Actual Payment Time"
                      value={
                        selectedContribution.manual_submission
                          .actual_payment_time || 'Not set'
                      }
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}