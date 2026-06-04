'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Eye,
  FileCheck2,
  Info,
  Loader2,
  RefreshCw,
  Search,
  ShieldAlert,
  Smartphone,
  UserRound,
  UsersRound,
  Wallet,
  XCircle,
} from 'lucide-react';

import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

type SubmissionStatus = 'ALL' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED';

type ApiSummary = {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  total_amount: number;
};

type ProfileLite = {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
};

type FundSpaceLite = {
  id: string;
  name: string | null;
  contribution_amount: number | null;
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
  amount_due: number;
  approved_contribution_transaction_id?: string | null;
  company_payment_account_id: string | null;
  contribution_id: string;
  created_at: string;
  fund_space_id: string;
  metadata?: unknown;
  payer_relationship: string | null;
  payer_type: string;
  payment_note: string | null;
  rejection_reason: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  round_id: string;
  screenshot_url: string | null;
  sender_name: string | null;
  sender_network: string | null;
  sender_phone: string | null;
  service_fee: number;
  status: string;
  submitted_by: string | null;
  submitted_by_role: string | null;
  total_amount_paid: number;
  transaction_reference: string;
  updated_at: string;
  user_id: string;

  customer?: ProfileLite | null;
  agent?: ProfileLite | null;
  fund_space?: FundSpaceLite | null;
  round?: RoundLite | null;
  company_account?: CompanyAccountLite | null;
};

type ApiResponse = {
  success: boolean;
  message?: string;
  summary?: ApiSummary;
  submissions?: ManualPaymentSubmission[];
};

const defaultSummary: ApiSummary = {
  total: 0,
  pending: 0,
  approved: 0,
  rejected: 0,
  total_amount: 0,
};

function formatCurrency(amount: number | string | null | undefined) {
  return `GH₵${Number(amount || 0).toLocaleString('en-GH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return 'Not set';

  const date = new Date(value);

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

function formatDate(value: string | null | undefined) {
  if (!value) return 'Not set';

  const date = new Date(value);

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

function normalizeStatus(value: string | null | undefined) {
  return String(value || '').toUpperCase();
}

function getStatusStyle(status: string | null | undefined) {
  const value = normalizeStatus(status);

  if (value === 'APPROVED' || value === 'CONFIRMED' || value === 'PAID') {
    return 'border-emerald-100 bg-emerald-50 text-emerald-700';
  }

  if (value === 'PENDING_REVIEW' || value === 'PENDING') {
    return 'border-amber-100 bg-amber-50 text-amber-700';
  }

  if (value === 'REJECTED' || value === 'FAILED') {
    return 'border-red-100 bg-red-50 text-red-700';
  }

  return 'border-gray-100 bg-gray-50 text-gray-700';
}

function getPayerTypeDescription(submission: ManualPaymentSubmission) {
  const payerType = normalizeStatus(submission.payer_type);

  if (payerType === 'CUSTOMER_SELF') {
    return 'The registered member says they paid with their own MoMo account.';
  }

  if (payerType === 'THIRD_PARTY') {
    return `Someone else paid for the member${
      submission.payer_relationship
        ? ` (${submission.payer_relationship})`
        : ''
    }.`;
  }

  if (payerType === 'AGENT_ASSISTED') {
    return `An agent assisted this member${
      submission.payer_relationship
        ? ` (${submission.payer_relationship})`
        : ''
    }.`;
  }

  return 'Payer type was not clearly provided.';
}

function getExpectedTotal(submission: ManualPaymentSubmission) {
  return Number(submission.amount_due || 0) + Number(submission.service_fee || 0);
}

function getAmountWarning(submission: ManualPaymentSubmission) {
  const expected = getExpectedTotal(submission);
  const paid = Number(submission.total_amount_paid || 0);

  if (paid < expected) {
    return {
      type: 'LOW',
      message: `Submitted amount is below expected total. Expected ${formatCurrency(
        expected
      )}, submitted ${formatCurrency(paid)}.`,
    };
  }

  if (paid > expected) {
    return {
      type: 'HIGH',
      message: `Submitted amount is above expected total. Expected ${formatCurrency(
        expected
      )}, submitted ${formatCurrency(paid)}.`,
    };
  }

  return null;
}

function isWeakReference(reference: string | null | undefined) {
  const value = String(reference || '').trim();

  return value.length < 6;
}

function getUsefulHref(submission: ManualPaymentSubmission) {
  if (submission.fund_space_id) {
    return `/admin/fund-space/contributions?search=${encodeURIComponent(
      submission.transaction_reference || submission.contribution_id
    )}`;
  }

  return '/admin/fund-space/contributions';
}

function StatCard({
  title,
  value,
  description,
  icon,
  active,
  onClick,
}: {
  title: string;
  value: string | number;
  description: string;
  icon: ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group rounded-3xl border p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md md:p-6 ${
        active
          ? 'border-emerald-200 bg-emerald-50'
          : 'border-gray-100 bg-white hover:border-emerald-200'
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-gray-500">{title}</p>
          <h3 className="mt-2 text-2xl font-black text-gray-900 md:text-3xl">
            {value}
          </h3>
          <p className="mt-1 text-sm leading-6 text-gray-500">{description}</p>
          <p className="mt-3 inline-flex items-center gap-1 text-xs font-black text-emerald-700 opacity-0 transition group-hover:opacity-100">
            Open filtered records <ArrowRight className="h-3.5 w-3.5" />
          </p>
        </div>

        <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-700 transition group-hover:bg-emerald-600 group-hover:text-white">
          {icon}
        </div>
      </div>
    </button>
  );
}

export default function AdminManualPaymentSubmissionsPage() {
  const { profile, loading: authLoading } = useAuth();

  const [submissions, setSubmissions] = useState<ManualPaymentSubmission[]>([]);
  const [summary, setSummary] = useState<ApiSummary>(defaultSummary);
  const [statusFilter, setStatusFilter] = useState<SubmissionStatus>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [rejectionReasons, setRejectionReasons] = useState<Record<string, string>>(
    {}
  );

  const [pageLoading, setPageLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const [message, setMessage] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

  const getToken = async () => {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error || !session?.access_token) {
      throw new Error('Your session has expired. Please log in again.');
    }

    return session.access_token;
  };

  const loadSubmissions = useCallback(
    async (showRefreshState = false) => {
      try {
        if (showRefreshState) {
          setRefreshing(true);
        } else {
          setPageLoading(true);
        }

        setMessage(null);

        const token = await getToken();

        const params = new URLSearchParams();
        params.set('status', statusFilter);

        if (searchTerm.trim()) {
          params.set('search', searchTerm.trim());
        }

        const response = await fetch(
          `/api/admin/manual-payment-submissions?${params.toString()}`,
          {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const result = (await response.json()) as ApiResponse;

        if (!response.ok || !result.success) {
          throw new Error(
            result.message || 'Unable to load manual payment submissions.'
          );
        }

        setSubmissions(result.submissions || []);
        setSummary(result.summary || defaultSummary);
      } catch (error) {
        setSubmissions([]);
        setSummary(defaultSummary);
        setMessage({
          type: 'error',
          text:
            error instanceof Error
              ? error.message
              : 'Something went wrong while loading manual payment submissions.',
        });
      } finally {
        setPageLoading(false);
        setRefreshing(false);
      }
    },
    [statusFilter, searchTerm]
  );

  useEffect(() => {
    if (authLoading) return;

    loadSubmissions();
  }, [authLoading, loadSubmissions]);

  const filteredSubmissions = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    return submissions.filter((submission) => {
      if (statusFilter !== 'ALL' && submission.status !== statusFilter) {
        return false;
      }

      if (!search) return true;

      const values = [
        submission.transaction_reference,
        submission.sender_name,
        submission.sender_phone,
        submission.sender_network,
        submission.status,
        submission.payer_type,
        submission.payer_relationship,
        submission.payment_note,
        submission.customer?.full_name,
        submission.customer?.phone,
        submission.customer?.email,
        submission.agent?.full_name,
        submission.agent?.phone,
        submission.fund_space?.name,
        submission.company_account?.merchant_number,
        submission.company_account?.merchant_id,
      ];

      return values.some((value) =>
        String(value || '').toLowerCase().includes(search)
      );
    });
  }, [submissions, statusFilter, searchTerm]);

  const liveSummary = useMemo(() => {
    return filteredSubmissions.reduce(
      (acc, item) => {
        acc.total += 1;
        acc.total_amount += Number(item.total_amount_paid || 0);

        if (item.status === 'PENDING_REVIEW') acc.pending += 1;
        if (item.status === 'APPROVED') acc.approved += 1;
        if (item.status === 'REJECTED') acc.rejected += 1;

        return acc;
      },
      {
        total: 0,
        pending: 0,
        approved: 0,
        rejected: 0,
        total_amount: 0,
      }
    );
  }, [filteredSubmissions]);

  const approveSubmission = async (submission: ManualPaymentSubmission) => {
    try {
      setActionLoadingId(submission.id);
      setMessage(null);

      if (submission.user_id === profile?.id) {
        throw new Error(
          'You cannot approve your own Fund Space payment. Another admin or super admin must verify it.'
        );
      }

      const token = await getToken();

      const response = await fetch('/api/admin/manual-payment-submissions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          submission_id: submission.id,
          action: 'APPROVE',
        }),
      });

      const result = (await response.json()) as ApiResponse;

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Unable to approve payment submission.');
      }

      setMessage({
        type: 'success',
        text: result.message || 'Payment submission approved successfully.',
      });

      await loadSubmissions(true);
    } catch (error) {
      setMessage({
        type: 'error',
        text:
          error instanceof Error
            ? error.message
            : 'Something went wrong while approving this payment.',
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  const rejectSubmission = async (submission: ManualPaymentSubmission) => {
    try {
      setActionLoadingId(submission.id);
      setMessage(null);

      if (submission.user_id === profile?.id) {
        throw new Error(
          'You cannot reject your own Fund Space payment. Another admin or super admin must verify it.'
        );
      }

      const reason = String(rejectionReasons[submission.id] || '').trim();

      if (!reason) {
        throw new Error('Please enter a clear rejection reason before rejecting.');
      }

      const token = await getToken();

      const response = await fetch('/api/admin/manual-payment-submissions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          submission_id: submission.id,
          action: 'REJECT',
          rejection_reason: reason,
        }),
      });

      const result = (await response.json()) as ApiResponse;

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Unable to reject payment submission.');
      }

      setMessage({
        type: 'success',
        text: result.message || 'Payment submission rejected successfully.',
      });

      setRejectionReasons((current) => ({
        ...current,
        [submission.id]: '',
      }));

      await loadSubmissions(true);
    } catch (error) {
      setMessage({
        type: 'error',
        text:
          error instanceof Error
            ? error.message
            : 'Something went wrong while rejecting this payment.',
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  if (authLoading || pageLoading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-4">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-emerald-600" />
          <p className="text-sm font-semibold text-gray-500">
            Loading manual MoMo submissions...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="rounded-3xl bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-600 p-6 text-white shadow-sm md:p-8">
        <div className="flex flex-col justify-between gap-6 xl:flex-row xl:items-center">
          <div className="max-w-4xl">
            <p className="mb-3 inline-flex rounded-full bg-white/15 px-4 py-1 text-sm font-semibold">
              Admin MoMo Verification
            </p>

            <h1 className="text-3xl font-black md:text-4xl">
              Manual MoMo payment submissions
            </h1>

            <p className="mt-4 max-w-3xl text-sm leading-7 text-emerald-50 md:text-base">
              Review customer, agent-assisted, third-party, admin, and super
              admin Fund Space payment references. Verify every transaction
              against the TrustPoint merchant MoMo statement before approval.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/admin/fund-space/contributions"
                className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-emerald-700 hover:bg-emerald-50"
              >
                Weekly Contributions
                <ArrowRight className="h-4 w-4" />
              </Link>

              <Link
                href="/admin/transactions"
                className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-5 py-3 text-sm font-bold text-white ring-1 ring-white/20 hover:bg-white/20"
              >
                Admin Transactions
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <button
            type="button"
            onClick={() => loadSubmissions(true)}
            disabled={refreshing}
            className="inline-flex min-h-12 w-fit items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw
              className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`}
            />
            Refresh
          </button>
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
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
          ) : message.type === 'info' ? (
            <Info className="mt-0.5 h-5 w-5 shrink-0" />
          ) : (
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          )}

          <p>{message.text}</p>
        </div>
      )}

      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-5">
        <StatCard
          title="Total Submissions"
          value={summary.total}
          description="All MoMo records loaded"
          icon={<Smartphone className="h-5 w-5" />}
          active={statusFilter === 'ALL'}
          onClick={() => setStatusFilter('ALL')}
        />

        <StatCard
          title="Awaiting Review"
          value={summary.pending}
          description="Needs admin confirmation"
          icon={<Clock className="h-5 w-5" />}
          active={statusFilter === 'PENDING_REVIEW'}
          onClick={() => setStatusFilter('PENDING_REVIEW')}
        />

        <StatCard
          title="Approved"
          value={summary.approved}
          description="Confirmed contributions"
          icon={<CheckCircle2 className="h-5 w-5" />}
          active={statusFilter === 'APPROVED'}
          onClick={() => setStatusFilter('APPROVED')}
        />

        <StatCard
          title="Rejected"
          value={summary.rejected}
          description="Returned for correction"
          icon={<XCircle className="h-5 w-5" />}
          active={statusFilter === 'REJECTED'}
          onClick={() => setStatusFilter('REJECTED')}
        />

        <StatCard
          title="Total Submitted"
          value={formatCurrency(summary.total_amount)}
          description="Amount from filtered API result"
          icon={<Wallet className="h-5 w-5" />}
          active={false}
          onClick={() => setStatusFilter('ALL')}
        />
      </section>

      <div className="rounded-3xl border border-amber-100 bg-amber-50 p-5 md:p-6">
        <div className="flex gap-3">
          <ShieldAlert className="mt-1 h-5 w-5 shrink-0 text-amber-700" />

          <div>
            <h2 className="text-lg font-black text-amber-900">
              Verification rule
            </h2>

            <p className="mt-2 text-sm leading-6 text-amber-800">
              Different sender phone is not automatic fraud. It may be a valid
              third-party or agent-assisted payment. Confirm the amount,
              transaction reference, sender details, and merchant account record
              before approving. Admins and super admins cannot approve or reject
              their own Fund Space contribution payment on this page.
            </p>
          </div>
        </div>
      </div>

      <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="text-xl font-black text-gray-900">
              Submission Records
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Showing {filteredSubmissions.length} record
              {filteredSubmissions.length === 1 ? '' : 's'}. Live filtered
              value: {formatCurrency(liveSummary.total_amount)}.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:min-w-[640px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />

              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    loadSubmissions(true);
                  }
                }}
                placeholder="Search reference, customer, phone, agent..."
                className="min-h-12 w-full rounded-xl border border-gray-200 py-3 pl-10 pr-4 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as SubmissionStatus)
              }
              className="min-h-12 rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            >
              <option value="ALL">All Statuses</option>
              <option value="PENDING_REVIEW">Awaiting Review</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {(
            [
              ['ALL', 'All'],
              ['PENDING_REVIEW', 'Awaiting Review'],
              ['APPROVED', 'Approved'],
              ['REJECTED', 'Rejected'],
            ] as [SubmissionStatus, string][]
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setStatusFilter(value)}
              className={`rounded-xl px-4 py-2.5 text-sm font-black transition ${
                statusFilter === value
                  ? 'bg-emerald-600 text-white shadow-sm hover:bg-emerald-700'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {label}
            </button>
          ))}

          <button
            type="button"
            onClick={() => loadSubmissions(true)}
            className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-black text-gray-700 transition hover:bg-gray-50"
          >
            Apply Search
          </button>

          <button
            type="button"
            onClick={() => {
              setSearchTerm('');
              setStatusFilter('ALL');
            }}
            className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-black text-gray-700 transition hover:bg-gray-50"
          >
            Clear Filters
          </button>
        </div>
      </section>

      <section className="rounded-3xl border border-gray-100 bg-white shadow-sm">
        {filteredSubmissions.length === 0 ? (
          <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 p-8 text-center">
            <Smartphone className="h-10 w-10 text-gray-300" />
            <h2 className="text-lg font-black text-gray-900">
              No manual MoMo submissions found
            </h2>
            <p className="max-w-md text-sm leading-6 text-gray-500">
              Try another status or search term. New customer, agent, admin, or
              super admin MoMo payment references will appear here after
              submission.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredSubmissions.map((submission) => {
              const isPending = submission.status === 'PENDING_REVIEW';
              const isOwnPayment = submission.user_id === profile?.id;
              const canReview = isPending && !isOwnPayment;
              const amountWarning = getAmountWarning(submission);
              const weakReference = isWeakReference(
                submission.transaction_reference
              );
              const phoneDiffers =
                submission.sender_phone &&
                submission.customer?.phone &&
                submission.sender_phone !== submission.customer.phone;

              return (
                <div key={submission.id} className="p-5 md:p-6">
                  <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-xl font-black text-gray-900">
                          {submission.customer?.full_name || 'Unknown customer'}
                        </h3>

                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-black ${getStatusStyle(
                            submission.status
                          )}`}
                        >
                          {formatLabel(submission.status)}
                        </span>

                        <span className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">
                          {formatLabel(submission.payer_type)}
                        </span>

                        {isOwnPayment && (
                          <span className="rounded-full border border-amber-100 bg-amber-50 px-3 py-1 text-xs font-black text-amber-700">
                            Own Admin Payment
                          </span>
                        )}
                      </div>

                      <p className="mt-2 text-sm leading-6 text-gray-600">
                        {getPayerTypeDescription(submission)}
                      </p>

                      <div className="mt-4 grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-4">
                        <div className="rounded-2xl bg-gray-50 p-4">
                          <p className="text-xs font-bold uppercase text-gray-400">
                            Amount Due
                          </p>
                          <p className="mt-1 text-lg font-black text-gray-900">
                            {formatCurrency(submission.amount_due)}
                          </p>
                          <p className="text-xs text-gray-500">
                            Service fee: {formatCurrency(submission.service_fee)}
                          </p>
                        </div>

                        <div className="rounded-2xl bg-gray-50 p-4">
                          <p className="text-xs font-bold uppercase text-gray-400">
                            Total Submitted
                          </p>
                          <p className="mt-1 text-lg font-black text-gray-900">
                            {formatCurrency(submission.total_amount_paid)}
                          </p>
                          <p className="text-xs text-gray-500">
                            Expected: {formatCurrency(getExpectedTotal(submission))}
                          </p>
                        </div>

                        <div className="rounded-2xl bg-gray-50 p-4">
                          <p className="text-xs font-bold uppercase text-gray-400">
                            Transaction Reference
                          </p>
                          <p className="mt-1 break-all font-black text-gray-900">
                            {submission.transaction_reference || 'Not provided'}
                          </p>
                          <p className="text-xs text-gray-500">
                            Submitted: {formatDateTime(submission.created_at)}
                          </p>
                        </div>

                        <div className="rounded-2xl bg-gray-50 p-4">
                          <p className="text-xs font-bold uppercase text-gray-400">
                            Sender
                          </p>
                          <p className="mt-1 font-black text-gray-900">
                            {submission.sender_name || 'Not provided'}
                          </p>
                          <p className="text-xs text-gray-500">
                            {submission.sender_phone || 'No phone'} ·{' '}
                            {formatLabel(submission.sender_network)}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 text-sm lg:grid-cols-3">
                        <div className="rounded-2xl bg-gray-50 p-4">
                          <p>
                            <span className="font-black text-gray-800">
                              Customer Phone:
                            </span>{' '}
                            {submission.customer?.phone || 'Not provided'}
                          </p>
                          <p className="mt-1">
                            <span className="font-black text-gray-800">
                              Customer Email:
                            </span>{' '}
                            {submission.customer?.email || 'Not provided'}
                          </p>
                        </div>

                        <div className="rounded-2xl bg-gray-50 p-4">
                          <p>
                            <span className="font-black text-gray-800">
                              Agent:
                            </span>{' '}
                            {submission.agent?.full_name || 'Not assigned'}
                          </p>
                          <p className="mt-1">
                            <span className="font-black text-gray-800">
                              Agent Phone:
                            </span>{' '}
                            {submission.agent?.phone || 'Not available'}
                          </p>
                        </div>

                        <div className="rounded-2xl bg-gray-50 p-4">
                          <p>
                            <span className="font-black text-gray-800">
                              Fund Space:
                            </span>{' '}
                            {submission.fund_space?.name || 'Not available'}
                          </p>
                          <p className="mt-1">
                            <span className="font-black text-gray-800">
                              Round:
                            </span>{' '}
                            {submission.round?.round_number || 'N/A'} · Deadline:{' '}
                            {formatDate(submission.round?.contribution_deadline)}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 rounded-2xl border border-gray-100 bg-gray-50 p-4 text-sm">
                        <p className="font-black text-gray-900">
                          Merchant account to verify against
                        </p>
                        <p className="mt-2 leading-6 text-gray-600">
                          {submission.company_account?.account_name ||
                            'Merchant account not linked'}{' '}
                          · {formatLabel(submission.company_account?.network)} ·{' '}
                          {submission.company_account?.merchant_number ||
                            'No merchant number'}
                          {submission.company_account?.merchant_id
                            ? ` · Merchant ID: ${submission.company_account.merchant_id}`
                            : ''}
                        </p>
                      </div>

                      {submission.payment_note && (
                        <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-700">
                          <p className="font-black">Payment note</p>
                          <p className="mt-1 leading-6">{submission.payment_note}</p>
                        </div>
                      )}

                      {submission.rejection_reason && (
                        <div className="mt-4 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
                          <p className="font-black">Rejection reason</p>
                          <p className="mt-1 leading-6">
                            {submission.rejection_reason}
                          </p>
                        </div>
                      )}

                      <div className="mt-4 grid gap-3">
                        {isOwnPayment && isPending && (
                          <div className="flex gap-3 rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm font-semibold text-amber-700">
                            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
                            <p>
                              You cannot approve or reject your own Fund Space
                              payment. Another admin or super admin must verify
                              this payment.
                            </p>
                          </div>
                        )}

                        {amountWarning && (
                          <div className="flex gap-3 rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm font-semibold text-amber-700">
                            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                            <p>{amountWarning.message}</p>
                          </div>
                        )}

                        {phoneDiffers && (
                          <div className="flex gap-3 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm font-semibold text-blue-700">
                            <Info className="mt-0.5 h-5 w-5 shrink-0" />
                            <p>
                              Sender phone differs from customer phone. This may
                              be valid for third-party or agent-assisted payment.
                              Confirm carefully from the merchant MoMo statement.
                            </p>
                          </div>
                        )}

                        {weakReference && (
                          <div className="flex gap-3 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-700">
                            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                            <p>
                              Transaction reference looks weak or incomplete.
                              Confirm it carefully before approval.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="w-full rounded-3xl border border-gray-100 bg-gray-50 p-5 xl:w-[390px]">
                      <div className="flex items-center gap-3">
                        <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-700">
                          <FileCheck2 className="h-5 w-5" />
                        </div>

                        <div>
                          <p className="font-black text-gray-900">
                            Admin Review
                          </p>
                          <p className="text-xs text-gray-500">
                            Approve only after confirming merchant statement
                          </p>
                        </div>
                      </div>

                      <div className="mt-5 grid gap-3">
                        <Link
                          href={getUsefulHref(submission)}
                          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-black text-gray-700 hover:bg-gray-50"
                        >
                          <Eye className="h-4 w-4" />
                          View Related Contribution
                        </Link>

                        <Link
                          href={`/admin/users?search=${encodeURIComponent(
                            submission.customer?.phone ||
                              submission.customer?.full_name ||
                              ''
                          )}`}
                          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-black text-gray-700 hover:bg-gray-50"
                        >
                          <UserRound className="h-4 w-4" />
                          View Customer
                        </Link>

                        {submission.agent && (
                          <Link
                            href={`/admin/agents?search=${encodeURIComponent(
                              submission.agent.phone ||
                                submission.agent.full_name ||
                                ''
                            )}`}
                            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-black text-gray-700 hover:bg-gray-50"
                          >
                            <UsersRound className="h-4 w-4" />
                            View Agent
                          </Link>
                        )}

                        {isPending && (
                          <>
                            <button
                              type="button"
                              onClick={() => approveSubmission(submission)}
                              disabled={!canReview || actionLoadingId === submission.id}
                              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-black text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {actionLoadingId === submission.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <CheckCircle2 className="h-4 w-4" />
                              )}
                              Approve Payment
                            </button>

                            <textarea
                              value={rejectionReasons[submission.id] || ''}
                              onChange={(event) =>
                                setRejectionReasons((current) => ({
                                  ...current,
                                  [submission.id]: event.target.value,
                                }))
                              }
                              placeholder="Write a clear rejection reason before rejecting..."
                              className="min-h-[110px] w-full rounded-xl border border-gray-200 bg-white p-3 text-sm outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100"
                              disabled={!canReview || actionLoadingId === submission.id}
                            />

                            <button
                              type="button"
                              onClick={() => rejectSubmission(submission)}
                              disabled={!canReview || actionLoadingId === submission.id}
                              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 text-sm font-black text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {actionLoadingId === submission.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <XCircle className="h-4 w-4" />
                              )}
                              Reject Payment
                            </button>
                          </>
                        )}

                        {!isPending && (
                          <div
                            className={`rounded-2xl border p-4 text-sm font-semibold ${getStatusStyle(
                              submission.status
                            )}`}
                          >
                            This submission has already been{' '}
                            {formatLabel(submission.status)}.
                            {submission.reviewed_at
                              ? ` Reviewed at ${formatDateTime(
                                  submission.reviewed_at
                                )}.`
                              : ''}
                          </div>
                        )}
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