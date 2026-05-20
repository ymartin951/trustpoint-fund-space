'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  ArrowRight,
  BadgeCheck,
  Ban,
  CheckCircle2,
  Filter,
  Loader2,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Users,
  Wallet,
} from 'lucide-react';

import { supabase } from '@/lib/supabase/client';
import type { Database } from '@/lib/supabase/database.types';

type ProfileRow = Database['public']['Tables']['profiles']['Row'];

type UserRole = 'USER' | 'AGENT' | 'ADMIN' | 'SUPER_ADMIN';

type AccountStatus = 'ACTIVE' | 'SUSPENDED' | 'BLACKLISTED' | 'DELETED';

type VerificationStatus =
  | 'UNVERIFIED'
  | 'PENDING'
  | 'VERIFIED'
  | 'REJECTED'
  | 'SUSPENDED';

type UserCategory =
  | 'INDIVIDUAL'
  | 'GOVERNMENT_WORKER'
  | 'TEACHER'
  | 'NURSE'
  | 'BUSINESS_OWNER'
  | 'MARKET_WOMAN'
  | 'TRADER'
  | 'STUDENT'
  | 'OTHER';

type AdminProfile = {
  id: string;
  role: UserRole;
  status: AccountStatus;
};

type UserRecord = {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  role: UserRole;
  status: AccountStatus;
  verification_status: VerificationStatus;
  user_category: UserCategory | null;
  trust_score: number | null;
  created_at: string | null;
};

const roleFilters = ['ALL', 'USER', 'AGENT', 'ADMIN', 'SUPER_ADMIN'] as const;

const statusFilters = [
  'ALL',
  'ACTIVE',
  'SUSPENDED',
  'BLACKLISTED',
  'DELETED',
] as const;

const verificationFilters = [
  'ALL',
  'UNVERIFIED',
  'PENDING',
  'VERIFIED',
  'REJECTED',
  'SUSPENDED',
] as const;

const categoryFilters = [
  'ALL',
  'INDIVIDUAL',
  'GOVERNMENT_WORKER',
  'TEACHER',
  'NURSE',
  'BUSINESS_OWNER',
  'MARKET_WOMAN',
  'TRADER',
  'STUDENT',
  'OTHER',
] as const;

type RoleFilter = (typeof roleFilters)[number];
type StatusFilter = (typeof statusFilters)[number];
type VerificationFilter = (typeof verificationFilters)[number];
type CategoryFilter = (typeof categoryFilters)[number];

function normalizeRole(value: string | null | undefined): UserRole {
  if (
    value === 'USER' ||
    value === 'AGENT' ||
    value === 'ADMIN' ||
    value === 'SUPER_ADMIN'
  ) {
    return value;
  }

  return 'USER';
}

function normalizeStatus(value: string | null | undefined): AccountStatus {
  if (
    value === 'ACTIVE' ||
    value === 'SUSPENDED' ||
    value === 'BLACKLISTED' ||
    value === 'DELETED'
  ) {
    return value;
  }

  return 'ACTIVE';
}

function normalizeVerificationStatus(
  value: string | null | undefined
): VerificationStatus {
  if (
    value === 'UNVERIFIED' ||
    value === 'PENDING' ||
    value === 'VERIFIED' ||
    value === 'REJECTED' ||
    value === 'SUSPENDED'
  ) {
    return value;
  }

  return 'UNVERIFIED';
}

function normalizeUserCategory(
  value: string | null | undefined
): UserCategory | null {
  if (
    value === 'INDIVIDUAL' ||
    value === 'GOVERNMENT_WORKER' ||
    value === 'TEACHER' ||
    value === 'NURSE' ||
    value === 'BUSINESS_OWNER' ||
    value === 'MARKET_WOMAN' ||
    value === 'TRADER' ||
    value === 'STUDENT' ||
    value === 'OTHER'
  ) {
    return value;
  }

  return null;
}

function formatDate(dateString: string | null | undefined) {
  if (!dateString) return 'Not available';

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

function formatLabel(value: string | null | undefined) {
  if (!value) return 'Not set';

  return value
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getStatusBadgeClass(status: AccountStatus) {
  if (status === 'ACTIVE') {
    return 'border-emerald-100 bg-emerald-50 text-emerald-700';
  }

  if (status === 'SUSPENDED') {
    return 'border-amber-100 bg-amber-50 text-amber-700';
  }

  if (status === 'BLACKLISTED') {
    return 'border-red-100 bg-red-50 text-red-700';
  }

  return 'border-gray-100 bg-gray-50 text-gray-600';
}

function getVerificationBadgeClass(status: VerificationStatus) {
  if (status === 'VERIFIED') {
    return 'border-emerald-100 bg-emerald-50 text-emerald-700';
  }

  if (status === 'PENDING') {
    return 'border-amber-100 bg-amber-50 text-amber-700';
  }

  if (status === 'REJECTED') {
    return 'border-red-100 bg-red-50 text-red-700';
  }

  if (status === 'SUSPENDED') {
    return 'border-orange-100 bg-orange-50 text-orange-700';
  }

  return 'border-slate-100 bg-slate-50 text-slate-600';
}

function getTrustScoreClass(score: number | null) {
  const value = score ?? 0;

  if (value >= 80) {
    return 'text-emerald-700 bg-emerald-50 border-emerald-100';
  }

  if (value >= 50) {
    return 'text-amber-700 bg-amber-50 border-amber-100';
  }

  return 'text-red-700 bg-red-50 border-red-100';
}

export default function AdminUsersPage() {
  const [adminProfile, setAdminProfile] = useState<AdminProfile | null>(null);
  const [users, setUsers] = useState<UserRecord[]>([]);

  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('ALL');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [verificationFilter, setVerificationFilter] =
    useState<VerificationFilter>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('ALL');

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  async function loadUsers(showRefreshState = false) {
    try {
      if (showRefreshState) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setErrorMessage('');

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.user) {
        throw new Error('Your session has expired. Please login again.');
      }

      const { data: currentProfile, error: currentProfileError } =
        await supabase
          .from('profiles')
          .select('id, role, status')
          .eq('id', session.user.id)
          .maybeSingle();

      if (currentProfileError || !currentProfile) {
        throw new Error('Admin profile could not be found.');
      }

      const currentAdmin: AdminProfile = {
        id: currentProfile.id,
        role: normalizeRole(currentProfile.role),
        status: normalizeStatus(currentProfile.status),
      };

      if (
        currentAdmin.status !== 'ACTIVE' ||
        (currentAdmin.role !== 'ADMIN' && currentAdmin.role !== 'SUPER_ADMIN')
      ) {
        throw new Error('You do not have permission to view this page.');
      }

      setAdminProfile(currentAdmin);

      const { data: profilesData, error: usersError } = await supabase
        .from('profiles')
        .select(
          `
          id,
          full_name,
          phone,
          email,
          role,
          status,
          verification_status,
          user_category,
          trust_score,
          created_at
        `
        )
        .order('created_at', { ascending: false });

      if (usersError) {
        throw new Error(usersError.message || 'Failed to load users.');
      }

      const normalizedUsers: UserRecord[] = ((profilesData || []) as ProfileRow[]).map(
        (profile) => ({
          id: profile.id,
          full_name: profile.full_name,
          phone: profile.phone,
          email: profile.email,
          role: normalizeRole(profile.role),
          status: normalizeStatus(profile.status),
          verification_status: normalizeVerificationStatus(
            profile.verification_status
          ),
          user_category: normalizeUserCategory(profile.user_category),
          trust_score:
            typeof profile.trust_score === 'number' ? profile.trust_score : 0,
          created_at: profile.created_at,
        })
      );

      setUsers(normalizedUsers);
    } catch (error) {
      console.error('Admin users load error:', error);

      const message =
        error instanceof Error
          ? error.message
          : 'Something went wrong while loading users.';

      setErrorMessage(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  const stats = useMemo(() => {
    return {
      total: users.length,
      active: users.filter((user) => user.status === 'ACTIVE').length,
      verified: users.filter(
        (user) => user.verification_status === 'VERIFIED'
      ).length,
      pending: users.filter((user) => user.verification_status === 'PENDING')
        .length,
      suspendedOrBlacklisted: users.filter(
        (user) =>
          user.status === 'SUSPENDED' || user.status === 'BLACKLISTED'
      ).length,
      agents: users.filter((user) => user.role === 'AGENT').length,
    };
  }, [users]);

  const filteredUsers = useMemo(() => {
    const value = searchTerm.trim().toLowerCase();

    return users.filter((user) => {
      const matchesSearch =
        !value ||
        (user.full_name || '').toLowerCase().includes(value) ||
        (user.phone || '').toLowerCase().includes(value) ||
        (user.email || '').toLowerCase().includes(value) ||
        user.id.toLowerCase().includes(value);

      const matchesRole = roleFilter === 'ALL' || user.role === roleFilter;

      const matchesStatus =
        statusFilter === 'ALL' || user.status === statusFilter;

      const matchesVerification =
        verificationFilter === 'ALL' ||
        user.verification_status === verificationFilter;

      const matchesCategory =
        categoryFilter === 'ALL' || user.user_category === categoryFilter;

      return (
        matchesSearch &&
        matchesRole &&
        matchesStatus &&
        matchesVerification &&
        matchesCategory
      );
    });
  }, [
    users,
    searchTerm,
    roleFilter,
    statusFilter,
    verificationFilter,
    categoryFilter,
  ]);

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto h-10 w-10 animate-spin text-emerald-600" />
          <p className="mt-4 text-sm font-medium text-gray-500">
            Loading users...
          </p>
        </div>
      </div>
    );
  }

  if (!adminProfile && errorMessage) {
    return (
      <div className="rounded-3xl border border-red-100 bg-red-50 p-6 text-red-700">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <h2 className="font-bold">Unable to load admin users page</h2>
            <p className="mt-1 text-sm">{errorMessage}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="rounded-3xl bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-600 p-6 text-white shadow-sm md:p-8">
        <div className="flex flex-col justify-between gap-6 xl:flex-row xl:items-center">
          <div>
            <p className="mb-3 inline-flex rounded-full bg-white/15 px-4 py-1 text-sm font-medium">
              Admin User Management
            </p>

            <h1 className="text-3xl font-black md:text-4xl">
              Users Management
            </h1>

            <p className="mt-4 max-w-3xl text-sm leading-7 text-emerald-50 md:text-base">
              Monitor all customers, agents, admins, verification statuses,
              account risks, and trust scores from one central place.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/admin"
                className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-emerald-700 hover:bg-emerald-50"
              >
                Admin Dashboard
                <ArrowRight size={16} />
              </Link>

              <Link
                href="/admin/verifications"
                className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-5 py-3 text-sm font-bold text-white ring-1 ring-white/20 hover:bg-white/20"
              >
                Verifications
                <ArrowRight size={16} />
              </Link>
            </div>
          </div>

          <button
            type="button"
            onClick={() => loadUsers(true)}
            disabled={refreshing}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            Refresh Users
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-700">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-6">
        <StatCard
          title="Total Users"
          value={stats.total}
          icon={<Users size={23} />}
          color="emerald"
        />

        <StatCard
          title="Active"
          value={stats.active}
          icon={<CheckCircle2 size={23} />}
          color="blue"
        />

        <StatCard
          title="Verified"
          value={stats.verified}
          icon={<BadgeCheck size={23} />}
          color="green"
        />

        <StatCard
          title="Pending"
          value={stats.pending}
          icon={<ShieldAlert size={23} />}
          color="amber"
        />

        <StatCard
          title="Risk Accounts"
          value={stats.suspendedOrBlacklisted}
          icon={<Ban size={23} />}
          color="red"
        />

        <StatCard
          title="Agents"
          value={stats.agents}
          icon={<ShieldCheck size={23} />}
          color="purple"
        />
      </div>

      <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm md:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="text-xl font-black text-gray-900">User Records</h2>
            <p className="mt-1 text-sm text-gray-500">
              Search and filter all TrustPoint Fund Space accounts.
            </p>
          </div>

          <div className="relative w-full xl:w-96">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />

            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search name, phone, email, ID..."
              className="min-h-11 w-full rounded-xl border border-gray-200 py-3 pl-10 pr-4 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-gray-100 bg-gray-50 p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-bold text-gray-700">
            <Filter size={16} />
            Filters
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <FilterSelect
              label="Role"
              value={roleFilter}
              onChange={(value) => setRoleFilter(value as RoleFilter)}
              options={roleFilters}
            />

            <FilterSelect
              label="Account Status"
              value={statusFilter}
              onChange={(value) => setStatusFilter(value as StatusFilter)}
              options={statusFilters}
            />

            <FilterSelect
              label="Verification"
              value={verificationFilter}
              onChange={(value) =>
                setVerificationFilter(value as VerificationFilter)
              }
              options={verificationFilters}
            />

            <FilterSelect
              label="Category"
              value={categoryFilter}
              onChange={(value) => setCategoryFilter(value as CategoryFilter)}
              options={categoryFilters}
            />
          </div>
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border border-gray-100">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50">
                <tr>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Verification</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Trust Score</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead align="right">Actions</TableHead>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100 bg-white">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center">
                      <Users className="mx-auto mb-3 h-10 w-10 text-gray-300" />
                      <h3 className="font-bold text-gray-900">
                        No users found
                      </h3>
                      <p className="mt-1 text-sm text-gray-500">
                        Try changing your search or filters.
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50/70">
                      <td className="px-5 py-4">
                        <div>
                          <p className="font-bold text-gray-900">
                            {user.full_name || 'Unnamed User'}
                          </p>
                          <p className="mt-1 text-xs text-gray-500">
                            {user.phone || 'No phone'} ·{' '}
                            {user.email || 'No email'}
                          </p>
                          <p className="mt-1 text-[11px] text-gray-400">
                            ID: {user.id.slice(0, 8)}...
                          </p>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <span className="rounded-full border border-gray-100 bg-gray-50 px-3 py-1 text-xs font-bold text-gray-700">
                          {formatLabel(user.role)}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-bold ${getStatusBadgeClass(
                            user.status
                          )}`}
                        >
                          {formatLabel(user.status)}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-bold ${getVerificationBadgeClass(
                            user.verification_status
                          )}`}
                        >
                          {formatLabel(user.verification_status)}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-sm text-gray-600">
                        {formatLabel(user.user_category)}
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex min-w-14 justify-center rounded-full border px-3 py-1 text-xs font-black ${getTrustScoreClass(
                            user.trust_score
                          )}`}
                        >
                          {user.trust_score ?? 0}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-sm text-gray-500">
                        {formatDate(user.created_at)}
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          {user.verification_status === 'PENDING' && (
                            <Link
                              href="/admin/verifications"
                              className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700"
                            >
                              Review
                              <ArrowRight size={13} />
                            </Link>
                          )}

                          <Link
                            href={`/admin/transactions?user=${user.id}`}
                            className="inline-flex items-center gap-1 rounded-xl border border-gray-200 px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50"
                          >
                            <Wallet size={13} />
                            Transactions
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-5 flex flex-col justify-between gap-3 text-sm text-gray-500 sm:flex-row sm:items-center">
          <p>
            Showing {filteredUsers.length} of {users.length} users
          </p>

          <button
            type="button"
            onClick={() => {
              setSearchTerm('');
              setRoleFilter('ALL');
              setStatusFilter('ALL');
              setVerificationFilter('ALL');
              setCategoryFilter('ALL');
            }}
            className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50"
          >
            Clear Filters
          </button>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
  color,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
  color: 'emerald' | 'blue' | 'green' | 'amber' | 'red' | 'purple';
}) {
  const classes = {
    emerald: 'bg-emerald-50 text-emerald-700',
    blue: 'bg-blue-50 text-blue-700',
    green: 'bg-green-50 text-green-700',
    amber: 'bg-amber-50 text-amber-700',
    red: 'bg-red-50 text-red-700',
    purple: 'bg-purple-50 text-purple-700',
  };

  return (
    <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className={`mb-4 inline-flex rounded-2xl p-3 ${classes[color]}`}>
        {icon}
      </div>

      <p className="text-sm text-gray-500">{title}</p>

      <h3 className="mt-1 text-3xl font-black text-gray-900">{value}</h3>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
}) {
  return (
    <div>
      <label className="mb-2 block text-xs font-bold text-gray-500">
        {label}
      </label>

      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-700 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {formatLabel(option)}
          </option>
        ))}
      </select>
    </div>
  );
}

function TableHead({
  children,
  align = 'left',
}: {
  children: React.ReactNode;
  align?: 'left' | 'right';
}) {
  return (
    <th
      className={`whitespace-nowrap px-5 py-3 text-xs font-black uppercase tracking-wide text-gray-500 ${
        align === 'right' ? 'text-right' : 'text-left'
      }`}
    >
      {children}
    </th>
  );
}