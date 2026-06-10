'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  Eye,
  FileImage,
  FileWarning,
  Loader2,
  MessageSquareWarning,
  RefreshCw,
  Search,
  ShieldAlert,
  UserRound,
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

type DisputePriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

type AdminActionStatus =
  | 'OPEN'
  | 'UNDER_REVIEW'
  | 'WAITING_FOR_USER'
  | 'RESOLVED'
  | 'REJECTED'
  | 'CANCELLED';

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

  reporter?: {
    id: string;
    full_name: string | null;
    phone: string | null;
    email: string | null;
    role: string | null;
    status: string | null;
    verification_status: string | null;
  } | null;

  related_user?: {
    id: string;
    full_name: string | null;
    phone: string | null;
    email: string | null;
    role: string | null;
    status: string | null;
    verification_status: string | null;
  } | null;

  assigned_admin?: {
    id: string;
    full_name: string | null;
    phone: string | null;
    email: string | null;
    role: string | null;
  } | null;

  resolved_by_profile?: {
    id: string;
    full_name: string | null;
    phone: string | null;
    email: string | null;
    role: string | null;
  } | null;

  fund_space?: {
    id: string;
    name: string | null;
    status: string | null;
    contribution_amount: number | string | null;
    current_round_number: number | null;
  } | null;

  round?: {
    id: string;
    fund_space_id: string;
    round_number: number | null;
    status: string | null;
    contribution_deadline: string | null;
  } | null;

  contribution?: {
    id: string;
    fund_space_id: string;
    round_id: string;
    user_id: string;
    status: string | null;
    amount_due: number | string | null;
    amount_paid: number | string | null;
    payment_reference: string | null;
    paid_at: string | null;
  } | null;

  payout?: {
    id: string;
    fund_space_id: string;
    round_id: string;
    recipient_user_id: string;
    status: string | null;
    gross_amount: number | string | null;
    net_amount: number | string | null;
    paid_at: string | null;
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

type SummaryItemData = {
  label: string;
  value: string | number;
  helper?: string;
  onClick: () => void;
};

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

const statusTabs: { label: string; value: DisputeStatus }[] = [
  { label: 'All', value: 'ALL' },
  { label: 'Open', value: 'OPEN' },
  { label: 'Under Review', value: 'UNDER_REVIEW' },
  { label: 'Waiting', value: 'WAITING_FOR_USER' },
  { label: 'Resolved', value: 'RESOLVED' },
  { label: 'Rejected', value: 'REJECTED' },
  { label: 'Cancelled', value: 'CANCELLED' },
];

const priorityTabs: { label: string; value: 'ALL' | DisputePriority }[] = [
  { label: 'All Priority', value: 'ALL' },
  { label: 'Urgent', value: 'URGENT' },
  { label: 'High', value: 'HIGH' },
  { label: 'Normal', value: 'NORMAL' },
  { label: 'Low', value: 'LOW' },
];

const statusOptions: { label: string; value: AdminActionStatus }[] = [
  { label: 'Open', value: 'OPEN' },
  { label: 'Under Review', value: 'UNDER_REVIEW' },
  { label: 'Waiting For User', value: 'WAITING_FOR_USER' },
  { label: 'Resolved', value: 'RESOLVED' },
  { label: 'Rejected', value: 'REJECTED' },
  { label: 'Cancelled', value: 'CANCELLED' },
];

const priorityOptions: { label: string; value: DisputePriority }[] = [
  { label: 'Low', value: 'LOW' },
  { label: 'Normal', value: 'NORMAL' },
  { label: 'High', value: 'HIGH' },
  { label: 'Urgent', value: 'URGENT' },
];

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

  return `GH₵${
    Number.isFinite(parsed)
      ? parsed.toLocaleString('en-GH', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      : '0.00'
  }`;
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

  if (['URGENT', 'HIGH'].includes(value)) {
    return 'border-orange-200 bg-orange-50 text-orange-700';
  }

  return 'border-slate-200 bg-slate-50 text-slate-700';
}

function getReporterName(dispute: Dispute) {
  return dispute.reporter?.full_name || 'Unknown reporter';
}

function getReporterPhone(dispute: Dispute) {
  return dispute.reporter?.phone || 'No phone';
}

function isClosedStatus(status: string | null | undefined) {
  return ['RESOLVED', 'REJECTED', 'CANCELLED'].includes(normalizeStatus(status));
}

function getDisputeState(dispute: Dispute) {
  const status = normalizeStatus(dispute.status);

  if (status === 'OPEN') {
    return {
      title: 'Open Complaint',
      description:
        'This complaint is new or still open. Admin should review the evidence and take action.',
      className: 'border-amber-200 bg-amber-50 text-amber-800',
    };
  }

  if (status === 'UNDER_REVIEW') {
    return {
      title: 'Under Review',
      description:
        'This complaint is currently being reviewed by admin. Continue investigation before closing.',
      className: 'border-blue-200 bg-blue-50 text-blue-800',
    };
  }

  if (status === 'WAITING_FOR_USER') {
    return {
      title: 'Waiting For User',
      description:
        'Admin needs more information or response from the user before resolving the complaint.',
      className: 'border-amber-200 bg-amber-50 text-amber-800',
    };
  }

  if (status === 'RESOLVED') {
    return {
      title: 'Already Resolved',
      description:
        dispute.resolution_note ||
        'This complaint has already been resolved. No further action is required unless reopened.',
      className: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    };
  }

  if (status === 'REJECTED') {
    return {
      title: 'Already Rejected',
      description:
        dispute.resolution_note ||
        'This complaint has been rejected or closed as invalid.',
      className: 'border-red-200 bg-red-50 text-red-800',
    };
  }

  if (status === 'CANCELLED') {
    return {
      title: 'Complaint Cancelled',
      description:
        dispute.resolution_note ||
        'This complaint has been cancelled and is no longer active.',
      className: 'border-red-200 bg-red-50 text-red-800',
    };
  }

  return {
    title: formatLabel(status),
    description: 'Review this complaint before taking admin action.',
    className: 'border-slate-200 bg-white text-slate-700',
  };
}

function getQuickActionLabel(dispute: Dispute) {
  const status = normalizeStatus(dispute.status);

  if (status === 'OPEN') return 'Mark Under Review';
  if (status === 'UNDER_REVIEW') return 'Resolve / Update';
  if (status === 'WAITING_FOR_USER') return 'Update Response';
  if (status === 'RESOLVED') return 'Already Resolved';
  if (status === 'REJECTED') return 'Already Rejected';
  if (status === 'CANCELLED') return 'Already Cancelled';

  return 'Manage Complaint';
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

function SummaryItem({ item }: { item: SummaryItemData }) {
  return (
    <button
      type="button"
      onClick={item.onClick}
      className="group min-w-0 rounded-2xl border border-white/70 bg-white/10 p-4 text-left text-white transition hover:-translate-y-0.5 hover:bg-white/20 hover:shadow-lg"
    >
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-black uppercase tracking-wide text-emerald-50/90">
            {item.label}
          </p>

          <p className="mt-2 truncate text-2xl font-black text-white md:text-3xl">
            {item.value}
          </p>

          {item.helper && (
            <p className="mt-1 truncate text-xs font-semibold text-emerald-50/80">
              {item.helper}
            </p>
          )}
        </div>

        <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-emerald-50/80 transition group-hover:translate-x-1 group-hover:text-white" />
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
  type: 'success' | 'error' | 'info';
  message: string;
}) {
  const isSuccess = type === 'success';
  const isInfo = type === 'info';

  return (
    <div
      className={`rounded-3xl border p-5 ${
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
        <p className="min-w-0 break-words text-sm font-bold leading-6">
          {message}
        </p>
      </div>
    </div>
  );
}

export default function AdminFundSpaceDisputesPage() {
  const searchParams = useSearchParams();

  const initialFundSpaceId = searchParams.get('fund_space_id') || '';

  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [summary, setSummary] = useState(emptySummary);

  const [statusFilter, setStatusFilter] = useState<DisputeStatus>('ALL');
  const [priorityFilter, setPriorityFilter] =
    useState<'ALL' | DisputePriority>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDispute, setSelectedDispute] = useState<Dispute | null>(null);
  const [manageDispute, setManageDispute] = useState<Dispute | null>(null);

  const [newStatus, setNewStatus] =
    useState<AdminActionStatus>('UNDER_REVIEW');
  const [newPriority, setNewPriority] = useState<DisputePriority>('NORMAL');
  const [adminNote, setAdminNote] = useState('');
  const [resolutionNote, setResolutionNote] = useState('');

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [notice, setNotice] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

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
        params.set('limit', '500');

        if (statusFilter !== 'ALL') {
          params.set('status', statusFilter);
        }

        if (initialFundSpaceId) {
          params.set('fund_space_id', initialFundSpaceId);
        }

        const response = await fetch(
          `/api/fund-space/disputes?${params.toString()}`,
          {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
          }
        );

        const result = await readApiResponse(response);

        if (!response.ok || !result.success) {
          throw new Error(result.message || 'Unable to load complaints.');
        }

        setDisputes(result.disputes || []);
        setSummary(result.summary || emptySummary);
      } catch (error) {
        setDisputes([]);
        setSummary(emptySummary);
        setNotice({
          type: 'error',
          text:
            error instanceof Error
              ? error.message
              : 'Unable to load admin complaint records.',
        });
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [initialFundSpaceId, statusFilter]
  );

  useEffect(() => {
    loadDisputes();
  }, [loadDisputes]);

  const filteredDisputes = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    return disputes.filter((dispute) => {
      const matchesPriority =
        priorityFilter === 'ALL' ||
        normalizeStatus(dispute.priority) === priorityFilter;

      const haystack = [
        dispute.subject,
        dispute.message,
        dispute.category,
        dispute.priority,
        dispute.status,
        dispute.reporter?.full_name,
        dispute.reporter?.phone,
        dispute.reporter?.email,
        dispute.related_user?.full_name,
        dispute.related_user?.phone,
        dispute.fund_space?.name,
        dispute.round?.round_number ? `round ${dispute.round.round_number}` : '',
        dispute.admin_note,
        dispute.resolution_note,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      const matchesSearch = !search || haystack.includes(search);

      return matchesPriority && matchesSearch;
    });
  }, [disputes, priorityFilter, searchTerm]);

  const summaryItems: SummaryItemData[] = [
    {
      label: 'Total',
      value: summary.total,
      helper: 'All complaints',
      onClick: () => setStatusFilter('ALL'),
    },
    {
      label: 'Open',
      value: summary.open,
      helper: 'New complaints',
      onClick: () => setStatusFilter('OPEN'),
    },
    {
      label: 'Under Review',
      value: summary.under_review,
      helper: 'Being handled',
      onClick: () => setStatusFilter('UNDER_REVIEW'),
    },
    {
      label: 'Waiting',
      value: summary.waiting_for_user,
      helper: 'Needs user reply',
      onClick: () => setStatusFilter('WAITING_FOR_USER'),
    },
    {
      label: 'Resolved',
      value: summary.resolved,
      helper: 'Closed cases',
      onClick: () => setStatusFilter('RESOLVED'),
    },
    {
      label: 'Rejected',
      value: summary.rejected,
      helper: 'Not accepted',
      onClick: () => setStatusFilter('REJECTED'),
    },
  ];

  function openManageModal(dispute: Dispute) {
    const status = normalizeStatus(dispute.status);
    const priority = normalizeStatus(dispute.priority);

    setManageDispute(dispute);
    setNewStatus(
      statusOptions.some((option) => option.value === status)
        ? (status as AdminActionStatus)
        : 'UNDER_REVIEW'
    );
    setNewPriority(
      priorityOptions.some((option) => option.value === priority)
        ? (priority as DisputePriority)
        : 'NORMAL'
    );
    setAdminNote(dispute.admin_note || '');
    setResolutionNote(dispute.resolution_note || '');
  }

  async function quickSetStatus(
    dispute: Dispute,
    status: AdminActionStatus,
    note?: string
  ) {
    if (isClosedStatus(dispute.status)) {
      openManageModal(dispute);
      return;
    }

    try {
      setUpdating(true);
      setNotice(null);

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.access_token) {
        throw new Error('Your session has expired. Please log in again.');
      }

      const response = await fetch('/api/admin/fund-space/disputes', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dispute_id: dispute.id,
          status,
          priority: dispute.priority || 'NORMAL',
          admin_note: note || dispute.admin_note || '',
          resolution_note: dispute.resolution_note || '',
        }),
      });

      const result = await readApiResponse(response);

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Unable to update complaint.');
      }

      setNotice({
        type: 'success',
        text: result.message || 'Complaint updated successfully.',
      });

      await loadDisputes(true);
    } catch (error) {
      setNotice({
        type: 'error',
        text:
          error instanceof Error
            ? error.message
            : 'Something went wrong while updating complaint.',
      });
    } finally {
      setUpdating(false);
    }
  }

  async function handleUpdateDispute(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!manageDispute) {
      setNotice({
        type: 'error',
        text: 'No complaint selected.',
      });
      return;
    }

    if (
      ['RESOLVED', 'REJECTED', 'CANCELLED'].includes(newStatus) &&
      !resolutionNote.trim()
    ) {
      setNotice({
        type: 'error',
        text: 'Please add a resolution note before closing this complaint.',
      });
      return;
    }

    try {
      setUpdating(true);
      setNotice(null);

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.access_token) {
        throw new Error('Your session has expired. Please log in again.');
      }

      const response = await fetch('/api/admin/fund-space/disputes', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dispute_id: manageDispute.id,
          status: newStatus,
          priority: newPriority,
          admin_note: adminNote,
          resolution_note: resolutionNote,
        }),
      });

      const result = await readApiResponse(response);

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Unable to update complaint.');
      }

      setNotice({
        type: 'success',
        text: result.message || 'Complaint updated successfully.',
      });

      setManageDispute(null);
      setAdminNote('');
      setResolutionNote('');
      await loadDisputes(true);
    } catch (error) {
      setNotice({
        type: 'error',
        text:
          error instanceof Error
            ? error.message
            : 'Something went wrong while updating complaint.',
      });
    } finally {
      setUpdating(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-6">
        <div className="mx-auto flex min-h-[60vh] max-w-6xl items-center justify-center">
          <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-emerald-700" />
            <p className="mt-4 text-sm font-black text-slate-600">
              Loading admin complaints...
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
            onClick={() => loadDisputes(true)}
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
                  <MessageSquareWarning className="h-4 w-4" />
                  Admin Fund Space Complaints
                </p>

                <h1 className="mt-5 text-3xl font-black tracking-tight md:text-5xl">
                  Fund Space Complaints
                </h1>

                <p className="mt-4 max-w-3xl text-sm font-semibold leading-7 text-emerald-50 md:text-base">
                  Review member and agent complaints, inspect evidence, update
                  complaint status, add admin notes, and resolve payment or payout
                  issues clearly.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Link
                  href="/admin/fund-space"
                  className="inline-flex min-h-9 items-center justify-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 text-xs font-black text-white ring-1 ring-white/10 transition hover:bg-white/20"
                >
                  Fund Spaces
                </Link>

                <Link
                  href="/admin/manual-payment-submissions"
                  className="inline-flex min-h-9 items-center justify-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 text-xs font-black text-white ring-1 ring-white/10 transition hover:bg-white/20"
                >
                  MoMo Reviews
                </Link>

                <Link
                  href="/admin/fund-space/contributions"
                  className="inline-flex min-h-9 items-center justify-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 text-xs font-black text-white ring-1 ring-white/10 transition hover:bg-white/20"
                >
                  Contributions
                </Link>
              </div>
            </div>

            <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              {summaryItems.map((item) => (
                <SummaryItem key={item.label} item={item} />
              ))}
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <SummaryItem
                item={{
                  label: 'Urgent',
                  value: summary.urgent,
                  helper: 'Highest priority',
                  onClick: () => setPriorityFilter('URGENT'),
                }}
              />

              <SummaryItem
                item={{
                  label: 'High Priority',
                  value: summary.high,
                  helper: 'Needs quick action',
                  onClick: () => setPriorityFilter('HIGH'),
                }}
              />
            </div>
          </div>
        </section>

        {notice && <MessageBox type={notice.type} message={notice.text} />}

        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="space-y-3">
            <div className="relative min-w-0">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search complaint, reporter, phone, customer, Fund Space..."
                className="min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm font-semibold outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-100"
              />
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-7">
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

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              {priorityTabs.map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setPriorityFilter(tab.value)}
                  className={`min-h-11 rounded-2xl px-3 text-xs font-black transition ${
                    priorityFilter === tab.value
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <span className="line-clamp-1">{tab.label}</span>
                </button>
              ))}
            </div>
          </div>

          <p className="mt-3 rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-600">
            Showing {filteredDisputes.length} complaint records.
          </p>
        </section>

        <section className="space-y-4">
          {filteredDisputes.length === 0 ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
              <FileWarning className="mx-auto h-10 w-10 text-slate-300" />
              <h2 className="mt-4 text-lg font-black text-slate-900">
                No complaints found
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                Try another filter, search term, or refresh the page.
              </p>
            </div>
          ) : (
            filteredDisputes.map((dispute) => {
              const disputeState = getDisputeState(dispute);
              const closed = isClosedStatus(dispute.status);

              return (
                <article
                  key={dispute.id}
                  className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:border-emerald-200 hover:shadow-md"
                >
                  <div className="grid gap-5 p-5 xl:grid-cols-[1fr_300px] xl:items-start">
                    <div className="min-w-0">
                      <div className="flex flex-wrap gap-2">
                        <StatusPill status={dispute.status} />
                        <StatusPill status={dispute.priority} />
                        <StatusPill status={dispute.category} />
                      </div>

                      <div className="mt-4 flex items-start gap-3">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                          <UserRound className="h-5 w-5" />
                        </div>

                        <div className="min-w-0">
                          <h2 className="line-clamp-2 break-words text-lg font-black leading-6 text-slate-900">
                            {dispute.subject}
                          </h2>

                          <p className="mt-1 truncate text-sm font-semibold text-slate-500">
                            {getReporterName(dispute)} • {getReporterPhone(dispute)}
                          </p>
                        </div>
                      </div>

                      <p className="mt-3 line-clamp-2 break-words text-sm font-semibold leading-6 text-slate-500">
                        {dispute.message}
                      </p>

                      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        <CompactInfo
                          label="Related Customer"
                          value={dispute.related_user?.full_name || 'Not linked'}
                        />

                        <CompactInfo
                          label="Fund Space"
                          value={dispute.fund_space?.name || 'Not linked'}
                        />

                        <CompactInfo
                          label="Round"
                          value={
                            dispute.round?.round_number
                              ? `Round ${dispute.round.round_number}`
                              : 'Not set'
                          }
                        />

                        <CompactInfo
                          label="Created"
                          value={formatDateTime(dispute.created_at)}
                        />
                      </div>
                    </div>

                    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                      <p className="mb-4 text-sm font-black text-slate-900">
                        Complaint Actions
                      </p>

                      <div
                        className={`mb-4 rounded-2xl border p-4 ${disputeState.className}`}
                      >
                        <p className="text-sm font-black">{disputeState.title}</p>
                        <p className="mt-1 text-xs font-semibold leading-5">
                          {disputeState.description}
                        </p>
                      </div>

                      <div className="grid gap-3">
                        <button
                          type="button"
                          onClick={() => setSelectedDispute(dispute)}
                          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-4 text-sm font-black text-white hover:bg-emerald-800"
                        >
                          <Eye className="h-4 w-4" />
                          View Details
                        </button>

                        <button
                          type="button"
                          onClick={() => openManageModal(dispute)}
                          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 hover:bg-slate-50"
                        >
                          <MessageSquareWarning className="h-4 w-4" />
                          {getQuickActionLabel(dispute)}
                        </button>

                        {!closed && normalizeStatus(dispute.status) === 'OPEN' && (
                          <button
                            type="button"
                            disabled={updating}
                            onClick={() =>
                              quickSetStatus(
                                dispute,
                                'UNDER_REVIEW',
                                'Admin has started reviewing this complaint.'
                              )
                            }
                            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-blue-200 bg-blue-50 px-4 text-sm font-black text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <Clock className="h-4 w-4" />
                            Mark Under Review
                          </button>
                        )}

                        {closed ? (
                          <div
                            className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border px-4 text-sm font-black ${
                              normalizeStatus(dispute.status) === 'RESOLVED'
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                : 'border-red-200 bg-red-50 text-red-700'
                            }`}
                          >
                            {normalizeStatus(dispute.status) === 'RESOLVED' ? (
                              <CheckCircle2 className="h-4 w-4" />
                            ) : (
                              <XCircle className="h-4 w-4" />
                            )}
                            {getQuickActionLabel(dispute)}
                          </div>
                        ) : (
                          <div className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 text-sm font-black text-amber-700">
                            <Clock className="h-4 w-4" />
                            Active Complaint
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

        <section className="rounded-3xl border border-amber-100 bg-amber-50 p-5">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-1 h-5 w-5 shrink-0 text-amber-700" />

            <div className="min-w-0">
              <h2 className="text-base font-black text-amber-900">
                Admin Complaint Rule
              </h2>

              <p className="mt-2 break-words text-sm font-semibold leading-6 text-amber-700">
                Always check the complaint details, evidence screenshot, related
                Fund Space, contribution, or payout before resolving or rejecting
                any complaint.
              </p>
            </div>
          </div>
        </section>
      </div>

      {selectedDispute && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-3 py-4">
          <div className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
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
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <CompactInfo
                  label="Status"
                  value={formatLabel(selectedDispute.status)}
                />
                <CompactInfo
                  label="Priority"
                  value={formatLabel(selectedDispute.priority)}
                />
                <CompactInfo
                  label="Category"
                  value={formatLabel(selectedDispute.category)}
                />
                <CompactInfo
                  label="Reporter"
                  value={getReporterName(selectedDispute)}
                />
                <CompactInfo
                  label="Reporter Phone"
                  value={getReporterPhone(selectedDispute)}
                />
                <CompactInfo
                  label="Related Customer"
                  value={selectedDispute.related_user?.full_name || 'Not linked'}
                />
                <CompactInfo
                  label="Fund Space"
                  value={selectedDispute.fund_space?.name || 'Not linked'}
                />
                <CompactInfo
                  label="Round"
                  value={
                    selectedDispute.round?.round_number
                      ? `Round ${selectedDispute.round.round_number}`
                      : 'Not set'
                  }
                />
                <CompactInfo
                  label="Created"
                  value={formatDateTime(selectedDispute.created_at)}
                />
                <CompactInfo
                  label="Updated"
                  value={formatDateTime(selectedDispute.updated_at)}
                />
                <CompactInfo
                  label="Resolved At"
                  value={formatDateTime(selectedDispute.resolved_at)}
                />
                <CompactInfo
                  label="Resolved By"
                  value={
                    selectedDispute.resolved_by_profile?.full_name || 'Not set'
                  }
                />
              </div>

              <div className="mt-5 rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-black uppercase tracking-wide text-slate-400">
                  Complaint Message
                </p>
                <p className="mt-2 whitespace-pre-wrap break-words text-sm font-semibold leading-6 text-slate-700">
                  {selectedDispute.message}
                </p>
              </div>

              {selectedDispute.contribution && (
                <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-black uppercase tracking-wide text-slate-400">
                    Linked Contribution
                  </p>

                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <CompactInfo
                      label="Status"
                      value={formatLabel(selectedDispute.contribution.status)}
                    />
                    <CompactInfo
                      label="Amount Due"
                      value={formatCurrency(selectedDispute.contribution.amount_due)}
                    />
                    <CompactInfo
                      label="Amount Paid"
                      value={formatCurrency(selectedDispute.contribution.amount_paid)}
                    />
                    <CompactInfo
                      label="Reference"
                      value={
                        selectedDispute.contribution.payment_reference || 'None'
                      }
                    />
                  </div>
                </div>
              )}

              {selectedDispute.payout && (
                <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-black uppercase tracking-wide text-slate-400">
                    Linked Payout
                  </p>

                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <CompactInfo
                      label="Status"
                      value={formatLabel(selectedDispute.payout.status)}
                    />
                    <CompactInfo
                      label="Gross Amount"
                      value={formatCurrency(selectedDispute.payout.gross_amount)}
                    />
                    <CompactInfo
                      label="Net Amount"
                      value={formatCurrency(selectedDispute.payout.net_amount)}
                    />
                    <CompactInfo
                      label="Paid At"
                      value={formatDateTime(selectedDispute.payout.paid_at)}
                    />
                  </div>
                </div>
              )}

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

      {manageDispute && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-3 py-4">
          <form
            onSubmit={handleUpdateDispute}
            className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
          >
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
              <div className="min-w-0">
                <h2 className="text-lg font-black text-slate-900">
                  Manage Complaint
                </h2>
                <p className="mt-1 truncate text-sm text-slate-500">
                  {manageDispute.subject}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setManageDispute(null)}
                className="rounded-2xl p-2 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
              <div className={`rounded-2xl border p-4 ${getDisputeState(manageDispute).className}`}>
                <p className="text-sm font-black">
                  {getDisputeState(manageDispute).title}
                </p>
                <p className="mt-1 text-xs font-semibold leading-5">
                  {getDisputeState(manageDispute).description}
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-black uppercase tracking-wide text-slate-500">
                    Status
                  </label>
                  <select
                    value={newStatus}
                    onChange={(event) =>
                      setNewStatus(event.target.value as AdminActionStatus)
                    }
                    className="mt-2 min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-900 outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-100"
                  >
                    {statusOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-black uppercase tracking-wide text-slate-500">
                    Priority
                  </label>
                  <select
                    value={newPriority}
                    onChange={(event) =>
                      setNewPriority(event.target.value as DisputePriority)
                    }
                    className="mt-2 min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-900 outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-100"
                  >
                    {priorityOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-black uppercase tracking-wide text-slate-500">
                  Admin Note
                </label>
                <textarea
                  value={adminNote}
                  onChange={(event) => setAdminNote(event.target.value)}
                  rows={4}
                  placeholder="Internal/admin note or message to help explain the review."
                  className="mt-2 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold leading-6 text-slate-900 outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-100"
                />
              </div>

              <div>
                <label className="text-xs font-black uppercase tracking-wide text-slate-500">
                  Resolution Note
                </label>
                <textarea
                  value={resolutionNote}
                  onChange={(event) => setResolutionNote(event.target.value)}
                  rows={4}
                  placeholder="Required when resolving, rejecting, or cancelling the complaint."
                  className="mt-2 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold leading-6 text-slate-900 outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-100"
                />
              </div>
            </div>

            <div className="grid shrink-0 gap-3 border-t border-slate-100 p-5 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setManageDispute(null)}
                className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={updating}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-4 text-sm font-black text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {updating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                Save Update
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}