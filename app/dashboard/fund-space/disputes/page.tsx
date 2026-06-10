'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  FileImage,
  FileWarning,
  Loader2,
  MessageSquareWarning,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
  UploadCloud,
  X,
  XCircle,
} from 'lucide-react';

import { supabase } from '@/lib/supabase/client';

type DisputeStatus =
  | 'ALL'
  | 'OPEN'
  | 'UNDER_REVIEW'
  | 'WAITING_FOR_USER'
  | 'RESOLVED'
  | 'REJECTED'
  | 'CANCELLED';

type DisputeCategory =
  | 'MISSED_PAYOUT'
  | 'WRONG_PAYMENT_RECORD'
  | 'AGENT_MISCONDUCT'
  | 'SUSPICIOUS_MEMBER'
  | 'WRONG_CONTRIBUTION_STATUS'
  | 'VERIFICATION_ISSUE'
  | 'LATE_FEE_OR_PENALTY'
  | 'OTHER';

type FundSpaceOption = {
  id: string;
  name: string | null;
  status: string | null;
  contribution_amount: number | string | null;
  current_round_number: number | null;
};

type Dispute = {
  id: string;
  user_id: string;
  fund_space_id: string | null;
  round_id: string | null;
  contribution_id: string | null;
  payout_id: string | null;
  related_user_id: string | null;
  subject: string;
  message: string;
  category: string;
  priority: string;
  evidence_url: string | null;
  status: string;
  admin_note: string | null;
  assigned_to: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  resolution_note: string | null;
  last_response_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  fund_space?: FundSpaceOption | null;
  round?: {
    id: string;
    round_number: number | null;
    status: string | null;
    contribution_deadline: string | null;
  } | null;
};

type ApiResponse = {
  success: boolean;
  message?: string;
  disputes?: Dispute[];
  summary?: {
    total: number;
    open: number;
    under_review: number;
    waiting_for_user: number;
    resolved: number;
    rejected: number;
    urgent: number;
    high: number;
  };
};

const EVIDENCE_BUCKET = 'fund-space-dispute-evidence';

const categoryOptions: { label: string; value: DisputeCategory; helper: string }[] = [
  {
    label: 'Missed payout',
    value: 'MISSED_PAYOUT',
    helper: 'I was supposed to receive payout but did not.',
  },
  {
    label: 'Wrong payment record',
    value: 'WRONG_PAYMENT_RECORD',
    helper: 'My payment status, amount, or reference is wrong.',
  },
  {
    label: 'Wrong contribution status',
    value: 'WRONG_CONTRIBUTION_STATUS',
    helper: 'My contribution is showing the wrong status.',
  },
  {
    label: 'Late fee or penalty',
    value: 'LATE_FEE_OR_PENALTY',
    helper: 'I disagree with a late fee or penalty.',
  },
  {
    label: 'Agent misconduct',
    value: 'AGENT_MISCONDUCT',
    helper: 'I want to report an agent issue.',
  },
  {
    label: 'Suspicious member',
    value: 'SUSPICIOUS_MEMBER',
    helper: 'I noticed suspicious behaviour from a member.',
  },
  {
    label: 'Verification issue',
    value: 'VERIFICATION_ISSUE',
    helper: 'I have a problem with verification.',
  },
  {
    label: 'Other complaint',
    value: 'OTHER',
    helper: 'Something else needs TrustPoint attention.',
  },
];

const statusTabs: { label: string; value: DisputeStatus }[] = [
  { label: 'All', value: 'ALL' },
  { label: 'Open', value: 'OPEN' },
  { label: 'Under Review', value: 'UNDER_REVIEW' },
  { label: 'Waiting', value: 'WAITING_FOR_USER' },
  { label: 'Resolved', value: 'RESOLVED' },
  { label: 'Rejected', value: 'REJECTED' },
];

const emptySummary = {
  total: 0,
  open: 0,
  under_review: 0,
  waiting_for_user: 0,
  resolved: 0,
  rejected: 0,
  urgent: 0,
  high: 0,
};

function normalizeStatus(value: string | null | undefined) {
  return String(value || '').trim().toUpperCase();
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

function formatCurrency(amount: number | string | null | undefined) {
  const parsed = Number(amount || 0);

  return `GH₵${Number.isFinite(parsed) ? parsed.toLocaleString('en-GH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) : '0.00'}`;
}

function formatLabel(value: string | null | undefined) {
  if (!value) return 'Not set';

  return value
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getStatusStyle(status: string | null | undefined) {
  const value = normalizeStatus(status);

  if (['RESOLVED', 'PAID', 'APPROVED'].includes(value)) {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }

  if (['OPEN', 'UNDER_REVIEW', 'WAITING_FOR_USER'].includes(value)) {
    return 'border-amber-200 bg-amber-50 text-amber-700';
  }

  if (['REJECTED', 'CANCELLED', 'FAILED'].includes(value)) {
    return 'border-red-200 bg-red-50 text-red-700';
  }

  return 'border-slate-200 bg-slate-50 text-slate-700';
}

function getSafeFileName(fileName: string) {
  return fileName
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
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

function SummaryItem({
  label,
  value,
  helper,
  onClick,
}: {
  label: string;
  value: string | number;
  helper?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group min-w-0 rounded-2xl border border-white/15 bg-white/10 p-3 text-left transition hover:-translate-y-0.5 hover:bg-white/20 hover:shadow-lg"
    >
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-black uppercase tracking-wide text-emerald-50/80">
            {label}
          </p>

          <p className="mt-1 truncate text-lg font-black text-white md:text-xl">
            {value}
          </p>

          {helper && (
            <p className="mt-1 truncate text-xs font-semibold text-emerald-50/70">
              {helper}
            </p>
          )}
        </div>

        <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-emerald-50/70 transition group-hover:translate-x-1 group-hover:text-white" />
      </div>
    </button>
  );
}

function StatusPill({ status }: { status: string | null | undefined }) {
  return (
    <span
      className={`inline-flex max-w-full rounded-full border px-3 py-1 text-xs font-black ${getStatusStyle(
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
    <div className="min-w-0">
      <p className="truncate text-[11px] font-black uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="truncate text-sm font-black text-slate-900">
        {value ?? 'Not set'}
      </p>
    </div>
  );
}

function MessageBox({
  type,
  message,
}: {
  type: 'success' | 'error' | 'info';
  message: string;
}) {
  const isSuccess = type === 'success';
  const isInfo = type === 'info';

  return (
    <div
      className={`rounded-2xl border p-4 text-sm font-semibold ${
        isSuccess
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
          : isInfo
            ? 'border-blue-200 bg-blue-50 text-blue-700'
            : 'border-red-200 bg-red-50 text-red-700'
      }`}
    >
      <div className="flex items-start gap-3">
        {isSuccess ? (
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
        ) : (
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
        )}
        <p className="min-w-0 break-words leading-6">{message}</p>
      </div>
    </div>
  );
}

export default function MemberFundSpaceDisputesPage() {
  const [fundSpaces, setFundSpaces] = useState<FundSpaceOption[]>([]);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [summary, setSummary] = useState(emptySummary);

  const [statusFilter, setStatusFilter] = useState<DisputeStatus>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDispute, setSelectedDispute] = useState<Dispute | null>(null);

  const [category, setCategory] = useState<DisputeCategory>('WRONG_PAYMENT_RECORD');
  const [fundSpaceId, setFundSpaceId] = useState('');
  const [subject, setSubject] = useState('');
  const [messageText, setMessageText] = useState('');
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

  const loadFundSpaces = useCallback(async () => {
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session?.user) {
      throw new Error('Your session has expired. Please log in again.');
    }

    const { data: memberships, error: membershipError } = await supabase
      .from('fund_space_members')
      .select('fund_space_id')
      .eq('user_id', session.user.id);

    if (membershipError) {
      throw membershipError;
    }

    const fundSpaceIds = [
      ...new Set((memberships || []).map((item) => item.fund_space_id).filter(Boolean)),
    ];

    if (fundSpaceIds.length === 0) {
      setFundSpaces([]);
      return;
    }

    const { data, error } = await supabase
      .from('fund_spaces')
      .select('id, name, status, contribution_amount, current_round_number')
      .in('id', fundSpaceIds)
      .order('created_at', { ascending: false });

    if (error) throw error;

    setFundSpaces((data || []) as FundSpaceOption[]);
  }, []);

  const loadDisputes = useCallback(
    async (showRefresh = false) => {
      try {
        if (showRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setNotice(null);

        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError || !session?.access_token) {
          throw new Error('Your session has expired. Please log in again.');
        }

        const params = new URLSearchParams();
        params.set('mine', 'true');
        params.set('limit', '200');

        if (statusFilter !== 'ALL') {
          params.set('status', statusFilter);
        }

        const response = await fetch(`/api/fund-space/disputes?${params.toString()}`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        const result = await readApiResponse(response);

        if (!response.ok || !result.success) {
          throw new Error(result.message || 'Unable to load complaints.');
        }

        setDisputes(result.disputes || []);
        setSummary(result.summary || emptySummary);

        await loadFundSpaces();
      } catch (error) {
        setNotice({
          type: 'error',
          text:
            error instanceof Error
              ? error.message
              : 'Unable to load your complaints.',
        });
        setDisputes([]);
        setSummary(emptySummary);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [loadFundSpaces, statusFilter]
  );

  useEffect(() => {
    loadDisputes();
  }, [loadDisputes]);

  const filteredDisputes = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    return disputes.filter((dispute) => {
      if (!search) return true;

      const haystack = [
        dispute.subject,
        dispute.message,
        dispute.category,
        dispute.status,
        dispute.priority,
        dispute.fund_space?.name,
        dispute.round?.round_number ? `round ${dispute.round.round_number}` : '',
        dispute.admin_note,
        dispute.resolution_note,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(search);
    });
  }, [disputes, searchTerm]);

  async function uploadEvidenceFile() {
    if (!evidenceFile) return null;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];

    if (!allowedTypes.includes(evidenceFile.type)) {
      throw new Error('Please upload a valid image screenshot: JPG, PNG, or WEBP.');
    }

    const maxSize = 5 * 1024 * 1024;

    if (evidenceFile.size > maxSize) {
      throw new Error('Screenshot is too large. Please upload an image below 5MB.');
    }

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session?.user) {
      throw new Error('Your session has expired. Please log in again.');
    }

    const safeName = getSafeFileName(evidenceFile.name);
    const filePath = `${session.user.id}/${Date.now()}-${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from(EVIDENCE_BUCKET)
      .upload(filePath, evidenceFile, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      throw new Error(uploadError.message || 'Unable to upload screenshot.');
    }

    const { data } = supabase.storage
      .from(EVIDENCE_BUCKET)
      .getPublicUrl(filePath);

    return data.publicUrl || null;
  }

  async function handleSubmitDispute(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setSubmitting(true);
      setNotice(null);

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.access_token) {
        throw new Error('Your session has expired. Please log in again.');
      }

      const uploadedEvidenceUrl = await uploadEvidenceFile();

      const response = await fetch('/api/fund-space/disputes', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          category,
          priority:
            category === 'MISSED_PAYOUT' || category === 'AGENT_MISCONDUCT'
              ? 'HIGH'
              : 'NORMAL',
          fund_space_id: fundSpaceId || null,
          subject,
          message: messageText,
          evidence_url: uploadedEvidenceUrl,
        }),
      });

      const result = await readApiResponse(response);

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Unable to submit complaint.');
      }

      setNotice({
        type: 'success',
        text: result.message || 'Complaint submitted successfully.',
      });

      setCategory('WRONG_PAYMENT_RECORD');
      setFundSpaceId('');
      setSubject('');
      setMessageText('');
      setEvidenceFile(null);

      await loadDisputes(true);
    } catch (error) {
      setNotice({
        type: 'error',
        text:
          error instanceof Error
            ? error.message
            : 'Something went wrong while submitting your complaint.',
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-6">
        <div className="mx-auto flex min-h-[60vh] max-w-6xl items-center justify-center">
          <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-emerald-700" />
            <p className="mt-4 text-sm font-black text-slate-600">
              Loading complaints...
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-5 md:px-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-900 via-emerald-800 to-teal-800 text-white shadow-sm">
          <div className="p-5 md:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <Link
                  href="/dashboard/fund-space"
                  className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-black text-white hover:bg-white/20"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to Fund Space
                </Link>

                <h1 className="mt-3 text-2xl font-black tracking-tight md:text-3xl">
                  Fund Space Complaints
                </h1>

                <p className="mt-2 max-w-2xl text-sm leading-6 text-emerald-50">
                  Report payment, payout, penalty, verification, or member issues.
                  Upload a screenshot as evidence when available.
                </p>
              </div>

              <button
                type="button"
                onClick={() => loadDisputes(true)}
                disabled={refreshing}
                className="inline-flex min-h-11 w-fit items-center justify-center gap-2 rounded-2xl bg-white px-4 text-xs font-black text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
              <SummaryItem label="Total" value={summary.total} helper="All complaints" onClick={() => setStatusFilter('ALL')} />
              <SummaryItem label="Open" value={summary.open} helper="New complaints" onClick={() => setStatusFilter('OPEN')} />
              <SummaryItem label="Under Review" value={summary.under_review} helper="TrustPoint reviewing" onClick={() => setStatusFilter('UNDER_REVIEW')} />
              <SummaryItem label="Waiting" value={summary.waiting_for_user} helper="Needs your reply" onClick={() => setStatusFilter('WAITING_FOR_USER')} />
              <SummaryItem label="Resolved" value={summary.resolved} helper="Closed successfully" onClick={() => setStatusFilter('RESOLVED')} />
              <SummaryItem label="Rejected" value={summary.rejected} helper="Not accepted" onClick={() => setStatusFilter('REJECTED')} />
            </div>
          </div>
        </section>

        {notice && <MessageBox type={notice.type} message={notice.text} />}

        <section className="grid gap-5 xl:grid-cols-[420px_1fr]">
          <form
            onSubmit={handleSubmitDispute}
            className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                <MessageSquareWarning className="h-5 w-5" />
              </div>

              <div className="min-w-0">
                <h2 className="text-lg font-black text-slate-900">
                  Submit Complaint
                </h2>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  Explain the issue clearly and upload a screenshot if you have one.
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <label className="text-xs font-black uppercase tracking-wide text-slate-500">
                  Complaint Type
                </label>
                <select
                  value={category}
                  onChange={(event) => setCategory(event.target.value as DisputeCategory)}
                  className="mt-2 min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-900 outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-100"
                >
                  {categoryOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">
                  {categoryOptions.find((option) => option.value === category)?.helper}
                </p>
              </div>

              <div>
                <label className="text-xs font-black uppercase tracking-wide text-slate-500">
                  Fund Space
                </label>
                <select
                  value={fundSpaceId}
                  onChange={(event) => setFundSpaceId(event.target.value)}
                  className="mt-2 min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-900 outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-100"
                >
                  <option value="">Not linked to a Fund Space</option>
                  {fundSpaces.map((space) => (
                    <option key={space.id} value={space.id}>
                      {space.name || 'Unnamed Fund Space'} · Round{' '}
                      {space.current_round_number || 1} ·{' '}
                      {formatCurrency(space.contribution_amount)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-black uppercase tracking-wide text-slate-500">
                  Subject
                </label>
                <input
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  placeholder="Example: My payment is not showing as paid"
                  className="mt-2 min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-900 outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-100"
                />
              </div>

              <div>
                <label className="text-xs font-black uppercase tracking-wide text-slate-500">
                  Explain the Issue
                </label>
                <textarea
                  value={messageText}
                  onChange={(event) => setMessageText(event.target.value)}
                  rows={5}
                  placeholder="Write what happened, when it happened, and what TrustPoint should check."
                  className="mt-2 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold leading-6 text-slate-900 outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-100"
                />
              </div>

              <div>
                <label className="text-xs font-black uppercase tracking-wide text-slate-500">
                  Upload Screenshot Optional
                </label>

                <label className="mt-2 flex cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed border-emerald-200 bg-emerald-50/60 px-4 py-6 text-center transition hover:bg-emerald-50">
                  <UploadCloud className="h-8 w-8 text-emerald-700" />
                  <p className="mt-3 text-sm font-black text-slate-900">
                    Tap to upload screenshot
                  </p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    JPG, PNG, or WEBP. Maximum 5MB.
                  </p>

                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp"
                    onChange={(event) => {
                      const file = event.target.files?.[0] || null;
                      setEvidenceFile(file);
                    }}
                    className="hidden"
                  />
                </label>

                {evidenceFile && (
                  <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-white p-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <FileImage className="h-5 w-5 shrink-0 text-emerald-700" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-slate-900">
                          {evidenceFile.name}
                        </p>
                        <p className="text-xs font-semibold text-slate-500">
                          {(evidenceFile.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setEvidenceFile(null)}
                      className="rounded-xl p-2 text-slate-500 hover:bg-slate-100"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-4 text-sm font-black text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Submit Complaint
              </button>
            </div>
          </form>

          <section className="space-y-4">
            <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="space-y-3">
                <div className="relative min-w-0">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Search complaint, status, category, Fund Space..."
                    className="min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm font-semibold outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-100"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6 xl:grid-cols-3 2xl:grid-cols-6">
                  {statusTabs.map((tab) => (
                    <button
                      key={tab.value}
                      type="button"
                      onClick={() => setStatusFilter(tab.value)}
                      className={`min-h-11 rounded-2xl px-3 text-xs font-black transition ${
                        statusFilter === tab.value
                          ? 'bg-emerald-700 text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      <span className="line-clamp-1">{tab.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <p className="mt-3 text-xs font-bold text-slate-500">
                Showing {filteredDisputes.length} complaint records.
              </p>
            </div>

            {filteredDisputes.length === 0 ? (
              <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
                <FileWarning className="mx-auto h-10 w-10 text-slate-300" />
                <h2 className="mt-4 text-lg font-black text-slate-900">
                  No complaints found
                </h2>
                <p className="mt-2 text-sm text-slate-500">
                  Submit a complaint or choose another filter.
                </p>
              </div>
            ) : (
              filteredDisputes.map((dispute) => (
                <article
                  key={dispute.id}
                  className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:border-emerald-200 hover:shadow-md"
                >
                  <div className="grid gap-4 p-4 xl:grid-cols-[1fr_auto] xl:items-center">
                    <div className="min-w-0">
                      <div className="flex flex-wrap gap-2">
                        <StatusPill status={dispute.status} />
                        <StatusPill status={dispute.category} />
                        <StatusPill status={dispute.priority} />
                      </div>

                      <h2 className="mt-3 line-clamp-2 break-words text-base font-black leading-6 text-slate-900">
                        {dispute.subject}
                      </h2>

                      <p className="mt-1 line-clamp-2 break-words text-sm font-semibold leading-6 text-slate-500">
                        {dispute.message}
                      </p>

                      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <CompactInfo label="Fund Space" value={dispute.fund_space?.name || 'Not linked'} />
                        <CompactInfo
                          label="Round"
                          value={
                            dispute.round?.round_number
                              ? `Round ${dispute.round.round_number}`
                              : 'Not set'
                          }
                        />
                        <CompactInfo label="Created" value={formatDateTime(dispute.created_at)} />
                        <CompactInfo label="Updated" value={formatDateTime(dispute.updated_at)} />
                      </div>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2 xl:w-56 xl:grid-cols-1">
                      <button
                        type="button"
                        onClick={() => setSelectedDispute(dispute)}
                        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-4 text-sm font-black text-white hover:bg-emerald-800"
                      >
                        View
                        <ArrowRight className="h-4 w-4" />
                      </button>

                      {normalizeStatus(dispute.status) === 'RESOLVED' && (
                        <div className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 text-sm font-black text-emerald-700">
                          <CheckCircle2 className="h-4 w-4" />
                          Resolved
                        </div>
                      )}

                      {['OPEN', 'UNDER_REVIEW', 'WAITING_FOR_USER'].includes(
                        normalizeStatus(dispute.status)
                      ) && (
                        <div className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 text-sm font-black text-amber-700">
                          <Clock className="h-4 w-4" />
                          Pending
                        </div>
                      )}

                      {normalizeStatus(dispute.status) === 'REJECTED' && (
                        <div className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 text-sm font-black text-red-700">
                          <XCircle className="h-4 w-4" />
                          Rejected
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              ))
            )}
          </section>
        </section>

        <section className="rounded-3xl border border-amber-100 bg-amber-50 p-5">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-1 h-5 w-5 shrink-0 text-amber-700" />

            <div className="min-w-0">
              <h2 className="text-base font-black text-amber-900">
                Complaint Reminder
              </h2>

              <p className="mt-2 break-words text-sm font-semibold leading-6 text-amber-700">
                Submit only truthful complaints. Attach a screenshot when possible.
                False reports may affect your Trust Shield score.
              </p>
            </div>
          </div>
        </section>
      </div>

      {selectedDispute && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-3 py-4">
          <div className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
              <div className="min-w-0">
                <h2 className="text-lg font-black text-slate-900">
                  Complaint Details
                </h2>
                <p className="mt-1 truncate text-sm text-slate-500">
                  {selectedDispute.subject}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedDispute(null)}
                className="rounded-2xl p-2 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <CompactInfo label="Status" value={formatLabel(selectedDispute.status)} />
                <CompactInfo label="Category" value={formatLabel(selectedDispute.category)} />
                <CompactInfo label="Priority" value={formatLabel(selectedDispute.priority)} />
                <CompactInfo label="Fund Space" value={selectedDispute.fund_space?.name || 'Not linked'} />
                <CompactInfo
                  label="Round"
                  value={
                    selectedDispute.round?.round_number
                      ? `Round ${selectedDispute.round.round_number}`
                      : 'Not set'
                  }
                />
                <CompactInfo label="Created" value={formatDateTime(selectedDispute.created_at)} />
                <CompactInfo label="Updated" value={formatDateTime(selectedDispute.updated_at)} />
                <CompactInfo label="Resolved At" value={formatDateTime(selectedDispute.resolved_at)} />
              </div>

              <div className="mt-5 rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-black uppercase tracking-wide text-slate-400">
                  Your Message
                </p>
                <p className="mt-2 whitespace-pre-wrap break-words text-sm font-semibold leading-6 text-slate-700">
                  {selectedDispute.message}
                </p>
              </div>

              {selectedDispute.evidence_url && (
                <a
                  href={selectedDispute.evidence_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-4 text-sm font-black text-white hover:bg-emerald-800"
                >
                  <FileImage className="h-4 w-4" />
                  Open Screenshot
                </a>
              )}

              {selectedDispute.admin_note && (
                <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 p-4">
                  <p className="text-xs font-black uppercase tracking-wide text-blue-500">
                    Admin Note
                  </p>
                  <p className="mt-2 whitespace-pre-wrap break-words text-sm font-semibold leading-6 text-blue-700">
                    {selectedDispute.admin_note}
                  </p>
                </div>
              )}

              {selectedDispute.resolution_note && (
                <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                  <p className="text-xs font-black uppercase tracking-wide text-emerald-500">
                    Resolution Note
                  </p>
                  <p className="mt-2 whitespace-pre-wrap break-words text-sm font-semibold leading-6 text-emerald-700">
                    {selectedDispute.resolution_note}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}