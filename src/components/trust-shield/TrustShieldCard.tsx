'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BadgeCheck,
  CheckCircle2,
  Clock,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  Star,
  Trophy,
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
  if (score >= 85) {
    return {
      card: 'border-emerald-200 bg-emerald-50 text-emerald-700',
      bar: 'bg-emerald-600',
      soft: 'bg-emerald-100 text-emerald-700',
    };
  }

  if (score >= 70) {
    return {
      card: 'border-blue-200 bg-blue-50 text-blue-700',
      bar: 'bg-blue-600',
      soft: 'bg-blue-100 text-blue-700',
    };
  }

  if (score >= 55) {
    return {
      card: 'border-amber-200 bg-amber-50 text-amber-700',
      bar: 'bg-amber-500',
      soft: 'bg-amber-100 text-amber-700',
    };
  }

  if (score >= 25) {
    return {
      card: 'border-orange-200 bg-orange-50 text-orange-700',
      bar: 'bg-orange-500',
      soft: 'bg-orange-100 text-orange-700',
    };
  }

  return {
    card: 'border-red-200 bg-red-50 text-red-700',
    bar: 'bg-red-600',
    soft: 'bg-red-100 text-red-700',
  };
}

function getRiskStyle(risk: string | null | undefined) {
  const value = String(risk || '').toUpperCase();

  if (value === 'LOW') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (value === 'MEDIUM') return 'border-amber-200 bg-amber-50 text-amber-700';

  return 'border-red-200 bg-red-50 text-red-700';
}

function MetricBox({
  label,
  value,
  helper,
  icon,
}: {
  label: string;
  value: string | number;
  helper?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase leading-4 tracking-wide text-slate-400">
            {label}
          </p>

          <p className="mt-2 break-words text-2xl font-black leading-tight text-slate-900">
            {value}
          </p>
        </div>

        {icon && (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
            {icon}
          </div>
        )}
      </div>

      {helper && (
        <p className="mt-2 break-words text-xs font-semibold leading-5 text-slate-500">
          {helper}
        </p>
      )}
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
    <div className="min-w-0 rounded-2xl border border-slate-100 bg-slate-50 p-4">
      <div className="flex items-start gap-3">
        {checked ? (
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
        ) : (
          <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
        )}

        <div className="min-w-0">
          <p className="break-words text-sm font-black leading-5 text-slate-900">
            {label}
          </p>

          {helper && (
            <p className="mt-1 break-words text-xs font-semibold leading-5 text-slate-500">
              {helper}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function ScoreCard({
  score,
  level,
}: {
  score: number;
  level: string;
}) {
  const scoreStyle = getTrustColor(score);
  const safeScore = Math.max(0, Math.min(Number(score || 0), 100));

  return (
    <div className={`rounded-3xl border p-5 shadow-sm ${scoreStyle.card}`}>
      <p className="text-center text-xs font-black uppercase tracking-wide">
        Trust Score
      </p>

      <p className="mt-3 text-center text-5xl font-black leading-none md:text-6xl">
        {safeScore}%
      </p>

      <p className="mt-3 text-center text-sm font-black leading-5">
        {level || 'Not rated yet'}
      </p>

      <div className="mt-5 h-3 overflow-hidden rounded-full bg-white/80">
        <div
          className={`h-full rounded-full ${scoreStyle.bar}`}
          style={{ width: `${safeScore}%` }}
        />
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
  const scoreColor = useMemo(() => getTrustColor(score), [score]);

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

          <div className="min-w-0">
            <h2 className="text-lg font-black text-red-700">
              Trust Shield unavailable
            </h2>

            <p className="mt-2 break-words text-sm font-semibold leading-6 text-red-600">
              {errorMessage}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!trustShield) {
    return (
      <div className="rounded-3xl border border-slate-100 bg-white p-6 text-center shadow-sm">
        <ShieldCheck className="mx-auto h-10 w-10 text-slate-300" />

        <h2 className="mt-4 text-lg font-black text-slate-900">
          No Trust Shield profile found
        </h2>

        <p className="mt-2 text-sm leading-6 text-slate-500">
          This member does not have enough activity yet.
        </p>
      </div>
    );
  }

  return (
    <section className="overflow-hidden rounded-3xl border border-emerald-100 bg-white shadow-sm">
      <div className="border-b border-slate-100 bg-gradient-to-br from-emerald-50 via-white to-white p-5 md:p-6">
        <div className="grid gap-5 lg:grid-cols-[1fr_260px] lg:items-center">
          <div className="min-w-0">
            <p className="inline-flex max-w-full items-center gap-2 rounded-full bg-emerald-100 px-4 py-2 text-xs font-black text-emerald-700">
              <ShieldCheck className="h-4 w-4 shrink-0" />
              <span className="truncate">TrustPoint Safety Profile</span>
            </p>

            <h2 className="mt-4 break-words text-2xl font-black leading-tight text-slate-950 md:text-3xl">
              {title}
            </h2>

            <p className="mt-3 max-w-2xl break-words text-sm font-semibold leading-7 text-slate-600">
              {subtitle}
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <span
                className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${getRiskStyle(
                  trustShield.default_risk_level
                )}`}
              >
                Risk: {formatLabel(trustShield.default_risk_level)}
              </span>

              <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${scoreColor.soft}`}>
                {formatLabel(trustShield.trust_level_label)}
              </span>

              <span className="inline-flex rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-black text-slate-600">
                Joined Spaces: {trustShield.total_fund_spaces_joined || 0}
              </span>
            </div>
          </div>

          <ScoreCard
            score={score}
            level={trustShield.trust_level_label}
          />
        </div>
      </div>

      <div className="space-y-5 p-5 md:p-6">
        <div>
          <h3 className="text-base font-black text-slate-900">
            Contribution Performance
          </h3>

          <p className="mt-1 text-sm leading-6 text-slate-500">
            These numbers help TrustPoint understand how reliable this member is
            in weekly contribution groups.
          </p>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricBox
              label="Risk Level"
              value={formatLabel(trustShield.default_risk_level)}
              helper="Used later for payout risk checks."
              icon={<AlertTriangle className="h-4 w-4" />}
            />

            <MetricBox
              label="Successful Payments"
              value={trustShield.successful_weekly_payments || 0}
              helper="Confirmed weekly contributions."
              icon={<CheckCircle2 className="h-4 w-4" />}
            />

            <MetricBox
              label="Missed Payments"
              value={trustShield.missed_payments || 0}
              helper="Missed or defaulted contributions."
              icon={<XCircle className="h-4 w-4" />}
            />

            <MetricBox
              label="Late Payments"
              value={trustShield.late_payments || 0}
              helper="Paid after the contribution deadline."
              icon={<Clock className="h-4 w-4" />}
            />
          </div>
        </div>

        <div>
          <h3 className="text-base font-black text-slate-900">
            Safety Requirements
          </h3>

          <p className="mt-1 text-sm leading-6 text-slate-500">
            These checks help protect the group before payouts are released.
          </p>

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            <CheckItem
              checked={String(trustShield.verification_status || '').toUpperCase() === 'VERIFIED'}
              label="Identity Verified"
              helper={`Verification status: ${formatLabel(
                trustShield.verification_status
              )}`}
            />

            <CheckItem
              checked={trustShield.has_accepted_current_agreement}
              label="Agreement Accepted"
              helper={
                trustShield.latest_agreement_accepted_at
                  ? `Accepted on ${formatDate(trustShield.latest_agreement_accepted_at)}`
                  : 'Current agreement not accepted yet.'
              }
            />

            <CheckItem
              checked={trustShield.has_approved_guarantor}
              label="Guarantor Approved"
              helper={
                trustShield.has_approved_guarantor
                  ? 'Approved guarantor is available.'
                  : 'No approved guarantor found.'
              }
            />

            <CheckItem
              checked={trustShield.has_emergency_contact}
              label="Emergency Contact"
              helper={
                trustShield.has_emergency_contact
                  ? 'Emergency contact is available.'
                  : 'Emergency contact is missing.'
              }
            />

            <CheckItem
              checked={trustShield.default_cases <= 0}
              label="Default Record"
              helper={
                trustShield.default_cases > 0
                  ? `${trustShield.default_cases} default case(s) found.`
                  : 'No default case recorded.'
              }
            />

            <CheckItem
              checked={trustShield.successful_payouts >= 0}
              label="Payout History"
              helper={`${trustShield.successful_payouts || 0} successful payout(s) recorded.`}
            />
          </div>
        </div>

        <div>
          <h3 className="text-base font-black text-slate-900">
            Financial Summary
          </h3>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricBox
              label="Total Amount Due"
              value={formatCurrency(trustShield.total_amount_due)}
              helper="Total expected contribution amount."
              icon={<UsersRound className="h-4 w-4" />}
            />

            <MetricBox
              label="Total Amount Paid"
              value={formatCurrency(trustShield.total_amount_paid)}
              helper="Total contribution amount paid."
              icon={<BadgeCheck className="h-4 w-4" />}
            />

            <MetricBox
              label="Payouts Received"
              value={trustShield.successful_payouts || 0}
              helper="Number of successful payouts."
              icon={<Trophy className="h-4 w-4" />}
            />

            <MetricBox
              label="Total Payout Received"
              value={formatCurrency(trustShield.total_payout_received)}
              helper="Total amount received as payout."
              icon={<Star className="h-4 w-4" />}
            />
          </div>
        </div>

        {trustShield.registered_agent_name && (
          <div className="rounded-3xl border border-slate-100 bg-slate-50 p-4">
            <div className="flex items-start gap-3">
              <UserRoundCheck className="mt-1 h-5 w-5 shrink-0 text-emerald-700" />

              <div className="min-w-0">
                <p className="text-sm font-black text-slate-900">
                  Registered Agent
                </p>

                <p className="mt-1 break-words text-sm font-semibold leading-6 text-slate-600">
                  {trustShield.registered_agent_name}
                  {trustShield.registered_agent_phone
                    ? ` · ${trustShield.registered_agent_phone}`
                    : ''}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}