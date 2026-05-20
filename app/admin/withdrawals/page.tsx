'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  Wallet,
  XCircle,
} from 'lucide-react';

import { supabase } from '@/lib/supabase/client';

type AdminRole = 'ADMIN' | 'SUPER_ADMIN';

type AdminProfile = {
  id: string;
  role: AdminRole;
  status: string | null;
};

type WithdrawalStatus =
  | 'PENDING'
  | 'PENDING_ADMIN_APPROVAL'
  | 'APPROVED'
  | 'PAID'
  | 'COMPLETED'
  | 'REJECTED'
  | 'FAILED'
  | 'CANCELLED';

type WithdrawalMethod = 'MOMO' | 'BANK' | string;

type WithdrawalRequest = {
  id: string;
  user_id: string;
  amount: number;
  status: WithdrawalStatus;
  withdrawal_method?: WithdrawalMethod | null;
  momo_number?: string | null;
  bank_name?: string | null;
  bank_account_number?: string | null;
  bank_account_name?: string | null;
  admin_note?: string | null;
  rejection_reason?: string | null;
  approved_at?: string | null;
  paid_at?: string | null;
  rejected_at?: string | null;
  created_at: string | null;
};

type Profile = {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  trust_score?: number | null;
  verification_status?: string | null;
  status?: string | null;
};

type WithdrawalRow = WithdrawalRequest & {
  profile?: Profile | null;
};

type StatusFilter =
  | 'ALL'
  | 'PENDING'
  | 'PENDING_ADMIN_APPROVAL'
  | 'APPROVED'
  | 'PAID'
  | 'REJECTED';

type MethodFilter = 'ALL' | 'MOMO' | 'BANK';

type SupabaseWithWithdrawalRpc = typeof supabase & {
  rpc(
    fn: 'approve_withdrawal_request',
    args: { p_withdrawal_id: string }
  ): Promise<{ data: unknown; error: { message: string } | null }>;

  rpc(
    fn: 'reject_withdrawal_request',
    args: { p_withdrawal_id: string; p_reason: string }
  ): Promise<{ data: unknown; error: { message: string } | null }>;

  rpc(
    fn: 'mark_withdrawal_paid',
    args: { p_withdrawal_id: string }
  ): Promise<{ data: unknown; error: { message: string } | null }>;
};

function formatCurrency(amount: number | null | undefined) {
  return `GH₵ ${Number(amount || 0).toLocaleString('en-GH', {
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

  return date.toLocaleDateString('en-GH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatDateTime(dateString: string | null | undefined) {
  if (!dateString) return 'Not set';

  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) {
    return 'Invalid date';
  }

  return date.toLocaleString('en-GH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatLabel(value: string | null | undefined) {
  if (!value) return 'Not specified';

  return value
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function normalizeStatus(status: string | null | undefined): WithdrawalStatus {
  if (
    status === 'PENDING' ||
    status === 'PENDING_ADMIN_APPROVAL' ||
    status === 'APPROVED' ||
    status === 'PAID' ||
    status === 'COMPLETED' ||
    status === 'REJECTED' ||
    status === 'FAILED' ||
    status === 'CANCELLED'
  ) {
    return status;
  }

  return 'PENDING';
}

function isPendingStatus(status: string | null | undefined) {
  return status === 'PENDING' || status === 'PENDING_ADMIN_APPROVAL';
}

function getStatusStyle(status: string | null | undefined) {
  const value = normalizeStatus(status);

  if (value === 'PAID' || value === 'COMPLETED') {
    return 'bg-emerald-50 text-emerald-700 border-emerald-100';
  }

  if (value === 'APPROVED') {
    return 'bg-blue-50 text-blue-700 border-blue-100';
  }

  if (value === 'PENDING' || value === 'PENDING_ADMIN_APPROVAL') {
    return 'bg-amber-50 text-amber-700 border-amber-100';
  }

  if (value === 'REJECTED' || value === 'FAILED' || value === 'CANCELLED') {
    return 'bg-red-50 text-red-700 border-red-100';
  }

  return 'bg-gray-50 text-gray-700 border-gray-100';
}

function getTrustScoreStyle(score: number | null | undefined) {
  const value = Number(score || 0);

  if (value >= 80) return 'text-emerald-700 bg-emerald-50';
  if (value >= 50) return 'text-amber-700 bg-amber-50';

  return 'text-red-700 bg-red-50';
}

function getPaymentDetails(withdrawal: WithdrawalRow) {
  if (withdrawal.withdrawal_method === 'BANK') {
    return {
      title: withdrawal.bank_name || 'Bank withdrawal',
      line1: withdrawal.bank_account_number || 'No account number',
      line2: withdrawal.bank_account_name || 'No account name',
    };
  }

  return {
    title: 'Mobile Money',
    line1: withdrawal.momo_number || 'No MoMo number provided',
    line2: withdrawal.profile?.full_name || 'Account holder not confirmed',
  };
}

export default function AdminWithdrawalsPage() {
  const [adminProfile, setAdminProfile] = useState<AdminProfile | null>(null);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [methodFilter, setMethodFilter] = useState<MethodFilter>('ALL');

  const [rejectWithdrawalId, setRejectWithdrawalId] = useState<string | null>(
    null
  );
  const [rejectReason, setRejectReason] = useState('');

  const [confirmAction, setConfirmAction] = useState<{
    type: 'APPROVE' | 'MARK_PAID';
    withdrawal: WithdrawalRow;
  } | null>(null);

  async function checkAdminAccess() {
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session?.user) {
      throw new Error('Your session has expired. Please login again.');
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, role, status')
      .eq('id', session.user.id)
      .maybeSingle();

    if (profileError || !profile) {
      throw new Error('Admin profile could not be found.');
    }

    if (
      profile.status !== 'ACTIVE' ||
      (profile.role !== 'ADMIN' && profile.role !== 'SUPER_ADMIN')
    ) {
      throw new Error('You do not have permission to manage withdrawals.');
    }

    const admin: AdminProfile = {
      id: profile.id,
      role: profile.role,
      status: profile.status,
    };

    setAdminProfile(admin);
    return admin;
  }

  async function loadWithdrawals() {
    try {
      setLoading(true);
      setErrorMessage('');
      setSuccessMessage('');

      await checkAdminAccess();

      const { data, error } = await supabase
        .from('withdrawal_requests')
        .select(
          `
          *,
          profile:profiles (
            id,
            full_name,
            phone,
            email,
            trust_score,
            verification_status,
            status
          )
        `
        )
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Withdrawal relationship query warning:', error.message);
        await loadWithdrawalsFallback();
        return;
      }

      const rows = ((data || []) as unknown as WithdrawalRow[]).map((item) => ({
        ...item,
        status: normalizeStatus(item.status),
      }));

      setWithdrawals(rows);
    } catch (error) {
      console.error('Admin withdrawals load error:', error);

      const message =
        error instanceof Error
          ? error.message
          : 'Unable to load withdrawal requests.';

      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  }

  async function loadWithdrawalsFallback() {
    const { data: withdrawalData, error: withdrawalError } = await supabase
      .from('withdrawal_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (withdrawalError) {
      throw withdrawalError;
    }

    const baseWithdrawals = ((withdrawalData || []) as WithdrawalRequest[]).map(
      (item) => ({
        ...item,
        status: normalizeStatus(item.status),
      })
    );

    if (baseWithdrawals.length === 0) {
      setWithdrawals([]);
      return;
    }

    const userIds = Array.from(
      new Set(baseWithdrawals.map((item) => item.user_id))
    );

    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select(
        'id, full_name, phone, email, trust_score, verification_status, status'
      )
      .in('id', userIds);

    if (profileError) {
      console.warn('Profiles fallback warning:', profileError.message);
    }

    const profiles = (profileData || []) as Profile[];

    const rows: WithdrawalRow[] = baseWithdrawals.map((withdrawal) => ({
      ...withdrawal,
      profile: profiles.find((item) => item.id === withdrawal.user_id) || null,
    }));

    setWithdrawals(rows);
  }

  useEffect(() => {
    loadWithdrawals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleApproveWithdrawal(withdrawalId: string) {
    try {
      setActionLoadingId(withdrawalId);
      setErrorMessage('');
      setSuccessMessage('');

      const rpcSupabase = supabase as SupabaseWithWithdrawalRpc;

      const { error } = await rpcSupabase.rpc('approve_withdrawal_request', {
        p_withdrawal_id: withdrawalId,
      });

      if (error) {
        throw new Error(error.message || 'Unable to approve withdrawal.');
      }

      setSuccessMessage('Withdrawal approved successfully.');
      setConfirmAction(null);
      await loadWithdrawals();
    } catch (error) {
      console.error('Approve withdrawal error:', error);

      const message =
        error instanceof Error ? error.message : 'Unable to approve withdrawal.';

      setErrorMessage(message);
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleRejectWithdrawal() {
    if (!rejectWithdrawalId) {
      setErrorMessage('No withdrawal selected for rejection.');
      return;
    }

    if (!rejectReason.trim()) {
      setErrorMessage('Please enter a rejection reason.');
      return;
    }

    try {
      setActionLoadingId(rejectWithdrawalId);
      setErrorMessage('');
      setSuccessMessage('');

      const rpcSupabase = supabase as SupabaseWithWithdrawalRpc;

      const { error } = await rpcSupabase.rpc('reject_withdrawal_request', {
        p_withdrawal_id: rejectWithdrawalId,
        p_reason: rejectReason.trim(),
      });

      if (error) {
        throw new Error(error.message || 'Unable to reject withdrawal.');
      }

      setSuccessMessage('Withdrawal rejected successfully.');
      setRejectWithdrawalId(null);
      setRejectReason('');
      await loadWithdrawals();
    } catch (error) {
      console.error('Reject withdrawal error:', error);

      const message =
        error instanceof Error ? error.message : 'Unable to reject withdrawal.';

      setErrorMessage(message);
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleMarkAsPaid(withdrawalId: string) {
    try {
      setActionLoadingId(withdrawalId);
      setErrorMessage('');
      setSuccessMessage('');

      const rpcSupabase = supabase as SupabaseWithWithdrawalRpc;

      const { error } = await rpcSupabase.rpc('mark_withdrawal_paid', {
        p_withdrawal_id: withdrawalId,
      });

      if (error) {
        throw new Error(error.message || 'Unable to mark withdrawal as paid.');
      }

      setSuccessMessage('Withdrawal marked as paid successfully.');
      setConfirmAction(null);
      await loadWithdrawals();
    } catch (error) {
      console.error('Mark withdrawal paid error:', error);

      const message =
        error instanceof Error
          ? error.message
          : 'Unable to mark withdrawal as paid.';

      setErrorMessage(message);
    } finally {
      setActionLoadingId(null);
    }
  }

  const stats = useMemo(() => {
    const pending = withdrawals.filter((item) => isPendingStatus(item.status));
    const approved = withdrawals.filter((item) => item.status === 'APPROVED');
    const paid = withdrawals.filter(
      (item) => item.status === 'PAID' || item.status === 'COMPLETED'
    );
    const rejected = withdrawals.filter((item) => item.status === 'REJECTED');

    const totalAmount = withdrawals.reduce(
      (sum, item) => sum + Number(item.amount || 0),
      0
    );

    const pendingAmount = pending.reduce(
      (sum, item) => sum + Number(item.amount || 0),
      0
    );

    const approvedAmount = approved.reduce(
      (sum, item) => sum + Number(item.amount || 0),
      0
    );

    const paidAmount = paid.reduce(
      (sum, item) => sum + Number(item.amount || 0),
      0
    );

    return {
      total: withdrawals.length,
      pending: pending.length,
      approved: approved.length,
      paid: paid.length,
      rejected: rejected.length,
      totalAmount,
      pendingAmount,
      approvedAmount,
      paidAmount,
    };
  }, [withdrawals]);

  const filteredWithdrawals = useMemo(() => {
    const searchValue = searchTerm.trim().toLowerCase();

    return withdrawals.filter((item) => {
      const paymentDetails = getPaymentDetails(item);

      const matchesSearch =
        !searchValue ||
        item.id.toLowerCase().includes(searchValue) ||
        item.user_id.toLowerCase().includes(searchValue) ||
        (item.profile?.full_name || '').toLowerCase().includes(searchValue) ||
        (item.profile?.phone || '').toLowerCase().includes(searchValue) ||
        (item.profile?.email || '').toLowerCase().includes(searchValue) ||
        (item.momo_number || '').toLowerCase().includes(searchValue) ||
        (item.bank_name || '').toLowerCase().includes(searchValue) ||
        (item.bank_account_number || '').toLowerCase().includes(searchValue) ||
        String(item.amount || '').includes(searchTerm.trim()) ||
        item.status.toLowerCase().includes(searchValue) ||
        (item.withdrawal_method || '').toLowerCase().includes(searchValue) ||
        paymentDetails.line1.toLowerCase().includes(searchValue);

      const matchesStatus =
        statusFilter === 'ALL' || item.status === statusFilter;

      const matchesMethod =
        methodFilter === 'ALL' || item.withdrawal_method === methodFilter;

      return matchesSearch && matchesStatus && matchesMethod;
    });
  }, [withdrawals, searchTerm, statusFilter, methodFilter]);

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-4">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-emerald-600" />
          <p className="text-sm text-gray-500">Loading withdrawals...</p>
        </div>
      </div>
    );
  }

  if (!adminProfile && errorMessage) {
    return (
      <div className="rounded-3xl border border-red-100 bg-red-50 p-6 text-red-700">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <h2 className="font-bold">Unable to load withdrawals</h2>
            <p className="mt-1 text-sm">{errorMessage}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="rounded-3xl bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-600 p-6 text-white shadow-sm md:p-8">
        <div className="flex flex-col justify-between gap-6 xl:flex-row xl:items-center">
          <div>
            <p className="mb-3 inline-flex rounded-full bg-white/15 px-4 py-1 text-sm font-medium">
              Admin Withdrawal Control
            </p>

            <h1 className="text-3xl font-black md:text-4xl">
              Withdrawal Requests
            </h1>

            <p className="mt-4 max-w-3xl text-sm leading-7 text-emerald-50 md:text-base">
              Review withdrawal requests, approve valid requests, reject
              suspicious requests, and mark completed payments as paid.
            </p>
          </div>

          <button
            type="button"
            onClick={loadWithdrawals}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-emerald-700 hover:bg-emerald-50"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>
      </div>

      {errorMessage && (
        <AlertBox type="error" message={errorMessage} />
      )}

      {successMessage && (
        <AlertBox type="success" message={successMessage} />
      )}

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-5">
        <StatCard
          title="Total Requests"
          value={stats.total}
          icon={<Wallet size={24} />}
          color="emerald"
        />
        <StatCard
          title="Pending"
          value={stats.pending}
          icon={<Clock size={24} />}
          color="amber"
        />
        <StatCard
          title="Approved"
          value={stats.approved}
          icon={<CheckCircle2 size={24} />}
          color="blue"
        />
        <StatCard
          title="Paid"
          value={stats.paid}
          icon={<Wallet size={24} />}
          color="green"
        />
        <StatCard
          title="Rejected"
          value={stats.rejected}
          icon={<XCircle size={24} />}
          color="red"
        />
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        <ValueCard title="Total Requested Value" value={stats.totalAmount} />
        <ValueCard
          title="Pending Value"
          value={stats.pendingAmount}
          variant="amber"
        />
        <ValueCard
          title="Approved Awaiting Payment"
          value={stats.approvedAmount}
          variant="blue"
        />
      </div>

      <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm md:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="text-xl font-black text-gray-900">
              All Withdrawal Requests
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Search, filter, review, approve, reject, and mark withdrawals as
              paid.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-3 xl:min-w-[760px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search member, phone, MoMo, amount..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="min-h-12 w-full rounded-xl border border-gray-200 py-3 pl-10 pr-4 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as StatusFilter)
              }
              className="min-h-12 rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            >
              <option value="ALL">All Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="PENDING_ADMIN_APPROVAL">
                Pending Admin Approval
              </option>
              <option value="APPROVED">Approved</option>
              <option value="PAID">Paid</option>
              <option value="REJECTED">Rejected</option>
            </select>

            <select
              value={methodFilter}
              onChange={(event) =>
                setMethodFilter(event.target.value as MethodFilter)
              }
              className="min-h-12 rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            >
              <option value="ALL">All Methods</option>
              <option value="MOMO">MoMo</option>
              <option value="BANK">Bank</option>
            </select>
          </div>
        </div>

        <div className="mt-6 space-y-4 lg:hidden">
          {filteredWithdrawals.length === 0 ? (
            <EmptyState />
          ) : (
            filteredWithdrawals.map((withdrawal) => (
              <WithdrawalCard
                key={withdrawal.id}
                withdrawal={withdrawal}
                actionLoadingId={actionLoadingId}
                onApprove={(item) =>
                  setConfirmAction({ type: 'APPROVE', withdrawal: item })
                }
                onReject={(id) => {
                  setRejectWithdrawalId(id);
                  setRejectReason('');
                  setErrorMessage('');
                  setSuccessMessage('');
                }}
                onMarkPaid={(item) =>
                  setConfirmAction({ type: 'MARK_PAID', withdrawal: item })
                }
              />
            ))
          )}
        </div>

        <div className="mt-6 hidden overflow-hidden rounded-2xl border border-gray-100 lg:block">
          {filteredWithdrawals.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1180px] text-left">
                <thead className="bg-gray-50">
                  <tr>
                    <TableHead>Member</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Payment Details</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Requested</TableHead>
                    <TableHead align="right">Actions</TableHead>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100 bg-white">
                  {filteredWithdrawals.map((withdrawal) => (
                    <WithdrawalTableRow
                      key={withdrawal.id}
                      withdrawal={withdrawal}
                      actionLoadingId={actionLoadingId}
                      onApprove={(item) =>
                        setConfirmAction({ type: 'APPROVE', withdrawal: item })
                      }
                      onReject={(id) => {
                        setRejectWithdrawalId(id);
                        setRejectReason('');
                        setErrorMessage('');
                        setSuccessMessage('');
                      }}
                      onMarkPaid={(item) =>
                        setConfirmAction({
                          type: 'MARK_PAID',
                          withdrawal: item,
                        })
                      }
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="mt-5 flex flex-col justify-between gap-3 text-sm text-gray-500 sm:flex-row sm:items-center">
          <p>
            Showing {filteredWithdrawals.length} of {withdrawals.length}{' '}
            withdrawals
          </p>

          <button
            type="button"
            onClick={() => {
              setSearchTerm('');
              setStatusFilter('ALL');
              setMethodFilter('ALL');
            }}
            className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50"
          >
            Clear Filters
          </button>
        </div>
      </div>

      {rejectWithdrawalId && (
        <RejectModal
          rejectReason={rejectReason}
          setRejectReason={setRejectReason}
          loading={actionLoadingId === rejectWithdrawalId}
          onCancel={() => {
            setRejectWithdrawalId(null);
            setRejectReason('');
          }}
          onConfirm={handleRejectWithdrawal}
        />
      )}

      {confirmAction && (
        <ConfirmActionModal
          action={confirmAction}
          loading={actionLoadingId === confirmAction.withdrawal.id}
          onCancel={() => setConfirmAction(null)}
          onConfirm={() => {
            if (confirmAction.type === 'APPROVE') {
              handleApproveWithdrawal(confirmAction.withdrawal.id);
            } else {
              handleMarkAsPaid(confirmAction.withdrawal.id);
            }
          }}
        />
      )}

      <div className="rounded-3xl border border-amber-100 bg-amber-50 p-5 md:p-6">
        <h2 className="text-lg font-bold text-amber-800">
          Admin withdrawal safety reminder
        </h2>

        <p className="mt-2 text-sm leading-6 text-amber-700">
          Before approving or marking a withdrawal as paid, confirm the user’s
          wallet balance, trust score, payout history, MoMo or bank details, and
          withdrawal amount. This protects the platform from mistakes and fraud.
        </p>
      </div>
    </div>
  );
}

function AlertBox({
  type,
  message,
}: {
  type: 'error' | 'success';
  message: string;
}) {
  const isError = type === 'error';

  return (
    <div
      className={`flex items-start gap-3 rounded-2xl border p-4 text-sm font-semibold ${
        isError
          ? 'border-red-100 bg-red-50 text-red-700'
          : 'border-emerald-100 bg-emerald-50 text-emerald-700'
      }`}
    >
      {isError ? (
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
      ) : (
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
      )}
      <span>{message}</span>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
  color,
}: {
  title: string;
  value: number;
  icon: ReactNode;
  color: 'emerald' | 'amber' | 'blue' | 'green' | 'red';
}) {
  const classes = {
    emerald: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    blue: 'bg-blue-50 text-blue-700',
    green: 'bg-green-50 text-green-700',
    red: 'bg-red-50 text-red-700',
  };

  return (
    <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm md:p-6">
      <div className={`mb-4 inline-flex rounded-2xl p-3 ${classes[color]}`}>
        {icon}
      </div>
      <p className="text-sm text-gray-500">{title}</p>
      <h3 className="mt-1 text-3xl font-black text-gray-900">{value}</h3>
    </div>
  );
}

function ValueCard({
  title,
  value,
  variant = 'default',
}: {
  title: string;
  value: number;
  variant?: 'default' | 'amber' | 'blue';
}) {
  const classes = {
    default: 'border-gray-100 bg-white text-gray-900',
    amber: 'border-amber-100 bg-amber-50 text-amber-800',
    blue: 'border-blue-100 bg-blue-50 text-blue-800',
  };

  return (
    <div className={`rounded-3xl border p-5 shadow-sm md:p-6 ${classes[variant]}`}>
      <p className="text-sm opacity-80">{title}</p>
      <h3 className="mt-2 text-2xl font-black md:text-3xl">
        {formatCurrency(value)}
      </h3>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="p-10 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gray-50 text-gray-400">
        <Wallet size={28} />
      </div>

      <h3 className="text-lg font-bold text-gray-900">
        No withdrawals found
      </h3>

      <p className="mt-2 text-sm text-gray-500">
        No withdrawal matches your current search or filter.
      </p>
    </div>
  );
}

function WithdrawalCard({
  withdrawal,
  actionLoadingId,
  onApprove,
  onReject,
  onMarkPaid,
}: {
  withdrawal: WithdrawalRow;
  actionLoadingId: string | null;
  onApprove: (withdrawal: WithdrawalRow) => void;
  onReject: (withdrawalId: string) => void;
  onMarkPaid: (withdrawal: WithdrawalRow) => void;
}) {
  const paymentDetails = getPaymentDetails(withdrawal);
  const isPending = isPendingStatus(withdrawal.status);
  const isApproved = withdrawal.status === 'APPROVED';
  const isPaid =
    withdrawal.status === 'PAID' || withdrawal.status === 'COMPLETED';
  const isRejected = withdrawal.status === 'REJECTED';
  const isActionLoading = actionLoadingId === withdrawal.id;

  return (
    <div className="rounded-3xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-gray-500">Amount</p>
          <p className="text-2xl font-black text-gray-900">
            {formatCurrency(withdrawal.amount)}
          </p>
        </div>

        <StatusBadge status={withdrawal.status} />
      </div>

      <MemberBlock withdrawal={withdrawal} />

      <div className="mt-4 grid gap-3 text-sm">
        <InfoBlock label="Method" value={formatLabel(withdrawal.withdrawal_method)} />
        <InfoBlock
          label="Payment Details"
          value={`${paymentDetails.title} · ${paymentDetails.line1}`}
          subValue={paymentDetails.line2}
        />
        <InfoBlock label="Requested" value={formatDateTime(withdrawal.created_at)} />
      </div>

      <ActionButtons
        isPending={isPending}
        isApproved={isApproved}
        isPaid={isPaid}
        isRejected={isRejected}
        isActionLoading={isActionLoading}
        onApprove={() => onApprove(withdrawal)}
        onReject={() => onReject(withdrawal.id)}
        onMarkPaid={() => onMarkPaid(withdrawal)}
      />
    </div>
  );
}

function WithdrawalTableRow({
  withdrawal,
  actionLoadingId,
  onApprove,
  onReject,
  onMarkPaid,
}: {
  withdrawal: WithdrawalRow;
  actionLoadingId: string | null;
  onApprove: (withdrawal: WithdrawalRow) => void;
  onReject: (withdrawalId: string) => void;
  onMarkPaid: (withdrawal: WithdrawalRow) => void;
}) {
  const paymentDetails = getPaymentDetails(withdrawal);
  const isPending = isPendingStatus(withdrawal.status);
  const isApproved = withdrawal.status === 'APPROVED';
  const isPaid =
    withdrawal.status === 'PAID' || withdrawal.status === 'COMPLETED';
  const isRejected = withdrawal.status === 'REJECTED';
  const isActionLoading = actionLoadingId === withdrawal.id;

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-5 py-5">
        <MemberBlock withdrawal={withdrawal} compact />
      </td>

      <td className="px-5 py-5">
        <p className="font-black text-gray-900">
          {formatCurrency(withdrawal.amount)}
        </p>
      </td>

      <td className="px-5 py-5">
        <p className="font-semibold text-gray-900">
          {formatLabel(withdrawal.withdrawal_method)}
        </p>
      </td>

      <td className="px-5 py-5">
        <div className="text-sm text-gray-700">
          <p className="font-bold text-gray-900">{paymentDetails.title}</p>
          <p className="text-xs text-gray-500">{paymentDetails.line1}</p>
          <p className="text-xs text-gray-500">{paymentDetails.line2}</p>
        </div>

        {(withdrawal.rejection_reason || withdrawal.admin_note) && (
          <p className="mt-2 max-w-[260px] text-xs font-semibold text-red-600">
            {withdrawal.rejection_reason || withdrawal.admin_note}
          </p>
        )}
      </td>

      <td className="px-5 py-5">
        <StatusBadge status={withdrawal.status} />

        {withdrawal.approved_at && (
          <p className="mt-2 text-xs text-gray-500">
            Approved: {formatDate(withdrawal.approved_at)}
          </p>
        )}

        {withdrawal.paid_at && (
          <p className="mt-1 text-xs text-gray-500">
            Paid: {formatDate(withdrawal.paid_at)}
          </p>
        )}
      </td>

      <td className="px-5 py-5 text-sm text-gray-700">
        {formatDateTime(withdrawal.created_at)}
      </td>

      <td className="px-5 py-5 text-right">
        <ActionButtons
          isPending={isPending}
          isApproved={isApproved}
          isPaid={isPaid}
          isRejected={isRejected}
          isActionLoading={isActionLoading}
          onApprove={() => onApprove(withdrawal)}
          onReject={() => onReject(withdrawal.id)}
          onMarkPaid={() => onMarkPaid(withdrawal)}
        />
      </td>
    </tr>
  );
}

function MemberBlock({
  withdrawal,
  compact = false,
}: {
  withdrawal: WithdrawalRow;
  compact?: boolean;
}) {
  return (
    <div className={compact ? '' : 'mt-4 rounded-2xl bg-gray-50 p-4'}>
      <p className="font-bold text-gray-900">
        {withdrawal.profile?.full_name || 'Unknown member'}
      </p>

      <p className="mt-1 text-xs text-gray-500">
        {withdrawal.profile?.phone || 'No phone'} ·{' '}
        {withdrawal.profile?.email || 'No email'}
      </p>

      <div className="mt-2 flex flex-wrap gap-2">
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-bold ${getTrustScoreStyle(
            withdrawal.profile?.trust_score
          )}`}
        >
          Trust Score: {withdrawal.profile?.trust_score ?? 0}
        </span>

        {withdrawal.profile?.verification_status && (
          <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">
            {formatLabel(withdrawal.profile.verification_status)}
          </span>
        )}

        {withdrawal.profile?.status && (
          <span className="rounded-full bg-gray-50 px-2.5 py-1 text-xs font-bold text-gray-700">
            {formatLabel(withdrawal.profile.status)}
          </span>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string | null | undefined }) {
  const normalized = normalizeStatus(status);

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-bold ${getStatusStyle(
        normalized
      )}`}
    >
      {(normalized === 'PAID' || normalized === 'COMPLETED') && (
        <CheckCircle2 size={13} />
      )}
      {normalized === 'REJECTED' && <XCircle size={13} />}
      {formatLabel(normalized)}
    </span>
  );
}

function InfoBlock({
  label,
  value,
  subValue,
}: {
  label: string;
  value: string;
  subValue?: string;
}) {
  return (
    <div>
      <p className="text-gray-500">{label}</p>
      <p className="font-semibold text-gray-900">{value}</p>
      {subValue && <p className="text-xs text-gray-500">{subValue}</p>}
    </div>
  );
}

function ActionButtons({
  isPending,
  isApproved,
  isPaid,
  isRejected,
  isActionLoading,
  onApprove,
  onReject,
  onMarkPaid,
}: {
  isPending: boolean;
  isApproved: boolean;
  isPaid: boolean;
  isRejected: boolean;
  isActionLoading: boolean;
  onApprove: () => void;
  onReject: () => void;
  onMarkPaid: () => void;
}) {
  return (
    <div className="mt-5 flex flex-wrap justify-end gap-2 lg:mt-0">
      {isPending && (
        <>
          <button
            type="button"
            disabled={isActionLoading}
            onClick={onApprove}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {isActionLoading && <Loader2 className="h-3 w-3 animate-spin" />}
            Approve
          </button>

          <button
            type="button"
            disabled={isActionLoading}
            onClick={onReject}
            className="inline-flex min-h-10 items-center justify-center rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            Reject
          </button>
        </>
      )}

      {isApproved && (
        <button
          type="button"
          disabled={isActionLoading}
          onClick={onMarkPaid}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          {isActionLoading && <Loader2 className="h-3 w-3 animate-spin" />}
          Mark Paid
        </button>
      )}

      {isPaid && (
        <span className="inline-flex min-h-10 items-center gap-1 rounded-xl bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-700">
          <CheckCircle2 size={13} />
          Paid
        </span>
      )}

      {isRejected && (
        <span className="inline-flex min-h-10 items-center gap-1 rounded-xl bg-red-50 px-4 py-2 text-xs font-bold text-red-700">
          <XCircle size={13} />
          Rejected
        </span>
      )}
    </div>
  );
}

function RejectModal({
  rejectReason,
  setRejectReason,
  loading,
  onCancel,
  onConfirm,
}: {
  rejectReason: string;
  setRejectReason: (value: string) => void;
  loading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-3xl bg-white p-5 shadow-xl md:p-6">
        <h2 className="text-xl font-bold text-gray-900">Reject Withdrawal</h2>

        <p className="mt-2 text-sm leading-6 text-gray-500">
          Enter the reason why this withdrawal is being rejected. This helps
          maintain a clear admin record.
        </p>

        <textarea
          value={rejectReason}
          onChange={(event) => setRejectReason(event.target.value)}
          rows={5}
          placeholder="Example: Wrong MoMo number, suspicious account, or invalid request."
          className="mt-5 w-full rounded-2xl border border-gray-200 p-4 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
        />

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-11 rounded-xl border border-gray-200 px-5 py-3 text-sm font-bold text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-red-600 px-5 py-3 text-sm font-bold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Reject Withdrawal
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfirmActionModal({
  action,
  loading,
  onCancel,
  onConfirm,
}: {
  action: {
    type: 'APPROVE' | 'MARK_PAID';
    withdrawal: WithdrawalRow;
  };
  loading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const isApprove = action.type === 'APPROVE';
  const paymentDetails = getPaymentDetails(action.withdrawal);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-3xl bg-white p-5 shadow-xl md:p-6">
        <h2 className="text-xl font-bold text-gray-900">
          {isApprove ? 'Approve Withdrawal?' : 'Mark Withdrawal as Paid?'}
        </h2>

        <p className="mt-2 text-sm leading-6 text-gray-500">
          {isApprove
            ? 'Confirm that this request is valid before approving it.'
            : 'Only mark this as paid after the money has actually been sent.'}
        </p>

        <div className="mt-5 rounded-2xl bg-gray-50 p-4 text-sm">
          <p className="font-bold text-gray-900">
            {action.withdrawal.profile?.full_name || 'Unknown member'}
          </p>
          <p className="mt-1 text-gray-600">
            Amount: {formatCurrency(action.withdrawal.amount)}
          </p>
          <p className="mt-1 text-gray-600">
            Payment: {paymentDetails.title} · {paymentDetails.line1}
          </p>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-11 rounded-xl border border-gray-200 px-5 py-3 text-sm font-bold text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {isApprove ? 'Approve Withdrawal' : 'Confirm Paid'}
          </button>
        </div>
      </div>
    </div>
  );
}

function TableHead({
  children,
  align = 'left',
}: {
  children: ReactNode;
  align?: 'left' | 'right';
}) {
  return (
    <th
      className={`px-5 py-4 text-xs font-black uppercase tracking-wide text-gray-500 ${
        align === 'right' ? 'text-right' : 'text-left'
      }`}
    >
      {children}
    </th>
  );
}