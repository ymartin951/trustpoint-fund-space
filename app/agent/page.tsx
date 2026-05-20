'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  BadgeCheck,
  Clock,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
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

type FundSpaceMember = {
  id: string;
  user_id: string;
  fund_space_id: string;
  status: string | null;
};

function formatDate(dateString: string | null | undefined) {
  if (!dateString) return 'Not set';

  return new Date(dateString).toLocaleDateString('en-GH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function getStatusStyle(status: string | null | undefined) {
  const value = status || 'PENDING';

  if (['ACTIVE', 'VERIFIED', 'APPROVED', 'COMPLETED'].includes(value)) {
    return 'bg-emerald-50 text-emerald-700 border-emerald-100';
  }

  if (['PENDING', 'PENDING_VERIFICATION', 'UNDER_REVIEW'].includes(value)) {
    return 'bg-amber-50 text-amber-700 border-amber-100';
  }

  if (['REJECTED', 'INACTIVE', 'SUSPENDED', 'BLACKLISTED'].includes(value)) {
    return 'bg-red-50 text-red-700 border-red-100';
  }

  return 'bg-gray-50 text-gray-700 border-gray-100';
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

export default function AgentDashboardPage() {
  const { profile, loading } = useAuth();

  const [customers, setCustomers] = useState<AgentCustomer[]>([]);
  const [fundSpaceMembers, setFundSpaceMembers] = useState<FundSpaceMember[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (loading) return;

    if (!profile?.id) {
      setPageLoading(false);
      setErrorMessage('Unable to identify your agent account. Please log in again.');
      return;
    }

    loadAgentDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, profile?.id]);

  const getAuthToken = async () => {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error || !session?.access_token) {
      throw new Error('Your session has expired. Please log in again.');
    }

    return session.access_token;
  };

  const loadAgentDashboard = async () => {
    try {
      setPageLoading(true);
      setErrorMessage('');

      const token = await getAuthToken();

      const response = await fetch('/api/agent/customers', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const responseText = await response.text();
      const result = responseText ? JSON.parse(responseText) : null;

      if (!response.ok || !result?.success) {
        throw new Error(
          result?.message || 'Unable to load your agent customers.'
        );
      }

      const loadedCustomers = (result.customers || []).map(normalizeCustomerFromApi);

      setCustomers(loadedCustomers);

      const customerUserIds = loadedCustomers
        .map((customer: AgentCustomer) => customer.customer_id)
        .filter(Boolean);

      if (customerUserIds.length === 0) {
        setFundSpaceMembers([]);
        return;
      }

      const { data: memberData, error: memberError } = await supabase
        .from('fund_space_members')
        .select('id, user_id, fund_space_id, status')
        .in('user_id', customerUserIds);

      if (memberError) {
        console.warn('Agent Fund Space members warning:', memberError.message);
        setFundSpaceMembers([]);
        return;
      }

      setFundSpaceMembers((memberData || []) as FundSpaceMember[]);
    } catch (error: unknown) {
      console.error('Agent dashboard load error:', error);

      const message =
        error instanceof Error
          ? error.message
          : 'Unable to load agent dashboard.';

      setErrorMessage(message);
    } finally {
      setPageLoading(false);
    }
  };

  const stats = useMemo(() => {
    const total = customers.length;

    const pending = customers.filter((customer) =>
      ['PENDING', 'PENDING_VERIFICATION', 'UNDER_REVIEW'].includes(
        customer.profile?.verification_status || ''
      )
    ).length;

    const verified = customers.filter(
      (customer) =>
        customer.profile?.verification_status === 'VERIFIED' ||
        customer.profile?.verification_status === 'APPROVED'
    ).length;

    const active = customers.filter(
      (customer) =>
        customer.relationship_status === 'ACTIVE' ||
        customer.profile?.status === 'ACTIVE'
    ).length;

    const fundSpaceCustomerIds = new Set(
      fundSpaceMembers.map((member) => member.user_id)
    );

    const inFundSpace = customers.filter(
      (customer) =>
        customer.customer_id && fundSpaceCustomerIds.has(customer.customer_id)
    ).length;

    return {
      total,
      pending,
      verified,
      active,
      inFundSpace,
    };
  }, [customers, fundSpaceMembers]);

  const filteredCustomers = useMemo(() => {
    return customers.filter((customer) => {
      const searchValue = searchTerm.toLowerCase();
      const profile = customer.profile;

      const fullName = profile?.full_name || '';
      const phone = profile?.phone || '';
      const location = getCustomerLocation(customer);
      const occupation = profile?.occupation || '';
      const businessType = profile?.business_type || '';
      const businessName = profile?.business_name || '';
      const verificationStatus = profile?.verification_status || '';
      const accountStatus = profile?.status || '';
      const relationshipStatus = customer.relationship_status || '';

      return (
        fullName.toLowerCase().includes(searchValue) ||
        phone.toLowerCase().includes(searchValue) ||
        location.toLowerCase().includes(searchValue) ||
        occupation.toLowerCase().includes(searchValue) ||
        businessType.toLowerCase().includes(searchValue) ||
        businessName.toLowerCase().includes(searchValue) ||
        verificationStatus.toLowerCase().includes(searchValue) ||
        accountStatus.toLowerCase().includes(searchValue) ||
        relationshipStatus.toLowerCase().includes(searchValue)
      );
    });
  }, [customers, searchTerm]);

  const recentCustomers = filteredCustomers.slice(0, 6);

  if (loading || pageLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-emerald-600" />
          <p className="text-sm text-gray-500">Loading agent dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="rounded-3xl bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-600 p-5 text-white shadow-sm md:p-8">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
          <div>
            <p className="mb-3 inline-flex rounded-full bg-white/15 px-4 py-1 text-xs font-medium md:text-sm">
              Agent Dashboard
            </p>

            <h1 className="text-2xl font-bold md:text-4xl">
              Welcome, {profile?.full_name || 'TrustPoint Agent'}
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-7 text-emerald-50 md:text-base">
              Manage your assigned customers, register offline users, track verification progress,
              and help trusted customers join Fund Space groups.
            </p>
          </div>

          <button
            type="button"
            onClick={loadAgentDashboard}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-emerald-700 hover:bg-emerald-50"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm md:p-6">
          <div className="mb-4 inline-flex rounded-2xl bg-emerald-50 p-3 text-emerald-700">
            <Users size={24} />
          </div>
          <p className="text-sm text-gray-500">Total Customers</p>
          <h3 className="mt-1 text-3xl font-black text-gray-900">{stats.total}</h3>
        </div>

        <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm md:p-6">
          <div className="mb-4 inline-flex rounded-2xl bg-amber-50 p-3 text-amber-700">
            <Clock size={24} />
          </div>
          <p className="text-sm text-gray-500">Pending Verification</p>
          <h3 className="mt-1 text-3xl font-black text-gray-900">{stats.pending}</h3>
        </div>

        <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm md:p-6">
          <div className="mb-4 inline-flex rounded-2xl bg-emerald-50 p-3 text-emerald-700">
            <ShieldCheck size={24} />
          </div>
          <p className="text-sm text-gray-500">Verified</p>
          <h3 className="mt-1 text-3xl font-black text-gray-900">{stats.verified}</h3>
        </div>

        <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm md:p-6">
          <div className="mb-4 inline-flex rounded-2xl bg-emerald-50 p-3 text-emerald-700">
            <BadgeCheck size={24} />
          </div>
          <p className="text-sm text-gray-500">Active</p>
          <h3 className="mt-1 text-3xl font-black text-gray-900">{stats.active}</h3>
        </div>

        <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm md:p-6">
          <div className="mb-4 inline-flex rounded-2xl bg-emerald-50 p-3 text-emerald-700">
            <WalletCards size={24} />
          </div>
          <p className="text-sm text-gray-500">In Fund Space</p>
          <h3 className="mt-1 text-3xl font-black text-gray-900">{stats.inFundSpace}</h3>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm md:p-6 xl:col-span-2">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-900 md:text-xl">
                Recent Customers
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                View and search your recently registered customers.
              </p>
            </div>

            <Link
              href="/agent/customers"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-700"
            >
              View All Customers
              <ArrowRight size={16} />
            </Link>
          </div>

          <div className="relative mt-5">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />

            <input
              type="text"
              placeholder="Search name, phone, location, status..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="min-h-12 w-full rounded-xl border border-gray-200 py-3 pl-10 pr-4 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
          </div>

          <div className="mt-6 space-y-4">
            {recentCustomers.length === 0 ? (
              <div className="rounded-2xl border border-gray-100 p-8 text-center">
                <Store className="mx-auto mb-4 h-10 w-10 text-gray-300" />
                <h3 className="font-bold text-gray-900">No customers found</h3>
                <p className="mt-2 text-sm text-gray-500">
                  Register your first customer to start managing them here.
                </p>

                <Link
                  href="/agent/register-customer"
                  className="mt-5 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-700"
                >
                  Register Customer
                  <UserPlus size={16} />
                </Link>
              </div>
            ) : (
              recentCustomers.map((customer) => {
                const name = getCustomerName(customer);
                const phone = getCustomerPhone(customer);
                const location = getCustomerLocation(customer);
                const work = getCustomerWork(customer);
                const verificationStatus =
                  customer.profile?.verification_status || 'PENDING';
                const relationshipStatus =
                  customer.relationship_status || customer.profile?.status || 'ACTIVE';

                return (
                  <div
                    key={customer.relationship_id}
                    className="rounded-3xl border border-gray-100 bg-white p-4 shadow-sm transition hover:border-emerald-100 hover:bg-emerald-50/30"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex items-start gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-700">
                          {getCustomerInitial(customer)}
                        </div>

                        <div>
                          <p className="font-bold text-gray-900">{name}</p>
                          <p className="mt-1 text-sm text-gray-500">{phone}</p>
                          <p className="mt-1 text-xs text-gray-500">
                            {location} • {work}
                          </p>
                          <p className="mt-1 text-xs text-gray-400">
                            Registered: {formatDate(customer.created_at)}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 sm:justify-end">
                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-bold ${getStatusStyle(
                            verificationStatus
                          )}`}
                        >
                          {verificationStatus}
                        </span>

                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-bold ${getStatusStyle(
                            relationshipStatus
                          )}`}
                        >
                          {relationshipStatus}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
                      <Link
                        href={`/agent/customers/${customer.customer_id}`}
                        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50"
                      >
                        View Details
                        <ArrowRight size={15} />
                      </Link>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm md:p-6">
            <h2 className="text-lg font-bold text-gray-900 md:text-xl">
              Quick Actions
            </h2>

            <div className="mt-5 space-y-3">
              <Link
                href="/agent/register-customer"
                className="flex min-h-12 items-center justify-between rounded-2xl border border-gray-100 p-4 text-sm font-bold text-gray-700 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
              >
                <span className="flex items-center gap-2">
                  <UserPlus size={18} />
                  Register Customer
                </span>
                <ArrowRight size={16} />
              </Link>

              <Link
                href="/agent/customers"
                className="flex min-h-12 items-center justify-between rounded-2xl border border-gray-100 p-4 text-sm font-bold text-gray-700 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
              >
                <span className="flex items-center gap-2">
                  <Users size={18} />
                  View Customers
                </span>
                <ArrowRight size={16} />
              </Link>

              <Link
                href="/dashboard/fund-space"
                className="flex min-h-12 items-center justify-between rounded-2xl border border-gray-100 p-4 text-sm font-bold text-gray-700 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
              >
                <span className="flex items-center gap-2">
                  <WalletCards size={18} />
                  Fund Space
                </span>
                <ArrowRight size={16} />
              </Link>
            </div>
          </div>

          <div className="rounded-3xl border border-amber-100 bg-amber-50 p-5 md:p-6">
            <h2 className="text-lg font-bold text-amber-800">
              Agent responsibility reminder
            </h2>

            <p className="mt-2 text-sm leading-6 text-amber-700">
              Register only real customers with correct names, phone numbers, location, and payment
              details. Since agents may support offline users, accuracy is very important for trust,
              verification, contributions, payouts, and withdrawals.
            </p>
          </div>

          <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-5 md:p-6">
            <h2 className="text-lg font-bold text-emerald-800">
              Mobile-first workflow
            </h2>

            <p className="mt-2 text-sm leading-6 text-emerald-700">
              This agent dashboard is designed to work well on phones, because many agents may
              register customers while moving around markets, shops, churches, schools, or offices.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}