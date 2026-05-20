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
  agent_id: string;
  customer_id: string;
  relationship_status: 'ACTIVE' | 'INACTIVE' | 'TRANSFERRED';
  notes: string | null;
  assigned_at: string | null;
  updated_at: string | null;
  profile: CustomerProfile | null;
};

type CustomersApiResponse = {
  success: boolean;
  message?: string;
  customers?: AgentCustomer[];
  stats?: {
    total: number;
    active: number;
    pending: number;
    verified: number;
    rejected: number;
  };
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

  if (['PENDING', 'UNVERIFIED', 'PENDING_VERIFICATION', 'UNDER_REVIEW'].includes(value)) {
    return 'bg-amber-50 text-amber-700 border-amber-100';
  }

  if (['REJECTED', 'INACTIVE', 'SUSPENDED', 'BLACKLISTED'].includes(value)) {
    return 'bg-red-50 text-red-700 border-red-100';
  }

  if (value === 'TRANSFERRED') {
    return 'bg-purple-50 text-purple-700 border-purple-100';
  }

  return 'bg-gray-50 text-gray-700 border-gray-100';
}

function prettyStatus(status: string | null | undefined) {
  if (!status) return 'PENDING';

  return status
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getCustomerInitial(profile: CustomerProfile | null) {
  return (profile?.full_name || 'C').slice(0, 1).toUpperCase();
}

function getCustomerName(profile: CustomerProfile | null) {
  return profile?.full_name || 'Unnamed customer';
}

function getCustomerPhone(profile: CustomerProfile | null) {
  return profile?.phone || 'No phone number';
}

function getCustomerLocation(profile: CustomerProfile | null) {
  return (
    profile?.location ||
    profile?.city ||
    profile?.region ||
    profile?.country ||
    'No location'
  );
}

function getCustomerOccupation(profile: CustomerProfile | null) {
  return (
    profile?.occupation ||
    profile?.business_name ||
    profile?.business_type ||
    'Not provided'
  );
}

export default function AgentCustomersPage() {
  const { profile, loading } = useAuth();

  const [customers, setCustomers] = useState<AgentCustomer[]>([]);
  const [fundSpaceMembers, setFundSpaceMembers] = useState<FundSpaceMember[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const [searchTerm, setSearchTerm] = useState('');
  const [verificationFilter, setVerificationFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [fundSpaceFilter, setFundSpaceFilter] = useState('ALL');

  useEffect(() => {
    if (loading) return;

    if (!profile?.id) {
      setPageLoading(false);
      setErrorMessage('Unable to identify your agent account. Please log in again.');
      return;
    }

    loadCustomers();
  }, [loading, profile?.id]);

  const loadCustomers = async () => {
    try {
      setPageLoading(true);
      setErrorMessage('');

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        throw new Error(sessionError.message || 'Could not check your login session.');
      }

      if (!session?.access_token) {
        throw new Error('Your session has expired. Please log in again.');
      }

      const response = await fetch('/api/agent/customers', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const responseText = await response.text();

      let result: CustomersApiResponse = {
        success: false,
        message: 'Unable to load customers.',
      };

      try {
        result = responseText ? JSON.parse(responseText) : result;
      } catch {
        result = {
          success: false,
          message: 'The server returned an invalid response while loading customers.',
        };
      }

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Unable to load customers.');
      }

      const loadedCustomers = result.customers || [];
      setCustomers(loadedCustomers);

      const customerUserIds = loadedCustomers
        .map((customer) => customer.customer_id)
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
        console.warn('Fund Space member load warning:', memberError.message);
        setFundSpaceMembers([]);
        return;
      }

      setFundSpaceMembers((memberData || []) as FundSpaceMember[]);
    } catch (error: unknown) {
      console.error('Agent customers load error:', error);

      const message =
        error instanceof Error
          ? error.message
          : 'Unable to load customers.';

      setErrorMessage(message);
    } finally {
      setPageLoading(false);
    }
  };

  const fundSpaceCustomerIds = useMemo(() => {
    return new Set(fundSpaceMembers.map((member) => member.user_id));
  }, [fundSpaceMembers]);

  const stats = useMemo(() => {
    const total = customers.length;

    const pending = customers.filter((customer) =>
      ['PENDING', 'UNVERIFIED', 'PENDING_VERIFICATION', 'UNDER_REVIEW'].includes(
        customer.profile?.verification_status || ''
      )
    ).length;

    const verified = customers.filter(
      (customer) => customer.profile?.verification_status === 'VERIFIED'
    ).length;

    const rejected = customers.filter(
      (customer) => customer.profile?.verification_status === 'REJECTED'
    ).length;

    const active = customers.filter(
      (customer) => customer.relationship_status === 'ACTIVE'
    ).length;

    const inFundSpace = customers.filter(
      (customer) => customer.customer_id && fundSpaceCustomerIds.has(customer.customer_id)
    ).length;

    return {
      total,
      pending,
      verified,
      rejected,
      active,
      inFundSpace,
    };
  }, [customers, fundSpaceCustomerIds]);

  const filteredCustomers = useMemo(() => {
    return customers.filter((customer) => {
      const profileData = customer.profile;

      const fullName = profileData?.full_name || '';
      const phone = profileData?.phone || '';
      const location =
        profileData?.location ||
        profileData?.city ||
        profileData?.region ||
        '';
      const occupation = profileData?.occupation || '';
      const businessType = profileData?.business_type || '';
      const businessName = profileData?.business_name || '';
      const verificationStatus = profileData?.verification_status || '';
      const relationshipStatus = customer.relationship_status || '';

      const searchValue = searchTerm.toLowerCase();

      const matchesSearch =
        fullName.toLowerCase().includes(searchValue) ||
        phone.toLowerCase().includes(searchValue) ||
        location.toLowerCase().includes(searchValue) ||
        occupation.toLowerCase().includes(searchValue) ||
        businessType.toLowerCase().includes(searchValue) ||
        businessName.toLowerCase().includes(searchValue) ||
        verificationStatus.toLowerCase().includes(searchValue) ||
        relationshipStatus.toLowerCase().includes(searchValue);

      const matchesVerification =
        verificationFilter === 'ALL' ||
        profileData?.verification_status === verificationFilter;

      const matchesStatus =
        statusFilter === 'ALL' || customer.relationship_status === statusFilter;

      const isInFundSpace =
        !!customer.customer_id && fundSpaceCustomerIds.has(customer.customer_id);

      const matchesFundSpace =
        fundSpaceFilter === 'ALL' ||
        (fundSpaceFilter === 'YES' && isInFundSpace) ||
        (fundSpaceFilter === 'NO' && !isInFundSpace);

      return (
        matchesSearch &&
        matchesVerification &&
        matchesStatus &&
        matchesFundSpace
      );
    });
  }, [
    customers,
    searchTerm,
    verificationFilter,
    statusFilter,
    fundSpaceFilter,
    fundSpaceCustomerIds,
  ]);

  if (loading || pageLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-emerald-600" />
          <p className="text-sm text-gray-500">Loading customers...</p>
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
              Agent Customers
            </p>

            <h1 className="text-2xl font-bold md:text-4xl">
              My Customers
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-7 text-emerald-50 md:text-base">
              View, search, and manage customers assigned to you. Use this page to track verification,
              activity, and Fund Space participation.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={loadCustomers}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-emerald-700 hover:bg-emerald-50"
            >
              <RefreshCw size={16} />
              Refresh
            </button>

            <Link
              href="/agent/register-customer"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-950/40 px-5 py-3 text-sm font-bold text-white ring-1 ring-white/20 hover:bg-emerald-950/60"
            >
              <UserPlus size={16} />
              Register Customer
            </Link>
          </div>
        </div>
      </div>

      {errorMessage && (
        <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm md:p-6">
          <Users className="mb-4 h-7 w-7 text-emerald-600" />
          <p className="text-sm text-gray-500">Total Customers</p>
          <h3 className="mt-1 text-3xl font-black text-gray-900">{stats.total}</h3>
        </div>

        <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm md:p-6">
          <Clock className="mb-4 h-7 w-7 text-amber-600" />
          <p className="text-sm text-gray-500">Pending</p>
          <h3 className="mt-1 text-3xl font-black text-gray-900">{stats.pending}</h3>
        </div>

        <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm md:p-6">
          <ShieldCheck className="mb-4 h-7 w-7 text-emerald-600" />
          <p className="text-sm text-gray-500">Verified</p>
          <h3 className="mt-1 text-3xl font-black text-gray-900">{stats.verified}</h3>
        </div>

        <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm md:p-6">
          <XCircle className="mb-4 h-7 w-7 text-red-600" />
          <p className="text-sm text-gray-500">Rejected</p>
          <h3 className="mt-1 text-3xl font-black text-gray-900">{stats.rejected}</h3>
        </div>

        <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm md:p-6">
          <BadgeCheck className="mb-4 h-7 w-7 text-emerald-600" />
          <p className="text-sm text-gray-500">Active</p>
          <h3 className="mt-1 text-3xl font-black text-gray-900">{stats.active}</h3>
        </div>

        <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm md:p-6">
          <WalletCards className="mb-4 h-7 w-7 text-emerald-600" />
          <p className="text-sm text-gray-500">In Fund Space</p>
          <h3 className="mt-1 text-3xl font-black text-gray-900">{stats.inFundSpace}</h3>
        </div>
      </div>

      <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm md:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900 md:text-xl">
              Customer Records
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Search and filter your assigned customers.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-4 xl:min-w-[900px]">
            <div className="relative md:col-span-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />

              <input
                type="text"
                placeholder="Search customers..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="min-h-12 w-full rounded-xl border border-gray-200 py-3 pl-10 pr-4 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
            </div>

            <select
              value={verificationFilter}
              onChange={(event) => setVerificationFilter(event.target.value)}
              className="min-h-12 rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            >
              <option value="ALL">All Verification</option>
              <option value="PENDING">Pending</option>
              <option value="UNVERIFIED">Unverified</option>
              <option value="PENDING_VERIFICATION">Pending Verification</option>
              <option value="UNDER_REVIEW">Under Review</option>
              <option value="VERIFIED">Verified</option>
              <option value="REJECTED">Rejected</option>
            </select>

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="min-h-12 rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            >
              <option value="ALL">All Links</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="TRANSFERRED">Transferred</option>
            </select>

            <select
              value={fundSpaceFilter}
              onChange={(event) => setFundSpaceFilter(event.target.value)}
              className="min-h-12 rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            >
              <option value="ALL">All Fund Space</option>
              <option value="YES">In Fund Space</option>
              <option value="NO">Not In Fund Space</option>
            </select>
          </div>
        </div>

        {/* Mobile-first cards */}
        <div className="mt-6 space-y-4 lg:hidden">
          {filteredCustomers.length === 0 ? (
            <div className="rounded-2xl border border-gray-100 p-8 text-center">
              <Store className="mx-auto mb-4 h-10 w-10 text-gray-300" />
              <h3 className="font-bold text-gray-900">No customers found</h3>
              <p className="mt-2 text-sm text-gray-500">
                No customer matches your search or filter.
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
            filteredCustomers.map((customer) => {
              const customerProfile = customer.profile;
              const isInFundSpace =
                !!customer.customer_id && fundSpaceCustomerIds.has(customer.customer_id);

              return (
                <div
                  key={customer.relationship_id}
                  className="rounded-3xl border border-gray-100 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-700">
                      {getCustomerInitial(customerProfile)}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold text-gray-900">
                        {getCustomerName(customerProfile)}
                      </p>
                      <p className="mt-1 text-sm text-gray-500">
                        {getCustomerPhone(customerProfile)}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        {getCustomerLocation(customerProfile)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-bold ${getStatusStyle(
                        customerProfile?.verification_status
                      )}`}
                    >
                      {prettyStatus(customerProfile?.verification_status)}
                    </span>

                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-bold ${getStatusStyle(
                        customer.relationship_status
                      )}`}
                    >
                      {prettyStatus(customer.relationship_status)}
                    </span>

                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-bold ${
                        isInFundSpace
                          ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
                          : 'border-gray-100 bg-gray-50 text-gray-600'
                      }`}
                    >
                      {isInFundSpace ? 'In Fund Space' : 'Not In Fund Space'}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-2 text-sm">
                    <div className="rounded-2xl bg-gray-50 p-3">
                      <p className="text-gray-500">Occupation / Business</p>
                      <p className="font-semibold text-gray-900">
                        {getCustomerOccupation(customerProfile)}
                      </p>
                    </div>

                    <div className="rounded-2xl bg-gray-50 p-3">
                      <p className="text-gray-500">Registered</p>
                      <p className="font-semibold text-gray-900">
                        {formatDate(customer.assigned_at)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4">
                    <Link
                      href={`/agent/customers/${customer.customer_id}`}
                      className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700"
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

        {/* Desktop table */}
        <div className="mt-6 hidden overflow-hidden rounded-2xl border border-gray-100 lg:block">
          {filteredCustomers.length === 0 ? (
            <div className="p-10 text-center">
              <Store className="mx-auto mb-4 h-10 w-10 text-gray-300" />
              <h3 className="text-lg font-bold text-gray-900">No customers found</h3>
              <p className="mt-2 text-sm text-gray-500">
                No customer matches your search or filter.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1050px] text-left">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-5 py-4 text-xs font-bold uppercase tracking-wide text-gray-500">
                      Customer
                    </th>
                    <th className="px-5 py-4 text-xs font-bold uppercase tracking-wide text-gray-500">
                      Location
                    </th>
                    <th className="px-5 py-4 text-xs font-bold uppercase tracking-wide text-gray-500">
                      Occupation
                    </th>
                    <th className="px-5 py-4 text-xs font-bold uppercase tracking-wide text-gray-500">
                      Verification
                    </th>
                    <th className="px-5 py-4 text-xs font-bold uppercase tracking-wide text-gray-500">
                      Agent Link
                    </th>
                    <th className="px-5 py-4 text-xs font-bold uppercase tracking-wide text-gray-500">
                      Fund Space
                    </th>
                    <th className="px-5 py-4 text-xs font-bold uppercase tracking-wide text-gray-500">
                      Registered
                    </th>
                    <th className="px-5 py-4 text-right text-xs font-bold uppercase tracking-wide text-gray-500">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100 bg-white">
                  {filteredCustomers.map((customer) => {
                    const customerProfile = customer.profile;
                    const isInFundSpace =
                      !!customer.customer_id &&
                      fundSpaceCustomerIds.has(customer.customer_id);

                    return (
                      <tr key={customer.relationship_id} className="hover:bg-gray-50">
                        <td className="px-5 py-5">
                          <p className="font-bold text-gray-900">
                            {getCustomerName(customerProfile)}
                          </p>
                          <p className="mt-1 text-xs text-gray-500">
                            {getCustomerPhone(customerProfile)}
                          </p>
                        </td>

                        <td className="px-5 py-5 text-sm text-gray-700">
                          {getCustomerLocation(customerProfile)}
                        </td>

                        <td className="px-5 py-5">
                          <p className="text-sm font-semibold text-gray-900">
                            {getCustomerOccupation(customerProfile)}
                          </p>
                          <p className="mt-1 text-xs text-gray-500">
                            {customerProfile?.business_type || 'No business type'}
                          </p>
                        </td>

                        <td className="px-5 py-5">
                          <span
                            className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${getStatusStyle(
                              customerProfile?.verification_status
                            )}`}
                          >
                            {prettyStatus(customerProfile?.verification_status)}
                          </span>
                        </td>

                        <td className="px-5 py-5">
                          <span
                            className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${getStatusStyle(
                              customer.relationship_status
                            )}`}
                          >
                            {prettyStatus(customer.relationship_status)}
                          </span>
                        </td>

                        <td className="px-5 py-5">
                          <span
                            className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${
                              isInFundSpace
                                ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
                                : 'border-gray-100 bg-gray-50 text-gray-600'
                            }`}
                          >
                            {isInFundSpace ? 'Joined' : 'Not Joined'}
                          </span>
                        </td>

                        <td className="px-5 py-5 text-sm text-gray-700">
                          {formatDate(customer.assigned_at)}
                        </td>

                        <td className="px-5 py-5 text-right">
                          <Link
                            href={`/agent/customers/${customer.customer_id}`}
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700"
                          >
                            View
                            <ArrowRight size={15} />
                          </Link>
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

      <div className="rounded-3xl border border-amber-100 bg-amber-50 p-5 md:p-6">
        <h2 className="text-lg font-bold text-amber-800">
          Agent customer management reminder
        </h2>

        <p className="mt-2 text-sm leading-6 text-amber-700">
          Always make sure customer records are accurate. Names, phone numbers, locations, and payment
          details must be correct before customers are allowed to participate in Fund Space groups.
        </p>
      </div>
    </div>
  );
}