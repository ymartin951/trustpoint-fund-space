'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  CreditCard,
  Loader2,
  RefreshCw,
  Search,
  TrendingDown,
  TrendingUp,
  User,
  Wallet,
  XCircle,
} from 'lucide-react';

import { supabase } from '@/lib/supabase/client';
import type { Database } from '@/lib/database.types';

type ProfileRow = Database['public']['Tables']['profiles']['Row'];
type TransactionRow = Database['public']['Tables']['transactions']['Row'];
type PaymentTransactionRow =
  Database['public']['Tables']['payment_transactions']['Row'];

type AdminProfile = {
  id: string;
  role: 'ADMIN' | 'SUPER_ADMIN';
  status: string | null;
};

type ProfileSummary = Pick<
  ProfileRow,
  | 'id'
  | 'full_name'
  | 'phone'
  | 'email'
  | 'role'
  | 'trust_score'
  | 'verification_status'
  | 'status'
>;

type StatusGroup = 'SUCCESSFUL' | 'PENDING' | 'FAILED' | 'OTHER';
type Direction = 'CREDIT' | 'DEBIT' | 'INCOMING' | 'OUTGOING' | 'NEUTRAL';
type StatusFilter = 'ALL' | StatusGroup;
type DirectionFilter = 'ALL' | Direction;

type ConfirmedRecord = {
  id: string;
  user_id: string;
  amount: number;
  currency: string;
  type: string;
  status: string;
  direction: Direction;
  channel: string;
  reference: string;
  description: string;
  created_at: string | null;
  profile: ProfileSummary | null;
};

type ProviderRecord = {
  id: string;
  user_id: string | null;
  customer_id: string | null;
  amount: number;
  currency: string;
  payment_type: string;
  status: string;
  direction: Direction;
  provider: string;
  channel: string;
  internal_reference: string;
  provider_reference: string;
  checkout_url: string | null;
  contribution_id: string | null;
  fund_space_id: string | null;
  fund_space_round_id: string | null;
  withdrawal_request_id: string | null;
  provider_status: string | null;
  failure_reason: string | null;
  verified_at: string | null;
  processed_at: string | null;
  created_at: string | null;
  profile: ProfileSummary | null;
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
  if (!value) return 'Not specified';

  return value
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
    return 'border-emerald-100 bg-emerald-50 text-emerald-700';
  }

  if (direction === 'DEBIT' || direction === 'OUTGOING') {
    return 'border-red-100 bg-red-50 text-red-700';
  }

  return 'border-gray-100 bg-gray-50 text-gray-700';
}

function getDirectionIcon(direction: Direction) {
  if (direction === 'CREDIT' || direction === 'INCOMING') {
    return <TrendingUp size={14} />;
  }

  if (direction === 'DEBIT' || direction === 'OUTGOING') {
    return <TrendingDown size={14} />;
  }

  return <CreditCard size={14} />;
}

function getTrustScoreStyle(score: number | null | undefined) {
  const value = Number(score || 0);

  if (value >= 80) {
    return 'bg-emerald-50 text-emerald-700';
  }

  if (value >= 50) {
    return 'bg-amber-50 text-amber-700';
  }

  return 'bg-red-50 text-red-700';
}

function getConfirmedReference(item: TransactionRow) {
  return (
    item.payment_reference ||
    item.contribution_id ||
    item.withdrawal_request_id ||
    item.id.slice(0, 8)
  );
}

function getConfirmedDescription(item: TransactionRow) {
  return item.note || 'Confirmed TrustPoint system transaction';
}

function getProviderDescription(item: PaymentTransactionRow) {
  if (item.payment_type === 'WALLET_DEPOSIT') {
    return 'Wallet deposit attempt through payment provider';
  }

  if (item.payment_type === 'FUND_SPACE_CONTRIBUTION') {
    return 'Fund Space contribution payment attempt';
  }

  if (item.payment_type === 'AGENT_CUSTOMER_DEPOSIT') {
    return 'Agent-assisted customer deposit attempt';
  }

  if (item.payment_type === 'AGENT_CUSTOMER_CONTRIBUTION') {
    return 'Agent-assisted customer contribution attempt';
  }

  if (item.payment_type === 'WITHDRAWAL_PAYOUT') {
    return 'Withdrawal payout provider record';
  }

  if (item.payment_type === 'FUND_SPACE_PAYOUT') {
    return 'Fund Space payout provider record';
  }

  return 'Payment provider record';
}

function buildProfileMap(profiles: ProfileSummary[]) {
  return new Map(profiles.map((profile) => [profile.id, profile]));
}

function mapConfirmedRecord(
  item: TransactionRow,
  profileMap: Map<string, ProfileSummary>
): ConfirmedRecord {
  return {
    id: item.id,
    user_id: item.user_id,
    amount: Number(item.amount || 0),
    currency: item.currency || 'GHS',
    type: item.type || 'TRANSACTION',
    status: item.status || 'PENDING',
    direction: normalizeDirection(item.direction),
    channel: item.channel || 'SYSTEM',
    reference: getConfirmedReference(item),
    description: getConfirmedDescription(item),
    created_at: item.created_at,
    profile: profileMap.get(item.user_id) || null,
  };
}

function mapProviderRecord(
  item: PaymentTransactionRow,
  profileMap: Map<string, ProfileSummary>
): ProviderRecord {
  const profileId = item.user_id || item.customer_id || '';

  return {
    id: item.id,
    user_id: item.user_id,
    customer_id: item.customer_id,
    amount: Number(item.amount || 0),
    currency: item.currency || 'GHS',
    payment_type: item.payment_type || 'PAYMENT',
    status: item.status || 'PENDING',
    direction: normalizeDirection(item.direction),
    provider: item.provider || 'PAYMENT_PROVIDER',
    channel: item.channel || 'PAYMENT_GATEWAY',
    internal_reference: item.internal_reference || item.id.slice(0, 8),
    provider_reference:
      item.provider_reference || item.internal_reference || item.id.slice(0, 8),
    checkout_url: item.checkout_url,
    contribution_id: item.contribution_id,
    fund_space_id: item.fund_space_id,
    fund_space_round_id: item.fund_space_round_id,
    withdrawal_request_id: item.withdrawal_request_id,
    provider_status: item.provider_status,
    failure_reason: item.failure_reason,
    verified_at: item.verified_at,
    processed_at: item.processed_at,
    created_at: item.created_at,
    profile: profileMap.get(profileId) || null,
  };
}

function isSuccessfulStatus(status: string) {
  return getStatusGroup(status) === 'SUCCESSFUL';
}

function isCreditDirection(direction: Direction) {
  return direction === 'CREDIT' || direction === 'INCOMING';
}

function isDebitDirection(direction: Direction) {
  return direction === 'DEBIT' || direction === 'OUTGOING';
}

export default function AdminTransactionsPage() {
  const [adminProfile, setAdminProfile] = useState<AdminProfile | null>(null);

  const [confirmedRecords, setConfirmedRecords] = useState<ConfirmedRecord[]>(
    []
  );
  const [providerRecords, setProviderRecords] = useState<ProviderRecord[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [errorMessage, setErrorMessage] = useState('');

  const [confirmedSearch, setConfirmedSearch] = useState('');
  const [providerSearch, setProviderSearch] = useState('');

  const [confirmedTypeFilter, setConfirmedTypeFilter] = useState('ALL');
  const [providerTypeFilter, setProviderTypeFilter] = useState('ALL');

  const [confirmedStatusFilter, setConfirmedStatusFilter] =
    useState<StatusFilter>('ALL');
  const [providerStatusFilter, setProviderStatusFilter] =
    useState<StatusFilter>('ALL');

  const [confirmedDirectionFilter, setConfirmedDirectionFilter] =
    useState<DirectionFilter>('ALL');
  const [providerDirectionFilter, setProviderDirectionFilter] =
    useState<DirectionFilter>('ALL');

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
      throw new Error('You do not have permission to view platform transactions.');
    }

    const admin: AdminProfile = {
      id: profile.id,
      role: profile.role,
      status: profile.status,
    };

    setAdminProfile(admin);
    return admin;
  }

  const loadRecords = useCallback(async (showRefreshState = false) => {
    try {
      if (showRefreshState) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setErrorMessage('');

      await checkAdminAccess();

      const [transactionResult, paymentResult] = await Promise.all([
        supabase
          .from('transactions')
          .select('*')
          .order('created_at', { ascending: false }),

        supabase
          .from('payment_transactions')
          .select('*')
          .order('created_at', { ascending: false }),
      ]);

      if (transactionResult.error) {
        throw new Error(
          transactionResult.error.message ||
            'Unable to load confirmed system transactions.'
        );
      }

      if (paymentResult.error) {
        throw new Error(
          paymentResult.error.message ||
            'Unable to load payment provider attempts.'
        );
      }

      const transactions = transactionResult.data || [];
      const paymentTransactions = paymentResult.data || [];

      const userIds = Array.from(
        new Set(
          [
            ...transactions.map((item) => item.user_id),
            ...paymentTransactions.map((item) => item.user_id),
            ...paymentTransactions.map((item) => item.customer_id),
          ].filter((value): value is string => Boolean(value))
        )
      );

      let profiles: ProfileSummary[] = [];

      if (userIds.length > 0) {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select(
            'id, full_name, phone, email, role, trust_score, verification_status, status'
          )
          .in('id', userIds);

        if (profileError) {
          console.warn('Admin transaction profiles warning:', profileError.message);
        } else {
          profiles = (profileData || []) as ProfileSummary[];
        }
      }

      const profileMap = buildProfileMap(profiles);

      const confirmed = transactions.map((item) =>
        mapConfirmedRecord(item, profileMap)
      );

      const providers = paymentTransactions.map((item) =>
        mapProviderRecord(item, profileMap)
      );

      setConfirmedRecords(confirmed);
      setProviderRecords(providers);
    } catch (error) {
      console.error('Admin transactions load error:', error);

      const message =
        error instanceof Error
          ? error.message
          : 'Unable to load transactions.';

      setErrorMessage(message);
      setConfirmedRecords([]);
      setProviderRecords([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  const confirmedStats = useMemo(() => {
    const successful = confirmedRecords.filter((item) =>
      isSuccessfulStatus(item.status)
    );

    const pending = confirmedRecords.filter(
      (item) => getStatusGroup(item.status) === 'PENDING'
    );

    const failed = confirmedRecords.filter(
      (item) => getStatusGroup(item.status) === 'FAILED'
    );

    const successfulCredits = successful.filter((item) =>
      isCreditDirection(item.direction)
    );

    const successfulDebits = successful.filter((item) =>
      isDebitDirection(item.direction)
    );

    const successfulValue = successful.reduce(
      (sum, item) => sum + Number(item.amount || 0),
      0
    );

    const successfulCreditValue = successfulCredits.reduce(
      (sum, item) => sum + Number(item.amount || 0),
      0
    );

    const successfulDebitValue = successfulDebits.reduce(
      (sum, item) => sum + Number(item.amount || 0),
      0
    );

    const netSuccessfulValue = successfulCreditValue - successfulDebitValue;

    return {
      total: confirmedRecords.length,
      successful: successful.length,
      pending: pending.length,
      failed: failed.length,
      successfulValue,
      successfulCreditValue,
      successfulDebitValue,
      netSuccessfulValue,
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
      new Set(providerRecords.map((item) => item.payment_type).filter(Boolean))
    ).sort();
  }, [providerRecords]);

  const filteredConfirmedRecords = useMemo(() => {
    const searchValue = confirmedSearch.trim().toLowerCase();

    return confirmedRecords.filter((item) => {
      const profileName = item.profile?.full_name || '';
      const phone = item.profile?.phone || '';
      const email = item.profile?.email || '';
      const role = item.profile?.role || '';
      const statusGroup = getStatusGroup(item.status);

      const matchesSearch =
        !searchValue ||
        item.id.toLowerCase().includes(searchValue) ||
        item.user_id.toLowerCase().includes(searchValue) ||
        profileName.toLowerCase().includes(searchValue) ||
        phone.toLowerCase().includes(searchValue) ||
        email.toLowerCase().includes(searchValue) ||
        role.toLowerCase().includes(searchValue) ||
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
      const profileName = item.profile?.full_name || '';
      const phone = item.profile?.phone || '';
      const email = item.profile?.email || '';
      const role = item.profile?.role || '';
      const statusGroup = getStatusGroup(item.status);

      const matchesSearch =
        !searchValue ||
        item.id.toLowerCase().includes(searchValue) ||
        String(item.user_id || '').toLowerCase().includes(searchValue) ||
        String(item.customer_id || '').toLowerCase().includes(searchValue) ||
        profileName.toLowerCase().includes(searchValue) ||
        phone.toLowerCase().includes(searchValue) ||
        email.toLowerCase().includes(searchValue) ||
        role.toLowerCase().includes(searchValue) ||
        item.payment_type.toLowerCase().includes(searchValue) ||
        item.status.toLowerCase().includes(searchValue) ||
        item.provider.toLowerCase().includes(searchValue) ||
        item.channel.toLowerCase().includes(searchValue) ||
        String(item.amount).includes(providerSearch.trim()) ||
        item.provider_reference.toLowerCase().includes(searchValue) ||
        item.internal_reference.toLowerCase().includes(searchValue) ||
        String(item.failure_reason || '').toLowerCase().includes(searchValue);

      const matchesType =
        providerTypeFilter === 'ALL' ||
        item.payment_type === providerTypeFilter;

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

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-4">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-emerald-600" />
          <p className="text-sm text-gray-500">Loading transactions...</p>
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
            <h2 className="font-bold">Unable to load platform transactions</h2>
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
              Admin Financial Records
            </p>

            <h1 className="text-3xl font-black md:text-4xl">
              Platform Transactions
            </h1>

            <p className="mt-4 max-w-3xl text-sm leading-7 text-emerald-50 md:text-base">
              Confirmed system transactions show real TrustPoint money
              movement. Provider attempts show Paystack/payment gateway records
              for audit only and are not added to confirmed totals.
            </p>
          </div>

          <button
            type="button"
            onClick={() => loadRecords(true)}
            disabled={refreshing}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
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
            Confirmed System Money Movement
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            These totals come from the `transactions` table only. This prevents
            double-counting when a Paystack payment also creates a confirmed
            system transaction.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <ValueCard
            title="Successful Confirmed Value"
            value={confirmedStats.successfulValue}
            variant="emerald"
            note="All successful system records"
          />

          <ValueCard
            title="Successful Credits"
            value={confirmedStats.successfulCreditValue}
            variant="blue"
            note="Confirmed money added"
          />

          <ValueCard
            title="Successful Debits"
            value={confirmedStats.successfulDebitValue}
            variant="red"
            note="Confirmed money deducted"
          />

          <ValueCard
            title="Net Confirmed Movement"
            value={confirmedStats.netSuccessfulValue}
            variant={confirmedStats.netSuccessfulValue >= 0 ? 'emerald' : 'red'}
            note="Credits minus debits"
          />
        </div>

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Confirmed Records"
            value={confirmedStats.total}
            icon={<Wallet size={24} />}
            color="emerald"
          />

          <StatCard
            title="Confirmed Successful"
            value={confirmedStats.successful}
            icon={<CheckCircle2 size={24} />}
            color="green"
          />

          <StatCard
            title="Confirmed Pending"
            value={confirmedStats.pending}
            icon={<Clock size={24} />}
            color="amber"
          />

          <StatCard
            title="Confirmed Failed"
            value={confirmedStats.failed}
            icon={<XCircle size={24} />}
            color="red"
          />
        </div>
      </section>

      <section className="space-y-5">
        <div>
          <h2 className="text-xl font-black text-gray-900">
            Payment Provider Attempts
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            These records come from `payment_transactions`. They help admins
            audit Paystack/payment activity, but they are not counted as extra
            financial volume.
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
          Admin reading guide
        </h2>

        <div className="mt-3 grid gap-3 text-sm leading-6 text-emerald-700 md:grid-cols-2">
          <p>
            <strong>Confirmed System Transactions</strong> are the source of
            truth for real money movement. Admin totals are calculated from this
            section only.
          </p>

          <p>
            <strong>Payment Provider Attempts</strong> are audit records from
            Paystack or future providers. A successful provider attempt can also
            create a confirmed transaction, so provider records are not included
            in financial totals.
          </p>
        </div>
      </div>

      <ConfirmedRecordsSection
        records={filteredConfirmedRecords}
        totalRecords={confirmedRecords.length}
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
        totalRecords={providerRecords.length}
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

      <div className="rounded-3xl border border-amber-100 bg-amber-50 p-5 md:p-6">
        <h2 className="text-lg font-bold text-amber-800">
          Admin transaction reminder
        </h2>

        <p className="mt-2 text-sm leading-6 text-amber-700">
          If a provider payment is successful but there is no matching confirmed
          system transaction, verify the reference and inspect the webhook or
          verification flow before adjusting any balance manually.
        </p>
      </div>
    </div>
  );
}

function ConfirmedRecordsSection({
  records,
  totalRecords,
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
  totalRecords: number;
  search: string;
  setSearch: (value: string) => void;
  typeFilter: string;
  setTypeFilter: (value: string) => void;
  statusFilter: StatusFilter;
  setStatusFilter: (value: StatusFilter) => void;
  directionFilter: DirectionFilter;
  setDirectionFilter: (value: DirectionFilter) => void;
  types: string[];
  clearFilters: () => void;
}) {
  return (
    <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm md:p-6">
      <RecordsHeader
        title="Confirmed System Transactions"
        description="Confirmed money movement from the transactions table."
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
          <EmptyState message="No confirmed transactions found." />
        ) : (
          records.map((item) => (
            <ConfirmedRecordCard key={item.id} item={item} />
          ))
        )}
      </div>

      <div className="mt-6 hidden overflow-hidden rounded-2xl border border-gray-100 lg:block">
        {records.length === 0 ? (
          <EmptyState message="No confirmed transactions found." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1250px] text-left">
              <thead className="bg-gray-50">
                <tr>
                  <TableHead>User</TableHead>
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
        total={totalRecords}
        clearFilters={clearFilters}
      />
    </section>
  );
}

function ProviderRecordsSection({
  records,
  totalRecords,
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
  totalRecords: number;
  search: string;
  setSearch: (value: string) => void;
  typeFilter: string;
  setTypeFilter: (value: string) => void;
  statusFilter: StatusFilter;
  setStatusFilter: (value: StatusFilter) => void;
  directionFilter: DirectionFilter;
  setDirectionFilter: (value: DirectionFilter) => void;
  types: string[];
  clearFilters: () => void;
}) {
  return (
    <section className="rounded-3xl border border-blue-100 bg-white p-5 shadow-sm md:p-6">
      <RecordsHeader
        title="Payment Provider Attempts"
        description="Payment gateway records from payment_transactions for audit and troubleshooting."
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
          <EmptyState message="No provider payment attempts found." />
        ) : (
          records.map((item) => (
            <ProviderRecordCard key={item.id} item={item} />
          ))
        )}
      </div>

      <div className="mt-6 hidden overflow-hidden rounded-2xl border border-gray-100 lg:block">
        {records.length === 0 ? (
          <EmptyState message="No provider payment attempts found." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1380px] text-left">
              <thead className="bg-gray-50">
                <tr>
                  <TableHead>User</TableHead>
                  <TableHead>Payment Type</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Direction</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Provider Ref</TableHead>
                  <TableHead>Internal Ref</TableHead>
                  <TableHead>Processed</TableHead>
                  <TableHead>Failure Reason</TableHead>
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
        total={totalRecords}
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
  statusFilter: StatusFilter;
  setStatusFilter: (value: StatusFilter) => void;
  directionFilter: DirectionFilter;
  setDirectionFilter: (value: DirectionFilter) => void;
  types: string[];
}) {
  return (
    <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
      <div>
        <h2 className="text-xl font-black text-gray-900">{title}</h2>
        <p className="mt-1 text-sm text-gray-500">{description}</p>
      </div>

      <div className="grid gap-3 md:grid-cols-4 xl:min-w-[900px]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />

          <input
            type="text"
            placeholder="Search user, reference, amount..."
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
            setStatusFilter(event.target.value as StatusFilter)
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
            setDirectionFilter(event.target.value as DirectionFilter)
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

      <UserBlock profile={item.profile} />

      <div className="mt-4 grid gap-3 text-sm">
        <InfoBlock label="Reference" value={item.reference} />
        <InfoBlock label="Channel" value={formatLabel(item.channel)} />
        <InfoBlock label="Description" value={item.description} />
        <InfoBlock label="Date" value={formatDateTime(item.created_at)} />
      </div>
    </div>
  );
}

function ProviderRecordCard({ item }: { item: ProviderRecord }) {
  return (
    <div className="rounded-3xl border border-blue-100 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-gray-500">
            {formatLabel(item.payment_type)}
          </p>
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

      <UserBlock profile={item.profile} />

      <div className="mt-4 grid gap-3 text-sm">
        <InfoBlock label="Provider Ref" value={item.provider_reference} />
        <InfoBlock label="Internal Ref" value={item.internal_reference} />
        <InfoBlock
          label="Processed"
          value={item.processed_at ? 'Yes' : 'No'}
        />
        {item.failure_reason && (
          <InfoBlock label="Failure" value={item.failure_reason} />
        )}
        <InfoBlock label="Date" value={formatDateTime(item.created_at)} />
      </div>
    </div>
  );
}

function ConfirmedRecordRow({ item }: { item: ConfirmedRecord }) {
  return (
    <tr className="hover:bg-gray-50">
      <td className="px-5 py-5">
        <UserBlock profile={item.profile} compact />
      </td>

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

      <td className="max-w-[220px] break-all px-5 py-5 text-sm text-gray-700">
        {item.reference}
      </td>

      <td className="px-5 py-5 text-sm text-gray-700">
        {formatLabel(item.channel)}
      </td>

      <td className="px-5 py-5 text-sm text-gray-700">{item.description}</td>

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
        <UserBlock profile={item.profile} compact />
      </td>

      <td className="px-5 py-5">
        <p className="font-bold text-gray-900">
          {formatLabel(item.payment_type)}
        </p>
        <p className="mt-1 text-xs text-gray-500">
          {item.contribution_id ? 'Linked contribution' : 'No contribution link'}
        </p>
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
        {item.provider_status && (
          <p className="mt-1 text-xs text-gray-500">
            Provider: {formatLabel(item.provider_status)}
          </p>
        )}
      </td>

      <td className="max-w-[220px] break-all px-5 py-5 text-sm text-gray-700">
        {item.provider_reference}
      </td>

      <td className="max-w-[220px] break-all px-5 py-5 text-sm text-gray-700">
        {item.internal_reference}
      </td>

      <td className="px-5 py-5 text-sm text-gray-700">
        {item.processed_at ? (
          <span className="font-bold text-emerald-700">Yes</span>
        ) : (
          <span className="font-bold text-amber-700">No</span>
        )}
        {item.verified_at && (
          <p className="mt-1 text-xs text-gray-500">
            Verified: {formatDateTime(item.verified_at)}
          </p>
        )}
      </td>

      <td className="max-w-[260px] px-5 py-5 text-sm text-gray-700">
        {item.failure_reason || '—'}
      </td>

      <td className="px-5 py-5 text-sm text-gray-700">
        {formatDateTime(item.created_at)}
      </td>
    </tr>
  );
}

function UserBlock({
  profile,
  compact = false,
}: {
  profile: ProfileSummary | null;
  compact?: boolean;
}) {
  return (
    <div className={compact ? '' : 'mt-4 rounded-2xl bg-gray-50 p-4'}>
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
          <User size={18} />
        </div>

        <div>
          <p className="font-bold text-gray-900">
            {profile?.full_name || 'Unknown user'}
          </p>

          <p className="mt-1 text-xs text-gray-500">
            {profile?.phone || 'No phone'} · {profile?.email || 'No email'}
          </p>

          <div className="mt-2 flex flex-wrap gap-2">
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-bold ${getTrustScoreStyle(
                profile?.trust_score
              )}`}
            >
              Trust Score: {profile?.trust_score ?? 0}
            </span>

            {profile?.role && (
              <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">
                {formatLabel(profile.role)}
              </span>
            )}

            {profile?.verification_status && (
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                {formatLabel(profile.verification_status)}
              </span>
            )}

            {profile?.status && (
              <span className="rounded-full bg-gray-50 px-2.5 py-1 text-xs font-bold text-gray-700">
                {formatLabel(profile.status)}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
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

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-gray-500">{label}</p>
      <p className="break-all font-semibold text-gray-900">{value}</p>
    </div>
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
}: {
  title: string;
  value: number;
  icon: ReactNode;
  color: 'emerald' | 'green' | 'amber' | 'red' | 'blue';
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
  variant?: 'default' | 'emerald' | 'amber' | 'blue' | 'red';
  note?: string;
}) {
  const classes = {
    default: 'border-gray-100 bg-white text-gray-900',
    emerald: 'border-emerald-100 bg-emerald-50 text-emerald-800',
    amber: 'border-amber-100 bg-amber-50 text-amber-800',
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