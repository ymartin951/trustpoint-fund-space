'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Banknote,
  CheckCircle2,
  Clock,
  Eye,
  Loader2,
  RefreshCw,
  Search,
  ShieldAlert,
  Smartphone,
  TimerReset,
  UserRound,
  Wallet,
  X,
  XCircle,
} from 'lucide-react';

import { supabase } from '@/lib/supabase/client';

type SubmissionStatus =
  | 'ALL'
  | 'PENDING_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED';

type ProfileLite = {
  id: string;
  full_name: string | null;
  phone: string | null;
  email?: string | null;
  role?: string | null;
  status?: string | null;
  verification_status?: string | null;
};

type FundSpaceLite = {
  id: string;
  name: string | null;
  contribution_amount: number | string | null;
  status: string | null;
};

type RoundLite = {
  id: string;
  round_number: number | null;
  contribution_deadline: string | null;
  status: string | null;
};

type CompanyAccountLite = {
  id: string;
  account_name: string | null;
  provider: string | null;
  network: string | null;
  merchant_number: string | null;
  merchant_id: string | null;
};

type ManualPaymentSubmission = {
  id: string;
  agent_id: string | null;
  amount_due: number | string | null;
  approved_contribution_transaction_id?: string | null;
  company_payment_account_id: string | null;
  contribution_id: string;
  created_at: string;
  fund_space_id: string;
  metadata?: unknown;
  payer_relationship: string | null;
  payer_type: string | null;
  payment_note: string | null;
  rejection_reason: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  round_id: string;
  screenshot_url: string | null;
  sender_name: string | null;
  sender_network: string | null;
  sender_phone: string | null;
  service_fee: number | string | null;
  status: string;
  submitted_by: string | null;
  submitted_by_role: string | null;
  total_amount_paid: number | string | null;
  transaction_reference: string;
  updated_at: string;
  user_id: string;

  actual_payment_date?: string | null;
  actual_payment_time?: string | null;
  actual_payment_at?: string | null;
  actual_payment_source?: string | null;

  customer?: ProfileLite | null;
  agent?: ProfileLite | null;
  submitted_by_profile?: ProfileLite | null;
  reviewed_by_profile?: ProfileLite | null;
  fund_space?: FundSpaceLite | null;
  round?: RoundLite | null;
  company_account?: CompanyAccountLite | null;
};

type ApiStats = {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  cancelled: number;
  total_pending_value: number;
  total_approved_value: number;
};

type ApiResponse = {
  success: boolean;
  message?: string;
  submissions?: ManualPaymentSubmission[];
  stats?: ApiStats;
};

type StatCardItem = {
  title: string;
  value: string | number;
  helper: string;
  href: string;
  status: SubmissionStatus;
  icon: ReactNode;
};

const defaultStats: ApiStats = {
  total: 0,
  pending: 0,
  approved: 0,
  rejected: 0,
  cancelled: 0,
  total_pending_value: 0,
  total_approved_value: 0,
};

const statusTabs: { label: string; value: SubmissionStatus; href: string }[] = [
  { label: 'All', value: 'ALL', href: '/admin/manual-payment-submissions' },
  {
    label: 'Pending Review',
    value: 'PENDING_REVIEW',
    href: '/admin/manual-payment-submissions?status=PENDING_REVIEW',
  },
  {
    label: 'Approved',
    value: 'APPROVED',
    href: '/admin/manual-payment-submissions?status=APPROVED',
  },
  {
    label: 'Rejected',
    value: 'REJECTED',
    href: '/admin/manual-payment-submissions?status=REJECTED',
  },
  {
    label: 'Cancelled',
    value: 'CANCELLED',
    href: '/admin/manual-payment-submissions?status=CANCELLED',
  },
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

function statusStyle(status: string | null | undefined) {
  const value = normalizeStatus(status);

  if (['APPROVED', 'PAID', 'VERIFIED', 'ON_TIME'].includes(value)) {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }

  if (['PENDING_REVIEW', 'PENDING', 'APPLIED'].includes(value)) {
    return 'border-amber-200 bg-amber-50 text-amber-700';
  }

  if (['REJECTED', 'FAILED', 'LATE', 'MISSED', 'CANCELLED'].includes(value)) {
    return 'border-red-200 bg-red-50 text-red-700';
  }

  return 'border-slate-200 bg-slate-50 text-slate-700';
}

function getPaymentTimingStatus(submission: ManualPaymentSubmission) {
  const actualPaymentValue =
    submission.actual_payment_at || submission.actual_payment_date;
  const deadlineValue = submission.round?.contribution_deadline;

  if (!actualPaymentValue || !deadlineValue) {
    return {
      label: 'Cannot determine',
      description: 'Actual payment time or deadline is missing.',
      className: 'border-slate-200 bg-slate-50 text-slate-700',
    };
  }

  const actualPaymentDate = new Date(actualPaymentValue);
  const deadlineDate = new Date(deadlineValue);

  if (
    Number.isNaN(actualPaymentDate.getTime()) ||
    Number.isNaN(deadlineDate.getTime())
  ) {
    return {
      label: 'Cannot determine',
      description: 'Payment date or deadline is invalid.',
      className: 'border-slate-200 bg-slate-50 text-slate-700',
    };
  }

  const actualDay = new Date(
    actualPaymentDate.getFullYear(),
    actualPaymentDate.getMonth(),
    actualPaymentDate.getDate()
  );

  const deadlineDay = new Date(
    deadlineDate.getFullYear(),
    deadlineDate.getMonth(),
    deadlineDate.getDate()
  );

  if (actualDay.getTime() <= deadlineDay.getTime()) {
    return {
      label: 'Appears on time',
      description:
        'Actual MoMo payment date is on or before the contribution deadline.',
      className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    };
  }

  return {
    label: 'Appears late',
    description: 'Actual MoMo payment date is after the contribution deadline.',
    className: 'border-red-200 bg-red-50 text-red-700',
  };
}

function getReviewState(submission: ManualPaymentSubmission) {
  const status = normalizeStatus(submission.status);

  if (status === 'APPROVED') {
    return {
      label: 'Payment Approved',
      description:
        'This submission has already been approved and the payment has been applied.',
      tone: 'approved',
    };
  }

  if (status === 'REJECTED') {
    return {
      label: 'Payment Rejected',
      description:
        submission.rejection_reason ||
        'This submission was rejected. Check the rejection reason before any further action.',
      tone: 'rejected',
    };
  }

  if (status === 'CANCELLED') {
    return {
      label: 'Submission Cancelled',
      description:
        'This payment submission has been cancelled and cannot be reviewed.',
      tone: 'cancelled',
    };
  }

  if (status === 'PENDING_REVIEW') {
    return {
      label: 'Pending Admin Review',
      description:
        'This payment is waiting for admin approval or rejection.',
      tone: 'pending',
    };
  }

  return {
    label: formatLabel(status),
    description: 'This payment submission is not currently open for review.',
    tone: 'neutral',
  };
}

function getApproveButtonText(status: string, loading: boolean) {
  if (loading) return 'Approving...';

  if (status === 'APPROVED') return 'Payment Approved';
  if (status === 'REJECTED') return 'Cannot Approve — Rejected';
  if (status === 'CANCELLED') return 'Cannot Approve — Cancelled';
  if (status === 'PENDING_REVIEW') return 'Approve Payment';

  return `Cannot Approve — ${formatLabel(status)}`;
}

function getRejectButtonText(status: string, loading: boolean) {
  if (loading) return 'Rejecting...';

  if (status === 'APPROVED') return 'Cannot Reject — Approved';
  if (status === 'REJECTED') return 'Payment Rejected';
  if (status === 'CANCELLED') return 'Cannot Reject — Cancelled';
  if (status === 'PENDING_REVIEW') return 'Reject Payment';

  return `Cannot Reject — ${formatLabel(status)}`;
}

function getReviewBoxClass(tone: string) {
  if (tone === 'approved') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  }

  if (tone === 'rejected' || tone === 'cancelled') {
    return 'border-red-200 bg-red-50 text-red-800';
  }

  if (tone === 'pending') {
    return 'border-amber-200 bg-amber-50 text-amber-800';
  }

  return 'border-slate-200 bg-white text-slate-700';
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

function buildStats(submissions: ManualPaymentSubmission[]): ApiStats {
  return submissions.reduce<ApiStats>(
    (acc, submission) => {
      const status = normalizeStatus(submission.status);
      const amount = toNumber(
        submission.total_amount_paid || submission.amount_due
      );

      acc.total += 1;

      if (status === 'PENDING_REVIEW') {
        acc.pending += 1;
        acc.total_pending_value += amount;
      }

      if (status === 'APPROVED') {
        acc.approved += 1;
        acc.total_approved_value += amount;
      }

      if (status === 'REJECTED') {
        acc.rejected += 1;
      }

      if (status === 'CANCELLED') {
        acc.cancelled += 1;
      }

      return acc;
    },
    { ...defaultStats }
  );
}

function StatusPill({ status }: { status: string | null | undefined }) {
  return (
    <span
      className={`inline-flex w-fit items-center rounded-full border px-3 py-1 text-xs font-black ${statusStyle(
        status
      )}`}
    >
      {formatLabel(status)}
    </span>
  );
}

function StatCard({
  item,
  active,
}: {
  item: {
    title: string;
    value: string | number;
    helper: string;
    href: string;
    status: SubmissionStatus;
    icon: ReactNode;
  };
  active: boolean;
}) {
  return (
    <Link
      href={item.href}
      className={`group min-w-0 rounded-2xl border border-white/70 bg-white/10 p-4 text-white transition hover:-translate-y-0.5 hover:bg-white/20 hover:shadow-lg ${
        active ? 'bg-white/20 ring-2 ring-white/40' : ''
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-[11px] font-black uppercase tracking-wide text-emerald-50/90">
          {item.title}
        </p>

        <span className="text-emerald-50/90 transition group-hover:translate-x-0.5">
          {item.icon}
        </span>
      </div>

      <p className="mt-2 truncate text-2xl font-black text-white md:text-3xl">
        {item.value}
      </p>

      <p className="mt-1 truncate text-xs font-semibold text-emerald-50/80">
        {item.helper}
      </p>
    </Link>
  );
}

function InfoBox({
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
        {value ?? 'Not provided'}
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
        <p className="text-sm font-bold leading-6">{message}</p>
      </div>
    </div>
  );
}

export default function AdminManualPaymentSubmissionsPage() {
  const searchParams = useSearchParams();

  const [submissions, setSubmissions] = useState<ManualPaymentSubmission[]>([]);
  const [statusFilter, setStatusFilter] = useState<SubmissionStatus>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState('');

  const [selectedSubmission, setSelectedSubmission] =
    useState<ManualPaymentSubmission | null>(null);

  const [rejectingSubmission, setRejectingSubmission] =
    useState<ManualPaymentSubmission | null>(null);

  const [rejectionReason, setRejectionReason] = useState('');

  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const urlStatus = normalizeStatus(searchParams.get('status'));

    if (
      ['PENDING_REVIEW', 'APPROVED', 'REJECTED', 'CANCELLED'].includes(
        urlStatus
      )
    ) {
      setStatusFilter(urlStatus as SubmissionStatus);
    } else {
      setStatusFilter('ALL');
    }
  }, [searchParams]);

  const stats = useMemo(() => buildStats(submissions), [submissions]);

  const statCards = [
    {
      title: 'All Records',
      value: stats.total,
      helper: 'Every submitted MoMo record',
      href: '/admin/manual-payment-submissions',
      status: 'ALL' as SubmissionStatus,
      icon: <ShieldAlert className="h-4 w-4" />,
    },
    {
      title: 'Pending',
      value: stats.pending,
      helper: 'Needs admin review',
      href: '/admin/manual-payment-submissions?status=PENDING_REVIEW',
      status: 'PENDING_REVIEW' as SubmissionStatus,
      icon: <Clock className="h-4 w-4" />,
    },
    {
      title: 'Approved',
      value: stats.approved,
      helper: 'Confirmed payments',
      href: '/admin/manual-payment-submissions?status=APPROVED',
      status: 'APPROVED' as SubmissionStatus,
      icon: <CheckCircle2 className="h-4 w-4" />,
    },
    {
      title: 'Rejected',
      value: stats.rejected,
      helper: 'Rejected references',
      href: '/admin/manual-payment-submissions?status=REJECTED',
      status: 'REJECTED' as SubmissionStatus,
      icon: <XCircle className="h-4 w-4" />,
    },
    {
      title: 'Approved Value',
      value: formatCurrency(stats.total_approved_value),
      helper: 'Total confirmed amount',
      href: '/admin/manual-payment-submissions?status=APPROVED',
      status: 'APPROVED' as SubmissionStatus,
      icon: <Wallet className="h-4 w-4" />,
    },
  ];

  const filteredSubmissions = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    return submissions.filter((submission) => {
      const submissionStatus = normalizeStatus(submission.status);

      if (statusFilter !== 'ALL' && submissionStatus !== statusFilter) {
        return false;
      }

      if (!search) return true;

      const haystack = [
        submission.transaction_reference,
        submission.sender_name,
        submission.sender_phone,
        submission.sender_network,
        submission.status,
        submission.customer?.full_name,
        submission.customer?.phone,
        submission.agent?.full_name,
        submission.agent?.phone,
        submission.submitted_by_profile?.full_name,
        submission.fund_space?.name,
        submission.round?.round_number
          ? `round ${submission.round.round_number}`
          : '',
        submission.company_account?.account_name,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(search);
    });
  }, [searchTerm, statusFilter, submissions]);

  const loadSubmissions = useCallback(async (showRefresh = false) => {
    try {
      if (showRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setErrorMessage('');
      setSuccessMessage('');

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.access_token) {
        throw new Error('Your session has expired. Please log in again.');
      }

      const response = await fetch('/api/admin/manual-payment-submissions', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const result = await readApiResponse(response);

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || 'Unable to load manual payment submissions.'
        );
      }

      setSubmissions(result.submissions || []);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to load manual payment submissions.'
      );
      setSubmissions([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadSubmissions();
  }, [loadSubmissions]);

  async function runAction({
    submissionId,
    action,
    rejectionReasonValue,
  }: {
    submissionId: string;
    action: 'APPROVE' | 'REJECT';
    rejectionReasonValue?: string;
  }) {
    try {
      setActionLoading(`${action}-${submissionId}`);
      setErrorMessage('');
      setSuccessMessage('');

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.access_token) {
        throw new Error('Your session has expired. Please log in again.');
      }

      const response = await fetch('/api/admin/manual-payment-submissions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          submission_id: submissionId,
          action,
          rejection_reason: rejectionReasonValue || '',
        }),
      });

      const result = await readApiResponse(response);

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || 'Unable to review manual payment submission.'
        );
      }

      setSuccessMessage(result.message || 'Manual payment reviewed successfully.');
      setRejectingSubmission(null);
      setRejectionReason('');
      setSelectedSubmission(null);

      await loadSubmissions(true);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to review manual payment submission.'
      );
    } finally {
      setActionLoading('');
    }
  }

  async function handleApprove(submission: ManualPaymentSubmission) {
    const timing = getPaymentTimingStatus(submission);

    const confirmed = window.confirm(
      `Approve this MoMo payment?\n\nPayment timing: ${timing.label}\nActual payment: ${formatDateTime(
        submission.actual_payment_at
      )}\nDeadline: ${formatDate(submission.round?.contribution_deadline)}`
    );

    if (!confirmed) return;

    await runAction({
      submissionId: submission.id,
      action: 'APPROVE',
    });
  }

  async function handleReject() {
    if (!rejectingSubmission) return;

    if (!rejectionReason.trim()) {
      setErrorMessage('Please enter a rejection reason.');
      return;
    }

    await runAction({
      submissionId: rejectingSubmission.id,
      action: 'REJECT',
      rejectionReasonValue: rejectionReason.trim(),
    });
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-6 md:px-8">
        <div className="mx-auto flex min-h-[60vh] max-w-7xl items-center justify-center">
          <div className="text-center">
            <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-emerald-700" />
            <h1 className="text-lg font-black text-slate-900">
              Loading MoMo payment submissions...
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Please wait while TrustPoint loads all manual payment records.
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
            href="/admin"
            className="inline-flex min-h-11 w-fit items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-100"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Admin Control Center
          </Link>

          <button
            type="button"
            onClick={() => loadSubmissions(true)}
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
                <p className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-xs font-black">
                  <Smartphone className="h-4 w-4" />
                  Admin MoMo Verification
                </p>

                <h1 className="mt-5 text-3xl font-black tracking-tight md:text-5xl">
                  Manual MoMo Payment Review
                </h1>

                <p className="mt-4 max-w-3xl text-sm font-semibold leading-7 text-emerald-50 md:text-base">
                  Review customer and agent MoMo payment references. Approved,
                  rejected, and pending records are all kept here for clear admin
                  tracking.
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
                  href="/admin/fund-space/contributions"
                  className="inline-flex min-h-9 items-center justify-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 text-xs font-black text-white ring-1 ring-white/10 transition hover:bg-white/20"
                >
                  Contributions
                </Link>

                <button
                  type="button"
                  onClick={() => loadSubmissions(true)}
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

            <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {statCards.map((item) => (
                <StatCard
                  key={item.title}
                  item={item}
                  active={statusFilter === item.status}
                />
              ))}
            </div>
          </div>
        </section>

        {successMessage && <MessageBox type="success" message={successMessage} />}
        {errorMessage && <MessageBox type="error" message={errorMessage} />}

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search reference, sender, phone, customer, agent, Fund Space..."
                className="min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm font-semibold outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {statusTabs.map((tab) => (
                <Link
                  key={tab.value}
                  href={tab.href}
                  className={`min-h-11 rounded-2xl px-4 py-3 text-xs font-black transition ${
                    statusFilter === tab.value
                      ? 'bg-emerald-700 text-white'
                      : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {tab.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-600">
            Showing {filteredSubmissions.length} of {submissions.length} records.
            Pending value: {formatCurrency(stats.total_pending_value)}. Approved
            value: {formatCurrency(stats.total_approved_value)}.
          </div>
        </section>

        <section className="space-y-5">
          {filteredSubmissions.length === 0 ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
              <Smartphone className="mx-auto mb-3 h-12 w-12 text-slate-300" />
              <h2 className="text-lg font-black text-slate-900">
                No MoMo submissions found
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                Try changing the filter or refreshing the page.
              </p>
            </div>
          ) : (
            filteredSubmissions.map((submission) => {
              const timing = getPaymentTimingStatus(submission);
              const reviewState = getReviewState(submission);
              const status = normalizeStatus(submission.status);
              const isPending = status === 'PENDING_REVIEW';
              const approveLoading = actionLoading === `APPROVE-${submission.id}`;
              const rejectLoading = actionLoading === `REJECT-${submission.id}`;

              return (
                <article
                  key={submission.id}
                  className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-emerald-200 hover:shadow-md md:p-6"
                >
                  <div className="grid gap-5 xl:grid-cols-[1fr_280px]">
                    <div className="min-w-0">
                      <div className="flex flex-wrap gap-2">
                        <StatusPill status={submission.status} />
                        <span
                          className={`inline-flex w-fit items-center rounded-full border px-3 py-1 text-xs font-black ${timing.className}`}
                        >
                          {timing.label}
                        </span>
                      </div>

                      <div className="mt-5 grid gap-5 lg:grid-cols-2">
                        <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-5">
                          <p className="mb-2 inline-flex items-center gap-2 text-xs font-black uppercase tracking-wide text-emerald-700">
                            <UserRound className="h-4 w-4" />
                            Member / Sender
                          </p>

                          <h2 className="break-words text-xl font-black text-slate-900">
                            {submission.customer?.full_name || 'Unknown member'}
                          </h2>

                          <p className="mt-1 break-words text-sm font-semibold text-slate-600">
                            {submission.customer?.phone || 'No member phone'} •
                            Sender: {submission.sender_name || 'Not provided'}
                          </p>

                          <div className="mt-4 grid gap-3 sm:grid-cols-2">
                            <InfoBox
                              label="Sender Phone"
                              value={submission.sender_phone}
                            />
                            <InfoBox
                              label="Network"
                              value={formatLabel(submission.sender_network)}
                            />
                            <InfoBox
                              label="Payer Type"
                              value={formatLabel(submission.payer_type)}
                            />
                            <InfoBox
                              label="Relationship"
                              value={submission.payer_relationship}
                            />
                          </div>
                        </div>

                        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                          <p className="mb-2 inline-flex items-center gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
                            <TimerReset className="h-4 w-4" />
                            Payment Timing
                          </p>

                          <div className="grid gap-3 sm:grid-cols-2">
                            <InfoBox
                              label="Actual Payment Date"
                              value={formatDate(submission.actual_payment_date)}
                            />
                            <InfoBox
                              label="Actual Payment Time"
                              value={submission.actual_payment_time || 'Not set'}
                            />
                            <InfoBox
                              label="Actual Payment At"
                              value={formatDateTime(submission.actual_payment_at)}
                            />
                            <InfoBox
                              label="Deadline"
                              value={formatDate(
                                submission.round?.contribution_deadline
                              )}
                            />
                          </div>

                          <p className="mt-4 rounded-2xl bg-white p-3 text-xs font-bold leading-5 text-slate-600">
                            {timing.description}
                          </p>
                        </div>
                      </div>

                      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        <InfoBox
                          label="Fund Space"
                          value={submission.fund_space?.name || 'Not set'}
                        />
                        <InfoBox
                          label="Round"
                          value={
                            submission.round?.round_number
                              ? `Round ${submission.round.round_number}`
                              : 'Not set'
                          }
                        />
                        <InfoBox
                          label="Round Status"
                          value={formatLabel(submission.round?.status)}
                        />
                        <InfoBox
                          label="Amount Due"
                          value={formatCurrency(submission.amount_due)}
                        />
                        <InfoBox
                          label="Total Paid"
                          value={formatCurrency(submission.total_amount_paid)}
                        />
                        <InfoBox
                          label="Service Fee"
                          value={formatCurrency(submission.service_fee)}
                        />
                        <InfoBox
                          label="Reference"
                          value={submission.transaction_reference}
                        />
                        <InfoBox
                          label="Agent"
                          value={submission.agent?.full_name || 'No agent'}
                        />
                      </div>

                      {submission.payment_note && (
                        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <p className="text-xs font-black uppercase tracking-wide text-slate-400">
                            Payment Note
                          </p>
                          <p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-6 text-slate-700">
                            {submission.payment_note}
                          </p>
                        </div>
                      )}

                      {submission.rejection_reason && (
                        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4">
                          <p className="text-xs font-black uppercase tracking-wide text-red-500">
                            Rejection Reason
                          </p>
                          <p className="mt-2 text-sm font-semibold leading-6 text-red-700">
                            {submission.rejection_reason}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                      <p className="mb-4 text-sm font-black text-slate-900">
                        Review Actions
                      </p>

                      <div
                        className={`mb-4 rounded-2xl border p-4 ${getReviewBoxClass(
                          reviewState.tone
                        )}`}
                      >
                        <p className="text-sm font-black">{reviewState.label}</p>
                        <p className="mt-1 text-xs font-semibold leading-5">
                          {reviewState.description}
                        </p>
                      </div>

                      <div className="grid gap-3">
                        <button
                          type="button"
                          onClick={() => setSelectedSubmission(submission)}
                          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 hover:bg-slate-50"
                        >
                          <Eye className="h-4 w-4" />
                          View Details
                        </button>

                        {submission.fund_space_id && (
                          <Link
                            href={`/admin/fund-space/${submission.fund_space_id}`}
                            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 hover:bg-slate-50"
                          >
                            Fund Space
                            <ArrowRight className="h-4 w-4" />
                          </Link>
                        )}

                        {submission.fund_space_id && (
                          <Link
                            href={`/admin/fund-space/contributions?fund_space_id=${submission.fund_space_id}`}
                            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 hover:bg-slate-50"
                          >
                            Contributions
                            <ArrowRight className="h-4 w-4" />
                          </Link>
                        )}

                        <button
                          type="button"
                          disabled={!isPending || Boolean(actionLoading)}
                          onClick={() => handleApprove(submission)}
                          className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-black transition disabled:cursor-not-allowed ${
                            status === 'APPROVED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : status === 'PENDING_REVIEW'
                                ? 'bg-emerald-700 text-white hover:bg-emerald-800 disabled:opacity-60'
                                : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          {approveLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4" />
                          )}
                          {getApproveButtonText(status, approveLoading)}
                        </button>

                        <button
                          type="button"
                          disabled={!isPending || Boolean(actionLoading)}
                          onClick={() => {
                            setRejectingSubmission(submission);
                            setRejectionReason('');
                          }}
                          className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border px-4 text-sm font-black transition disabled:cursor-not-allowed ${
                            status === 'REJECTED'
                              ? 'border-red-200 bg-red-100 text-red-800'
                              : status === 'PENDING_REVIEW'
                                ? 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-60'
                                : 'border-slate-200 bg-slate-200 text-slate-600'
                          }`}
                        >
                          {rejectLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <XCircle className="h-4 w-4" />
                          )}
                          {getRejectButtonText(status, rejectLoading)}
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </section>
      </div>

      {selectedSubmission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-3 py-4">
          <div className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="text-lg font-black text-slate-900">
                  MoMo Submission Details
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Reference: {selectedSubmission.transaction_reference}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedSubmission(null)}
                className="rounded-2xl p-2 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <InfoBox
                  label="Status"
                  value={formatLabel(selectedSubmission.status)}
                />
                <InfoBox
                  label="Customer"
                  value={selectedSubmission.customer?.full_name}
                />
                <InfoBox
                  label="Customer Phone"
                  value={selectedSubmission.customer?.phone}
                />
                <InfoBox
                  label="Sender Name"
                  value={selectedSubmission.sender_name}
                />
                <InfoBox
                  label="Sender Phone"
                  value={selectedSubmission.sender_phone}
                />
                <InfoBox
                  label="Network"
                  value={formatLabel(selectedSubmission.sender_network)}
                />
                <InfoBox
                  label="Reference"
                  value={selectedSubmission.transaction_reference}
                />
                <InfoBox
                  label="Actual Payment Date"
                  value={formatDate(selectedSubmission.actual_payment_date)}
                />
                <InfoBox
                  label="Actual Payment Time"
                  value={selectedSubmission.actual_payment_time || 'Not set'}
                />
                <InfoBox
                  label="Actual Payment At"
                  value={formatDateTime(selectedSubmission.actual_payment_at)}
                />
                <InfoBox
                  label="Deadline"
                  value={formatDate(
                    selectedSubmission.round?.contribution_deadline
                  )}
                />
                <InfoBox
                  label="Submitted At"
                  value={formatDateTime(selectedSubmission.created_at)}
                />
                <InfoBox
                  label="Reviewed At"
                  value={formatDateTime(selectedSubmission.reviewed_at)}
                />
                <InfoBox
                  label="Reviewed By"
                  value={
                    selectedSubmission.reviewed_by_profile?.full_name ||
                    selectedSubmission.reviewed_by
                  }
                />
                <InfoBox
                  label="Amount Due"
                  value={formatCurrency(selectedSubmission.amount_due)}
                />
                <InfoBox
                  label="Total Paid"
                  value={formatCurrency(selectedSubmission.total_amount_paid)}
                />
                <InfoBox
                  label="Service Fee"
                  value={formatCurrency(selectedSubmission.service_fee)}
                />
                <InfoBox
                  label="Agent"
                  value={selectedSubmission.agent?.full_name || 'No agent'}
                />
                <InfoBox
                  label="Fund Space"
                  value={selectedSubmission.fund_space?.name || 'Not set'}
                />
                <InfoBox
                  label="Round"
                  value={
                    selectedSubmission.round?.round_number
                      ? `Round ${selectedSubmission.round.round_number}`
                      : 'Not set'
                  }
                />
              </div>

              {selectedSubmission.payment_note && (
                <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-black uppercase tracking-wide text-slate-400">
                    Payment Note
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-6 text-slate-700">
                    {selectedSubmission.payment_note}
                  </p>
                </div>
              )}

              {selectedSubmission.rejection_reason && (
                <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4">
                  <p className="text-xs font-black uppercase tracking-wide text-red-500">
                    Rejection Reason
                  </p>
                  <p className="mt-2 text-sm font-semibold leading-6 text-red-700">
                    {selectedSubmission.rejection_reason}
                  </p>
                </div>
              )}

              {selectedSubmission.screenshot_url && (
                <a
                  href={selectedSubmission.screenshot_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-5 inline-flex min-h-11 items-center justify-center rounded-2xl bg-emerald-700 px-4 text-sm font-black text-white hover:bg-emerald-800"
                >
                  Open Screenshot
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {rejectingSubmission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-3 py-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-black text-slate-900">
                  Reject MoMo Payment
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Give a clear reason so the member or agent understands what to
                  correct.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setRejectingSubmission(null);
                  setRejectionReason('');
                }}
                className="rounded-2xl p-2 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <textarea
              value={rejectionReason}
              onChange={(event) => setRejectionReason(event.target.value)}
              rows={5}
              placeholder="Example: Transaction reference does not match the screenshot."
              className="mt-5 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-100"
            />

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => {
                  setRejectingSubmission(null);
                  setRejectionReason('');
                }}
                className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleReject}
                disabled={Boolean(actionLoading)}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-red-600 px-4 text-sm font-black text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {actionLoading === `REJECT-${rejectingSubmission.id}` ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                Reject Payment
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}