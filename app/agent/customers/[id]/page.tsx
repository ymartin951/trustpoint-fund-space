"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  BadgeCheck,
  Banknote,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
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
  Upload,
  User,
  UserRound,
  X,
  XCircle,
} from "lucide-react";

import TrustShieldCard from "@/components/trust-shield/TrustShieldCard";
import { supabase } from "../../../../src/lib/supabase/client";

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

function formatValue(value?: string | number | boolean | null) {
  if (value === null || value === undefined || value === "") {
    return "Not provided";
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  return String(value);
}

function formatDate(value?: string | null) {
  if (!value) return "Not provided";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-GH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(value?: string | null) {
  if (!value) return "Not provided";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("en-GH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function prettyLabel(value?: string | null) {
  if (!value) return "Not provided";

  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusBadgeClass(status?: string | null) {
  switch (status) {
    case "VERIFIED":
    case "ACTIVE":
    case "APPROVED":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";

    case "PENDING":
    case "UNVERIFIED":
      return "bg-amber-50 text-amber-700 border-amber-200";

    case "REJECTED":
    case "SUSPENDED":
    case "BLACKLISTED":
    case "INACTIVE":
      return "bg-red-50 text-red-700 border-red-200";

    case "TRANSFERRED":
      return "bg-purple-50 text-purple-700 border-purple-200";

    default:
      return "bg-slate-50 text-slate-700 border-slate-200";
  }
}

function statusIcon(status?: string | null) {
  if (status === "VERIFIED" || status === "ACTIVE" || status === "APPROVED") {
    return <CheckCircle2 size={15} />;
  }

  if (
    status === "REJECTED" ||
    status === "SUSPENDED" ||
    status === "BLACKLISTED" ||
    status === "INACTIVE"
  ) {
    return <XCircle size={15} />;
  }

  return <Clock size={15} />;
}

function trustScorePanelClass(score: number) {
  if (score >= 85) {
    return "border-emerald-200 bg-emerald-50 text-emerald-900";
  }

  if (score >= 70) {
    return "border-teal-200 bg-teal-50 text-teal-900";
  }

  if (score >= 55) {
    return "border-amber-200 bg-amber-50 text-amber-900";
  }

  if (score >= 25) {
    return "border-orange-200 bg-orange-50 text-orange-900";
  }

  return "border-red-200 bg-red-50 text-red-900";
}

function InfoItem({
  label,
  value,
  icon,
}: {
  label: string;
  value?: string | number | boolean | null;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
        {icon}
        {label}
      </div>

      <p className="break-words text-sm font-semibold text-slate-900">
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
  icon: React.ReactNode;
  children: React.ReactNode;
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
        <p className="mt-1 text-xs font-medium text-slate-500">
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
          <p className="mt-1 text-xs text-slate-500">
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
  const [resubmitLoading, setResubmitLoading] = useState(false);
  const [trustShieldLoading, setTrustShieldLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [data, setData] = useState<CustomerResponse | null>(null);
  const [trustShieldSummary, setTrustShieldSummary] =
    useState<TrustShieldSummary | null>(null);

  const [resubmitModalOpen, setResubmitModalOpen] = useState(false);
  const [resubmissionNote, setResubmissionNote] = useState("");
  const [idFrontFile, setIdFrontFile] = useState<File | null>(null);
  const [idBackFile, setIdBackFile] = useState<File | null>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);

  async function loadTrustShield(accessToken: string, targetUserId: string) {
    try {
      setTrustShieldLoading(true);

      const response = await fetch(
        `/api/trust-shield/profile?user_id=${encodeURIComponent(targetUserId)}`,
        {
          method: "GET",
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
        "Customer Trust Shield summary warning:",
        error instanceof Error ? error.message : error
      );
      setTrustShieldSummary(null);
    } finally {
      setTrustShieldLoading(false);
    }
  }

  async function loadCustomer() {
    try {
      setLoading(true);
      setErrorMessage("");
      setSuccessMessage("");

      if (!customerId) {
        throw new Error("Customer ID is missing from the page URL.");
      }

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        throw new Error(
          sessionError.message || "Could not check your login session."
        );
      }

      if (!session?.access_token) {
        throw new Error(
          "Your session has expired or you are not logged in. Please login again."
        );
      }

      const response = await fetch(`/api/agent/customers/${customerId}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const responseText = await response.text();

      let result: CustomerResponse | { success?: boolean; message?: string };

      try {
        result = responseText ? JSON.parse(responseText) : {};
      } catch {
        throw new Error(
          "The server returned an invalid response while loading customer details."
        );
      }

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || "Could not load customer details. Please try again."
        );
      }

      const loadedData = result as CustomerResponse;

      setData(loadedData);

      await loadTrustShield(session.access_token, loadedData.customer.id);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Something went wrong while loading customer details.";

      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  }

  async function handleResubmitVerification(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    try {
      setResubmitLoading(true);
      setErrorMessage("");
      setSuccessMessage("");

      if (!customerId) {
        throw new Error("Customer ID is missing from the page URL.");
      }

      if (
        !idFrontFile &&
        !idBackFile &&
        !selfieFile &&
        !resubmissionNote.trim()
      ) {
        throw new Error(
          "Please upload at least one corrected document or add a resubmission note."
        );
      }

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        throw new Error(
          sessionError.message || "Could not check your login session."
        );
      }

      if (!session?.access_token) {
        throw new Error(
          "Your session has expired or you are not logged in. Please login again."
        );
      }

      const formData = new FormData();

      if (idFrontFile) {
        formData.append("id_document_front", idFrontFile);
      }

      if (idBackFile) {
        formData.append("id_document_back", idBackFile);
      }

      if (selfieFile) {
        formData.append("selfie", selfieFile);
      }

      formData.append("resubmission_note", resubmissionNote.trim());

      const response = await fetch(`/api/agent/customers/${customerId}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: formData,
      });

      const responseText = await response.text();
      const result = responseText ? JSON.parse(responseText) : null;

      if (!response.ok || !result?.success) {
        throw new Error(
          result?.message || "Could not resubmit verification request."
        );
      }

      setSuccessMessage(
        result.message ||
          "Customer verification has been resubmitted successfully."
      );

      setResubmitModalOpen(false);
      setResubmissionNote("");
      setIdFrontFile(null);
      setIdBackFile(null);
      setSelfieFile(null);

      await loadCustomer();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Something went wrong while resubmitting verification.";

      setErrorMessage(message);
    } finally {
      setResubmitLoading(false);
    }
  }

  useEffect(() => {
    loadCustomer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  const customer = data?.customer;
  const relationship = data?.relationship;
  const documents = data?.documents;
  const verificationRequest = data?.verification_request;
  const reviewedByProfile = data?.reviewed_by_profile;

  const currentTrustScore =
    trustShieldSummary?.trust_score ?? customer?.trust_score ?? 0;

  const currentTrustLevel =
    trustShieldSummary?.trust_level_label || "Trust Shield Score";

  const currentDefaultRisk =
    trustShieldSummary?.default_risk_level || "Not available";

  const isRejected =
    customer?.verification_status === "REJECTED" ||
    verificationRequest?.status === "REJECTED";

  const isVerified =
    customer?.verification_status === "VERIFIED" ||
    verificationRequest?.status === "APPROVED";

  const isPending =
    customer?.verification_status === "PENDING" ||
    verificationRequest?.status === "PENDING";

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-5 md:px-8 md:py-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <button
            type="button"
            onClick={() => router.push("/agent/customers")}
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
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        {successMessage && (
          <div className="mb-5 rounded-3xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-700 shadow-sm">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 shrink-0" size={22} />
              <p className="text-sm font-bold leading-6">{successMessage}</p>
            </div>
          </div>
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
          <div className="rounded-3xl border border-red-200 bg-red-50 p-5 text-red-700 shadow-sm">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 shrink-0" size={22} />

              <div>
                <h2 className="font-black">Could not complete action</h2>
                <p className="mt-1 text-sm font-semibold leading-6">
                  {errorMessage}
                </p>

                <button
                  type="button"
                  onClick={() => router.push("/agent/customers")}
                  className="mt-4 inline-flex min-h-11 items-center justify-center rounded-2xl bg-red-700 px-4 text-sm font-bold text-white transition hover:bg-red-800"
                >
                  Go Back to Customers
                </button>
              </div>
            </div>
          </div>
        )}

        {!loading && customer && relationship && (
          <div className="space-y-5">
            <section className="rounded-3xl bg-gradient-to-br from-emerald-800 via-emerald-700 to-teal-700 p-5 text-white shadow-lg md:p-8">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-bold">
                    <UserRound size={14} />
                    Customer Details
                  </div>

                  <h1 className="text-2xl font-black tracking-tight md:text-3xl">
                    {customer.full_name || "Unnamed customer"}
                  </h1>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-black ${statusBadgeClass(
                        customer.verification_status
                      )}`}
                    >
                      {statusIcon(customer.verification_status)}
                      {prettyLabel(customer.verification_status)}
                    </span>

                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-black ${statusBadgeClass(
                        customer.status
                      )}`}
                    >
                      {statusIcon(customer.status)}
                      {prettyLabel(customer.status)}
                    </span>

                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-black ${statusBadgeClass(
                        relationship.relationship_status
                      )}`}
                    >
                      {statusIcon(relationship.relationship_status)}
                      Agent Link: {prettyLabel(relationship.relationship_status)}
                    </span>
                  </div>

                  <p className="mt-4 max-w-3xl text-sm leading-6 text-emerald-50">
                    This page shows one selected customer only. Use the uploaded
                    ID documents, selfie, and Trust Shield profile to understand
                    the customer’s verification and reliability status.
                  </p>
                </div>

                <div
                  className={`grid gap-3 rounded-3xl border p-4 shadow-lg md:min-w-72 ${trustScorePanelClass(
                    Number(currentTrustScore || 0)
                  )}`}
                >
                  <div>
                    <p className="text-xs font-black uppercase tracking-wide opacity-80">
                      Current Trust Score
                    </p>

                    <div className="mt-1 flex items-end gap-1">
                      <p className="text-4xl font-black leading-none">
                        {trustShieldLoading ? "..." : currentTrustScore}
                      </p>
                      <span className="pb-1 text-sm font-black">%</span>
                    </div>

                    <p className="mt-2 text-xs font-black">
                      {trustShieldLoading ? "Loading Trust Shield..." : currentTrustLevel}
                    </p>

                    <p className="mt-1 text-xs font-semibold opacity-80">
                      Risk: {prettyLabel(currentDefaultRisk)}
                    </p>
                  </div>

                  <div className="h-px bg-black/10" />

                  <div>
                    <p className="text-xs font-black uppercase tracking-wide opacity-80">
                      Registered On
                    </p>
                    <p className="mt-1 text-sm font-bold">
                      {formatDateTime(customer.created_at)}
                    </p>
                  </div>
                </div>
              </div>
            </section>

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
                            "No rejection reason was provided."}
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
                      customer features.
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
                    "No agent note was added for this customer."}
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

              <div>
                <label className="text-sm font-bold text-slate-700">
                  Corrected Front ID Image
                </label>
                <input
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  onChange={(event) =>
                    setIdFrontFile(event.target.files?.[0] || null)
                  }
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm"
                />
                {idFrontFile && (
                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    Selected: {idFrontFile.name}
                  </p>
                )}
              </div>

              <div>
                <label className="text-sm font-bold text-slate-700">
                  Corrected Back ID Image
                </label>
                <input
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  onChange={(event) =>
                    setIdBackFile(event.target.files?.[0] || null)
                  }
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm"
                />
                {idBackFile && (
                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    Selected: {idBackFile.name}
                  </p>
                )}
              </div>

              <div>
                <label className="text-sm font-bold text-slate-700">
                  Corrected Selfie / Passport Photo
                </label>
                <input
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  onChange={(event) =>
                    setSelfieFile(event.target.files?.[0] || null)
                  }
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm"
                />
                {selfieFile && (
                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    Selected: {selfieFile.name}
                  </p>
                )}
              </div>

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