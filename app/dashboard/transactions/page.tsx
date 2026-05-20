'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  CreditCard,
  Loader2,
  RefreshCw,
  Search,
  TrendingDown,
  TrendingUp,
  Wallet,
  XCircle,
} from 'lucide-react';

import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Database } from '@/lib/database.types';

type TransactionRow = Database['public']['Tables']['transactions']['Row'];
type PaymentTransactionRow =
  Database['public']['Tables']['payment_transactions']['Row'];

type StatusGroup = 'SUCCESSFUL' | 'PENDING' | 'FAILED' | 'OTHER';
type Direction = 'CREDIT' | 'DEBIT' | 'INCOMING' | 'OUTGOING' | 'NEUTRAL';

type ConfirmedRecord = {
  id: string;
  amount: number;
  currency: string;
  type: string;
  status: string;
  direction: Direction;
  channel: string;
  reference: string;
  description: string;
  created_at: string | null;
};

type ProviderRecord = {
  id: string;
  amount: number;
  currency: string;
  type: string;
  status: string;
  direction: Direction;
  channel: string;
  provider: string;
  reference: string;
  internal_reference: string;
  description: string;
  created_at: string | null;
};

function formatCurrency(amount: number | string | null | undefined) {
  return `GH₵ ${Number(amount || 0).toLocaleString('en-GH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
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
  const safeValue = value || 'TRANSACTION';

  return safeValue
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getStatusGroup(status: string | null | undefined): StatusGroup {
  const value = String(status || 'PENDING').toUpperCase();

  if (['SUCCESS', 'COMPLETED', 'PAID', 'APPROVED', 'CONFIRMED'].includes(value)) {
    return 'SUCCESSFUL';
  }

  if (['PENDING', 'PROCESSING', 'PENDING_ADMIN_APPROVAL'].includes(value)) {
    return 'PENDING';
  }

  if (
    ['FAILED', 'REJECTED', 'CANCELLED', 'ABANDONED', 'REVERSED'].includes(value)
  ) {
    return 'FAILED';
  }

  return 'OTHER';
}

function getStatusStyle(status: string | null | undefined) {
  const group = getStatusGroup(status);

  if (group === 'SUCCESSFUL') {
    return 'bg-emerald-50 text-emerald-700 border-emerald-100';
  }

  if (group === 'PENDING') {
    return 'bg-amber-50 text-amber-700 border-amber-100';
  }

  if (group === 'FAILED') {
    return 'bg-red-50 text-red-700 border-red-100';
  }

  return 'bg-gray-50 text-gray-700 border-gray-100';
}

function normalizeDirection(value: string | null | undefined): Direction {
  const direction = String(value || '').toUpperCase();

  if (direction === 'CREDIT') return 'CREDIT';
  if (direction === 'DEBIT') return 'DEBIT';
  if (direction === 'INCOMING') return 'INCOMING';
  if (direction === 'OUTGOING') return 'OUTGOING';

  return 'NEUTRAL';
}

function getDirectionStyle(direction: Direction) {
  if (direction === 'CREDIT' || direction === 'INCOMING') {
    return 'text-emerald-700 bg-emerald-50 border-emerald-100';
  }

  if (direction === 'DEBIT' || direction === 'OUTGOING') {
    return 'text-red-700 bg-red-50 border-red-100';
  }

  return 'text-gray-700 bg-gray-50 border-gray-100';
}

function getDirectionIcon(direction: Direction) {
  if (direction === 'CREDIT' || direction === 'INCOMING') {
    return <TrendingUp size={15} />;
  }

  if (direction === 'DEBIT' || direction === 'OUTGOING') {
    return <TrendingDown size={15} />;
  }

  return <CreditCard size={15} />;
}

function mapConfirmedRecord(item: TransactionRow): ConfirmedRecord {
  return {
    id: item.id,
    amount: Number(item.amount || 0),
    currency: item.currency || 'GHS',
    type: item.type || 'TRANSACTION',
    status: item.status || 'PENDING',
    direction: normalizeDirection(item.direction),
    channel: item.channel || 'SYSTEM',
    reference: item.payment_reference || item.id.slice(0, 8),
    description: item.note || 'Confirmed TrustPoint system transaction',
    created_at: item.created_at,
  };
}

function getProviderDescription(item: PaymentTransactionRow) {
  if (item.payment_type === 'WALLET_DEPOSIT') {
    return 'Wallet deposit payment attempt from provider';
  }

  if (item.payment_type === 'FUND_SPACE_CONTRIBUTION') {
    return 'Fund Space contribution payment attempt from provider';
  }

  if (item.payment_type === 'AGENT_CUSTOMER_DEPOSIT') {
    return 'Agent-assisted wallet deposit payment attempt';
  }

  if (item.payment_type === 'AGENT_CUSTOMER_CONTRIBUTION') {
    return 'Agent-assisted contribution payment attempt';
  }

  if (item.payment_type === 'WITHDRAWAL_PAYOUT') {
    return 'Withdrawal payout provider record';
  }

  if (item.payment_type === 'FUND_SPACE_PAYOUT') {
    return 'Fund Space payout provider record';
  }

  return 'Payment provider record';
}

function mapProviderRecord(item: PaymentTransactionRow): ProviderRecord {
  return {
    id: item.id,
    amount: Number(item.amount || 0),
    currency: item.currency || 'GHS',
    type: item.payment_type || 'PAYMENT',
    status: item.status || 'PENDING',
    direction: normalizeDirection(item.direction),
    channel: item.channel || 'PAYMENT_GATEWAY',
    provider: item.provider || 'PAYMENT_PROVIDER',
    reference:
      item.provider_reference || item.internal_reference || item.id.slice(0, 8),
    internal_reference: item.internal_reference || item.id.slice(0, 8),
    description: getProviderDescription(item),
    created_at: item.created_at,
  };
}

function isConfirmedSuccessful(record: ConfirmedRecord) {
  return getStatusGroup(record.status) === 'SUCCESSFUL';
}

export default function UserTransactionsPage() {
  const { profile, loading } = useAuth();

  const [confirmedRecords, setConfirmedRecords] = useState<ConfirmedRecord[]>(
    []
  );
  const [providerRecords, setProviderRecords] = useState<ProviderRecord[]>([]);

  const [pageLoading, setPageLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const [confirmedSearch, setConfirmedSearch] = useState('');
  const [providerSearch, setProviderSearch] = useState('');

  const [confirmedTypeFilter, setConfirmedTypeFilter] = useState('ALL');
  const [providerTypeFilter, setProviderTypeFilter] = useState('ALL');

  const [confirmedStatusFilter, setConfirmedStatusFilter] = useState<
    'ALL' | StatusGroup
  >('ALL');
  const [providerStatusFilter, setProviderStatusFilter] = useState<
    'ALL' | StatusGroup
  >('ALL');

  const [confirmedDirectionFilter, setConfirmedDirectionFilter] = useState<
    'ALL' | Direction
  >('ALL');
  const [providerDirectionFilter, setProviderDirectionFilter] = useState<
    'ALL' | Direction
  >('ALL');

  const loadRecords = useCallback(
    async (userId: string, showRefreshState = false) => {
      try {
        if (showRefreshState) {
          setRefreshing(true);
        } else {
          setPageLoading(true);
        }

        setErrorMessage('');

        const [transactionResult, paymentResult] = await Promise.all([
          supabase
            .from('transactions')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false }),

          supabase
            .from('payment_transactions')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false }),
        ]);

        if (transactionResult.error) {
          throw new Error(
            transactionResult.error.message ||
              'Unable to load confirmed transactions.'
          );
        }

        if (paymentResult.error) {
          throw new Error(
            paymentResult.error.message || 'Unable to load payment attempts.'
          );
        }

        setConfirmedRecords(
          (transactionResult.data || []).map(mapConfirmedRecord)
        );

        setProviderRecords((paymentResult.data || []).map(mapProviderRecord));
      } catch (error) {
        console.error('User transactions load error:', error);

        const message =
          error instanceof Error
            ? error.message
            : 'Unable to load transactions.';

        setErrorMessage(message);
        setConfirmedRecords([]);
        setProviderRecords([]);
      } finally {
        setPageLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  useEffect(() => {
    if (loading) return;

    if (!profile?.id) {
      setPageLoading(false);
      setErrorMessage('Unable to identify your account. Please log in again.');
      return;
    }

    loadRecords(profile.id);
  }, [loading, profile?.id, loadRecords]);

  const confirmedStats = useMemo(() => {
    const successful = confirmedRecords.filter(isConfirmedSuccessful);

    const pending = confirmedRecords.filter(
      (item) => getStatusGroup(item.status) === 'PENDING'
    );

    const failed = confirmedRecords.filter(
      (item) => getStatusGroup(item.status) === 'FAILED'
    );

    const credits = confirmedRecords.filter((item) =>
      ['CREDIT', 'INCOMING'].includes(item.direction)
    );

    const debits = confirmedRecords.filter((item) =>
      ['DEBIT', 'OUTGOING'].includes(item.direction)
    );

    const successfulCredits = successful.filter((item) =>
      ['CREDIT', 'INCOMING'].includes(item.direction)
    );

    const successfulDebits = successful.filter((item) =>
      ['DEBIT', 'OUTGOING'].includes(item.direction)
    );

    return {
      total: confirmedRecords.length,
      successful: successful.length,
      pending: pending.length,
      failed: failed.length,
      successfulValue: successful.reduce(
        (sum, item) => sum + Number(item.amount || 0),
        0
      ),
      successfulCreditValue: successfulCredits.reduce(
        (sum, item) => sum + Number(item.amount || 0),
        0
      ),
      successfulDebitValue: successfulDebits.reduce(
        (sum, item) => sum + Number(item.amount || 0),
        0
      ),
      creditCount: credits.length,
      debitCount: debits.length,
    };
  }, [confirmedRecords]);

  const providerStats = useMemo(() => {
    const successful = providerRecords.filter(
      (item) => getStatusGroup(item.status) === 'SUCCESSFUL'
    );

    const pending = providerRecords.filter(
      (item) => getStatusGroup(item.status) === 'PENDING'
    );

    const failed = providerRecords.filter(
      (item) => getStatusGroup(item.status) === 'FAILED'
    );

    return {
      total: providerRecords.length,
      successful: successful.length,
      pending: pending.length,
      failed: failed.length,
    };
  }, [providerRecords]);

  const confirmedTypes = useMemo(() => {
    return Array.from(
      new Set(confirmedRecords.map((item) => item.type).filter(Boolean))
    ).sort();
  }, [confirmedRecords]);

  const providerTypes = useMemo(() => {
    return Array.from(
      new Set(providerRecords.map((item) => item.type).filter(Boolean))
    ).sort();
  }, [providerRecords]);

  const filteredConfirmedRecords = useMemo(() => {
    const searchValue = confirmedSearch.trim().toLowerCase();

    return confirmedRecords.filter((item) => {
      const statusGroup = getStatusGroup(item.status);

      const matchesSearch =
        !searchValue ||
        item.id.toLowerCase().includes(searchValue) ||
        item.type.toLowerCase().includes(searchValue) ||
        item.status.toLowerCase().includes(searchValue) ||
        String(item.amount).includes(confirmedSearch.trim()) ||
        item.reference.toLowerCase().includes(searchValue) ||
        item.description.toLowerCase().includes(searchValue);

      const matchesType =
        confirmedTypeFilter === 'ALL' || item.type === confirmedTypeFilter;

      const matchesStatus =
        confirmedStatusFilter === 'ALL' ||
        statusGroup === confirmedStatusFilter;

      const matchesDirection =
        confirmedDirectionFilter === 'ALL' ||
        item.direction === confirmedDirectionFilter;

      return matchesSearch && matchesType && matchesStatus && matchesDirection;
    });
  }, [
    confirmedRecords,
    confirmedSearch,
    confirmedTypeFilter,
    confirmedStatusFilter,
    confirmedDirectionFilter,
  ]);

  const filteredProviderRecords = useMemo(() => {
    const searchValue = providerSearch.trim().toLowerCase();

    return providerRecords.filter((item) => {
      const statusGroup = getStatusGroup(item.status);

      const matchesSearch =
        !searchValue ||
        item.id.toLowerCase().includes(searchValue) ||
        item.type.toLowerCase().includes(searchValue) ||
        item.status.toLowerCase().includes(searchValue) ||
        String(item.amount).includes(providerSearch.trim()) ||
        item.reference.toLowerCase().includes(searchValue) ||
        item.internal_reference.toLowerCase().includes(searchValue) ||
        item.provider.toLowerCase().includes(searchValue) ||
        item.description.toLowerCase().includes(searchValue);

      const matchesType =
        providerTypeFilter === 'ALL' || item.type === providerTypeFilter;

      const matchesStatus =
        providerStatusFilter === 'ALL' || statusGroup === providerStatusFilter;

      const matchesDirection =
        providerDirectionFilter === 'ALL' ||
        item.direction === providerDirectionFilter;

      return matchesSearch && matchesType && matchesStatus && matchesDirection;
    });
  }, [
    providerRecords,
    providerSearch,
    providerTypeFilter,
    providerStatusFilter,
    providerDirectionFilter,
  ]);

  if (loading || pageLoading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-4">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-emerald-600" />
          <p className="text-sm text-gray-500">Loading transactions...</p>
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
              My Financial Records
            </p>

            <h1 className="text-3xl font-black md:text-4xl">Transactions</h1>

            <p className="mt-4 max-w-3xl text-sm leading-7 text-emerald-50 md:text-base">
              Confirmed system transactions show money that has actually been
              processed by TrustPoint. Provider attempts show Paystack/payment
              gateway status only and are not added to your financial totals.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/dashboard/deposit"
                className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-emerald-700 hover:bg-emerald-50"
              >
                Deposit
                <ArrowRight size={16} />
              </Link>

              <Link
                href="/dashboard/withdrawals"
                className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-5 py-3 text-sm font-bold text-white ring-1 ring-white/20 hover:bg-white/20"
              >
                Withdrawals
                <ArrowRight size={16} />
              </Link>

              <Link
                href="/dashboard/fund-space"
                className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-5 py-3 text-sm font-bold text-white ring-1 ring-white/20 hover:bg-white/20"
              >
                Fund Space
                <ArrowRight size={16} />
              </Link>
            </div>
          </div>

          <button
            type="button"
            onClick={() => profile?.id && loadRecords(profile.id, true)}
            disabled={refreshing}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw
              size={16}
              className={refreshing ? 'animate-spin' : ''}
            />
            Refresh
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-700">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <section className="space-y-5">
        <div>
          <h2 className="text-xl font-black text-gray-900">
            Confirmed Money Movement
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            These figures are calculated from confirmed TrustPoint system
            transactions only. Provider attempts are excluded to prevent double
            counting.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <ValueCard
            title="Successful Confirmed Value"
            value={confirmedStats.successfulValue}
            variant="emerald"
            note="Only successful system transactions"
          />
          <ValueCard
            title="Confirmed Credits"
            value={confirmedStats.successfulCreditValue}
            variant="blue"
            note="Money added to your wallet/account"
          />
          <ValueCard
            title="Confirmed Debits"
            value={confirmedStats.successfulDebitValue}
            variant="red"
            note="Money paid out, withdrawn, or contributed"
          />
          <StatCard
            title="Confirmed Records"
            value={confirmedStats.total}
            icon={<Wallet size={24} />}
            color="emerald"
            note={`${confirmedStats.successful} successful, ${confirmedStats.pending} pending`}
          />
        </div>
      </section>

      <section className="space-y-5">
        <div>
          <h2 className="text-xl font-black text-gray-900">
            Payment Provider Attempts
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            These are Paystack/payment gateway attempts. They are displayed for
            tracking, but they are not added to the money totals above.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Provider Attempts"
            value={providerStats.total}
            icon={<CreditCard size={24} />}
            color="blue"
          />
          <StatCard
            title="Provider Successful"
            value={providerStats.successful}
            icon={<CheckCircle2 size={24} />}
            color="green"
          />
          <StatCard
            title="Provider Pending"
            value={providerStats.pending}
            icon={<Clock size={24} />}
            color="amber"
          />
          <StatCard
            title="Provider Failed"
            value={providerStats.failed}
            icon={<XCircle size={24} />}
            color="red"
          />
        </div>
      </section>

      <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-5 md:p-6">
        <h2 className="text-lg font-bold text-emerald-800">
          How to read this page
        </h2>

        <div className="mt-3 grid gap-3 text-sm leading-6 text-emerald-700 md:grid-cols-2">
          <p>
            <strong>Confirmed Money Movement</strong> is the real financial
            record. These values come from the TrustPoint `transactions` table
            after the system confirms payment, contribution, payout, or
            withdrawal.
          </p>

          <p>
            <strong>Payment Provider Attempts</strong> show Paystack/payment
            gateway attempts. A successful provider attempt may also create a
            confirmed system transaction, so it is not included in the money
            totals to avoid double counting.
          </p>
        </div>
      </div>

      <ConfirmedRecordsSection
        records={filteredConfirmedRecords}
        allRecordsCount={confirmedRecords.length}
        search={confirmedSearch}
        setSearch={setConfirmedSearch}
        typeFilter={confirmedTypeFilter}
        setTypeFilter={setConfirmedTypeFilter}
        statusFilter={confirmedStatusFilter}
        setStatusFilter={setConfirmedStatusFilter}
        directionFilter={confirmedDirectionFilter}
        setDirectionFilter={setConfirmedDirectionFilter}
        types={confirmedTypes}
        clearFilters={() => {
          setConfirmedSearch('');
          setConfirmedTypeFilter('ALL');
          setConfirmedStatusFilter('ALL');
          setConfirmedDirectionFilter('ALL');
        }}
      />

      <ProviderRecordsSection
        records={filteredProviderRecords}
        allRecordsCount={providerRecords.length}
        search={providerSearch}
        setSearch={setProviderSearch}
        typeFilter={providerTypeFilter}
        setTypeFilter={setProviderTypeFilter}
        statusFilter={providerStatusFilter}
        setStatusFilter={setProviderStatusFilter}
        directionFilter={providerDirectionFilter}
        setDirectionFilter={setProviderDirectionFilter}
        types={providerTypes}
        clearFilters={() => {
          setProviderSearch('');
          setProviderTypeFilter('ALL');
          setProviderStatusFilter('ALL');
          setProviderDirectionFilter('ALL');
        }}
      />
    </div>
  );
}

function ConfirmedRecordsSection({
  records,
  allRecordsCount,
  search,
  setSearch,
  typeFilter,
  setTypeFilter,
  statusFilter,
  setStatusFilter,
  directionFilter,
  setDirectionFilter,
  types,
  clearFilters,
}: {
  records: ConfirmedRecord[];
  allRecordsCount: number;
  search: string;
  setSearch: (value: string) => void;
  typeFilter: string;
  setTypeFilter: (value: string) => void;
  statusFilter: 'ALL' | StatusGroup;
  setStatusFilter: (value: 'ALL' | StatusGroup) => void;
  directionFilter: 'ALL' | Direction;
  setDirectionFilter: (value: 'ALL' | Direction) => void;
  types: string[];
  clearFilters: () => void;
}) {
  return (
    <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm md:p-6">
      <RecordsHeader
        title="Confirmed System Transactions"
        description="Real TrustPoint records after payment/contribution/payout/withdrawal is confirmed."
        search={search}
        setSearch={setSearch}
        typeFilter={typeFilter}
        setTypeFilter={setTypeFilter}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        directionFilter={directionFilter}
        setDirectionFilter={setDirectionFilter}
        types={types}
      />

      <div className="mt-6 space-y-4 lg:hidden">
        {records.length === 0 ? (
          <EmptyState message="No confirmed system transactions found." />
        ) : (
          records.map((item) => (
            <ConfirmedRecordCard key={item.id} item={item} />
          ))
        )}
      </div>

      <div className="mt-6 hidden overflow-hidden rounded-2xl border border-gray-100 lg:block">
        {records.length === 0 ? (
          <EmptyState message="No confirmed system transactions found." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-left">
              <thead className="bg-gray-50">
                <tr>
                  <TableHead>Type</TableHead>
                  <TableHead>Direction</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Channel</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Date</TableHead>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100 bg-white">
                {records.map((item) => (
                  <ConfirmedRecordRow key={item.id} item={item} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <RecordFooter
        shown={records.length}
        total={allRecordsCount}
        clearFilters={clearFilters}
      />
    </section>
  );
}

function ProviderRecordsSection({
  records,
  allRecordsCount,
  search,
  setSearch,
  typeFilter,
  setTypeFilter,
  statusFilter,
  setStatusFilter,
  directionFilter,
  setDirectionFilter,
  types,
  clearFilters,
}: {
  records: ProviderRecord[];
  allRecordsCount: number;
  search: string;
  setSearch: (value: string) => void;
  typeFilter: string;
  setTypeFilter: (value: string) => void;
  statusFilter: 'ALL' | StatusGroup;
  setStatusFilter: (value: 'ALL' | StatusGroup) => void;
  directionFilter: 'ALL' | Direction;
  setDirectionFilter: (value: 'ALL' | Direction) => void;
  types: string[];
  clearFilters: () => void;
}) {
  return (
    <section className="rounded-3xl border border-blue-100 bg-white p-5 shadow-sm md:p-6">
      <RecordsHeader
        title="Payment Provider Attempts"
        description="Paystack/payment gateway attempts for tracking only. These are not counted as extra financial value."
        search={search}
        setSearch={setSearch}
        typeFilter={typeFilter}
        setTypeFilter={setTypeFilter}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        directionFilter={directionFilter}
        setDirectionFilter={setDirectionFilter}
        types={types}
      />

      <div className="mt-6 space-y-4 lg:hidden">
        {records.length === 0 ? (
          <EmptyState message="No payment provider attempts found." />
        ) : (
          records.map((item) => (
            <ProviderRecordCard key={item.id} item={item} />
          ))
        )}
      </div>

      <div className="mt-6 hidden overflow-hidden rounded-2xl border border-gray-100 lg:block">
        {records.length === 0 ? (
          <EmptyState message="No payment provider attempts found." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1120px] text-left">
              <thead className="bg-gray-50">
                <tr>
                  <TableHead>Payment Type</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Direction</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Provider Reference</TableHead>
                  <TableHead>Internal Reference</TableHead>
                  <TableHead>Date</TableHead>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100 bg-white">
                {records.map((item) => (
                  <ProviderRecordRow key={item.id} item={item} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <RecordFooter
        shown={records.length}
        total={allRecordsCount}
        clearFilters={clearFilters}
      />
    </section>
  );
}

function RecordsHeader({
  title,
  description,
  search,
  setSearch,
  typeFilter,
  setTypeFilter,
  statusFilter,
  setStatusFilter,
  directionFilter,
  setDirectionFilter,
  types,
}: {
  title: string;
  description: string;
  search: string;
  setSearch: (value: string) => void;
  typeFilter: string;
  setTypeFilter: (value: string) => void;
  statusFilter: 'ALL' | StatusGroup;
  setStatusFilter: (value: 'ALL' | StatusGroup) => void;
  directionFilter: 'ALL' | Direction;
  setDirectionFilter: (value: 'ALL' | Direction) => void;
  types: string[];
}) {
  return (
    <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
      <div>
        <h2 className="text-xl font-black text-gray-900">{title}</h2>
        <p className="mt-1 text-sm text-gray-500">{description}</p>
      </div>

      <div className="grid gap-3 md:grid-cols-4 xl:min-w-[860px]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />

          <input
            type="text"
            placeholder="Search reference, amount..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="min-h-12 w-full rounded-xl border border-gray-200 py-3 pl-10 pr-4 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          />
        </div>

        <select
          value={typeFilter}
          onChange={(event) => setTypeFilter(event.target.value)}
          className="min-h-12 rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
        >
          <option value="ALL">All Types</option>
          {types.map((type) => (
            <option key={type} value={type}>
              {formatLabel(type)}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(event) =>
            setStatusFilter(event.target.value as 'ALL' | StatusGroup)
          }
          className="min-h-12 rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
        >
          <option value="ALL">All Statuses</option>
          <option value="SUCCESSFUL">Successful</option>
          <option value="PENDING">Pending</option>
          <option value="FAILED">Failed / Rejected</option>
          <option value="OTHER">Other</option>
        </select>

        <select
          value={directionFilter}
          onChange={(event) =>
            setDirectionFilter(event.target.value as 'ALL' | Direction)
          }
          className="min-h-12 rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
        >
          <option value="ALL">All Directions</option>
          <option value="CREDIT">Credits</option>
          <option value="DEBIT">Debits</option>
          <option value="INCOMING">Incoming</option>
          <option value="OUTGOING">Outgoing</option>
          <option value="NEUTRAL">Neutral</option>
        </select>
      </div>
    </div>
  );
}

function ConfirmedRecordCard({ item }: { item: ConfirmedRecord }) {
  return (
    <div className="rounded-3xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-gray-500">{formatLabel(item.type)}</p>
          <p className="text-2xl font-black text-gray-900">
            {formatCurrency(item.amount)}
          </p>
        </div>

        <StatusBadge status={item.status} />
      </div>

      <div className="mt-3">
        <DirectionBadge direction={item.direction} />
      </div>

      <div className="mt-4 rounded-2xl bg-gray-50 p-4 text-sm">
        <p className="font-semibold text-gray-900">{item.description}</p>
        <p className="mt-1 break-all text-xs text-gray-500">
          Reference: {item.reference}
        </p>
        <p className="mt-1 text-xs text-gray-500">Channel: {item.channel}</p>
        <p className="mt-1 text-xs text-gray-500">
          Date: {formatDateTime(item.created_at)}
        </p>
      </div>
    </div>
  );
}

function ProviderRecordCard({ item }: { item: ProviderRecord }) {
  return (
    <div className="rounded-3xl border border-blue-100 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-gray-500">{formatLabel(item.type)}</p>
          <p className="text-2xl font-black text-gray-900">
            {formatCurrency(item.amount)}
          </p>
        </div>

        <StatusBadge status={item.status} />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <DirectionBadge direction={item.direction} />
        <ProviderBadge provider={item.provider} />
      </div>

      <div className="mt-4 rounded-2xl bg-blue-50 p-4 text-sm">
        <p className="font-semibold text-blue-900">{item.description}</p>
        <p className="mt-1 break-all text-xs text-blue-700">
          Provider Ref: {item.reference}
        </p>
        <p className="mt-1 break-all text-xs text-blue-700">
          Internal Ref: {item.internal_reference}
        </p>
        <p className="mt-1 text-xs text-blue-700">
          Date: {formatDateTime(item.created_at)}
        </p>
      </div>
    </div>
  );
}

function ConfirmedRecordRow({ item }: { item: ConfirmedRecord }) {
  return (
    <tr className="hover:bg-gray-50">
      <td className="px-5 py-5">
        <p className="font-bold text-gray-900">{formatLabel(item.type)}</p>
      </td>

      <td className="px-5 py-5">
        <DirectionBadge direction={item.direction} />
      </td>

      <td className="px-5 py-5">
        <p className="font-black text-gray-900">
          {formatCurrency(item.amount)}
        </p>
      </td>

      <td className="px-5 py-5">
        <StatusBadge status={item.status} />
      </td>

      <td className="max-w-[200px] break-all px-5 py-5 text-sm text-gray-700">
        {item.reference}
      </td>

      <td className="px-5 py-5 text-sm text-gray-700">{item.channel}</td>

      <td className="px-5 py-5 text-sm text-gray-700">
        {item.description}
      </td>

      <td className="px-5 py-5 text-sm text-gray-700">
        {formatDateTime(item.created_at)}
      </td>
    </tr>
  );
}

function ProviderRecordRow({ item }: { item: ProviderRecord }) {
  return (
    <tr className="hover:bg-blue-50/40">
      <td className="px-5 py-5">
        <p className="font-bold text-gray-900">{formatLabel(item.type)}</p>
        <p className="mt-1 text-xs text-gray-500">{item.description}</p>
      </td>

      <td className="px-5 py-5">
        <ProviderBadge provider={item.provider} />
      </td>

      <td className="px-5 py-5">
        <DirectionBadge direction={item.direction} />
      </td>

      <td className="px-5 py-5">
        <p className="font-black text-gray-900">
          {formatCurrency(item.amount)}
        </p>
      </td>

      <td className="px-5 py-5">
        <StatusBadge status={item.status} />
      </td>

      <td className="max-w-[220px] break-all px-5 py-5 text-sm text-gray-700">
        {item.reference}
      </td>

      <td className="max-w-[220px] break-all px-5 py-5 text-sm text-gray-700">
        {item.internal_reference}
      </td>

      <td className="px-5 py-5 text-sm text-gray-700">
        {formatDateTime(item.created_at)}
      </td>
    </tr>
  );
}

function StatusBadge({ status }: { status: string | null | undefined }) {
  const group = getStatusGroup(status);

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-bold ${getStatusStyle(
        status
      )}`}
    >
      {group === 'SUCCESSFUL' && <CheckCircle2 size={13} />}
      {group === 'PENDING' && <Clock size={13} />}
      {group === 'FAILED' && <XCircle size={13} />}
      {formatLabel(status)}
    </span>
  );
}

function DirectionBadge({ direction }: { direction: Direction }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-bold ${getDirectionStyle(
        direction
      )}`}
    >
      {getDirectionIcon(direction)}
      {formatLabel(direction)}
    </span>
  );
}

function ProviderBadge({ provider }: { provider: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
      <CreditCard size={13} />
      {formatLabel(provider)}
    </span>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="p-10 text-center">
      <Wallet className="mx-auto mb-4 h-10 w-10 text-gray-300" />
      <h3 className="text-lg font-bold text-gray-900">No records found</h3>
      <p className="mt-2 text-sm text-gray-500">{message}</p>
    </div>
  );
}

function RecordFooter({
  shown,
  total,
  clearFilters,
}: {
  shown: number;
  total: number;
  clearFilters: () => void;
}) {
  return (
    <div className="mt-5 flex flex-col justify-between gap-3 text-sm text-gray-500 sm:flex-row sm:items-center">
      <p>
        Showing {shown} of {total} records
      </p>

      <button
        type="button"
        onClick={clearFilters}
        className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50"
      >
        Clear Filters
      </button>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
  color,
  note,
}: {
  title: string;
  value: number;
  icon: ReactNode;
  color: 'emerald' | 'green' | 'amber' | 'red' | 'blue';
  note?: string;
}) {
  const classes = {
    emerald: 'bg-emerald-50 text-emerald-700',
    green: 'bg-green-50 text-green-700',
    amber: 'bg-amber-50 text-amber-700',
    red: 'bg-red-50 text-red-700',
    blue: 'bg-blue-50 text-blue-700',
  };

  return (
    <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm md:p-6">
      <div className={`mb-4 inline-flex rounded-2xl p-3 ${classes[color]}`}>
        {icon}
      </div>
      <p className="text-sm text-gray-500">{title}</p>
      <h3 className="mt-1 text-3xl font-black text-gray-900">{value}</h3>
      {note && <p className="mt-2 text-xs text-gray-500">{note}</p>}
    </div>
  );
}

function ValueCard({
  title,
  value,
  variant = 'default',
  note,
}: {
  title: string;
  value: number;
  variant?: 'default' | 'emerald' | 'blue' | 'red';
  note?: string;
}) {
  const classes = {
    default: 'border-gray-100 bg-white text-gray-900',
    emerald: 'border-emerald-100 bg-emerald-50 text-emerald-800',
    blue: 'border-blue-100 bg-blue-50 text-blue-800',
    red: 'border-red-100 bg-red-50 text-red-800',
  };

  return (
    <div
      className={`rounded-3xl border p-5 shadow-sm md:p-6 ${classes[variant]}`}
    >
      <p className="text-sm opacity-80">{title}</p>
      <h3 className="mt-2 text-2xl font-black md:text-3xl">
        {formatCurrency(value)}
      </h3>
      {note && <p className="mt-2 text-xs opacity-80">{note}</p>}
    </div>
  );
}

function TableHead({ children }: { children: ReactNode }) {
  return (
    <th className="px-5 py-4 text-xs font-black uppercase tracking-wide text-gray-500">
      {children}
    </th>
  );
}