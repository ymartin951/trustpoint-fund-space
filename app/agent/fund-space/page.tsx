'use client';

import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  CircleDollarSign,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  Smartphone,
  UserPlus,
  Users,
  Wallet,
  XCircle,
} from 'lucide-react';

import { supabase } from '@/lib/supabase/client';

const contributionAmounts = [50, 100, 200, 500];

type FilterType = 'ALL' | 'NEEDS_PAYMENT' | 'JOINED' | 'ELIGIBLE' | 'BLOCKED';

type Summary = {
  total_customers: number;
  verified_customers: number;
  eligible_customers: number;
  already_in_fund_space: number;
  blocked_customers: number;
};

type AgentCustomer = {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  location: string | null;
  city: string | null;
  region: string | null;
  occupation: string | null;
  business_name: string | null;
  business_type: string | null;
  user_category: string;
  status: string;
  verification_status: string;
  is_blacklisted: boolean;
  created_at: string | null;
  agent_customer: {
    id: string;
    relationship_status: string;
    created_at: string | null;
    notes: string | null;
  } | null;
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

type CustomersApiResponse = {
  success: boolean;
  message?: string;
  summary?: Summary;
  customers?: AgentCustomer[];
};

type JoinApiResponse = {
  success: boolean;
  message?: string;
  mode?: string;
  fund_space?: {
    id: string;
    name: string;
    status: string;
    contribution_amount: number;
    member_count?: number;
    max_members?: number;
  };
};

function formatCurrency(amount: number | null | undefined) {
  return `GH₵${Number(amount || 0).toLocaleString('en-GH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(dateString: string | null | undefined) {
  if (!dateString) return 'Not available';

  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) return 'Invalid date';

  return new Intl.DateTimeFormat('en-GH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

function formatLabel(value: string | null | undefined) {
  if (!value) return 'Not set';

  return value
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getStatusStyle(status: string | null | undefined) {
  const value = String(status || 'PENDING').toUpperCase();

  if (
    ['ACTIVE', 'VERIFIED', 'APPROVED', 'COMPLETED', 'PAID', 'SUCCESS'].includes(
      value
    )
  ) {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }

  if (
    [
      'PENDING',
      'FORMING',
      'PENDING_VERIFICATION',
      'PENDING_REVIEW',
      'PARTIALLY_PAID',
      'COLLECTING',
    ].includes(value)
  ) {
    return 'border-amber-200 bg-amber-50 text-amber-700';
  }

  if (
    [
      'REJECTED',
      'FAILED',
      'INACTIVE',
      'SUSPENDED',
      'BLACKLISTED',
      'REMOVED',
      'DEFAULTED',
      'CANCELLED',
      'BLOCKED',
    ].includes(value)
  ) {
    return 'border-red-200 bg-red-50 text-red-700';
  }

  return 'border-slate-200 bg-slate-50 text-slate-700';
}

function getCustomerLocation(customer: AgentCustomer) {
  return customer.location || customer.city || customer.region || 'Not provided';
}

function getCustomerWork(customer: AgentCustomer) {
  return (
    customer.business_name ||
    customer.business_type ||
    customer.occupation ||
    'Not provided'
  );
}

function isCustomerJoined(customer: AgentCustomer) {
  return Boolean(customer.fund_space_member || customer.fund_space);
}

function getDefaultSummary(): Summary {
  return {
    total_customers: 0,
    verified_customers: 0,
    eligible_customers: 0,
    already_in_fund_space: 0,
    blocked_customers: 0,
  };
}

export default function AgentFundSpacePage() {
  const [customers, setCustomers] = useState<AgentCustomer[]>([]);
  const [summary, setSummary] = useState<Summary>(getDefaultSummary());
  const [selectedAmounts, setSelectedAmounts] = useState<Record<string, number>>(
    {}
  );

  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<FilterType>('ALL');

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoadingCustomerId, setActionLoadingCustomerId] = useState<
    string | null
  >(null);

  const [message, setMessage] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

  const getAccessToken = useCallback(async () => {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error) {
      throw new Error(error.message || 'Unable to read your login session.');
    }

    if (!session?.access_token) {
      throw new Error(
        'Your session has expired. Please log in again, then return to Customer Fund Space.'
      );
    }

    return session.access_token;
  }, []);

  const loadCustomers = useCallback(
    async (showRefreshState = false) => {
      try {
        if (showRefreshState) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setMessage(null);

        const token = await getAccessToken();

        const response = await fetch('/api/agent/fund-space/customers', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const result = (await response.json().catch(() => null)) as
          | CustomersApiResponse
          | null;

        if (!response.ok || !result?.success) {
          throw new Error(
            result?.message || 'Could not load your Fund Space customers.'
          );
        }

        const loadedCustomers = result.customers || [];

        setCustomers(loadedCustomers);
        setSummary(result.summary || getDefaultSummary());

        const defaultAmounts: Record<string, number> = {};

        for (const customer of loadedCustomers) {
          if (customer.can_add_to_fund_space && !isCustomerJoined(customer)) {
            defaultAmounts[customer.id] =
              customer.fund_space?.contribution_amount ||
              customer.fund_space_member?.contribution_amount ||
              contributionAmounts[0];
          }
        }

        setSelectedAmounts((current) => ({
          ...defaultAmounts,
          ...current,
        }));
      } catch (error) {
        const text =
          error instanceof Error
            ? error.message
            : 'Something went wrong while loading customers.';

        setMessage({
          type: 'error',
          text,
        });

        setCustomers([]);
        setSummary(getDefaultSummary());
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [getAccessToken]
  );

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  const workStats = useMemo(() => {
    const joined = customers.filter((customer) => isCustomerJoined(customer));
    const eligible = customers.filter(
      (customer) => customer.can_add_to_fund_space && !isCustomerJoined(customer)
    );
    const blocked = customers.filter(
      (customer) => !customer.can_add_to_fund_space && !isCustomerJoined(customer)
    );

    return {
      joined: joined.length,
      eligible: eligible.length,
      blocked: blocked.length,
      needsPayment: joined.length,
    };
  }, [customers]);

  const filteredCustomers = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return customers.filter((customer) => {
      const matchesSearch =
        !normalizedSearch ||
        customer.full_name?.toLowerCase().includes(normalizedSearch) ||
        customer.phone?.toLowerCase().includes(normalizedSearch) ||
        customer.email?.toLowerCase().includes(normalizedSearch) ||
        customer.location?.toLowerCase().includes(normalizedSearch) ||
        customer.city?.toLowerCase().includes(normalizedSearch) ||
        customer.region?.toLowerCase().includes(normalizedSearch) ||
        customer.business_name?.toLowerCase().includes(normalizedSearch) ||
        customer.business_type?.toLowerCase().includes(normalizedSearch);

      const joined = isCustomerJoined(customer);

      const matchesFilter =
        filter === 'ALL' ||
        (filter === 'NEEDS_PAYMENT' && joined) ||
        (filter === 'JOINED' && joined) ||
        (filter === 'ELIGIBLE' && customer.can_add_to_fund_space && !joined) ||
        (filter === 'BLOCKED' && !customer.can_add_to_fund_space && !joined);

      return matchesSearch && matchesFilter;
    });
  }, [customers, searchTerm, filter]);

  function handleAmountChange(customerId: string, amount: number) {
    setSelectedAmounts((current) => ({
      ...current,
      [customerId]: amount,
    }));
  }

  async function handleAddToFundSpace(customer: AgentCustomer) {
    try {
      setMessage(null);
      setActionLoadingCustomerId(customer.id);

      const contributionAmount = selectedAmounts[customer.id];

      if (!contributionAmount) {
        throw new Error('Please select a weekly contribution amount first.');
      }

      const token = await getAccessToken();

      const response = await fetch('/api/fund-space/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          customer_id: customer.id,
          contribution_amount: contributionAmount,
        }),
      });

      const result = (await response.json().catch(() => null)) as
        | JoinApiResponse
        | null;

      if (!response.ok || !result?.success) {
        throw new Error(
          result?.message || 'Could not add customer to Fund Space.'
        );
      }

      setMessage({
        type: 'success',
        text:
          result.message ||
          `${customer.full_name} has been added to Fund Space successfully.`,
      });

      await loadCustomers(true);
    } catch (error) {
      setMessage({
        type: 'error',
        text:
          error instanceof Error
            ? error.message
            : 'Something went wrong while adding customer to Fund Space.',
      });
    } finally {
      setActionLoadingCustomerId(null);
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-3xl bg-gradient-to-br from-emerald-800 via-emerald-700 to-teal-700 p-5 text-white shadow-sm md:p-8">
        <div className="flex flex-col justify-between gap-6 xl:flex-row xl:items-center">
          <div className="min-w-0 max-w-4xl">
            <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-xs font-black">
              <Users className="h-4 w-4" />
              Customer Fund Space
            </p>

            <h1 className="break-words text-2xl font-black md:text-4xl">
              Manage customer Fund Space payments
            </h1>

            <p className="mt-4 max-w-3xl text-sm font-semibold leading-7 text-emerald-50 md:text-base">
              This is your agent worklist. Add eligible verified customers to
              Fund Space, then open each customer’s Fund Space page to collect
              weekly MoMo payments and view group transparency.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <HeroStat
                label="Total Customers"
                value={summary.total_customers}
              />
              <HeroStat
                label="Already In Fund Space"
                value={summary.already_in_fund_space}
              />
              <HeroStat
                label="Eligible To Add"
                value={summary.eligible_customers}
              />
              <HeroStat label="Blocked" value={summary.blocked_customers} />
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row xl:flex-col">
            <Link
              href="/agent/register-customer"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-white px-5 text-sm font-black text-emerald-700 shadow-sm hover:bg-emerald-50"
            >
              <UserPlus className="h-4 w-4" />
              Register Customer
            </Link>

            <button
              type="button"
              onClick={() => loadCustomers(true)}
              disabled={loading || refreshing}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-white/15 px-5 text-sm font-black text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading || refreshing ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <RefreshCw size={16} />
              )}
              Refresh
            </button>
          </div>
        </div>
      </section>

      {message && (
        <AlertBox type={message.type}>
          {message.type === 'success' ? (
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
          ) : message.type === 'info' ? (
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
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

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          title="Total Customers"
          value={summary.total_customers}
          description="Registered under you"
          icon={<Users className="h-5 w-5" />}
        />

        <StatCard
          title="Verified"
          value={summary.verified_customers}
          description="Passed verification"
          icon={<ShieldCheck className="h-5 w-5" />}
        />

        <StatCard
          title="Eligible"
          value={workStats.eligible}
          description="Can be added now"
          icon={<CheckCircle2 className="h-5 w-5" />}
        />

        <StatCard
          title="In Fund Space"
          value={workStats.joined}
          description="Open to collect payment"
          icon={<Wallet className="h-5 w-5" />}
        />

        <StatCard
          title="Blocked"
          value={workStats.blocked}
          description="Not eligible now"
          icon={<XCircle className="h-5 w-5" />}
        />
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 xl:grid-cols-[1fr_auto] xl:items-center">
          <div className="min-w-0">
            <h2 className="text-xl font-black text-slate-900">
              Customer Fund Space Worklist
            </h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              Use this page to decide what to do next for each customer.
              Customers already in Fund Space should be opened for weekly
              payment collection.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {(['ALL', 'NEEDS_PAYMENT', 'ELIGIBLE', 'JOINED', 'BLOCKED'] as const).map(
              (item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setFilter(item)}
                  className={`rounded-xl px-4 py-2.5 text-sm font-black transition ${
                    filter === item
                      ? 'bg-emerald-700 text-white shadow-sm hover:bg-emerald-800'
                      : 'bg-slate-100 text-slate-700 hover:bg-emerald-50 hover:text-emerald-700'
                  }`}
                >
                  {item === 'ALL'
                    ? 'All'
                    : item === 'NEEDS_PAYMENT'
                      ? 'Collect Payment'
                      : item === 'ELIGIBLE'
                        ? 'Eligible'
                        : item === 'JOINED'
                          ? 'Joined'
                          : 'Blocked'}
                </button>
              )
            )}
          </div>
        </div>

        <div className="relative mt-5">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search by name, phone, location, or business..."
            className="min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm font-bold text-slate-700 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-50"
          />
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 p-8 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
            </div>
            <p className="text-sm font-bold text-slate-500">
              Loading your registered customers...
            </p>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 p-8 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-50">
              <Users className="h-8 w-8 text-slate-400" />
            </div>
            <h2 className="text-lg font-black text-slate-900">
              No customers found
            </h2>
            <p className="max-w-md text-sm font-semibold leading-6 text-slate-500">
              No customer matches your current search or filter. Try changing
              the filter, register a customer, or refresh the page.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredCustomers.map((customer) => {
              const selectedAmount = selectedAmounts[customer.id];
              const isAdding = actionLoadingCustomerId === customer.id;
              const joined = isCustomerJoined(customer);

              return (
                <CustomerWorklistRow
                  key={customer.id}
                  customer={customer}
                  selectedAmount={selectedAmount}
                  isAdding={isAdding}
                  joined={joined}
                  onAmountChange={(amount) =>
                    handleAmountChange(customer.id, amount)
                  }
                  onAdd={() => handleAddToFundSpace(customer)}
                />
              );
            })}
          </div>
        )}
      </section>
    </div>
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
      className={`flex items-start gap-3 rounded-3xl border p-5 text-sm font-bold ${
        type === 'success'
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
          : type === 'info'
            ? 'border-blue-200 bg-blue-50 text-blue-700'
            : 'border-red-200 bg-red-50 text-red-700'
      }`}
    >
      {children}
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
  icon,
  description,
}: {
  title: string;
  value: number;
  icon: ReactNode;
  description: string;
}) {
  return (
    <div className="min-w-0 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 inline-flex rounded-2xl bg-emerald-50 p-3 text-emerald-700">
        {icon}
      </div>

      <p className="break-words text-sm font-bold text-slate-500">{title}</p>
      <h3 className="mt-1 text-2xl font-black text-slate-900">{value}</h3>
      <p className="mt-1 break-words text-xs font-semibold leading-5 text-slate-500">
        {description}
      </p>
    </div>
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

function InfoBox({ label, value }: { label: string; value: ReactNode }) {
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

function CustomerWorklistRow({
  customer,
  selectedAmount,
  isAdding,
  joined,
  onAmountChange,
  onAdd,
}: {
  customer: AgentCustomer;
  selectedAmount: number | undefined;
  isAdding: boolean;
  joined: boolean;
  onAmountChange: (amount: number) => void;
  onAdd: () => void;
}) {
  return (
    <article className="p-5 md:p-6">
      <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
        <div className="min-w-0">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <h3 className="break-words text-xl font-black text-slate-900">
                {customer.full_name || 'Unknown customer'}
              </h3>

              <p className="mt-1 break-words text-sm font-semibold text-slate-500">
                {customer.phone || 'No phone'} • {getCustomerLocation(customer)}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <StatusPill status={customer.verification_status} />
              <StatusPill status={customer.status} />
              {customer.is_blacklisted && <StatusPill status="BLACKLISTED" />}
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <InfoBox label="Phone" value={customer.phone || 'Not provided'} />
            <InfoBox label="Location" value={getCustomerLocation(customer)} />
            <InfoBox
              label="Category"
              value={formatLabel(customer.user_category)}
            />
            <InfoBox label="Registered" value={formatDate(customer.created_at)} />
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            <InfoBox label="Work / Business" value={getCustomerWork(customer)} />
            <InfoBox
              label="Eligibility"
              value={customer.eligibility_reason || 'Not provided'}
            />
          </div>

          {joined && customer.fund_space && (
            <div className="mt-4 rounded-3xl border border-emerald-100 bg-emerald-50 p-5">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-black text-emerald-800">
                    Customer is already in Fund Space
                  </p>
                  <p className="mt-1 break-words text-sm font-semibold leading-6 text-emerald-700">
                    {customer.fund_space.name} •{' '}
                    {formatCurrency(customer.fund_space.contribution_amount)} •{' '}
                    {formatLabel(customer.fund_space.status)} • Round{' '}
                    {customer.fund_space.current_round_number || 0}
                  </p>
                </div>

                <Link
                  href={`/agent/fund-space/${customer.id}`}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-5 text-sm font-black text-white transition hover:bg-emerald-800"
                >
                  <Smartphone className="h-4 w-4" />
                  Collect / View Payments
                  <ArrowRight size={16} />
                </Link>
              </div>
            </div>
          )}

          {!joined && !customer.can_add_to_fund_space && (
            <div className="mt-4 rounded-3xl border border-amber-100 bg-amber-50 p-5 text-sm font-bold leading-6 text-amber-700">
              {customer.eligibility_reason ||
                'This customer is not eligible to join Fund Space yet.'}
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
          {joined ? (
            <div>
              <div className="mb-4 flex items-start gap-3">
                <div className="rounded-2xl bg-emerald-100 p-3 text-emerald-700">
                  <Wallet className="h-5 w-5" />
                </div>

                <div className="min-w-0">
                  <p className="text-sm font-black text-slate-900">
                    Weekly Collection
                  </p>
                  <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
                    Open the customer’s Fund Space page to collect payment.
                  </p>
                </div>
              </div>

              <Link
                href={`/agent/fund-space/${customer.id}`}
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-5 text-sm font-black text-white transition hover:bg-emerald-800"
              >
                Collect Payment
                <ArrowRight size={16} />
              </Link>

              <div className="mt-4 grid gap-3">
                <InfoBox
                  label="Weekly Amount"
                  value={formatCurrency(
                    customer.fund_space?.contribution_amount ||
                      customer.fund_space_member?.contribution_amount
                  )}
                />
                <InfoBox
                  label="Member Status"
                  value={formatLabel(customer.fund_space_member?.status)}
                />
              </div>
            </div>
          ) : (
            <div>
              <div className="mb-4 flex items-start gap-3">
                <div className="rounded-2xl bg-emerald-100 p-3 text-emerald-700">
                  <CircleDollarSign className="h-5 w-5" />
                </div>

                <div className="min-w-0">
                  <p className="text-sm font-black text-slate-900">
                    Add To Fund Space
                  </p>
                  <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
                    Choose the customer’s weekly contribution amount.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {contributionAmounts.map((amount) => (
                  <button
                    key={amount}
                    type="button"
                    disabled={!customer.can_add_to_fund_space || isAdding}
                    onClick={() => onAmountChange(amount)}
                    className={`rounded-xl border px-3 py-3 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-50 ${
                      selectedAmount === amount
                        ? 'border-emerald-700 bg-emerald-700 text-white shadow-sm'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700'
                    }`}
                  >
                    {formatCurrency(amount)}
                  </button>
                ))}
              </div>

              <button
                type="button"
                disabled={
                  !customer.can_add_to_fund_space || !selectedAmount || isAdding
                }
                onClick={onAdd}
                className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-5 text-sm font-black text-white shadow-sm transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {isAdding ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Adding...
                  </>
                ) : (
                  <>
                    Add Customer
                    <ArrowRight size={16} />
                  </>
                )}
              </button>

              <p className="mt-4 text-center text-xs font-semibold leading-5 text-slate-500">
                {customer.eligibility_reason}
              </p>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}