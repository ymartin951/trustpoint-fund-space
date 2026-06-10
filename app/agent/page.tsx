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
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  Smartphone,
  Store,
  UserPlus,
  Users,
  WalletCards,
} from 'lucide-react';

import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

type CustomerProfile = {
  id: string;
  full_name: string | null;
  phone: string | null;
  email?: string | null;
  country?: string | null;
  region?: string | null;
  city?: string | null;
  location?: string | null;
  occupation?: string | null;
  business_name?: string | null;
  business_type?: string | null;
  business_location?: string | null;
  user_category?: string | null;
  verification_status?: string | null;
  status?: string | null;
  trust_score?: number | null;
  created_at?: string | null;
};

type AgentCustomer = {
  relationship_id: string;
  id: string;
  agent_id: string;
  customer_id: string;
  relationship_status: string | null;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
  profile: CustomerProfile | null;
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

type ContributionRecord = {
  id: string;
  fund_space_id: string;
  round_id: string;
  user_id: string;
  amount_due: number;
  amount_paid: number;
  status: string;
  payment_reference: string | null;
  paid_at: string | null;
  created_at: string | null;
  customer: {
    id: string;
    full_name: string;
    phone: string | null;
    location: string | null;
    city: string | null;
    region: string | null;
    verification_status: string;
    status: string;
  } | null;
  fund_space: {
    id: string;
    name: string;
    contribution_amount: number;
    status: string;
    member_limit: number;
    current_round_number: number;
  } | null;
  round: {
    id: string;
    round_number: number;
    recipient_user_id: string;
    contribution_amount: number;
    expected_total_amount: number;
    contribution_deadline: string;
    week_start_date: string;
    week_end_date: string;
    status: string;
  } | null;
};

type ContributionsResponse = {
  success: boolean;
  message?: string;
  summary?: {
    total_contributions: number;
    pending_contributions: number;
    paid_contributions: number;
    failed_contributions: number;
    total_amount_due: number;
    total_amount_paid: number;
  };
  contributions?: ContributionRecord[];
};

type ManualPaymentSubmission = {
  id: string;
  contribution_id: string;
  status: string;
  transaction_reference: string;
  total_amount_paid: number;
  rejection_reason: string | null;
  created_at: string | null;
  reviewed_at: string | null;
};

type ManualSubmissionsResponse = {
  success: boolean;
  message?: string;
  submissions?: ManualPaymentSubmission[];
};

type StatusFilter =
  | 'ALL'
  | 'NEEDS_PAYMENT'
  | 'PENDING_VERIFICATION'
  | 'VERIFIED'
  | 'IN_FUND_SPACE'
  | 'NOT_JOINED';

const statusTabs: { label: string; value: StatusFilter }[] = [
  { label: 'All', value: 'ALL' },
  { label: 'Needs Payment', value: 'NEEDS_PAYMENT' },
  { label: 'Pending Verification', value: 'PENDING_VERIFICATION' },
  { label: 'Verified', value: 'VERIFIED' },
  { label: 'In Fund Space', value: 'IN_FUND_SPACE' },
  { label: 'Not Joined', value: 'NOT_JOINED' },
];

function normalize(value: string | null | undefined) {
  return String(value || '').trim().toUpperCase();
}

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
      'PENDING_VERIFICATION',
      'UNDER_REVIEW',
      'PENDING_REVIEW',
      'PARTIALLY_PAID',
      'FORMING',
      'COLLECTING',
      'OVERDUE',
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

  return 'border-slate-200 bg-slate-50 text-slate-700';
}

function getCustomerName(customer: AgentCustomer) {
  return customer.profile?.full_name || 'Unnamed customer';
}

function getCustomerInitial(customer: AgentCustomer) {
  return getCustomerName(customer).slice(0, 1).toUpperCase();
}

function getCustomerPhone(customer: AgentCustomer) {
  return customer.profile?.phone || 'No phone number';
}

function getCustomerLocation(customer: AgentCustomer) {
  const profile = customer.profile;

  if (!profile) return 'No location';

  const locationParts = [
    profile.location,
    profile.city,
    profile.region,
    profile.country,
  ].filter(Boolean);

  return locationParts.length > 0 ? locationParts.join(', ') : 'No location';
}

function getCustomerWork(customer: AgentCustomer) {
  const profile = customer.profile;

  if (!profile) return 'No occupation';

  return (
    profile.occupation ||
    profile.business_type ||
    profile.business_name ||
    'No occupation'
  );
}

function normalizeCustomerFromApi(item: any): AgentCustomer {
  const relationshipId = item.relationship_id || item.id;
  const customerId = item.customer_id || item.profile?.id || item.id;

  return {
    relationship_id: relationshipId,
    id: relationshipId,
    agent_id: item.agent_id,
    customer_id: customerId,
    relationship_status: item.relationship_status || item.status || 'ACTIVE',
    notes: item.notes || null,
    created_at: item.created_at || item.profile?.created_at || null,
    updated_at: item.updated_at || null,
    profile: item.profile || null,
  };
}

function isPendingContribution(contribution: ContributionRecord) {
  return ['PENDING', 'OVERDUE', 'PARTIALLY_PAID'].includes(
    normalize(contribution.status)
  );
}

function isCustomerInFundSpace(
  customerId: string,
  fundSpaceCustomerMap: Map<string, FundSpaceCustomer>
) {
  const fundSpaceCustomer = fundSpaceCustomerMap.get(customerId);

  return Boolean(fundSpaceCustomer?.fund_space_member || fundSpaceCustomer?.fund_space);
}

export default function AgentDashboardPage() {
  const { profile, loading } = useAuth();

  const [customers, setCustomers] = useState<AgentCustomer[]>([]);
  const [fundSpaceCustomers, setFundSpaceCustomers] = useState<
    FundSpaceCustomer[]
  >([]);
  const [contributions, setContributions] = useState<ContributionRecord[]>([]);
  const [manualSubmissions, setManualSubmissions] = useState<
    ManualPaymentSubmission[]
  >([]);

  const [pageLoading, setPageLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<StatusFilter>('ALL');

  const getAuthToken = useCallback(async () => {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error || !session?.access_token) {
      throw new Error('Your session has expired. Please log in again.');
    }

    return session.access_token;
  }, []);

  const loadManualSubmissions = useCallback(
    async (token: string, contributionIds: string[]) => {
      try {
        if (contributionIds.length === 0) {
          setManualSubmissions([]);
          return;
        }

        const params = new URLSearchParams();
        params.set('contribution_ids', contributionIds.slice(0, 80).join(','));

        const response = await fetch(
          `/api/agent/fund-space/manual-payment-submissions?${params.toString()}`,
          {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const result = (await response.json().catch(() => null)) as
          | ManualSubmissionsResponse
          | null;

        if (!response.ok || !result?.success) {
          setManualSubmissions([]);
          return;
        }

        setManualSubmissions(result.submissions || []);
      } catch (error) {
        console.warn(
          'Agent dashboard manual submissions warning:',
          error instanceof Error ? error.message : error
        );
        setManualSubmissions([]);
      }
    },
    []
  );

  const loadAgentDashboard = useCallback(
    async (showRefresh = false) => {
      try {
        if (showRefresh) {
          setRefreshing(true);
        } else {
          setPageLoading(true);
        }

        setErrorMessage('');

        const token = await getAuthToken();

        const [customersResponse, fundSpaceCustomersResponse, contributionsResponse] =
          await Promise.all([
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
            fetch('/api/agent/fund-space/contributions', {
              method: 'GET',
              headers: {
                Authorization: `Bearer ${token}`,
              },
            }),
          ]);

        const customersResult = await customersResponse
          .json()
          .catch(() => null);

        if (!customersResponse.ok || !customersResult?.success) {
          throw new Error(
            customersResult?.message || 'Unable to load your agent customers.'
          );
        }

        const fundSpaceCustomersResult =
          (await fundSpaceCustomersResponse.json().catch(() => null)) as
            | FundSpaceCustomersResponse
            | null;

        const contributionsResult =
          (await contributionsResponse.json().catch(() => null)) as
            | ContributionsResponse
            | null;

        const loadedCustomers = (customersResult.customers || []).map(
          normalizeCustomerFromApi
        );

        const loadedFundSpaceCustomers =
          fundSpaceCustomersResponse.ok && fundSpaceCustomersResult?.success
            ? fundSpaceCustomersResult.customers || []
            : [];

        const loadedContributions =
          contributionsResponse.ok && contributionsResult?.success
            ? contributionsResult.contributions || []
            : [];

        setCustomers(loadedCustomers);
        setFundSpaceCustomers(loadedFundSpaceCustomers);
        setContributions(loadedContributions);

        const pendingContributionIds = loadedContributions
          .filter(isPendingContribution)
          .map((item) => item.id);

        await loadManualSubmissions(token, pendingContributionIds);
      } catch (error: unknown) {
        console.error('Agent dashboard load error:', error);

        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'Unable to load agent dashboard.'
        );

        setCustomers([]);
        setFundSpaceCustomers([]);
        setContributions([]);
        setManualSubmissions([]);
      } finally {
        setPageLoading(false);
        setRefreshing(false);
      }
    },
    [getAuthToken, loadManualSubmissions]
  );

  useEffect(() => {
    if (loading) return;

    if (!profile?.id) {
      setPageLoading(false);
      setErrorMessage('Unable to identify your agent account. Please log in again.');
      return;
    }

    loadAgentDashboard();
  }, [loading, profile?.id, loadAgentDashboard]);

  const fundSpaceCustomerMap = useMemo(() => {
    return new Map(fundSpaceCustomers.map((item) => [item.id, item]));
  }, [fundSpaceCustomers]);

  const pendingContributions = useMemo(() => {
    return contributions.filter(isPendingContribution);
  }, [contributions]);

  const pendingManualSubmissions = useMemo(() => {
    return manualSubmissions.filter(
      (item) => normalize(item.status) === 'PENDING_REVIEW'
    );
  }, [manualSubmissions]);

  const stats = useMemo(() => {
    const total = customers.length;

    const pendingVerification = customers.filter((customer) =>
      ['PENDING', 'PENDING_VERIFICATION', 'UNDER_REVIEW'].includes(
        normalize(customer.profile?.verification_status)
      )
    ).length;

    const verified = customers.filter((customer) =>
      ['VERIFIED', 'APPROVED'].includes(
        normalize(customer.profile?.verification_status)
      )
    ).length;

    const active = customers.filter(
      (customer) =>
        normalize(customer.relationship_status) === 'ACTIVE' ||
        normalize(customer.profile?.status) === 'ACTIVE'
    ).length;

    const inFundSpace = customers.filter((customer) =>
      isCustomerInFundSpace(customer.customer_id, fundSpaceCustomerMap)
    ).length;

    const notInFundSpace = Math.max(total - inFundSpace, 0);

    return {
      total,
      pendingVerification,
      verified,
      active,
      inFundSpace,
      notInFundSpace,
      pendingPayments: pendingContributions.length,
      pendingManualReviews: pendingManualSubmissions.length,
    };
  }, [customers, fundSpaceCustomerMap, pendingContributions, pendingManualSubmissions]);

  const filteredCustomers = useMemo(() => {
    const searchValue = searchTerm.trim().toLowerCase();

    return customers.filter((customer) => {
      const profileData = customer.profile;
      const inFundSpace = isCustomerInFundSpace(
        customer.customer_id,
        fundSpaceCustomerMap
      );

      const hasPendingPayment = pendingContributions.some(
        (contribution) => contribution.user_id === customer.customer_id
      );

      const matchesSearch =
        !searchValue ||
        [
          profileData?.full_name,
          profileData?.phone,
          profileData?.email,
          profileData?.location,
          profileData?.city,
          profileData?.region,
          profileData?.country,
          profileData?.occupation,
          profileData?.business_type,
          profileData?.business_name,
          profileData?.verification_status,
          profileData?.status,
          customer.relationship_status,
        ].some((value) => String(value || '').toLowerCase().includes(searchValue));

      const verificationStatus = normalize(profileData?.verification_status);

      const matchesFilter =
        activeFilter === 'ALL' ||
        (activeFilter === 'NEEDS_PAYMENT' && hasPendingPayment) ||
        (activeFilter === 'PENDING_VERIFICATION' &&
          ['PENDING', 'PENDING_VERIFICATION', 'UNDER_REVIEW'].includes(
            verificationStatus
          )) ||
        (activeFilter === 'VERIFIED' &&
          ['VERIFIED', 'APPROVED'].includes(verificationStatus)) ||
        (activeFilter === 'IN_FUND_SPACE' && inFundSpace) ||
        (activeFilter === 'NOT_JOINED' && !inFundSpace);

      return matchesSearch && matchesFilter;
    });
  }, [
    activeFilter,
    customers,
    fundSpaceCustomerMap,
    pendingContributions,
    searchTerm,
  ]);

  const recentCustomers = filteredCustomers.slice(0, 6);
  const recentPendingPayments = pendingContributions.slice(0, 5);

  if (loading || pageLoading) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-6 md:px-8">
        <div className="mx-auto flex min-h-[60vh] max-w-7xl items-center justify-center">
          <div className="text-center">
            <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-emerald-700" />
            <h1 className="text-lg font-black text-slate-900">
              Loading agent control center...
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Please wait while TrustPoint loads your customers and Fund Space work.
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
                <Store className="h-4 w-4" />
                Agent Control Center
              </p>

              <h1 className="break-words text-2xl font-black md:text-4xl">
                Welcome, {profile?.full_name || 'TrustPoint Agent'}
              </h1>

              <p className="mt-4 max-w-3xl text-sm font-semibold leading-7 text-emerald-50 md:text-base">
                Manage customers, register new people, check verification, add
                eligible customers to Fund Space, and collect weekly MoMo
                contributions.
              </p>

              <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <HeroStat label="Total Customers" value={stats.total} />
                <HeroStat label="In Fund Space" value={stats.inFundSpace} />
                <HeroStat label="Need Payment" value={stats.pendingPayments} />
                <HeroStat
                  label="MoMo Reviews"
                  value={stats.pendingManualReviews}
                />
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
                onClick={() => loadAgentDashboard(true)}
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
          <AlertBox>
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
          </AlertBox>
        )}

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <StatCard
            title="Total Customers"
            value={stats.total}
            description="Registered under you"
            icon={<Users className="h-5 w-5" />}
          />

          <StatCard
            title="Verified"
            value={stats.verified}
            description="Ready for trusted services"
            icon={<ShieldCheck className="h-5 w-5" />}
          />

          <StatCard
            title="Pending KYC"
            value={stats.pendingVerification}
            description="Waiting for review"
            icon={<Clock className="h-5 w-5" />}
          />

          <StatCard
            title="In Fund Space"
            value={stats.inFundSpace}
            description="Can be managed for payments"
            icon={<WalletCards className="h-5 w-5" />}
          />

          <StatCard
            title="Need Payment"
            value={stats.pendingPayments}
            description="Unpaid or partially paid"
            icon={<Smartphone className="h-5 w-5" />}
          />

          <StatCard
            title="MoMo Reviews"
            value={stats.pendingManualReviews}
            description="Awaiting admin check"
            icon={<BadgeCheck className="h-5 w-5" />}
          />
        </section>

        <section className="grid gap-5 xl:grid-cols-[1fr_380px]">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="min-w-0">
                <h2 className="text-xl font-black text-slate-900">
                  What needs your attention?
                </h2>
                <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">
                  Start with unpaid Fund Space contributions, then check
                  verification and customer profiles.
                </p>
              </div>

              <Link
                href="/agent/fund-space/contributions"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-5 text-sm font-black text-white transition hover:bg-emerald-800"
              >
                Open Weekly Contributions
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="mt-5 space-y-3">
              {recentPendingPayments.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
                  <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-emerald-500" />
                  <h3 className="font-black text-slate-900">
                    No pending customer contribution found
                  </h3>
                  <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
                    When customers have unpaid weekly contributions, they will
                    appear here for quick action.
                  </p>
                </div>
              ) : (
                recentPendingPayments.map((contribution) => (
                  <PendingPaymentRow
                    key={contribution.id}
                    contribution={contribution}
                    manualSubmission={manualSubmissions.find(
                      (submission) =>
                        submission.contribution_id === contribution.id &&
                        normalize(submission.status) === 'PENDING_REVIEW'
                    )}
                  />
                ))
              )}
            </div>
          </div>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
            <h2 className="text-lg font-black text-slate-900">Quick Actions</h2>
            <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">
              Use these shortcuts for your daily agent work.
            </p>

            <div className="mt-5 space-y-3">
              <ActionRow
                href="/agent/register-customer"
                icon={<UserPlus className="h-5 w-5" />}
                title="Register Customer"
                description="Create a new customer profile."
              />

              <ActionRow
                href="/agent/customers"
                icon={<Users className="h-5 w-5" />}
                title="View Customers"
                description="Open customer list and profiles."
              />

              <ActionRow
                href="/agent/fund-space"
                icon={<WalletCards className="h-5 w-5" />}
                title="Customer Fund Space"
                description="Add customers or collect payments."
              />

              <ActionRow
                href="/agent/fund-space/contributions"
                icon={<Smartphone className="h-5 w-5" />}
                title="Weekly Contributions"
                description="See customer payments due."
              />

              <ActionRow
                href="/agent/fund-space/disputes"
                icon={<AlertCircle className="h-5 w-5" />}
                title="Fund Space Disputes"
                description="Help customers report payment issues."
              />
            </div>
          </section>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <div className="grid gap-4 xl:grid-cols-[1fr_auto] xl:items-center">
            <div className="min-w-0">
              <h2 className="text-xl font-black text-slate-900">
                Recent Customers
              </h2>
              <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">
                Search customers and open their profile before adding them to
                Fund Space or collecting payments.
              </p>
            </div>

            <Link
              href="/agent/customers"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-5 text-sm font-black text-white transition hover:bg-emerald-800"
            >
              View All Customers
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="relative mt-5">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search by name, phone, location, business, or status..."
              className="min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm font-bold text-slate-700 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-50"
            />
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {statusTabs.map((tab) => (
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

          <div className="mt-6 space-y-4">
            {recentCustomers.length === 0 ? (
              <EmptyCustomersBlock />
            ) : (
              recentCustomers.map((customer) => (
                <CustomerRow
                  key={customer.relationship_id}
                  customer={customer}
                  inFundSpace={isCustomerInFundSpace(
                    customer.customer_id,
                    fundSpaceCustomerMap
                  )}
                  hasPendingPayment={pendingContributions.some(
                    (contribution) => contribution.user_id === customer.customer_id
                  )}
                />
              ))
            )}
          </div>
        </section>

        <section className="rounded-3xl border border-amber-100 bg-amber-50 p-5">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-1 h-5 w-5 shrink-0 text-amber-700" />

            <div className="min-w-0">
              <h2 className="text-base font-black text-amber-900">
                Agent Responsibility Reminder
              </h2>

              <p className="mt-2 break-words text-sm font-semibold leading-6 text-amber-700">
                Register only real customers with correct names, phone numbers,
                location, and payment details. Accurate records protect customer
                trust, verification, contributions, payouts, and withdrawals.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function AlertBox({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-3xl border border-red-200 bg-red-50 p-5 text-sm font-bold text-red-700">
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

function ActionRow({
  href,
  icon,
  title,
  description,
}: {
  href: string;
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group flex min-h-16 items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:border-emerald-200 hover:bg-emerald-50"
    >
      <div className="flex min-w-0 items-start gap-3">
        <div className="rounded-2xl bg-white p-3 text-emerald-700 shadow-sm">
          {icon}
        </div>

        <div className="min-w-0">
          <p className="break-words text-sm font-black text-slate-900 group-hover:text-emerald-800">
            {title}
          </p>
          <p className="mt-1 break-words text-xs font-semibold leading-5 text-slate-500">
            {description}
          </p>
        </div>
      </div>

      <ArrowRight className="h-4 w-4 shrink-0 text-slate-400 group-hover:text-emerald-700" />
    </Link>
  );
}

function PendingPaymentRow({
  contribution,
  manualSubmission,
}: {
  contribution: ContributionRecord;
  manualSubmission?: ManualPaymentSubmission;
}) {
  const customerName = contribution.customer?.full_name || 'Unnamed customer';
  const customerPhone = contribution.customer?.phone || 'No phone';
  const remaining = Math.max(
    Number(contribution.amount_due || 0) - Number(contribution.amount_paid || 0),
    0
  );

  return (
    <article className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
      <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill status={contribution.status} />
            {manualSubmission && <StatusPill status="PENDING_REVIEW" />}
          </div>

          <h3 className="mt-3 break-words text-lg font-black text-slate-900">
            {customerName}
          </h3>

          <p className="mt-1 break-words text-sm font-semibold text-slate-500">
            {customerPhone} • {contribution.fund_space?.name || 'Fund Space'} •
            Round {contribution.round?.round_number || 'N/A'}
          </p>

          <p className="mt-1 text-xs font-semibold text-slate-500">
            Deadline: {formatDate(contribution.round?.contribution_deadline)}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[380px]">
          <MiniInfo label="Due" value={formatCurrency(contribution.amount_due)} />
          <MiniInfo label="Paid" value={formatCurrency(contribution.amount_paid)} />
          <MiniInfo label="Remaining" value={formatCurrency(remaining)} />
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Link
          href={`/agent/fund-space/${contribution.user_id}`}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-4 text-sm font-black text-white transition hover:bg-emerald-800"
        >
          Collect Payment
          <ArrowRight className="h-4 w-4" />
        </Link>

        <Link
          href={`/agent/customers/${contribution.user_id}`}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 transition hover:bg-slate-50"
        >
          View Profile
        </Link>
      </div>
    </article>
  );
}

function MiniInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-2xl bg-white p-3">
      <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-1 break-words text-sm font-black text-slate-900">
        {value}
      </p>
    </div>
  );
}

function CustomerRow({
  customer,
  inFundSpace,
  hasPendingPayment,
}: {
  customer: AgentCustomer;
  inFundSpace: boolean;
  hasPendingPayment: boolean;
}) {
  const name = getCustomerName(customer);
  const phone = getCustomerPhone(customer);
  const location = getCustomerLocation(customer);
  const work = getCustomerWork(customer);
  const verificationStatus = customer.profile?.verification_status || 'PENDING';
  const relationshipStatus =
    customer.relationship_status || customer.profile?.status || 'ACTIVE';

  return (
    <article className="rounded-3xl border border-slate-200 bg-slate-50 p-4 transition hover:border-emerald-100 hover:bg-emerald-50/40">
      <div className="grid gap-4 xl:grid-cols-[1fr_auto] xl:items-center">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-sm font-black text-emerald-700">
            {getCustomerInitial(customer)}
          </div>

          <div className="min-w-0">
            <h3 className="break-words text-base font-black text-slate-900">
              {name}
            </h3>

            <p className="mt-1 break-words text-sm font-semibold text-slate-500">
              {phone} • {location}
            </p>

            <p className="mt-1 break-words text-xs font-semibold text-slate-500">
              {work} • Registered: {formatDate(customer.created_at)}
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              <StatusPill status={verificationStatus} />
              <StatusPill status={relationshipStatus} />
              {inFundSpace && <StatusPill status="IN_FUND_SPACE" />}
              {hasPendingPayment && <StatusPill status="NEEDS_PAYMENT" />}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row xl:flex-col">
          <Link
            href={`/agent/customers/${customer.customer_id}`}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 transition hover:bg-slate-50"
          >
            View Profile
            <ArrowRight className="h-4 w-4" />
          </Link>

          {inFundSpace ? (
            <Link
              href={`/agent/fund-space/${customer.customer_id}`}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-4 text-sm font-black text-white transition hover:bg-emerald-800"
            >
              Fund Space
              <ArrowRight className="h-4 w-4" />
            </Link>
          ) : (
            <Link
              href={`/agent/customers/${customer.customer_id}`}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-amber-600 px-4 text-sm font-black text-white transition hover:bg-amber-700"
            >
              Check Eligibility
              <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}

function EmptyCustomersBlock() {
  return (
    <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
      <Store className="mx-auto mb-4 h-10 w-10 text-slate-300" />
      <h3 className="font-black text-slate-900">No customers found</h3>
      <p className="mx-auto mt-2 max-w-md text-sm font-semibold leading-6 text-slate-500">
        Register your first customer or change your search/filter to view
        customer records.
      </p>

      <Link
        href="/agent/register-customer"
        className="mt-5 inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-5 text-sm font-black text-white hover:bg-emerald-800"
      >
        Register Customer
        <UserPlus className="h-4 w-4" />
      </Link>
    </div>
  );
}