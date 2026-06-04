'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Banknote,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  Clock,
  Eye,
  HandCoins,
  Loader2,
  Phone,
  RefreshCw,
  Search,
  ShieldCheck,
  Smartphone,
  UserRound,
  Users,
  WalletCards,
  X,
  XCircle,
} from 'lucide-react';

import PayoutRiskCard from '@/components/fund-space/PayoutRiskCard';
import TrustShieldCard from '@/components/trust-shield/TrustShieldCard';
import { supabase } from '@/lib/supabase/client';

type PayoutStatus =
  | 'PENDING'
  | 'PENDING_ADMIN_APPROVAL'
  | 'READY_FOR_ADMIN_APPROVAL'
  | 'READY_FOR_PAYOUT'
  | 'APPROVED'
  | 'APPROVED_FOR_PAYOUT'
  | 'PAID'
  | 'REJECTED'
  | 'FAILED'
  | 'CANCELLED'
  | string;

type Payout = {
  id: string;
  fund_space_id: string;
  round_id: string;
  user_id?: string | null;
  recipient_user_id?: string | null;
  amount?: number | null;
  gross_amount?: number | null;
  net_amount?: number | null;
  platform_fee?: number | null;
  status: PayoutStatus;
  payout_method?: string | null;
  payout_reference?: string | null;
  approved_at: string | null;
  approved_by?: string | null;
  paid_at: string | null;
  paid_by?: string | null;
  rejection_reason?: string | null;
  failure_reason?: string | null;
  created_at: string | null;
  updated_at?: string | null;
};

type FundSpace = {
  id: string;
  name: string | null;
  contribution_amount: number | null;
  status: string | null;
  current_round_number?: number | null;
};

type Round = {
  id: string;
  fund_space_id?: string | null;
  round_number: number;
  due_date?: string | null;
  contribution_deadline?: string | null;
  week_start_date?: string | null;
  week_end_date?: string | null;
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
  registered_by_agent?: string | null;
  verification_status?: string | null;
  status?: string | null;
};

type AgentProfile = {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
};

type PayoutRow = Payout & {
  fund_space?: FundSpace | null;
  round?: Round | null;
  profile?: Profile | null;
  recipient?: Profile | null;
  agent?: AgentProfile | null;
};

type FilterStatus = 'ALL' | 'PENDING' | 'APPROVED' | 'PAID' | 'REJECTED';

type ActionType = 'APPROVE' | 'MARK_PAID' | 'REJECT';

function formatCurrency(amount: number | null | undefined) {
  return `GH₵${Number(amount || 0).toLocaleString('en-GH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(dateString: string | null | undefined) {
  if (!dateString) return 'Not set';

  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) return 'Invalid date';

  return date.toLocaleDateString('en-GH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatDateTime(dateString: string | null | undefined) {
  if (!dateString) return 'Not set';

  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) return 'Invalid date';

  return date.toLocaleString('en-GH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getGhanaWeekday() {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    timeZone: 'Africa/Accra',
  }).format(new Date());
}

function isFridayInGhana() {
  return getGhanaWeekday() === 'Friday';
}

function getPayoutAmount(payout: PayoutRow | null | undefined) {
  if (!payout) return 0;

  return Number(payout.net_amount ?? payout.amount ?? payout.gross_amount ?? 0);
}

function getGrossAmount(payout: PayoutRow | null | undefined) {
  if (!payout) return 0;

  return Number(payout.gross_amount ?? payout.amount ?? payout.net_amount ?? 0);
}

function getPayoutUserId(payout: Payout | null | undefined) {
  if (!payout) return '';

  return payout.recipient_user_id || payout.user_id || '';
}

function getRecipientProfile(payout: PayoutRow | null | undefined) {
  if (!payout) return null;

  return payout.profile || payout.recipient || null;
}

function getRoundDueDate(round: Round | null | undefined) {
  return round?.contribution_deadline || round?.due_date || null;
}

function getReadableStatus(status: string | null | undefined) {
  return String(status || 'PENDING')
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getStatusStyle(status: string | null | undefined) {
  const value = String(status || 'PENDING').toUpperCase();

  if (['PAID', 'COMPLETED', 'SUCCESS'].includes(value)) {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }

  if (['APPROVED', 'APPROVED_FOR_PAYOUT'].includes(value)) {
    return 'border-blue-200 bg-blue-50 text-blue-700';
  }

  if (
    [
      'PENDING',
      'PENDING_ADMIN_APPROVAL',
      'READY_FOR_ADMIN_APPROVAL',
      'READY_FOR_PAYOUT',
    ].includes(value)
  ) {
    return 'border-amber-200 bg-amber-50 text-amber-700';
  }

  if (['REJECTED', 'FAILED', 'CANCELLED'].includes(value)) {
    return 'border-red-200 bg-red-50 text-red-700';
  }

  return 'border-slate-200 bg-slate-50 text-slate-700';
}

function isPendingPayout(status: string | null | undefined) {
  const value = String(status || '').toUpperCase();

  return [
    'PENDING',
    'PENDING_ADMIN_APPROVAL',
    'READY_FOR_ADMIN_APPROVAL',
    'READY_FOR_PAYOUT',
  ].includes(value);
}

function canMarkPaid(status: string | null | undefined) {
  const value = String(status || '').toUpperCase();

  return ['APPROVED', 'APPROVED_FOR_PAYOUT'].includes(value);
}

function maskPhone(phone: string | null | undefined) {
  if (!phone) return 'No phone';

  const clean = phone.trim();

  if (clean.length <= 6) return clean;

  return `${clean.slice(0, 3)}****${clean.slice(-3)}`;
}

function SummaryCard({
  title,
  value,
  helper,
  icon,
  active,
  onClick,
}: {
  title: string;
  value: string | number;
  helper: string;
  icon: ReactNode;
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
        {icon}
      </div>

      <p className="text-sm font-bold text-slate-500">{title}</p>
      <h3 className="mt-1 text-2xl font-black text-slate-900">{value}</h3>
      <p className="mt-1 text-xs leading-5 text-slate-500">{helper}</p>
    </button>
  );
}

function DetailBox({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
      <p className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
        {icon}
        {label}
      </p>
      <p className="break-words text-sm font-bold text-slate-900">{value}</p>
    </div>
  );
}

function StatusPill({ status }: { status: string | null | undefined }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-black ${getStatusStyle(
        status
      )}`}
    >
      {getReadableStatus(status)}
    </span>
  );
}

function ApprovalGuidanceCard({
  fridayApprovalOpen,
  ghanaWeekday,
  selectedPayout,
}: {
  fridayApprovalOpen: boolean;
  ghanaWeekday: string;
  selectedPayout: PayoutRow;
}) {
  const status = String(selectedPayout.status || '').toUpperCase();

  return (
    <section
      className={`rounded-3xl border p-5 shadow-sm ${
        fridayApprovalOpen
          ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
          : 'border-amber-200 bg-amber-50 text-amber-800'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="rounded-2xl bg-white p-3">
          {fridayApprovalOpen ? (
            <CheckCircle2 className="h-6 w-6 text-emerald-700" />
          ) : (
            <AlertTriangle className="h-6 w-6 text-amber-700" />
          )}
        </div>

        <div className="flex-1">
          <p className="text-xs font-black uppercase tracking-wide opacity-80">
            Approval Guidance
          </p>

          <h2 className="mt-1 text-xl font-black">
            {fridayApprovalOpen
              ? 'Payout approval window is open'
              : 'Payout approval window is closed'}
          </h2>

          <p className="mt-2 text-sm font-semibold leading-6 opacity-90">
            {fridayApprovalOpen
              ? 'Today is Friday in Ghana. Admin can approve pending payouts after reviewing the Smart Payout Risk Card and Trust Shield.'
              : `Today is ${ghanaWeekday} in Ghana. This page keeps the approve button locked until Friday, but you can still review payout risk and recipient details.`}
          </p>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <DetailBox
              label="Current Status"
              value={getReadableStatus(status)}
              icon={<Clock className="h-4 w-4" />}
            />

            <DetailBox
              label="Approved At"
              value={formatDateTime(selectedPayout.approved_at)}
              icon={<BadgeCheck className="h-4 w-4" />}
            />

            <DetailBox
              label="Paid At"
              value={formatDateTime(selectedPayout.paid_at)}
              icon={<HandCoins className="h-4 w-4" />}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function PaymentCard({ selectedPayout }: { selectedPayout: PayoutRow }) {
  const recipient = getRecipientProfile(selectedPayout);

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
      <div className="mb-5 flex items-start gap-3">
        <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-700">
          <Smartphone className="h-6 w-6" />
        </div>

        <div>
          <h2 className="text-lg font-black text-slate-900">
            Payout Payment Details
          </h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            Use these details when paying the recipient manually through Mobile
            Money or bank transfer.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DetailBox
          label="MoMo Number"
          value={recipient?.momo_number || recipient?.phone || 'Not provided'}
          icon={<Phone className="h-4 w-4" />}
        />

        <DetailBox
          label="Payout Method"
          value={selectedPayout.payout_method || 'MOMO'}
          icon={<Smartphone className="h-4 w-4" />}
        />

        <DetailBox
          label="Bank Name"
          value={recipient?.bank_name || 'Not provided'}
          icon={<Banknote className="h-4 w-4" />}
        />

        <DetailBox
          label="Bank Account"
          value={
            recipient?.bank_account_number
              ? `${recipient.bank_account_name || 'Account'} • ${
                  recipient.bank_account_number
                }`
              : 'Not provided'
          }
          icon={<Banknote className="h-4 w-4" />}
        />
      </div>

      {(selectedPayout.payout_reference ||
        selectedPayout.rejection_reason ||
        selectedPayout.failure_reason) && (
        <div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50 p-4">
          <p className="text-xs font-black uppercase tracking-wide text-slate-500">
            Notes / References
          </p>

          {selectedPayout.payout_reference && (
            <p className="mt-2 text-sm font-semibold text-slate-700">
              Payout reference: {selectedPayout.payout_reference}
            </p>
          )}

          {selectedPayout.rejection_reason && (
            <p className="mt-2 text-sm font-semibold text-red-700">
              Rejection reason: {selectedPayout.rejection_reason}
            </p>
          )}

          {selectedPayout.failure_reason && (
            <p className="mt-2 text-sm font-semibold text-red-700">
              Failure reason: {selectedPayout.failure_reason}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

export default function AdminPayoutsPage() {
  const [payouts, setPayouts] = useState<PayoutRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [actionType, setActionType] = useState<ActionType | null>(null);

  const [selectedPayoutId, setSelectedPayoutId] = useState<string | null>(null);

  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('PENDING');

  const [rejectPayoutId, setRejectPayoutId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const fridayApprovalOpen = isFridayInGhana();
  const ghanaWeekday = getGhanaWeekday();

  const selectedPayout = useMemo(() => {
    if (!selectedPayoutId) return payouts[0] || null;

    return payouts.find((item) => item.id === selectedPayoutId) || null;
  }, [payouts, selectedPayoutId]);

  const stats = useMemo(() => {
    const pending = payouts.filter((item) => isPendingPayout(item.status));
    const approved = payouts.filter((item) =>
      ['APPROVED', 'APPROVED_FOR_PAYOUT'].includes(
        String(item.status || '').toUpperCase()
      )
    );
    const paid = payouts.filter(
      (item) => String(item.status || '').toUpperCase() === 'PAID'
    );
    const rejected = payouts.filter((item) =>
      ['REJECTED', 'FAILED', 'CANCELLED'].includes(
        String(item.status || '').toUpperCase()
      )
    );

    return {
      total: payouts.length,
      pending: pending.length,
      approved: approved.length,
      paid: paid.length,
      rejected: rejected.length,
      pendingValue: pending.reduce(
        (sum, item) => sum + Number(getPayoutAmount(item) || 0),
        0
      ),
      approvedValue: approved.reduce(
        (sum, item) => sum + Number(getPayoutAmount(item) || 0),
        0
      ),
      paidValue: paid.reduce(
        (sum, item) => sum + Number(getPayoutAmount(item) || 0),
        0
      ),
    };
  }, [payouts]);

  const filteredPayouts = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    return payouts.filter((payout) => {
      const status = String(payout.status || '').toUpperCase();
      const recipient = getRecipientProfile(payout);

      if (statusFilter === 'PENDING' && !isPendingPayout(status)) return false;
      if (
        statusFilter === 'APPROVED' &&
        !['APPROVED', 'APPROVED_FOR_PAYOUT'].includes(status)
      ) {
        return false;
      }
      if (statusFilter === 'PAID' && status !== 'PAID') return false;
      if (
        statusFilter === 'REJECTED' &&
        !['REJECTED', 'FAILED', 'CANCELLED'].includes(status)
      ) {
        return false;
      }

      if (!search) return true;

      const haystack = [
        recipient?.full_name,
        recipient?.phone,
        recipient?.email,
        payout.fund_space?.name,
        payout.round?.round_number ? `round ${payout.round.round_number}` : '',
        payout.payout_reference,
        payout.status,
        payout.id,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(search);
    });
  }, [payouts, searchTerm, statusFilter]);

  const loadPayouts = useCallback(async (showRefresh = false) => {
    try {
      if (showRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setErrorMessage('');
      setSuccessMessage('');

      const { data, error } = await supabase
        .from('fund_space_payouts')
        .select(
          `
          *,
          fund_space:fund_spaces (
            id,
            name,
            contribution_amount,
            status,
            current_round_number
          ),
          round:fund_space_rounds (
            id,
            fund_space_id,
            round_number,
            contribution_deadline,
            week_start_date,
            week_end_date,
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
            bank_account_name,
            registered_by_agent,
            verification_status,
            status
          )
        `
        )
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Payout relationship query warning:', error.message);
        await loadPayoutsFallback();
        return;
      }

      const rows = (data || []) as unknown as PayoutRow[];

      setPayouts(rows);
      setSelectedPayoutId((current) => {
        if (current && rows.some((item) => item.id === current)) return current;

        return rows[0]?.id || null;
      });
    } catch (error: unknown) {
      console.error('Admin payouts load error:', error);

      const message =
        error instanceof Error ? error.message : 'Unable to load payouts.';

      setErrorMessage(message);
      setPayouts([]);
      setSelectedPayoutId(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

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
      setSelectedPayoutId(null);
      return;
    }

    const fundSpaceIds = Array.from(
      new Set(basePayouts.map((item) => item.fund_space_id))
    ).filter(Boolean);

    const roundIds = Array.from(
      new Set(basePayouts.map((item) => item.round_id))
    ).filter(Boolean);

    const userIds = Array.from(
      new Set(basePayouts.map((item) => getPayoutUserId(item)))
    ).filter(Boolean);

    const [fundSpacesResponse, roundsResponse, profilesResponse] =
      await Promise.all([
        fundSpaceIds.length
          ? supabase
              .from('fund_spaces')
              .select('id, name, contribution_amount, status, current_round_number')
              .in('id', fundSpaceIds)
          : Promise.resolve({ data: [], error: null }),

        roundIds.length
          ? supabase
              .from('fund_space_rounds')
              .select(
                'id, fund_space_id, round_number, contribution_deadline, week_start_date, week_end_date, status'
              )
              .in('id', roundIds)
          : Promise.resolve({ data: [], error: null }),

        userIds.length
          ? supabase
              .from('profiles')
              .select(
                'id, full_name, phone, email, momo_number, bank_name, bank_account_number, bank_account_name, registered_by_agent, verification_status, status'
              )
              .in('id', userIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

    if (fundSpacesResponse.error) {
      console.warn(
        'Fund Spaces fallback warning:',
        fundSpacesResponse.error.message
      );
    }

    if (roundsResponse.error) {
      console.warn('Rounds fallback warning:', roundsResponse.error.message);
    }

    if (profilesResponse.error) {
      console.warn('Profiles fallback warning:', profilesResponse.error.message);
    }

    const fundSpaces = (fundSpacesResponse.data || []) as FundSpace[];
    const rounds = (roundsResponse.data || []) as Round[];
    const profiles = (profilesResponse.data || []) as Profile[];

    const rows: PayoutRow[] = basePayouts.map((payout) => ({
      ...payout,
      fund_space:
        fundSpaces.find((item) => item.id === payout.fund_space_id) || null,
      round: rounds.find((item) => item.id === payout.round_id) || null,
      profile:
        profiles.find((item) => item.id === getPayoutUserId(payout)) || null,
    }));

    setPayouts(rows);
    setSelectedPayoutId((current) => {
      if (current && rows.some((item) => item.id === current)) return current;

      return rows[0]?.id || null;
    });
  };

  useEffect(() => {
    loadPayouts();
  }, [loadPayouts]);

  async function handleApprovePayout(payout: PayoutRow) {
    if (!fridayApprovalOpen) {
      setErrorMessage(
        `Payout approvals are only allowed on Fridays. Today is ${ghanaWeekday} in Ghana.`
      );
      setSuccessMessage('');
      return;
    }

    const confirmed = window.confirm(
      'Have you reviewed the Smart Payout Risk Card and the recipient Trust Shield before approving this payout?'
    );

    if (!confirmed) return;

    try {
      setActionLoadingId(payout.id);
      setActionType('APPROVE');
      setErrorMessage('');
      setSuccessMessage('');

      const { error } = await supabase.rpc('approve_fund_space_payout', {
        p_payout_id: payout.id,
      });

      if (error) throw error;

      setSuccessMessage('Payout approved successfully.');
      await loadPayouts(true);
    } catch (error: unknown) {
      console.error('Approve payout error:', error);

      setErrorMessage(
        error instanceof Error ? error.message : 'Unable to approve payout.'
      );
    } finally {
      setActionLoadingId(null);
      setActionType(null);
    }
  }

  async function handleRejectPayout() {
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
      setActionType('REJECT');
      setErrorMessage('');
      setSuccessMessage('');

      const { error } = await supabase.rpc('reject_fund_space_payout', {
        p_payout_id: rejectPayoutId,
        p_reason: rejectReason.trim(),
      });

      if (error) throw error;

      setSuccessMessage('Payout rejected successfully.');
      setRejectPayoutId(null);
      setRejectReason('');
      await loadPayouts(true);
    } catch (error: unknown) {
      console.error('Reject payout error:', error);

      setErrorMessage(
        error instanceof Error ? error.message : 'Unable to reject payout.'
      );
    } finally {
      setActionLoadingId(null);
      setActionType(null);
    }
  }

  async function handleMarkAsPaid(payout: PayoutRow) {
    const reference = window.prompt(
      'Enter the MoMo payout transaction/reference number, or leave blank to continue without reference.'
    );

    try {
      setActionLoadingId(payout.id);
      setActionType('MARK_PAID');
      setErrorMessage('');
      setSuccessMessage('');

      const rpcClient = supabase as any;

      const { error } = await rpcClient.rpc('mark_fund_space_payout_paid', {
        p_payout_id: payout.id,
        p_payout_method: 'MOMO',
        p_payment_reference: reference?.trim() || null,
      });

      if (error) {
        const fallback = await rpcClient.rpc('mark_fund_space_payout_paid', {
          p_payout_id: payout.id,
          p_payout_method: 'MOMO',
        });

        if (fallback.error) throw fallback.error;
      }

      setSuccessMessage('Payout marked as paid successfully.');
      await loadPayouts(true);
    } catch (error: unknown) {
      console.error('Mark payout paid error:', error);

      setErrorMessage(
        error instanceof Error ? error.message : 'Unable to mark payout as paid.'
      );
    } finally {
      setActionLoadingId(null);
      setActionType(null);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-6 md:px-8">
        <div className="mx-auto flex min-h-[60vh] max-w-7xl items-center justify-center">
          <div className="text-center">
            <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-emerald-700" />
            <h1 className="text-lg font-black text-slate-900">
              Loading payout approvals...
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Please wait while TrustPoint loads payout records.
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
          <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-black">
                <HandCoins className="h-4 w-4" />
                Admin Payout Control
              </p>

              <h1 className="text-3xl font-black tracking-tight md:text-4xl">
                Payout Approvals
              </h1>

              <p className="mt-3 max-w-3xl text-sm leading-7 text-emerald-50">
                Review payout recipients, check Smart Payout Risk, inspect Trust
                Shield, approve payout, reject payout, or mark approved payout
                as paid.
              </p>

              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  href="/admin/fund-space"
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-white px-4 text-sm font-black text-emerald-700 transition hover:bg-emerald-50"
                >
                  Back to Fund Space
                  <ArrowRight className="h-4 w-4" />
                </Link>

                <Link
                  href="/admin"
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-white/15 px-4 text-sm font-black text-white ring-1 ring-white/20 transition hover:bg-white/20"
                >
                  Admin Dashboard
                </Link>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:w-[430px]">
              <div className="rounded-3xl bg-white/15 p-5 backdrop-blur">
                <p className="text-sm text-emerald-50">Pending Payout Value</p>
                <p className="mt-1 text-2xl font-black">
                  {formatCurrency(stats.pendingValue)}
                </p>
              </div>

              <div className="rounded-3xl bg-white/15 p-5 backdrop-blur">
                <p className="text-sm text-emerald-50">Today in Ghana</p>
                <p className="mt-1 text-2xl font-black">{ghanaWeekday}</p>
              </div>
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
          <SummaryCard
            title="Total"
            value={stats.total}
            helper="All payout records"
            icon={<WalletCards className="h-6 w-6" />}
            active={statusFilter === 'ALL'}
            onClick={() => setStatusFilter('ALL')}
          />

          <SummaryCard
            title="Pending"
            value={stats.pending}
            helper="Needs admin review"
            icon={<Clock className="h-6 w-6" />}
            active={statusFilter === 'PENDING'}
            onClick={() => setStatusFilter('PENDING')}
          />

          <SummaryCard
            title="Approved"
            value={stats.approved}
            helper="Ready to pay"
            icon={<BadgeCheck className="h-6 w-6" />}
            active={statusFilter === 'APPROVED'}
            onClick={() => setStatusFilter('APPROVED')}
          />

          <SummaryCard
            title="Paid"
            value={stats.paid}
            helper="Completed payouts"
            icon={<CircleDollarSign className="h-6 w-6" />}
            active={statusFilter === 'PAID'}
            onClick={() => setStatusFilter('PAID')}
          />

          <SummaryCard
            title="Rejected"
            value={stats.rejected}
            helper="Rejected or failed"
            icon={<XCircle className="h-6 w-6" />}
            active={statusFilter === 'REJECTED'}
            onClick={() => setStatusFilter('REJECTED')}
          />
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search recipient, phone, Fund Space, round, reference..."
                className="min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm font-semibold outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {(['ALL', 'PENDING', 'APPROVED', 'PAID', 'REJECTED'] as FilterStatus[]).map(
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
                    {getReadableStatus(status)}
                  </button>
                )
              )}

              <button
                type="button"
                onClick={() => loadPayouts(true)}
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

        <section className="grid gap-6 xl:grid-cols-[420px_1fr]">
          <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 p-5">
              <h2 className="text-lg font-black text-slate-900">
                Payout Requests
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Showing {filteredPayouts.length} payout records.
              </p>
            </div>

            <div className="max-h-[760px] overflow-y-auto">
              {filteredPayouts.length === 0 ? (
                <div className="p-8 text-center">
                  <HandCoins className="mx-auto mb-3 h-10 w-10 text-slate-300" />
                  <h3 className="text-sm font-black text-slate-700">
                    No payout records found
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    Try changing the filter or refreshing the page.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {filteredPayouts.map((payout) => {
                    const recipient = getRecipientProfile(payout);
                    const selected = selectedPayout?.id === payout.id;

                    return (
                      <button
                        key={payout.id}
                        type="button"
                        onClick={() => setSelectedPayoutId(payout.id)}
                        className={`w-full p-4 text-left transition ${
                          selected
                            ? 'bg-emerald-50'
                            : 'bg-white hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-black text-slate-900">
                              {recipient?.full_name || 'Unknown recipient'}
                            </p>
                            <p className="mt-1 text-xs font-semibold text-slate-500">
                              {maskPhone(recipient?.phone)} •{' '}
                              {payout.fund_space?.name || 'Fund Space'}
                            </p>
                          </div>

                          <StatusPill status={payout.status} />
                        </div>

                        <div className="mt-3 flex items-center justify-between">
                          <p className="text-sm font-black text-emerald-700">
                            {formatCurrency(getPayoutAmount(payout))}
                          </p>

                          <p className="text-xs font-semibold text-slate-500">
                            Round {payout.round?.round_number || 'N/A'}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            {!selectedPayout ? (
              <section className="rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
                <HandCoins className="mx-auto mb-3 h-12 w-12 text-slate-300" />
                <h2 className="text-lg font-black text-slate-900">
                  Select a payout request
                </h2>
                <p className="mt-2 text-sm text-slate-500">
                  Choose a payout from the list to review details, risk, Trust
                  Shield, and approval actions.
                </p>
              </section>
            ) : (
              <>
                <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
                  <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                    <div>
                      <p className="mb-2 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">
                        <UserRound className="h-4 w-4" />
                        Payout Recipient
                      </p>

                      <h2 className="text-2xl font-black text-slate-900">
                        {getRecipientProfile(selectedPayout)?.full_name ||
                          'Unknown recipient'}
                      </h2>

                      <p className="mt-2 text-sm font-semibold text-slate-500">
                        {getRecipientProfile(selectedPayout)?.phone ||
                          'No phone'}{' '}
                        •{' '}
                        {getRecipientProfile(selectedPayout)?.email ||
                          'No email'}
                      </p>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <StatusPill status={selectedPayout.status} />

                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-black ${getStatusStyle(
                            getRecipientProfile(selectedPayout)?.verification_status
                          )}`}
                        >
                          Verification:{' '}
                          {getReadableStatus(
                            getRecipientProfile(selectedPayout)
                              ?.verification_status
                          )}
                        </span>

                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-black ${getStatusStyle(
                            selectedPayout.fund_space?.status
                          )}`}
                        >
                          Group:{' '}
                          {getReadableStatus(selectedPayout.fund_space?.status)}
                        </span>
                      </div>
                    </div>

                    <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-5 xl:min-w-72">
                      <p className="text-xs font-black uppercase tracking-wide text-emerald-700">
                        Net Payout
                      </p>
                      <p className="mt-1 text-3xl font-black text-emerald-900">
                        {formatCurrency(getPayoutAmount(selectedPayout))}
                      </p>
                      <p className="mt-2 text-xs font-semibold text-emerald-700">
                        Gross: {formatCurrency(getGrossAmount(selectedPayout))}{' '}
                        • Fee:{' '}
                        {formatCurrency(Number(selectedPayout.platform_fee || 0))}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <DetailBox
                      label="Fund Space"
                      value={selectedPayout.fund_space?.name || 'Not set'}
                      icon={<Users className="h-4 w-4" />}
                    />

                    <DetailBox
                      label="Round"
                      value={`Round ${
                        selectedPayout.round?.round_number || 'N/A'
                      }`}
                      icon={<CalendarClock className="h-4 w-4" />}
                    />

                    <DetailBox
                      label="Deadline"
                      value={formatDate(getRoundDueDate(selectedPayout.round))}
                      icon={<Clock className="h-4 w-4" />}
                    />

                    <DetailBox
                      label="Created"
                      value={formatDateTime(selectedPayout.created_at)}
                      icon={<CalendarClock className="h-4 w-4" />}
                    />
                  </div>

                  <div className="mt-6 grid gap-3 sm:grid-cols-3">
                    <button
                      type="button"
                      disabled={
                        !fridayApprovalOpen ||
                        !isPendingPayout(selectedPayout.status) ||
                        Boolean(actionLoadingId)
                      }
                      onClick={() => handleApprovePayout(selectedPayout)}
                      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-4 text-sm font-black text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {actionLoadingId === selectedPayout.id &&
                      actionType === 'APPROVE' ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4" />
                      )}
                      Approve
                    </button>

                    <button
                      type="button"
                      disabled={
                        !canMarkPaid(selectedPayout.status) ||
                        Boolean(actionLoadingId)
                      }
                      onClick={() => handleMarkAsPaid(selectedPayout)}
                      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {actionLoadingId === selectedPayout.id &&
                      actionType === 'MARK_PAID' ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <HandCoins className="h-4 w-4" />
                      )}
                      Mark Paid
                    </button>

                    <button
                      type="button"
                      disabled={
                        !isPendingPayout(selectedPayout.status) ||
                        Boolean(actionLoadingId)
                      }
                      onClick={() => {
                        setRejectPayoutId(selectedPayout.id);
                        setRejectReason('');
                      }}
                      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 text-sm font-black text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <XCircle className="h-4 w-4" />
                      Reject
                    </button>
                  </div>
                </section>

                <PayoutRiskCard payoutId={selectedPayout.id} />

                <TrustShieldCard
                  userId={getPayoutUserId(selectedPayout)}
                  title="Recipient Trust Shield"
                  subtitle="This recipient’s TrustPoint reliability profile before payout approval."
                />

                <ApprovalGuidanceCard
                  fridayApprovalOpen={fridayApprovalOpen}
                  ghanaWeekday={ghanaWeekday}
                  selectedPayout={selectedPayout}
                />

                <PaymentCard selectedPayout={selectedPayout} />

                <section className="rounded-3xl border border-blue-200 bg-blue-50 p-5 text-blue-800 shadow-sm">
                  <div className="flex items-start gap-3">
                    <ShieldCheck className="mt-1 h-5 w-5 shrink-0" />
                    <div>
                      <h3 className="font-black">Final admin checklist</h3>
                      <ul className="mt-3 space-y-2 text-sm font-semibold leading-6">
                        <li>• Check the Smart Payout Risk result.</li>
                        <li>• Confirm the recipient Trust Shield score.</li>
                        <li>• Confirm the payout amount and payout recipient.</li>
                        <li>• Confirm Mobile Money or bank details before paying.</li>
                        <li>• Approve first, then mark paid after real payment is done.</li>
                      </ul>
                    </div>
                  </div>
                </section>
              </>
            )}
          </div>
        </section>
      </div>

      {rejectPayoutId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-black text-slate-900">
                  Reject Payout
                </h2>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  Enter a clear reason. This reason may be saved for audit and
                  notification purposes.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setRejectPayoutId(null);
                  setRejectReason('');
                }}
                className="rounded-2xl p-2 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <textarea
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
              rows={5}
              placeholder="Example: Recipient has unresolved payment issue or payout details are not confirmed."
              className="mt-5 w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-100"
            />

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  setRejectPayoutId(null);
                  setRejectReason('');
                }}
                className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-200 px-4 text-sm font-black text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleRejectPayout}
                disabled={Boolean(actionLoadingId)}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-red-700 px-4 text-sm font-black text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {actionType === 'REJECT' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                Reject Payout
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}