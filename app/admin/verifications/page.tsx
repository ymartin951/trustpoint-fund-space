'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  AlertCircle,
  ArrowLeft,
  BadgeCheck,
  Briefcase,
  Calendar,
  CheckCircle2,
  Eye,
  FileText,
  ImageIcon,
  Landmark,
  Loader2,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  User,
  X,
  XCircle,
} from 'lucide-react';

import { supabase } from '@/lib/supabase/client';

type VerificationStatus =
  | 'ALL'
  | 'PENDING'
  | 'RESUBMITTED'
  | 'APPROVED'
  | 'REJECTED';

type RelatedProfile = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  role: string;
};

type VerificationRequest = {
  id: string;
  user_id: string;
  full_name: string;
  phone: string;
  email: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  location: string | null;
  gender: string | null;
  date_of_birth: string | null;
  user_category: string;
  occupation: string | null;
  employer_name: string | null;
  staff_id: string | null;
  business_name: string | null;
  business_type: string | null;
  business_location: string | null;
  ghana_card_number: string;
  ghana_card_front_url: string | null;
  ghana_card_back_url: string | null;
  selfie_url: string | null;
  employment_proof_url: string | null;
  business_proof_url: string | null;
  ghana_card_front_signed_url: string | null;
  ghana_card_back_signed_url: string | null;
  selfie_signed_url: string | null;
  employment_proof_signed_url: string | null;
  business_proof_signed_url: string | null;
  momo_number: string | null;
  bank_name: string | null;
  bank_account_number: string | null;
  bank_account_name: string | null;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  submitted_by_agent: string | null;
  submitted_by_agent_profile: RelatedProfile | null;
  status: string;
  is_resubmitted: boolean;
  rejection_reason: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  reviewed_by_profile: RelatedProfile | null;
  created_at: string | null;
  updated_at: string | null;
};

type Stats = {
  all: number;
  pending: number;
  resubmitted: number;
  approved: number;
  rejected: number;
};

type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

type StatCardItem = {
  title: string;
  value: string | number;
  helper: string;
  href: string;
  status: VerificationStatus;
  icon: ReactNode;
};

const defaultStats: Stats = {
  all: 0,
  pending: 0,
  resubmitted: 0,
  approved: 0,
  rejected: 0,
};

const statusTabs: { label: string; value: VerificationStatus; href: string }[] = [
  {
    label: 'Pending',
    value: 'PENDING',
    href: '/admin/verifications?status=PENDING',
  },
  {
    label: 'Resubmitted',
    value: 'RESUBMITTED',
    href: '/admin/verifications?status=RESUBMITTED',
  },
  {
    label: 'Approved',
    value: 'APPROVED',
    href: '/admin/verifications?status=APPROVED',
  },
  {
    label: 'Rejected',
    value: 'REJECTED',
    href: '/admin/verifications?status=REJECTED',
  },
  {
    label: 'All',
    value: 'ALL',
    href: '/admin/verifications?status=ALL',
  },
];

function normalize(value: string | null | undefined) {
  return String(value || '').trim().toUpperCase();
}

function formatDate(date?: string | null) {
  if (!date) return 'Not provided';

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) return 'Invalid date';

  return new Intl.DateTimeFormat('en-GH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(parsedDate);
}

function formatDateTime(date?: string | null) {
  if (!date) return 'Not provided';

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) return 'Invalid date';

  return new Intl.DateTimeFormat('en-GH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsedDate);
}

function formatLabel(value?: string | null) {
  if (!value) return 'Not provided';

  return value
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getStatusBadge(status?: string | null) {
  const value = normalize(status);

  if (value === 'APPROVED') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }

  if (value === 'REJECTED') {
    return 'border-red-200 bg-red-50 text-red-700';
  }

  if (value === 'RESUBMITTED') {
    return 'border-blue-200 bg-blue-50 text-blue-700';
  }

  return 'border-amber-200 bg-amber-50 text-amber-700';
}

function getStatusIcon(status?: string | null) {
  const value = normalize(status);

  if (value === 'APPROVED') return <ShieldCheck className="h-4 w-4" />;
  if (value === 'REJECTED') return <ShieldX className="h-4 w-4" />;

  return <ShieldAlert className="h-4 w-4" />;
}

function getReviewState(request: VerificationRequest) {
  const status = normalize(request.status);

  if (status === 'APPROVED') {
    return {
      title: 'Verification Approved',
      description:
        'This customer verification has already been approved. No further approval action is required.',
      className: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    };
  }

  if (status === 'REJECTED') {
    return {
      title: 'Verification Rejected',
      description:
        request.rejection_reason ||
        'This verification request was rejected. Check the reason before taking any further action.',
      className: 'border-red-200 bg-red-50 text-red-800',
    };
  }

  if (request.is_resubmitted || status === 'RESUBMITTED') {
    return {
      title: 'Resubmitted for Review',
      description:
        'This customer has resubmitted documents. Review the latest details carefully before approving.',
      className: 'border-blue-200 bg-blue-50 text-blue-800',
    };
  }

  return {
    title: 'Pending Admin Review',
    description:
      'This verification request is waiting for admin approval or rejection.',
    className: 'border-amber-200 bg-amber-50 text-amber-800',
  };
}

function canApproveRequest(request: VerificationRequest) {
  const status = normalize(request.status);
  return status !== 'APPROVED';
}

function canRejectRequest(request: VerificationRequest) {
  const status = normalize(request.status);
  return status !== 'REJECTED';
}

function getApproveButtonText(request: VerificationRequest, loading: boolean) {
  const status = normalize(request.status);

  if (loading) return 'Approving...';
  if (status === 'APPROVED') return 'Verification Approved';
  if (status === 'REJECTED') return 'Approve After Rejection';

  if (request.is_resubmitted || status === 'RESUBMITTED') {
    return 'Approve Resubmission';
  }

  return 'Approve Request';
}

function getRejectButtonText(request: VerificationRequest, loading: boolean) {
  const status = normalize(request.status);

  if (loading) return 'Rejecting...';
  if (status === 'APPROVED') return 'Reject Approved Request';
  if (status === 'REJECTED') return 'Verification Rejected';

  if (request.is_resubmitted || status === 'RESUBMITTED') {
    return 'Reject Resubmission';
  }

  return 'Reject Request';
}

function getApproveButtonClass(request: VerificationRequest) {
  const status = normalize(request.status);

  if (status === 'APPROVED') {
    return 'bg-emerald-100 text-emerald-800';
  }

  if (status === 'REJECTED') {
    return 'bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60';
  }

  return 'bg-emerald-700 text-white hover:bg-emerald-800 disabled:opacity-60';
}

function getRejectButtonClass(request: VerificationRequest) {
  const status = normalize(request.status);

  if (status === 'REJECTED') {
    return 'border-red-200 bg-red-100 text-red-800';
  }

  if (status === 'APPROVED') {
    return 'border-slate-200 bg-slate-200 text-slate-600';
  }

  return 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-60';
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value?: string | number | null;
}) {
  return (
    <div className="flex min-w-0 items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4">
      <div className="mt-0.5 shrink-0 text-slate-500">{icon}</div>

      <div className="min-w-0">
        <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">
          {label}
        </p>

        <p className="mt-1 break-words text-sm font-bold text-slate-900">
          {value || 'Not provided'}
        </p>
      </div>
    </div>
  );
}

function StatCard({ item, active }: { item: StatCardItem; active: boolean }) {
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

export default function AdminVerificationsPage() {
  const searchParams = useSearchParams();

  const [requests, setRequests] = useState<VerificationRequest[]>([]);
  const [stats, setStats] = useState<Stats>(defaultStats);

  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });

  const [selectedStatus, setSelectedStatus] =
    useState<VerificationStatus>('PENDING');

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  const [selectedRequest, setSelectedRequest] =
    useState<VerificationRequest | null>(null);

  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionTargetId, setActionTargetId] = useState('');
  const [actionType, setActionType] = useState<'APPROVE' | 'REJECT' | ''>('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    const urlStatus = normalize(searchParams.get('status'));

    if (
      ['ALL', 'PENDING', 'RESUBMITTED', 'APPROVED', 'REJECTED'].includes(
        urlStatus
      )
    ) {
      setSelectedStatus(urlStatus as VerificationStatus);
    }
  }, [searchParams]);

  const selectedDocuments = useMemo(() => {
    if (!selectedRequest) return [];

    return [
      {
        label: 'Ghana Card Front',
        url: selectedRequest.ghana_card_front_signed_url,
      },
      {
        label: 'Ghana Card Back',
        url: selectedRequest.ghana_card_back_signed_url,
      },
      {
        label: 'Selfie / Passport Photo',
        url: selectedRequest.selfie_signed_url,
      },
      {
        label: 'Employment Proof',
        url: selectedRequest.employment_proof_signed_url,
      },
      {
        label: 'Business Proof',
        url: selectedRequest.business_proof_signed_url,
      },
    ];
  }, [selectedRequest]);

  const statCards: StatCardItem[] = [
    {
      title: 'Pending',
      value: stats.pending,
      helper: 'Needs admin review',
      href: '/admin/verifications?status=PENDING',
      status: 'PENDING',
      icon: <ShieldAlert className="h-4 w-4" />,
    },
    {
      title: 'Resubmitted',
      value: stats.resubmitted,
      helper: 'Returned for review',
      href: '/admin/verifications?status=RESUBMITTED',
      status: 'RESUBMITTED',
      icon: <RefreshCw className="h-4 w-4" />,
    },
    {
      title: 'Approved',
      value: stats.approved,
      helper: 'Trusted customers',
      href: '/admin/verifications?status=APPROVED',
      status: 'APPROVED',
      icon: <ShieldCheck className="h-4 w-4" />,
    },
    {
      title: 'Rejected',
      value: stats.rejected,
      helper: 'Needs correction',
      href: '/admin/verifications?status=REJECTED',
      status: 'REJECTED',
      icon: <ShieldX className="h-4 w-4" />,
    },
    {
      title: 'All Requests',
      value: stats.all,
      helper: 'Every KYC request',
      href: '/admin/verifications?status=ALL',
      status: 'ALL',
      icon: <BadgeCheck className="h-4 w-4" />,
    },
  ];

  async function getAuthToken() {
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session?.access_token) {
      throw new Error('You are not logged in. Please log in again.');
    }

    return session.access_token;
  }

  async function fetchRequests(page = 1) {
    try {
      setLoading(true);
      setError('');
      setSuccessMessage('');

      const token = await getAuthToken();

      const params = new URLSearchParams({
        status: selectedStatus,
        search,
        page: String(page),
        limit: String(pagination.limit),
      });

      const response = await fetch(`/api/admin/verifications?${params}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const responseText = await response.text();
      const result = responseText ? JSON.parse(responseText) : null;

      if (!response.ok || !result?.success) {
        throw new Error(
          result?.message || 'Failed to load verification requests.'
        );
      }

      setRequests(result.requests || []);
      setStats(result.stats || defaultStats);
      setPagination(
        result.pagination || {
          page,
          limit: 20,
          total: 0,
          totalPages: 1,
        }
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  async function handleAction(
    requestId: string,
    action: 'APPROVE' | 'REJECT',
    reason?: string
  ) {
    try {
      setActionLoading(true);
      setActionTargetId(requestId);
      setActionType(action);
      setError('');
      setSuccessMessage('');

      const token = await getAuthToken();

      const response = await fetch(`/api/admin/verifications/${requestId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action,
          reason: reason || '',
        }),
      });

      const responseText = await response.text();
      const result = responseText ? JSON.parse(responseText) : null;

      if (!response.ok || !result?.success) {
        throw new Error(
          result?.message || 'Failed to update verification request.'
        );
      }

      setSuccessMessage(result.message || 'Verification updated successfully.');
      setSelectedRequest(null);
      setRejectModalOpen(false);
      setRejectionReason('');

      await fetchRequests(pagination.page);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setActionLoading(false);
      setActionTargetId('');
      setActionType('');
    }
  }

  function handleSearchSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearch(searchInput.trim());
  }

  useEffect(() => {
    fetchRequests(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStatus, search]);

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
            onClick={() => fetchRequests(pagination.page)}
            disabled={loading}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        <section className="overflow-hidden rounded-[2rem] bg-gradient-to-br from-emerald-950 via-emerald-900 to-emerald-800 text-white shadow-sm">
          <div className="p-5 md:p-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <p className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-xs font-black">
                  <ShieldCheck className="h-4 w-4" />
                  Admin Customer Verification
                </p>

                <h1 className="mt-5 text-3xl font-black tracking-tight md:text-5xl">
                  Customer Verification Review
                </h1>

                <p className="mt-4 max-w-3xl text-sm font-semibold leading-7 text-emerald-50 md:text-base">
                  Review customer KYC documents, inspect ID images, check
                  agent-submitted details, and approve only trusted customers.
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

                <button
                  type="button"
                  onClick={() => fetchRequests(pagination.page)}
                  disabled={loading}
                  className="inline-flex min-h-9 items-center justify-center gap-2 rounded-full bg-white px-4 text-xs font-black text-emerald-900 transition hover:bg-emerald-50 disabled:opacity-60"
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`}
                  />
                  Refresh
                </button>
              </div>
            </div>

            <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {statCards.map((item) => (
                <StatCard
                  key={item.title}
                  item={item}
                  active={selectedStatus === item.status}
                />
              ))}
            </div>
          </div>
        </section>

        {error && <MessageBox type="error" message={error} />}
        {successMessage && (
          <MessageBox type="success" message={successMessage} />
        )}

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
            <form
              onSubmit={handleSearchSubmit}
              className="grid gap-2 sm:grid-cols-[1fr_auto]"
            >
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                <input
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Search name, phone, Ghana Card..."
                  className="min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm font-semibold outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
              </div>

              <button
                type="submit"
                className="min-h-12 rounded-2xl bg-slate-900 px-5 text-sm font-black text-white transition hover:bg-slate-800"
              >
                Search
              </button>
            </form>

            <div className="flex gap-2 overflow-x-auto pb-1">
              {statusTabs.map((tab) => (
                <Link
                  key={tab.value}
                  href={tab.href}
                  className={`shrink-0 rounded-2xl px-4 py-3 text-xs font-black transition ${
                    selectedStatus === tab.value
                      ? 'bg-emerald-700 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {tab.label}
                </Link>
              ))}
            </div>
          </div>

          <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-600">
            Showing page {pagination.page} of {pagination.totalPages || 1}.{' '}
            {pagination.total} total records.
          </p>
        </section>

        <section className="space-y-4">
          {loading ? (
            <div className="flex min-h-72 items-center justify-center rounded-3xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center gap-3 text-slate-600">
                <Loader2 className="h-5 w-5 animate-spin" />
                Loading verification requests...
              </div>
            </div>
          ) : requests.length === 0 ? (
            <div className="flex min-h-72 flex-col items-center justify-center rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
              <ShieldCheck className="h-12 w-12 text-slate-300" />

              <h3 className="mt-4 text-lg font-black text-slate-900">
                No verification requests found
              </h3>

              <p className="mt-2 max-w-md text-sm text-slate-500">
                There are no requests matching the selected status or search
                term.
              </p>
            </div>
          ) : (
            requests.map((request) => {
              const reviewState = getReviewState(request);

              const approvingThis =
                actionLoading &&
                actionTargetId === request.id &&
                actionType === 'APPROVE';

              const rejectingThis =
                actionLoading &&
                actionTargetId === request.id &&
                actionType === 'REJECT';

              return (
                <article
                  key={request.id}
                  className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-emerald-200 hover:shadow-md"
                >
                  <div className="grid gap-5 xl:grid-cols-[1fr_280px]">
                    <div className="min-w-0">
                      <div className="flex gap-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                          <User className="h-6 w-6" />
                        </div>

                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="break-words text-base font-black text-slate-900">
                              {request.full_name || 'Unnamed Customer'}
                            </h3>

                            <span
                              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-black ${getStatusBadge(
                                request.status
                              )}`}
                            >
                              {getStatusIcon(request.status)}
                              {formatLabel(request.status || 'PENDING')}
                            </span>

                            {request.is_resubmitted && (
                              <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-black text-blue-700">
                                <RefreshCw className="h-3.5 w-3.5" />
                                Resubmitted
                              </span>
                            )}
                          </div>

                          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm font-semibold text-slate-600">
                            <span className="inline-flex items-center gap-1">
                              <Phone className="h-4 w-4" />
                              {request.phone || 'No phone'}
                            </span>

                            <span className="inline-flex items-center gap-1">
                              <MapPin className="h-4 w-4" />
                              {[request.city, request.region, request.country]
                                .filter(Boolean)
                                .join(', ') || 'No location'}
                            </span>

                            <span className="inline-flex items-center gap-1">
                              <FileText className="h-4 w-4" />
                              {request.ghana_card_number || 'No Ghana Card'}
                            </span>
                          </div>

                          <p className="mt-3 text-sm font-semibold text-slate-500">
                            Submitted by:{' '}
                            <span className="font-black text-slate-700">
                              {request.submitted_by_agent_profile?.full_name ||
                                'Not provided'}
                            </span>{' '}
                            • {formatDate(request.created_at)}
                          </p>
                        </div>
                      </div>

                      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        <InfoRow
                          icon={<Phone className="h-4 w-4" />}
                          label="Phone"
                          value={request.phone}
                        />

                        <InfoRow
                          icon={<Mail className="h-4 w-4" />}
                          label="Email"
                          value={request.email}
                        />

                        <InfoRow
                          icon={<BadgeCheck className="h-4 w-4" />}
                          label="Category"
                          value={formatLabel(request.user_category)}
                        />

                        <InfoRow
                          icon={<Calendar className="h-4 w-4" />}
                          label="Submitted"
                          value={formatDate(request.created_at)}
                        />
                      </div>
                    </div>

                    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                      <p className="mb-4 text-sm font-black text-slate-900">
                        Verification Actions
                      </p>

                      <div
                        className={`mb-4 rounded-2xl border p-4 ${reviewState.className}`}
                      >
                        <p className="text-sm font-black">
                          {reviewState.title}
                        </p>

                        <p className="mt-1 text-xs font-semibold leading-5">
                          {reviewState.description}
                        </p>
                      </div>

                      <div className="grid gap-3">
                        <button
                          type="button"
                          onClick={() => setSelectedRequest(request)}
                          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 hover:bg-slate-50"
                        >
                          <Eye className="h-4 w-4" />
                          Review Details
                        </button>

                        <button
                          type="button"
                          onClick={() => handleAction(request.id, 'APPROVE')}
                          disabled={!canApproveRequest(request) || actionLoading}
                          className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-black transition disabled:cursor-not-allowed ${getApproveButtonClass(
                            request
                          )}`}
                        >
                          {approvingThis ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4" />
                          )}

                          {getApproveButtonText(request, approvingThis)}
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setSelectedRequest(request);
                            setRejectionReason('');
                            setRejectModalOpen(true);
                          }}
                          disabled={!canRejectRequest(request) || actionLoading}
                          className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border px-4 text-sm font-black transition disabled:cursor-not-allowed ${getRejectButtonClass(
                            request
                          )}`}
                        >
                          {rejectingThis ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <XCircle className="h-4 w-4" />
                          )}

                          {getRejectButtonText(request, rejectingThis)}
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </section>

        <div className="flex flex-col items-center justify-between gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row">
          <p className="text-sm font-semibold text-slate-600">
            Showing page {pagination.page} of {pagination.totalPages || 1} •{' '}
            {pagination.total} total records
          </p>

          <div className="flex gap-2">
            <button
              type="button"
              disabled={pagination.page <= 1 || loading}
              onClick={() => fetchRequests(pagination.page - 1)}
              className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>

            <button
              type="button"
              disabled={pagination.page >= pagination.totalPages || loading}
              onClick={() => fetchRequests(pagination.page + 1)}
              className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {selectedRequest && !rejectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="max-h-[90vh] w-full max-w-6xl overflow-y-auto rounded-3xl bg-white shadow-xl">
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-100 bg-white p-5">
              <div>
                <h2 className="text-xl font-black text-slate-900">
                  Review Verification Request
                </h2>

                <p className="text-sm font-semibold text-slate-500">
                  {selectedRequest.full_name}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedRequest(null)}
                className="rounded-2xl p-2 text-slate-500 transition hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-6 p-5">
              <div className="flex flex-wrap items-center gap-3">
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm font-black ${getStatusBadge(
                    selectedRequest.status
                  )}`}
                >
                  {getStatusIcon(selectedRequest.status)}
                  {formatLabel(selectedRequest.status || 'PENDING')}
                </span>

                {selectedRequest.is_resubmitted && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-black text-blue-700">
                    <RefreshCw className="h-4 w-4" />
                    Resubmitted By Agent
                  </span>
                )}

                <span className="rounded-full bg-slate-100 px-3 py-1.5 text-sm font-black text-slate-700">
                  Category: {formatLabel(selectedRequest.user_category)}
                </span>
              </div>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <InfoRow
                  icon={<User className="h-4 w-4" />}
                  label="Full Name"
                  value={selectedRequest.full_name}
                />

                <InfoRow
                  icon={<Phone className="h-4 w-4" />}
                  label="Phone"
                  value={selectedRequest.phone}
                />

                <InfoRow
                  icon={<Mail className="h-4 w-4" />}
                  label="Email"
                  value={selectedRequest.email}
                />

                <InfoRow
                  icon={<MapPin className="h-4 w-4" />}
                  label="Location"
                  value={
                    [
                      selectedRequest.location,
                      selectedRequest.city,
                      selectedRequest.region,
                      selectedRequest.country,
                    ]
                      .filter(Boolean)
                      .join(', ') || null
                  }
                />

                <InfoRow
                  icon={<Calendar className="h-4 w-4" />}
                  label="Date of Birth"
                  value={formatDate(selectedRequest.date_of_birth)}
                />

                <InfoRow
                  icon={<BadgeCheck className="h-4 w-4" />}
                  label="User Category"
                  value={formatLabel(selectedRequest.user_category)}
                />

                <InfoRow
                  icon={<Briefcase className="h-4 w-4" />}
                  label="Occupation"
                  value={selectedRequest.occupation}
                />

                <InfoRow
                  icon={<Briefcase className="h-4 w-4" />}
                  label="Employer"
                  value={selectedRequest.employer_name}
                />

                <InfoRow
                  icon={<FileText className="h-4 w-4" />}
                  label="Staff ID"
                  value={selectedRequest.staff_id}
                />

                <InfoRow
                  icon={<Briefcase className="h-4 w-4" />}
                  label="Business Name"
                  value={selectedRequest.business_name}
                />

                <InfoRow
                  icon={<Briefcase className="h-4 w-4" />}
                  label="Business Type"
                  value={selectedRequest.business_type}
                />

                <InfoRow
                  icon={<MapPin className="h-4 w-4" />}
                  label="Business Location"
                  value={selectedRequest.business_location}
                />

                <InfoRow
                  icon={<FileText className="h-4 w-4" />}
                  label="Ghana Card Number"
                  value={selectedRequest.ghana_card_number}
                />

                <InfoRow
                  icon={<Phone className="h-4 w-4" />}
                  label="MoMo Number"
                  value={selectedRequest.momo_number}
                />

                <InfoRow
                  icon={<Landmark className="h-4 w-4" />}
                  label="Bank Name"
                  value={selectedRequest.bank_name}
                />

                <InfoRow
                  icon={<Landmark className="h-4 w-4" />}
                  label="Bank Account Number"
                  value={selectedRequest.bank_account_number}
                />

                <InfoRow
                  icon={<Landmark className="h-4 w-4" />}
                  label="Bank Account Name"
                  value={selectedRequest.bank_account_name}
                />

                <InfoRow
                  icon={<User className="h-4 w-4" />}
                  label="Emergency Contact"
                  value={`${
                    selectedRequest.emergency_contact_name || 'Not provided'
                  } — ${selectedRequest.emergency_contact_phone || 'No phone'}`}
                />
              </div>

              <div>
                <h3 className="mb-3 text-lg font-black text-slate-900">
                  Verification Documents
                </h3>

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {selectedDocuments.map((doc) => (
                    <div
                      key={doc.label}
                      className="overflow-hidden rounded-3xl border border-slate-100 bg-slate-50"
                    >
                      <div className="border-b border-slate-100 bg-white p-3">
                        <p className="text-sm font-black text-slate-900">
                          {doc.label}
                        </p>
                      </div>

                      {doc.url ? (
                        <a href={doc.url} target="_blank" rel="noreferrer">
                          <img
                            src={doc.url}
                            alt={doc.label}
                            className="h-72 w-full object-cover transition hover:scale-[1.02]"
                          />
                        </a>
                      ) : (
                        <div className="flex h-72 flex-col items-center justify-center text-slate-400">
                          <ImageIcon className="h-10 w-10" />
                          <p className="mt-2 text-sm font-semibold">
                            No image uploaded
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-4">
                <h3 className="font-black text-emerald-900">
                  Agent / Review Information
                </h3>

                <div className="mt-3 grid gap-4 md:grid-cols-3">
                  <InfoRow
                    icon={<User className="h-4 w-4" />}
                    label="Submitted By Agent"
                    value={selectedRequest.submitted_by_agent_profile?.full_name}
                  />

                  <InfoRow
                    icon={<Phone className="h-4 w-4" />}
                    label="Agent Phone"
                    value={selectedRequest.submitted_by_agent_profile?.phone}
                  />

                  <InfoRow
                    icon={<Mail className="h-4 w-4" />}
                    label="Agent Email"
                    value={selectedRequest.submitted_by_agent_profile?.email}
                  />

                  <InfoRow
                    icon={<Calendar className="h-4 w-4" />}
                    label="Submitted At"
                    value={formatDateTime(selectedRequest.created_at)}
                  />

                  <InfoRow
                    icon={<User className="h-4 w-4" />}
                    label="Reviewed By"
                    value={selectedRequest.reviewed_by_profile?.full_name}
                  />

                  <InfoRow
                    icon={<Calendar className="h-4 w-4" />}
                    label="Reviewed At"
                    value={formatDateTime(selectedRequest.reviewed_at)}
                  />
                </div>
              </div>

              {selectedRequest.rejection_reason && (
                <div
                  className={`rounded-3xl border p-4 ${
                    selectedRequest.is_resubmitted
                      ? 'border-blue-100 bg-blue-50'
                      : 'border-red-100 bg-red-50'
                  }`}
                >
                  <h3
                    className={`font-black ${
                      selectedRequest.is_resubmitted
                        ? 'text-blue-900'
                        : 'text-red-900'
                    }`}
                  >
                    {selectedRequest.is_resubmitted
                      ? 'Resubmission Note'
                      : 'Rejection Reason'}
                  </h3>

                  <p
                    className={`mt-2 text-sm font-semibold leading-6 ${
                      selectedRequest.is_resubmitted
                        ? 'text-blue-700'
                        : 'text-red-700'
                    }`}
                  >
                    {selectedRequest.rejection_reason}
                  </p>
                </div>
              )}
            </div>

            <div className="sticky bottom-0 flex flex-col gap-3 border-t border-slate-100 bg-white p-5 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setSelectedRequest(null)}
                className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-50"
              >
                Close
              </button>

              <button
                type="button"
                onClick={() => {
                  setRejectionReason('');
                  setRejectModalOpen(true);
                }}
                disabled={!canRejectRequest(selectedRequest) || actionLoading}
                className={`inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-2 text-sm font-black transition disabled:cursor-not-allowed ${getRejectButtonClass(
                  selectedRequest
                )}`}
              >
                <XCircle className="h-4 w-4" />
                {getRejectButtonText(selectedRequest, false)}
              </button>

              <button
                type="button"
                onClick={() => handleAction(selectedRequest.id, 'APPROVE')}
                disabled={!canApproveRequest(selectedRequest) || actionLoading}
                className={`inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2 text-sm font-black transition disabled:cursor-not-allowed ${getApproveButtonClass(
                  selectedRequest
                )}`}
              >
                {actionLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}

                {getApproveButtonText(selectedRequest, actionLoading)}
              </button>
            </div>
          </div>
        </div>
      )}

      {rejectModalOpen && selectedRequest && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-black text-slate-900">
                  Reject Verification Request
                </h2>

                <p className="mt-1 text-sm font-semibold text-slate-500">
                  Please provide a clear rejection reason for this customer.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setRejectModalOpen(false);
                  setRejectionReason('');
                }}
                className="rounded-2xl p-2 text-slate-500 transition hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5">
              <label className="text-sm font-black text-slate-700">
                Rejection Reason
              </label>

              <textarea
                value={rejectionReason}
                onChange={(event) => setRejectionReason(event.target.value)}
                rows={5}
                placeholder="Example: Ghana Card image is not clear. Please upload a clearer image."
                className="mt-2 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-100"
              />
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  setRejectModalOpen(false);
                  setRejectionReason('');
                }}
                className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() =>
                  handleAction(selectedRequest.id, 'REJECT', rejectionReason)
                }
                disabled={actionLoading || !rejectionReason.trim()}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-red-600 px-4 py-2 text-sm font-black text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {actionLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ShieldAlert className="h-4 w-4" />
                )}

                Reject Request
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}