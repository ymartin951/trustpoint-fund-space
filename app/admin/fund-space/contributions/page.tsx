'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  CalendarDays,
  CheckCircle2,
  Clock,
  Loader2,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Users,
  X,
  XCircle,
} from 'lucide-react';

import { supabase } from '@/lib/supabase/client';
import type { Database, Json } from '@/lib/supabase/database.types';

type Contribution = Database['public']['Tables']['fund_space_contributions']['Row'];

type FundSpace = Pick<
  Database['public']['Tables']['fund_spaces']['Row'],
  'id' | 'name' | 'status' | 'contribution_amount' | 'current_round_number'
>;

type Round = Pick<
  Database['public']['Tables']['fund_space_rounds']['Row'],
  | 'id'
  | 'round_number'
  | 'status'
  | 'contribution_deadline'
  | 'week_start_date'
  | 'week_end_date'
>;

type ProfileSummary = Pick<
  Database['public']['Tables']['profiles']['Row'],
  'id' | 'full_name' | 'phone' | 'email' | 'verification_status'
>;

type AdminProfile = {
  id: string;
  full_name: string | null;
  role: string | null;
  status: string | null;
  is_blacklisted: boolean | null;
};

type ContributionWithDetails = Contribution & {
  fund_space: FundSpace | null;
  round: Round | null;
  profile: ProfileSummary | null;
};

type ContributionStats = {
  total_records: number;
  pending_records: number;
  paid_records: number;
  overdue_records: number;
  failed_records: number;
  total_due: number;
  total_paid: number;
};

type RpcResponse = {
  success?: boolean;
  message?: string;
  error?: string;
};

type RpcError = {
  message: string;
};

type FundSpaceContributionRpcSupabase = typeof supabase & {
  rpc: {
    (
      fn: 'confirm_fund_space_contribution',
      args: {
        p_contribution_id: string;
        p_amount: number;
        p_payment_method: string;
        p_payment_reference?: string | null;
      }
    ): Promise<{
      data: Json | null;
      error: RpcError | null;
    }>;
    (
      fn: 'check_round_ready_for_payout',
      args: {
        p_round_id: string;
      }
    ): Promise<{
      data: Json | null;
      error: RpcError | null;
    }>;
  };
};

type ConfirmModalState = {
  contribution: ContributionWithDetails;
  amount: string;
  paymentMethod: string;
  paymentReference: string;
};

const emptyStats: ContributionStats = {
  total_records: 0,
  pending_records: 0,
  paid_records: 0,
  overdue_records: 0,
  failed_records: 0,
  total_due: 0,
  total_paid: 0,
};

const confirmableStatuses = [
  'PENDING',
  'PENDING_ADMIN_CONFIRMATION',
  'OVERDUE',
  'FAILED',
  'DEFAULTED',
];

function formatCurrency(amount: number | null | undefined) {
  return `GH₵${Number(amount || 0).toLocaleString('en-GH')}`;
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

function getStatusStyle(status: string | null | undefined) {
  const value = status || 'PENDING';

  if (['PAID', 'CONFIRMED', 'COMPLETED'].includes(value)) {
    return 'bg-emerald-50 text-emerald-700 border-emerald-100';
  }

  if (['PENDING', 'COLLECTING', 'PENDING_ADMIN_CONFIRMATION'].includes(value)) {
    return 'bg-amber-50 text-amber-700 border-amber-100';
  }

  if (['OVERDUE', 'FAILED', 'DEFAULTED', 'REJECTED'].includes(value)) {
    return 'bg-red-50 text-red-700 border-red-100';
  }

  return 'bg-gray-50 text-gray-700 border-gray-100';
}

function parseRpcResponse(data: Json | null): RpcResponse {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return {};
  }

  return data as RpcResponse;
}

function calculateStats(rows: ContributionWithDetails[]): ContributionStats {
  return rows.reduce<ContributionStats>(
    (stats, row) => {
      const status = row.status || 'PENDING';

      stats.total_records += 1;
      stats.total_due += Number(row.amount_due || 0);
      stats.total_paid += Number(row.amount_paid || 0);

      if (status === 'PENDING' || status === 'PENDING_ADMIN_CONFIRMATION') {
        stats.pending_records += 1;
      }

      if (status === 'PAID' || status === 'CONFIRMED') {
        stats.paid_records += 1;
      }

      if (status === 'OVERDUE' || status === 'DEFAULTED') {
        stats.overdue_records += 1;
      }

      if (status === 'FAILED') {
        stats.failed_records += 1;
      }

      return stats;
    },
    { ...emptyStats }
  );
}

function getMemberName(item: ContributionWithDetails) {
  return item.profile?.full_name || 'Unknown Member';
}

function getGroupName(item: ContributionWithDetails) {
  return item.fund_space?.name || `Fund Space ${item.fund_space_id.slice(0, 8)}`;
}

export default function AdminFundSpaceContributionsPage() {
  const [adminProfile, setAdminProfile] = useState<AdminProfile | null>(null);
  const [accessChecking, setAccessChecking] = useState(true);
  const [accessDenied, setAccessDenied] = useState('');

  const [contributions, setContributions] = useState<ContributionWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [groupFilter, setGroupFilter] = useState('ALL');
  const [amountFilter, setAmountFilter] = useState('ALL');

  const [confirmModal, setConfirmModal] = useState<ConfirmModalState | null>(null);

  useEffect(() => {
    initializePage();
  }, []);

  async function initializePage() {
    try {
      setAccessChecking(true);
      setAccessDenied('');
      setErrorMessage('');

      const { data: userResult, error: userError } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      const user = userResult.user;

      if (!user) {
        setAccessDenied('You must be logged in as an admin to view Fund Space contributions.');
        return;
      }

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, role, status, is_blacklisted')
        .eq('id', user.id)
        .single();

      if (profileError) {
        throw profileError;
      }

      const profile = profileData as AdminProfile | null;

      if (!profile) {
        setAccessDenied('Unable to verify your admin account.');
        return;
      }

      const role = String(profile.role || '').toUpperCase();
      const status = String(profile.status || '').toUpperCase();

      if (!['ADMIN', 'SUPER_ADMIN'].includes(role)) {
        setAccessDenied('You do not have permission to manage Fund Space contributions.');
        return;
      }

      if (profile.is_blacklisted) {
        setAccessDenied('Your account has been restricted and cannot manage Fund Space contributions.');
        return;
      }

      if (status && status !== 'ACTIVE') {
        setAccessDenied('Your admin account is not active.');
        return;
      }

      setAdminProfile(profile);
      await loadContributions();
    } catch (error: unknown) {
      console.error('Admin contribution page initialization error:', error);

      const message =
        error instanceof Error
          ? error.message
          : 'Unable to initialize Fund Space contribution page.';

      setErrorMessage(message);
    } finally {
      setAccessChecking(false);
      setLoading(false);
    }
  }

  async function loadProfiles(userIds: string[]) {
    const cleanUserIds = Array.from(new Set(userIds.filter(Boolean)));

    if (cleanUserIds.length === 0) {
      return new Map<string, ProfileSummary>();
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, phone, email, verification_status')
      .in('id', cleanUserIds);

    if (error) {
      console.warn('Profiles load warning:', error.message);
      return new Map<string, ProfileSummary>();
    }

    return new Map(
      ((data || []) as ProfileSummary[]).map((profile) => [profile.id, profile])
    );
  }

  async function loadFundSpaces(fundSpaceIds: string[]) {
    const cleanIds = Array.from(new Set(fundSpaceIds.filter(Boolean)));

    if (cleanIds.length === 0) {
      return new Map<string, FundSpace>();
    }

    const { data, error } = await supabase
      .from('fund_spaces')
      .select('id, name, status, contribution_amount, current_round_number')
      .in('id', cleanIds);

    if (error) {
      console.warn('Fund Spaces load warning:', error.message);
      return new Map<string, FundSpace>();
    }

    return new Map(((data || []) as FundSpace[]).map((group) => [group.id, group]));
  }

  async function loadRounds(roundIds: string[]) {
    const cleanIds = Array.from(new Set(roundIds.filter(Boolean)));

    if (cleanIds.length === 0) {
      return new Map<string, Round>();
    }

    const { data, error } = await supabase
      .from('fund_space_rounds')
      .select('id, round_number, status, contribution_deadline, week_start_date, week_end_date')
      .in('id', cleanIds);

    if (error) {
      console.warn('Rounds load warning:', error.message);
      return new Map<string, Round>();
    }

    return new Map(((data || []) as Round[]).map((round) => [round.id, round]));
  }

  async function loadContributions() {
    try {
      setRefreshing(true);
      setErrorMessage('');
      setSuccessMessage('');

      const { data, error } = await supabase
        .from('fund_space_contributions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      const rawContributions = (data || []) as Contribution[];

      const [profileMap, fundSpaceMap, roundMap] = await Promise.all([
        loadProfiles(rawContributions.map((item) => item.user_id)),
        loadFundSpaces(rawContributions.map((item) => item.fund_space_id)),
        loadRounds(rawContributions.map((item) => item.round_id)),
      ]);

      setContributions(
        rawContributions.map((item) => ({
          ...item,
          profile: profileMap.get(item.user_id) || null,
          fund_space: fundSpaceMap.get(item.fund_space_id) || null,
          round: roundMap.get(item.round_id) || null,
        }))
      );
    } catch (error: unknown) {
      console.error('Admin Fund Space contributions load error:', error);

      const message =
        error instanceof Error
          ? error.message
          : 'Unable to load Fund Space contributions.';

      setErrorMessage(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function openConfirmModal(contribution: ContributionWithDetails) {
    const status = contribution.status || 'PENDING';

    if (!confirmableStatuses.includes(status)) {
      setErrorMessage('This contribution has already been confirmed or cannot be confirmed.');
      return;
    }

    setErrorMessage('');
    setSuccessMessage('');

    setConfirmModal({
      contribution,
      amount: String(contribution.amount_due || contribution.amount_paid || ''),
      paymentMethod: contribution.payment_method || 'CASH',
      paymentReference: contribution.payment_reference || '',
    });
  }

  async function handleConfirmContribution(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!confirmModal) return;

    const contribution = confirmModal.contribution;
    const amount = Number(confirmModal.amount);
    const amountDue = Number(contribution.amount_due || 0);
    const paymentMethod = confirmModal.paymentMethod.trim().toUpperCase();
    const paymentReference = confirmModal.paymentReference.trim();

    if (!Number.isFinite(amount) || amount <= 0) {
      setErrorMessage('Please enter a valid amount greater than 0.');
      return;
    }

    if (amountDue > 0 && amount < amountDue) {
      setErrorMessage(
        `The amount received is less than the required contribution of ${formatCurrency(
          amountDue
        )}. Please confirm the full amount.`
      );
      return;
    }

    if (!paymentMethod) {
      setErrorMessage('Please enter the payment method.');
      return;
    }

    try {
      setActionLoadingId(contribution.id);
      setErrorMessage('');
      setSuccessMessage('');

      const typedSupabase = supabase as FundSpaceContributionRpcSupabase;

      const { data, error } = await typedSupabase.rpc('confirm_fund_space_contribution', {
        p_contribution_id: contribution.id,
        p_amount: amount,
        p_payment_method: paymentMethod,
        p_payment_reference: paymentReference || null,
      });

      if (error) {
        throw new Error(error.message);
      }

      const result = parseRpcResponse(data);

      if (result.success === false) {
        throw new Error(result.message || result.error || 'Contribution confirmation failed.');
      }

      if (contribution.round_id) {
        const { error: readyError } = await typedSupabase.rpc('check_round_ready_for_payout', {
          p_round_id: contribution.round_id,
        });

        if (readyError) {
          console.warn('Round ready check warning:', readyError.message);
        }
      }

      setConfirmModal(null);

      setSuccessMessage(
        result.message || 'Contribution confirmed successfully. Round payout readiness checked.'
      );

      await loadContributions();
    } catch (error: unknown) {
      console.error('Confirm contribution error:', error);

      const message =
        error instanceof Error
          ? error.message
          : 'Unable to confirm contribution.';

      setErrorMessage(message);
    } finally {
      setActionLoadingId(null);
    }
  }

  const stats = useMemo(() => calculateStats(contributions), [contributions]);

  const overdueContributions = useMemo(() => {
    return contributions.filter((item) =>
      ['OVERDUE', 'FAILED', 'DEFAULTED'].includes(item.status || '')
    );
  }, [contributions]);

  const statusOptions = useMemo(() => {
    const statuses = Array.from(
      new Set(contributions.map((item) => item.status || 'PENDING'))
    );

    return ['ALL', ...statuses.sort()];
  }, [contributions]);

  const groupOptions = useMemo(() => {
    const groups = new Map<string, string>();

    contributions.forEach((item) => {
      groups.set(item.fund_space_id, getGroupName(item));
    });

    return Array.from(groups.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [contributions]);

  const filteredContributions = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return contributions.filter((item) => {
      const memberName = (item.profile?.full_name || '').toLowerCase();
      const phone = (item.profile?.phone || '').toLowerCase();
      const email = (item.profile?.email || '').toLowerCase();
      const groupName = (item.fund_space?.name || '').toLowerCase();
      const reference = (item.payment_reference || '').toLowerCase();
      const paymentMethod = (item.payment_method || '').toLowerCase();
      const status = item.status || 'PENDING';
      const amountDue = String(item.amount_due || '');
      const amountPaid = String(item.amount_paid || '');
      const roundNumber = item.round?.round_number ? String(item.round.round_number) : '';

      const matchesSearch =
        !query ||
        memberName.includes(query) ||
        phone.includes(query) ||
        email.includes(query) ||
        groupName.includes(query) ||
        reference.includes(query) ||
        paymentMethod.includes(query) ||
        status.toLowerCase().includes(query) ||
        amountDue.includes(query) ||
        amountPaid.includes(query) ||
        roundNumber.includes(query) ||
        String(item.id).toLowerCase().includes(query) ||
        String(item.fund_space_id).toLowerCase().includes(query);

      const matchesStatus = statusFilter === 'ALL' || status === statusFilter;
      const matchesGroup = groupFilter === 'ALL' || item.fund_space_id === groupFilter;
      const matchesAmount =
        amountFilter === 'ALL' || Number(item.amount_due) === Number(amountFilter);

      return matchesSearch && matchesStatus && matchesGroup && matchesAmount;
    });
  }, [amountFilter, contributions, groupFilter, searchTerm, statusFilter]);

  if (accessChecking || loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-emerald-600" />
          <p className="text-sm text-gray-500">Loading Fund Space contributions...</p>
        </div>
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="w-full max-w-xl rounded-3xl border border-red-100 bg-white p-8 text-center shadow-sm">
          <ShieldAlert className="mx-auto mb-4 h-12 w-12 text-red-600" />
          <h1 className="text-2xl font-black text-gray-900">Access Denied</h1>
          <p className="mt-3 text-sm leading-6 text-gray-600">{accessDenied}</p>

          <Link
            href="/dashboard"
            className="mt-6 inline-flex items-center justify-center rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-700"
          >
            Go to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="rounded-3xl bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-600 p-6 text-white shadow-sm md:p-8">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
          <div>
            <p className="mb-3 inline-flex rounded-full bg-white/15 px-4 py-1 text-sm font-medium">
              Admin Contribution Control
            </p>

            <h1 className="text-3xl font-bold md:text-4xl">
              Fund Space Contributions
            </h1>

            <p className="mt-4 max-w-3xl text-sm leading-7 text-emerald-50 md:text-base">
              Review, monitor, and confirm Fund Space contribution payments using accurate
              member, round, and group records.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/admin/fund-space"
                className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-emerald-700 hover:bg-emerald-50"
              >
                <Users size={16} />
                Fund Space Groups
              </Link>

              <Link
                href="/admin/fund-space/payouts"
                className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-5 py-3 text-sm font-bold text-white ring-1 ring-white/20 hover:bg-white/20"
              >
                <Banknote size={16} />
                Payout Approvals
              </Link>
            </div>
          </div>

          <div className="flex flex-col gap-3 lg:items-end">
            {adminProfile && (
              <div className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/15">
                <ShieldCheck size={16} />
                {adminProfile.full_name || 'Admin'}
              </div>
            )}

            <button
              type="button"
              onClick={loadContributions}
              disabled={refreshing}
              className="inline-flex min-h-12 w-fit items-center justify-center gap-2 rounded-xl bg-white/15 px-5 py-3 text-sm font-bold text-white hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {errorMessage && (
        <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-700">
          {errorMessage}
        </div>
      )}

      {successMessage && (
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">
          {successMessage}
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="mb-4 inline-flex rounded-2xl bg-emerald-50 p-3 text-emerald-700">
            <CalendarDays size={24} />
          </div>
          <p className="text-sm text-gray-500">Total Records</p>
          <h3 className="mt-1 text-2xl font-black text-gray-900">
            {stats.total_records}
          </h3>
        </div>

        <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="mb-4 inline-flex rounded-2xl bg-amber-50 p-3 text-amber-700">
            <Clock size={24} />
          </div>
          <p className="text-sm text-gray-500">Pending</p>
          <h3 className="mt-1 text-2xl font-black text-gray-900">
            {stats.pending_records}
          </h3>
        </div>

        <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="mb-4 inline-flex rounded-2xl bg-emerald-50 p-3 text-emerald-700">
            <CheckCircle2 size={24} />
          </div>
          <p className="text-sm text-gray-500">Paid / Confirmed</p>
          <h3 className="mt-1 text-2xl font-black text-gray-900">
            {stats.paid_records}
          </h3>
        </div>

        <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="mb-4 inline-flex rounded-2xl bg-red-50 p-3 text-red-700">
            <ShieldAlert size={24} />
          </div>
          <p className="text-sm text-gray-500">Overdue / Failed</p>
          <h3 className="mt-1 text-2xl font-black text-gray-900">
            {stats.overdue_records + stats.failed_records}
          </h3>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">Total Amount Due</p>
          <h3 className="mt-1 text-2xl font-black text-gray-900">
            {formatCurrency(stats.total_due)}
          </h3>
        </div>

        <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">Total Amount Paid</p>
          <h3 className="mt-1 text-2xl font-black text-emerald-700">
            {formatCurrency(stats.total_paid)}
          </h3>
        </div>
      </div>

      {overdueContributions.length > 0 && (
        <div className="rounded-3xl border border-red-100 bg-red-50 p-6 shadow-sm">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div>
              <h2 className="text-xl font-bold text-red-800">
                Overdue / Default Risk Contributors
              </h2>
              <p className="mt-1 text-sm text-red-700">
                These members need attention because their contributions are overdue, failed, or defaulted.
              </p>
            </div>

            <span className="rounded-full border border-red-200 bg-white px-4 py-2 text-sm font-bold text-red-700">
              {overdueContributions.length} record{overdueContributions.length === 1 ? '' : 's'}
            </span>
          </div>

          <div className="mt-6 overflow-hidden rounded-2xl border border-red-100 bg-white">
            <div className="divide-y divide-red-50">
              {overdueContributions.slice(0, 8).map((item) => {
                const isActionLoading = actionLoadingId === item.id;

                return (
                  <div
                    key={item.id}
                    className="flex flex-col justify-between gap-4 p-4 lg:flex-row lg:items-center"
                  >
                    <div>
                      <p className="font-bold text-gray-900">
                        {getMemberName(item)}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        {item.profile?.phone || 'No phone'} • {item.profile?.email || 'No email'}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        {getGroupName(item)} • Round {item.round?.round_number ?? 'Unknown'} • Deadline:{' '}
                        {formatDate(item.round?.contribution_deadline)}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <div className="rounded-xl bg-red-50 px-4 py-2">
                        <p className="text-xs font-semibold text-red-600">Due</p>
                        <p className="text-sm font-black text-red-800">
                          {formatCurrency(item.amount_due)}
                        </p>
                      </div>

                      <div className="rounded-xl bg-emerald-50 px-4 py-2">
                        <p className="text-xs font-semibold text-emerald-600">Paid</p>
                        <p className="text-sm font-black text-emerald-800">
                          {formatCurrency(item.amount_paid)}
                        </p>
                      </div>

                      <Link
                        href={`/admin/fund-space/${item.fund_space_id}`}
                        className="inline-flex items-center gap-2 rounded-xl border border-red-100 bg-white px-4 py-2 text-xs font-bold text-red-700 hover:bg-red-50"
                      >
                        View Group
                        <ArrowRight size={14} />
                      </Link>

                      <button
                        type="button"
                        disabled={isActionLoading}
                        onClick={() => openConfirmModal(item)}
                        className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                      >
                        {isActionLoading && <Loader2 className="h-3 w-3 animate-spin" />}
                        Confirm Payment
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {overdueContributions.length > 8 && (
            <p className="mt-4 text-sm text-red-700">
              Showing first 8 overdue/default-risk records. Use the status filter below to view all.
            </p>
          )}
        </div>
      )}

      <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="flex flex-col justify-between gap-5 xl:flex-row xl:items-center">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              Contribution Records
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Search, filter, and confirm Fund Space contribution payments.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-4 xl:min-w-[980px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search member, phone, group, ref..."
                className="min-h-11 w-full rounded-xl border border-gray-200 bg-white pl-10 pr-4 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="min-h-11 rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-700 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            >
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status === 'ALL' ? 'All Statuses' : status}
                </option>
              ))}
            </select>

            <select
              value={groupFilter}
              onChange={(event) => setGroupFilter(event.target.value)}
              className="min-h-11 rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-700 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            >
              <option value="ALL">All Groups</option>
              {groupOptions.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>

            <select
              value={amountFilter}
              onChange={(event) => setAmountFilter(event.target.value)}
              className="min-h-11 rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-700 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            >
              <option value="ALL">All Amounts</option>
              <option value="50">GH₵50</option>
              <option value="100">GH₵100</option>
              <option value="200">GH₵200</option>
              <option value="500">GH₵500</option>
            </select>
          </div>
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border border-gray-100">
          {filteredContributions.length === 0 ? (
            <div className="p-10 text-center">
              <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-amber-500" />
              <h3 className="text-lg font-bold text-gray-900">
                No contribution records found
              </h3>
              <p className="mt-2 text-sm text-gray-500">
                Try changing your search or filters.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1280px] text-left">
                <thead className="border-b border-gray-100 bg-gray-50">
                  <tr>
                    <th className="px-4 py-4 text-xs font-bold uppercase tracking-wide text-gray-500">
                      Member
                    </th>
                    <th className="px-4 py-4 text-xs font-bold uppercase tracking-wide text-gray-500">
                      Fund Space
                    </th>
                    <th className="px-4 py-4 text-xs font-bold uppercase tracking-wide text-gray-500">
                      Round
                    </th>
                    <th className="px-4 py-4 text-xs font-bold uppercase tracking-wide text-gray-500">
                      Due
                    </th>
                    <th className="px-4 py-4 text-xs font-bold uppercase tracking-wide text-gray-500">
                      Paid
                    </th>
                    <th className="px-4 py-4 text-xs font-bold uppercase tracking-wide text-gray-500">
                      Method / Ref
                    </th>
                    <th className="px-4 py-4 text-xs font-bold uppercase tracking-wide text-gray-500">
                      Paid At
                    </th>
                    <th className="px-4 py-4 text-xs font-bold uppercase tracking-wide text-gray-500">
                      Status
                    </th>
                    <th className="px-4 py-4 text-right text-xs font-bold uppercase tracking-wide text-gray-500">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                  {filteredContributions.map((item) => {
                    const status = item.status || 'PENDING';
                    const isPending = confirmableStatuses.includes(status);
                    const isConfirmed = ['CONFIRMED', 'PAID'].includes(status);
                    const isActionLoading = actionLoadingId === item.id;

                    return (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-4 py-4">
                          <p className="font-bold text-gray-900">
                            {getMemberName(item)}
                          </p>
                          <p className="mt-1 text-xs text-gray-500">
                            {item.profile?.phone || 'No phone'} •{' '}
                            {item.profile?.email || 'No email'}
                          </p>
                          <p className="mt-1 text-xs font-semibold text-gray-400">
                            {item.profile?.verification_status || 'Verification unknown'}
                          </p>
                        </td>

                        <td className="px-4 py-4">
                          <p className="font-bold text-gray-900">
                            {getGroupName(item)}
                          </p>
                          <p className="mt-1 text-xs text-gray-500">
                            Group status: {item.fund_space?.status || 'Unknown'}
                          </p>
                          <Link
                            href={`/admin/fund-space/${item.fund_space_id}`}
                            className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:text-emerald-700"
                          >
                            View group
                            <ArrowRight size={12} />
                          </Link>
                        </td>

                        <td className="px-4 py-4">
                          <p className="font-semibold text-gray-900">
                            Round {item.round?.round_number ?? 'Unknown'}
                          </p>
                          <p className="mt-1 text-xs text-gray-500">
                            Deadline: {formatDate(item.round?.contribution_deadline)}
                          </p>
                          <p className="mt-1 text-xs text-gray-500">
                            Round status: {item.round?.status || 'Unknown'}
                          </p>
                        </td>

                        <td className="px-4 py-4">
                          <p className="font-bold text-gray-900">
                            {formatCurrency(item.amount_due)}
                          </p>
                        </td>

                        <td className="px-4 py-4">
                          <p className="font-bold text-emerald-700">
                            {formatCurrency(item.amount_paid)}
                          </p>
                        </td>

                        <td className="px-4 py-4">
                          <p className="font-semibold text-gray-900">
                            {item.payment_method || 'Not set'}
                          </p>
                          <p className="mt-1 max-w-[170px] truncate text-xs text-gray-500">
                            {item.payment_reference || 'No reference'}
                          </p>
                        </td>

                        <td className="px-4 py-4">
                          <p className="text-sm text-gray-600">
                            {formatDateTime(item.paid_at)}
                          </p>
                        </td>

                        <td className="px-4 py-4">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-bold ${getStatusStyle(
                              item.status
                            )}`}
                          >
                            {isConfirmed && <CheckCircle2 size={13} />}
                            {!isConfirmed &&
                              ['OVERDUE', 'FAILED', 'DEFAULTED'].includes(status) && (
                                <XCircle size={13} />
                              )}
                            {status}
                          </span>
                        </td>

                        <td className="px-4 py-4 text-right">
                          {isPending ? (
                            <button
                              type="button"
                              disabled={isActionLoading}
                              onClick={() => openConfirmModal(item)}
                              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                            >
                              {isActionLoading && (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              )}
                              Confirm
                            </button>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-xl bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-700">
                              <CheckCircle2 size={13} />
                              Confirmed
                            </span>
                          )}
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

      <div className="rounded-3xl border border-amber-100 bg-amber-50 p-6">
        <h2 className="text-lg font-bold text-amber-800">
          Admin contribution safety reminder
        </h2>

        <p className="mt-2 text-sm leading-6 text-amber-700">
          Only confirm a contribution after checking real payment evidence such as MoMo confirmation,
          cash receipt, payment reference, or trusted agent report. Confirming wrong contributions
          can affect payout safety and user trust.
        </p>
      </div>

      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-8">
          <div className="w-full max-w-xl rounded-3xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-black text-gray-900">
                  Confirm Contribution
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Confirm payment only after verifying the real transaction evidence.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                disabled={actionLoadingId === confirmModal.contribution.id}
                className="rounded-xl border border-gray-100 p-2 text-gray-500 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-5 rounded-2xl border border-gray-100 bg-gray-50 p-4">
              <p className="font-bold text-gray-900">
                {getMemberName(confirmModal.contribution)}
              </p>
              <p className="mt-1 text-sm text-gray-500">
                {getGroupName(confirmModal.contribution)} • Round{' '}
                {confirmModal.contribution.round?.round_number ?? 'Unknown'}
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-white p-3">
                  <p className="text-xs font-semibold text-gray-500">Amount Due</p>
                  <p className="mt-1 font-black text-gray-900">
                    {formatCurrency(confirmModal.contribution.amount_due)}
                  </p>
                </div>
                <div className="rounded-xl bg-white p-3">
                  <p className="text-xs font-semibold text-gray-500">Current Paid</p>
                  <p className="mt-1 font-black text-emerald-700">
                    {formatCurrency(confirmModal.contribution.amount_paid)}
                  </p>
                </div>
              </div>
            </div>

            <form onSubmit={handleConfirmContribution} className="mt-5 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-bold text-gray-700">
                  Amount Received
                </label>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  value={confirmModal.amount}
                  onChange={(event) =>
                    setConfirmModal((current) =>
                      current ? { ...current, amount: event.target.value } : current
                    )
                  }
                  className="min-h-12 w-full rounded-xl border border-gray-200 px-4 text-sm font-semibold outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  placeholder="Enter amount received"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-gray-700">
                  Payment Method
                </label>
                <select
                  value={confirmModal.paymentMethod}
                  onChange={(event) =>
                    setConfirmModal((current) =>
                      current ? { ...current, paymentMethod: event.target.value } : current
                    )
                  }
                  className="min-h-12 w-full rounded-xl border border-gray-200 px-4 text-sm font-semibold outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                >
                  <option value="CASH">Cash</option>
                  <option value="MOMO">Mobile Money</option>
                  <option value="BANK">Bank Transfer</option>
                  <option value="AGENT">Agent Report</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-gray-700">
                  Payment Reference / Note
                </label>
                <input
                  value={confirmModal.paymentReference}
                  onChange={(event) =>
                    setConfirmModal((current) =>
                      current
                        ? { ...current, paymentReference: event.target.value }
                        : current
                    )
                  }
                  className="min-h-12 w-full rounded-xl border border-gray-200 px-4 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  placeholder="MoMo reference, receipt number, or admin note"
                />
              </div>

              <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm leading-6 text-amber-800">
                By confirming this contribution, the system may check whether the round is ready
                for payout. Make sure the payment evidence is correct before submitting.
              </div>

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setConfirmModal(null)}
                  disabled={actionLoadingId === confirmModal.contribution.id}
                  className="inline-flex min-h-12 items-center justify-center rounded-xl border border-gray-200 px-5 text-sm font-bold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={actionLoadingId === confirmModal.contribution.id}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 text-sm font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                >
                  {actionLoadingId === confirmModal.contribution.id && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                  Confirm Contribution
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}