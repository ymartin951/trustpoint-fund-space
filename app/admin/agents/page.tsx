'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  UserPlus,
  Users,
  XCircle,
} from 'lucide-react';

import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

type AgentProfile = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  role: string | null;
  status: string | null;
  verification_status: string | null;
  trust_score: number | null;
  created_at: string | null;
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
  const value = status || 'UNKNOWN';

  if (['ACTIVE', 'VERIFIED', 'APPROVED'].includes(value)) {
    return 'bg-emerald-50 text-emerald-700 border-emerald-100';
  }

  if (['PENDING', 'PENDING_VERIFICATION', 'UNDER_REVIEW'].includes(value)) {
    return 'bg-amber-50 text-amber-700 border-amber-100';
  }

  if (['INACTIVE', 'SUSPENDED', 'REJECTED', 'BLACKLISTED'].includes(value)) {
    return 'bg-red-50 text-red-700 border-red-100';
  }

  return 'bg-gray-50 text-gray-700 border-gray-100';
}

export default function AdminAgentsPage() {
  const { profile, loading } = useAuth();

  const [agents, setAgents] = useState<AgentProfile[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');

  const [searchTerm, setSearchTerm] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const isSuperAdmin = profile?.role === 'SUPER_ADMIN';

  useEffect(() => {
    if (loading) return;

    if (!isSuperAdmin) {
      setPageLoading(false);
      setErrorMessage('Only Super Admin can manage agents.');
      return;
    }

    loadAgents();
  }, [loading, isSuperAdmin]);

  const loadAgents = async () => {
    try {
      setPageLoading(true);
      setErrorMessage('');

      const { data, error } = await supabase
        .from('profiles')
        .select(
          'id, full_name, email, phone, role, status, verification_status, trust_score, created_at'
        )
        .eq('role', 'AGENT')
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      setAgents((data || []) as AgentProfile[]);
    } catch (error: unknown) {
      console.error('Load agents error:', error);

      const message =
        error instanceof Error ? error.message : 'Unable to load agents.';

      setErrorMessage(message);
    } finally {
      setPageLoading(false);
    }
  };

 const handleCreateAgent = async () => {
  if (!fullName.trim()) {
    setErrorMessage('Agent full name is required.');
    return;
  }

  if (!email.trim()) {
    setErrorMessage('Agent email is required.');
    return;
  }

  if (!phone.trim()) {
    setErrorMessage('Agent phone number is required.');
    return;
  }

  if (!password.trim() || password.trim().length < 6) {
    setErrorMessage('Temporary password must be at least 6 characters.');
    return;
  }

  const controller = new AbortController();

  const timeoutId = setTimeout(() => {
    controller.abort();
  }, 20000);

  try {
    setCreating(true);
    setErrorMessage('');
    setSuccessMessage('');

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session?.access_token) {
      throw new Error('Unable to verify your admin session. Please log in again.');
    }

    const response = await fetch('/api/admin/agents/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        password: password.trim(),
      }),
      signal: controller.signal,
    });

    let result: any = null;

    try {
      result = await response.json();
    } catch {
      result = null;
    }

    if (!response.ok) {
      throw new Error(result?.error || 'Unable to create agent.');
    }

    setSuccessMessage('Agent created successfully.');

    setFullName('');
    setEmail('');
    setPhone('');
    setPassword('');

    /*
      Important:
      We stop the button loading before refreshing the list.
      This prevents endless "Creating Agent..." if the list refresh delays.
    */
    setCreating(false);

    await loadAgents();
  } catch (error: unknown) {
    console.error('Create agent error:', error);

    const message =
      error instanceof DOMException && error.name === 'AbortError'
        ? 'Agent creation took too long. Please check if the agent was created, then try again.'
        : error instanceof Error
          ? error.message
          : 'Unable to create agent.';

    setErrorMessage(message);
  } finally {
    clearTimeout(timeoutId);
    setCreating(false);
  }
};

  const stats = useMemo(() => {
    const total = agents.length;
    const active = agents.filter((agent) => agent.status === 'ACTIVE').length;
    const verified = agents.filter(
      (agent) => agent.verification_status === 'VERIFIED'
    ).length;
    const inactive = agents.filter((agent) => agent.status === 'INACTIVE').length;
    const suspended = agents.filter((agent) => agent.status === 'SUSPENDED').length;

    return {
      total,
      active,
      verified,
      inactive,
      suspended,
    };
  }, [agents]);

  const filteredAgents = useMemo(() => {
    return agents.filter((agent) => {
      const searchValue = searchTerm.toLowerCase();

      const name = agent.full_name || '';
      const agentEmail = agent.email || '';
      const agentPhone = agent.phone || '';
      const status = agent.status || '';
      const verification = agent.verification_status || '';

      return (
        name.toLowerCase().includes(searchValue) ||
        agentEmail.toLowerCase().includes(searchValue) ||
        agentPhone.toLowerCase().includes(searchValue) ||
        status.toLowerCase().includes(searchValue) ||
        verification.toLowerCase().includes(searchValue)
      );
    });
  }, [agents, searchTerm]);

  if (loading || pageLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-emerald-600" />
          <p className="text-sm text-gray-500">Loading agents...</p>
        </div>
      </div>
    );
  }

  if (!isSuperAdmin) {
    return (
      <div className="rounded-3xl border border-red-100 bg-red-50 p-6">
        <h1 className="text-xl font-bold text-red-700">Access denied</h1>
        <p className="mt-2 text-sm text-red-600">
          Only Super Admin can create and manage agents.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="rounded-3xl bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-600 p-5 text-white shadow-sm md:p-8">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
          <div>
            <p className="mb-3 inline-flex rounded-full bg-white/15 px-4 py-1 text-xs font-medium md:text-sm">
              Super Admin Security
            </p>

            <h1 className="text-2xl font-bold md:text-4xl">
              Manage Agents
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-7 text-emerald-50 md:text-base">
              Create verified agent accounts securely. Agents cannot register themselves; only the
              Super Admin can add them.
            </p>
          </div>

          <button
            type="button"
            onClick={loadAgents}
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

      {successMessage && (
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-700">
          {successMessage}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm md:p-6">
          <Users className="mb-4 h-7 w-7 text-emerald-600" />
          <p className="text-sm text-gray-500">Total Agents</p>
          <h3 className="mt-1 text-3xl font-black text-gray-900">{stats.total}</h3>
        </div>

        <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm md:p-6">
          <BadgeCheck className="mb-4 h-7 w-7 text-emerald-600" />
          <p className="text-sm text-gray-500">Active</p>
          <h3 className="mt-1 text-3xl font-black text-gray-900">{stats.active}</h3>
        </div>

        <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm md:p-6">
          <ShieldCheck className="mb-4 h-7 w-7 text-emerald-600" />
          <p className="text-sm text-gray-500">Verified</p>
          <h3 className="mt-1 text-3xl font-black text-gray-900">{stats.verified}</h3>
        </div>

        <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm md:p-6">
          <XCircle className="mb-4 h-7 w-7 text-red-600" />
          <p className="text-sm text-gray-500">Inactive</p>
          <h3 className="mt-1 text-3xl font-black text-gray-900">{stats.inactive}</h3>
        </div>

        <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm md:p-6">
          <XCircle className="mb-4 h-7 w-7 text-red-600" />
          <p className="text-sm text-gray-500">Suspended</p>
          <h3 className="mt-1 text-3xl font-black text-gray-900">{stats.suspended}</h3>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm md:p-6">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-gray-900 md:text-xl">
              Add New Agent
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Only add trusted and verified people as agents.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-bold text-gray-700">
                Full name
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="Agent full name"
                className="min-h-12 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-gray-700">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="agent@example.com"
                className="min-h-12 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-gray-700">
                Phone number
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="0240000000"
                className="min-h-12 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-gray-700">
                Temporary password
              </label>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 6 characters"
                className="min-h-12 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
            </div>

            <button
              type="button"
              onClick={handleCreateAgent}
              disabled={creating}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus size={16} />}
              {creating ? 'Creating Agent...' : 'Create Agent'}
            </button>
          </div>
        </div>

        <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm md:p-6 xl:col-span-2">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-900 md:text-xl">
                Agent Accounts
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Search and review all agent accounts.
              </p>
            </div>

            <div className="relative md:min-w-[320px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search agents..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="min-h-12 w-full rounded-xl border border-gray-200 py-3 pl-10 pr-4 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
            </div>
          </div>

          <div className="mt-6 space-y-4">
            {filteredAgents.length === 0 ? (
              <div className="rounded-2xl border border-gray-100 p-8 text-center">
                <Users className="mx-auto mb-4 h-10 w-10 text-gray-300" />
                <h3 className="font-bold text-gray-900">No agents found</h3>
                <p className="mt-2 text-sm text-gray-500">
                  Created agents will appear here.
                </p>
              </div>
            ) : (
              filteredAgents.map((agent) => (
                <div
                  key={agent.id}
                  className="rounded-3xl border border-gray-100 bg-white p-4 shadow-sm"
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-700">
                        {(agent.full_name || 'A').slice(0, 1).toUpperCase()}
                      </div>

                      <div>
                        <p className="font-bold text-gray-900">
                          {agent.full_name || 'Unnamed agent'}
                        </p>
                        <p className="mt-1 text-sm text-gray-500">
                          {agent.phone || 'No phone'}
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          {agent.email || 'No email'}
                        </p>
                        <p className="mt-1 text-xs text-gray-400">
                          Created: {formatDate(agent.created_at)}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 md:justify-end">
                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-bold ${getStatusStyle(
                          agent.status
                        )}`}
                      >
                        {agent.status || 'UNKNOWN'}
                      </span>

                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-bold ${getStatusStyle(
                          agent.verification_status
                        )}`}
                      >
                        {agent.verification_status || 'UNKNOWN'}
                      </span>

                      <span className="rounded-full border border-gray-100 bg-gray-50 px-3 py-1 text-xs font-bold text-gray-700">
                        Trust: {agent.trust_score ?? 0}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-amber-100 bg-amber-50 p-5 md:p-6">
        <h2 className="text-lg font-bold text-amber-800">
          Security rule
        </h2>
        <p className="mt-2 text-sm leading-6 text-amber-700">
          Agents cannot sign themselves up. Only the Super Admin should create agent accounts after
          verifying the person properly. This protects customers, contributions, payouts, and the
          reputation of TrustPoint Fund Space.
        </p>
      </div>
    </div>
  );
}