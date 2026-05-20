'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Loader2,
  RefreshCw,
  Wallet,
  XCircle,
} from 'lucide-react';

import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

type WalletAccount = {
  id: string;
  user_id: string;
  balance: number | null;
  currency: string | null;
};

type WithdrawalRequest = {
  id: string;
  user_id: string;
  amount: number;
  status: string;
  withdrawal_method?: string | null;
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

  if (['APPROVED', 'PAID', 'COMPLETED'].includes(value)) {
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

export default function UserWithdrawalsPage() {
  const { profile, loading } = useAuth();

  const [wallet, setWallet] = useState<WalletAccount | null>(null);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (loading) return;

    if (!profile?.id) {
      setPageLoading(false);
      setErrorMessage('Unable to identify your account. Please log in again.');
      return;
    }

    loadPage(profile.id);
  }, [loading, profile?.id]);

  const loadPage = async (userId: string) => {
    try {
      setPageLoading(true);
      setErrorMessage('');

      await Promise.all([
        loadWallet(userId),
        loadWithdrawals(userId),
      ]);
    } catch (error: unknown) {
      console.error('Withdrawals page load error:', error);

      const message =
        error instanceof Error
          ? error.message
          : 'Unable to load withdrawal information.';

      setErrorMessage(message);
    } finally {
      setPageLoading(false);
    }
  };

  const loadWallet = async (userId: string) => {
    const { data, error } = await supabase
      .from('wallet_accounts')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.warn('Wallet load warning:', error.message);
      setWallet(null);
      return;
    }

    setWallet(data as WalletAccount | null);
  };

  const loadWithdrawals = async (userId: string) => {
    const { data, error } = await supabase
      .from('withdrawal_requests')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Withdrawals load warning:', error.message);
      setWithdrawals([]);
      return;
    }

    setWithdrawals((data || []) as WithdrawalRequest[]);
  };

  const stats = useMemo(() => {
    const pending = withdrawals.filter((item) =>
      ['PENDING', 'PENDING_ADMIN_APPROVAL'].includes(item.status)
    );

    const approved = withdrawals.filter((item) => item.status === 'APPROVED');
    const paid = withdrawals.filter((item) => item.status === 'PAID');
    const rejected = withdrawals.filter((item) => item.status === 'REJECTED');

    const pendingAmount = pending.reduce(
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
      pendingAmount,
      paidAmount,
    };
  }, [withdrawals]);

  const walletBalance = wallet?.balance ?? 0;
  const walletCurrency = wallet?.currency ?? 'GHS';

  if (loading || pageLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-emerald-600" />
          <p className="text-sm text-gray-500">Loading withdrawals...</p>
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
              My Wallet
            </p>

            <h1 className="text-3xl font-bold md:text-4xl">
              Withdrawals
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-7 text-emerald-50 md:text-base">
              View your wallet balance, request withdrawals, and track your withdrawal status.
            </p>
          </div>

          <div className="rounded-2xl bg-white/15 p-5 backdrop-blur md:min-w-[240px]">
            <p className="text-sm text-emerald-50">Available Balance</p>
            <p className="mt-1 text-3xl font-black">
              {walletCurrency === 'GHS' ? 'GH₵' : walletCurrency}
              {Number(walletBalance).toLocaleString()}
            </p>
            <p className="mt-1 text-xs text-emerald-50">
              Withdrawals are reviewed by admin.
            </p>
          </div>
        </div>
      </div>

      {errorMessage && (
        <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="mb-4 inline-flex rounded-2xl bg-emerald-50 p-3 text-emerald-700">
            <Wallet size={24} />
          </div>
          <p className="text-sm text-gray-500">Wallet Balance</p>
          <h3 className="mt-1 text-3xl font-black text-gray-900">
            {formatCurrency(walletBalance)}
          </h3>
        </div>

        <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="mb-4 inline-flex rounded-2xl bg-amber-50 p-3 text-amber-700">
            <Clock size={24} />
          </div>
          <p className="text-sm text-gray-500">Pending Requests</p>
          <h3 className="mt-1 text-3xl font-black text-gray-900">
            {stats.pending}
          </h3>
        </div>

        <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="mb-4 inline-flex rounded-2xl bg-emerald-50 p-3 text-emerald-700">
            <CheckCircle2 size={24} />
          </div>
          <p className="text-sm text-gray-500">Paid Withdrawals</p>
          <h3 className="mt-1 text-3xl font-black text-gray-900">
            {stats.paid}
          </h3>
        </div>

        <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="mb-4 inline-flex rounded-2xl bg-red-50 p-3 text-red-700">
            <XCircle size={24} />
          </div>
          <p className="text-sm text-gray-500">Rejected</p>
          <h3 className="mt-1 text-3xl font-black text-gray-900">
            {stats.rejected}
          </h3>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div className="rounded-3xl border border-amber-100 bg-amber-50 p-6 shadow-sm">
          <p className="text-sm text-amber-700">Pending Withdrawal Value</p>
          <h3 className="mt-2 text-3xl font-black text-amber-800">
            {formatCurrency(stats.pendingAmount)}
          </h3>
        </div>

        <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-6 shadow-sm">
          <p className="text-sm text-emerald-700">Total Paid Withdrawals</p>
          <h3 className="mt-2 text-3xl font-black text-emerald-800">
            {formatCurrency(stats.paidAmount)}
          </h3>
        </div>
      </div>

      <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              Withdrawal History
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Track all your withdrawal requests and their approval status.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => profile?.id && loadPage(profile.id)}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-5 py-3 text-sm font-bold text-gray-700 hover:bg-gray-50"
            >
              <RefreshCw size={16} />
              Refresh
            </button>

            <Link
              href="/dashboard/withdrawals/request"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-700"
            >
              Request Withdrawal
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border border-gray-100">
          {withdrawals.length === 0 ? (
            <div className="p-10 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gray-50 text-gray-400">
                <Wallet size={28} />
              </div>

              <h3 className="text-lg font-bold text-gray-900">
                No withdrawal request yet
              </h3>

              <p className="mt-2 text-sm text-gray-500">
                When you request a withdrawal, it will appear here.
              </p>

              <Link
                href="/dashboard/withdrawals/request"
                className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-700"
              >
                Request Withdrawal
                <ArrowRight size={16} />
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-5 py-4 text-xs font-bold uppercase tracking-wide text-gray-500">
                      Amount
                    </th>
                    <th className="px-5 py-4 text-xs font-bold uppercase tracking-wide text-gray-500">
                      Method
                    </th>
                    <th className="px-5 py-4 text-xs font-bold uppercase tracking-wide text-gray-500">
                      Details
                    </th>
                    <th className="px-5 py-4 text-xs font-bold uppercase tracking-wide text-gray-500">
                      Status
                    </th>
                    <th className="px-5 py-4 text-xs font-bold uppercase tracking-wide text-gray-500">
                      Requested
                    </th>
                    <th className="px-5 py-4 text-xs font-bold uppercase tracking-wide text-gray-500">
                      Paid
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100 bg-white">
                  {withdrawals.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-5 py-5">
                        <p className="font-black text-gray-900">
                          {formatCurrency(item.amount)}
                        </p>
                      </td>

                      <td className="px-5 py-5">
                        <p className="font-semibold text-gray-900">
                          {item.withdrawal_method || 'Not specified'}
                        </p>
                      </td>

                      <td className="px-5 py-5">
                        {item.withdrawal_method === 'BANK' ? (
                          <div className="text-sm text-gray-700">
                            <p>{item.bank_name || 'No bank name'}</p>
                            <p className="text-xs text-gray-500">
                              {item.bank_account_number || 'No account number'}
                            </p>
                            <p className="text-xs text-gray-500">
                              {item.bank_account_name || 'No account name'}
                            </p>
                          </div>
                        ) : (
                          <p className="text-sm text-gray-700">
                            MoMo: {item.momo_number || 'Not provided'}
                          </p>
                        )}

                        {(item.rejection_reason || item.admin_note) && (
                          <p className="mt-2 text-xs text-red-600">
                            {item.rejection_reason || item.admin_note}
                          </p>
                        )}
                      </td>

                      <td className="px-5 py-5">
                        <span
                          className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${getStatusStyle(
                            item.status
                          )}`}
                        >
                          {item.status}
                        </span>
                      </td>

                      <td className="px-5 py-5 text-sm text-gray-700">
                        {formatDate(item.created_at)}
                      </td>

                      <td className="px-5 py-5 text-sm text-gray-700">
                        {formatDate(item.paid_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-3xl border border-amber-100 bg-amber-50 p-6">
        <h2 className="text-lg font-bold text-amber-800">
          Withdrawal reminder
        </h2>

        <p className="mt-2 text-sm leading-6 text-amber-700">
          Withdrawals are reviewed by admin before payment. Make sure your MoMo or bank details are
          correct before submitting a request.
        </p>
      </div>
    </div>
  );
}