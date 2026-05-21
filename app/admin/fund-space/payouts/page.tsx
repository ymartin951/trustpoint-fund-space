'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  Clock,
  HandCoins,
  Loader2,
  RefreshCw,
  Search,
  Smartphone,
  UserRound,
  Users,
  WalletCards,
  XCircle,
} from 'lucide-react';

import { supabase } from '@/lib/supabase/client';

type PayoutStatus =
  | 'PENDING'
  | 'PENDING_ADMIN_APPROVAL'
  | 'APPROVED'
  | 'PAID'
  | 'REJECTED'
  | 'FAILED'
  | 'CANCELLED'
  | string;

type PayoutMethod = 'MOMO' | 'BANK_TRANSFER' | 'CASH_AGENT' | 'MANUAL_ADMIN';

type DeliveryMode = 'DIRECT_CUSTOMER' | 'AGENT_ASSISTED';

type Payout = {
  id: string;
  fund_space_id: string;
  round_id: string;
  recipient_user_id: string;
  gross_amount: number;
  net_amount: number;
  platform_fee: number;
  status: PayoutStatus;
  payout_method: string | null;
  payout_reference: string | null;
  approved_at: string | null;
  approved_by: string | null;
  paid_at: string | null;
  paid_by: string | null;
  rejection_reason: string | null;
  failure_reason: string | null;
  created_at: string | null;
  updated_at: string | null;
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
  contribution_deadline: string | null;
  week_start_date: string | null;
  week_end_date: string | null;
  status: string | null;
};

type Profile = {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  momo_number: string | null;
  bank_name: string | null;
  bank_account_number: string | null;
  bank_account_name: string | null;
  registered_by_agent?: string | null;
};

type AgentProfile = {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
};

type AgentRelationship = {
  id: string;
  agent_id: string;
  customer_id: string;
  relationship_status: string;
};

type PayoutRow = Payout & {
  fund_space: FundSpace | null;
  round: Round | null;
  profile: Profile | null;
  agent_relationship: AgentRelationship | null;
  assigned_agent: AgentProfile | null;
};

type ApiResponse = {
  success?: boolean;
  message?: string;
};

type MarkPaidDraft = {
  payout: PayoutRow;
  deliveryMode: DeliveryMode;
  payoutMethod: PayoutMethod;
  paymentReference: string;
  note: string;
};

function formatCurrency(amount: number | null | undefined) {
  return `GH₵${Number(amount || 0).toLocaleString('en-GH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(dateString: string | null | undefined) {
  if (!dateString) return 'Not set';

  return new Date(dateString).toLocaleDateString('en-GH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function getReadableStatus(status: string | null | undefined) {
  return String(status || 'PENDING')
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getStatusStyle(status: string | null | undefined) {
  const value = String(status || 'PENDING').toUpperCase();

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

function getPayoutAmount(payout: PayoutRow) {
  return Number(payout.net_amount || payout.gross_amount || 0);
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

function hasCustomerMomo(payout: PayoutRow) {
  return Boolean(payout.profile?.momo_number?.trim());
}

function hasCustomerBank(payout: PayoutRow) {
  return Boolean(
    payout.profile?.bank_name?.trim() ||
      payout.profile?.bank_account_number?.trim() ||
      payout.profile?.bank_account_name?.trim()
  );
}

function buildPayoutReference(draft: MarkPaidDraft) {
  const parts = [
    `delivery=${draft.deliveryMode}`,
    `method=${draft.payoutMethod}`,
    draft.paymentReference.trim()
      ? `reference=${draft.paymentReference.trim()}`
      : null,
    draft.payout.profile?.full_name
      ? `recipient=${draft.payout.profile.full_name}`
      : null,
    draft.payout.profile?.phone
      ? `recipient_phone=${draft.payout.profile.phone}`
      : null,
    draft.payout.assigned_agent
      ? `agent=${draft.payout.assigned_agent.full_name || draft.payout.assigned_agent.id}`
      : null,
    draft.note.trim() ? `note=${draft.note.trim()}` : null,
  ].filter(Boolean);

  return parts.join(' | ');
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

  const [markPaidDraft, setMarkPaidDraft] = useState<MarkPaidDraft | null>(null);

  const fridayApprovalOpen = isFridayInGhana();
  const ghanaWeekday = getGhanaWeekday();

  const getAccessToken = async () => {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error || !session?.access_token) {
      throw new Error('Your session has expired. Please login again.');
    }

    return session.access_token;
  };

  const loadPayouts = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMessage('');
      setSuccessMessage('');

      const { data: payoutData, error: payoutError } = await supabase
        .from('fund_space_payouts')
        .select('*')
        .order('created_at', { ascending: false });

      if (payoutError) {
        throw payoutError;
      }

      const basePayouts = (payoutData || []) as Payout[];

      if (basePayouts.length === 0) {
        setPayouts([]);
        return;
      }

      const fundSpaceIds = Array.from(
        new Set(basePayouts.map((item) => item.fund_space_id))
      ).filter(Boolean);

      const roundIds = Array.from(
        new Set(basePayouts.map((item) => item.round_id))
      ).filter(Boolean);

      const recipientIds = Array.from(
        new Set(basePayouts.map((item) => item.recipient_user_id))
      ).filter(Boolean);

      const [
        fundSpacesResponse,
        roundsResponse,
        profilesResponse,
        relationshipsResponse,
      ] = await Promise.all([
        supabase
          .from('fund_spaces')
          .select('id, name, contribution_amount, status')
          .in('id', fundSpaceIds),
        supabase
          .from('fund_space_rounds')
          .select(
            'id, round_number, contribution_deadline, week_start_date, week_end_date, status'
          )
          .in('id', roundIds),
        supabase
          .from('profiles')
          .select(
            'id, full_name, phone, email, momo_number, bank_name, bank_account_number, bank_account_name, registered_by_agent'
          )
          .in('id', recipientIds),
        supabase
          .from('agent_customers')
          .select('id, agent_id, customer_id, relationship_status')
          .in('customer_id', recipientIds)
          .eq('relationship_status', 'ACTIVE'),
      ]);

      if (fundSpacesResponse.error) {
        console.warn('Fund Spaces lookup warning:', fundSpacesResponse.error.message);
      }

      if (roundsResponse.error) {
        console.warn('Rounds lookup warning:', roundsResponse.error.message);
      }

      if (profilesResponse.error) {
        console.warn('Profiles lookup warning:', profilesResponse.error.message);
      }

      if (relationshipsResponse.error) {
        console.warn(
          'Agent relationships lookup warning:',
          relationshipsResponse.error.message
        );
      }

      const fundSpaces = (fundSpacesResponse.data || []) as FundSpace[];
      const rounds = (roundsResponse.data || []) as Round[];
      const profiles = (profilesResponse.data || []) as Profile[];
      const relationships = (relationshipsResponse.data || []) as AgentRelationship[];

      const agentIds = Array.from(
        new Set([
          ...relationships.map((item) => item.agent_id),
          ...profiles
            .map((item) => item.registered_by_agent)
            .filter((id): id is string => Boolean(id)),
        ])
      );

      let agents: AgentProfile[] = [];

      if (agentIds.length > 0) {
        const { data: agentData, error: agentError } = await supabase
          .from('profiles')
          .select('id, full_name, phone, email')
          .in('id', agentIds);

        if (agentError) {
          console.warn('Assigned agent lookup warning:', agentError.message);
        }

        agents = (agentData || []) as AgentProfile[];
      }

      const rows: PayoutRow[] = basePayouts.map((payout) => {
        const profile =
          profiles.find((item) => item.id === payout.recipient_user_id) || null;

        const relationship =
          relationships.find((item) => item.customer_id === payout.recipient_user_id) ||
          null;

        const agentId = relationship?.agent_id || profile?.registered_by_agent || null;

        return {
          ...payout,
          fund_space:
            fundSpaces.find((item) => item.id === payout.fund_space_id) || null,
          round: rounds.find((item) => item.id === payout.round_id) || null,
          profile,
          agent_relationship: relationship,
          assigned_agent: agentId
            ? agents.find((item) => item.id === agentId) || null
            : null,
        };
      });

      setPayouts(rows);
    } catch (error: unknown) {
      console.error('Admin payouts load error:', error);

      const message =
        error instanceof Error ? error.message : 'Unable to load payouts.';

      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPayouts();
  }, [loadPayouts]);

  const handleApprovePayout = async (payoutId: string) => {
    if (!fridayApprovalOpen) {
      setErrorMessage(
        `Payout approvals are only allowed on Fridays. Today is ${ghanaWeekday} in Ghana.`
      );
      setSuccessMessage('');
      return;
    }

    try {
      setActionLoadingId(payoutId);
      setErrorMessage('');
      setSuccessMessage('');

      const token = await getAccessToken();

      const response = await fetch(
        `/api/admin/fund-space/payouts/${payoutId}/approve`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const result = (await response.json()) as ApiResponse;

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Unable to approve payout.');
      }

      setSuccessMessage(result.message || 'Payout approved successfully.');
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

  const openMarkPaidModal = (payout: PayoutRow) => {
    const hasAgent = Boolean(payout.assigned_agent);
    const hasMomo = hasCustomerMomo(payout);
    const hasBank = hasCustomerBank(payout);

    let payoutMethod: PayoutMethod = 'MOMO';
    let deliveryMode: DeliveryMode = 'DIRECT_CUSTOMER';
    let note = 'Payout paid directly to customer.';

    if (hasMomo) {
      payoutMethod = 'MOMO';
      deliveryMode = 'DIRECT_CUSTOMER';
      note = `Payout paid directly to customer MoMo number: ${
        payout.profile?.momo_number || ''
      }.`;
    } else if (hasBank) {
      payoutMethod = 'BANK_TRANSFER';
      deliveryMode = 'DIRECT_CUSTOMER';
      note = `Payout paid directly to customer's bank account: ${
        payout.profile?.bank_name || 'Bank'
      } - ${payout.profile?.bank_account_number || 'No account number'}.`;
    } else if (hasAgent) {
      payoutMethod = 'CASH_AGENT';
      deliveryMode = 'AGENT_ASSISTED';
      note = `Payout released through assigned agent ${
        payout.assigned_agent?.full_name || ''
      } for customer handover.`;
    } else {
      payoutMethod = 'MANUAL_ADMIN';
      deliveryMode = 'DIRECT_CUSTOMER';
      note =
        'Payout completed manually by admin because recipient payment details are incomplete.';
    }

    setMarkPaidDraft({
      payout,
      deliveryMode,
      payoutMethod,
      paymentReference: '',
      note,
    });

    setErrorMessage('');
    setSuccessMessage('');
  };

  const updateMarkPaidDraft = <K extends keyof MarkPaidDraft>(
    key: K,
    value: MarkPaidDraft[K]
  ) => {
    setMarkPaidDraft((current) => {
      if (!current) return current;

      const next: MarkPaidDraft = {
        ...current,
        [key]: value,
      };

      if (key === 'deliveryMode') {
        if (value === 'AGENT_ASSISTED') {
          next.payoutMethod = 'CASH_AGENT';
          next.note = `Payout released through assigned agent ${
            current.payout.assigned_agent?.full_name || ''
          } for customer handover.`;
        } else if (hasCustomerMomo(current.payout)) {
          next.payoutMethod = 'MOMO';
          next.note = `Payout paid directly to customer MoMo number: ${
            current.payout.profile?.momo_number || ''
          }.`;
        } else if (hasCustomerBank(current.payout)) {
          next.payoutMethod = 'BANK_TRANSFER';
          next.note = `Payout paid directly to customer's bank account: ${
            current.payout.profile?.bank_name || 'Bank'
          } - ${current.payout.profile?.bank_account_number || 'No account number'}.`;
        } else {
          next.payoutMethod = 'MANUAL_ADMIN';
          next.note =
            'Payout completed manually by admin because recipient payment details are incomplete.';
        }
      }

      return next;
    });
  };

  const handleMarkAsPaid = async () => {
    if (!markPaidDraft) {
      setErrorMessage('No payout selected.');
      return;
    }

    if (
      markPaidDraft.deliveryMode === 'AGENT_ASSISTED' &&
      !markPaidDraft.payout.assigned_agent
    ) {
      setErrorMessage(
        'This customer does not have an assigned agent. Choose direct customer payout instead.'
      );
      return;
    }

    if (!markPaidDraft.paymentReference.trim()) {
      setErrorMessage('Please enter a payout reference before marking as paid.');
      return;
    }

    try {
      setActionLoadingId(markPaidDraft.payout.id);
      setErrorMessage('');
      setSuccessMessage('');

      const reference = buildPayoutReference(markPaidDraft);

      const { error } = await supabase.rpc('mark_fund_space_payout_paid', {
        p_payout_id: markPaidDraft.payout.id,
        p_payout_method: markPaidDraft.payoutMethod,
        p_payout_reference: reference,
      });

      if (error) {
        throw error;
      }

      setSuccessMessage(
        markPaidDraft.deliveryMode === 'AGENT_ASSISTED'
          ? 'Payout marked as paid through assigned agent.'
          : 'Payout marked as paid directly to customer.'
      );

      setMarkPaidDraft(null);
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

    const agentAssisted = payouts.filter((item) => Boolean(item.assigned_agent)).length;

    const totalAmount = payouts.reduce(
      (sum, item) => sum + getPayoutAmount(item),
      0
    );

    const pendingAmount = payouts
      .filter((item) => ['PENDING', 'PENDING_ADMIN_APPROVAL'].includes(item.status))
      .reduce((sum, item) => sum + getPayoutAmount(item), 0);

    return {
      total,
      pending,
      approved,
      paid,
      rejected,
      agentAssisted,
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
      const roundNumber = item.round?.round_number
        ? String(item.round.round_number)
        : '';
      const amount = String(getPayoutAmount(item) || '');
      const status = item.status || '';
      const agentName = item.assigned_agent?.full_name || '';

      const searchValue = searchTerm.toLowerCase();

      const matchesSearch =
        item.id.toLowerCase().includes(searchValue) ||
        memberName.toLowerCase().includes(searchValue) ||
        phone.toLowerCase().includes(searchValue) ||
        email.toLowerCase().includes(searchValue) ||
        groupName.toLowerCase().includes(searchValue) ||
        agentName.toLowerCase().includes(searchValue) ||
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
      <div className="rounded-3xl bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-600 p-6 text-white shadow-sm md:p-8">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
          <div>
            <p className="mb-3 inline-flex rounded-full bg-white/15 px-4 py-1 text-sm font-medium">
              Admin Payout Control
            </p>

            <h1 className="text-3xl font-bold md:text-4xl">
              Fund Space Payouts
            </h1>

            <p className="mt-3 max-w-3xl text-sm leading-7 text-emerald-50 md:text-base">
              Approve payouts on Fridays, then pay customers directly or release
              agent-assisted payouts through the customer’s assigned agent.
            </p>
          </div>

          <button
            type="button"
            onClick={loadPayouts}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-emerald-700 hover:bg-emerald-50"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>
      </div>

      <div
        className={`rounded-3xl border p-5 md:p-6 ${
          fridayApprovalOpen
            ? 'border-emerald-100 bg-emerald-50'
            : 'border-amber-100 bg-amber-50'
        }`}
      >
        <div className="flex gap-3">
          <div
            className={`mt-1 rounded-2xl p-3 ${
              fridayApprovalOpen
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-amber-100 text-amber-700'
            }`}
          >
            {fridayApprovalOpen ? (
              <CheckCircle2 size={22} />
            ) : (
              <CalendarClock size={22} />
            )}
          </div>

          <div>
            <h2
              className={`text-lg font-black ${
                fridayApprovalOpen ? 'text-emerald-900' : 'text-amber-900'
              }`}
            >
              {fridayApprovalOpen
                ? 'Friday payout approval window is open'
                : 'Payout approval is locked until Friday'}
            </h2>

            <p
              className={`mt-2 max-w-3xl text-sm leading-6 ${
                fridayApprovalOpen ? 'text-emerald-700' : 'text-amber-700'
              }`}
            >
              {fridayApprovalOpen
                ? 'Admins can approve pending payouts today. After approval, choose whether to pay the customer directly or through the assigned agent.'
                : `Today is ${ghanaWeekday} in Ghana. To keep schedules uniform, pending payouts can only be approved on Fridays.`}
            </p>
          </div>
        </div>
      </div>

      {errorMessage && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <p>{errorMessage}</p>
        </div>
      )}

      {successMessage && (
        <div className="flex items-start gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-700">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
          <p>{successMessage}</p>
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-6">
        <StatCard
          title="Total Payouts"
          value={stats.total}
          icon={<WalletCards size={24} />}
        />
        <StatCard
          title="Pending"
          value={stats.pending}
          icon={<Clock size={24} />}
          amber
        />
        <StatCard
          title="Approved"
          value={stats.approved}
          icon={<CheckCircle2 size={24} />}
        />
        <StatCard
          title="Paid"
          value={stats.paid}
          icon={<CircleDollarSign size={24} />}
        />
        <StatCard
          title="Agent Assisted"
          value={stats.agentAssisted}
          icon={<Users size={24} />}
          amber
        />
        <StatCard
          title="Rejected"
          value={stats.rejected}
          icon={<XCircle size={24} />}
          red
        />
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

      <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm md:p-6">
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
                placeholder="Search member, group, agent, amount, status..."
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
              <option value="PENDING_ADMIN_APPROVAL">
                Pending Admin Approval
              </option>
              <option value="APPROVED">Approved</option>
              <option value="PAID">Paid</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>
        </div>

        <div className="mt-6 space-y-4 lg:hidden">
          {filteredPayouts.length === 0 ? (
            <EmptyState />
          ) : (
            filteredPayouts.map((payout) => (
              <PayoutCard
                key={payout.id}
                payout={payout}
                fridayApprovalOpen={fridayApprovalOpen}
                actionLoadingId={actionLoadingId}
                onApprove={handleApprovePayout}
                onReject={(id) => {
                  setRejectPayoutId(id);
                  setRejectReason('');
                  setErrorMessage('');
                  setSuccessMessage('');
                }}
                onMarkPaid={openMarkPaidModal}
              />
            ))
          )}
        </div>

        <div className="mt-6 hidden overflow-hidden rounded-2xl border border-gray-100 lg:block">
          {filteredPayouts.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1300px] text-left">
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
                      Payout Route
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
                  {filteredPayouts.map((payout) => (
                    <PayoutTableRow
                      key={payout.id}
                      payout={payout}
                      fridayApprovalOpen={fridayApprovalOpen}
                      actionLoadingId={actionLoadingId}
                      onApprove={handleApprovePayout}
                      onReject={(id) => {
                        setRejectPayoutId(id);
                        setRejectReason('');
                        setErrorMessage('');
                        setSuccessMessage('');
                      }}
                      onMarkPaid={openMarkPaidModal}
                    />
                  ))}
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
              Please enter the reason why this payout is being rejected.
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

      {markPaidDraft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4">
          <div className="w-full max-w-4xl rounded-3xl bg-white shadow-2xl">
            <div className="border-b border-gray-100 p-6">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="mb-2 inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-emerald-700">
                    Confirm Payout Payment
                  </p>

                  <h2 className="text-2xl font-black text-gray-900">
                    Mark Payout as Paid
                  </h2>

                  <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">
                    Confirm the recipient details carefully before marking this
                    payout as paid. The best payout option has been preselected
                    using the recipient’s saved details.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setMarkPaidDraft(null)}
                  className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-50"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="max-h-[75vh] overflow-y-auto p-6">
              <div className="grid gap-5 lg:grid-cols-3">
                <div className="lg:col-span-2">
                  <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-5">
                    <div className="flex items-start gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white">
                        <UserRound className="h-6 w-6" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-black uppercase tracking-wide text-emerald-700">
                          Selected Recipient
                        </p>

                        <h3 className="mt-1 text-xl font-black text-gray-900">
                          {markPaidDraft.payout.profile?.full_name ||
                            'Unknown recipient'}
                        </h3>

                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          <DetailBox
                            label="Phone"
                            value={
                              markPaidDraft.payout.profile?.phone || 'Not provided'
                            }
                          />
                          <DetailBox
                            label="Email"
                            value={
                              markPaidDraft.payout.profile?.email || 'Not provided'
                            }
                          />
                          <DetailBox
                            label="Payout Amount"
                            value={formatCurrency(
                              getPayoutAmount(markPaidDraft.payout)
                            )}
                            strong
                          />
                          <DetailBox
                            label="Fund Space"
                            value={
                              markPaidDraft.payout.fund_space?.name ||
                              'Fund Space'
                            }
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-5 md:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => updateMarkPaidDraft('deliveryMode', 'DIRECT_CUSTOMER')}
                      className={`rounded-3xl border p-5 text-left transition ${
                        markPaidDraft.deliveryMode === 'DIRECT_CUSTOMER'
                          ? 'border-emerald-300 bg-emerald-50 ring-4 ring-emerald-50'
                          : 'border-gray-200 bg-white hover:bg-gray-50'
                      }`}
                    >
                      <Smartphone className="mb-4 h-7 w-7 text-emerald-700" />
                      <p className="text-lg font-black text-gray-900">
                        Pay Directly to Customer
                      </p>
                      <p className="mt-2 text-sm leading-6 text-gray-500">
                        Use the customer’s MoMo, bank account, or manual admin
                        payment details.
                      </p>

                      {markPaidDraft.deliveryMode === 'DIRECT_CUSTOMER' && (
                        <p className="mt-4 inline-flex rounded-full bg-emerald-600 px-3 py-1 text-xs font-bold text-white">
                          Selected
                        </p>
                      )}
                    </button>

                    <button
                      type="button"
                      disabled={!markPaidDraft.payout.assigned_agent}
                      onClick={() => updateMarkPaidDraft('deliveryMode', 'AGENT_ASSISTED')}
                      className={`rounded-3xl border p-5 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${
                        markPaidDraft.deliveryMode === 'AGENT_ASSISTED'
                          ? 'border-amber-300 bg-amber-50 ring-4 ring-amber-50'
                          : 'border-gray-200 bg-white hover:bg-gray-50'
                      }`}
                    >
                      <HandCoins className="mb-4 h-7 w-7 text-amber-700" />
                      <p className="text-lg font-black text-gray-900">
                        Pay Through Assigned Agent
                      </p>
                      <p className="mt-2 text-sm leading-6 text-gray-500">
                        Use this for offline customers who need agent-assisted
                        cash handover.
                      </p>

                      {markPaidDraft.deliveryMode === 'AGENT_ASSISTED' && (
                        <p className="mt-4 inline-flex rounded-full bg-amber-600 px-3 py-1 text-xs font-bold text-white">
                          Selected
                        </p>
                      )}

                      {!markPaidDraft.payout.assigned_agent && (
                        <p className="mt-4 text-xs font-semibold text-red-600">
                          No assigned agent found for this customer.
                        </p>
                      )}
                    </button>
                  </div>

                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="text-sm font-bold text-gray-700">
                        Selected Payout Method
                      </label>

                      <select
                        value={markPaidDraft.payoutMethod}
                        onChange={(event) =>
                          updateMarkPaidDraft(
                            'payoutMethod',
                            event.target.value as PayoutMethod
                          )
                        }
                        className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                      >
                        {markPaidDraft.deliveryMode === 'AGENT_ASSISTED' ? (
                          <option value="CASH_AGENT">Cash Through Agent</option>
                        ) : (
                          <>
                            <option value="MOMO">Mobile Money</option>
                            <option value="BANK_TRANSFER">Bank Transfer</option>
                            <option value="MANUAL_ADMIN">
                              Manual Admin Payment
                            </option>
                          </>
                        )}
                      </select>
                    </div>

                    <div>
                      <label className="text-sm font-bold text-gray-700">
                        Payment Reference
                      </label>

                      <input
                        value={markPaidDraft.paymentReference}
                        onChange={(event) =>
                          updateMarkPaidDraft(
                            'paymentReference',
                            event.target.value
                          )
                        }
                        placeholder="MoMo transaction ID, bank reference, or receipt number"
                        className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                      />
                    </div>
                  </div>

                  <div className="mt-5">
                    <label className="text-sm font-bold text-gray-700">
                      Payment Note
                    </label>

                    <textarea
                      value={markPaidDraft.note}
                      onChange={(event) =>
                        updateMarkPaidDraft('note', event.target.value)
                      }
                      rows={4}
                      placeholder="Write a short note about how the payout was completed."
                      className="mt-2 w-full rounded-2xl border border-gray-200 p-4 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                    />
                  </div>
                </div>

                <div className="space-y-5">
                  <div className="rounded-3xl border border-gray-100 bg-gray-50 p-5">
                    <div className="mb-4 flex items-center gap-3">
                      <Smartphone className="h-5 w-5 text-emerald-700" />
                      <h3 className="font-black text-gray-900">
                        Recipient Payment Details
                      </h3>
                    </div>

                    <div className="space-y-3 text-sm">
                      <DetailBox
                        label="Mobile Money"
                        value={
                          markPaidDraft.payout.profile?.momo_number ||
                          'Not provided'
                        }
                      />
                      <DetailBox
                        label="Bank Name"
                        value={
                          markPaidDraft.payout.profile?.bank_name ||
                          'Not provided'
                        }
                      />
                      <DetailBox
                        label="Account Number"
                        value={
                          markPaidDraft.payout.profile?.bank_account_number ||
                          'Not provided'
                        }
                      />
                      <DetailBox
                        label="Account Name"
                        value={
                          markPaidDraft.payout.profile?.bank_account_name ||
                          'Not provided'
                        }
                      />
                    </div>
                  </div>

                  <div
                    className={`rounded-3xl border p-5 ${
                      markPaidDraft.payout.assigned_agent
                        ? 'border-amber-100 bg-amber-50'
                        : 'border-gray-100 bg-gray-50'
                    }`}
                  >
                    <div className="mb-4 flex items-center gap-3">
                      <Users
                        className={`h-5 w-5 ${
                          markPaidDraft.payout.assigned_agent
                            ? 'text-amber-700'
                            : 'text-gray-400'
                        }`}
                      />
                      <h3 className="font-black text-gray-900">
                        Assigned Agent
                      </h3>
                    </div>

                    {markPaidDraft.payout.assigned_agent ? (
                      <div className="space-y-3 text-sm">
                        <DetailBox
                          label="Agent Name"
                          value={
                            markPaidDraft.payout.assigned_agent.full_name ||
                            'Unnamed agent'
                          }
                        />
                        <DetailBox
                          label="Agent Phone"
                          value={
                            markPaidDraft.payout.assigned_agent.phone ||
                            'Not provided'
                          }
                        />
                        <DetailBox
                          label="Agent Email"
                          value={
                            markPaidDraft.payout.assigned_agent.email ||
                            'Not provided'
                          }
                        />
                      </div>
                    ) : (
                      <p className="text-sm leading-6 text-gray-500">
                        No assigned agent was found for this recipient. Use
                        direct customer payout or manual admin payment.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-100 p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setMarkPaidDraft(null)}
                  className="rounded-xl border border-gray-200 px-5 py-3 text-sm font-bold text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleMarkAsPaid}
                  disabled={actionLoadingId === markPaidDraft.payout.id}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                >
                  {actionLoadingId === markPaidDraft.payout.id && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                  Confirm Payout Paid
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-3xl border border-amber-100 bg-amber-50 p-6">
        <h2 className="text-lg font-bold text-amber-800">
          Agent-assisted payout safety rule
        </h2>

        <p className="mt-2 text-sm leading-6 text-amber-700">
          The customer remains the rightful payout owner. Agent-assisted payout
          should only be used when the customer is offline or not digitally
          confident. Always confirm the recipient details, payment method,
          reference, and agent information before marking a payout as paid.
        </p>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
  amber = false,
  red = false,
}: {
  title: string;
  value: string | number;
  icon: ReactNode;
  amber?: boolean;
  red?: boolean;
}) {
  const colorClass = red
    ? 'bg-red-50 text-red-700'
    : amber
      ? 'bg-amber-50 text-amber-700'
      : 'bg-emerald-50 text-emerald-700';

  return (
    <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
      <div className={`mb-4 inline-flex rounded-2xl p-3 ${colorClass}`}>
        {icon}
      </div>
      <p className="text-sm text-gray-500">{title}</p>
      <h3 className="mt-1 text-3xl font-black text-gray-900">{value}</h3>
    </div>
  );
}

function DetailBox({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="rounded-2xl bg-white p-4">
      <p className="text-xs font-bold uppercase text-gray-400">{label}</p>
      <p
        className={`mt-1 break-words ${
          strong
            ? 'text-lg font-black text-emerald-700'
            : 'font-bold text-gray-900'
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="p-10 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gray-50 text-gray-400">
        <WalletCards size={28} />
      </div>

      <h3 className="text-lg font-bold text-gray-900">No payouts found</h3>

      <p className="mt-2 text-sm text-gray-500">
        No payout matches your current search or filter.
      </p>
    </div>
  );
}

function PayoutRouteDetails({ payout }: { payout: PayoutRow }) {
  return (
    <div className="space-y-2 text-sm">
      <p className="font-semibold text-gray-900">
        MoMo: {payout.profile?.momo_number || 'Not provided'}
      </p>

      {(payout.profile?.bank_name ||
        payout.profile?.bank_account_number ||
        payout.profile?.bank_account_name) && (
        <div className="text-xs text-gray-500">
          <p>{payout.profile?.bank_name || 'No bank name'}</p>
          <p>{payout.profile?.bank_account_number || 'No account number'}</p>
          <p>{payout.profile?.bank_account_name || 'No account name'}</p>
        </div>
      )}

      {payout.assigned_agent ? (
        <div className="rounded-xl bg-amber-50 p-3 text-xs text-amber-700">
          <p className="font-bold">Assigned Agent</p>
          <p>{payout.assigned_agent.full_name || 'Unnamed agent'}</p>
          <p>{payout.assigned_agent.phone || 'No phone'}</p>
        </div>
      ) : (
        <div className="rounded-xl bg-gray-50 p-3 text-xs text-gray-500">
          No assigned agent found for this customer.
        </div>
      )}
    </div>
  );
}

function PayoutActions({
  payout,
  fridayApprovalOpen,
  actionLoadingId,
  onApprove,
  onReject,
  onMarkPaid,
}: {
  payout: PayoutRow;
  fridayApprovalOpen: boolean;
  actionLoadingId: string | null;
  onApprove: (payoutId: string) => void;
  onReject: (payoutId: string) => void;
  onMarkPaid: (payout: PayoutRow) => void;
}) {
  const isPending = ['PENDING', 'PENDING_ADMIN_APPROVAL'].includes(payout.status);
  const isApproved = payout.status === 'APPROVED';
  const isPaid = payout.status === 'PAID';
  const isRejected = payout.status === 'REJECTED';
  const isActionLoading = actionLoadingId === payout.id;

  return (
    <div className="flex flex-wrap justify-end gap-2">
      {isPending && (
        <>
          <button
            type="button"
            disabled={isActionLoading || !fridayApprovalOpen}
            onClick={() => onApprove(payout.id)}
            title={
              fridayApprovalOpen
                ? 'Approve this payout'
                : 'Payout approvals are only allowed on Fridays'
            }
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {isActionLoading && <Loader2 className="h-3 w-3 animate-spin" />}
            {fridayApprovalOpen ? 'Approve' : 'Friday Only'}
          </button>

          <button
            type="button"
            disabled={isActionLoading}
            onClick={() => onReject(payout.id)}
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
          onClick={() => onMarkPaid(payout)}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          {isActionLoading && <Loader2 className="h-3 w-3 animate-spin" />}
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
  );
}

function PayoutCard({
  payout,
  fridayApprovalOpen,
  actionLoadingId,
  onApprove,
  onReject,
  onMarkPaid,
}: {
  payout: PayoutRow;
  fridayApprovalOpen: boolean;
  actionLoadingId: string | null;
  onApprove: (payoutId: string) => void;
  onReject: (payoutId: string) => void;
  onMarkPaid: (payout: PayoutRow) => void;
}) {
  return (
    <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-lg font-black text-gray-900">
            {payout.profile?.full_name || 'Unknown member'}
          </p>
          <p className="mt-1 text-sm text-gray-500">
            {payout.profile?.phone || 'No phone'}
          </p>
        </div>

        <span
          className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-bold ${getStatusStyle(
            payout.status
          )}`}
        >
          {getReadableStatus(payout.status)}
        </span>
      </div>

      <div className="mt-4 grid gap-3 text-sm">
        <div className="rounded-2xl bg-gray-50 p-4">
          <p className="text-xs font-bold uppercase text-gray-400">Fund Space</p>
          <p className="mt-1 font-bold text-gray-900">
            {payout.fund_space?.name || 'Fund Space'}
          </p>
        </div>

        <div className="rounded-2xl bg-gray-50 p-4">
          <p className="text-xs font-bold uppercase text-gray-400">Amount</p>
          <p className="mt-1 font-black text-gray-900">
            {formatCurrency(getPayoutAmount(payout))}
          </p>
        </div>

        <div className="rounded-2xl bg-gray-50 p-4">
          <p className="text-xs font-bold uppercase text-gray-400">Payout Route</p>
          <div className="mt-2">
            <PayoutRouteDetails payout={payout} />
          </div>
        </div>
      </div>

      <div className="mt-5">
        <PayoutActions
          payout={payout}
          fridayApprovalOpen={fridayApprovalOpen}
          actionLoadingId={actionLoadingId}
          onApprove={onApprove}
          onReject={onReject}
          onMarkPaid={onMarkPaid}
        />
      </div>
    </div>
  );
}

function PayoutTableRow({
  payout,
  fridayApprovalOpen,
  actionLoadingId,
  onApprove,
  onReject,
  onMarkPaid,
}: {
  payout: PayoutRow;
  fridayApprovalOpen: boolean;
  actionLoadingId: string | null;
  onApprove: (payoutId: string) => void;
  onReject: (payoutId: string) => void;
  onMarkPaid: (payout: PayoutRow) => void;
}) {
  return (
    <tr className="hover:bg-gray-50">
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
          href={`/admin/fund-space/${payout.fund_space_id}`}
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
          Deadline: {formatDate(payout.round?.contribution_deadline)}
        </p>
      </td>

      <td className="px-5 py-5">
        <p className="font-black text-gray-900">
          {formatCurrency(getPayoutAmount(payout))}
        </p>
      </td>

      <td className="px-5 py-5">
        <PayoutRouteDetails payout={payout} />
      </td>

      <td className="px-5 py-5">
        <span
          className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-bold ${getStatusStyle(
            payout.status
          )}`}
        >
          {payout.status === 'PAID' && <CheckCircle2 size={13} />}
          {payout.status === 'REJECTED' && <XCircle size={13} />}
          {getReadableStatus(payout.status)}
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
        <PayoutActions
          payout={payout}
          fridayApprovalOpen={fridayApprovalOpen}
          actionLoadingId={actionLoadingId}
          onApprove={onApprove}
          onReject={onReject}
          onMarkPaid={onMarkPaid}
        />
      </td>
    </tr>
  );
}