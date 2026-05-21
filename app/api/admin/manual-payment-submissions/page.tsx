'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileCheck2,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  XCircle,
} from 'lucide-react';

import { supabase } from '@/lib/supabase/client';

type SubmissionStatus = 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

type RelatedProfile = {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
};

type RelatedFundSpace = {
  id: string;
  name: string | null;
  contribution_amount: number | null;
  status: string | null;
};

type RelatedRound = {
  id: string;
  round_number: number;
  contribution_deadline: string | null;
  status: string | null;
};

type RelatedCompanyAccount = {
  id: string;
  account_name: string;
  provider: string;
  network: string;
  merchant_number: string;
  merchant_id: string | null;
};

type ManualPaymentSubmission = {
  id: string;
  user_id: string;
  agent_id: string | null;
  contribution_id: string;
  fund_space_id: string;
  round_id: string;
  company_payment_account_id: string | null;
  amount_due: number;
  service_fee: number;
  total_amount_paid: number;
  sender_name: string | null;
  sender_phone: string | null;
  sender_network: string | null;
  transaction_reference: string;
  payment_note: string | null;
  screenshot_url: string | null;
  submitted_by: string | null;
  submitted_by_role: string | null;
  status: SubmissionStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
  customer: RelatedProfile | null;
  agent: RelatedProfile | null;
  fund_space: RelatedFundSpace | null;
  round: RelatedRound | null;
  company_account: RelatedCompanyAccount | null;
};

type Summary = {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  total_amount: number;
};

type SubmissionsApiResponse = {
  success?: boolean;
  message?: string;
  summary?: Summary;
  submissions?: ManualPaymentSubmission[];
};

type ActionApiResponse = {
  success?: boolean;
  message?: string;
  result?: unknown;
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
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateString));
}

function formatLabel(value: string | null | undefined) {
  return String(value || 'Not set')
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getStatusStyle(status: string | null | undefined) {
  const value = String(status || '').toUpperCase();

  if (value === 'APPROVED') {
    return 'border-emerald-100 bg-emerald-50 text-emerald-700';
  }

  if (value === 'PENDING_REVIEW') {
    return 'border-amber-100 bg-amber-50 text-amber-700';
  }

  if (value === 'REJECTED' || value === 'CANCELLED') {
    return 'border-red-100 bg-red-50 text-red-700';
  }

  return 'border-gray-100 bg-gray-50 text-gray-700';
}

function getNetworkLabel(value: string | null | undefined) {
  const network = String(value || '').toUpperCase();

  if (network === 'MTN_MOMO') return 'MTN MoMo';
  if (network === 'TELECEL_CASH') return 'Telecel Cash';
  if (network === 'AIRTELTIGO_MONEY') return 'AirtelTigo Money';
  if (network === 'BANK') return 'Bank';
  if (network === 'OTHER') return 'Other';

  return 'Not set';
}

export default function AdminManualPaymentSubmissionsPage() {
  const [submissions, setSubmissions] = useState<ManualPaymentSubmission[]>([]);
  const [summary, setSummary] = useState<Summary>({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    total_amount: 0,
  });

  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState('PENDING_REVIEW');
  const [searchTerm, setSearchTerm] = useState('');

  const [rejectSubmissionId, setRejectSubmissionId] = useState<string | null>(
    null
  );
  const [rejectionReason, setRejectionReason] = useState('');

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
      throw new Error('Your session has expired. Please log in again.');
    }

    return session.access_token;
  };

  const loadSubmissions = useCallback(async () => {
    try {
      setLoading(true);
      setMessage(null);

      const token = await getAccessToken();

      const params = new URLSearchParams();

      if (statusFilter && statusFilter !== 'ALL') {
        params.set('status', statusFilter);
      }

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

      const result = (await response.json()) as SubmissionsApiResponse;

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Unable to load payment submissions.');
      }

      setSubmissions(result.submissions || []);
      setSummary(
        result.summary || {
          total: 0,
          pending: 0,
          approved: 0,
          rejected: 0,
          total_amount: 0,
        }
      );
    } catch (error) {
      setMessage({
        type: 'error',
        text:
          error instanceof Error
            ? error.message
            : 'Something went wrong while loading payment submissions.',
      });
    } finally {
      setLoading(false);
    }
  }, [searchTerm, statusFilter]);

  useEffect(() => {
    loadSubmissions();
  }, [loadSubmissions]);

  const handleApprove = async (submission: ManualPaymentSubmission) => {
    try {
      setActionLoadingId(submission.id);
      setMessage(null);

      const token = await getAccessToken();

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

      const result = (await response.json()) as ActionApiResponse;

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Unable to approve payment.');
      }

      setMessage({
        type: 'success',
        text:
          result.message ||
          'Manual payment approved and contribution confirmed successfully.',
      });

      await loadSubmissions();
    } catch (error) {
      setMessage({
        type: 'error',
        text:
          error instanceof Error
            ? error.message
            : 'Something went wrong while approving payment.',
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleReject = async () => {
    if (!rejectSubmissionId) {
      setMessage({
        type: 'error',
        text: 'No payment submission selected for rejection.',
      });
      return;
    }

    if (!rejectionReason.trim()) {
      setMessage({
        type: 'error',
        text: 'Please enter a rejection reason.',
      });
      return;
    }

    try {
      setActionLoadingId(rejectSubmissionId);
      setMessage(null);

      const token = await getAccessToken();

      const response = await fetch('/api/admin/manual-payment-submissions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          submission_id: rejectSubmissionId,
          action: 'REJECT',
          rejection_reason: rejectionReason.trim(),
        }),
      });

      const result = (await response.json()) as ActionApiResponse;

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Unable to reject payment.');
      }

      setMessage({
        type: 'success',
        text: result.message || 'Manual payment rejected successfully.',
      });

      setRejectSubmissionId(null);
      setRejectionReason('');

      await loadSubmissions();
    } catch (error) {
      setMessage({
        type: 'error',
        text:
          error instanceof Error
            ? error.message
            : 'Something went wrong while rejecting payment.',
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  const filteredSubmissions = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    if (!search) return submissions;

    return submissions.filter((submission) => {
      const values = [
        submission.transaction_reference,
        submission.sender_name,
        submission.sender_phone,
        submission.customer?.full_name,
        submission.customer?.phone,
        submission.agent?.full_name,
        submission.fund_space?.name,
        submission.status,
      ];

      return values.some((value) =>
        String(value || '').toLowerCase().includes(search)
      );
    });
  }, [searchTerm, submissions]);

  return (
    <div className="space-y-8">
      <div className="rounded-3xl bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-600 p-6 text-white shadow-sm md:p-8">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
          <div>
            <p className="mb-3 inline-flex rounded-full bg-white/15 px-4 py-1 text-sm font-medium">
              Manual Merchant MoMo Verification
            </p>

            <h1 className="text-3xl font-bold md:text-4xl">
              Payment Submissions
            </h1>

            <p className="mt-3 max-w-3xl text-sm leading-7 text-emerald-50 md:text-base">
              Review customer and agent submitted MoMo payment references before
              confirming weekly Fund Space contributions.
            </p>
          </div>

          <button
            type="button"
            onClick={loadSubmissions}
            disabled={loading}
            className="inline-flex min-h-12 w-fit items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
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

      {message && (
        <div
          className={`flex items-start gap-3 rounded-2xl border p-4 text-sm font-semibold ${
            message.type === 'success'
              ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
              : 'border-red-100 bg-red-50 text-red-700'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
          ) : (
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          )}
          <p>{message.text}</p>
        </div>
      )}

      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total Submissions"
          value={summary.total}
          icon={<FileCheck2 className="h-6 w-6" />}
        />
        <StatCard
          title="Pending Review"
          value={summary.pending}
          icon={<Clock className="h-6 w-6" />}
          tone="amber"
        />
        <StatCard
          title="Approved"
          value={summary.approved}
          icon={<CheckCircle2 className="h-6 w-6" />}
        />
        <StatCard
          title="Total Submitted"
          value={formatCurrency(summary.total_amount)}
          icon={<ShieldCheck className="h-6 w-6" />}
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
                  loadSubmissions();
                }
              }}
              placeholder="Search reference, sender, customer, agent..."
              className="w-full rounded-2xl border border-gray-200 bg-gray-50 py-3 pl-11 pr-4 text-sm outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-50"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {(['ALL', 'PENDING_REVIEW', 'APPROVED', 'REJECTED'] as const).map(
              (status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setStatusFilter(status)}
                  className={`rounded-xl px-4 py-2.5 text-sm font-bold transition ${
                    statusFilter === status
                      ? 'bg-emerald-600 text-white shadow-sm hover:bg-emerald-700'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {status === 'ALL' ? 'All' : formatLabel(status)}
                </button>
              )
            )}

            <button
              type="button"
              onClick={loadSubmissions}
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
            <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
            <p className="text-sm font-medium text-gray-500">
              Loading manual payment submissions...
            </p>
          </div>
        ) : filteredSubmissions.length === 0 ? (
          <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 p-8 text-center">
            <FileCheck2 className="h-10 w-10 text-gray-300" />
            <h2 className="text-lg font-bold text-gray-900">
              No payment submissions found
            </h2>
            <p className="max-w-md text-sm leading-6 text-gray-500">
              Customer and agent submitted merchant MoMo payment references will
              appear here for admin verification.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredSubmissions.map((submission) => {
              const isPending = submission.status === 'PENDING_REVIEW';
              const isActionLoading = actionLoadingId === submission.id;
              const expectedTotal =
                Number(submission.amount_due || 0) +
                Number(submission.service_fee || 0);

              return (
                <article key={submission.id} className="p-5 md:p-6">
                  <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-xl font-black text-gray-900">
                          {submission.customer?.full_name || 'Unknown customer'}
                        </h2>

                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-bold ${getStatusStyle(
                            submission.status
                          )}`}
                        >
                          {formatLabel(submission.status)}
                        </span>

                        {submission.agent && (
                          <span className="rounded-full border border-amber-100 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">
                            Agent Submitted
                          </span>
                        )}
                      </div>

                      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        <DetailBox
                          label="Amount Due"
                          value={formatCurrency(submission.amount_due)}
                        />
                        <DetailBox
                          label="Service Fee"
                          value={formatCurrency(submission.service_fee)}
                        />
                        <DetailBox
                          label="Expected Total"
                          value={formatCurrency(expectedTotal)}
                        />
                        <DetailBox
                          label="Submitted Amount"
                          value={formatCurrency(submission.total_amount_paid)}
                          strong
                        />
                      </div>

                      <div className="mt-4 grid gap-3 lg:grid-cols-3">
                        <div className="rounded-2xl bg-gray-50 p-4">
                          <p className="text-xs font-bold uppercase text-gray-400">
                            Sender Details
                          </p>
                          <p className="mt-2 font-bold text-gray-900">
                            {submission.sender_name || 'Not provided'}
                          </p>
                          <p className="mt-1 text-sm text-gray-500">
                            {submission.sender_phone || 'No sender phone'}
                          </p>
                          <p className="mt-1 text-sm text-gray-500">
                            {getNetworkLabel(submission.sender_network)}
                          </p>
                        </div>

                        <div className="rounded-2xl bg-gray-50 p-4">
                          <p className="text-xs font-bold uppercase text-gray-400">
                            Merchant Account
                          </p>
                          <p className="mt-2 font-bold text-gray-900">
                            {submission.company_account?.account_name ||
                              'Company account'}
                          </p>
                          <p className="mt-1 text-sm text-gray-500">
                            {getNetworkLabel(
                              submission.company_account?.network
                            )}
                          </p>
                          <p className="mt-1 text-sm text-gray-500">
                            {submission.company_account?.merchant_number ||
                              'No merchant number'}
                          </p>
                        </div>

                        <div className="rounded-2xl bg-gray-50 p-4">
                          <p className="text-xs font-bold uppercase text-gray-400">
                            Transaction Reference
                          </p>
                          <p className="mt-2 break-all font-black text-gray-900">
                            {submission.transaction_reference}
                          </p>
                          <p className="mt-1 text-sm text-gray-500">
                            Submitted: {formatDate(submission.created_at)}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 rounded-2xl bg-gray-50 p-4 text-sm leading-6 text-gray-600">
                        <p>
                          <span className="font-bold text-gray-800">
                            Fund Space:
                          </span>{' '}
                          {submission.fund_space?.name || 'Not set'}
                        </p>
                        <p>
                          <span className="font-bold text-gray-800">
                            Round:
                          </span>{' '}
                          {submission.round?.round_number || 'Not set'}
                        </p>
                        <p>
                          <span className="font-bold text-gray-800">
                            Customer Phone:
                          </span>{' '}
                          {submission.customer?.phone || 'Not provided'}
                        </p>
                        <p>
                          <span className="font-bold text-gray-800">
                            Agent:
                          </span>{' '}
                          {submission.agent?.full_name || 'Not agent submitted'}
                        </p>

                        {submission.payment_note && (
                          <p className="mt-2">
                            <span className="font-bold text-gray-800">
                              Note:
                            </span>{' '}
                            {submission.payment_note}
                          </p>
                        )}

                        {submission.rejection_reason && (
                          <p className="mt-2 text-red-600">
                            <span className="font-bold">Rejection:</span>{' '}
                            {submission.rejection_reason}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="w-full rounded-3xl border border-gray-100 bg-gray-50 p-5 xl:w-[340px]">
                      <h3 className="text-sm font-black uppercase tracking-wide text-gray-500">
                        Verification Checklist
                      </h3>

                      <ul className="mt-4 space-y-3 text-sm text-gray-600">
                        <li className="flex gap-2">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                          Confirm transaction ID exists in merchant MoMo record.
                        </li>
                        <li className="flex gap-2">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                          Confirm amount paid matches expected total.
                        </li>
                        <li className="flex gap-2">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                          Confirm sender/customer details are reasonable.
                        </li>
                      </ul>

                      {isPending ? (
                        <div className="mt-5 grid gap-3">
                          <button
                            type="button"
                            disabled={isActionLoading}
                            onClick={() => handleApprove(submission)}
                            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                          >
                            {isActionLoading && (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            )}
                            Approve Payment
                          </button>

                          <button
                            type="button"
                            disabled={isActionLoading}
                            onClick={() => {
                              setRejectSubmissionId(submission.id);
                              setRejectionReason('');
                              setMessage(null);
                            }}
                            className="inline-flex min-h-12 items-center justify-center rounded-xl bg-red-600 px-5 py-3 text-sm font-bold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                          >
                            Reject Payment
                          </button>
                        </div>
                      ) : (
                        <div className="mt-5 rounded-2xl border border-gray-100 bg-white p-4 text-sm font-semibold text-gray-600">
                          This submission has already been{' '}
                          {formatLabel(submission.status)}.
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

      {rejectSubmissionId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-xl">
            <h2 className="text-xl font-black text-gray-900">
              Reject Payment Submission
            </h2>

            <p className="mt-2 text-sm leading-6 text-gray-500">
              Enter the reason why this payment reference is being rejected. The
              customer or agent will see this reason.
            </p>

            <textarea
              value={rejectionReason}
              onChange={(event) => setRejectionReason(event.target.value)}
              rows={5}
              placeholder="Example: Transaction reference not found in merchant MoMo statement."
              className="mt-5 w-full rounded-2xl border border-gray-200 p-4 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  setRejectSubmissionId(null);
                  setRejectionReason('');
                }}
                className="rounded-xl border border-gray-200 px-5 py-3 text-sm font-bold text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleReject}
                disabled={actionLoadingId === rejectSubmissionId}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-5 py-3 text-sm font-bold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                {actionLoadingId === rejectSubmissionId && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                Reject Submission
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
  tone = 'emerald',
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  tone?: 'emerald' | 'amber' | 'red';
}) {
  const colorClass =
    tone === 'red'
      ? 'bg-red-50 text-red-700'
      : tone === 'amber'
        ? 'bg-amber-50 text-amber-700'
        : 'bg-emerald-50 text-emerald-700';

  return (
    <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
      <div className={`mb-4 inline-flex rounded-2xl p-3 ${colorClass}`}>
        {icon}
      </div>
      <p className="text-sm text-gray-500">{title}</p>
      <h3 className="mt-1 text-3xl font-black text-gray-900">{value}</h3>
    </div>
  );
}

function DetailBox({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="rounded-2xl bg-gray-50 p-4">
      <p className="text-xs font-bold uppercase text-gray-400">{label}</p>
      <p
        className={`mt-1 break-words ${
          strong
            ? 'text-lg font-black text-emerald-700'
            : 'font-bold text-gray-900'
        }`}
      >
        {value}
      </p>
    </div>
  );
}