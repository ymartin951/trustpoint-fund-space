'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  ArrowLeft,
  BadgeCheck,
  BriefcaseBusiness,
  CheckCircle2,
  Clock,
  FileText,
  IdCard,
  Loader2,
  Phone,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  UserRound,
  UsersRound,
  XCircle,
} from 'lucide-react';

import { supabase } from '@/lib/supabase/client';

type Profile = {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  role: string | null;
  status: string | null;
  verification_status: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  business_name: string | null;
  business_type: string | null;
  business_location: string | null;
  employer_name: string | null;
  staff_id: string | null;
};

type Guarantor = {
  id: string;
  user_id: string;
  full_name: string;
  phone: string;
  relationship_to_member: string;
  location: string | null;
  id_type: string | null;
  id_number: string | null;
  consent_status: string;
  verification_status: string;
  admin_review_status: string;
  rejection_reason: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

type EligibilityResult = {
  user_id?: string;
  contribution_amount?: number;
  is_eligible?: boolean;
  missing_requirements?: string[];
  has_verified_identity?: boolean;
  has_emergency_contact?: boolean;
  has_approved_guarantor?: boolean;
  approved_guarantor_count?: number;
  has_business_or_employment_proof?: boolean;
  eligible_for_50?: boolean;
  eligible_for_100?: boolean;
  eligible_for_200?: boolean;
  eligible_for_500?: boolean;
};

type EligibilityMap = {
  50?: EligibilityResult | null;
  100?: EligibilityResult | null;
  200?: EligibilityResult | null;
  500?: EligibilityResult | null;
};

type ApiResponse = {
  success: boolean;
  message?: string;
  profile?: Profile;
  guarantors?: Guarantor[];
  eligibility?: EligibilityMap;
  result?: {
    success?: boolean;
    message?: string;
    guarantor_id?: string;
    status?: string;
  };
};

type FormState = {
  full_name: string;
  phone: string;
  relationship_to_member: string;
  location: string;
  id_type: string;
  id_number: string;
};

const emptyForm: FormState = {
  full_name: '',
  phone: '',
  relationship_to_member: '',
  location: '',
  id_type: '',
  id_number: '',
};

function formatDateTime(value: string | null | undefined) {
  if (!value) return 'Not available';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return 'Invalid date';

  return date.toLocaleString('en-GH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatLabel(value: string | null | undefined) {
  if (!value) return 'Not set';

  return value
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusStyle(status: string | null | undefined) {
  const value = String(status || '').toUpperCase();

  if (['APPROVED', 'VERIFIED', 'CONSENTED', 'ACTIVE'].includes(value)) {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }

  if (['PENDING', 'UNVERIFIED'].includes(value)) {
    return 'border-amber-200 bg-amber-50 text-amber-700';
  }

  if (['REJECTED', 'DECLINED', 'SUSPENDED'].includes(value)) {
    return 'border-red-200 bg-red-50 text-red-700';
  }

  return 'border-slate-200 bg-slate-50 text-slate-700';
}

function getStatusIcon(status: string | null | undefined) {
  const value = String(status || '').toUpperCase();

  if (['APPROVED', 'VERIFIED', 'CONSENTED', 'ACTIVE'].includes(value)) {
    return <CheckCircle2 className="h-4 w-4" />;
  }

  if (['REJECTED', 'DECLINED', 'SUSPENDED'].includes(value)) {
    return <XCircle className="h-4 w-4" />;
  }

  return <Clock className="h-4 w-4" />;
}

function normalizeError(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function RequirementRow({
  label,
  checked,
  helper,
}: {
  label: string;
  checked: boolean;
  helper: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-white p-4">
      {checked ? (
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
      ) : (
        <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
      )}

      <div>
        <p className="text-sm font-black text-slate-900">{label}</p>
        <p className="mt-1 text-xs leading-5 text-slate-500">{helper}</p>
      </div>
    </div>
  );
}

function InputField({
  label,
  value,
  onChange,
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-sm font-black text-slate-700">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>

      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-2 min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-100"
      />
    </label>
  );
}

export default function MemberGuarantorPage() {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [guarantors, setGuarantors] = useState<Guarantor[]>([]);
  const [eligibility, setEligibility] = useState<EligibilityMap | undefined>(
    undefined
  );

  const [form, setForm] = useState<FormState>(emptyForm);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const latestGuarantor = useMemo(() => {
    return guarantors[0] || null;
  }, [guarantors]);

  const hasApprovedGuarantor = useMemo(() => {
    return guarantors.some(
      (item) =>
        item.admin_review_status === 'APPROVED' &&
        item.verification_status === 'VERIFIED' &&
        item.consent_status === 'CONSENTED'
    );
  }, [guarantors]);

  const canSubmit = useMemo(() => {
    return (
      form.full_name.trim().length > 0 &&
      form.phone.trim().length > 0 &&
      form.relationship_to_member.trim().length > 0 &&
      !submitting
    );
  }, [form, submitting]);

  const loadData = useCallback(async (showRefresh = false) => {
    try {
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

      const response = await fetch('/api/guarantor', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const responseText = await response.text();

      let result: ApiResponse | null = null;

      try {
        result = responseText ? (JSON.parse(responseText) as ApiResponse) : null;
      } catch {
        throw new Error(
          'The server returned an invalid response while loading guarantor information.'
        );
      }

      if (!response.ok || !result?.success) {
        throw new Error(
          result?.message || 'Unable to load guarantor information.'
        );
      }

      setProfile(result.profile || null);
      setGuarantors(result.guarantors || []);
      setEligibility(result.eligibility || undefined);
    } catch (error) {
      setErrorMessage(
        normalizeError(error, 'Unable to load guarantor information.')
      );

      setProfile(null);
      setGuarantors([]);
      setEligibility(undefined);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setSubmitting(true);
      setErrorMessage('');
      setSuccessMessage('');

      if (!form.full_name.trim()) {
        throw new Error('Guarantor full name is required.');
      }

      if (!form.phone.trim()) {
        throw new Error('Guarantor phone number is required.');
      }

      if (!form.relationship_to_member.trim()) {
        throw new Error('Relationship to member is required.');
      }

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.access_token) {
        throw new Error('Your session has expired. Please log in again.');
      }

      const response = await fetch('/api/guarantor', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          full_name: form.full_name.trim(),
          phone: form.phone.trim(),
          relationship_to_member: form.relationship_to_member.trim(),
          location: form.location.trim(),
          id_type: form.id_type.trim(),
          id_number: form.id_number.trim(),
        }),
      });

      const responseText = await response.text();

      let result: ApiResponse | null = null;

      try {
        result = responseText ? (JSON.parse(responseText) as ApiResponse) : null;
      } catch {
        throw new Error(
          'The server returned an invalid response after submitting guarantor information.'
        );
      }

      if (!response.ok || !result?.success) {
        throw new Error(
          result?.message || 'Unable to submit guarantor information.'
        );
      }

      setSuccessMessage(
        result.message ||
          result.result?.message ||
          'Guarantor information submitted successfully. Admin will review it.'
      );

      setForm(emptyForm);

      await loadData(true);
    } catch (error) {
      setErrorMessage(
        normalizeError(error, 'Unable to submit guarantor information.')
      );
    } finally {
      setSubmitting(false);
    }
  }

  function fillFormFromLatest() {
    if (!latestGuarantor) return;

    setForm({
      full_name: latestGuarantor.full_name || '',
      phone: latestGuarantor.phone || '',
      relationship_to_member: latestGuarantor.relationship_to_member || '',
      location: latestGuarantor.location || '',
      id_type: latestGuarantor.id_type || '',
      id_number: latestGuarantor.id_number || '',
    });

    setSuccessMessage('');
    setErrorMessage('');
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-6 md:px-8">
        <div className="mx-auto flex min-h-[60vh] max-w-6xl items-center justify-center">
          <div className="text-center">
            <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-emerald-700" />
            <h1 className="text-lg font-black text-slate-900">
              Loading guarantor page...
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Please wait while TrustPoint checks your safety requirements.
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 md:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <Link
            href="/dashboard/fund-space/join"
            className="inline-flex min-h-11 w-fit items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-100"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Join Fund Space
          </Link>

          <button
            type="button"
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="inline-flex min-h-11 w-fit items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw
              className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`}
            />
            Refresh
          </button>
        </div>

        <section className="rounded-3xl bg-gradient-to-br from-emerald-800 via-emerald-700 to-teal-700 p-6 text-white shadow-sm md:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-black">
                <UsersRound className="h-4 w-4" />
                TrustPoint Safety Requirement
              </p>

              <h1 className="text-3xl font-black tracking-tight md:text-4xl">
                Guarantor Information
              </h1>

              <p className="mt-3 max-w-3xl text-sm leading-7 text-emerald-50">
                A guarantor helps TrustPoint reduce default risk for higher-value
                Fund Spaces. GH₵200 and GH₵500 plans require an approved
                guarantor before joining.
              </p>
            </div>

            <div className="rounded-3xl bg-white/15 p-5 backdrop-blur lg:min-w-72">
              <p className="text-sm text-emerald-50">Guarantor Status</p>
              <p className="mt-1 text-2xl font-black">
                {hasApprovedGuarantor
                  ? 'Approved'
                  : latestGuarantor
                    ? formatLabel(latestGuarantor.admin_review_status)
                    : 'Not Submitted'}
              </p>
              <p className="mt-2 text-xs font-semibold text-emerald-50">
                {hasApprovedGuarantor
                  ? 'You can meet high-value plan guarantor requirement.'
                  : latestGuarantor
                    ? 'Your guarantor information is saved and waiting for admin decision.'
                    : 'Submit and wait for admin approval.'}
              </p>
            </div>
          </div>
        </section>

        {successMessage && (
          <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-700">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="text-sm font-black leading-6">
                  Guarantor submitted successfully
                </p>
                <p className="mt-1 text-sm font-semibold leading-6">
                  {successMessage}
                </p>
              </div>
            </div>
          </div>
        )}

        {errorMessage && (
          <div className="rounded-3xl border border-red-200 bg-red-50 p-5 text-red-700">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
              <p className="text-sm font-bold leading-6">{errorMessage}</p>
            </div>
          </div>
        )}

        <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <RequirementRow
            label="Verified identity"
            checked={Boolean(eligibility?.[50]?.has_verified_identity)}
            helper="Required for every Fund Space plan."
          />

          <RequirementRow
            label="Emergency contact"
            checked={Boolean(eligibility?.[100]?.has_emergency_contact)}
            helper="Required from GH₵100 plan upward."
          />

          <RequirementRow
            label="Approved guarantor"
            checked={Boolean(eligibility?.[200]?.has_approved_guarantor)}
            helper="Required for GH₵200 and GH₵500 plans."
          />

          <RequirementRow
            label="Business/employment details"
            checked={Boolean(eligibility?.[500]?.has_business_or_employment_proof)}
            helper="Required for GH₵500 plan."
          />
        </section>

        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
            <div className="mb-6 flex items-start gap-3">
              <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-700">
                <UserRound className="h-6 w-6" />
              </div>

              <div>
                <h2 className="text-xl font-black text-slate-900">
                  Submit Guarantor
                </h2>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  Provide a trusted person who can confirm your identity and
                  responsibility. Admin will review the information before it is
                  accepted.
                </p>
              </div>
            </div>

            {latestGuarantor && (
              <div className="mb-5 rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-black text-emerald-800">
                      Latest submitted guarantor is saved
                    </p>
                    <p className="mt-1 text-xs font-semibold leading-5 text-emerald-700">
                      {latestGuarantor.full_name} • {latestGuarantor.phone} •{' '}
                      {formatLabel(latestGuarantor.admin_review_status)}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={fillFormFromLatest}
                    className="inline-flex min-h-10 w-fit items-center justify-center rounded-xl bg-white px-4 text-xs font-black text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-100"
                  >
                    Edit Latest
                  </button>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid gap-5 md:grid-cols-2">
                <InputField
                  label="Guarantor Full Name"
                  value={form.full_name}
                  onChange={(value) =>
                    setForm((current) => ({ ...current, full_name: value }))
                  }
                  placeholder="Example: Kwame Mensah"
                  required
                />

                <InputField
                  label="Guarantor Phone Number"
                  value={form.phone}
                  onChange={(value) =>
                    setForm((current) => ({ ...current, phone: value }))
                  }
                  placeholder="Example: 0240000000"
                  required
                />

                <InputField
                  label="Relationship to Member"
                  value={form.relationship_to_member}
                  onChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      relationship_to_member: value,
                    }))
                  }
                  placeholder="Example: Brother, Employer, Pastor, Trader leader"
                  required
                />

                <InputField
                  label="Guarantor Location"
                  value={form.location}
                  onChange={(value) =>
                    setForm((current) => ({ ...current, location: value }))
                  }
                  placeholder="Example: Kumasi, Kejetia"
                />

                <InputField
                  label="ID Type"
                  value={form.id_type}
                  onChange={(value) =>
                    setForm((current) => ({ ...current, id_type: value }))
                  }
                  placeholder="Example: Ghana Card"
                />

                <InputField
                  label="ID Number"
                  value={form.id_number}
                  onChange={(value) =>
                    setForm((current) => ({ ...current, id_number: value }))
                  }
                  placeholder="Optional guarantor ID number"
                />
              </div>

              <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
                <div className="flex items-start gap-3">
                  <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
                  <p className="text-sm font-semibold leading-6 text-amber-800">
                    Only submit a real guarantor who knows you. False guarantor
                    information may affect your Trust Shield and high-value Fund
                    Space eligibility.
                  </p>
                </div>
              </div>

              <button
                type="submit"
                disabled={!canSubmit}
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-5 text-sm font-black text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60 md:w-auto"
              >
                {submitting ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <ShieldCheck className="h-5 w-5" />
                )}
                {submitting ? 'Submitting...' : 'Submit Guarantor'}
              </button>
            </form>
          </section>

          <aside className="space-y-5">
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 inline-flex rounded-2xl bg-emerald-50 p-3 text-emerald-700">
                <BadgeCheck className="h-6 w-6" />
              </div>

              <h2 className="text-lg font-black text-slate-900">
                Plan Eligibility
              </h2>

              <div className="mt-4 space-y-3">
                <PlanStatus
                  amount="GH₵50"
                  eligible={Boolean(eligibility?.[50]?.is_eligible)}
                  helper="Verified identity"
                />

                <PlanStatus
                  amount="GH₵100"
                  eligible={Boolean(eligibility?.[100]?.is_eligible)}
                  helper="Identity + emergency contact"
                />

                <PlanStatus
                  amount="GH₵200"
                  eligible={Boolean(eligibility?.[200]?.is_eligible)}
                  helper="Identity + emergency contact + guarantor"
                />

                <PlanStatus
                  amount="GH₵500"
                  eligible={Boolean(eligibility?.[500]?.is_eligible)}
                  helper="Identity + emergency contact + guarantor + work/business"
                />
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 inline-flex rounded-2xl bg-slate-50 p-3 text-slate-700">
                <FileText className="h-6 w-6" />
              </div>

              <h2 className="text-lg font-black text-slate-900">
                Current Submission
              </h2>

              {!latestGuarantor ? (
                <p className="mt-3 text-sm leading-6 text-slate-500">
                  No guarantor has been submitted yet.
                </p>
              ) : (
                <div className="mt-4 space-y-3">
                  <StatusPill
                    label="Admin Review"
                    status={latestGuarantor.admin_review_status}
                  />

                  <StatusPill
                    label="Verification"
                    status={latestGuarantor.verification_status}
                  />

                  <StatusPill
                    label="Consent"
                    status={latestGuarantor.consent_status}
                  />

                  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                    <p className="text-xs font-black uppercase tracking-wide text-slate-400">
                      Guarantor
                    </p>
                    <p className="mt-1 text-sm font-black text-slate-900">
                      {latestGuarantor.full_name}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">
                      {latestGuarantor.phone} •{' '}
                      {latestGuarantor.relationship_to_member}
                    </p>
                  </div>

                  {latestGuarantor.rejection_reason && (
                    <div className="rounded-2xl border border-red-100 bg-red-50 p-4">
                      <p className="text-xs font-black uppercase tracking-wide text-red-500">
                        Rejection Reason
                      </p>
                      <p className="mt-2 text-sm font-semibold leading-6 text-red-700">
                        {latestGuarantor.rejection_reason}
                      </p>
                    </div>
                  )}

                  <p className="text-xs leading-5 text-slate-500">
                    Last updated: {formatDateTime(latestGuarantor.updated_at)}
                  </p>
                </div>
              )}
            </section>

            <section className="rounded-3xl border border-amber-100 bg-amber-50 p-5 text-amber-800 shadow-sm">
              <div className="mb-4 inline-flex rounded-2xl bg-white p-3 text-amber-700">
                <AlertCircle className="h-6 w-6" />
              </div>

              <h2 className="text-lg font-black">Important</h2>

              <ul className="mt-3 space-y-2 text-sm font-semibold leading-6">
                <li>• GH₵200 and GH₵500 require an approved guarantor.</li>
                <li>• Admin must approve before it counts.</li>
                <li>• Rejected guarantor can be corrected and resubmitted.</li>
                <li>• False information can reduce your Trust Shield score.</li>
              </ul>
            </section>
          </aside>
        </div>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-2xl bg-slate-50 p-3 text-slate-700">
              <Clock className="h-6 w-6" />
            </div>

            <div>
              <h2 className="text-lg font-black text-slate-900">
                Guarantor History
              </h2>
              <p className="text-sm text-slate-500">
                Your submitted guarantor records appear here.
              </p>
            </div>
          </div>

          {guarantors.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center">
              <UsersRound className="mx-auto mb-3 h-10 w-10 text-slate-300" />
              <h3 className="text-sm font-black text-slate-700">
                No guarantor records yet
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Submit your guarantor information above.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {guarantors.map((guarantor) => (
                <div
                  key={guarantor.id}
                  className="rounded-3xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-black text-slate-900">
                        {guarantor.full_name}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-500">
                        {guarantor.phone} •{' '}
                        {guarantor.relationship_to_member}
                      </p>
                    </div>

                    <span
                      className={`inline-flex w-fit items-center gap-1 rounded-full border px-3 py-1 text-xs font-black ${statusStyle(
                        guarantor.admin_review_status
                      )}`}
                    >
                      {getStatusIcon(guarantor.admin_review_status)}
                      {formatLabel(guarantor.admin_review_status)}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <SmallInfo
                      icon={<Phone className="h-4 w-4" />}
                      label="Location"
                      value={guarantor.location || 'Not provided'}
                    />

                    <SmallInfo
                      icon={<IdCard className="h-4 w-4" />}
                      label="ID"
                      value={
                        guarantor.id_type || guarantor.id_number
                          ? `${guarantor.id_type || 'ID'} • ${
                              guarantor.id_number || 'No number'
                            }`
                          : 'Not provided'
                      }
                    />

                    <SmallInfo
                      icon={<Clock className="h-4 w-4" />}
                      label="Submitted"
                      value={formatDateTime(guarantor.created_at)}
                    />

                    <SmallInfo
                      icon={<BriefcaseBusiness className="h-4 w-4" />}
                      label="Consent"
                      value={formatLabel(guarantor.consent_status)}
                    />
                  </div>

                  {guarantor.rejection_reason && (
                    <div className="mt-4 rounded-2xl border border-red-100 bg-red-50 p-4">
                      <p className="text-xs font-black uppercase tracking-wide text-red-500">
                        Rejection Reason
                      </p>
                      <p className="mt-2 text-sm font-semibold leading-6 text-red-700">
                        {guarantor.rejection_reason}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function PlanStatus({
  amount,
  eligible,
  helper,
}: {
  amount: string;
  eligible: boolean;
  helper: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4">
      {eligible ? (
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
      ) : (
        <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
      )}

      <div>
        <p className="text-sm font-black text-slate-900">{amount}</p>
        <p className="mt-1 text-xs leading-5 text-slate-500">{helper}</p>
      </div>
    </div>
  );
}

function StatusPill({ label, status }: { label: string; status: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-3">
      <p className="text-xs font-black uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <span
        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-black ${statusStyle(
          status
        )}`}
      >
        {getStatusIcon(status)}
        {formatLabel(status)}
      </span>
    </div>
  );
}

function SmallInfo({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl bg-white p-3">
      <p className="mb-1 flex items-center gap-2 text-xs font-black uppercase tracking-wide text-slate-400">
        {icon}
        {label}
      </p>
      <p className="break-words text-sm font-bold text-slate-800">{value}</p>
    </div>
  );
}