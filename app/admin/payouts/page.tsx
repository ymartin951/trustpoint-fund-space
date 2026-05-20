'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  CircleDollarSign,
  Clock,
  Loader2,
  RefreshCw,
  Search,
  WalletCards,
  XCircle,
} from 'lucide-react';

import { supabase } from '@/lib/supabase/client';

type Payout = {
  id: string;
  fund_space_id: string;
  round_id: string;
  user_id: string;
  amount: number;
  status: string;
  approved_at: string | null;
  paid_at: string | null;
  created_at: string | null;
};

type FundSpace = {
  id: string;
  name: string | null;
  contribution_amount: number | null;
  status: string | null;
};

type Round = {
  id: string;
  round_number: number;
  due_date: string | null;
  status: string | null;
};

type Profile = {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  momo_number?: string | null;
  bank_name?: string | null;
  bank_account_number?: string | null;
  bank_account_name?: string | null;
};

type PayoutRow = Payout & {
  fund_space?: FundSpace | null;
  round?: Round | null;
  profile?: Profile | null;
};

function formatCurrency(amount: number | null | undefined) {
  return `GH₵${Number(amount || 0).toLocaleString()}`;
}

function formatDate(dateString: string | null | undefined) {
  if (!dateString) return 'Not set';

  return new Date(dateString).toLocaleDateString('en-GH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function getStatusStyle(status: string | null | undefined) {
  const value = status || 'PENDING';

  if (['PAID', 'APPROVED', 'COMPLETED'].includes(value)) {
    return 'bg-emerald-50 text-emerald-700 border-emerald-100';
  }

  if (['PENDING', 'PENDING_ADMIN_APPROVAL'].includes(value)) {
    return 'bg-amber-50 text-amber-700 border-amber-100';
  }

  if (['REJECTED', 'FAILED', 'CANCELLED'].includes(value)) {
    return 'bg-red-50 text-red-700 border-red-100';
  }

  return 'bg-gray-50 text-gray-700 border-gray-100';
}

export default function AdminPayoutsPage() {
  const [payouts, setPayouts] = useState<PayoutRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [rejectPayoutId, setRejectPayoutId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => {
    loadPayouts();
  }, []);

  const loadPayouts = async () => {
    try {
      setLoading(true);
      setErrorMessage('');
      setSuccessMessage('');

      /*
        First try relationship query.
        If Supabase relationships are not detected, the fallback below will still load payouts.
      */
      const { data, error } = await supabase
        .from('fund_space_payouts')
        .select(
          `
          *,
          fund_space:fund_spaces (
            id,
            name,
            contribution_amount,
            status
          ),
          round:fund_space_rounds (
            id,
            round_number,
            due_date,
            status
          ),
          profile:profiles (
            id,
            full_name,
            phone,
            email,
            momo_number,
            bank_name,
            bank_account_number,
            bank_account_name
          )
        `
        )
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Payout relationship query warning:', error.message);
        await loadPayoutsFallback();
        return;
      }

      setPayouts((data || []) as unknown as PayoutRow[]);
    } catch (error: unknown) {
      console.error('Admin payouts load error:', error);

      const message =
        error instanceof Error ? error.message : 'Unable to load payouts.';

      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  };

  const loadPayoutsFallback = async () => {
    const { data: payoutData, error: payoutError } = await supabase
      .from('fund_space_payouts')
      .select('*')
      .order('created_at', { ascending: false });

    if (payoutError) {
      throw payoutError;
    }

    const basePayouts = (payoutData || []) as unknown as Payout[];

    if (basePayouts.length === 0) {
      setPayouts([]);
      return;
    }

    const fundSpaceIds = Array.from(new Set(basePayouts.map((item) => item.fund_space_id)));
    const roundIds = Array.from(new Set(basePayouts.map((item) => item.round_id)));
    const userIds = Array.from(new Set(basePayouts.map((item) => item.user_id)));

    const [
      fundSpacesResponse,
      roundsResponse,
      profilesResponse,
    ] = await Promise.all([
      supabase.from('fund_spaces').select('*').in('id', fundSpaceIds),
      supabase.from('fund_space_rounds').select('*').in('id', roundIds),
      supabase
        .from('profiles')
        .select(
          'id, full_name, phone, email, momo_number, bank_name, bank_account_number, bank_account_name'
        )
        .in('id', userIds),
    ]);

    if (fundSpacesResponse.error) {
      console.warn('Fund Spaces fallback warning:', fundSpacesResponse.error.message);
    }

    if (roundsResponse.error) {
      console.warn('Rounds fallback warning:', roundsResponse.error.message);
    }

    if (profilesResponse.error) {
      console.warn('Profiles fallback warning:', profilesResponse.error.message);
    }

    const fundSpaces = (fundSpacesResponse.data || []) as FundSpace[];
    const rounds = (roundsResponse.data || []) as unknown as Round[];
    const profiles = (profilesResponse.data || []) as Profile[];

    const rows: PayoutRow[] = basePayouts.map((payout) => ({
      ...payout,
      fund_space: fundSpaces.find((item) => item.id === payout.fund_space_id) || null,
      round: rounds.find((item) => item.id === payout.round_id) || null,
      profile: profiles.find((item) => item.id === payout.user_id) || null,
    }));

    setPayouts(rows);
  };

  const handleApprovePayout = async (payoutId: string) => {
    try {
      setActionLoadingId(payoutId);
      setErrorMessage('');
      setSuccessMessage('');

      const { error } = await supabase.rpc('approve_fund_space_payout', {
        p_payout_id: payoutId,
      });

      if (error) {
        throw error;
      }

      setSuccessMessage('Payout approved successfully.');
      await loadPayouts();
    } catch (error: unknown) {
      console.error('Approve payout error:', error);

      const message =
        error instanceof Error ? error.message : 'Unable to approve payout.';

      setErrorMessage(message);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRejectPayout = async () => {
    if (!rejectPayoutId) {
      setErrorMessage('No payout selected for rejection.');
      return;
    }

    if (!rejectReason.trim()) {
      setErrorMessage('Please enter a reason for rejecting this payout.');
      return;
    }

    try {
      setActionLoadingId(rejectPayoutId);
      setErrorMessage('');
      setSuccessMessage('');

      const { error } = await supabase.rpc('reject_fund_space_payout', {
        p_payout_id: rejectPayoutId,
        p_reason: rejectReason.trim(),
      });

      if (error) {
        throw error;
      }

      setSuccessMessage('Payout rejected successfully.');
      setRejectPayoutId(null);
      setRejectReason('');
      await loadPayouts();
    } catch (error: unknown) {
      console.error('Reject payout error:', error);

      const message =
        error instanceof Error ? error.message : 'Unable to reject payout.';

      setErrorMessage(message);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleMarkAsPaid = async (payoutId: string) => {
    try {
      setActionLoadingId(payoutId);
      setErrorMessage('');
      setSuccessMessage('');

      const { error } = await supabase.rpc('mark_fund_space_payout_paid', {
          p_payout_id: payoutId,
          p_payout_method: ''
      });

      if (error) {
        throw error;
      }

      setSuccessMessage('Payout marked as paid successfully.');
      await loadPayouts();
    } catch (error: unknown) {
      console.error('Mark payout paid error:', error);

      const message =
        error instanceof Error ? error.message : 'Unable to mark payout as paid.';

      setErrorMessage(message);
    } finally {
      setActionLoadingId(null);
    }
  };

  const stats = useMemo(() => {
    const total = payouts.length;
    const pending = payouts.filter((item) =>
      ['PENDING', 'PENDING_ADMIN_APPROVAL'].includes(item.status)
    ).length;
    const approved = payouts.filter((item) => item.status === 'APPROVED').length;
    const paid = payouts.filter((item) => item.status === 'PAID').length;
    const rejected = payouts.filter((item) => item.status === 'REJECTED').length;

    const totalAmount = payouts.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const pendingAmount = payouts
      .filter((item) => ['PENDING', 'PENDING_ADMIN_APPROVAL'].includes(item.status))
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    return {
      total,
      pending,
      approved,
      paid,
      rejected,
      totalAmount,
      pendingAmount,
    };
  }, [payouts]);

  const filteredPayouts = useMemo(() => {
    return payouts.filter((item) => {
      const memberName = item.profile?.full_name || '';
      const phone = item.profile?.phone || '';
      const email = item.profile?.email || '';
      const groupName = item.fund_space?.name || '';
      const roundNumber = item.round?.round_number ? String(item.round.round_number) : '';
      const amount = String(item.amount || '');
      const status = item.status || '';

      const searchValue = searchTerm.toLowerCase();

      const matchesSearch =
        item.id.toLowerCase().includes(searchValue) ||
        memberName.toLowerCase().includes(searchValue) ||
        phone.toLowerCase().includes(searchValue) ||
        email.toLowerCase().includes(searchValue) ||
        groupName.toLowerCase().includes(searchValue) ||
        roundNumber.includes(searchTerm) ||
        amount.includes(searchTerm) ||
        status.toLowerCase().includes(searchValue);

      const matchesStatus = statusFilter === 'ALL' || item.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [payouts, searchTerm, statusFilter]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-emerald-600" />
          <p className="text-sm text-gray-500">Loading payouts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="rounded-3xl bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-600 p-8 text-white shadow-sm">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
          <div>
            <p className="mb-3 inline-flex rounded-full bg-white/15 px-4 py-1 text-sm font-medium">
              Admin Payout Control
            </p>

            <h1 className="text-3xl font-bold md:text-4xl">
              Fund Space Payouts
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-7 text-emerald-50 md:text-base">
              Review, approve, reject, and mark Fund Space payouts as paid. This is one of the most
              sensitive areas of TrustPoint Fund Space, so every payout must be checked carefully.
            </p>
          </div>

          <button
            type="button"
            onClick={loadPayouts}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-emerald-700 hover:bg-emerald-50"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      {successMessage && (
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-700">
          {successMessage}
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="mb-4 inline-flex rounded-2xl bg-emerald-50 p-3 text-emerald-700">
            <WalletCards size={24} />
          </div>
          <p className="text-sm text-gray-500">Total Payouts</p>
          <h3 className="mt-1 text-3xl font-black text-gray-900">{stats.total}</h3>
        </div>

        <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="mb-4 inline-flex rounded-2xl bg-amber-50 p-3 text-amber-700">
            <Clock size={24} />
          </div>
          <p className="text-sm text-gray-500">Pending</p>
          <h3 className="mt-1 text-3xl font-black text-gray-900">{stats.pending}</h3>
        </div>

        <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="mb-4 inline-flex rounded-2xl bg-emerald-50 p-3 text-emerald-700">
            <CheckCircle2 size={24} />
          </div>
          <p className="text-sm text-gray-500">Approved</p>
          <h3 className="mt-1 text-3xl font-black text-gray-900">{stats.approved}</h3>
        </div>

        <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="mb-4 inline-flex rounded-2xl bg-emerald-50 p-3 text-emerald-700">
            <CircleDollarSign size={24} />
          </div>
          <p className="text-sm text-gray-500">Paid</p>
          <h3 className="mt-1 text-3xl font-black text-gray-900">{stats.paid}</h3>
        </div>

        <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="mb-4 inline-flex rounded-2xl bg-red-50 p-3 text-red-700">
            <XCircle size={24} />
          </div>
          <p className="text-sm text-gray-500">Rejected</p>
          <h3 className="mt-1 text-3xl font-black text-gray-900">{stats.rejected}</h3>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">Total Payout Value</p>
          <h3 className="mt-2 text-3xl font-black text-gray-900">
            {formatCurrency(stats.totalAmount)}
          </h3>
        </div>

        <div className="rounded-3xl border border-amber-100 bg-amber-50 p-6 shadow-sm">
          <p className="text-sm text-amber-700">Pending Payout Value</p>
          <h3 className="mt-2 text-3xl font-black text-amber-800">
            {formatCurrency(stats.pendingAmount)}
          </h3>
        </div>
      </div>

      <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              All Payout Requests
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Search and manage payout records from all Fund Space groups.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:min-w-[600px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search member, group, amount, status..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="w-full rounded-xl border border-gray-200 py-3 pl-10 pr-4 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            >
              <option value="ALL">All Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="PENDING_ADMIN_APPROVAL">Pending Admin Approval</option>
              <option value="APPROVED">Approved</option>
              <option value="PAID">Paid</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border border-gray-100">
          {filteredPayouts.length === 0 ? (
            <div className="p-10 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gray-50 text-gray-400">
                <WalletCards size={28} />
              </div>

              <h3 className="text-lg font-bold text-gray-900">
                No payouts found
              </h3>

              <p className="mt-2 text-sm text-gray-500">
                No payout matches your current search or filter.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1200px] text-left">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-5 py-4 text-xs font-bold uppercase tracking-wide text-gray-500">
                      Member
                    </th>
                    <th className="px-5 py-4 text-xs font-bold uppercase tracking-wide text-gray-500">
                      Group
                    </th>
                    <th className="px-5 py-4 text-xs font-bold uppercase tracking-wide text-gray-500">
                      Round
                    </th>
                    <th className="px-5 py-4 text-xs font-bold uppercase tracking-wide text-gray-500">
                      Amount
                    </th>
                    <th className="px-5 py-4 text-xs font-bold uppercase tracking-wide text-gray-500">
                      Payment Details
                    </th>
                    <th className="px-5 py-4 text-xs font-bold uppercase tracking-wide text-gray-500">
                      Status
                    </th>
                    <th className="px-5 py-4 text-xs font-bold uppercase tracking-wide text-gray-500">
                      Created
                    </th>
                    <th className="px-5 py-4 text-right text-xs font-bold uppercase tracking-wide text-gray-500">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100 bg-white">
                  {filteredPayouts.map((payout) => {
                    const isPending = ['PENDING', 'PENDING_ADMIN_APPROVAL'].includes(
                      payout.status
                    );
                    const isApproved = payout.status === 'APPROVED';
                    const isPaid = payout.status === 'PAID';
                    const isRejected = payout.status === 'REJECTED';
                    const isActionLoading = actionLoadingId === payout.id;

                    return (
                      <tr key={payout.id} className="hover:bg-gray-50">
                        <td className="px-5 py-5">
                          <p className="font-bold text-gray-900">
                            {payout.profile?.full_name || 'Unknown member'}
                          </p>
                          <p className="mt-1 text-xs text-gray-500">
                            {payout.profile?.phone || 'No phone'}
                          </p>
                          <p className="mt-1 text-xs text-gray-500">
                            {payout.profile?.email || 'No email'}
                          </p>
                        </td>

                        <td className="px-5 py-5">
                          <p className="font-semibold text-gray-900">
                            {payout.fund_space?.name || 'Fund Space'}
                          </p>
                          <Link
                            href={`/admin/fund-spaces/${payout.fund_space_id}`}
                            className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:text-emerald-700"
                          >
                            View group
                            <ArrowRight size={12} />
                          </Link>
                        </td>

                        <td className="px-5 py-5">
                          <p className="font-semibold text-gray-900">
                            Round {payout.round?.round_number ?? 'Unknown'}
                          </p>
                          <p className="mt-1 text-xs text-gray-500">
                            Due: {formatDate(payout.round?.due_date)}
                          </p>
                        </td>

                        <td className="px-5 py-5">
                          <p className="font-black text-gray-900">
                            {formatCurrency(payout.amount)}
                          </p>
                        </td>

                        <td className="px-5 py-5">
                          <p className="text-sm font-semibold text-gray-900">
                            MoMo: {payout.profile?.momo_number || 'Not provided'}
                          </p>

                          {(payout.profile?.bank_name ||
                            payout.profile?.bank_account_number ||
                            payout.profile?.bank_account_name) && (
                            <div className="mt-2 text-xs text-gray-500">
                              <p>{payout.profile?.bank_name || 'No bank name'}</p>
                              <p>{payout.profile?.bank_account_number || 'No account number'}</p>
                              <p>{payout.profile?.bank_account_name || 'No account name'}</p>
                            </div>
                          )}
                        </td>

                        <td className="px-5 py-5">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-bold ${getStatusStyle(
                              payout.status
                            )}`}
                          >
                            {isPaid && <CheckCircle2 size={13} />}
                            {isRejected && <XCircle size={13} />}
                            {payout.status}
                          </span>

                          {payout.approved_at && (
                            <p className="mt-2 text-xs text-gray-500">
                              Approved: {formatDate(payout.approved_at)}
                            </p>
                          )}

                          {payout.paid_at && (
                            <p className="mt-1 text-xs text-gray-500">
                              Paid: {formatDate(payout.paid_at)}
                            </p>
                          )}
                        </td>

                        <td className="px-5 py-5 text-sm text-gray-700">
                          {formatDate(payout.created_at)}
                        </td>

                        <td className="px-5 py-5 text-right">
                          <div className="flex flex-wrap justify-end gap-2">
                            {isPending && (
                              <>
                                <button
                                  type="button"
                                  disabled={isActionLoading}
                                  onClick={() => handleApprovePayout(payout.id)}
                                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                                >
                                  {isActionLoading && (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  )}
                                  Approve
                                </button>

                                <button
                                  type="button"
                                  disabled={isActionLoading}
                                  onClick={() => {
                                    setRejectPayoutId(payout.id);
                                    setRejectReason('');
                                    setErrorMessage('');
                                    setSuccessMessage('');
                                  }}
                                  className="inline-flex items-center justify-center rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                                >
                                  Reject
                                </button>
                              </>
                            )}

                            {isApproved && (
                              <button
                                type="button"
                                disabled={isActionLoading}
                                onClick={() => handleMarkAsPaid(payout.id)}
                                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                              >
                                {isActionLoading && (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                )}
                                Mark Paid
                              </button>
                            )}

                            {isPaid && (
                              <span className="inline-flex items-center gap-1 rounded-xl bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-700">
                                <CheckCircle2 size={13} />
                                Paid
                              </span>
                            )}

                            {isRejected && (
                              <span className="inline-flex items-center gap-1 rounded-xl bg-red-50 px-4 py-2 text-xs font-bold text-red-700">
                                <XCircle size={13} />
                                Rejected
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {rejectPayoutId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-xl">
            <h2 className="text-xl font-bold text-gray-900">Reject Payout</h2>

            <p className="mt-2 text-sm leading-6 text-gray-500">
              Please enter the reason why this payout is being rejected. This helps keep a clear
              admin record.
            </p>

            <textarea
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
              rows={5}
              placeholder="Example: Contribution records are incomplete for this round."
              className="mt-5 w-full rounded-2xl border border-gray-200 p-4 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  setRejectPayoutId(null);
                  setRejectReason('');
                }}
                className="rounded-xl border border-gray-200 px-5 py-3 text-sm font-bold text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleRejectPayout}
                disabled={actionLoadingId === rejectPayoutId}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-5 py-3 text-sm font-bold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                {actionLoadingId === rejectPayoutId && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                Reject Payout
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-3xl border border-amber-100 bg-amber-50 p-6">
        <h2 className="text-lg font-bold text-amber-800">Admin payout safety reminder</h2>

        <p className="mt-2 text-sm leading-6 text-amber-700">
          Before approving or marking a payout as paid, confirm that the round is valid, the member
          is the correct payout receiver, and all required contributions have been verified. This
          helps protect TrustPoint Fund Space from fraud, mistakes, and disputes.
        </p>
      </div>
    </div>
  );
}