'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  Clock,
  Eye,
  Info,
  Loader2,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Store,
  UserPlus,
  UserRound,
  Users,
  WalletCards,
  XCircle,
} from 'lucide-react';

import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

type CustomerProfile = {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  role: string | null;
  status: string | null;
  user_category: string | null;
  verification_status: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  location: string | null;
  occupation: string | null;
  business_name: string | null;
  business_type: string | null;
  business_location: string | null;
  momo_number: string | null;
  bank_name: string | null;
  trust_score: number | null;
  created_at: string | null;
  updated_at: string | null;
};

type AgentCustomer = {
  relationship_id: string;
  id: string;
  agent_id: string | null;
  customer_id: string;
  relationship_status: string | null;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
  profile: CustomerProfile | null;
};

type CustomersApiResponse = {
  success: boolean;
  message?: string;
  customers?: unknown[];
  stats?: {
    total: number;
    active: number;
    pending: number;
    verified: number;
    rejected: number;
  };
};

type FundSpaceCustomer = {
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

type FundSpaceCustomersResponse = {
  success: boolean;
  message?: string;
  summary?: {
    total_customers: number;
    verified_customers: number;
    eligible_customers: number;
    already_in_fund_space: number;
    blocked_customers: number;
  };
  customers?: FundSpaceCustomer[];
};

type FilterType =
  | 'ALL'
  | 'ACTIVE'
  | 'VERIFIED'
  | 'PENDING'
  | 'REJECTED'
  | 'IN_FUND_SPACE'
  | 'NOT_JOINED';

const filterTabs: { label: string; value: FilterType }[] = [
  { label: 'All', value: 'ALL' },
  { label: 'Active', value: 'ACTIVE' },
  { label: 'Verified', value: 'VERIFIED' },
  { label: 'Pending KYC', value: 'PENDING' },
  { label: 'Rejected', value: 'REJECTED' },
  { label: 'In Fund Space', value: 'IN_FUND_SPACE' },
  { label: 'Not Joined', value: 'NOT_JOINED' },
];

function normalize(value: string | null | undefined) {
  return String(value || '').trim().toUpperCase();
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

function formatCurrency(amount: number | null | undefined) {
  return `GH₵${Number(amount || 0).toLocaleString('en-GH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatLabel(value: string | null | undefined) {
  if (!value) return 'Not set';

  return value
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getStatusStyle(status: string | null | undefined) {
  const value = normalize(status || 'PENDING');

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
      'UNVERIFIED',
      'PENDING_VERIFICATION',
      'UNDER_REVIEW',
      'PENDING_REVIEW',
      'FORMING',
      'COLLECTING',
    ].includes(value)
  ) {
    return 'border-amber-200 bg-amber-50 text-amber-700';
  }

  if (
    [
      'REJECTED',
      'INACTIVE',
      'SUSPENDED',
      'BLACKLISTED',
      'FAILED',
      'CANCELLED',
      'DEFAULTED',
      'REMOVED',
    ].includes(value)
  ) {
    return 'border-red-200 bg-red-50 text-red-700';
  }

  if (value === 'TRANSFERRED') {
    return 'border-purple-200 bg-purple-50 text-purple-700';
  }

  return 'border-slate-200 bg-slate-50 text-slate-700';
}

function getTrustShieldLabel(profile: CustomerProfile | null) {
  const verificationStatus = normalize(profile?.verification_status);
  const accountStatus = normalize(profile?.status);

  if (verificationStatus === 'VERIFIED' && accountStatus === 'ACTIVE') {
    return 'Verified Trust Profile';
  }

  if (verificationStatus === 'VERIFIED') {
    return 'Verified Identity';
  }

  if (
    ['PENDING', 'UNVERIFIED', 'PENDING_VERIFICATION', 'UNDER_REVIEW'].includes(
      verificationStatus
    )
  ) {
    return 'Trust Review Pending';
  }

  if (['REJECTED', 'SUSPENDED', 'BLACKLISTED'].includes(verificationStatus)) {
    return 'Trust Action Needed';
  }

  return 'Trust Shield Review';
}

function getTransparencyLabel(
  joined: boolean,
  fundSpaceCustomer: FundSpaceCustomer | null
) {
  if (!joined) return 'Not in Fund Space';

  const groupStatus = normalize(fundSpaceCustomer?.fund_space?.status);

  if (groupStatus === 'ACTIVE') return 'Live Group Active';
  if (groupStatus === 'FORMING') return 'Group Forming';
  if (groupStatus === 'COMPLETED') return 'Group Completed';
  if (groupStatus === 'PAUSED') return 'Group Paused';

  return 'Transparency Available';
}

function getProfileName(profile: CustomerProfile | null) {
  return profile?.full_name || 'Unnamed customer';
}

function getProfileInitial(profile: CustomerProfile | null) {
  return getProfileName(profile).slice(0, 1).toUpperCase();
}

function getProfilePhone(profile: CustomerProfile | null) {
  return profile?.phone || 'No phone';
}

function getProfileLocation(profile: CustomerProfile | null) {
  if (!profile) return 'No location';

  return (
    profile.location ||
    profile.city ||
    profile.region ||
    profile.country ||
    'No location'
  );
}

function getProfileWork(profile: CustomerProfile | null) {
  if (!profile) return 'Not provided';

  return (
    profile.business_name ||
    profile.business_type ||
    profile.occupation ||
    'Not provided'
  );
}

function isInFundSpace(
  customerId: string,
  fundSpaceCustomerMap: Map<string, FundSpaceCustomer>
) {
  const item = fundSpaceCustomerMap.get(customerId);

  return Boolean(item?.fund_space_member || item?.fund_space);
}

function normalizeCustomerFromApi(item: any): AgentCustomer {
  const profile = (item.profile || item.customer || null) as CustomerProfile | null;

  const customerId =
    item.customer_id ||
    item.profile?.id ||
    item.customer?.id ||
    item.id ||
    profile?.id ||
    '';

  const relationshipId = item.relationship_id || item.agent_customer?.id || item.id;

  return {
    relationship_id: relationshipId,
    id: relationshipId,
    agent_id: item.agent_id || item.agent_customer?.agent_id || null,
    customer_id: customerId,
    relationship_status:
      item.relationship_status ||
      item.agent_customer?.relationship_status ||
      item.status ||
      'ACTIVE',
    notes: item.notes || item.agent_customer?.notes || null,
    created_at:
      item.assigned_at ||
      item.created_at ||
      item.agent_customer?.created_at ||
      profile?.created_at ||
      null,
    updated_at: item.updated_at || item.agent_customer?.updated_at || null,
    profile,
  };
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

export default function AgentCustomersPage() {
  const { profile, loading } = useAuth();

  const [customers, setCustomers] = useState<AgentCustomer[]>([]);
  const [fundSpaceCustomers, setFundSpaceCustomers] = useState<
    FundSpaceCustomer[]
  >([]);

  const [pageLoading, setPageLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('ALL');

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
    async (showRefresh = false) => {
      try {
        if (showRefresh) {
          setRefreshing(true);
        } else {
          setPageLoading(true);
        }

        setErrorMessage('');

        const token = await getAccessToken();

        const [customersResponse, fundSpaceResponse] = await Promise.all([
          fetch('/api/agent/customers', {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }),
          fetch('/api/agent/fund-space/customers', {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }),
        ]);

        const customersResult = (await customersResponse.json().catch(
          () => null
        )) as CustomersApiResponse | null;

        if (!customersResponse.ok || !customersResult?.success) {
          throw new Error(
            customersResult?.message || 'Unable to load your customers.'
          );
        }

        const fundSpaceResult = (await fundSpaceResponse.json().catch(
          () => null
        )) as FundSpaceCustomersResponse | null;

        setCustomers(
          (customersResult.customers || []).map((item) =>
            normalizeCustomerFromApi(item)
          )
        );

        if (fundSpaceResponse.ok && fundSpaceResult?.success) {
          setFundSpaceCustomers(fundSpaceResult.customers || []);
        } else {
          setFundSpaceCustomers([]);
        }
      } catch (error) {
        console.error('Agent customers load error:', error);

        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'Unable to load customers.'
        );

        setCustomers([]);
        setFundSpaceCustomers([]);
      } finally {
        setPageLoading(false);
        setRefreshing(false);
      }
    },
    [getAccessToken]
  );

  useEffect(() => {
    if (loading) return;

    if (!profile?.id) {
      setPageLoading(false);
      setErrorMessage('Unable to identify your agent account. Please log in again.');
      return;
    }

    loadCustomers();
  }, [loading, profile?.id, loadCustomers]);

  const fundSpaceCustomerMap = useMemo(() => {
    return new Map(fundSpaceCustomers.map((item) => [item.id, item]));
  }, [fundSpaceCustomers]);

  const stats = useMemo(() => {
    const total = customers.length;

    const active = customers.filter(
      (customer) =>
        normalize(customer.relationship_status) === 'ACTIVE' ||
        normalize(customer.profile?.status) === 'ACTIVE'
    ).length;

    const verified = customers.filter((customer) =>
      ['VERIFIED', 'APPROVED'].includes(
        normalize(customer.profile?.verification_status)
      )
    ).length;

    const pending = customers.filter((customer) =>
      ['PENDING', 'UNVERIFIED', 'PENDING_VERIFICATION', 'UNDER_REVIEW'].includes(
        normalize(customer.profile?.verification_status)
      )
    ).length;

    const rejected = customers.filter((customer) =>
      ['REJECTED', 'SUSPENDED', 'BLACKLISTED'].includes(
        normalize(customer.profile?.verification_status)
      )
    ).length;

    const inFundSpace = customers.filter((customer) =>
      isInFundSpace(customer.customer_id, fundSpaceCustomerMap)
    ).length;

    const notJoined = Math.max(total - inFundSpace, 0);

    return {
      total,
      active,
      verified,
      pending,
      rejected,
      inFundSpace,
      notJoined,
    };
  }, [customers, fundSpaceCustomerMap]);

  const filteredCustomers = useMemo(() => {
    const searchValue = searchTerm.trim().toLowerCase();

    return customers.filter((customer) => {
      const profileData = customer.profile;
      const verificationStatus = normalize(profileData?.verification_status);
      const relationshipStatus = normalize(customer.relationship_status);
      const accountStatus = normalize(profileData?.status);
      const joined = isInFundSpace(customer.customer_id, fundSpaceCustomerMap);

      const matchesSearch =
        !searchValue ||
        [
          profileData?.full_name,
          profileData?.phone,
          profileData?.email,
          profileData?.country,
          profileData?.region,
          profileData?.city,
          profileData?.location,
          profileData?.occupation,
          profileData?.business_name,
          profileData?.business_type,
          profileData?.business_location,
          profileData?.user_category,
          profileData?.verification_status,
          profileData?.status,
          customer.relationship_status,
        ].some((value) => String(value || '').toLowerCase().includes(searchValue));

      const matchesFilter =
        activeFilter === 'ALL' ||
        (activeFilter === 'ACTIVE' &&
          (relationshipStatus === 'ACTIVE' || accountStatus === 'ACTIVE')) ||
        (activeFilter === 'VERIFIED' &&
          ['VERIFIED', 'APPROVED'].includes(verificationStatus)) ||
        (activeFilter === 'PENDING' &&
          [
            'PENDING',
            'UNVERIFIED',
            'PENDING_VERIFICATION',
            'UNDER_REVIEW',
          ].includes(verificationStatus)) ||
        (activeFilter === 'REJECTED' &&
          ['REJECTED', 'SUSPENDED', 'BLACKLISTED'].includes(
            verificationStatus
          )) ||
        (activeFilter === 'IN_FUND_SPACE' && joined) ||
        (activeFilter === 'NOT_JOINED' && !joined);

      return matchesSearch && matchesFilter;
    });
  }, [activeFilter, customers, fundSpaceCustomerMap, searchTerm]);

  if (loading || pageLoading) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-6 md:px-8">
        <div className="mx-auto flex min-h-[60vh] max-w-7xl items-center justify-center">
          <div className="text-center">
            <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-emerald-700" />
            <h1 className="text-lg font-black text-slate-900">
              Loading customers...
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Please wait while TrustPoint loads your registered customers.
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-5 md:px-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <section className="rounded-3xl bg-gradient-to-br from-emerald-800 via-emerald-700 to-teal-700 p-5 text-white shadow-sm md:p-8">
          <div className="flex flex-col justify-between gap-6 xl:flex-row xl:items-center">
            <div className="min-w-0 max-w-4xl">
              <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-xs font-black">
                <Users className="h-4 w-4" />
                Agent Customers
              </p>

              <h1 className="break-words text-2xl font-black md:text-4xl">
                Manage your registered customers
              </h1>

              <p className="mt-4 max-w-3xl text-sm font-semibold leading-7 text-emerald-50 md:text-base">
                Search customers, check their verification status, review their
                profile, and continue to Fund Space payment collection when they
                are already joined.
              </p>

              <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <HeroStat label="Total Customers" value={stats.total} />
                <HeroStat label="Verified" value={stats.verified} />
                <HeroStat label="In Fund Space" value={stats.inFundSpace} />
                <HeroStat label="Not Joined" value={stats.notJoined} />
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
                disabled={refreshing}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-white/15 px-5 text-sm font-black text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
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

        {errorMessage && (
          <section className="rounded-3xl border border-red-200 bg-red-50 p-5 text-sm font-bold text-red-700">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
              <div className="min-w-0">
                <p className="break-words">{errorMessage}</p>

                {errorMessage.toLowerCase().includes('session') && (
                  <Link
                    href="/auth/login"
                    className="mt-3 inline-flex rounded-xl bg-white px-4 py-2 text-xs font-black text-red-700 shadow-sm"
                  >
                    Go to login
                  </Link>
                )}
              </div>
            </div>
          </section>
        )}

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-7">
          <StatCard
            title="Total"
            value={stats.total}
            description="All customers"
            icon={<Users className="h-5 w-5" />}
          />

          <StatCard
            title="Active"
            value={stats.active}
            description="Active relationship"
            icon={<CheckCircle2 className="h-5 w-5" />}
          />

          <StatCard
            title="Verified"
            value={stats.verified}
            description="Approved KYC"
            icon={<ShieldCheck className="h-5 w-5" />}
          />

          <StatCard
            title="Pending"
            value={stats.pending}
            description="Waiting review"
            icon={<Clock className="h-5 w-5" />}
          />

          <StatCard
            title="Rejected"
            value={stats.rejected}
            description="Needs correction"
            icon={<ShieldAlert className="h-5 w-5" />}
          />

          <StatCard
            title="In Fund Space"
            value={stats.inFundSpace}
            description="Payment active"
            icon={<WalletCards className="h-5 w-5" />}
          />

          <StatCard
            title="Not Joined"
            value={stats.notJoined}
            description="Check eligibility"
            icon={<XCircle className="h-5 w-5" />}
          />
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <div className="grid gap-4 xl:grid-cols-[1fr_auto] xl:items-center">
            <div className="min-w-0">
              <h2 className="text-xl font-black text-slate-900">
                Customer List
              </h2>
              <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">
                Open a customer profile to review identity, Trust Shield, and
                Fund Space eligibility.
              </p>
            </div>

            <Link
              href="/agent/fund-space"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-5 text-sm font-black text-white transition hover:bg-emerald-800"
            >
              Customer Fund Space
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="relative mt-5">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search by name, phone, email, location, business, or status..."
              className="min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm font-bold text-slate-700 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-50"
            />
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {filterTabs.map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setActiveFilter(tab.value)}
                className={`rounded-xl px-4 py-2.5 text-sm font-black transition ${
                  activeFilter === tab.value
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
          {filteredCustomers.length === 0 ? (
            <EmptyCustomersBlock />
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredCustomers.map((customer) => {
                const joined = isInFundSpace(
                  customer.customer_id,
                  fundSpaceCustomerMap
                );

                const fundSpaceCustomer = fundSpaceCustomerMap.get(
                  customer.customer_id
                );

                return (
                  <CustomerRow
                    key={customer.relationship_id}
                    customer={customer}
                    joined={joined}
                    fundSpaceCustomer={fundSpaceCustomer || null}
                  />
                );
              })}
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-amber-100 bg-amber-50 p-5">
          <div className="flex items-start gap-3">
            <BadgeCheck className="mt-1 h-5 w-5 shrink-0 text-amber-700" />

            <div className="min-w-0">
              <h2 className="text-base font-black text-amber-900">
                Customer management reminder
              </h2>

              <p className="mt-2 break-words text-sm font-semibold leading-6 text-amber-700">
                Review customer details carefully before adding them to Fund
                Space. Verified identity, correct phone number, correct MoMo
                number, and accurate location help protect the group.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
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

function TrustTransparencyBox({
  label,
  value,
  icon,
  tone = 'slate',
}: {
  label: string;
  value: string;
  icon: ReactNode;
  tone?: 'emerald' | 'amber' | 'slate';
}) {
  const toneClass =
    tone === 'emerald'
      ? 'border-emerald-100 bg-emerald-50 text-emerald-800'
      : tone === 'amber'
        ? 'border-amber-100 bg-amber-50 text-amber-800'
        : 'border-slate-200 bg-white text-slate-800';

  return (
    <div className={`min-w-0 rounded-2xl border p-4 ${toneClass}`}>
      <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wide opacity-70">
        {icon}
        <span className="break-words">{label}</span>
      </div>
      <p className="mt-2 break-words text-sm font-black leading-6">{value}</p>
    </div>
  );
}

function CustomerRow({
  customer,
  joined,
  fundSpaceCustomer,
}: {
  customer: AgentCustomer;
  joined: boolean;
  fundSpaceCustomer: FundSpaceCustomer | null;
}) {
  const profileData = customer.profile;
  const customerName = getProfileName(profileData);
  const customerPhone = getProfilePhone(profileData);
  const customerLocation = getProfileLocation(profileData);
  const customerWork = getProfileWork(profileData);

  const trustShieldLabel = getTrustShieldLabel(profileData);
  const transparencyLabel = getTransparencyLabel(joined, fundSpaceCustomer);

  return (
    <article className="p-5 md:p-6">
      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <div className="min-w-0">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-sm font-black text-emerald-700">
                {getProfileInitial(profileData)}
              </div>

              <div className="min-w-0">
                <h3 className="break-words text-xl font-black text-slate-900">
                  {customerName}
                </h3>

                <p className="mt-1 break-words text-sm font-semibold text-slate-500">
                  {customerPhone} • {customerLocation}
                </p>

                <p className="mt-1 break-words text-xs font-semibold text-slate-500">
                  {customerWork} • Registered: {formatDate(customer.created_at)}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <StatusPill status={profileData?.verification_status} />
              <StatusPill status={profileData?.status} />
              <StatusPill status={customer.relationship_status} />
              {joined && <StatusPill status="IN_FUND_SPACE" />}
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <InfoBox
              label="Phone"
              value={
                <span className="inline-flex items-center gap-2">
                  <Phone className="h-4 w-4 text-slate-400" />
                  {customerPhone}
                </span>
              }
            />

            <InfoBox
              label="Email"
              value={
                <span className="inline-flex items-center gap-2">
                  <Mail className="h-4 w-4 text-slate-400" />
                  {profileData?.email || 'Not provided'}
                </span>
              }
            />

            <InfoBox
              label="Location"
              value={
                <span className="inline-flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-slate-400" />
                  {customerLocation}
                </span>
              }
            />

            <InfoBox
              label="Category"
              value={
                <span className="inline-flex items-center gap-2">
                  <UserRound className="h-4 w-4 text-slate-400" />
                  {formatLabel(profileData?.user_category)}
                </span>
              }
            />
          </div>

          {joined && fundSpaceCustomer?.fund_space && (
            <div className="mt-5 rounded-3xl border border-emerald-100 bg-emerald-50 p-5">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-black text-emerald-800">
                    Customer is in Fund Space
                  </p>
                  <p className="mt-1 break-words text-sm font-semibold leading-6 text-emerald-700">
                    {fundSpaceCustomer.fund_space.name} •{' '}
                    {formatCurrency(
                      fundSpaceCustomer.fund_space.contribution_amount
                    )}{' '}
                    weekly • {formatLabel(fundSpaceCustomer.fund_space.status)} •
                    Round {fundSpaceCustomer.fund_space.current_round_number || 0}
                  </p>
                </div>

                <Link
                  href={`/agent/fund-space/${customer.customer_id}`}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-5 text-sm font-black text-white transition hover:bg-emerald-800"
                >
                  <Smartphone className="h-4 w-4" />
                  Collect Payment
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
          <p className="mb-4 text-sm font-black text-slate-900">
            Customer Actions
          </p>

          <div className="space-y-3">
            <Link
              href={`/agent/customers/${customer.customer_id}`}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 text-sm font-black text-slate-700 transition hover:bg-slate-50"
            >
              <Eye className="h-4 w-4" />
              View Customer Profile
              <ArrowRight className="h-4 w-4" />
            </Link>

            {joined ? (
              <Link
                href={`/agent/fund-space/${customer.customer_id}`}
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-5 text-sm font-black text-white transition hover:bg-emerald-800"
              >
                <Smartphone className="h-4 w-4" />
                Open Fund Space Payment Page
                <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <Link
                href={`/agent/customers/${customer.customer_id}`}
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-amber-600 px-5 text-sm font-black text-white transition hover:bg-amber-700"
              >
                <Info className="h-4 w-4" />
                Check Fund Space Eligibility
                <ArrowRight className="h-4 w-4" />
              </Link>
            )}
          </div>

          <div className="mt-5 rounded-3xl border border-slate-200 bg-white p-4">
            <div className="mb-4 flex items-start gap-3">
              <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-700">
                <ShieldCheck className="h-5 w-5" />
              </div>

              <div className="min-w-0">
                <p className="text-sm font-black text-slate-900">
                  Trust & Transparency
                </p>
                <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
                  Review Trust Shield and Fund Space visibility before collecting
                  payments.
                </p>
              </div>
            </div>

            <div className="grid gap-3">
              <TrustTransparencyBox
                label="Trust Shield"
                value={trustShieldLabel}
                icon={<ShieldCheck className="h-4 w-4" />}
                tone={
                  normalize(profileData?.verification_status) === 'VERIFIED'
                    ? 'emerald'
                    : 'amber'
                }
              />

              <TrustTransparencyBox
                label="Verification"
                value={formatLabel(profileData?.verification_status)}
                icon={<BadgeCheck className="h-4 w-4" />}
                tone={
                  normalize(profileData?.verification_status) === 'VERIFIED'
                    ? 'emerald'
                    : 'amber'
                }
              />

              <TrustTransparencyBox
                label="Transparency"
                value={transparencyLabel}
                icon={<WalletCards className="h-4 w-4" />}
                tone={joined ? 'emerald' : 'amber'}
              />

              {joined && fundSpaceCustomer?.fund_space && (
                <>
                  <TrustTransparencyBox
                    label="Weekly Amount"
                    value={formatCurrency(
                      fundSpaceCustomer.fund_space.contribution_amount
                    )}
                    icon={<Smartphone className="h-4 w-4" />}
                    tone="slate"
                  />

                  <TrustTransparencyBox
                    label="Current Round"
                    value={`Round ${
                      fundSpaceCustomer.fund_space.current_round_number || 0
                    }`}
                    icon={<Clock className="h-4 w-4" />}
                    tone="slate"
                  />

                  <TrustTransparencyBox
                    label="Member Status"
                    value={formatLabel(fundSpaceCustomer.fund_space_member?.status)}
                    icon={<CheckCircle2 className="h-4 w-4" />}
                    tone={
                      normalize(fundSpaceCustomer.fund_space_member?.status) ===
                      'ACTIVE'
                        ? 'emerald'
                        : 'amber'
                    }
                  />
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

function EmptyCustomersBlock() {
  return (
    <div className="flex min-h-[360px] flex-col items-center justify-center p-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-50">
        <Store className="h-9 w-9 text-slate-400" />
      </div>

      <h2 className="mt-4 text-lg font-black text-slate-900">
        No customers found
      </h2>

      <p className="mt-2 max-w-md text-sm font-semibold leading-6 text-slate-500">
        No customer matches your current search or filter. Register a customer
        or refresh the page.
      </p>

      <Link
        href="/agent/register-customer"
        className="mt-5 inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-5 text-sm font-black text-white transition hover:bg-emerald-800"
      >
        Register Customer
        <UserPlus className="h-4 w-4" />
      </Link>
    </div>
  );
}