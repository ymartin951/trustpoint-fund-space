'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Banknote,
  CheckCircle2,
  Clock,
  Eye,
  Loader2,
  RefreshCw,
  ShieldCheck,
  UserRound,
  Users,
  WalletCards,
  X,
  XCircle,
} from 'lucide-react';

import { supabase } from '@/lib/supabase/client';

type TransparencySummary = {
  fund_space_id: string;
  fund_space_name: string | null;
  fund_space_status: string | null;
  contribution_amount: number | string | null;
  member_limit: number | null;
  current_round_number: number | null;

  total_members: number;
  active_members: number;
  members_paid_out: number;
  defaulted_members: number;

  current_round_id: string | null;
  round_number: number | null;
  current_round_status: string | null;
  week_start_date: string | null;
  contribution_deadline: string | null;
  week_end_date: string | null;
  expected_total_amount: number | string | null;

  current_recipient_user_id: string | null;
  current_recipient_name: string | null;
  current_recipient_phone: string | null;

  total_contributions: number;
  paid_contributions: number;
  unpaid_contributions: number;
  late_contributions: number;
  total_due: number | string;
  total_paid: number | string;
  total_late_fees: number | string;
  payment_progress_percent: number | string;

  payout_id: string | null;
  payout_status: string | null;
  payout_gross_amount: number | string | null;
  payout_platform_fee: number | string | null;
  payout_net_amount: number | string | null;
  payout_approved_at: string | null;
  payout_paid_at: string | null;
  payout_method: string | null;
  payout_reference: string | null;

  next_round_id: string | null;
  next_round_number: number | null;
  next_recipient_user_id: string | null;
  next_recipient_name: string | null;
  next_recipient_phone: string | null;
  next_week_start_date: string | null;
  next_contribution_deadline: string | null;
  next_round_status: string | null;

  transparency_status: string | null;
};

type RoundMember = {
  fund_space_id: string;
  fund_space_name: string | null;
  current_round_number: number | null;

  round_id: string;
  round_number: number;
  round_status: string | null;
  week_start_date: string | null;
  contribution_deadline: string | null;
  week_end_date: string | null;

  membership_id: string;
  user_id: string;
  full_name: string | null;
  phone: string | null;
  role: string | null;
  verification_status: string | null;

  position_number: number | null;
  payout_order: number | null;
  member_status: string | null;
  has_received_payout: boolean | null;
  received_round_number: number | null;

  contribution_id: string | null;
  amount_due: number | string | null;
  amount_paid: number | string | null;
  contribution_status: string | null;
  payment_method: string | null;
  payment_reference: string | null;
  paid_at: string | null;
  payment_timing: string | null;
  is_late: boolean | null;
  late_fee_amount: number | string | null;
  late_fee_status: string | null;
  late_fee_paid_at: string | null;

  is_current_payout_recipient: boolean;
  has_paid_current_round: boolean;
};

type RoundHistory = {
  round_id: string;
  round_number: number;
  round_status: string | null;
  week_start_date: string | null;
  contribution_deadline: string | null;
  week_end_date: string | null;
  recipient_name: string | null;
  recipient_phone: string | null;
  total_members: number;
  paid_members: number;
  unpaid_members: number;
  late_members: number;
  total_due: number;
  total_paid: number;
  members: RoundMember[];
};

type ApiResponse = {
  success: boolean;
  message?: string;
  transparency?: TransparencySummary;
  current_members?: RoundMember[];
  round_history?: RoundHistory[];
};

type FundSpaceTransparencyDashboardProps = {
  fundSpaceId: string;
  compact?: boolean;
};

function normalize(value: string | null | undefined) {
  return String(value || '').trim().toUpperCase();
}

function toNumber(value: number | string | null | undefined) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCurrency(value: number | string | null | undefined) {
  return `GH₵${toNumber(value).toLocaleString('en-GH', {
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

function getStatusStyle(status: string | null | undefined) {
  const value = normalize(status);

  if (['PAID', 'RESOLVED', 'COMPLETED', 'COLLECTING'].includes(value)) {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }

  if (
    [
      'READY_FOR_ADMIN_APPROVAL',
      'APPROVED_FOR_PAYOUT',
      'PENDING_ADMIN_APPROVAL',
      'PENDING',
      'UNDER_REVIEW',
    ].includes(value)
  ) {
    return 'border-amber-200 bg-amber-50 text-amber-700';
  }

  if (['FAILED', 'REJECTED', 'CANCELLED', 'DEFAULTED', 'OVERDUE'].includes(value)) {
    return 'border-red-200 bg-red-50 text-red-700';
  }

  if (['LATE', 'APPLIED'].includes(value)) {
    return 'border-orange-200 bg-orange-50 text-orange-700';
  }

  return 'border-slate-200 bg-slate-50 text-slate-700';
}

function getProgressPercent(summary: TransparencySummary | null) {
  if (!summary) return 0;

  const progress = toNumber(summary.payment_progress_percent);
  return Math.max(0, Math.min(progress, 100));
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

function StatusPill({ status }: { status: string | null | undefined }) {
  return (
    <span
      className={`inline-flex max-w-full rounded-full border px-3 py-1 text-xs font-black ${getStatusStyle(
        status
      )}`}
    >
      <span className="truncate">{formatLabel(status)}</span>
    </span>
  );
}

function CompactInfo({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  return (
    <div className="min-w-0">
      <p className="truncate text-[11px] font-black uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="truncate text-sm font-black text-slate-900">
        {value ?? 'Not set'}
      </p>
    </div>
  );
}

function SummaryItem({
  label,
  value,
  helper,
  icon,
}: {
  label: string;
  value: string | number;
  helper?: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-white/15 bg-white/10 p-3">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-black uppercase tracking-wide text-emerald-50/80">
            {label}
          </p>
          <p className="mt-1 truncate text-lg font-black text-white md:text-xl">
            {value}
          </p>
          {helper && (
            <p className="mt-1 truncate text-xs font-semibold text-emerald-50/70">
              {helper}
            </p>
          )}
        </div>

        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-white">
          {icon}
        </div>
      </div>
    </div>
  );
}

export function FundSpaceTransparencyDashboard({
  fundSpaceId,
  compact = false,
}: FundSpaceTransparencyDashboardProps) {
  const [summary, setSummary] = useState<TransparencySummary | null>(null);
  const [members, setMembers] = useState<RoundMember[]>([]);
  const [roundHistory, setRoundHistory] = useState<RoundHistory[]>([]);
  const [selectedMember, setSelectedMember] = useState<RoundMember | null>(null);
  const [selectedRound, setSelectedRound] = useState<RoundHistory | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const loadTransparency = useCallback(
    async (showRefresh = false) => {
      try {
        if (showRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setErrorMessage('');

        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError || !session?.access_token) {
          throw new Error('Your session has expired. Please log in again.');
        }

        const params = new URLSearchParams();
        params.set('fund_space_id', fundSpaceId);

        const response = await fetch(`/api/fund-space/transparency?${params.toString()}`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        const result = await readApiResponse(response);

        if (!response.ok || !result.success) {
          throw new Error(result.message || 'Unable to load transparency dashboard.');
        }

        setSummary(result.transparency || null);
        setMembers(result.current_members || []);
        setRoundHistory(result.round_history || []);
      } catch (error) {
        setSummary(null);
        setMembers([]);
        setRoundHistory([]);
        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'Unable to load transparency dashboard.'
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [fundSpaceId]
  );

  useEffect(() => {
    if (fundSpaceId) {
      loadTransparency();
    }
  }, [fundSpaceId, loadTransparency]);

  const paidMembers = useMemo(() => {
    return members.filter((member) => member.has_paid_current_round);
  }, [members]);

  const unpaidMembers = useMemo(() => {
    return members.filter((member) => !member.has_paid_current_round);
  }, [members]);

  const progressPercent = getProgressPercent(summary);

  if (loading) {
    return (
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-center py-8">
          <div className="text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-emerald-700" />
            <p className="mt-3 text-sm font-black text-slate-600">
              Loading group transparency...
            </p>
          </div>
        </div>
      </section>
    );
  }

  if (errorMessage) {
    return (
      <section className="rounded-3xl border border-red-200 bg-red-50 p-5 text-red-700">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <div className="min-w-0">
            <h2 className="text-base font-black">Unable to load transparency</h2>
            <p className="mt-2 break-words text-sm font-semibold leading-6">
              {errorMessage}
            </p>
          </div>
        </div>
      </section>
    );
  }

  if (!summary) {
    return (
      <section className="rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <WalletCards className="mx-auto h-10 w-10 text-slate-300" />
        <h2 className="mt-4 text-lg font-black text-slate-900">
          No transparency data found
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          This Fund Space has no active transparency record yet.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-5">
      <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-900 via-emerald-800 to-teal-800 text-white shadow-sm">
        <div className="p-5 md:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <p className="inline-flex rounded-full bg-white/15 px-3 py-1 text-xs font-black">
                Live Group Transparency
              </p>

              <h2 className="mt-3 text-2xl font-black tracking-tight md:text-3xl">
                Round {summary.current_round_number || summary.round_number || '—'} Status
              </h2>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-emerald-50">
                {summary.fund_space_name || 'Fund Space'} · Current payout recipient:{' '}
                <span className="font-black">
                  {summary.current_recipient_name || 'Not set'}
                </span>
              </p>
            </div>

            <button
              type="button"
              onClick={() => loadTransparency(true)}
              disabled={refreshing}
              className="inline-flex min-h-11 w-fit items-center justify-center gap-2 rounded-2xl bg-white px-4 text-xs font-black text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
            <SummaryItem
              label="Members"
              value={`${summary.total_members}/${summary.member_limit || summary.total_members}`}
              helper="Group size"
              icon={<Users className="h-4 w-4" />}
            />
            <SummaryItem
              label="Paid"
              value={summary.paid_contributions}
              helper={`${summary.unpaid_contributions} unpaid`}
              icon={<CheckCircle2 className="h-4 w-4" />}
            />
            <SummaryItem
              label="Collected"
              value={formatCurrency(summary.total_paid)}
              helper={`Expected ${formatCurrency(summary.total_due)}`}
              icon={<HandCoinsIcon />}
            />
            <SummaryItem
              label="Deadline"
              value={formatDate(summary.contribution_deadline)}
              helper="Contribution closes"
              icon={<Clock className="h-4 w-4" />}
            />
            <SummaryItem
              label="Payout"
              value={formatLabel(summary.payout_status || summary.current_round_status)}
              helper={formatCurrency(summary.payout_net_amount || summary.expected_total_amount)}
              icon={<Banknote className="h-4 w-4" />}
            />
            <SummaryItem
              label="Next Recipient"
              value={summary.next_recipient_name || 'Not set'}
              helper={
                summary.next_round_number ? `Round ${summary.next_round_number}` : 'Next round'
              }
              icon={<ArrowRight className="h-4 w-4" />}
            />
          </div>

          <div className="mt-5 rounded-3xl border border-white/15 bg-white/10 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-black text-white">Payment Progress</p>
                <p className="mt-1 text-xs font-semibold text-emerald-50/75">
                  {summary.paid_contributions} of {summary.total_contributions} members have paid
                  this round.
                </p>
              </div>

              <p className="shrink-0 text-xl font-black text-white">
                {progressPercent.toFixed(0)}%
              </p>
            </div>

            <div className="mt-3 h-3 overflow-hidden rounded-full bg-white/15">
              <div
                className="h-full rounded-full bg-white"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <div className="space-y-3">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <h3 className="text-lg font-black text-slate-900">
                  Current Round Members
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  See who has paid, who has not paid, and who is receiving payout.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <StatusPill status={summary.current_round_status} />
                <StatusPill status={summary.transparency_status} />
              </div>
            </div>
          </div>

          {members.length === 0 ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
              <Users className="mx-auto h-10 w-10 text-slate-300" />
              <h3 className="mt-4 text-lg font-black text-slate-900">
                No member records found
              </h3>
              <p className="mt-2 text-sm text-slate-500">
                Current round member records will appear here.
              </p>
            </div>
          ) : (
            members.map((member) => (
              <article
                key={`${member.round_id}-${member.user_id}`}
                className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:border-emerald-200 hover:shadow-md"
              >
                <div className="grid gap-4 p-4 xl:grid-cols-[1fr_auto] xl:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap gap-2">
                      <StatusPill status={member.contribution_status || 'PENDING'} />
                      <StatusPill status={member.payment_timing || 'PENDING'} />
                      {member.is_current_payout_recipient && (
                        <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">
                          Payout Recipient
                        </span>
                      )}
                      {member.has_received_payout && (
                        <span className="inline-flex rounded-full border border-purple-200 bg-purple-50 px-3 py-1 text-xs font-black text-purple-700">
                          Received Before
                        </span>
                      )}
                    </div>

                    <div className="mt-3 flex items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                        <UserRound className="h-5 w-5" />
                      </div>

                      <div className="min-w-0">
                        <h4 className="line-clamp-2 break-words text-base font-black leading-6 text-slate-900">
                          {member.full_name || 'Unknown member'}
                        </h4>

                        <p className="mt-1 truncate text-sm font-semibold text-slate-500">
                          {member.phone || 'No phone'} · Payout order{' '}
                          {member.payout_order || '—'}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <CompactInfo label="Amount Due" value={formatCurrency(member.amount_due)} />
                      <CompactInfo label="Amount Paid" value={formatCurrency(member.amount_paid)} />
                      <CompactInfo label="Paid At" value={formatDateTime(member.paid_at)} />
                      <CompactInfo
                        label="Late Fee"
                        value={`${formatCurrency(member.late_fee_amount)} · ${formatLabel(
                          member.late_fee_status
                        )}`}
                      />
                    </div>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2 xl:w-48 xl:grid-cols-1">
                    <button
                      type="button"
                      onClick={() => setSelectedMember(member)}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-4 text-sm font-black text-white hover:bg-emerald-800"
                    >
                      <Eye className="h-4 w-4" />
                      View
                    </button>

                    {member.has_paid_current_round ? (
                      <div className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 text-sm font-black text-emerald-700">
                        <CheckCircle2 className="h-4 w-4" />
                        Paid
                      </div>
                    ) : (
                      <div className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 text-sm font-black text-amber-700">
                        <Clock className="h-4 w-4" />
                        Waiting
                      </div>
                    )}
                  </div>
                </div>
              </article>
            ))
          )}
        </div>

        <aside className="space-y-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-black text-slate-900">Quick Summary</h3>

            <div className="mt-4 space-y-4">
              <CompactInfo label="Current Recipient" value={summary.current_recipient_name || 'Not set'} />
              <CompactInfo label="Recipient Phone" value={summary.current_recipient_phone || 'No phone'} />
              <CompactInfo label="Week Start" value={formatDate(summary.week_start_date)} />
              <CompactInfo label="Week End" value={formatDate(summary.week_end_date)} />
              <CompactInfo label="Late Members" value={summary.late_contributions} />
              <CompactInfo label="Late Fees" value={formatCurrency(summary.total_late_fees)} />
              <CompactInfo label="Next Recipient" value={summary.next_recipient_name || 'Not set'} />
              <CompactInfo label="Next Deadline" value={formatDate(summary.next_contribution_deadline)} />
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-black text-slate-900">Round History</h3>
            <p className="mt-1 text-sm text-slate-500">
              Tap a round to see its payment summary.
            </p>

            <div className="mt-4 space-y-2">
              {roundHistory.slice(0, compact ? 4 : 10).map((round) => (
                <button
                  key={round.round_id}
                  type="button"
                  onClick={() => setSelectedRound(round)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-3 text-left transition hover:border-emerald-200 hover:bg-emerald-50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-slate-900">
                        Round {round.round_number}
                      </p>
                      <p className="mt-1 truncate text-xs font-semibold text-slate-500">
                        Recipient: {round.recipient_name || 'Not set'}
                      </p>
                    </div>

                    <StatusPill status={round.round_status} />
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-bold text-slate-600">
                    <p>Paid: {round.paid_members}</p>
                    <p>Unpaid: {round.unpaid_members}</p>
                    <p>Due: {formatCurrency(round.total_due)}</p>
                    <p>Paid: {formatCurrency(round.total_paid)}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </aside>
      </div>

      {selectedMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-3 py-4">
          <div className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
              <div className="min-w-0">
                <h3 className="text-lg font-black text-slate-900">Member Payment Details</h3>
                <p className="mt-1 truncate text-sm text-slate-500">
                  {selectedMember.full_name || 'Unknown member'}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedMember(null)}
                className="rounded-2xl p-2 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <CompactInfo label="Phone" value={selectedMember.phone || 'No phone'} />
                <CompactInfo label="Payout Order" value={selectedMember.payout_order || 'Not set'} />
                <CompactInfo label="Member Status" value={formatLabel(selectedMember.member_status)} />
                <CompactInfo label="Contribution Status" value={formatLabel(selectedMember.contribution_status)} />
                <CompactInfo label="Amount Due" value={formatCurrency(selectedMember.amount_due)} />
                <CompactInfo label="Amount Paid" value={formatCurrency(selectedMember.amount_paid)} />
                <CompactInfo label="Payment Timing" value={formatLabel(selectedMember.payment_timing)} />
                <CompactInfo label="Paid At" value={formatDateTime(selectedMember.paid_at)} />
                <CompactInfo label="Reference" value={selectedMember.payment_reference || 'None'} />
                <CompactInfo label="Late Fee Status" value={formatLabel(selectedMember.late_fee_status)} />
                <CompactInfo label="Late Fee Amount" value={formatCurrency(selectedMember.late_fee_amount)} />
                <CompactInfo
                  label="Received Payout Before"
                  value={selectedMember.has_received_payout ? 'Yes' : 'No'}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedRound && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-3 py-4">
          <div className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
              <div className="min-w-0">
                <h3 className="text-lg font-black text-slate-900">
                  Round {selectedRound.round_number} History
                </h3>
                <p className="mt-1 truncate text-sm text-slate-500">
                  Recipient: {selectedRound.recipient_name || 'Not set'}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedRound(null)}
                className="rounded-2xl p-2 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <CompactInfo label="Status" value={formatLabel(selectedRound.round_status)} />
                <CompactInfo label="Paid Members" value={selectedRound.paid_members} />
                <CompactInfo label="Unpaid Members" value={selectedRound.unpaid_members} />
                <CompactInfo label="Late Members" value={selectedRound.late_members} />
                <CompactInfo label="Total Due" value={formatCurrency(selectedRound.total_due)} />
                <CompactInfo label="Total Paid" value={formatCurrency(selectedRound.total_paid)} />
                <CompactInfo label="Deadline" value={formatDate(selectedRound.contribution_deadline)} />
                <CompactInfo label="Week End" value={formatDate(selectedRound.week_end_date)} />
              </div>

              <div className="mt-5 space-y-2">
                {selectedRound.members.map((member) => (
                  <div
                    key={`${selectedRound.round_id}-${member.user_id}`}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-3"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-slate-900">
                          {member.full_name || 'Unknown member'}
                        </p>
                        <p className="truncate text-xs font-semibold text-slate-500">
                          {member.phone || 'No phone'}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <StatusPill status={member.contribution_status || 'PENDING'} />
                        <StatusPill status={member.payment_timing || 'PENDING'} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function HandCoinsIcon() {
  return <ShieldCheck className="h-4 w-4" />;
}

export default FundSpaceTransparencyDashboard;