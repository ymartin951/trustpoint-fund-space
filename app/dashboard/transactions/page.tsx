'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  CreditCard,
  Eye,
  FileCheck2,
  Info,
  Loader2,
  RefreshCw,
  Search,
  Smartphone,
  TrendingDown,
  TrendingUp,
  Wallet,
  XCircle,
} from 'lucide-react';

import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

type RecordSource = 'ALL' | 'MANUAL_MOMO' | 'CONFIRMED' | 'PROVIDER';
type StatusGroup = 'ALL' | 'SUCCESSFUL' | 'PENDING' | 'FAILED' | 'OTHER';
type Direction = 'CREDIT' | 'DEBIT' | 'INCOMING' | 'OUTGOING' | 'NEUTRAL';

type ManualPaymentSubmissionRow = {
  id: string;
  agent_id: string | null;
  amount_due: number;
  company_payment_account_id: string | null;
  contribution_id: string;
  created_at: string;
  fund_space_id: string;
  payer_relationship: string | null;
  payer_type: string;
  payment_note: string | null;
  rejection_reason: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  round_id: string;
  sender_name: string | null;
  sender_network: string | null;
  sender_phone: string | null;
  service_fee: number;
  status: string;
  submitted_by: string | null;
  submitted_by_role: string | null;
  total_amount_paid: number;
  transaction_reference: string;
  user_id: string;
};

type TransactionRow = {
  id: string;
  amount: number;
  channel: string;
  contribution_id: string | null;
  created_at: string | null;
  created_by: string | null;
  currency: string;
  direction: string;
  fund_space_id: string | null;
  fund_space_round_id: string | null;
  metadata: unknown | null;
  note: string | null;
  payment_reference: string | null;
  payout_id: string | null;
  savings_plan_id: string | null;
  status: string;
  type: string;
  user_id: string;
  wallet_id: string | null;
  withdrawal_request_id: string | null;
};

type PaymentTransactionRow = {
  id: string;
  agent_id: string | null;
  amount: number;
  channel: string;
  contribution_id: string | null;
  created_at: string | null;
  currency: string;
  customer_id: string | null;
  direction: string;
  failure_reason: string | null;
  fee_amount: number | null;
  fund_space_id: string | null;
  fund_space_round_id: string | null;
  initiated_by: string | null;
  internal_reference: string;
  mobile_network: string | null;
  payer_name: string | null;
  payer_phone: string | null;
  payment_type: string;
  provider: string;
  provider_reference: string | null;
  provider_status: string | null;
  status: string;
  user_id: string;
};

type UserTransactionRecord = {
  id: string;
  raw_id: string;
  source: Exclude<RecordSource, 'ALL'>;
  title: string;
  description: string;
  amount: number;
  service_fee: number | null;
  currency: string;
  status: string;
  status_group: Exclude<StatusGroup, 'ALL'>;
  direction: Direction;
  channel: string;
  reference: string;
  secondary_reference: string | null;
  fund_space_id: string | null;
  contribution_id: string | null;
  created_at: string | null;
  action_href: string;
  action_label: string;
  rejection_reason: string | null;
};

type Stats = {
  total: number;
  manual_momo: number;
  awaiting_review: number;
  confirmed: number;
  provider: number;
  successful: number;
  pending: number;
  failed: number;
  confirmed_value: number;
  confirmed_credit_value: number;
  confirmed_debit_value: number;
};

const defaultStats: Stats = {
  total: 0,
  manual_momo: 0,
  awaiting_review: 0,
  confirmed: 0,
  provider: 0,
  successful: 0,
  pending: 0,
  failed: 0,
  confirmed_value: 0,
  confirmed_credit_value: 0,
  confirmed_debit_value: 0,
};

function formatCurrency(amount: number | string | null | undefined) {
  return `GH₵${Number(amount || 0).toLocaleString('en-GH', {
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

  return new Intl.DateTimeFormat('en-GH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatLabel(value: string | null | undefined) {
  if (!value) return 'Not set';

  return value
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizeDirection(value: string | null | undefined): Direction {
  const direction = String(value || '').toUpperCase();

  if (direction === 'CREDIT') return 'CREDIT';
  if (direction === 'DEBIT') return 'DEBIT';
  if (direction === 'INCOMING') return 'INCOMING';
  if (direction === 'OUTGOING') return 'OUTGOING';

  return 'NEUTRAL';
}

function getStatusGroup(
  status: string | null | undefined
): Exclude<StatusGroup, 'ALL'> {
  const value = String(status || 'PENDING').toUpperCase();

  if (
    ['SUCCESS', 'SUCCESSFUL', 'COMPLETED', 'PAID', 'APPROVED', 'CONFIRMED'].includes(
      value
    )
  ) {
    return 'SUCCESSFUL';
  }

  if (
    ['PENDING', 'PROCESSING', 'PENDING_REVIEW', 'PENDING_ADMIN_APPROVAL'].includes(
      value
    )
  ) {
    return 'PENDING';
  }

  if (
    ['FAILED', 'REJECTED', 'CANCELLED', 'ABANDONED', 'REVERSED', 'DEFAULTED'].includes(
      value
    )
  ) {
    return 'FAILED';
  }

  return 'OTHER';
}

function getStatusStyle(statusGroup: string) {
  if (statusGroup === 'SUCCESSFUL') {
    return 'border-emerald-100 bg-emerald-50 text-emerald-700';
  }

  if (statusGroup === 'PENDING') {
    return 'border-amber-100 bg-amber-50 text-amber-700';
  }

  if (statusGroup === 'FAILED') {
    return 'border-red-100 bg-red-50 text-red-700';
  }

  return 'border-gray-100 bg-gray-50 text-gray-700';
}

function getSourceStyle(source: UserTransactionRecord['source']) {
  if (source === 'MANUAL_MOMO') {
    return 'border-emerald-100 bg-emerald-50 text-emerald-700';
  }

  if (source === 'CONFIRMED') {
    return 'border-blue-100 bg-blue-50 text-blue-700';
  }

  return 'border-purple-100 bg-purple-50 text-purple-700';
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
    return <TrendingUp className="h-4 w-4" />;
  }

  if (direction === 'DEBIT' || direction === 'OUTGOING') {
    return <TrendingDown className="h-4 w-4" />;
  }

  return <Wallet className="h-4 w-4" />;
}

function getSourceIcon(source: UserTransactionRecord['source']) {
  if (source === 'MANUAL_MOMO') {
    return <Smartphone className="h-5 w-5" />;
  }

  if (source === 'CONFIRMED') {
    return <Wallet className="h-5 w-5" />;
  }

  return <CreditCard className="h-5 w-5" />;
}

function getProviderDescription(item: PaymentTransactionRow) {
  const type = String(item.payment_type || '').toUpperCase();

  if (type === 'WALLET_DEPOSIT') {
    return 'Wallet deposit payment attempt from payment provider.';
  }

  if (type === 'FUND_SPACE_CONTRIBUTION') {
    return 'Fund Space contribution payment attempt from payment provider.';
  }

  if (type === 'AGENT_CUSTOMER_DEPOSIT') {
    return 'Agent-assisted customer wallet deposit payment attempt.';
  }

  if (type === 'AGENT_CUSTOMER_CONTRIBUTION') {
    return 'Agent-assisted customer contribution payment attempt.';
  }

  if (type === 'WITHDRAWAL_PAYOUT') {
    return 'Withdrawal payout provider record.';
  }

  if (type === 'FUND_SPACE_PAYOUT') {
    return 'Fund Space payout provider record.';
  }

  return 'Payment provider tracking record.';
}

function getActionHref(record: {
  source: UserTransactionRecord['source'];
  fund_space_id: string | null;
  contribution_id: string | null;
}) {
  if (record.source === 'MANUAL_MOMO' && record.fund_space_id) {
    return `/dashboard/fund-space/${record.fund_space_id}`;
  }

  if (record.contribution_id && record.fund_space_id) {
    return `/dashboard/fund-space/${record.fund_space_id}`;
  }

  if (record.fund_space_id) {
    return `/dashboard/fund-space/${record.fund_space_id}`;
  }

  return '/dashboard/transactions';
}

function mapManualRecord(item: ManualPaymentSubmissionRow): UserTransactionRecord {
  const statusGroup = getStatusGroup(item.status);

  return {
    id: `manual-${item.id}`,
    raw_id: item.id,
    source: 'MANUAL_MOMO',
    title:
      item.status === 'PENDING_REVIEW'
        ? 'MoMo Payment Awaiting Verification'
        : item.status === 'REJECTED'
          ? 'MoMo Payment Rejected'
          : statusGroup === 'SUCCESSFUL'
            ? 'MoMo Payment Confirmed'
            : 'Manual MoMo Payment',
    description:
      item.status === 'PENDING_REVIEW'
        ? 'Your payment reference has been submitted and is waiting for admin verification.'
        : item.status === 'REJECTED'
          ? item.rejection_reason || 'Your manual MoMo payment was rejected.'
          : 'Manual MoMo payment record for your Fund Space contribution.',
    amount: Number(item.total_amount_paid || 0),
    service_fee: Number(item.service_fee || 0),
    currency: 'GHS',
    status: item.status || 'PENDING',
    status_group: statusGroup,
    direction: 'OUTGOING',
    channel: item.sender_network || 'MOMO',
    reference: item.transaction_reference || item.id.slice(0, 8),
    secondary_reference: item.payer_type || null,
    fund_space_id: item.fund_space_id,
    contribution_id: item.contribution_id,
    created_at: item.created_at,
    action_href: getActionHref({
      source: 'MANUAL_MOMO',
      fund_space_id: item.fund_space_id,
      contribution_id: item.contribution_id,
    }),
    action_label:
      item.status === 'PENDING_REVIEW'
        ? 'View Fund Space'
        : item.status === 'REJECTED'
          ? 'Resubmit Payment'
          : 'View Details',
    rejection_reason: item.rejection_reason,
  };
}

function mapConfirmedRecord(item: TransactionRow): UserTransactionRecord {
  const direction = normalizeDirection(item.direction);
  const statusGroup = getStatusGroup(item.status);

  const record = {
    source: 'CONFIRMED' as const,
    fund_space_id: item.fund_space_id,
    contribution_id: item.contribution_id,
  };

  return {
    id: `confirmed-${item.id}`,
    raw_id: item.id,
    source: 'CONFIRMED',
    title: 'Confirmed TrustPoint Transaction',
    description: item.note || 'Confirmed TrustPoint system transaction.',
    amount: Number(item.amount || 0),
    service_fee: null,
    currency: item.currency || 'GHS',
    status: item.status || 'PENDING',
    status_group: statusGroup,
    direction,
    channel: item.channel || 'SYSTEM',
    reference: item.payment_reference || item.id.slice(0, 8),
    secondary_reference: item.type || null,
    fund_space_id: item.fund_space_id,
    contribution_id: item.contribution_id,
    created_at: item.created_at,
    action_href: getActionHref(record),
    action_label: 'View Related Details',
    rejection_reason: null,
  };
}

function mapProviderRecord(item: PaymentTransactionRow): UserTransactionRecord {
  const direction = normalizeDirection(item.direction);
  const statusGroup = getStatusGroup(item.status);

  const record = {
    source: 'PROVIDER' as const,
    fund_space_id: item.fund_space_id,
    contribution_id: item.contribution_id,
  };

  return {
    id: `provider-${item.id}`,
    raw_id: item.id,
    source: 'PROVIDER',
    title: 'Payment Provider Attempt',
    description: item.failure_reason || getProviderDescription(item),
    amount: Number(item.amount || 0),
    service_fee: item.fee_amount === null ? null : Number(item.fee_amount || 0),
    currency: item.currency || 'GHS',
    status: item.status || item.provider_status || 'PENDING',
    status_group: statusGroup,
    direction,
    channel: item.channel || item.mobile_network || 'PAYMENT_GATEWAY',
    reference: item.provider_reference || item.internal_reference || item.id.slice(0, 8),
    secondary_reference: item.internal_reference || null,
    fund_space_id: item.fund_space_id,
    contribution_id: item.contribution_id,
    created_at: item.created_at,
    action_href: getActionHref(record),
    action_label: 'View Related Details',
    rejection_reason: item.failure_reason,
  };
}

function itemMatchesSearch(item: UserTransactionRecord, search: string) {
  if (!search.trim()) return true;

  const value = search.trim().toLowerCase();

  const haystack = [
    item.id,
    item.raw_id,
    item.title,
    item.description,
    item.source,
    item.status,
    item.status_group,
    item.direction,
    item.channel,
    item.reference,
    item.secondary_reference,
    item.rejection_reason,
    item.amount,
    item.currency,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return haystack.includes(value);
}

function calculateStats(records: UserTransactionRecord[]): Stats {
  const manual = records.filter((item) => item.source === 'MANUAL_MOMO');
  const confirmed = records.filter((item) => item.source === 'CONFIRMED');
  const provider = records.filter((item) => item.source === 'PROVIDER');

  const successful = records.filter((item) => item.status_group === 'SUCCESSFUL');
  const pending = records.filter((item) => item.status_group === 'PENDING');
  const failed = records.filter((item) => item.status_group === 'FAILED');

  const successfulConfirmed = confirmed.filter(
    (item) => item.status_group === 'SUCCESSFUL'
  );

  const confirmedCredits = successfulConfirmed.filter((item) =>
    ['CREDIT', 'INCOMING'].includes(item.direction)
  );

  const confirmedDebits = successfulConfirmed.filter((item) =>
    ['DEBIT', 'OUTGOING'].includes(item.direction)
  );

  return {
    total: records.length,
    manual_momo: manual.length,
    awaiting_review: manual.filter((item) => item.status === 'PENDING_REVIEW')
      .length,
    confirmed: confirmed.length,
    provider: provider.length,
    successful: successful.length,
    pending: pending.length,
    failed: failed.length,
    confirmed_value: successfulConfirmed.reduce(
      (sum, item) => sum + Number(item.amount || 0),
      0
    ),
    confirmed_credit_value: confirmedCredits.reduce(
      (sum, item) => sum + Number(item.amount || 0),
      0
    ),
    confirmed_debit_value: confirmedDebits.reduce(
      (sum, item) => sum + Number(item.amount || 0),
      0
    ),
  };
}

export default function UserTransactionsPage() {
  const { profile, loading } = useAuth();

  const [records, setRecords] = useState<UserTransactionRecord[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const [sourceFilter, setSourceFilter] = useState<RecordSource>('ALL');
  const [statusFilter, setStatusFilter] = useState<StatusGroup>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  const loadRecords = useCallback(
    async (userId: string, showRefreshState = false) => {
      try {
        if (showRefreshState) {
          setRefreshing(true);
        } else {
          setPageLoading(true);
        }

        setErrorMessage('');

        /**
         * Important:
         * The project has had generated type mismatches around manual_payment_submissions.
         * Casting the client here prevents false TypeScript .from() errors while still
         * querying only the logged-in user's records.
         */
        const client = supabase as any;

        const [
          manualPaymentResult,
          transactionResult,
          paymentTransactionResult,
        ] = await Promise.all([
          client
            .from('manual_payment_submissions')
            .select(
              'id, agent_id, amount_due, company_payment_account_id, contribution_id, created_at, fund_space_id, payer_relationship, payer_type, payment_note, rejection_reason, reviewed_at, reviewed_by, round_id, sender_name, sender_network, sender_phone, service_fee, status, submitted_by, submitted_by_role, total_amount_paid, transaction_reference, user_id'
            )
            .or(
              `user_id.eq.${userId},submitted_by.eq.${userId},agent_id.eq.${userId}`
            )
            .order('created_at', { ascending: false })
            .limit(300),

          client
            .from('transactions')
            .select(
              'id, amount, channel, contribution_id, created_at, created_by, currency, direction, fund_space_id, fund_space_round_id, metadata, note, payment_reference, payout_id, savings_plan_id, status, type, user_id, wallet_id, withdrawal_request_id'
            )
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(300),

          client
            .from('payment_transactions')
            .select(
              'id, agent_id, amount, channel, contribution_id, created_at, currency, customer_id, direction, failure_reason, fee_amount, fund_space_id, fund_space_round_id, initiated_by, internal_reference, mobile_network, payer_name, payer_phone, payment_type, provider, provider_reference, provider_status, status, user_id'
            )
            .or(
              `user_id.eq.${userId},customer_id.eq.${userId},initiated_by.eq.${userId},agent_id.eq.${userId}`
            )
            .order('created_at', { ascending: false })
            .limit(300),
        ]);

        if (manualPaymentResult.error) {
          throw new Error(
            manualPaymentResult.error.message ||
              'Unable to load manual MoMo payment records.'
          );
        }

        if (transactionResult.error) {
          throw new Error(
            transactionResult.error.message ||
              'Unable to load confirmed transaction records.'
          );
        }

        if (paymentTransactionResult.error) {
          throw new Error(
            paymentTransactionResult.error.message ||
              'Unable to load payment provider records.'
          );
        }

        const manualRecords = (
          (manualPaymentResult.data || []) as ManualPaymentSubmissionRow[]
        ).map(mapManualRecord);

        const confirmedRecords = (
          (transactionResult.data || []) as TransactionRow[]
        ).map(mapConfirmedRecord);

        const providerRecords = (
          (paymentTransactionResult.data || []) as PaymentTransactionRow[]
        ).map(mapProviderRecord);

        const combined = [
          ...manualRecords,
          ...confirmedRecords,
          ...providerRecords,
        ].sort((a, b) => {
          const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
          const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;

          return bTime - aTime;
        });

        setRecords(combined);
      } catch (error) {
        console.error('User transactions load error:', error);

        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'Unable to load your transaction records.'
        );

        setRecords([]);
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

  const stats = useMemo(() => calculateStats(records), [records]);

  const filteredRecords = useMemo(() => {
    return records
      .filter((item) => sourceFilter === 'ALL' || item.source === sourceFilter)
      .filter(
        (item) => statusFilter === 'ALL' || item.status_group === statusFilter
      )
      .filter((item) => itemMatchesSearch(item, searchTerm));
  }, [records, sourceFilter, statusFilter, searchTerm]);

  function clearFilters() {
    setSourceFilter('ALL');
    setStatusFilter('ALL');
    setSearchTerm('');
  }

  if (loading || pageLoading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-4">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-emerald-600" />
          <p className="text-sm font-semibold text-gray-500">
            Loading your transaction records...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="rounded-3xl bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-600 p-6 text-white shadow-sm md:p-8">
        <div className="flex flex-col justify-between gap-6 xl:flex-row xl:items-center">
          <div className="max-w-4xl">
            <p className="mb-3 inline-flex rounded-full bg-white/15 px-4 py-1 text-sm font-semibold">
              My Transaction Center
            </p>

            <h1 className="text-3xl font-black md:text-4xl">
              My transaction records
            </h1>

            <p className="mt-4 max-w-3xl text-sm leading-7 text-emerald-50 md:text-base">
              View all transaction records connected to your account, including
              manual MoMo submissions, confirmed TrustPoint system transactions,
              and payment provider attempts.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/dashboard/fund-space"
                className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-emerald-700 hover:bg-emerald-50"
              >
                My Fund Space
                <ArrowRight className="h-4 w-4" />
              </Link>

              <Link
                href="/dashboard/notifications"
                className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-5 py-3 text-sm font-bold text-white ring-1 ring-white/20 hover:bg-white/20"
              >
                Notifications
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <button
            type="button"
            onClick={() => profile?.id && loadRecords(profile.id, true)}
            disabled={refreshing}
            className="inline-flex min-h-12 w-fit items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw
              className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`}
            />
            Refresh
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-700">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <p>{errorMessage}</p>
        </div>
      )}

      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <StatButton
          title="All Records"
          value={stats.total}
          description="Everything related to your account"
          icon={<Wallet className="h-5 w-5" />}
          active={sourceFilter === 'ALL' && statusFilter === 'ALL'}
          onClick={() => {
            setSourceFilter('ALL');
            setStatusFilter('ALL');
          }}
        />

        <StatButton
          title="Manual MoMo"
          value={stats.manual_momo}
          description="Your submitted MoMo references"
          icon={<Smartphone className="h-5 w-5" />}
          active={sourceFilter === 'MANUAL_MOMO'}
          onClick={() => {
            setSourceFilter('MANUAL_MOMO');
            setStatusFilter('ALL');
          }}
        />

        <StatButton
          title="Awaiting Verification"
          value={stats.awaiting_review}
          description="MoMo references pending admin review"
          icon={<Clock className="h-5 w-5" />}
          active={
            sourceFilter === 'MANUAL_MOMO' && statusFilter === 'PENDING'
          }
          onClick={() => {
            setSourceFilter('MANUAL_MOMO');
            setStatusFilter('PENDING');
          }}
        />

        <StatButton
          title="Confirmed Records"
          value={stats.confirmed}
          description="Real TrustPoint system transactions"
          icon={<CheckCircle2 className="h-5 w-5" />}
          active={sourceFilter === 'CONFIRMED'}
          onClick={() => {
            setSourceFilter('CONFIRMED');
            setStatusFilter('ALL');
          }}
        />

        <ValueButton
          title="Confirmed Value"
          value={stats.confirmed_value}
          description="Successful confirmed system records only"
          active={
            sourceFilter === 'CONFIRMED' && statusFilter === 'SUCCESSFUL'
          }
          onClick={() => {
            setSourceFilter('CONFIRMED');
            setStatusFilter('SUCCESSFUL');
          }}
        />

        <ValueButton
          title="Confirmed Credits"
          value={stats.confirmed_credit_value}
          description="Money credited to you"
          active={false}
          onClick={() => {
            setSourceFilter('CONFIRMED');
            setStatusFilter('SUCCESSFUL');
          }}
        />

        <ValueButton
          title="Confirmed Debits"
          value={stats.confirmed_debit_value}
          description="Money paid out, contributed, or withdrawn"
          active={false}
          onClick={() => {
            setSourceFilter('CONFIRMED');
            setStatusFilter('SUCCESSFUL');
          }}
        />

        <StatButton
          title="Provider Attempts"
          value={stats.provider}
          description="Payment gateway tracking records"
          icon={<CreditCard className="h-5 w-5" />}
          active={sourceFilter === 'PROVIDER'}
          onClick={() => {
            setSourceFilter('PROVIDER');
            setStatusFilter('ALL');
          }}
        />
      </section>

      <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-5 md:p-6">
        <div className="flex gap-3">
          <Info className="mt-1 h-5 w-5 shrink-0 text-emerald-700" />
          <div>
            <h2 className="text-lg font-black text-emerald-900">
              How to read this page
            </h2>
            <p className="mt-2 text-sm leading-6 text-emerald-800">
              Manual MoMo records show references you submitted for admin
              verification. Confirmed records are the real TrustPoint system
              transactions and should be used for financial totals. Provider
              attempts are payment gateway tracking records and are shown for
              transparency, but they should not be added again to confirmed
              totals.
            </p>
          </div>
        </div>
      </div>

      <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="text-xl font-black text-gray-900">
              Transaction Records
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Showing {filteredRecords.length} of {records.length} records.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-3 xl:min-w-[760px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />

              <input
                type="text"
                placeholder="Search reference, status, amount..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="min-h-12 w-full rounded-xl border border-gray-200 py-3 pl-10 pr-4 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
            </div>

            <select
              value={sourceFilter}
              onChange={(event) =>
                setSourceFilter(event.target.value as RecordSource)
              }
              className="min-h-12 rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            >
              <option value="ALL">All Sources</option>
              <option value="MANUAL_MOMO">Manual MoMo</option>
              <option value="CONFIRMED">Confirmed System Records</option>
              <option value="PROVIDER">Provider Attempts</option>
            </select>

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as StatusGroup)
              }
              className="min-h-12 rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            >
              <option value="ALL">All Statuses</option>
              <option value="SUCCESSFUL">Successful</option>
              <option value="PENDING">Pending</option>
              <option value="FAILED">Failed / Rejected</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {(
            [
              ['ALL', 'All'],
              ['MANUAL_MOMO', 'Manual MoMo'],
              ['CONFIRMED', 'Confirmed'],
              ['PROVIDER', 'Provider'],
            ] as [RecordSource, string][]
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setSourceFilter(value)}
              className={`rounded-xl px-4 py-2.5 text-sm font-black transition ${
                sourceFilter === value
                  ? 'bg-emerald-600 text-white shadow-sm hover:bg-emerald-700'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {label}
            </button>
          ))}

          {(
            [
              ['ALL', 'All Status'],
              ['SUCCESSFUL', 'Successful'],
              ['PENDING', 'Pending'],
              ['FAILED', 'Failed'],
            ] as [StatusGroup, string][]
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setStatusFilter(value)}
              className={`rounded-xl px-4 py-2.5 text-sm font-black transition ${
                statusFilter === value
                  ? 'bg-gray-900 text-white shadow-sm hover:bg-gray-800'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {label}
            </button>
          ))}

          <button
            type="button"
            onClick={clearFilters}
            className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-black text-gray-700 transition hover:bg-gray-50"
          >
            Clear Filters
          </button>
        </div>
      </section>

      <section className="rounded-3xl border border-gray-100 bg-white shadow-sm">
        {filteredRecords.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredRecords.map((record) => (
              <Link
                key={record.id}
                href={record.action_href}
                className="group block p-5 transition hover:bg-emerald-50/40 md:p-6"
              >
                <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                  <div className="flex min-w-0 flex-1 gap-4">
                    <div
                      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border ${getSourceStyle(
                        record.source
                      )}`}
                    >
                      {getSourceIcon(record.source)}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-black text-gray-900 group-hover:text-emerald-800">
                          {record.title}
                        </h3>

                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-black ${getSourceStyle(
                            record.source
                          )}`}
                        >
                          {formatLabel(record.source)}
                        </span>

                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-black ${getStatusStyle(
                            record.status_group
                          )}`}
                        >
                          {formatLabel(record.status)}
                        </span>

                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-black ${getDirectionStyle(
                            record.direction
                          )}`}
                        >
                          {getDirectionIcon(record.direction)}
                          {formatLabel(record.direction)}
                        </span>
                      </div>

                      <p className="mt-2 text-sm leading-6 text-gray-600">
                        {record.description}
                      </p>

                      <div className="mt-4 grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-4">
                        <div className="rounded-2xl bg-gray-50 p-4">
                          <p className="text-xs font-bold uppercase text-gray-400">
                            Amount
                          </p>
                          <p className="mt-1 text-lg font-black text-gray-900">
                            {formatCurrency(record.amount)}
                          </p>
                          {record.service_fee !== null && (
                            <p className="text-xs text-gray-500">
                              Fee: {formatCurrency(record.service_fee)}
                            </p>
                          )}
                        </div>

                        <div className="rounded-2xl bg-gray-50 p-4">
                          <p className="text-xs font-bold uppercase text-gray-400">
                            Reference
                          </p>
                          <p className="mt-1 break-all font-black text-gray-900">
                            {record.reference || 'Not provided'}
                          </p>
                          {record.secondary_reference && (
                            <p className="text-xs text-gray-500">
                              {formatLabel(record.secondary_reference)}
                            </p>
                          )}
                        </div>

                        <div className="rounded-2xl bg-gray-50 p-4">
                          <p className="text-xs font-bold uppercase text-gray-400">
                            Channel
                          </p>
                          <p className="mt-1 font-black text-gray-900">
                            {formatLabel(record.channel)}
                          </p>
                          <p className="text-xs text-gray-500">
                            {record.currency || 'GHS'}
                          </p>
                        </div>

                        <div className="rounded-2xl bg-gray-50 p-4">
                          <p className="text-xs font-bold uppercase text-gray-400">
                            Date
                          </p>
                          <p className="mt-1 font-black text-gray-900">
                            {formatDateTime(record.created_at)}
                          </p>
                        </div>
                      </div>

                      {record.rejection_reason && (
                        <div className="mt-4 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
                          <p className="font-black">
                            Failure / rejection reason
                          </p>
                          <p className="mt-1 leading-6">
                            {record.rejection_reason}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    {record.source === 'MANUAL_MOMO' && (
                      <span className="inline-flex items-center gap-2 rounded-xl border border-emerald-100 bg-white px-4 py-2 text-sm font-black text-emerald-700">
                        <FileCheck2 className="h-4 w-4" />
                        MoMo
                      </span>
                    )}

                    <span className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-black text-white group-hover:bg-emerald-700">
                      {record.action_label}
                      <Eye className="h-4 w-4" />
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function StatButton({
  title,
  value,
  description,
  icon,
  active,
  onClick,
}: {
  title: string;
  value: number;
  description: string;
  icon: ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group rounded-3xl border p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md md:p-6 ${
        active
          ? 'border-emerald-200 bg-emerald-50'
          : 'border-gray-100 bg-white hover:border-emerald-200'
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-gray-500">{title}</p>
          <h3 className="mt-2 text-3xl font-black text-gray-900">{value}</h3>
          <p className="mt-1 text-sm leading-6 text-gray-500">{description}</p>
          <p className="mt-3 inline-flex items-center gap-1 text-xs font-black text-emerald-700 opacity-0 transition group-hover:opacity-100">
            Open filtered records <ArrowRight className="h-3.5 w-3.5" />
          </p>
        </div>

        <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-700 transition group-hover:bg-emerald-600 group-hover:text-white">
          {icon}
        </div>
      </div>
    </button>
  );
}

function ValueButton({
  title,
  value,
  description,
  active,
  onClick,
}: {
  title: string;
  value: number;
  description: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group rounded-3xl border p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md md:p-6 ${
        active
          ? 'border-blue-200 bg-blue-50'
          : 'border-gray-100 bg-white hover:border-blue-200'
      }`}
    >
      <p className="text-sm font-bold text-gray-500">{title}</p>
      <h3 className="mt-2 text-2xl font-black text-gray-900 md:text-3xl">
        {formatCurrency(value)}
      </h3>
      <p className="mt-1 text-sm leading-6 text-gray-500">{description}</p>
      <p className="mt-3 inline-flex items-center gap-1 text-xs font-black text-blue-700 opacity-0 transition group-hover:opacity-100">
        Open related records <ArrowRight className="h-3.5 w-3.5" />
      </p>
    </button>
  );
}

function EmptyState() {
  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 p-8 text-center">
      <Wallet className="h-10 w-10 text-gray-300" />
      <h2 className="text-lg font-black text-gray-900">
        No transaction records found
      </h2>
      <p className="max-w-md text-sm leading-6 text-gray-500">
        Try clearing the filters or search term. Manual MoMo payment records
        will appear here after you submit a payment reference.
      </p>
    </div>
  );
}