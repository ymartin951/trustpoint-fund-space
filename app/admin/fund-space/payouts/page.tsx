'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Banknote,
  CheckCircle2,
  CircleDollarSign,
  Clock,
  Loader2,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  UserRound,
  Users,
  Wallet,
  XCircle,
} from 'lucide-react';

import { supabase } from '@/lib/supabase/client';

type Summary = {
  total_payouts: number;
  pending_payouts: number;
  approved_payouts: number;
  paid_payouts: number;
  rejected_payouts: number;
  total_gross_amount: number;
  total_net_amount: number;
  total_platform_fee: number;
};

type RecipientLite = {
  id: string;
  full_name: string | null;
  phone: string | null;
  momo_number: string | null;
  bank_name: string | null;
  bank_account_name: string | null;
  bank_account_number: string | null;
  verification_status: string | null;
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
  round_number: number | null;
  recipient_user_id: string | null;
  contribution_amount: number | null;
  expected_total_amount: number | null;
  contribution_deadline: string | null;
  week_start_date: string | null;
  week_end_date: string | null;
  status: string | null;
};

type Payout = {
  id: string;
  fund_space_id: string;
  round_id: string;
  recipient_user_id: string;
  gross_amount: number;
  net_amount: number;
  platform_fee: number;
  status: string;
  approved_at: string | null;
  approved_by: string | null;
  paid_at: string | null;
  paid_by: string | null;
  payout_method: string | null;
  payout_reference: string | null;
  rejection_reason: string | null;
  failure_reason: string | null;
  created_at: string | null;
  updated_at: string | null;
  recipient: RecipientLite | null;
  fund_space: FundSpaceLite | null;
  round: RoundLite | null;
};

type PayoutsApiResponse = {
  success: boolean;
  message?: string;
  summary?: Summary;
  payouts?: Payout[];
};

type ActionApiResponse = {
  success: boolean;
  message?: string;
  payout?: Payout;
};

type PaymentFormState = {
  payout_method: string;
  payout_reference: string;
};

type MessageState = {
  type: 'success' | 'error';
  text: string;
};

type StatusFilter =
  | 'ALL'
  | 'PENDING_ADMIN_APPROVAL'
  | 'APPROVED'
  | 'PAID'
  | 'REJECTED'
  | 'FAILED';

const emptySummary: Summary = {
  total_payouts: 0,
  pending_payouts: 0,
  approved_payouts: 0,
  paid_payouts: 0,
  rejected_payouts: 0,
  total_gross_amount: 0,
  total_net_amount: 0,
  total_platform_fee: 0,
};

const statusFilters: StatusFilter[] = [
  'ALL',
  'PENDING_ADMIN_APPROVAL',
  'APPROVED',
  'PAID',
  'REJECTED',
  'FAILED',
];

function formatCurrency(amount: number | null | undefined) {
  return `GH₵${Number(amount || 0).toLocaleString('en-GH')}`;
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

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

function getStatusStyle(status: string | null | undefined) {
  const value = status || 'PENDING_ADMIN_APPROVAL';

  if (['ACTIVE', 'VERIFIED', 'APPROVED', 'COMPLETED', 'PAID'].includes(value)) {
    return 'border-emerald-100 bg-emerald-50 text-emerald-700';
  }

  if (
    ['PENDING', 'FORMING', 'COLLECTING', 'READY_FOR_PAYOUT', 'PENDING_ADMIN_APPROVAL'].includes(
      value
    )
  ) {
    return 'border-amber-100 bg-amber-50 text-amber-700';
  }

  if (['REJECTED', 'FAILED', 'INACTIVE', 'SUSPENDED', 'DEFAULTED'].includes(value)) {
    return 'border-red-100 bg-red-50 text-red-700';
  }

  return 'border-gray-100 bg-gray-50 text-gray-700';
}

function getStatusLabel(status: string) {
  if (status === 'ALL') return 'All';
  if (status === 'PENDING_ADMIN_APPROVAL') return 'Pending';
  if (status === 'APPROVED') return 'Approved';
  if (status === 'PAID') return 'Paid';
  if (status === 'REJECTED') return 'Rejected';
  if (status === 'FAILED') return 'Failed';

  return status;
}

function getRecipientName(payout: Payout) {
  return payout.recipient?.full_name || 'Unknown recipient';
}

function getFundSpaceName(payout: Payout) {
  return payout.fund_space?.name || `Fund Space ${payout.fund_space_id.slice(0, 8)}`;
}

function StatCard({
  title,
  value,
  description,
  icon,
}: {
  title: string;
  value: string | number;
  description: string;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-gray-500">{title}</p>
          <h3 className="mt-2 text-2xl font-black text-gray-900">{value}</h3>
          <p className="mt-1 text-sm leading-6 text-gray-500">{description}</p>
        </div>

        <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-700">
          {icon}
        </div>
      </div>
    </div>
  );
}

export default function AdminFundSpacePayoutsPage() {
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [summary, setSummary] = useState<Summary>(emptySummary);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const [expandedPaidId, setExpandedPaidId] = useState<string | null>(null);
  const [expandedRejectId, setExpandedRejectId] = useState<string | null>(null);

  const [rejectReasons, setRejectReasons] = useState<Record<string, string>>({});
  const [paymentForms, setPaymentForms] = useState<Record<string, PaymentFormState>>({});

  const [filter, setFilter] = useState<StatusFilter>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [appliedSearchTerm, setAppliedSearchTerm] = useState('');

  const [message, setMessage] = useState<MessageState | null>(null);

  const getAccessToken = useCallback(async () => {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error) {
      throw error;
    }

    if (!session?.access_token) {
      throw new Error('Your session has expired. Please login again.');
    }

    return session.access_token;
  }, []);

  const loadPayouts = useCallback(async () => {
    try {
      setRefreshing(true);
      setMessage(null);

      const token = await getAccessToken();

      const params = new URLSearchParams();

      if (filter !== 'ALL') {
        params.set('status', filter);
      }

      if (appliedSearchTerm.trim()) {
        params.set('search', appliedSearchTerm.trim());
      }

      const queryString = params.toString();
      const url = queryString
        ? `/api/admin/fund-space/payouts?${queryString}`
        : '/api/admin/fund-space/payouts';

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const result = (await response.json()) as PayoutsApiResponse;

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Could not load payout records.');
      }

      const loadedPayouts = result.payouts || [];

      setPayouts(loadedPayouts);
      setSummary(result.summary || emptySummary);

      setPaymentForms((current) => {
        const next = { ...current };

        loadedPayouts.forEach((payout) => {
          if (!next[payout.id]) {
            next[payout.id] = {
              payout_method: payout.payout_method || 'MOMO',
              payout_reference: payout.payout_reference || '',
            };
          }
        });

        return next;
      });
    } catch (error: unknown) {
      setMessage({
        type: 'error',
        text: getErrorMessage(error, 'Something went wrong while loading payouts.'),
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [appliedSearchTerm, filter, getAccessToken]);

  useEffect(() => {
    loadPayouts();
  }, [loadPayouts]);

  const visiblePayouts = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    if (!normalizedSearch) return payouts;

    return payouts.filter((payout) => {
      const recipient = payout.recipient;
      const fundSpace = payout.fund_space;
      const round = payout.round;

      return (
        recipient?.full_name?.toLowerCase().includes(normalizedSearch) ||
        recipient?.phone?.toLowerCase().includes(normalizedSearch) ||
        recipient?.momo_number?.toLowerCase().includes(normalizedSearch) ||
        recipient?.bank_name?.toLowerCase().includes(normalizedSearch) ||
        recipient?.bank_account_name?.toLowerCase().includes(normalizedSearch) ||
        recipient?.bank_account_number?.toLowerCase().includes(normalizedSearch) ||
        fundSpace?.name?.toLowerCase().includes(normalizedSearch) ||
        String(round?.round_number || '').includes(normalizedSearch) ||
        payout.status.toLowerCase().includes(normalizedSearch) ||
        payout.payout_reference?.toLowerCase().includes(normalizedSearch) ||
        payout.payout_method?.toLowerCase().includes(normalizedSearch) ||
        payout.id.toLowerCase().includes(normalizedSearch)
      );
    });
  }, [payouts, searchTerm]);

  const pendingPayouts = useMemo(() => {
    return payouts.filter((payout) => payout.status === 'PENDING_ADMIN_APPROVAL');
  }, [payouts]);

  const approvedPayouts = useMemo(() => {
    return payouts.filter((payout) => payout.status === 'APPROVED');
  }, [payouts]);

  function applySearch() {
    setAppliedSearchTerm(searchTerm.trim());
  }

  function clearSearch() {
    setSearchTerm('');
    setAppliedSearchTerm('');
  }

  function updatePaymentForm(
    payoutId: string,
    field: keyof PaymentFormState,
    value: string
  ) {
    setPaymentForms((current) => ({
      ...current,
      [payoutId]: {
        payout_method: current[payoutId]?.payout_method || 'MOMO',
        payout_reference: current[payoutId]?.payout_reference || '',
        [field]: value,
      },
    }));
  }

  async function handleApprove(payout: Payout) {
    try {
      setMessage(null);
      setActionLoadingId(payout.id);

      const token = await getAccessToken();

      const response = await fetch(
        `/api/admin/fund-space/payouts/${payout.id}/approve`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const result = (await response.json()) as ActionApiResponse;

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Could not approve payout.');
      }

      setMessage({
        type: 'success',
        text: result.message || 'Payout approved successfully.',
      });

      await loadPayouts();
    } catch (error: unknown) {
      setMessage({
        type: 'error',
        text: getErrorMessage(error, 'Something went wrong while approving payout.'),
      });
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleReject(payout: Payout) {
    try {
      setMessage(null);
      setActionLoadingId(payout.id);

      const reason = rejectReasons[payout.id]?.trim();

      if (!reason) {
        throw new Error('Please enter a rejection reason.');
      }

      const token = await getAccessToken();

      const response = await fetch(
        `/api/admin/fund-space/payouts/${payout.id}/reject`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ reason }),
        }
      );

      const result = (await response.json()) as ActionApiResponse;

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Could not reject payout.');
      }

      setMessage({
        type: 'success',
        text: result.message || 'Payout rejected successfully.',
      });

      setExpandedRejectId(null);

      setRejectReasons((current) => {
        const next = { ...current };
        delete next[payout.id];
        return next;
      });

      await loadPayouts();
    } catch (error: unknown) {
      setMessage({
        type: 'error',
        text: getErrorMessage(error, 'Something went wrong while rejecting payout.'),
      });
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleMarkPaid(payout: Payout) {
    try {
      setMessage(null);
      setActionLoadingId(payout.id);

      const form = paymentForms[payout.id];

      if (!form?.payout_method?.trim()) {
        throw new Error('Please select a payout method.');
      }

      if (!form?.payout_reference?.trim()) {
        throw new Error('Please enter a payout reference.');
      }

      const token = await getAccessToken();

      const response = await fetch(
        `/api/admin/fund-space/payouts/${payout.id}/mark-paid`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            payout_method: form.payout_method.trim().toUpperCase(),
            payout_reference: form.payout_reference.trim(),
          }),
        }
      );

      const result = (await response.json()) as ActionApiResponse;

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Could not mark payout as paid.');
      }

      setMessage({
        type: 'success',
        text: result.message || 'Payout marked as paid successfully.',
      });

      setExpandedPaidId(null);
      await loadPayouts();
    } catch (error: unknown) {
      setMessage({
        type: 'error',
        text: getErrorMessage(error, 'Something went wrong while marking payout as paid.'),
      });
    } finally {
      setActionLoadingId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-emerald-600" />
          <p className="text-sm text-gray-500">Loading Fund Space payouts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 text-sm font-bold text-emerald-700 hover:text-emerald-800"
        >
          <ArrowLeft size={16} />
          Back to Admin Dashboard
        </Link>

        <Link
          href="/admin/fund-space"
          className="inline-flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-700 hover:bg-emerald-100"
        >
          <Users size={16} />
          Fund Space Groups
        </Link>
      </div>

      <div className="rounded-3xl bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-600 p-6 text-white shadow-sm md:p-8">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
          <div className="max-w-3xl">
            <p className="mb-3 inline-flex rounded-full bg-white/15 px-4 py-1 text-sm font-medium">
              Admin Fund Space Payouts
            </p>

            <h1 className="text-3xl font-bold md:text-4xl">
              Review and process Fund Space payouts
            </h1>

            <p className="mt-4 max-w-2xl text-sm leading-7 text-emerald-50 md:text-base">
              Approve payout requests, reject invalid requests, and mark approved payouts as paid
              after confirming that payment has been sent to the correct recipient.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <div className="rounded-2xl bg-white/15 px-4 py-3">
                <p className="text-xs font-medium text-emerald-50">Pending Approval</p>
                <p className="mt-1 text-2xl font-bold">{summary.pending_payouts}</p>
              </div>

              <div className="rounded-2xl bg-white/15 px-4 py-3">
                <p className="text-xs font-medium text-emerald-50">Approved Not Paid</p>
                <p className="mt-1 text-2xl font-bold">{summary.approved_payouts}</p>
              </div>

              <div className="rounded-2xl bg-white/15 px-4 py-3">
                <p className="text-xs font-medium text-emerald-50">Net Payout Value</p>
                <p className="mt-1 text-2xl font-bold">
                  {formatCurrency(summary.total_net_amount)}
                </p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={loadPayouts}
            disabled={refreshing}
            className="inline-flex min-h-12 w-fit items-center justify-center gap-2 rounded-xl bg-white/15 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {refreshing ? (
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
            <CheckCircle2 className="mt-0.5 h-5 w-5 flex-none" />
          ) : (
            <AlertCircle className="mt-0.5 h-5 w-5 flex-none" />
          )}
          <p>{message.text}</p>
        </div>
      )}

      {(pendingPayouts.length > 0 || approvedPayouts.length > 0) && (
        <section className="grid gap-5 lg:grid-cols-2">
          {pendingPayouts.length > 0 && (
            <div className="rounded-3xl border border-amber-100 bg-amber-50 p-6">
              <div className="flex items-start gap-3">
                <ShieldAlert className="mt-1 h-6 w-6 flex-none text-amber-700" />
                <div>
                  <h2 className="text-lg font-black text-amber-900">
                    {pendingPayouts.length} payout
                    {pendingPayouts.length === 1 ? '' : 's'} waiting for approval
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-amber-700">
                    Review member payment information carefully before approving.
                  </p>
                </div>
              </div>
            </div>
          )}

          {approvedPayouts.length > 0 && (
            <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-6">
              <div className="flex items-start gap-3">
                <Banknote className="mt-1 h-6 w-6 flex-none text-emerald-700" />
                <div>
                  <h2 className="text-lg font-black text-emerald-900">
                    {approvedPayouts.length} approved payout
                    {approvedPayouts.length === 1 ? '' : 's'} ready to pay
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-emerald-700">
                    After sending payment, add the method and transaction reference before marking as paid.
                  </p>
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-5">
        <StatCard
          title="Total Payouts"
          value={summary.total_payouts}
          description="All payout records"
          icon={<Wallet className="h-5 w-5" />}
        />
        <StatCard
          title="Pending"
          value={summary.pending_payouts}
          description="Waiting for approval"
          icon={<Clock className="h-5 w-5" />}
        />
        <StatCard
          title="Approved"
          value={summary.approved_payouts}
          description="Ready for payment"
          icon={<ShieldCheck className="h-5 w-5" />}
        />
        <StatCard
          title="Paid"
          value={summary.paid_payouts}
          description="Completed payouts"
          icon={<CheckCircle2 className="h-5 w-5" />}
        />
        <StatCard
          title="Platform Fee"
          value={formatCurrency(summary.total_platform_fee)}
          description="Total fee retained"
          icon={<CircleDollarSign className="h-5 w-5" />}
        />
      </section>

      <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-xl">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  applySearch();
                }
              }}
              placeholder="Search recipient, phone, group, round, reference..."
              className="w-full rounded-2xl border border-gray-200 bg-gray-50 py-3 pl-11 pr-4 text-sm outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-50"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {statusFilters.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setFilter(item)}
                className={`rounded-xl px-4 py-2.5 text-sm font-bold transition ${
                  filter === item
                    ? 'bg-emerald-600 text-white shadow-sm hover:bg-emerald-700'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {getStatusLabel(item)}
              </button>
            ))}

            <button
              type="button"
              onClick={applySearch}
              className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-bold text-gray-700 transition hover:bg-gray-50"
            >
              Search
            </button>

            {(searchTerm || appliedSearchTerm) && (
              <button
                type="button"
                onClick={clearSearch}
                className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-bold text-red-600 transition hover:bg-red-50"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-gray-100 bg-white shadow-sm">
        {visiblePayouts.length === 0 ? (
          <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 p-8 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-50">
              <Banknote className="h-8 w-8 text-gray-400" />
            </div>
            <h2 className="text-lg font-bold text-gray-900">No payouts found</h2>
            <p className="max-w-md text-sm leading-6 text-gray-500">
              Payout records will appear here when a Fund Space round is ready for payout.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {visiblePayouts.map((payout) => {
              const recipient = payout.recipient;
              const fundSpace = payout.fund_space;
              const round = payout.round;
              const isLoadingAction = actionLoadingId === payout.id;
              const paymentForm = paymentForms[payout.id] || {
                payout_method: 'MOMO',
                payout_reference: '',
              };

              const canApprove = payout.status === 'PENDING_ADMIN_APPROVAL';
              const canReject = payout.status === 'PENDING_ADMIN_APPROVAL';
              const canMarkPaid = payout.status === 'APPROVED';

              return (
                <div key={payout.id} className="p-5 md:p-6">
                  <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-xl font-bold text-gray-900">
                          {getRecipientName(payout)}
                        </h3>

                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-bold ${getStatusStyle(
                            payout.status
                          )}`}
                        >
                          {payout.status}
                        </span>

                        {round && (
                          <span className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                            Round {round.round_number ?? 'Unknown'}
                          </span>
                        )}
                      </div>

                      <div className="mt-4 grid gap-3 text-sm text-gray-600 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="rounded-2xl bg-gray-50 p-4">
                          <p className="text-xs font-semibold uppercase text-gray-400">
                            Phone
                          </p>
                          <p className="mt-1 font-bold text-gray-800">
                            {recipient?.phone || 'Not provided'}
                          </p>
                        </div>

                        <div className="rounded-2xl bg-gray-50 p-4">
                          <p className="text-xs font-semibold uppercase text-gray-400">
                            Gross
                          </p>
                          <p className="mt-1 font-bold text-gray-800">
                            {formatCurrency(payout.gross_amount)}
                          </p>
                        </div>

                        <div className="rounded-2xl bg-gray-50 p-4">
                          <p className="text-xs font-semibold uppercase text-gray-400">
                            Fee
                          </p>
                          <p className="mt-1 font-bold text-gray-800">
                            {formatCurrency(payout.platform_fee)}
                          </p>
                        </div>

                        <div className="rounded-2xl bg-gray-50 p-4">
                          <p className="text-xs font-semibold uppercase text-gray-400">
                            Net
                          </p>
                          <p className="mt-1 font-bold text-emerald-700">
                            {formatCurrency(payout.net_amount)}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 text-sm text-gray-600 lg:grid-cols-2">
                        <div className="rounded-2xl bg-gray-50 p-4">
                          <p>
                            <span className="font-bold text-gray-800">Fund Space:</span>{' '}
                            {getFundSpaceName(payout)}
                          </p>
                          <p className="mt-1">
                            <span className="font-bold text-gray-800">Group Status:</span>{' '}
                            {fundSpace?.status || 'Not available'}
                          </p>
                          <p className="mt-1">
                            <span className="font-bold text-gray-800">Round Status:</span>{' '}
                            {round?.status || 'Not available'}
                          </p>
                          <p className="mt-1">
                            <span className="font-bold text-gray-800">Contribution Deadline:</span>{' '}
                            {formatDate(round?.contribution_deadline)}
                          </p>

                          <Link
                            href={`/admin/fund-space/${payout.fund_space_id}`}
                            className="mt-3 inline-flex items-center gap-2 text-xs font-bold text-emerald-700 hover:text-emerald-800"
                          >
                            View Fund Space Group
                            <ArrowRight size={13} />
                          </Link>
                        </div>

                        <div className="rounded-2xl bg-gray-50 p-4">
                          <p>
                            <span className="font-bold text-gray-800">Recipient MoMo:</span>{' '}
                            {recipient?.momo_number || 'Not provided'}
                          </p>
                          <p className="mt-1">
                            <span className="font-bold text-gray-800">Bank:</span>{' '}
                            {recipient?.bank_name || 'Not provided'}
                          </p>
                          <p className="mt-1">
                            <span className="font-bold text-gray-800">Account Name:</span>{' '}
                            {recipient?.bank_account_name || 'Not provided'}
                          </p>
                          <p className="mt-1">
                            <span className="font-bold text-gray-800">Account Number:</span>{' '}
                            {recipient?.bank_account_number || 'Not provided'}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 rounded-2xl bg-gray-50 p-4 text-sm text-gray-600">
                        <p>
                          <span className="font-bold text-gray-800">Payout Method:</span>{' '}
                          {payout.payout_method || 'Not paid'}
                        </p>
                        <p className="mt-1">
                          <span className="font-bold text-gray-800">Payout Reference:</span>{' '}
                          {payout.payout_reference || 'No reference'}
                        </p>
                        <p className="mt-1">
                          <span className="font-bold text-gray-800">Approved At:</span>{' '}
                          {formatDateTime(payout.approved_at)}
                        </p>
                        <p className="mt-1">
                          <span className="font-bold text-gray-800">Paid At:</span>{' '}
                          {formatDateTime(payout.paid_at)}
                        </p>
                        <p className="mt-1">
                          <span className="font-bold text-gray-800">Created:</span>{' '}
                          {formatDateTime(payout.created_at)}
                        </p>

                        {payout.rejection_reason && (
                          <p className="mt-3 rounded-xl border border-red-100 bg-red-50 p-3 font-semibold text-red-700">
                            Rejection Reason: {payout.rejection_reason}
                          </p>
                        )}

                        {payout.failure_reason && (
                          <p className="mt-3 rounded-xl border border-red-100 bg-red-50 p-3 font-semibold text-red-700">
                            Failure Reason: {payout.failure_reason}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="w-full rounded-3xl border border-gray-100 bg-gray-50 p-5 xl:w-[390px]">
                      <div className="flex items-center gap-3">
                        <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-700">
                          <UserRound className="h-5 w-5" />
                        </div>

                        <div>
                          <p className="text-sm font-bold text-gray-900">Payout Action</p>
                          <p className="text-xs text-gray-500">
                            Approve, reject, or mark as paid
                          </p>
                        </div>
                      </div>

                      {canApprove && (
                        <button
                          type="button"
                          disabled={isLoadingAction}
                          onClick={() => handleApprove(payout)}
                          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                        >
                          {isLoadingAction ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <ShieldCheck className="h-4 w-4" />
                          )}
                          Approve Payout
                        </button>
                      )}

                      {canReject && (
                        <>
                          {expandedRejectId !== payout.id ? (
                            <button
                              type="button"
                              disabled={isLoadingAction}
                              onClick={() => {
                                setExpandedRejectId(payout.id);
                                setExpandedPaidId(null);
                              }}
                              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-red-100 bg-red-50 px-5 py-3 text-sm font-bold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              <XCircle className="h-4 w-4" />
                              Reject Payout
                            </button>
                          ) : (
                            <div className="mt-4 space-y-3">
                              <textarea
                                value={rejectReasons[payout.id] || ''}
                                onChange={(event) =>
                                  setRejectReasons((current) => ({
                                    ...current,
                                    [payout.id]: event.target.value,
                                  }))
                                }
                                placeholder="Enter rejection reason..."
                                className="w-full rounded-xl border border-red-100 bg-white px-4 py-3 text-sm font-semibold text-gray-800 outline-none focus:border-red-300 focus:ring-4 focus:ring-red-50"
                                rows={3}
                              />

                              <div className="grid grid-cols-2 gap-2">
                                <button
                                  type="button"
                                  disabled={isLoadingAction}
                                  onClick={() => handleReject(payout)}
                                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                                >
                                  {isLoadingAction && (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  )}
                                  Reject
                                </button>

                                <button
                                  type="button"
                                  disabled={isLoadingAction}
                                  onClick={() => setExpandedRejectId(null)}
                                  className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold text-gray-700 transition hover:bg-gray-50"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          )}
                        </>
                      )}

                      {canMarkPaid && (
                        <>
                          {expandedPaidId !== payout.id ? (
                            <button
                              type="button"
                              disabled={isLoadingAction}
                              onClick={() => {
                                setExpandedPaidId(payout.id);
                                setExpandedRejectId(null);
                              }}
                              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                            >
                              <Banknote className="h-4 w-4" />
                              Mark as Paid
                            </button>
                          ) : (
                            <div className="mt-5 space-y-3">
                              <div>
                                <label className="text-xs font-bold uppercase text-gray-500">
                                  Payout Method
                                </label>
                                <select
                                  value={paymentForm.payout_method}
                                  onChange={(event) =>
                                    updatePaymentForm(
                                      payout.id,
                                      'payout_method',
                                      event.target.value
                                    )
                                  }
                                  className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-800 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-50"
                                >
                                  <option value="MOMO">Mobile Money</option>
                                  <option value="BANK">Bank Transfer</option>
                                  <option value="CASH">Cash</option>
                                  <option value="CARD">Card</option>
                                  <option value="OTHER">Other</option>
                                </select>
                              </div>

                              <div>
                                <label className="text-xs font-bold uppercase text-gray-500">
                                  Payout Reference
                                </label>
                                <input
                                  value={paymentForm.payout_reference}
                                  onChange={(event) =>
                                    updatePaymentForm(
                                      payout.id,
                                      'payout_reference',
                                      event.target.value
                                    )
                                  }
                                  placeholder="Enter transaction reference"
                                  className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-800 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-50"
                                />
                              </div>

                              <div className="rounded-2xl border border-amber-100 bg-amber-50 p-3 text-xs font-semibold leading-5 text-amber-800">
                                Only mark as paid after the recipient has actually received the money.
                              </div>

                              <div className="grid grid-cols-2 gap-2">
                                <button
                                  type="button"
                                  disabled={isLoadingAction}
                                  onClick={() => handleMarkPaid(payout)}
                                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                                >
                                  {isLoadingAction ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <CheckCircle2 className="h-4 w-4" />
                                  )}
                                  Save
                                </button>

                                <button
                                  type="button"
                                  disabled={isLoadingAction}
                                  onClick={() => setExpandedPaidId(null)}
                                  className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold text-gray-700 transition hover:bg-gray-50"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          )}
                        </>
                      )}

                      {payout.status === 'PAID' && (
                        <div className="mt-5 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">
                          This payout has already been paid.
                        </div>
                      )}

                      {payout.status === 'REJECTED' && (
                        <div className="mt-5 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-700">
                          This payout has been rejected.
                        </div>
                      )}

                      {payout.status === 'FAILED' && (
                        <div className="mt-5 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-700">
                          This payout failed and needs review.
                        </div>
                      )}

                      {!canApprove &&
                        !canReject &&
                        !canMarkPaid &&
                        !['PAID', 'REJECTED', 'FAILED'].includes(payout.status) && (
                          <div className="mt-5 rounded-2xl border border-gray-100 bg-white p-4 text-sm font-semibold text-gray-600">
                            No action is currently available for this payout status.
                          </div>
                        )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <div className="rounded-3xl border border-amber-100 bg-amber-50 p-6">
        <h2 className="text-lg font-bold text-amber-800">
          Admin payout safety reminder
        </h2>

        <p className="mt-2 text-sm leading-6 text-amber-700">
          Approve payouts only after confirming that the round is genuinely ready and the recipient
          is correct. Mark a payout as paid only after payment has been sent and the transaction
          reference is available.
        </p>
      </div>
    </div>
  );
}