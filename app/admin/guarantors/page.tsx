'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  BadgeCheck,
  CheckCircle2,
  Clock,
  IdCard,
  Loader2,
  Phone,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
  UsersRound,
  XCircle,
} from 'lucide-react';

import { supabase } from '@/lib/supabase/client';

type ReviewStatus = 'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED';

type Profile = {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  role: string | null;
  status: string | null;
  verification_status: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  business_name: string | null;
  business_type: string | null;
  business_location: string | null;
  employer_name: string | null;
  staff_id: string | null;
};

type GuarantorRecord = {
  id: string;
  user_id: string;
  full_name: string;
  phone: string;
  relationship_to_member: string;
  location: string | null;
  id_type: string | null;
  id_number: string | null;
  consent_status: string;
  verification_status: string;
  admin_review_status: string;
  rejection_reason: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  member: Profile | null;
  reviewed_by_profile: Profile | null;
};

type ApiResponse = {
  success: boolean;
  message?: string;
  records?: GuarantorRecord[];
  stats?: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
  };
};

function formatDateTime(value: string | null | undefined) {
  if (!value) return 'Not available';

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
  const value = String(status || '').toUpperCase();

  if (['APPROVED', 'VERIFIED', 'CONSENTED', 'ACTIVE'].includes(value)) {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }

  if (['PENDING', 'UNVERIFIED'].includes(value)) {
    return 'border-amber-200 bg-amber-50 text-amber-700';
  }

  if (['REJECTED', 'DECLINED', 'SUSPENDED'].includes(value)) {
    return 'border-red-200 bg-red-50 text-red-700';
  }

  return 'border-slate-200 bg-slate-50 text-slate-700';
}

function getStatusIcon(status: string | null | undefined) {
  const value = String(status || '').toUpperCase();

  if (['APPROVED', 'VERIFIED', 'CONSENTED', 'ACTIVE'].includes(value)) {
    return <CheckCircle2 className="h-4 w-4" />;
  }

  if (['REJECTED', 'DECLINED', 'SUSPENDED'].includes(value)) {
    return <XCircle className="h-4 w-4" />;
  }

  return <Clock className="h-4 w-4" />;
}

async function readApiResponse(response: Response): Promise<ApiResponse> {
  const responseText = await response.text();

  if (!responseText) {
    return {
      success: false,
      message:
        'The server returned an empty response. Please check app/api/admin/guarantors/route.ts and try again.',
    };
  }

  try {
    return JSON.parse(responseText) as ApiResponse;
  } catch {
    return {
      success: false,
      message:
        'The server returned an invalid response. Please check the API route or server console.',
    };
  }
}

function StatCard({
  title,
  value,
  helper,
}: {
  title: string;
  value: number;
  helper: string;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 inline-flex rounded-2xl bg-emerald-50 p-3 text-emerald-700">
        <ShieldCheck className="h-6 w-6" />
      </div>

      <p className="text-sm font-bold text-slate-500">{title}</p>
      <p className="mt-1 text-3xl font-black text-slate-900">{value}</p>
      <p className="mt-1 text-xs leading-5 text-slate-500">{helper}</p>
    </div>
  );
}

function InfoBox({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
      <p className="text-xs font-black uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-1 break-words text-sm font-bold text-slate-900">
        {value || 'Not provided'}
      </p>
    </div>
  );
}

export default function AdminGuarantorsPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState('');
  const [records, setRecords] = useState<GuarantorRecord[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
  });

  const [statusFilter, setStatusFilter] = useState<ReviewStatus>('PENDING');
  const [searchTerm, setSearchTerm] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const selectedRecords = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    return records.filter((record) => {
      const matchesStatus =
        statusFilter === 'ALL' ||
        String(record.admin_review_status || '').toUpperCase() === statusFilter;

      if (!matchesStatus) return false;

      if (!search) return true;

      const haystack = [
        record.full_name,
        record.phone,
        record.relationship_to_member,
        record.location,
        record.id_type,
        record.id_number,
        record.member?.full_name,
        record.member?.phone,
        record.member?.email,
        record.member?.verification_status,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(search);
    });
  }, [records, searchTerm, statusFilter]);

  const loadRecords = useCallback(async (showRefresh = false) => {
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

      const response = await fetch('/api/admin/guarantors', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const result = await readApiResponse(response);

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Unable to load guarantors.');
      }

      setRecords(result.records || []);
      setStats(
        result.stats || {
          total: 0,
          pending: 0,
          approved: 0,
          rejected: 0,
        }
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Unable to load guarantors.'
      );
      setRecords([]);
      setStats({
        total: 0,
        pending: 0,
        approved: 0,
        rejected: 0,
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  async function reviewGuarantor(
    record: GuarantorRecord,
    action: 'APPROVE' | 'REJECT'
  ) {
    try {
      setActionLoadingId(`${record.id}-${action}`);
      setErrorMessage('');
      setSuccessMessage('');

      let rejectionReason = '';

      if (action === 'REJECT') {
        const reason = window.prompt(
          'Enter the reason for rejecting this guarantor:'
        );

        if (!reason?.trim()) {
          throw new Error('Rejection reason is required.');
        }

        rejectionReason = reason.trim();
      }

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.access_token) {
        throw new Error('Your session has expired. Please log in again.');
      }

      const response = await fetch('/api/admin/guarantors', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          guarantor_id: record.id,
          action,
          rejection_reason: rejectionReason,
        }),
      });

      const result = await readApiResponse(response);

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Unable to review guarantor.');
      }

      setSuccessMessage(
        result.message ||
          (action === 'APPROVE'
            ? 'Guarantor approved successfully.'
            : 'Guarantor rejected successfully.')
      );

      await loadRecords(true);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Unable to review guarantor.'
      );
    } finally {
      setActionLoadingId('');
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-6 md:px-8">
        <div className="mx-auto flex min-h-[60vh] max-w-7xl items-center justify-center">
          <div className="text-center">
            <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-emerald-700" />
            <h1 className="text-lg font-black text-slate-900">
              Loading guarantor submissions...
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Please wait while TrustPoint loads records for review.
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 md:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-3xl bg-gradient-to-br from-emerald-800 via-emerald-700 to-teal-700 p-6 text-white shadow-sm md:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-black">
                <UsersRound className="h-4 w-4" />
                Admin Review Center
              </p>

              <h1 className="text-3xl font-black tracking-tight md:text-4xl">
                Guarantor Reviews
              </h1>

              <p className="mt-3 max-w-3xl text-sm leading-7 text-emerald-50">
                Review guarantor submissions for members who want to join
                higher-value Fund Spaces. Approving a guarantor allows the
                member to meet the GH₵200 and GH₵500 guarantor requirement.
              </p>
            </div>

            <button
              type="button"
              onClick={() => loadRecords(true)}
              disabled={refreshing}
              className="inline-flex min-h-11 w-fit items-center justify-center gap-2 rounded-2xl bg-white px-4 text-sm font-black text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw
                className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`}
              />
              Refresh
            </button>
          </div>
        </section>

        {successMessage && (
          <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-700">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
              <p className="text-sm font-bold leading-6">{successMessage}</p>
            </div>
          </div>
        )}

        {errorMessage && (
          <div className="rounded-3xl border border-red-200 bg-red-50 p-5 text-red-700">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="text-sm font-black leading-6">
                  Could not complete action
                </p>
                <p className="mt-1 text-sm font-semibold leading-6">
                  {errorMessage}
                </p>
              </div>
            </div>
          </div>
        )}

        <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Total"
            value={stats.total}
            helper="All guarantor records"
          />

          <StatCard
            title="Pending"
            value={stats.pending}
            helper="Waiting for admin review"
          />

          <StatCard
            title="Approved"
            value={stats.approved}
            helper="Accepted guarantors"
          />

          <StatCard
            title="Rejected"
            value={stats.rejected}
            helper="Rejected submissions"
          />
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search member, guarantor, phone, relationship..."
                className="min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm font-semibold outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
            </div>

            <div className="grid grid-cols-2 gap-2 sm:flex">
              {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as ReviewStatus[]).map(
                (status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setStatusFilter(status)}
                    className={`min-h-11 rounded-2xl px-4 text-xs font-black transition ${
                      statusFilter === status
                        ? 'bg-emerald-700 text-white'
                        : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {formatLabel(status)}
                  </button>
                )
              )}
            </div>
          </div>
        </section>

        {selectedRecords.length === 0 ? (
          <section className="rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
            <ShieldCheck className="mx-auto mb-3 h-12 w-12 text-slate-300" />
            <h2 className="text-lg font-black text-slate-900">
              No guarantors found
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Try changing the filter or refreshing the page.
            </p>
          </section>
        ) : (
          <section className="grid gap-5">
            {selectedRecords.map((record) => {
              const pending = record.admin_review_status === 'PENDING';

              return (
                <article
                  key={record.id}
                  className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6"
                >
                  <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-black ${statusStyle(
                            record.admin_review_status
                          )}`}
                        >
                          {getStatusIcon(record.admin_review_status)}
                          {formatLabel(record.admin_review_status)}
                        </span>

                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-black ${statusStyle(
                            record.verification_status
                          )}`}
                        >
                          Verification: {formatLabel(record.verification_status)}
                        </span>

                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-black ${statusStyle(
                            record.consent_status
                          )}`}
                        >
                          Consent: {formatLabel(record.consent_status)}
                        </span>
                      </div>

                      <div className="mt-4 grid gap-5 lg:grid-cols-2">
                        <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-5">
                          <p className="mb-2 inline-flex items-center gap-2 text-xs font-black uppercase tracking-wide text-emerald-700">
                            <UserRound className="h-4 w-4" />
                            Member
                          </p>

                          <h2 className="text-xl font-black text-slate-900">
                            {record.member?.full_name || 'Unknown member'}
                          </h2>

                          <p className="mt-1 text-sm font-semibold text-slate-600">
                            {record.member?.phone || 'No phone'} •{' '}
                            {record.member?.email || 'No email'}
                          </p>

                          <div className="mt-4 grid gap-3 sm:grid-cols-2">
                            <InfoBox
                              label="Verification"
                              value={formatLabel(
                                record.member?.verification_status
                              )}
                            />
                            <InfoBox
                              label="Account Status"
                              value={formatLabel(record.member?.status)}
                            />
                            <InfoBox
                              label="Emergency Contact"
                              value={
                                record.member?.emergency_contact_name &&
                                record.member?.emergency_contact_phone
                                  ? `${record.member.emergency_contact_name} • ${record.member.emergency_contact_phone}`
                                  : 'Not provided'
                              }
                            />
                            <InfoBox
                              label="Work / Business"
                              value={
                                record.member?.business_name ||
                                record.member?.employer_name ||
                                'Not provided'
                              }
                            />
                          </div>
                        </div>

                        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                          <p className="mb-2 inline-flex items-center gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
                            <ShieldCheck className="h-4 w-4" />
                            Guarantor
                          </p>

                          <h2 className="text-xl font-black text-slate-900">
                            {record.full_name}
                          </h2>

                          <p className="mt-1 text-sm font-semibold text-slate-600">
                            {record.phone} • {record.relationship_to_member}
                          </p>

                          <div className="mt-4 grid gap-3 sm:grid-cols-2">
                            <InfoBox label="Location" value={record.location} />
                            <InfoBox
                              label="Relationship"
                              value={record.relationship_to_member}
                            />
                            <InfoBox label="ID Type" value={record.id_type} />
                            <InfoBox label="ID Number" value={record.id_number} />
                          </div>
                        </div>
                      </div>

                      {record.rejection_reason && (
                        <div className="mt-4 rounded-2xl border border-red-100 bg-red-50 p-4">
                          <p className="text-xs font-black uppercase tracking-wide text-red-500">
                            Rejection Reason
                          </p>
                          <p className="mt-2 text-sm font-semibold leading-6 text-red-700">
                            {record.rejection_reason}
                          </p>
                        </div>
                      )}

                      <div className="mt-4 flex flex-wrap gap-3 text-xs font-semibold text-slate-500">
                        <span>Submitted: {formatDateTime(record.created_at)}</span>
                        <span>Updated: {formatDateTime(record.updated_at)}</span>
                        {record.reviewed_at && (
                          <span>
                            Reviewed: {formatDateTime(record.reviewed_at)}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 xl:w-48 xl:grid-cols-1">
                      <button
                        type="button"
                        disabled={!pending || Boolean(actionLoadingId)}
                        onClick={() => reviewGuarantor(record, 'APPROVE')}
                        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-4 text-sm font-black text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {actionLoadingId === `${record.id}-APPROVE` ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4" />
                        )}
                        Approve
                      </button>

                      <button
                        type="button"
                        disabled={!pending || Boolean(actionLoadingId)}
                        onClick={() => reviewGuarantor(record, 'REJECT')}
                        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 text-sm font-black text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {actionLoadingId === `${record.id}-REJECT` ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <XCircle className="h-4 w-4" />
                        )}
                        Reject
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </div>
    </main>
  );
}