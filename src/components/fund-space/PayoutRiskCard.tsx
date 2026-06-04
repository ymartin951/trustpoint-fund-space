'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from 'lucide-react';

import { supabase } from '@/lib/supabase/client';

type PayoutRisk = {
  success?: boolean;
  payout_id?: string;
  fund_space_id?: string;
  fund_space_name?: string;
  round_id?: string;
  round_number?: number;
  recipient_user_id?: string;
  contribution_amount?: number;
  risk_score?: number;
  risk_result?: 'SAFE_TO_PAY' | 'REVIEW_BEFORE_PAYING' | 'HIGH_RISK_HOLD_PAYOUT' | string;
  risk_label?: string;
  reasons?: string[];
  warnings?: string[];
  required_actions?: string[];
  checks?: {
    verified_identity?: boolean;
    agreement_accepted?: boolean;
    has_emergency_contact?: boolean;
    has_approved_guarantor?: boolean;
    needs_guarantor?: boolean;
    needs_business_or_employment?: boolean;
    missed_payments?: number;
    late_payments?: number;
    default_cases?: number;
    trust_score?: number;
    trust_level_label?: string;
    default_risk_level?: string;
    membership_found?: boolean;
    membership_status?: string;
    joined_by_agent?: string | null;
  };
};

type ApiResponse = {
  success: boolean;
  message?: string;
  risk?: PayoutRisk;
};

function getRiskStyle(riskResult: string | undefined) {
  const value = String(riskResult || '').toUpperCase();

  if (value === 'SAFE_TO_PAY') {
    return {
      wrapper: 'border-emerald-200 bg-emerald-50 text-emerald-800',
      badge: 'border-emerald-200 bg-white text-emerald-700',
      icon: <ShieldCheck className="h-6 w-6" />,
    };
  }

  if (value === 'REVIEW_BEFORE_PAYING') {
    return {
      wrapper: 'border-amber-200 bg-amber-50 text-amber-800',
      badge: 'border-amber-200 bg-white text-amber-700',
      icon: <AlertTriangle className="h-6 w-6" />,
    };
  }

  return {
    wrapper: 'border-red-200 bg-red-50 text-red-800',
    badge: 'border-red-200 bg-white text-red-700',
    icon: <ShieldAlert className="h-6 w-6" />,
  };
}

function CheckItem({
  label,
  checked,
  value,
}: {
  label: string;
  checked: boolean;
  value?: string | number | null;
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl bg-white p-4">
      {checked ? (
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
      ) : (
        <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
      )}

      <div>
        <p className="text-sm font-black text-slate-900">{label}</p>
        {value !== undefined && value !== null && (
          <p className="mt-1 text-xs font-semibold text-slate-500">{value}</p>
        )}
      </div>
    </div>
  );
}

function ListSection({
  title,
  items,
  emptyText,
}: {
  title: string;
  items: string[];
  emptyText: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4">
      <p className="text-sm font-black text-slate-900">{title}</p>

      {items.length === 0 ? (
        <p className="mt-2 text-sm leading-6 text-slate-500">{emptyText}</p>
      ) : (
        <ul className="mt-3 space-y-2 text-sm font-semibold leading-6 text-slate-600">
          {items.map((item) => (
            <li key={item}>• {item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

async function readApiResponse(response: Response): Promise<ApiResponse> {
  const responseText = await response.text();

  if (!responseText) {
    return {
      success: false,
      message:
        'The server returned an empty response while loading payout risk.',
    };
  }

  try {
    return JSON.parse(responseText) as ApiResponse;
  } catch {
    return {
      success: false,
      message:
        'The server returned an invalid response while loading payout risk.',
    };
  }
}

export default function PayoutRiskCard({
  payoutId,
  compact = false,
}: {
  payoutId: string | null | undefined;
  compact?: boolean;
}) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [risk, setRisk] = useState<PayoutRisk | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  const loadRisk = useCallback(
    async (showRefresh = false) => {
      try {
        if (!payoutId) {
          setRisk(null);
          setErrorMessage('Payout ID is missing.');
          setLoading(false);
          return;
        }

        if (showRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setErrorMessage('');

        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError || !session?.access_token) {
          throw new Error('Your session has expired. Please log in again.');
        }

        const response = await fetch(
          `/api/admin/fund-space/payout-risk?payout_id=${encodeURIComponent(
            payoutId
          )}`,
          {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
          }
        );

        const result = await readApiResponse(response);

        if (!response.ok || !result.success || !result.risk) {
          throw new Error(result.message || 'Unable to load payout risk.');
        }

        setRisk(result.risk);
      } catch (error) {
        setRisk(null);
        setErrorMessage(
          error instanceof Error ? error.message : 'Unable to load payout risk.'
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [payoutId]
  );

  useEffect(() => {
    loadRisk();
  }, [loadRisk]);

  const style = useMemo(
    () => getRiskStyle(risk?.risk_result),
    [risk?.risk_result]
  );

  if (loading) {
    return (
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-emerald-700" />
          <p className="text-sm font-bold text-slate-600">
            Loading payout risk...
          </p>
        </div>
      </section>
    );
  }

  if (errorMessage) {
    return (
      <section className="rounded-3xl border border-red-200 bg-red-50 p-5 text-red-700 shadow-sm">
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="text-sm font-black">Payout risk unavailable</p>
            <p className="mt-1 text-sm font-semibold leading-6">
              {errorMessage}
            </p>
          </div>
        </div>
      </section>
    );
  }

  if (!risk) return null;

  const reasons = Array.isArray(risk.reasons) ? risk.reasons : [];
  const warnings = Array.isArray(risk.warnings) ? risk.warnings : [];
  const requiredActions = Array.isArray(risk.required_actions)
    ? risk.required_actions
    : [];

  const checks = risk.checks || {};

  return (
    <section className={`rounded-3xl border p-5 shadow-sm ${style.wrapper}`}>
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-white p-3">{style.icon}</div>

          <div>
            <p className="text-xs font-black uppercase tracking-wide opacity-80">
              Smart Payout Risk Engine
            </p>

            <h2 className="mt-1 text-2xl font-black">
              {risk.risk_label || 'Payout Risk'}
            </h2>

            <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 opacity-90">
              This result guides admin before payout approval. It does not block
              approval automatically, but high-risk payouts should be reviewed
              carefully.
            </p>
          </div>
        </div>

        <div className={`rounded-2xl border px-5 py-4 text-center ${style.badge}`}>
          <p className="text-xs font-black uppercase tracking-wide">
            Risk Score
          </p>
          <p className="mt-1 text-4xl font-black">
            {Number(risk.risk_score || 0)}
          </p>
          <p className="mt-1 text-xs font-bold">out of 100</p>
        </div>
      </div>

      {!compact && (
        <>
          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            <ListSection
              title="Main Reasons"
              items={reasons}
              emptyText="No major risk reason found."
            />

            <ListSection
              title="Warnings"
              items={warnings}
              emptyText="No warning found."
            />

            <ListSection
              title="Required Actions"
              items={requiredActions}
              emptyText="No required action."
            />
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <CheckItem
              label="Verified Identity"
              checked={Boolean(checks.verified_identity)}
            />

            <CheckItem
              label="Agreement Accepted"
              checked={Boolean(checks.agreement_accepted)}
            />

            <CheckItem
              label="Emergency Contact"
              checked={Boolean(checks.has_emergency_contact)}
            />

            <CheckItem
              label="Approved Guarantor"
              checked={
                checks.needs_guarantor
                  ? Boolean(checks.has_approved_guarantor)
                  : true
              }
              value={
                checks.needs_guarantor
                  ? 'Required for this plan'
                  : 'Not required for this plan'
              }
            />

            <CheckItem
              label="Missed Payments"
              checked={Number(checks.missed_payments || 0) === 0}
              value={Number(checks.missed_payments || 0)}
            />

            <CheckItem
              label="Late Payments"
              checked={Number(checks.late_payments || 0) === 0}
              value={Number(checks.late_payments || 0)}
            />

            <CheckItem
              label="Default Cases"
              checked={Number(checks.default_cases || 0) === 0}
              value={Number(checks.default_cases || 0)}
            />

            <CheckItem
              label="Trust Shield"
              checked={Number(checks.trust_score || 0) >= 55}
              value={`${Number(checks.trust_score || 0)}% • ${
                checks.trust_level_label || 'Not available'
              }`}
            />
          </div>
        </>
      )}

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs font-semibold opacity-80">
          Fund Space: {risk.fund_space_name || 'Not available'} • Round{' '}
          {risk.round_number || 'N/A'}
        </p>

        <button
          type="button"
          onClick={() => loadRisk(true)}
          disabled={refreshing}
          className="inline-flex min-h-10 w-fit items-center justify-center gap-2 rounded-xl bg-white px-4 text-xs font-black text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {refreshing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Refresh Risk
        </button>
      </div>
    </section>
  );
}