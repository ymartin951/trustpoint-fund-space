'use client';

import type { FormEvent, ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Banknote,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Clock,
  Eye,
  FileText,
  IdCard,
  Loader2,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Upload,
  User,
  UserPlus,
  UserRound,
  Wallet,
  X,
  XCircle,
} from 'lucide-react';

import TrustShieldCard from '@/components/trust-shield/TrustShieldCard';
import { supabase } from '@/lib/supabase/client';

const contributionAmounts = [50, 100, 200, 500];

type Customer = {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  role: string;
  status: string;
  user_category: string;
  verification_status: string;
  country: string | null;
  region: string | null;
  city: string | null;
  location: string | null;
  date_of_birth: string | null;
  gender: string | null;
  ghana_card: string | null;
  occupation: string | null;
  employer_name?: string | null;
  staff_id?: string | null;
  business_name: string | null;
  business_type: string | null;
  business_location: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  momo_number: string | null;
  bank_name: string | null;
  bank_account_name: string | null;
  bank_account_number: string | null;
  registered_by_agent: string | null;
  trust_score: number;
  missed_payment_count: number;
  successful_cycles_count: number;
  has_received_payout_before: boolean;
  is_blacklisted: boolean;
  blacklist_reason: string | null;
  created_at: string | null;
  updated_at: string | null;
  id_type?: string | null;
  id_number?: string | null;
  id_document_front_url?: string | null;
  id_document_back_url?: string | null;
  selfie_url?: string | null;
};

type Relationship = {
  id: string;
  agent_id: string;
  customer_id: string;
  relationship_status: string;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type VerificationRequest = {
  id: string;
  user_id: string;
  full_name: string;
  phone: string;
  email: string | null;
  status: string;
  rejection_reason: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  submitted_by_agent: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type ReviewedByProfile = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  role: string;
};

type CustomerResponse = {
  success: boolean;
  message?: string;
  customer: Customer;
  relationship: Relationship;
  verification_request: VerificationRequest | null;
  reviewed_by_profile: ReviewedByProfile | null;
  documents: {
    id_front_url: string | null;
    id_back_url: string | null;
    selfie_url: string | null;
  };
};

type TrustShieldSummary = {
  trust_score: number;
  trust_level_label: string;
  default_risk_level: string;
};

type TrustShieldApiResponse = {
  success: boolean;
  message?: string;
  trust_shield?: TrustShieldSummary;
};

type FundSpaceCustomer = {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  status: string;
  verification_status: string;
  is_blacklisted: boolean;
  can_add_to_fund_space: boolean;
  eligibility_reason: string;
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
};

type FundSpaceCustomersResponse = {
  success: boolean;
  message?: string;
  customers?: FundSpaceCustomer[];
};

type JoinFundSpaceResponse = {
  success: boolean;
  message?: string;
};

function formatValue(value?: string | number | boolean | null) {
  if (value === null || value === undefined || value === '') {
    return 'Not provided';
  }

  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }

  return String(value);
}

function formatCurrency(amount: number | null | undefined) {
  return `GH₵${Number(amount || 0).toLocaleString('en-GH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value?: string | null) {
  if (!value) return 'Not provided';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString('en-GH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatDateTime(value?: string | null) {
  if (!value) return 'Not provided';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString('en-GH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function prettyLabel(value?: string | null) {
  if (!value) return 'Not provided';

  return value
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function normalizeStatus(value?: string | null) {
  return String(value || '').toUpperCase();
}

function statusBadgeClass(status?: string | null) {
  const value = normalizeStatus(status);

  if (['VERIFIED', 'ACTIVE', 'APPROVED', 'COMPLETED', 'PAID'].includes(value)) {
    return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  }

  if (
    ['PENDING', 'UNVERIFIED', 'FORMING', 'PENDING_REVIEW', 'COLLECTING'].includes(
      value
    )
  ) {
    return 'bg-amber-50 text-amber-700 border-amber-200';
  }

  if (
    [
      'REJECTED',
      'SUSPENDED',
      'BLACKLISTED',
      'INACTIVE',
      'REMOVED',
      'DEFAULTED',
      'CANCELLED',
    ].includes(value)
  ) {
    return 'bg-red-50 text-red-700 border-red-200';
  }

  if (value === 'TRANSFERRED') {
    return 'bg-purple-50 text-purple-700 border-purple-200';
  }

  return 'bg-slate-50 text-slate-700 border-slate-200';
}

function statusIcon(status?: string | null) {
  const value = normalizeStatus(status);

  if (['VERIFIED', 'ACTIVE', 'APPROVED', 'COMPLETED', 'PAID'].includes(value)) {
    return <CheckCircle2 size={15} />;
  }

  if (
    [
      'REJECTED',
      'SUSPENDED',
      'BLACKLISTED',
      'INACTIVE',
      'REMOVED',
      'DEFAULTED',
      'CANCELLED',
    ].includes(value)
  ) {
    return <XCircle size={15} />;
  }

  return <Clock size={15} />;
}

function trustScorePanelClass(score: number) {
  if (score >= 85) return 'border-emerald-200 bg-emerald-50 text-emerald-900';
  if (score >= 70) return 'border-teal-200 bg-teal-50 text-teal-900';
  if (score >= 55) return 'border-amber-200 bg-amber-50 text-amber-900';
  if (score >= 25) return 'border-orange-200 bg-orange-50 text-orange-900';

  return 'border-red-200 bg-red-50 text-red-900';
}

function customerLocation(customer: Customer) {
  return (
    customer.location ||
    customer.city ||
    customer.region ||
    customer.country ||
    'Not provided'
  );
}

function customerWork(customer: Customer) {
  return (
    customer.business_name ||
    customer.business_type ||
    customer.occupation ||
    customer.employer_name ||
    'Not provided'
  );
}

function isJoinedToFundSpace(status: FundSpaceCustomer | null) {
  return Boolean(status?.fund_space_member || status?.fund_space);
}

function StatusBadge({ status }: { status?: string | null }) {
  return (
    <span
      className={`inline-flex max-w-full items-center gap-1 rounded-full border px-3 py-1 text-xs font-black ${statusBadgeClass(
        status
      )}`}
    >
      {statusIcon(status)}
      <span className="truncate">{prettyLabel(status)}</span>
    </span>
  );
}

function InfoItem({
  label,
  value,
  icon,
}: {
  label: string;
  value?: string | number | boolean | null;
  icon?: ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
        {icon}
        <span className="break-words">{label}</span>
      </div>

      <p className="break-words text-sm font-semibold leading-6 text-slate-900">
        {formatValue(value)}
      </p>
    </div>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
      <h2 className="mb-5 flex items-center gap-2 text-base font-black text-slate-900">
        {icon}
        {title}
      </h2>

      {children}
    </section>
  );
}

function DocumentCard({
  title,
  description,
  imageUrl,
}: {
  title: string;
  description: string;
  imageUrl: string | null;
}) {
  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 p-4">
        <h3 className="text-sm font-black text-slate-900">{title}</h3>
        <p className="mt-1 text-xs font-medium leading-5 text-slate-500">
          {description}
        </p>
      </div>

      {imageUrl ? (
        <a
          href={imageUrl}
          target="_blank"
          rel="noreferrer"
          className="block bg-slate-100"
        >
          <img
            src={imageUrl}
            alt={title}
            className="h-72 w-full object-contain md:h-80"
          />
        </a>
      ) : (
        <div className="flex h-72 flex-col items-center justify-center bg-slate-50 p-6 text-center md:h-80">
          <FileText size={34} className="mb-3 text-slate-400" />
          <p className="text-sm font-bold text-slate-600">
            No image available
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            This document was not uploaded or the secure image link could not be
            created.
          </p>
        </div>
      )}

      {imageUrl && (
        <div className="border-t border-slate-100 p-4">
          <a
            href={imageUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 text-sm font-bold text-white transition hover:bg-slate-800"
          >
            <Eye size={16} />
            Open Full Image
          </a>
        </div>
      )}
    </div>
  );
}

export default function AgentCustomerDetailsPage() {
  const router = useRouter();
  const params = useParams();

  const customerId = useMemo(() => {
    const id = params?.id;

    if (Array.isArray(id)) return id[0];

    return id;
  }, [params]);

  const [loading, setLoading] = useState(true);
  const [refreshingFundSpace, setRefreshingFundSpace] = useState(false);
  const [resubmitLoading, setResubmitLoading] = useState(false);
  const [trustShieldLoading, setTrustShieldLoading] = useState(false);
  const [addingToFundSpace, setAddingToFundSpace] = useState(false);

  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [data, setData] = useState<CustomerResponse | null>(null);
  const [trustShieldSummary, setTrustShieldSummary] =
    useState<TrustShieldSummary | null>(null);
  const [fundSpaceStatus, setFundSpaceStatus] =
    useState<FundSpaceCustomer | null>(null);
  const [selectedContributionAmount, setSelectedContributionAmount] =
    useState<number>(contributionAmounts[0]);

  const [resubmitModalOpen, setResubmitModalOpen] = useState(false);
  const [resubmissionNote, setResubmissionNote] = useState('');
  const [idFrontFile, setIdFrontFile] = useState<File | null>(null);
  const [idBackFile, setIdBackFile] = useState<File | null>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);

  const customer = data?.customer;
  const relationship = data?.relationship;
  const documents = data?.documents;
  const verificationRequest = data?.verification_request;
  const reviewedByProfile = data?.reviewed_by_profile;

  const currentTrustScore =
    trustShieldSummary?.trust_score ?? customer?.trust_score ?? 0;

  const currentTrustLevel =
    trustShieldSummary?.trust_level_label || 'Trust Shield Score';

  const currentDefaultRisk =
    trustShieldSummary?.default_risk_level || 'Not available';

  const isRejected =
    normalizeStatus(customer?.verification_status) === 'REJECTED' ||
    normalizeStatus(verificationRequest?.status) === 'REJECTED';

  const isVerified =
    normalizeStatus(customer?.verification_status) === 'VERIFIED' ||
    normalizeStatus(verificationRequest?.status) === 'APPROVED';

  const isPending =
    normalizeStatus(customer?.verification_status) === 'PENDING' ||
    normalizeStatus(verificationRequest?.status) === 'PENDING';

  const joinedToFundSpace = isJoinedToFundSpace(fundSpaceStatus);

  const canAddToFundSpace =
    Boolean(fundSpaceStatus?.can_add_to_fund_space) && !joinedToFundSpace;

  async function getAccessToken() {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error) {
      throw new Error(error.message || 'Could not check your login session.');
    }

    if (!session?.access_token) {
      throw new Error(
        'Your session has expired or you are not logged in. Please login again.'
      );
    }

    return session.access_token;
  }

  async function loadTrustShield(accessToken: string, targetUserId: string) {
    try {
      setTrustShieldLoading(true);

      const response = await fetch(
        `/api/trust-shield/profile?user_id=${encodeURIComponent(targetUserId)}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      const result = (await response.json()) as TrustShieldApiResponse;

      if (!response.ok || !result.success || !result.trust_shield) {
        setTrustShieldSummary(null);
        return;
      }

      setTrustShieldSummary(result.trust_shield);
    } catch (error) {
      console.warn(
        'Customer Trust Shield summary warning:',
        error instanceof Error ? error.message : error
      );
      setTrustShieldSummary(null);
    } finally {
      setTrustShieldLoading(false);
    }
  }

  async function loadFundSpaceStatus(
    accessToken: string,
    targetCustomerId: string,
    showRefresh = false
  ) {
    try {
      if (showRefresh) setRefreshingFundSpace(true);

      const response = await fetch('/api/agent/fund-space/customers', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const result = (await response.json().catch(() => null)) as
        | FundSpaceCustomersResponse
        | null;

      if (!response.ok || !result?.success) {
        setFundSpaceStatus(null);
        return;
      }

      const matchedCustomer =
        result.customers?.find((item) => item.id === targetCustomerId) || null;

      setFundSpaceStatus(matchedCustomer);

      if (matchedCustomer?.fund_space?.contribution_amount) {
        setSelectedContributionAmount(matchedCustomer.fund_space.contribution_amount);
      }
    } catch (error) {
      console.warn(
        'Customer Fund Space status warning:',
        error instanceof Error ? error.message : error
      );
      setFundSpaceStatus(null);
    } finally {
      setRefreshingFundSpace(false);
    }
  }

  const loadCustomer = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMessage('');
      setSuccessMessage('');

      if (!customerId) {
        throw new Error('Customer ID is missing from the page URL.');
      }

      const accessToken = await getAccessToken();

      const response = await fetch(`/api/agent/customers/${customerId}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const responseText = await response.text();

      let result: CustomerResponse | { success?: boolean; message?: string };

      try {
        result = responseText ? JSON.parse(responseText) : {};
      } catch {
        throw new Error(
          'The server returned an invalid response while loading customer details.'
        );
      }

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || 'Could not load customer details. Please try again.'
        );
      }

      const loadedData = result as CustomerResponse;

      setData(loadedData);

      await Promise.all([
        loadTrustShield(accessToken, loadedData.customer.id),
        loadFundSpaceStatus(accessToken, loadedData.customer.id),
      ]);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Something went wrong while loading customer details.'
      );
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  async function refreshFundSpaceStatus() {
    try {
      setErrorMessage('');
      setSuccessMessage('');

      if (!customer?.id) return;

      const accessToken = await getAccessToken();
      await loadFundSpaceStatus(accessToken, customer.id, true);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Could not refresh Fund Space status.'
      );
    }
  }

  async function handleAddToFundSpace() {
    try {
      setAddingToFundSpace(true);
      setErrorMessage('');
      setSuccessMessage('');

      if (!customer?.id) {
        throw new Error('Customer profile is not loaded.');
      }

      if (!selectedContributionAmount) {
        throw new Error('Please select a weekly contribution amount.');
      }

      const accessToken = await getAccessToken();

      const response = await fetch('/api/fund-space/join', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customer_id: customer.id,
          contribution_amount: selectedContributionAmount,
        }),
      });

      const result = (await response.json().catch(() => null)) as
        | JoinFundSpaceResponse
        | null;

      if (!response.ok || !result?.success) {
        throw new Error(result?.message || 'Could not add customer to Fund Space.');
      }

      setSuccessMessage(
        result.message ||
          `${customer.full_name} has been added to Fund Space successfully.`
      );

      await loadFundSpaceStatus(accessToken, customer.id, true);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Something went wrong while adding customer to Fund Space.'
      );
    } finally {
      setAddingToFundSpace(false);
    }
  }

  async function handleResubmitVerification(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setResubmitLoading(true);
      setErrorMessage('');
      setSuccessMessage('');

      if (!customerId) {
        throw new Error('Customer ID is missing from the page URL.');
      }

      if (
        !idFrontFile &&
        !idBackFile &&
        !selfieFile &&
        !resubmissionNote.trim()
      ) {
        throw new Error(
          'Please upload at least one corrected document or add a resubmission note.'
        );
      }

      const accessToken = await getAccessToken();

      const formData = new FormData();

      if (idFrontFile) formData.append('id_document_front', idFrontFile);
      if (idBackFile) formData.append('id_document_back', idBackFile);
      if (selfieFile) formData.append('selfie', selfieFile);

      formData.append('resubmission_note', resubmissionNote.trim());

      const response = await fetch(`/api/agent/customers/${customerId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: formData,
      });

      const responseText = await response.text();
      const result = responseText ? JSON.parse(responseText) : null;

      if (!response.ok || !result?.success) {
        throw new Error(
          result?.message || 'Could not resubmit verification request.'
        );
      }

      setSuccessMessage(
        result.message ||
          'Customer verification has been resubmitted successfully.'
      );

      setResubmitModalOpen(false);
      setResubmissionNote('');
      setIdFrontFile(null);
      setIdBackFile(null);
      setSelfieFile(null);

      await loadCustomer();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Something went wrong while resubmitting verification.'
      );
    } finally {
      setResubmitLoading(false);
    }
  }

  useEffect(() => {
    loadCustomer();
  }, [loadCustomer]);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-5 md:px-8 md:py-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <button
            type="button"
            onClick={() => router.push('/agent/customers')}
            className="inline-flex min-h-11 w-fit items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100"
          >
            <ArrowLeft size={18} />
            Back to Customers
          </button>

          <button
            type="button"
            onClick={loadCustomer}
            disabled={loading}
            className="inline-flex min-h-11 w-fit items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {successMessage && (
          <AlertPanel type="success">
            <CheckCircle2 className="mt-0.5 shrink-0" size={22} />
            <p>{successMessage}</p>
          </AlertPanel>
        )}

        {loading && (
          <div className="flex min-h-[55vh] flex-col items-center justify-center rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <Loader2 size={36} className="mb-4 animate-spin text-emerald-700" />
            <h2 className="text-lg font-black text-slate-900">
              Loading customer details...
            </h2>
            <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
              Please wait while we securely check your agent access and load the
              customer profile.
            </p>
          </div>
        )}

        {!loading && errorMessage && (
          <AlertPanel type="error">
            <AlertCircle className="mt-0.5 shrink-0" size={22} />

            <div>
              <h2 className="font-black">Could not complete action</h2>
              <p className="mt-1 text-sm font-semibold leading-6">
                {errorMessage}
              </p>

              {errorMessage.toLowerCase().includes('session') ? (
                <Link
                  href="/auth/login"
                  className="mt-4 inline-flex min-h-11 items-center justify-center rounded-2xl bg-red-700 px-4 text-sm font-bold text-white transition hover:bg-red-800"
                >
                  Go to Login
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => router.push('/agent/customers')}
                  className="mt-4 inline-flex min-h-11 items-center justify-center rounded-2xl bg-red-700 px-4 text-sm font-bold text-white transition hover:bg-red-800"
                >
                  Go Back to Customers
                </button>
              )}
            </div>
          </AlertPanel>
        )}

        {!loading && customer && relationship && (
          <div className="space-y-5">
            <section className="grid gap-5 xl:grid-cols-[1fr_420px]">
              <div className="rounded-3xl bg-gradient-to-br from-emerald-800 via-emerald-700 to-teal-700 p-5 text-white shadow-lg md:p-8">
                <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-bold">
                  <UserRound size={14} />
                  Agent Customer Profile
                </div>

                <h1 className="break-words text-2xl font-black tracking-tight md:text-4xl">
                  {customer.full_name || 'Unnamed customer'}
                </h1>

                <p className="mt-3 max-w-3xl text-sm leading-7 text-emerald-50">
                  This page helps the agent understand the customer, verify
                  documents, check Trust Shield, and continue to Fund Space
                  payment collection when the customer is ready.
                </p>

                <div className="mt-5 flex flex-wrap gap-2">
                  <StatusBadge status={customer.verification_status} />
                  <StatusBadge status={customer.status} />
                  <StatusBadge status={relationship.relationship_status} />
                  {customer.is_blacklisted && <StatusBadge status="BLACKLISTED" />}
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  <HeroMiniCard
                    label="Phone"
                    value={customer.phone || 'No phone'}
                    helper="Primary contact"
                  />
                  <HeroMiniCard
                    label="Location"
                    value={customerLocation(customer)}
                    helper="Customer area"
                  />
                  <HeroMiniCard
                    label="Work / Business"
                    value={customerWork(customer)}
                    helper={prettyLabel(customer.user_category)}
                  />
                </div>
              </div>

              <div
                className={`rounded-3xl border p-5 shadow-sm ${trustScorePanelClass(
                  Number(currentTrustScore || 0)
                )}`}
              >
                <p className="text-xs font-black uppercase tracking-wide opacity-80">
                  Current Trust Score
                </p>

                <div className="mt-2 flex items-end gap-1">
                  <p className="text-5xl font-black leading-none">
                    {trustShieldLoading ? '...' : currentTrustScore}
                  </p>
                  <span className="pb-1 text-sm font-black">%</span>
                </div>

                <p className="mt-3 text-sm font-black">
                  {trustShieldLoading ? 'Loading Trust Shield...' : currentTrustLevel}
                </p>

                <p className="mt-1 text-xs font-semibold opacity-80">
                  Risk: {prettyLabel(currentDefaultRisk)}
                </p>

                <div className="my-5 h-px bg-black/10" />

                <p className="text-xs font-black uppercase tracking-wide opacity-80">
                  Registered On
                </p>
                <p className="mt-1 text-sm font-bold">
                  {formatDateTime(customer.created_at)}
                </p>
              </div>
            </section>

            <FundSpaceActionCard
              customer={customer}
              fundSpaceStatus={fundSpaceStatus}
              selectedContributionAmount={selectedContributionAmount}
              onContributionAmountChange={setSelectedContributionAmount}
              canAddToFundSpace={canAddToFundSpace}
              joinedToFundSpace={joinedToFundSpace}
              addingToFundSpace={addingToFundSpace}
              refreshingFundSpace={refreshingFundSpace}
              onAddToFundSpace={handleAddToFundSpace}
              onRefreshFundSpace={refreshFundSpaceStatus}
            />

            <TrustShieldCard
              userId={customer.id}
              title="Customer Trust Shield"
              subtitle="This customer’s TrustPoint reliability profile based on verification, agreement, contribution history, payout behavior, and default risk."
            />

            {isRejected && (
              <section className="rounded-3xl border border-red-200 bg-red-50 p-5 shadow-sm md:p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex items-start gap-3">
                    <div className="rounded-2xl bg-red-100 p-3 text-red-700">
                      <ShieldAlert size={24} />
                    </div>

                    <div className="flex-1">
                      <h2 className="text-lg font-black text-red-800">
                        Verification Rejected
                      </h2>

                      <p className="mt-2 text-sm font-semibold leading-6 text-red-700">
                        This customer’s verification was rejected by admin.
                        Review the reason below, upload corrected documents if
                        needed, and resubmit for admin review.
                      </p>

                      <div className="mt-4 rounded-2xl border border-red-200 bg-white p-4">
                        <p className="text-xs font-bold uppercase tracking-wide text-red-500">
                          Rejection Reason
                        </p>
                        <p className="mt-2 whitespace-pre-wrap text-sm font-bold leading-6 text-red-800">
                          {verificationRequest?.rejection_reason ||
                            'No rejection reason was provided.'}
                        </p>
                      </div>

                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        <InfoItem
                          label="Reviewed At"
                          value={formatDateTime(verificationRequest?.reviewed_at)}
                          icon={<CalendarDays size={14} />}
                        />
                        <InfoItem
                          label="Reviewed By"
                          value={reviewedByProfile?.full_name}
                          icon={<User size={14} />}
                        />
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setResubmitModalOpen(true)}
                    className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-2xl bg-red-700 px-5 text-sm font-black text-white transition hover:bg-red-800"
                  >
                    <Upload size={17} />
                    Resubmit Verification
                  </button>
                </div>
              </section>
            )}

            {isVerified && (
              <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm md:p-6">
                <div className="flex items-start gap-3">
                  <div className="rounded-2xl bg-emerald-100 p-3 text-emerald-700">
                    <ShieldCheck size={24} />
                  </div>

                  <div>
                    <h2 className="text-lg font-black text-emerald-800">
                      Verification Approved
                    </h2>
                    <p className="mt-2 text-sm font-semibold leading-6 text-emerald-700">
                      This customer has been verified and can now access verified
                      customer features, including Fund Space if eligible.
                    </p>
                  </div>
                </div>
              </section>
            )}

            {isPending && (
              <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5 shadow-sm md:p-6">
                <div className="flex items-start gap-3">
                  <div className="rounded-2xl bg-amber-100 p-3 text-amber-700">
                    <Clock size={24} />
                  </div>

                  <div>
                    <h2 className="text-lg font-black text-amber-800">
                      Verification Pending
                    </h2>
                    <p className="mt-2 text-sm font-semibold leading-6 text-amber-700">
                      This customer is waiting for admin review.
                    </p>
                  </div>
                </div>
              </section>
            )}

            <Section
              title="Personal Information"
              icon={<User size={20} className="text-emerald-600" />}
            >
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <InfoItem
                  label="Full Name"
                  value={customer.full_name}
                  icon={<User size={14} />}
                />
                <InfoItem
                  label="Phone"
                  value={customer.phone}
                  icon={<Phone size={14} />}
                />
                <InfoItem
                  label="Email"
                  value={customer.email}
                  icon={<Mail size={14} />}
                />
                <InfoItem
                  label="Gender"
                  value={prettyLabel(customer.gender)}
                  icon={<UserRound size={14} />}
                />
                <InfoItem
                  label="Date of Birth"
                  value={formatDate(customer.date_of_birth)}
                  icon={<CalendarDays size={14} />}
                />
                <InfoItem
                  label="Customer Category"
                  value={prettyLabel(customer.user_category)}
                  icon={<BadgeCheck size={14} />}
                />
              </div>
            </Section>

            <Section
              title="Verification Information"
              icon={<ShieldCheck size={20} className="text-emerald-600" />}
            >
              <div className="mb-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <InfoItem
                  label="Profile Verification Status"
                  value={prettyLabel(customer.verification_status)}
                  icon={<ShieldCheck size={14} />}
                />
                <InfoItem
                  label="Verification Request Status"
                  value={prettyLabel(verificationRequest?.status)}
                  icon={<ShieldCheck size={14} />}
                />
                <InfoItem
                  label="Selected ID Type"
                  value={prettyLabel(customer.id_type)}
                  icon={<IdCard size={14} />}
                />
                <InfoItem
                  label="Selected ID Number"
                  value={customer.id_number}
                  icon={<IdCard size={14} />}
                />
                <InfoItem
                  label="Ghana Card"
                  value={customer.ghana_card}
                  icon={<IdCard size={14} />}
                />
                <InfoItem
                  label="Reviewed At"
                  value={formatDateTime(verificationRequest?.reviewed_at)}
                  icon={<CalendarDays size={14} />}
                />
                <InfoItem
                  label="Reviewed By"
                  value={reviewedByProfile?.full_name}
                  icon={<User size={14} />}
                />
                <InfoItem
                  label="Blacklisted"
                  value={customer.is_blacklisted}
                  icon={<AlertCircle size={14} />}
                />
                <InfoItem
                  label="Blacklist Reason"
                  value={customer.blacklist_reason}
                  icon={<AlertCircle size={14} />}
                />
              </div>

              <div className="grid gap-5 lg:grid-cols-3">
                <DocumentCard
                  title="Front Picture of Selected ID"
                  description="Used by admin to verify the customer's identity."
                  imageUrl={documents?.id_front_url || null}
                />

                <DocumentCard
                  title="Back Picture of Selected ID"
                  description="Used by admin to cross-check the ID details."
                  imageUrl={documents?.id_back_url || null}
                />

                <DocumentCard
                  title="Selfie / Passport Photo"
                  description="Used by admin to compare the customer with the ID."
                  imageUrl={documents?.selfie_url || null}
                />
              </div>
            </Section>

            <Section
              title="Location Details"
              icon={<MapPin size={20} className="text-emerald-600" />}
            >
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <InfoItem label="Country" value={customer.country} />
                <InfoItem label="Region" value={customer.region} />
                <InfoItem label="City / Town" value={customer.city} />
                <InfoItem label="Exact Location" value={customer.location} />
              </div>
            </Section>

            <Section
              title="Work / Business Details"
              icon={<BriefcaseBusiness size={20} className="text-emerald-600" />}
            >
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <InfoItem label="Occupation" value={customer.occupation} />
                <InfoItem label="Employer Name" value={customer.employer_name} />
                <InfoItem label="Staff ID" value={customer.staff_id} />
                <InfoItem label="Business Name" value={customer.business_name} />
                <InfoItem label="Business Type" value={customer.business_type} />
                <InfoItem
                  label="Business Location"
                  value={customer.business_location}
                />
              </div>
            </Section>

            <Section
              title="Payment Details"
              icon={<Banknote size={20} className="text-emerald-600" />}
            >
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <InfoItem label="MoMo Number" value={customer.momo_number} />
                <InfoItem label="Bank Name" value={customer.bank_name} />
                <InfoItem
                  label="Bank Account Name"
                  value={customer.bank_account_name}
                />
                <InfoItem
                  label="Bank Account Number"
                  value={customer.bank_account_number}
                />
              </div>
            </Section>

            <Section
              title="Emergency Contact"
              icon={<Phone size={20} className="text-emerald-600" />}
            >
              <div className="grid gap-4 md:grid-cols-2">
                <InfoItem
                  label="Emergency Contact Name"
                  value={customer.emergency_contact_name}
                />

                <InfoItem
                  label="Emergency Contact Phone"
                  value={customer.emergency_contact_phone}
                />
              </div>
            </Section>

            <Section
              title="Agent Notes"
              icon={<FileText size={20} className="text-emerald-600" />}
            >
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="whitespace-pre-wrap text-sm font-medium leading-6 text-slate-700">
                  {relationship.notes ||
                    'No agent note was added for this customer.'}
                </p>
              </div>
            </Section>
          </div>
        )}
      </div>

      {resubmitModalOpen && customer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white shadow-xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white p-5">
              <div>
                <h2 className="text-xl font-black text-slate-900">
                  Resubmit Verification
                </h2>
                <p className="mt-1 text-sm font-medium text-slate-500">
                  Upload corrected documents for {customer.full_name}.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setResubmitModalOpen(false)}
                className="rounded-2xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleResubmitVerification} className="space-y-5 p-5">
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm font-bold leading-6 text-amber-800">
                  You do not have to upload all documents again. Upload only the
                  corrected document or add a note explaining what has been
                  corrected.
                </p>
              </div>

              <FileInput
                label="Corrected Front ID Image"
                file={idFrontFile}
                onChange={setIdFrontFile}
              />

              <FileInput
                label="Corrected Back ID Image"
                file={idBackFile}
                onChange={setIdBackFile}
              />

              <FileInput
                label="Corrected Selfie / Passport Photo"
                file={selfieFile}
                onChange={setSelfieFile}
              />

              <div>
                <label className="text-sm font-bold text-slate-700">
                  Resubmission Note
                </label>
                <textarea
                  value={resubmissionNote}
                  onChange={(event) => setResubmissionNote(event.target.value)}
                  rows={5}
                  placeholder="Example: I have uploaded a clearer front Ghana Card image."
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
              </div>

              <div className="flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setResubmitModalOpen(false)}
                  className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-slate-200 px-5 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={resubmitLoading}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-5 text-sm font-bold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {resubmitLoading ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <Upload size={18} />
                  )}
                  Submit for Review
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}

function AlertPanel({
  type,
  children,
}: {
  type: 'success' | 'error';
  children: ReactNode;
}) {
  return (
    <div
      className={`mb-5 rounded-3xl border p-5 shadow-sm ${
        type === 'success'
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
          : 'border-red-200 bg-red-50 text-red-700'
      }`}
    >
      <div className="flex items-start gap-3 text-sm font-bold leading-6">
        {children}
      </div>
    </div>
  );
}

function HeroMiniCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="min-w-0 rounded-2xl bg-white/15 p-4 backdrop-blur">
      <p className="text-xs font-black uppercase tracking-wide text-emerald-50">
        {label}
      </p>
      <p className="mt-1 break-words text-lg font-black text-white">{value}</p>
      <p className="mt-1 break-words text-xs text-emerald-50">{helper}</p>
    </div>
  );
}

function FundSpaceActionCard({
  customer,
  fundSpaceStatus,
  selectedContributionAmount,
  onContributionAmountChange,
  canAddToFundSpace,
  joinedToFundSpace,
  addingToFundSpace,
  refreshingFundSpace,
  onAddToFundSpace,
  onRefreshFundSpace,
}: {
  customer: Customer;
  fundSpaceStatus: FundSpaceCustomer | null;
  selectedContributionAmount: number;
  onContributionAmountChange: (amount: number) => void;
  canAddToFundSpace: boolean;
  joinedToFundSpace: boolean;
  addingToFundSpace: boolean;
  refreshingFundSpace: boolean;
  onAddToFundSpace: () => void;
  onRefreshFundSpace: () => void;
}) {
  return (
    <section className="rounded-3xl border border-emerald-100 bg-white p-5 shadow-sm md:p-6">
      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <div className="min-w-0">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-700">
              <Wallet size={24} />
            </div>

            <div className="min-w-0">
              <h2 className="text-xl font-black text-slate-900">
                Customer Fund Space Status
              </h2>
              <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">
                This section connects the customer profile to the Fund Space
                payment workflow. Add the customer if eligible, or open the
                payment page if already joined.
              </p>
            </div>
          </div>

          {joinedToFundSpace && fundSpaceStatus?.fund_space ? (
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <InfoItem
                label="Fund Space"
                value={fundSpaceStatus.fund_space.name}
                icon={<Wallet size={14} />}
              />
              <InfoItem
                label="Weekly Amount"
                value={formatCurrency(fundSpaceStatus.fund_space.contribution_amount)}
                icon={<CircleDollarSign size={14} />}
              />
              <InfoItem
                label="Group Status"
                value={prettyLabel(fundSpaceStatus.fund_space.status)}
                icon={<ShieldCheck size={14} />}
              />
              <InfoItem
                label="Current Round"
                value={`Round ${fundSpaceStatus.fund_space.current_round_number || 0}`}
                icon={<Clock size={14} />}
              />
            </div>
          ) : (
            <div className="mt-5 rounded-3xl border border-amber-100 bg-amber-50 p-5 text-amber-800">
              <p className="text-sm font-black">
                Customer is not yet in a Fund Space group.
              </p>
              <p className="mt-2 text-sm font-semibold leading-6">
                {fundSpaceStatus?.eligibility_reason ||
                  'Use the action panel to add the customer if eligible.'}
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={onRefreshFundSpace}
            disabled={refreshingFundSpace}
            className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {refreshingFundSpace ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <RefreshCw size={16} />
            )}
            Refresh Fund Space Status
          </button>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
          {joinedToFundSpace ? (
            <div>
              <div className="mb-5 flex items-start gap-3">
                <div className="rounded-2xl bg-emerald-100 p-3 text-emerald-700">
                  <Smartphone size={22} />
                </div>

                <div className="min-w-0">
                  <h3 className="text-base font-black text-slate-900">
                    Ready for Payment Collection
                  </h3>
                  <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
                    Open this customer’s Fund Space page to collect weekly MoMo
                    contribution and check transparency.
                  </p>
                </div>
              </div>

              <Link
                href={`/agent/fund-space/${customer.id}`}
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-5 text-sm font-black text-white transition hover:bg-emerald-800"
              >
                Open Fund Space Payment Page
                <ArrowRight size={16} />
              </Link>

              <Link
                href="/agent/fund-space"
                className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 text-sm font-black text-slate-700 transition hover:bg-slate-50"
              >
                View Customer Fund Space List
              </Link>
            </div>
          ) : (
            <div>
              <div className="mb-5 flex items-start gap-3">
                <div className="rounded-2xl bg-emerald-100 p-3 text-emerald-700">
                  <UserPlus size={22} />
                </div>

                <div className="min-w-0">
                  <h3 className="text-base font-black text-slate-900">
                    Add Customer to Fund Space
                  </h3>
                  <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
                    Choose a weekly amount and add the customer if eligible.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {contributionAmounts.map((amount) => (
                  <button
                    key={amount}
                    type="button"
                    disabled={!canAddToFundSpace || addingToFundSpace}
                    onClick={() => onContributionAmountChange(amount)}
                    className={`rounded-xl border px-3 py-3 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-50 ${
                      selectedContributionAmount === amount
                        ? 'border-emerald-700 bg-emerald-700 text-white shadow-sm'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700'
                    }`}
                  >
                    {formatCurrency(amount)}
                  </button>
                ))}
              </div>

              <button
                type="button"
                disabled={!canAddToFundSpace || addingToFundSpace}
                onClick={onAddToFundSpace}
                className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-5 text-sm font-black text-white shadow-sm transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {addingToFundSpace ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Adding...
                  </>
                ) : (
                  <>
                    Add to Fund Space
                    <ArrowRight size={16} />
                  </>
                )}
              </button>

              {!canAddToFundSpace && (
                <p className="mt-4 text-center text-xs font-semibold leading-5 text-slate-500">
                  {fundSpaceStatus?.eligibility_reason ||
                    'This customer is not eligible to join Fund Space yet.'}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function FileInput({
  label,
  file,
  onChange,
}: {
  label: string;
  file: File | null;
  onChange: (file: File | null) => void;
}) {
  return (
    <div>
      <label className="text-sm font-bold text-slate-700">{label}</label>
      <input
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp"
        onChange={(event) => onChange(event.target.files?.[0] || null)}
        className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm"
      />
      {file && (
        <p className="mt-1 text-xs font-semibold text-slate-500">
          Selected: {file.name}
        </p>
      )}
    </div>
  );
}