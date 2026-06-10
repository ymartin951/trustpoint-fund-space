'use client';

import type { ChangeEvent, FormEvent, ReactNode } from 'react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  Clock,
  FileImage,
  FileWarning,
  HelpCircle,
  Loader2,
  MessageSquareWarning,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  UploadCloud,
  UserRound,
  Users,
  WalletCards,
  X,
  XCircle,
} from 'lucide-react';

import { supabase } from '@/lib/supabase/client';

type DisputeStatus =
  | 'ALL'
  | 'OPEN'
  | 'UNDER_REVIEW'
  | 'WAITING_FOR_USER'
  | 'RESOLVED'
  | 'REJECTED'
  | 'CANCELLED';

type DisputeCategory =
  | 'MISSED_PAYOUT'
  | 'WRONG_PAYMENT_RECORD'
  | 'AGENT_MISCONDUCT'
  | 'SUSPICIOUS_MEMBER'
  | 'WRONG_CONTRIBUTION_STATUS'
  | 'VERIFICATION_ISSUE'
  | 'LATE_FEE_OR_PENALTY'
  | 'OTHER';

type Priority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

type FundSpaceOption = {
  id: string;
  name: string | null;
  status: string | null;
  contribution_amount: number | string | null;
  current_round_number: number | null;
};

type AgentFundSpaceCustomer = {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  status: string;
  verification_status: string;
  is_blacklisted: boolean;
  fund_space_member: {
    id: string;
    fund_space_id: string;
    contribution_amount: number;
    status: string;
    joined_at: string | null;
    joined_by_agent: string | null;
    position_number: number | null;
    payout_order: number | null;
  } | null;
  fund_space: {
    id: string;
    name: string;
    contribution_amount: number;
    status: string;
    member_limit: number;
    current_round_number: number;
  } | null;
  can_add_to_fund_space: boolean;
  eligibility_reason: string;
};

type AgentFundSpaceCustomersResponse = {
  success: boolean;
  message?: string;
  customers?: AgentFundSpaceCustomer[];
};

type Dispute = {
  id: string;
  user_id: string;
  fund_space_id: string | null;
  round_id: string | null;
  contribution_id: string | null;
  payout_id: string | null;
  related_user_id: string | null;
  subject: string;
  message: string;
  category: string;
  priority: string;
  evidence_url: string | null;
  status: string;
  admin_note: string | null;
  assigned_to: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  resolution_note: string | null;
  last_response_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  fund_space?: FundSpaceOption | null;
  related_user?: {
    id: string;
    full_name: string | null;
    phone: string | null;
    role: string | null;
  } | null;
  round?: {
    id: string;
    round_number: number | null;
    status: string | null;
    contribution_deadline: string | null;
  } | null;
};

type DisputesApiResponse = {
  success: boolean;
  message?: string;
  disputes?: Dispute[];
  summary?: {
    total: number;
    open: number;
    under_review: number;
    waiting_for_user: number;
    resolved: number;
    rejected: number;
    urgent: number;
    high: number;
  };
};

type CreateDisputeResponse = {
  success: boolean;
  message?: string;
  dispute?: Dispute;
};

const EVIDENCE_BUCKET = 'fund-space-dispute-evidence';

const emptySummary = {
  total: 0,
  open: 0,
  under_review: 0,
  waiting_for_user: 0,
  resolved: 0,
  rejected: 0,
  urgent: 0,
  high: 0,
};

const categoryOptions: {
  label: string;
  value: DisputeCategory;
  helper: string;
}[] = [
  {
    label: 'Wrong payment record',
    value: 'WRONG_PAYMENT_RECORD',
    helper: 'A customer payment, reference, or status is not correct.',
  },
  {
    label: 'Missed payout',
    value: 'MISSED_PAYOUT',
    helper: 'A payout was expected but has not been received.',
  },
  {
    label: 'Wrong contribution status',
    value: 'WRONG_CONTRIBUTION_STATUS',
    helper: 'A contribution is showing the wrong payment status.',
  },
  {
    label: 'Late fee or penalty',
    value: 'LATE_FEE_OR_PENALTY',
    helper: 'A penalty or late fee needs review.',
  },
  {
    label: 'Suspicious member',
    value: 'SUSPICIOUS_MEMBER',
    helper: 'Report suspicious customer/member behaviour.',
  },
  {
    label: 'Verification issue',
    value: 'VERIFICATION_ISSUE',
    helper: 'A verification issue needs admin attention.',
  },
  {
    label: 'Other complaint',
    value: 'OTHER',
    helper: 'Something else needs TrustPoint attention.',
  },
];

const statusTabs: { label: string; value: DisputeStatus }[] = [
  { label: 'All', value: 'ALL' },
  { label: 'Open', value: 'OPEN' },
  { label: 'Under Review', value: 'UNDER_REVIEW' },
  { label: 'Waiting', value: 'WAITING_FOR_USER' },
  { label: 'Resolved', value: 'RESOLVED' },
  { label: 'Rejected', value: 'REJECTED' },
];

const priorityOptions: { label: string; value: Priority }[] = [
  { label: 'Normal', value: 'NORMAL' },
  { label: 'High', value: 'HIGH' },
  { label: 'Urgent', value: 'URGENT' },
  { label: 'Low', value: 'LOW' },
];

function normalize(value: string | null | undefined) {
  return String(value || '').trim().toUpperCase();
}

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

function getStatusStyle(status: string | null | undefined) {
  const value = normalize(status);

  if (['RESOLVED', 'COMPLETED', 'APPROVED', 'ACTIVE'].includes(value)) {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }

  if (
    ['OPEN', 'UNDER_REVIEW', 'WAITING_FOR_USER', 'PENDING', 'NORMAL'].includes(
      value
    )
  ) {
    return 'border-amber-200 bg-amber-50 text-amber-700';
  }

  if (['REJECTED', 'CANCELLED', 'URGENT', 'HIGH'].includes(value)) {
    return 'border-red-200 bg-red-50 text-red-700';
  }

  return 'border-slate-200 bg-slate-50 text-slate-700';
}

function getPriorityStyle(priority: string | null | undefined) {
  const value = normalize(priority);

  if (value === 'URGENT') return 'border-red-200 bg-red-50 text-red-700';
  if (value === 'HIGH') return 'border-orange-200 bg-orange-50 text-orange-700';
  if (value === 'LOW') return 'border-slate-200 bg-slate-50 text-slate-700';

  return 'border-amber-200 bg-amber-50 text-amber-700';
}

function getCategoryHelper(category: string | null | undefined) {
  const found = categoryOptions.find((item) => item.value === category);
  return found?.helper || 'Support issue reported for admin review.';
}

function getCustomerName(customer: AgentFundSpaceCustomer | null | undefined) {
  return customer?.full_name || 'No customer selected';
}

function getFundSpaceName(dispute: Dispute) {
  return dispute.fund_space?.name || 'Fund Space not selected';
}

function getDisputeCustomerName(dispute: Dispute) {
  return (
    dispute.related_user?.full_name ||
    dispute.related_user?.phone ||
    'Customer not selected'
  );
}

function StatusPill({ status }: { status: string | null | undefined }) {
  return (
    <span
      className={`inline-flex max-w-full items-center rounded-full border px-3 py-1 text-xs font-black ${getStatusStyle(
        status
      )}`}
    >
      <span className="truncate">{formatLabel(status)}</span>
    </span>
  );
}

function PriorityPill({ priority }: { priority: string | null | undefined }) {
  return (
    <span
      className={`inline-flex max-w-full items-center rounded-full border px-3 py-1 text-xs font-black ${getPriorityStyle(
        priority
      )}`}
    >
      <span className="truncate">{formatLabel(priority)}</span>
    </span>
  );
}

export default function AgentFundSpaceDisputesPage() {
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [summary, setSummary] = useState(emptySummary);
  const [customers, setCustomers] = useState<AgentFundSpaceCustomer[]>([]);

  const [loading, setLoading] = useState(true);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [activeStatus, setActiveStatus] = useState<DisputeStatus>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [message, setMessage] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedFundSpaceId, setSelectedFundSpaceId] = useState('');
  const [category, setCategory] =
    useState<DisputeCategory>('WRONG_PAYMENT_RECORD');
  const [priority, setPriority] = useState<Priority>('NORMAL');
  const [subject, setSubject] = useState('');
  const [details, setDetails] = useState('');
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);

  const getAccessToken = useCallback(async () => {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error || !session?.access_token) {
      throw new Error('Your session has expired. Please log in again.');
    }

    return session.access_token;
  }, []);

  const loadCustomers = useCallback(
    async (token: string) => {
      try {
        setCustomersLoading(true);

        const response = await fetch('/api/agent/fund-space/customers', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const result = (await response.json().catch(() => null)) as
          | AgentFundSpaceCustomersResponse
          | null;

        if (!response.ok || !result?.success) {
          setCustomers([]);
          return;
        }

        setCustomers(result.customers || []);
      } catch (error) {
        console.warn(
          'Agent dispute customer load warning:',
          error instanceof Error ? error.message : error
        );
        setCustomers([]);
      } finally {
        setCustomersLoading(false);
      }
    },
    []
  );

  const loadDisputes = useCallback(
    async (showRefresh = false) => {
      try {
        if (showRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setMessage(null);

        const token = await getAccessToken();

        const response = await fetch('/api/fund-space/disputes', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const result = (await response.json().catch(() => null)) as
          | DisputesApiResponse
          | null;

        if (!response.ok || !result?.success) {
          throw new Error(result?.message || 'Could not load dispute records.');
        }

        setDisputes(result.disputes || []);
        setSummary(result.summary || emptySummary);

        await loadCustomers(token);
      } catch (error) {
        setMessage({
          type: 'error',
          text:
            error instanceof Error
              ? error.message
              : 'Unable to load dispute records.',
        });

        setDisputes([]);
        setSummary(emptySummary);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [getAccessToken, loadCustomers]
  );

  useEffect(() => {
    loadDisputes();
  }, [loadDisputes]);

  const customerOptions = useMemo(() => {
    return customers
      .filter((customer) => customer.fund_space_member || customer.fund_space)
      .sort((a, b) => getCustomerName(a).localeCompare(getCustomerName(b)));
  }, [customers]);

  const selectedCustomer = useMemo(() => {
    return customers.find((customer) => customer.id === selectedCustomerId) || null;
  }, [customers, selectedCustomerId]);

  useEffect(() => {
    if (!selectedCustomer) {
      setSelectedFundSpaceId('');
      return;
    }

    const fundSpaceId =
      selectedCustomer.fund_space?.id ||
      selectedCustomer.fund_space_member?.fund_space_id ||
      '';

    setSelectedFundSpaceId(fundSpaceId);
  }, [selectedCustomer]);

  const stats = useMemo(() => {
    const open = disputes.filter((item) => normalize(item.status) === 'OPEN');
    const underReview = disputes.filter(
      (item) => normalize(item.status) === 'UNDER_REVIEW'
    );
    const waiting = disputes.filter(
      (item) => normalize(item.status) === 'WAITING_FOR_USER'
    );
    const resolved = disputes.filter(
      (item) => normalize(item.status) === 'RESOLVED'
    );
    const rejected = disputes.filter(
      (item) => normalize(item.status) === 'REJECTED'
    );
    const urgent = disputes.filter(
      (item) => normalize(item.priority) === 'URGENT'
    );

    return {
      total: summary.total || disputes.length,
      open: summary.open || open.length,
      underReview: summary.under_review || underReview.length,
      waiting: summary.waiting_for_user || waiting.length,
      resolved: summary.resolved || resolved.length,
      rejected: summary.rejected || rejected.length,
      urgent: summary.urgent || urgent.length,
    };
  }, [disputes, summary]);

  const filteredDisputes = useMemo(() => {
    const searchValue = searchTerm.trim().toLowerCase();

    return disputes.filter((dispute) => {
      const matchesStatus =
        activeStatus === 'ALL' || normalize(dispute.status) === activeStatus;

      const matchesSearch =
        !searchValue ||
        [
          dispute.subject,
          dispute.message,
          dispute.category,
          dispute.priority,
          dispute.status,
          dispute.admin_note,
          dispute.resolution_note,
          dispute.fund_space?.name,
          dispute.related_user?.full_name,
          dispute.related_user?.phone,
          dispute.round?.round_number,
        ].some((value) =>
          String(value || '').toLowerCase().includes(searchValue)
        );

      return matchesStatus && matchesSearch;
    });
  }, [activeStatus, disputes, searchTerm]);

  async function uploadEvidence(token: string) {
    if (!evidenceFile) return null;

    const safeName = evidenceFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = `agent-disputes/${Date.now()}-${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from(EVIDENCE_BUCKET)
      .upload(filePath, evidenceFile, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      throw new Error(uploadError.message || 'Could not upload evidence file.');
    }

    const { data } = supabase.storage
      .from(EVIDENCE_BUCKET)
      .getPublicUrl(filePath);

    return data.publicUrl || null;
  }

  async function handleCreateDispute(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setSubmitting(true);
      setMessage(null);

      if (!subject.trim()) {
        throw new Error('Please enter a clear subject for this dispute.');
      }

      if (!details.trim()) {
        throw new Error('Please explain the issue before submitting.');
      }

      if (!selectedCustomerId) {
        throw new Error('Please select the customer/member involved.');
      }

      const token = await getAccessToken();
      const evidenceUrl = await uploadEvidence(token);

      const response = await fetch('/api/fund-space/disputes', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fund_space_id: selectedFundSpaceId || null,
          related_user_id: selectedCustomerId,
          category,
          priority,
          subject: subject.trim(),
          message: details.trim(),
          evidence_url: evidenceUrl,
        }),
      });

      const result = (await response.json().catch(() => null)) as
        | CreateDisputeResponse
        | null;

      if (!response.ok || !result?.success) {
        throw new Error(result?.message || 'Could not submit dispute.');
      }

      setMessage({
        type: 'success',
        text:
          result.message ||
          'Dispute submitted successfully. TrustPoint admin will review it.',
      });

      setCreateOpen(false);
      setSelectedCustomerId('');
      setSelectedFundSpaceId('');
      setCategory('WRONG_PAYMENT_RECORD');
      setPriority('NORMAL');
      setSubject('');
      setDetails('');
      setEvidenceFile(null);

      await loadDisputes(true);
    } catch (error) {
      setMessage({
        type: 'error',
        text:
          error instanceof Error
            ? error.message
            : 'Something went wrong while submitting dispute.',
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-6 md:px-8">
        <div className="mx-auto flex min-h-[60vh] max-w-7xl items-center justify-center">
          <div className="text-center">
            <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-emerald-700" />
            <h1 className="text-lg font-black text-slate-900">
              Loading dispute center...
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Please wait while TrustPoint loads your customer support cases.
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <>
      <main className="min-h-screen bg-slate-50 px-4 py-5 md:px-8">
        <div className="mx-auto max-w-7xl space-y-5">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <Link
              href="/agent"
              className="inline-flex min-h-11 w-fit items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-100"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Agent Control Center
            </Link>

            <button
              type="button"
              onClick={() => loadDisputes(true)}
              disabled={refreshing}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {refreshing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Refresh
            </button>
          </div>

          <section className="rounded-3xl bg-gradient-to-br from-emerald-800 via-emerald-700 to-teal-700 p-5 text-white shadow-sm md:p-8">
            <div className="flex flex-col justify-between gap-6 xl:flex-row xl:items-center">
              <div className="min-w-0 max-w-4xl">
                <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-xs font-black">
                  <MessageSquareWarning className="h-4 w-4" />
                  Agent Dispute & Support Center
                </p>

                <h1 className="break-words text-2xl font-black md:text-4xl">
                  Help customers report Fund Space issues
                </h1>

                <p className="mt-4 max-w-3xl text-sm font-semibold leading-7 text-emerald-50 md:text-base">
                  Use this page when a customer says a payment, payout, late
                  fee, verification, or contribution status is wrong. Submit the
                  case with evidence so admin can review it.
                </p>

                <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <HeroStat label="Total Cases" value={stats.total} />
                  <HeroStat label="Open" value={stats.open} />
                  <HeroStat label="Under Review" value={stats.underReview} />
                  <HeroStat label="Resolved" value={stats.resolved} />
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row xl:flex-col">
                <button
                  type="button"
                  onClick={() => setCreateOpen(true)}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-white px-5 text-sm font-black text-emerald-700 shadow-sm hover:bg-emerald-50"
                >
                  <Send className="h-4 w-4" />
                  Submit New Case
                </button>

                <Link
                  href="/agent/fund-space/contributions"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-white/15 px-5 text-sm font-black text-white transition hover:bg-white/20"
                >
                  <Smartphone className="h-4 w-4" />
                  Weekly Contributions
                </Link>
              </div>
            </div>
          </section>

          {message && (
            <AlertBox type={message.type}>
              {message.type === 'success' ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
              ) : (
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
              )}

              <div className="min-w-0">
                <p className="break-words">{message.text}</p>

                {message.text.toLowerCase().includes('session') && (
                  <Link
                    href="/auth/login"
                    className="mt-3 inline-flex rounded-xl bg-white px-4 py-2 text-xs font-black text-red-700 shadow-sm"
                  >
                    Go to login
                  </Link>
                )}
              </div>
            </AlertBox>
          )}

          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-7">
            <StatCard
              title="Total"
              value={stats.total}
              description="All support cases"
              icon={<FileWarning className="h-5 w-5" />}
            />
            <StatCard
              title="Open"
              value={stats.open}
              description="Needs attention"
              icon={<MessageSquareWarning className="h-5 w-5" />}
            />
            <StatCard
              title="Under Review"
              value={stats.underReview}
              description="Admin reviewing"
              icon={<Clock className="h-5 w-5" />}
            />
            <StatCard
              title="Waiting"
              value={stats.waiting}
              description="Customer/agent action"
              icon={<HelpCircle className="h-5 w-5" />}
            />
            <StatCard
              title="Resolved"
              value={stats.resolved}
              description="Completed cases"
              icon={<CheckCircle2 className="h-5 w-5" />}
            />
            <StatCard
              title="Rejected"
              value={stats.rejected}
              description="Not accepted"
              icon={<XCircle className="h-5 w-5" />}
            />
            <StatCard
              title="Urgent"
              value={stats.urgent}
              description="High priority"
              icon={<ShieldAlert className="h-5 w-5" />}
            />
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
            <div className="grid gap-4 xl:grid-cols-[1fr_auto] xl:items-center">
              <div className="min-w-0">
                <h2 className="text-xl font-black text-slate-900">
                  Dispute Records
                </h2>
                <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">
                  Search and filter customer support cases. Open cases should be
                  checked first, especially payment and payout issues.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-5 text-sm font-black text-white transition hover:bg-emerald-800"
              >
                Submit New Case
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>

            <div className="relative mt-5">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search by subject, customer, Fund Space, category, priority, status..."
                className="min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm font-bold text-slate-700 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-50"
              />
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {statusTabs.map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setActiveStatus(tab.value)}
                  className={`rounded-xl px-4 py-2.5 text-sm font-black transition ${
                    activeStatus === tab.value
                      ? 'bg-emerald-700 text-white shadow-sm hover:bg-emerald-800'
                      : 'bg-slate-100 text-slate-700 hover:bg-emerald-50 hover:text-emerald-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
            {filteredDisputes.length === 0 ? (
              <EmptyDisputesBlock onCreate={() => setCreateOpen(true)} />
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredDisputes.map((dispute) => (
                  <DisputeRow key={dispute.id} dispute={dispute} />
                ))}
              </div>
            )}
          </section>

          <section className="rounded-3xl border border-amber-100 bg-amber-50 p-5">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-1 h-5 w-5 shrink-0 text-amber-700" />

              <div className="min-w-0">
                <h2 className="text-base font-black text-amber-900">
                  Support reminder
                </h2>

                <p className="mt-2 break-words text-sm font-semibold leading-6 text-amber-700">
                  Before submitting a case, check the customer name, phone,
                  Fund Space, round, payment reference, and evidence. Clear
                  information helps admin resolve cases faster.
                </p>
              </div>
            </div>
          </section>
        </div>
      </main>

      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white shadow-xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white p-5">
              <div className="min-w-0">
                <h2 className="break-words text-xl font-black text-slate-900">
                  Submit Customer Support Case
                </h2>
                <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">
                  Report a Fund Space issue for admin review.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="rounded-2xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateDispute} className="space-y-5 p-5">
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm font-bold leading-6 text-amber-800">
                  Use this form only for real customer support issues. Attach a
                  screenshot when the issue involves MoMo reference, payment,
                  payout, or wrong status.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <FieldWrapper label="Customer / Member involved">
                  <select
                    value={selectedCustomerId}
                    onChange={(event) => setSelectedCustomerId(event.target.value)}
                    disabled={customersLoading}
                    className="min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-700 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  >
                    <option value="">
                      {customersLoading
                        ? 'Loading customers...'
                        : 'Select customer'}
                    </option>

                    {customerOptions.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.full_name} • {customer.phone || 'No phone'}
                      </option>
                    ))}
                  </select>
                </FieldWrapper>

                <FieldWrapper label="Fund Space">
                  <input
                    value={
                      selectedCustomer?.fund_space?.name ||
                      selectedCustomer?.fund_space_member?.fund_space_id ||
                      'Select customer first'
                    }
                    readOnly
                    className="min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-100 px-4 text-sm font-bold text-slate-600"
                  />
                </FieldWrapper>
              </div>

              {selectedCustomer && (
                <div className="grid gap-3 md:grid-cols-3">
                  <MiniInfo
                    label="Customer Status"
                    value={formatLabel(selectedCustomer.status)}
                  />
                  <MiniInfo
                    label="Verification"
                    value={formatLabel(selectedCustomer.verification_status)}
                  />
                  <MiniInfo
                    label="Weekly Amount"
                    value={formatCurrency(
                      selectedCustomer.fund_space?.contribution_amount ||
                        selectedCustomer.fund_space_member?.contribution_amount
                    )}
                  />
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <FieldWrapper label="Category">
                  <select
                    value={category}
                    onChange={(event) =>
                      setCategory(event.target.value as DisputeCategory)
                    }
                    className="min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-700 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  >
                    {categoryOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </FieldWrapper>

                <FieldWrapper label="Priority">
                  <select
                    value={priority}
                    onChange={(event) =>
                      setPriority(event.target.value as Priority)
                    }
                    className="min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-700 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  >
                    {priorityOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </FieldWrapper>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-black uppercase tracking-wide text-slate-400">
                  Category Helper
                </p>
                <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
                  {getCategoryHelper(category)}
                </p>
              </div>

              <FieldWrapper label="Subject">
                <input
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  placeholder="Example: Customer paid but contribution is still pending"
                  className="min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-700 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
              </FieldWrapper>

              <FieldWrapper label="Explain the issue">
                <textarea
                  value={details}
                  onChange={(event) => setDetails(event.target.value)}
                  rows={6}
                  placeholder="Explain what happened, customer name/phone, amount, MoMo reference, date, and what admin should check."
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold leading-6 text-slate-700 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
              </FieldWrapper>

              <FieldWrapper label="Evidence screenshot or image">
                <label className="flex min-h-24 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-center transition hover:border-emerald-300 hover:bg-emerald-50">
                  <UploadCloud className="mb-2 h-7 w-7 text-slate-400" />
                  <span className="text-sm font-black text-slate-700">
                    {evidenceFile ? evidenceFile.name : 'Upload evidence image'}
                  </span>
                  <span className="mt-1 text-xs font-semibold text-slate-500">
                    PNG, JPG, WEBP supported
                  </span>
                  <input
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/webp"
                    className="hidden"
                    onChange={(event: ChangeEvent<HTMLInputElement>) =>
                      setEvidenceFile(event.target.files?.[0] || null)
                    }
                  />
                </label>
              </FieldWrapper>

              <div className="flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setCreateOpen(false)}
                  className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-slate-200 px-5 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-5 text-sm font-bold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <Send size={18} />
                  )}
                  Submit Case
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

function AlertBox({
  type,
  children,
}: {
  type: 'success' | 'error' | 'info';
  children: ReactNode;
}) {
  return (
    <div
      className={`rounded-3xl border p-5 text-sm font-bold ${
        type === 'success'
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
          : type === 'info'
            ? 'border-blue-200 bg-blue-50 text-blue-700'
            : 'border-red-200 bg-red-50 text-red-700'
      }`}
    >
      <div className="flex items-start gap-3">{children}</div>
    </div>
  );
}

function HeroStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-0 rounded-2xl bg-white/15 px-4 py-3 backdrop-blur">
      <p className="break-words text-xs font-bold text-emerald-50">{label}</p>
      <p className="mt-1 text-2xl font-black text-white">{value}</p>
    </div>
  );
}

function StatCard({
  title,
  value,
  description,
  icon,
}: {
  title: string;
  value: string | number;
  description: string;
  icon: ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 inline-flex rounded-2xl bg-emerald-50 p-3 text-emerald-700">
        {icon}
      </div>

      <p className="break-words text-sm font-bold text-slate-500">{title}</p>
      <h3 className="mt-1 break-words text-2xl font-black text-slate-900">
        {value}
      </h3>
      <p className="mt-1 break-words text-xs font-semibold leading-5 text-slate-500">
        {description}
      </p>
    </div>
  );
}

function MiniInfo({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0 rounded-2xl bg-slate-50 p-4">
      <p className="break-words text-[11px] font-black uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <div className="mt-1 break-words text-sm font-bold leading-6 text-slate-800">
        {value}
      </div>
    </div>
  );
}

function FieldWrapper({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-black text-slate-700">
        {label}
      </label>
      {children}
    </div>
  );
}

function DisputeRow({ dispute }: { dispute: Dispute }) {
  return (
    <article className="p-5 md:p-6">
      <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
        <div className="min-w-0">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="mb-3 flex flex-wrap gap-2">
                <StatusPill status={dispute.status} />
                <PriorityPill priority={dispute.priority} />
                <StatusPill status={dispute.category} />
              </div>

              <h3 className="break-words text-xl font-black text-slate-900">
                {dispute.subject}
              </h3>

              <p className="mt-2 break-words text-sm font-semibold leading-6 text-slate-500">
                {dispute.message}
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MiniInfo label="Customer" value={getDisputeCustomerName(dispute)} />
            <MiniInfo label="Fund Space" value={getFundSpaceName(dispute)} />
            <MiniInfo
              label="Round"
              value={
                dispute.round?.round_number
                  ? `Round ${dispute.round.round_number}`
                  : 'Not selected'
              }
            />
            <MiniInfo label="Created" value={formatDateTime(dispute.created_at)} />
          </div>

          {dispute.admin_note && (
            <div className="mt-5 rounded-3xl border border-blue-100 bg-blue-50 p-5 text-blue-800">
              <p className="text-sm font-black">Admin Note</p>
              <p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-6">
                {dispute.admin_note}
              </p>
            </div>
          )}

          {dispute.resolution_note && (
            <div className="mt-5 rounded-3xl border border-emerald-100 bg-emerald-50 p-5 text-emerald-800">
              <p className="text-sm font-black">Resolution Note</p>
              <p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-6">
                {dispute.resolution_note}
              </p>
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
          <p className="mb-4 text-sm font-black text-slate-900">
            Case Summary
          </p>

          <div className="grid gap-3">
            <MiniInfo label="Status" value={formatLabel(dispute.status)} />
            <MiniInfo label="Priority" value={formatLabel(dispute.priority)} />
            <MiniInfo label="Category" value={formatLabel(dispute.category)} />
            <MiniInfo
              label="Last Response"
              value={formatDateTime(dispute.last_response_at)}
            />
            <MiniInfo
              label="Resolved At"
              value={formatDateTime(dispute.resolved_at)}
            />
          </div>

          {dispute.evidence_url && (
            <a
              href={dispute.evidence_url}
              target="_blank"
              rel="noreferrer"
              className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 text-sm font-black text-white transition hover:bg-slate-800"
            >
              <FileImage className="h-4 w-4" />
              View Evidence
            </a>
          )}

          {dispute.related_user_id && (
            <Link
              href={`/agent/customers/${dispute.related_user_id}`}
              className="mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 text-sm font-black text-slate-700 transition hover:bg-slate-50"
            >
              <UserRound className="h-4 w-4" />
              View Customer
              <ArrowRight className="h-4 w-4" />
            </Link>
          )}

          {dispute.related_user_id && (
            <Link
              href={`/agent/fund-space/${dispute.related_user_id}`}
              className="mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 text-sm font-black text-emerald-700 transition hover:bg-emerald-100"
            >
              <WalletCards className="h-4 w-4" />
              Open Fund Space Page
              <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}

function EmptyDisputesBlock({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex min-h-[360px] flex-col items-center justify-center p-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-50">
        <MessageSquareWarning className="h-9 w-9 text-slate-400" />
      </div>

      <h2 className="mt-4 text-lg font-black text-slate-900">
        No dispute records found
      </h2>

      <p className="mt-2 max-w-md text-sm font-semibold leading-6 text-slate-500">
        No case matches your current filter or search. Submit a case when a
        customer reports a real payment, payout, verification, or status issue.
      </p>

      <button
        type="button"
        onClick={onCreate}
        className="mt-5 inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-5 text-sm font-black text-white transition hover:bg-emerald-800"
      >
        Submit New Case
        <Send className="h-4 w-4" />
      </button>
    </div>
  );
}