'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  ArrowLeft,
  BadgeCheck,
  Banknote,
  CalendarClock,
  CheckCircle2,
  Clock,
  HandCoins,
  Loader2,
  RefreshCw,
  Search,
  ShieldAlert,
  TimerReset,
  UserRound,
  WalletCards,
  X,
  XCircle,
} from 'lucide-react';

import { supabase } from '@/lib/supabase/client';

type FilterStatus =
  | 'ALL'
  | 'PENDING'
  | 'PAID'
  | 'LATE'
  | 'MISSED'
  | 'FEE_APPLIED'
  | 'FEE_PAID'
  | 'FEE_WAIVED';

type Profile = {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  role: string | null;
  status: string | null;
  verification_status: string | null;
};

type FundSpace = {
  id: string;
  name: string | null;
  contribution_amount: number | null;
  status: string | null;
  current_round_number: number | null;
};

type Round = {
  id: string;
  fund_space_id: string;
  round_number: number;
  contribution_deadline: string | null;
  week_start_date: string | null;
  week_end_date: string | null;
  status: string | null;
};

type PenaltyRecord = {
  id: string;
  fund_space_id: string;
  round_id: string;
  user_id: string;
  amount_due: number;
  amount_paid: number;
  status: string;
  payment_method: string | null;
  payment_reference: string | null;
  paid_at: string | null;
  confirmed_by: string | null;
  created_at: string | null;
  updated_at: string | null;
  payment_timing: string;
  is_late: boolean;
  late_fee_amount: number;
  late_fee_status: string;
  late_fee_paid_at: string | null;
  late_fee_waived_by: string | null;
  late_fee_waived_at: string | null;
  late_fee_waiver_reason: string | null;
  penalty_applied_at: string | null;
  penalty_applied_by: string | null;
  member: Profile | null;
  fund_space: FundSpace | null;
  round: Round | null;
  confirmed_by_profile: Profile | null;
  waived_by_profile: Profile | null;
  penalty_applied_by_profile: Profile | null;
};

type RoundOption = {
  id: string;
  round_number: number | null;
  contribution_deadline: string | null;
  status: string | null;
  fund_space_name: string;
  fund_space_id: string;
};

type ApiResponse = {
  success: boolean;
  message?: string;
  records?: PenaltyRecord[];
  rounds?: RoundOption[];
  stats?: {
    total: number;
    pending: number;
    paid: number;
    late: number;
    missed: number;
    late_fee_applied: number;
    late_fee_paid: number;
    late_fee_waived: number;
    total_late_fee_value: number;
    unpaid_late_fee_value: number;
  };
};

const defaultStats = {
  total: 0,
  pending: 0,
  paid: 0,
  late: 0,
  missed: 0,
  late_fee_applied: 0,
  late_fee_paid: 0,
  late_fee_waived: 0,
  total_late_fee_value: 0,
  unpaid_late_fee_value: 0,
};

function formatCurrency(amount: number | string | null | undefined) {
  return `GH₵${Number(amount || 0).toLocaleString('en-GH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'Not set';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return 'Invalid date';

  return date.toLocaleDateString('en-GH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
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

function formatLabel(value: string | null | undefined) {
  if (!value) return 'Not set';

  return value
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusStyle(status: string | null | undefined) {
  const value = String(status || '').toUpperCase();

  if (['PAID', 'ON_TIME', 'WAIVED'].includes(value)) {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }

  if (['PENDING', 'PARTIALLY_PAID', 'APPLIED'].includes(value)) {
    return 'border-amber-200 bg-amber-50 text-amber-700';
  }

  if (['LATE', 'MISSED', 'REJECTED', 'DEFAULTED'].includes(value)) {
    return 'border-red-200 bg-red-50 text-red-700';
  }

  return 'border-slate-200 bg-slate-50 text-slate-700';
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

function StatCard({
  title,
  value,
  helper,
  active,
  onClick,
}: {
  title: string;
  value: string | number;
  helper: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-3xl border p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
        active
          ? 'border-emerald-300 bg-emerald-50'
          : 'border-slate-200 bg-white hover:border-emerald-200'
      }`}
    >
      <div className="mb-4 inline-flex rounded-2xl bg-emerald-50 p-3 text-emerald-700">
        <TimerReset className="h-6 w-6" />
      </div>

      <p className="text-sm font-bold text-slate-500">{title}</p>
      <p className="mt-1 text-2xl font-black text-slate-900">{value}</p>
      <p className="mt-1 text-xs leading-5 text-slate-500">{helper}</p>
    </button>
  );
}

function InfoBox({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
      <p className="text-xs font-black uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-1 break-words text-sm font-bold text-slate-900">
        {value ?? 'Not provided'}
      </p>
    </div>
  );
}

function StatusPill({ status }: { status: string | null | undefined }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-black ${statusStyle(
        status
      )}`}
    >
      {formatLabel(status)}
    </span>
  );
}

export default function AdminFundSpacePenaltiesPage() {
  const [records, setRecords] = useState<PenaltyRecord[]>([]);
  const [rounds, setRounds] = useState<RoundOption[]>([]);
  const [stats, setStats] = useState(defaultStats);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [filter, setFilter] = useState<FilterStatus>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  const [selectedRoundId, setSelectedRoundId] = useState('');
  const [actionLoading, setActionLoading] = useState('');

  const [waiveContributionId, setWaiveContributionId] = useState('');
  const [waiverReason, setWaiverReason] = useState('');

  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const filteredRecords = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    return records.filter((record) => {
      if (filter === 'PENDING') {
        if (!['PENDING', 'PARTIALLY_PAID'].includes(record.status)) return false;
      }

      if (filter === 'PAID') {
        if (record.status !== 'PAID') return false;
      }

      if (filter === 'LATE') {
        if (record.payment_timing !== 'LATE') return false;
      }

      if (filter === 'MISSED') {
        if (record.status !== 'MISSED') return false;
      }

      if (filter === 'FEE_APPLIED') {
        if (record.late_fee_status !== 'APPLIED') return false;
      }

      if (filter === 'FEE_PAID') {
        if (record.late_fee_status !== 'PAID') return false;
      }

      if (filter === 'FEE_WAIVED') {
        if (record.late_fee_status !== 'WAIVED') return false;
      }

      if (!search) return true;

      const haystack = [
        record.member?.full_name,
        record.member?.phone,
        record.member?.email,
        record.fund_space?.name,
        record.round?.round_number ? `round ${record.round.round_number}` : '',
        record.status,
        record.payment_timing,
        record.late_fee_status,
        record.payment_reference,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(search);
    });
  }, [records, filter, searchTerm]);

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

      const response = await fetch('/api/admin/fund-space/penalties', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const result = await readApiResponse(response);

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Unable to load penalty records.');
      }

      setRecords(result.records || []);
      setRounds(result.rounds || []);
      setStats(result.stats || defaultStats);

      if (!selectedRoundId && result.rounds?.[0]?.id) {
        setSelectedRoundId(result.rounds[0].id);
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Unable to load penalty records.'
      );
      setRecords([]);
      setRounds([]);
      setStats(defaultStats);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedRoundId]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  async function runPenaltyAction(input: {
    action: 'APPLY_ROUND_FEES' | 'WAIVE_LATE_FEE' | 'MARK_LATE_FEE_PAID';
    round_id?: string;
    contribution_id?: string;
    reason?: string;
  }) {
    try {
      setActionLoading(
        input.contribution_id
          ? `${input.action}-${input.contribution_id}`
          : input.action
      );
      setErrorMessage('');
      setSuccessMessage('');

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.access_token) {
        throw new Error('Your session has expired. Please log in again.');
      }

      const response = await fetch('/api/admin/fund-space/penalties', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(input),
      });

      const result = await readApiResponse(response);

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Unable to complete penalty action.');
      }

      setSuccessMessage(result.message || 'Penalty action completed successfully.');

      setWaiveContributionId('');
      setWaiverReason('');

      await loadRecords(true);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Unable to complete penalty action.'
      );
    } finally {
      setActionLoading('');
    }
  }

  async function handleApplyRoundFees() {
    if (!selectedRoundId) {
      setErrorMessage('Please select a round first.');
      return;
    }

    const confirmed = window.confirm(
      'Apply late fees and mark missed payments for this round? This should normally be done after the final deadline.'
    );

    if (!confirmed) return;

    await runPenaltyAction({
      action: 'APPLY_ROUND_FEES',
      round_id: selectedRoundId,
    });
  }

  async function handleWaiveLateFee() {
    if (!waiveContributionId) {
      setErrorMessage('No contribution selected.');
      return;
    }

    if (!waiverReason.trim()) {
      setErrorMessage('Please enter a waiver reason.');
      return;
    }

    await runPenaltyAction({
      action: 'WAIVE_LATE_FEE',
      contribution_id: waiveContributionId,
      reason: waiverReason.trim(),
    });
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-6 md:px-8">
        <div className="mx-auto flex min-h-[60vh] max-w-7xl items-center justify-center">
          <div className="text-center">
            <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-emerald-700" />
            <h1 className="text-lg font-black text-slate-900">
              Loading penalty records...
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Please wait while TrustPoint loads late payment information.
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
                <TimerReset className="h-4 w-4" />
                Admin Penalty Control
              </p>

              <h1 className="text-3xl font-black tracking-tight md:text-4xl">
                Late Payments & Penalties
              </h1>

              <p className="mt-3 max-w-3xl text-sm leading-7 text-emerald-50">
                Track late contributions, missed payments, applied penalties,
                paid penalties, and waived fees. Use this page after the final
                deadline to keep contribution discipline strong.
              </p>

              <div className="mt-5">
                <Link
                  href="/admin/fund-space"
                  className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-white px-4 text-sm font-black text-emerald-700 hover:bg-emerald-50"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to Fund Space
                </Link>
              </div>
            </div>

            <div className="rounded-3xl bg-white/15 p-5 backdrop-blur lg:min-w-72">
              <p className="text-sm text-emerald-50">Unpaid Late Fees</p>
              <p className="mt-1 text-2xl font-black">
                {formatCurrency(stats.unpaid_late_fee_value)}
              </p>
              <p className="mt-2 text-xs font-semibold text-emerald-50">
                Fees currently applied but not paid or waived.
              </p>
            </div>
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
              <p className="text-sm font-bold leading-6">{errorMessage}</p>
            </div>
          </div>
        )}

        <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-5">
          <StatCard
            title="Total Records"
            value={stats.total}
            helper="All contributions"
            active={filter === 'ALL'}
            onClick={() => setFilter('ALL')}
          />

          <StatCard
            title="Pending"
            value={stats.pending}
            helper="Unpaid or partial"
            active={filter === 'PENDING'}
            onClick={() => setFilter('PENDING')}
          />

          <StatCard
            title="Late"
            value={stats.late}
            helper="Paid after deadline"
            active={filter === 'LATE'}
            onClick={() => setFilter('LATE')}
          />

          <StatCard
            title="Missed"
            value={stats.missed}
            helper="Missed deadline"
            active={filter === 'MISSED'}
            onClick={() => setFilter('MISSED')}
          />

          <StatCard
            title="Fees Applied"
            value={stats.late_fee_applied}
            helper="Needs payment or waiver"
            active={filter === 'FEE_APPLIED'}
            onClick={() => setFilter('FEE_APPLIED')}
          />
        </section>

        <section className="grid gap-5 lg:grid-cols-[1fr_420px]">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-black text-slate-900">
              Apply Late Fees for a Round
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              Use this after the contribution deadline. The system will mark
              unpaid contributions as missed and apply late fees to payments
              made after deadline.
            </p>

            <div className="mt-5 grid gap-3 md:grid-cols-[1fr_auto]">
              <select
                value={selectedRoundId}
                onChange={(event) => setSelectedRoundId(event.target.value)}
                className="min-h-12 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-700 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              >
                <option value="">Select round</option>
                {rounds.map((round) => (
                  <option key={round.id} value={round.id}>
                    {round.fund_space_name} • Round {round.round_number || 'N/A'} • Deadline{' '}
                    {formatDate(round.contribution_deadline)}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={handleApplyRoundFees}
                disabled={!selectedRoundId || Boolean(actionLoading)}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-5 text-sm font-black text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {actionLoading === 'APPLY_ROUND_FEES' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <TimerReset className="h-4 w-4" />
                )}
                Apply Round Fees
              </button>
            </div>
          </div>

          <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-amber-800 shadow-sm">
            <div className="flex items-start gap-3">
              <ShieldAlert className="mt-1 h-5 w-5 shrink-0" />
              <div>
                <h2 className="font-black">Penalty rules</h2>
                <ul className="mt-3 space-y-2 text-sm font-semibold leading-6">
                  <li>• GH₵50 plan → GH₵5 late fee</li>
                  <li>• GH₵100 plan → GH₵10 late fee</li>
                  <li>• GH₵200 plan → GH₵20 late fee</li>
                  <li>• GH₵500 plan → GH₵50 late fee</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search member, phone, Fund Space, round, reference..."
                className="min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm font-semibold outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {(
                [
                  'ALL',
                  'PENDING',
                  'PAID',
                  'LATE',
                  'MISSED',
                  'FEE_APPLIED',
                  'FEE_PAID',
                  'FEE_WAIVED',
                ] as FilterStatus[]
              ).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setFilter(item)}
                  className={`min-h-11 rounded-2xl px-4 text-xs font-black transition ${
                    filter === item
                      ? 'bg-emerald-700 text-white'
                      : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {formatLabel(item)}
                </button>
              ))}

              <button
                type="button"
                onClick={() => loadRecords(true)}
                disabled={refreshing}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-xs font-black text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {refreshing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Refresh
              </button>
            </div>
          </div>
        </section>

        <section className="space-y-5">
          {filteredRecords.length === 0 ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
              <TimerReset className="mx-auto mb-3 h-12 w-12 text-slate-300" />
              <h2 className="text-lg font-black text-slate-900">
                No penalty records found
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                Try changing the filter or refreshing the page.
              </p>
            </div>
          ) : (
            filteredRecords.map((record) => {
              const canPayFee =
                Number(record.late_fee_amount || 0) > 0 &&
                record.late_fee_status === 'APPLIED';

              const canWaiveFee =
                Number(record.late_fee_amount || 0) > 0 &&
                record.late_fee_status === 'APPLIED';

              return (
                <article
                  key={record.id}
                  className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6"
                >
                  <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                    <div className="flex-1">
                      <div className="flex flex-wrap gap-2">
                        <StatusPill status={record.status} />
                        <StatusPill status={record.payment_timing} />
                        <StatusPill status={`Fee ${record.late_fee_status}`} />
                      </div>

                      <div className="mt-5 grid gap-5 lg:grid-cols-2">
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
                              label="Fund Space"
                              value={record.fund_space?.name}
                            />
                            <InfoBox
                              label="Round"
                              value={`Round ${record.round?.round_number || 'N/A'}`}
                            />
                            <InfoBox
                              label="Deadline"
                              value={formatDate(record.round?.contribution_deadline)}
                            />
                            <InfoBox
                              label="Paid At"
                              value={formatDateTime(record.paid_at)}
                            />
                          </div>
                        </div>

                        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                          <p className="mb-2 inline-flex items-center gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
                            <Banknote className="h-4 w-4" />
                            Payment & Penalty
                          </p>

                          <div className="grid gap-3 sm:grid-cols-2">
                            <InfoBox
                              label="Amount Due"
                              value={formatCurrency(record.amount_due)}
                            />
                            <InfoBox
                              label="Amount Paid"
                              value={formatCurrency(record.amount_paid)}
                            />
                            <InfoBox
                              label="Late Fee"
                              value={formatCurrency(record.late_fee_amount)}
                            />
                            <InfoBox
                              label="Late Fee Status"
                              value={formatLabel(record.late_fee_status)}
                            />
                            <InfoBox
                              label="Payment Method"
                              value={record.payment_method}
                            />
                            <InfoBox
                              label="Reference"
                              value={record.payment_reference}
                            />
                          </div>
                        </div>
                      </div>

                      {record.late_fee_waiver_reason && (
                        <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                          <p className="text-xs font-black uppercase tracking-wide text-emerald-600">
                            Waiver Reason
                          </p>
                          <p className="mt-2 text-sm font-semibold leading-6 text-emerald-700">
                            {record.late_fee_waiver_reason}
                          </p>
                        </div>
                      )}

                      <div className="mt-4 flex flex-wrap gap-3 text-xs font-semibold text-slate-500">
                        <span>Created: {formatDateTime(record.created_at)}</span>
                        <span>Updated: {formatDateTime(record.updated_at)}</span>
                        {record.penalty_applied_at && (
                          <span>
                            Penalty applied:{' '}
                            {formatDateTime(record.penalty_applied_at)}
                          </span>
                        )}
                        {record.late_fee_paid_at && (
                          <span>
                            Fee paid: {formatDateTime(record.late_fee_paid_at)}
                          </span>
                        )}
                        {record.late_fee_waived_at && (
                          <span>
                            Fee waived:{' '}
                            {formatDateTime(record.late_fee_waived_at)}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 xl:w-52 xl:grid-cols-1">
                      <button
                        type="button"
                        disabled={!canPayFee || Boolean(actionLoading)}
                        onClick={() =>
                          runPenaltyAction({
                            action: 'MARK_LATE_FEE_PAID',
                            contribution_id: record.id,
                          })
                        }
                        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-4 text-sm font-black text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {actionLoading === `MARK_LATE_FEE_PAID-${record.id}` ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <HandCoins className="h-4 w-4" />
                        )}
                        Mark Fee Paid
                      </button>

                      <button
                        type="button"
                        disabled={!canWaiveFee || Boolean(actionLoading)}
                        onClick={() => {
                          setWaiveContributionId(record.id);
                          setWaiverReason('');
                        }}
                        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 text-sm font-black text-amber-700 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <BadgeCheck className="h-4 w-4" />
                        Waive Fee
                      </button>
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </section>
      </div>

      {waiveContributionId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-black text-slate-900">
                  Waive Late Fee
                </h2>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  Enter a clear reason for waiving this member’s late fee.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setWaiveContributionId('');
                  setWaiverReason('');
                }}
                className="rounded-2xl p-2 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <textarea
              value={waiverReason}
              onChange={(event) => setWaiverReason(event.target.value)}
              rows={5}
              placeholder="Example: Member had a verified emergency and admin approved waiver."
              className="mt-5 w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-100"
            />

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  setWaiveContributionId('');
                  setWaiverReason('');
                }}
                className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-200 px-4 text-sm font-black text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleWaiveLateFee}
                disabled={Boolean(actionLoading)}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-amber-600 px-4 text-sm font-black text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {actionLoading === `WAIVE_LATE_FEE-${waiveContributionId}` ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <BadgeCheck className="h-4 w-4" />
                )}
                Waive Fee
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}