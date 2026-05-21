'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Copy,
  FileCheck2,
  Info,
  Loader2,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  UserRound,
  XCircle,
} from 'lucide-react';

import { supabase } from '@/lib/supabase/client';

type SubmissionStatus = 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

type PayerType = 'CUSTOMER_SELF' | 'THIRD_PARTY' | 'AGENT_ASSISTED';

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
  payer_type?: PayerType | null;
  payer_relationship?: string | null;
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

type WarningFlag = {
  tone: 'red' | 'amber' | 'blue' | 'emerald';
  title: string;
  description: string;
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
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
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

function getPayerTypeLabel(value: string | null | undefined) {
  const payerType = String(value || 'CUSTOMER_SELF').toUpperCase();

  if (payerType === 'THIRD_PARTY') return 'Third-party payment';
  if (payerType === 'AGENT_ASSISTED') return 'Agent-assisted payment';

  return 'Customer paid personally';
}

function getPayerBadgeStyle(value: string | null | undefined) {
  const payerType = String(value || 'CUSTOMER_SELF').toUpperCase();

  if (payerType === 'THIRD_PARTY') {
    return 'border-blue-100 bg-blue-50 text-blue-700';
  }

  if (payerType === 'AGENT_ASSISTED') {
    return 'border-amber-100 bg-amber-50 text-amber-700';
  }

  return 'border-emerald-100 bg-emerald-50 text-emerald-700';
}

function getExpectedTotal(submission: ManualPaymentSubmission) {
  return Number(submission.amount_due || 0) + Number(submission.service_fee || 0);
}

function getAmountDifference(submission: ManualPaymentSubmission) {
  return Number(submission.total_amount_paid || 0) - getExpectedTotal(submission);
}

function normalizePhone(value: string | null | undefined) {
  return String(value || '').replace(/\D/g, '');
}

function getWarningFlags({
  submission,
  sameContributionPendingCount,
  sameReferenceCount,
}: {
  submission: ManualPaymentSubmission;
  sameContributionPendingCount: number;
  sameReferenceCount: number;
}): WarningFlag[] {
  const flags: WarningFlag[] = [];
  const difference = getAmountDifference(submission);
  const customerPhone = normalizePhone(submission.customer?.phone);
  const senderPhone = normalizePhone(submission.sender_phone);
  const payerType = String(submission.payer_type || 'CUSTOMER_SELF').toUpperCase();

  if (sameContributionPendingCount > 1) {
    flags.push({
      tone: 'red',
      title: 'Multiple pending submissions',
      description:
        'More than one pending reference exists for this same contribution in the loaded list. Review carefully before approval.',
    });
  }

  if (sameReferenceCount > 1) {
    flags.push({
      tone: 'red',
      title: 'Repeated transaction reference',
      description:
        'This transaction reference appears more than once in the loaded list. Do not approve until confirmed.',
    });
  }

  if (difference < 0) {
    flags.push({
      tone: 'red',
      title: 'Amount below expected total',
      description: `Submitted amount is ${formatCurrency(
        Math.abs(difference)
      )} below the expected total.`,
    });
  }

  if (difference > 0) {
    flags.push({
      tone: 'amber',
      title: 'Amount above expected total',
      description: `Submitted amount is ${formatCurrency(
        difference
      )} above the expected total. Confirm from the merchant statement.`,
    });
  }

  if (!submission.sender_phone) {
    flags.push({
      tone: 'amber',
      title: 'Sender phone missing',
      description:
        'The submitted sender phone is missing. Confirm the sender details from the MoMo statement.',
    });
  }

  if (
    customerPhone &&
    senderPhone &&
    customerPhone.length >= 6 &&
    senderPhone.length >= 6 &&
    customerPhone.slice(-6) !== senderPhone.slice(-6)
  ) {
    flags.push({
      tone: payerType === 'CUSTOMER_SELF' ? 'amber' : 'blue',
      title:
        payerType === 'CUSTOMER_SELF'
          ? 'Sender phone differs from customer phone'
          : 'Third-party sender phone detected',
      description:
        payerType === 'CUSTOMER_SELF'
          ? 'The payer type says customer paid personally, but the sender phone differs. Confirm before approval.'
          : 'This may be valid because the payment was marked as third-party or agent-assisted. Confirm the sender from the merchant statement.',
    });
  }

  if (payerType === 'THIRD_PARTY' && !submission.payer_relationship) {
    flags.push({
      tone: 'amber',
      title: 'Third-party relationship missing',
      description:
        'The payment is marked as third-party, but the relationship to the customer is missing.',
    });
  }

  if (!submission.sender_name) {
    flags.push({
      tone: 'amber',
      title: 'Sender name missing',
      description:
        'The sender name was not provided. Confirm the sender from the merchant statement.',
    });
  }

  if (!submission.transaction_reference || submission.transaction_reference.length < 6) {
    flags.push({
      tone: 'red',
      title: 'Weak transaction reference',
      description:
        'The transaction reference looks too short. Confirm carefully before approving.',
    });
  }

  if (flags.length === 0) {
    flags.push({
      tone: 'emerald',
      title: 'No obvious warning',
      description:
        'Still verify the reference, amount, sender, and date from the merchant statement before approval.',
    });
  }

  return flags;
}

function getWarningStyle(tone: WarningFlag['tone']) {
  if (tone === 'red') {
    return 'border-red-100 bg-red-50 text-red-700';
  }

  if (tone === 'amber') {
    return 'border-amber-100 bg-amber-50 text-amber-700';
  }

  if (tone === 'blue') {
    return 'border-blue-100 bg-blue-50 text-blue-700';
  }

  return 'border-emerald-100 bg-emerald-50 text-emerald-700';
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
    type: 'success' | 'error' | 'info';
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
        throw new Error(result.message || 'Unable to load MoMo submissions.');
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
            : 'Something went wrong while loading MoMo submissions.',
      });
    } finally {
      setLoading(false);
    }
  }, [searchTerm, statusFilter]);

  useEffect(() => {
    loadSubmissions();
  }, [loadSubmissions]);

  const handleCopy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setMessage({
        type: 'info',
        text: `${label} copied.`,
      });
    } catch {
      setMessage({
        type: 'error',
        text: `Could not copy ${label}. Please copy it manually.`,
      });
    }
  };

  const handleApprove = async (submission: ManualPaymentSubmission) => {
    const expectedTotal = getExpectedTotal(submission);
    const difference = getAmountDifference(submission);

    if (difference < 0) {
      setMessage({
        type: 'error',
        text: `This submitted amount is below the expected total. Expected ${formatCurrency(
          expectedTotal
        )}, but submitted ${formatCurrency(
          submission.total_amount_paid
        )}. Reject it or verify carefully before approving.`,
      });
      return;
    }

    const confirmed = window.confirm(
      `Approve this MoMo payment?\n\nBefore approving, confirm these from the merchant statement:\n\n1. Transaction reference exists\n2. Amount received is ${formatCurrency(
        submission.total_amount_paid
      )}\n3. Sender details match or are reasonable\n4. Payer type is: ${getPayerTypeLabel(
        submission.payer_type
      )}\n5. Transaction has not already been used\n\nThis will mark the registered customer's contribution as paid.`
    );

    if (!confirmed) return;

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
        throw new Error(result.message || 'Unable to approve MoMo payment.');
      }

      setMessage({
        type: 'success',
        text:
          result.message ||
          'MoMo payment approved and weekly contribution confirmed successfully.',
      });

      await loadSubmissions();
    } catch (error) {
      setMessage({
        type: 'error',
        text:
          error instanceof Error
            ? error.message
            : 'Something went wrong while approving MoMo payment.',
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleReject = async () => {
    if (!rejectSubmissionId) {
      setMessage({
        type: 'error',
        text: 'No MoMo submission selected for rejection.',
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
        throw new Error(result.message || 'Unable to reject MoMo submission.');
      }

      setMessage({
        type: 'success',
        text: result.message || 'MoMo submission rejected successfully.',
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
            : 'Something went wrong while rejecting MoMo submission.',
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
        submission.payer_type,
        submission.payer_relationship,
      ];

      return values.some((value) =>
        String(value || '').toLowerCase().includes(search)
      );
    });
  }, [searchTerm, submissions]);

  const pendingContributionCountMap = useMemo(() => {
    const map = new Map<string, number>();

    for (const submission of submissions) {
      if (submission.status !== 'PENDING_REVIEW') continue;

      map.set(
        submission.contribution_id,
        (map.get(submission.contribution_id) || 0) + 1
      );
    }

    return map;
  }, [submissions]);

  const referenceCountMap = useMemo(() => {
    const map = new Map<string, number>();

    for (const submission of submissions) {
      const reference = submission.transaction_reference?.trim().toLowerCase();

      if (!reference) continue;

      map.set(reference, (map.get(reference) || 0) + 1);
    }

    return map;
  }, [submissions]);

  return (
    <div className="space-y-8">
      <div className="rounded-3xl bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-600 p-6 text-white shadow-sm md:p-8">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
          <div>
            <p className="mb-3 inline-flex rounded-full bg-white/15 px-4 py-1 text-sm font-medium">
              MoMo Payment Verification
            </p>

            <h1 className="text-3xl font-bold md:text-4xl">
              Verify Weekly Contribution Payments
            </h1>

            <p className="mt-3 max-w-3xl text-sm leading-7 text-emerald-50 md:text-base">
              Review customer, third-party, and agent-assisted MoMo transaction
              references before confirming weekly Fund Space contributions.
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

      <div className="rounded-3xl border border-blue-100 bg-blue-50 p-5">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-1 h-6 w-6 shrink-0 text-blue-700" />
          <div>
            <h2 className="font-black text-blue-900">
              Third-party payment rule
            </h2>
            <p className="mt-1 text-sm leading-6 text-blue-700">
              A different sender phone is not automatically wrong. A customer
              may use a relative, friend, spouse, or agent to pay. Approve only
              after confirming the transaction reference, amount, sender details,
              and payer relationship from the TrustPoint merchant MoMo statement.
            </p>
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
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
          ) : message.type === 'info' ? (
            <Info className="mt-0.5 h-5 w-5 shrink-0" />
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
              placeholder="Search reference, sender, customer, payer type..."
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
              Loading MoMo submissions...
            </p>
          </div>
        ) : filteredSubmissions.length === 0 ? (
          <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 p-8 text-center">
            <FileCheck2 className="h-10 w-10 text-gray-300" />
            <h2 className="text-lg font-bold text-gray-900">
              No MoMo submissions found
            </h2>
            <p className="max-w-md text-sm leading-6 text-gray-500">
              Customer, third-party, and agent-assisted MoMo transaction
              references will appear here for admin verification.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredSubmissions.map((submission) => {
              const isPending = submission.status === 'PENDING_REVIEW';
              const isActionLoading = actionLoadingId === submission.id;
              const expectedTotal = getExpectedTotal(submission);
              const referenceKey = submission.transaction_reference
                ?.trim()
                .toLowerCase();
              const warningFlags = getWarningFlags({
                submission,
                sameContributionPendingCount:
                  pendingContributionCountMap.get(submission.contribution_id) ||
                  0,
                sameReferenceCount: referenceKey
                  ? referenceCountMap.get(referenceKey) || 0
                  : 0,
              });

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

                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-bold ${getPayerBadgeStyle(
                            submission.payer_type
                          )}`}
                        >
                          {getPayerTypeLabel(submission.payer_type)}
                        </span>

                        {submission.agent && (
                          <span className="rounded-full border border-amber-100 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">
                            Agent Submitted
                          </span>
                        )}
                      </div>

                      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        <DetailBox
                          label="Contribution"
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
                            Payer Information
                          </p>
                          <div className="mt-2 flex items-start gap-2">
                            <UserRound className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                            <div>
                              <p className="font-bold text-gray-900">
                                {getPayerTypeLabel(submission.payer_type)}
                              </p>
                              <p className="mt-1 text-sm text-gray-500">
                                Relationship:{' '}
                                {submission.payer_relationship || 'Not provided'}
                              </p>
                            </div>
                          </div>
                        </div>

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
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-xs font-bold uppercase text-gray-400">
                                Transaction Reference
                              </p>
                              <p className="mt-2 break-all font-black text-gray-900">
                                {submission.transaction_reference}
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={() =>
                                handleCopy(
                                  submission.transaction_reference,
                                  'Transaction reference'
                                )
                              }
                              className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-bold text-gray-600 hover:bg-gray-50"
                            >
                              <Copy className="h-3.5 w-3.5" />
                              Copy
                            </button>
                          </div>

                          <p className="mt-2 text-sm text-gray-500">
                            Submitted: {formatDate(submission.created_at)}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 lg:grid-cols-2">
                        <div className="rounded-2xl bg-gray-50 p-4 text-sm leading-6 text-gray-600">
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
                      </div>

                      {submission.payment_note && (
                        <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm leading-6 text-blue-700">
                          <p className="font-black text-blue-900">
                            Customer / Agent Note
                          </p>
                          <p className="mt-1 whitespace-pre-line">
                            {submission.payment_note}
                          </p>
                        </div>
                      )}

                      {submission.rejection_reason && (
                        <div className="mt-4 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm leading-6 text-red-700">
                          <p className="font-black text-red-900">
                            Rejection Reason
                          </p>
                          <p className="mt-1">{submission.rejection_reason}</p>
                        </div>
                      )}

                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        {warningFlags.map((flag) => (
                          <div
                            key={`${submission.id}-${flag.title}`}
                            className={`rounded-2xl border p-4 text-sm ${getWarningStyle(
                              flag.tone
                            )}`}
                          >
                            <div className="flex items-start gap-2">
                              {flag.tone === 'red' ? (
                                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                              ) : flag.tone === 'emerald' ? (
                                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                              ) : (
                                <Info className="mt-0.5 h-4 w-4 shrink-0" />
                              )}

                              <div>
                                <p className="font-black">{flag.title}</p>
                                <p className="mt-1 leading-5">
                                  {flag.description}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="w-full rounded-3xl border border-gray-100 bg-gray-50 p-5 xl:w-[360px]">
                      <h3 className="text-sm font-black uppercase tracking-wide text-gray-500">
                        Verification Checklist
                      </h3>

                      <ul className="mt-4 space-y-3 text-sm text-gray-600">
                        <li className="flex gap-2">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                          Confirm transaction reference exists in the TrustPoint
                          merchant MoMo statement.
                        </li>
                        <li className="flex gap-2">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                          Confirm amount received matches the expected total.
                        </li>
                        <li className="flex gap-2">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                          Confirm transaction date and sender details.
                        </li>
                        <li className="flex gap-2">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                          Confirm third-party or agent relationship when sender
                          phone differs from customer phone.
                        </li>
                        <li className="flex gap-2">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                          Confirm this reference has not already been used.
                        </li>
                      </ul>

                      <div className="mt-5 rounded-2xl border border-amber-100 bg-amber-50 p-4 text-xs leading-5 text-amber-700">
                        Remember: the payment sender does not become the Fund
                        Space owner. The contribution belongs to the registered
                        customer shown on this submission.
                      </div>

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
                            Approve Verified Payment
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
                            Reject Submission
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
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-black text-gray-900">
                  Reject MoMo Submission
                </h2>

                <p className="mt-2 text-sm leading-6 text-gray-500">
                  Enter a clear reason. The customer or agent will use this
                  reason to correct the payment submission.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setRejectSubmissionId(null);
                  setRejectionReason('');
                }}
                className="rounded-xl p-2 text-gray-400 hover:bg-gray-50 hover:text-gray-700"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            <textarea
              value={rejectionReason}
              onChange={(event) => setRejectionReason(event.target.value)}
              rows={5}
              placeholder="Example: Transaction reference not found in TrustPoint merchant MoMo statement."
              className="mt-5 w-full rounded-2xl border border-gray-200 p-4 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />

            <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm leading-6 text-amber-700">
              Good rejection reasons include: reference not found, amount
              mismatch, sender details unclear, wrong merchant account,
              duplicate/used transaction reference, or unclear third-party
              payer relationship.
            </div>

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