'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BadgeCheck,
  CheckCircle2,
  Clock,
  Loader2,
  ShieldCheck,
  ShieldAlert,
  Star,
  UserRoundCheck,
  UsersRound,
  XCircle,
} from 'lucide-react';

import { supabase } from '@/lib/supabase/client';

type TrustShieldProfile = {
  user_id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  role: string | null;
  status: string | null;
  verification_status: string | null;

  registered_agent_id: string | null;
  registered_agent_name: string | null;
  registered_agent_phone: string | null;

  successful_weekly_payments: number;
  missed_payments: number;
  late_payments: number;
  completed_fund_space_cycles: number;
  total_fund_spaces_joined: number;

  successful_payouts: number;
  total_payout_received: number;

  total_amount_paid: number;
  total_amount_due: number;

  default_cases: number;

  has_accepted_current_agreement: boolean;
  latest_agreement_accepted_at: string | null;

  has_emergency_contact: boolean;
  has_approved_guarantor: boolean;

  trust_score: number;
  trust_level_label: string;
  default_risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | string;
};

type ApiResponse = {
  success: boolean;
  message?: string;
  trust_shield?: TrustShieldProfile;
};

function formatCurrency(amount: number | null | undefined) {
  return `GH₵${Number(amount || 0).toLocaleString('en-GH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'Not available';

  const date = new Date(value);

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

function getTrustColor(score: number) {
  if (score >= 85) return 'text-emerald-700 bg-emerald-50 border-emerald-100';
  if (score >= 70) return 'text-blue-700 bg-blue-50 border-blue-100';
  if (score >= 55) return 'text-amber-700 bg-amber-50 border-amber-100';
  if (score >= 25) return 'text-orange-700 bg-orange-50 border-orange-100';

  return 'text-red-700 bg-red-50 border-red-100';
}

function getRiskStyle(risk: string | null | undefined) {
  const value = String(risk || '').toUpperCase();

  if (value === 'LOW') return 'border-emerald-100 bg-emerald-50 text-emerald-700';
  if (value === 'MEDIUM') return 'border-amber-100 bg-amber-50 text-amber-700';

  return 'border-red-100 bg-red-50 text-red-700';
}

function MetricBox({
  label,
  value,
  helper,
}: {
  label: string;
  value: string | number;
  helper?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-2 text-xl font-black text-slate-900">{value}</p>
      {helper && <p className="mt-1 text-xs leading-5 text-slate-500">{helper}</p>}
    </div>
  );
}

function CheckItem({
  checked,
  label,
  helper,
}: {
  checked: boolean;
  label: string;
  helper?: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl bg-slate-50 p-4">
      {checked ? (
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
      ) : (
        <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
      )}

      <div>
        <p className="text-sm font-black text-slate-900">{label}</p>
        {helper && <p className="mt-1 text-xs leading-5 text-slate-500">{helper}</p>}
      </div>
    </div>
  );
}

export default function TrustShieldCard({
  userId,
  title = 'Trust Shield',
  subtitle = 'Your TrustPoint reliability profile based on verification, agreement, contribution behavior, and payout history.',
}: {
  userId?: string | null;
  title?: string;
  subtitle?: string;
}) {
  const [loading, setLoading] = useState(true);
  const [trustShield, setTrustShield] = useState<TrustShieldProfile | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  const loadTrustShield = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMessage('');

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.access_token) {
        throw new Error('Your session has expired. Please log in again.');
      }

      const params = new URLSearchParams();

      if (userId) {
        params.set('user_id', userId);
      }

      const response = await fetch(`/api/trust-shield/profile?${params.toString()}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const result = (await response.json()) as ApiResponse;

      if (!response.ok || !result.success || !result.trust_shield) {
        throw new Error(result.message || 'Unable to load Trust Shield profile.');
      }

      setTrustShield(result.trust_shield);
    } catch (error) {
      setTrustShield(null);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to load Trust Shield profile.'
      );
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadTrustShield();
  }, [loadTrustShield]);

  const score = Number(trustShield?.trust_score || 0);

  const scoreStyle = useMemo(() => getTrustColor(score), [score]);

  if (loading) {
    return (
      <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
          <p className="text-sm font-semibold">Loading Trust Shield...</p>
        </div>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="rounded-3xl border border-red-100 bg-red-50 p-6">
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-1 h-5 w-5 shrink-0 text-red-600" />
          <div>
            <h2 className="text-lg font-black text-red-800">
              Trust Shield unavailable
            </h2>
            <p className="mt-2 text-sm leading-6 text-red-700">{errorMessage}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!trustShield) return null;

  return (
    <section className="rounded-3xl border border-emerald-100 bg-white p-5 shadow-sm md:p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="mb-2 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">
            <ShieldCheck className="h-4 w-4" />
            TrustPoint Safety Profile
          </p>

          <h2 className="text-2xl font-black text-slate-900">{title}</h2>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
            {subtitle}
          </p>
        </div>

        <div
          className={`rounded-3xl border p-5 text-center shadow-sm ${scoreStyle}`}
        >
          <p className="text-xs font-black uppercase tracking-wide">Trust Score</p>
          <p className="mt-1 text-5xl font-black">{score}%</p>
          <p className="mt-2 text-sm font-black">{trustShield.trust_level_label}</p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricBox
          label="Risk Level"
          value={formatLabel(trustShield.default_risk_level)}
          helper="Used later for payout risk checks."
        />

        <MetricBox
          label="Successful Payments"
          value={trustShield.successful_weekly_payments}
          helper="Confirmed weekly contributions."
        />

        <MetricBox
          label="Missed Payments"
          value={trustShield.missed_payments}
          helper="Missed or defaulted contributions."
        />

        <MetricBox
          label="Late Payments"
          value={trustShield.late_payments}
          helper="Paid after contribution deadline."
        />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <CheckItem
          checked={String(trustShield.verification_status || '').toUpperCase() === 'VERIFIED'}
          label="Identity verified"
          helper={`Current status: ${formatLabel(trustShield.verification_status)}`}
        />

        <CheckItem
          checked={trustShield.has_accepted_current_agreement}
          label="Agreement accepted"
          helper={
            trustShield.latest_agreement_accepted_at
              ? `Accepted on ${formatDate(trustShield.latest_agreement_accepted_at)}`
              : 'Agreement has not been accepted yet.'
          }
        />

        <CheckItem
          checked={trustShield.has_approved_guarantor}
          label="Guarantor approved"
          helper="Coming in Step 3 for higher-value Fund Spaces."
        />
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricBox
          label="Completed Cycles"
          value={trustShield.completed_fund_space_cycles}
        />

        <MetricBox
          label="Successful Payouts"
          value={trustShield.successful_payouts}
        />

        <MetricBox
          label="Total Paid"
          value={formatCurrency(trustShield.total_amount_paid)}
        />

        <MetricBox
          label="Payout Received"
          value={formatCurrency(trustShield.total_payout_received)}
        />
      </div>

      <div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50 p-4">
        <div className="flex items-start gap-3">
          <UsersRound className="mt-1 h-5 w-5 shrink-0 text-slate-500" />
          <div>
            <p className="text-sm font-black text-slate-900">
              Registered Agent
            </p>

            {trustShield.registered_agent_name ? (
              <p className="mt-1 text-sm leading-6 text-slate-600">
                {trustShield.registered_agent_name}
                {trustShield.registered_agent_phone
                  ? ` • ${trustShield.registered_agent_phone}`
                  : ''}
              </p>
            ) : (
              <p className="mt-1 text-sm leading-6 text-slate-500">
                No registered agent found for this member.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className={`mt-5 rounded-2xl border p-4 ${getRiskStyle(trustShield.default_risk_level)}`}>
        <div className="flex items-start gap-3">
          {trustShield.default_risk_level === 'LOW' ? (
            <BadgeCheck className="mt-1 h-5 w-5 shrink-0" />
          ) : trustShield.default_risk_level === 'MEDIUM' ? (
            <AlertTriangle className="mt-1 h-5 w-5 shrink-0" />
          ) : (
            <ShieldAlert className="mt-1 h-5 w-5 shrink-0" />
          )}

          <div>
            <p className="text-sm font-black">
              Default Risk: {formatLabel(trustShield.default_risk_level)}
            </p>
            <p className="mt-1 text-sm leading-6">
              This rating is calculated from verification, agreement status,
              payment history, missed payments, late payments, completed cycles,
              and default cases.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}