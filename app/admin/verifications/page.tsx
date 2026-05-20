"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  Briefcase,
  Calendar,
  CheckCircle2,
  Eye,
  FileText,
  ImageIcon,
  Landmark,
  Loader2,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  User,
  X,
  XCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";

type VerificationStatus =
  | "ALL"
  | "PENDING"
  | "RESUBMITTED"
  | "APPROVED"
  | "REJECTED";

type RelatedProfile = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  role: string;
};

type VerificationRequest = {
  id: string;
  user_id: string;
  full_name: string;
  phone: string;
  email: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  location: string | null;
  gender: string | null;
  date_of_birth: string | null;
  user_category: string;
  occupation: string | null;
  employer_name: string | null;
  staff_id: string | null;
  business_name: string | null;
  business_type: string | null;
  business_location: string | null;
  ghana_card_number: string;
  ghana_card_front_url: string | null;
  ghana_card_back_url: string | null;
  selfie_url: string | null;
  employment_proof_url: string | null;
  business_proof_url: string | null;
  ghana_card_front_signed_url: string | null;
  ghana_card_back_signed_url: string | null;
  selfie_signed_url: string | null;
  employment_proof_signed_url: string | null;
  business_proof_signed_url: string | null;
  momo_number: string | null;
  bank_name: string | null;
  bank_account_number: string | null;
  bank_account_name: string | null;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  submitted_by_agent: string | null;
  submitted_by_agent_profile: RelatedProfile | null;
  status: string;
  is_resubmitted: boolean;
  rejection_reason: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  reviewed_by_profile: RelatedProfile | null;
  created_at: string | null;
  updated_at: string | null;
};

type Stats = {
  all: number;
  pending: number;
  resubmitted: number;
  approved: number;
  rejected: number;
};

type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

const statusTabs: { label: string; value: VerificationStatus }[] = [
  { label: "Pending", value: "PENDING" },
  { label: "Resubmitted", value: "RESUBMITTED" },
  { label: "Approved", value: "APPROVED" },
  { label: "Rejected", value: "REJECTED" },
  { label: "All", value: "ALL" },
];

function formatDate(date?: string | null) {
  if (!date) return "Not provided";

  return new Intl.DateTimeFormat("en-GH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(date));
}

function formatDateTime(date?: string | null) {
  if (!date) return "Not provided";

  return new Intl.DateTimeFormat("en-GH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

function getStatusBadge(status?: string | null) {
  if (status === "APPROVED") {
    return "bg-green-100 text-green-700 border-green-200";
  }

  if (status === "REJECTED") {
    return "bg-red-100 text-red-700 border-red-200";
  }

  return "bg-yellow-100 text-yellow-700 border-yellow-200";
}

function getStatusIcon(status?: string | null) {
  if (status === "APPROVED") return <ShieldCheck className="h-4 w-4" />;
  if (status === "REJECTED") return <ShieldX className="h-4 w-4" />;
  return <AlertTriangle className="h-4 w-4" />;
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string | number | null;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-gray-100 bg-gray-50 p-3">
      <div className="mt-0.5 text-gray-500">{icon}</div>
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
          {label}
        </p>
        <p className="mt-1 text-sm font-semibold text-gray-900">
          {value || "Not provided"}
        </p>
      </div>
    </div>
  );
}

export default function AdminVerificationsPage() {
  const [requests, setRequests] = useState<VerificationRequest[]>([]);
  const [stats, setStats] = useState<Stats>({
    all: 0,
    pending: 0,
    resubmitted: 0,
    approved: 0,
    rejected: 0,
  });

  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });

  const [selectedStatus, setSelectedStatus] =
    useState<VerificationStatus>("PENDING");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const [selectedRequest, setSelectedRequest] =
    useState<VerificationRequest | null>(null);

  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const selectedDocuments = useMemo(() => {
    if (!selectedRequest) return [];

    return [
      {
        label: "Ghana Card Front",
        url: selectedRequest.ghana_card_front_signed_url,
      },
      {
        label: "Ghana Card Back",
        url: selectedRequest.ghana_card_back_signed_url,
      },
      {
        label: "Selfie / Passport Photo",
        url: selectedRequest.selfie_signed_url,
      },
      {
        label: "Employment Proof",
        url: selectedRequest.employment_proof_signed_url,
      },
      {
        label: "Business Proof",
        url: selectedRequest.business_proof_signed_url,
      },
    ];
  }, [selectedRequest]);

  async function getAuthToken() {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error || !session?.access_token) {
      throw new Error("You are not logged in. Please log in again.");
    }

    return session.access_token;
  }

  async function fetchRequests(page = 1) {
    try {
      setLoading(true);
      setError("");
      setSuccessMessage("");

      const token = await getAuthToken();

      const params = new URLSearchParams({
        status: selectedStatus,
        search,
        page: String(page),
        limit: String(pagination.limit),
      });

      const response = await fetch(`/api/admin/verifications?${params}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const responseText = await response.text();
      const result = responseText ? JSON.parse(responseText) : null;

      if (!response.ok || !result?.success) {
        throw new Error(
          result?.message || "Failed to load verification requests."
        );
      }

      setRequests(result.requests || []);
      setStats(
        result.stats || {
          all: 0,
          pending: 0,
          resubmitted: 0,
          approved: 0,
          rejected: 0,
        }
      );
      setPagination(
        result.pagination || {
          page,
          limit: 20,
          total: 0,
          totalPages: 1,
        }
      );
    } catch (err: any) {
      setError(err?.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function handleAction(
    requestId: string,
    action: "APPROVE" | "REJECT",
    reason?: string
  ) {
    try {
      setActionLoading(true);
      setError("");
      setSuccessMessage("");

      const token = await getAuthToken();

      const response = await fetch(`/api/admin/verifications/${requestId}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action,
          reason: reason || "",
        }),
      });

      const responseText = await response.text();
      const result = responseText ? JSON.parse(responseText) : null;

      if (!response.ok || !result?.success) {
        throw new Error(
          result?.message || "Failed to update verification request."
        );
      }

      setSuccessMessage(result.message || "Verification updated successfully.");
      setSelectedRequest(null);
      setRejectModalOpen(false);
      setRejectionReason("");

      await fetchRequests(pagination.page);
    } catch (err: any) {
      setError(err?.message || "Something went wrong.");
    } finally {
      setActionLoading(false);
    }
  }

  function handleSearchSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearch(searchInput.trim());
  }

  useEffect(() => {
    fetchRequests(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStatus, search]);

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col justify-between gap-4 rounded-2xl bg-white p-6 shadow-sm md:flex-row md:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">
              TrustPoint Fund Space
            </p>
            <h1 className="mt-1 text-2xl font-bold text-gray-900">
              Customer Verification
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-gray-600">
              Review pending customer verification requests, inspect their KYC
              documents, and approve or reject them.
            </p>
          </div>

          <button
            onClick={() => fetchRequests(pagination.page)}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="rounded-2xl border border-green-200 bg-green-50 p-4 text-sm font-medium text-green-700">
            {successMessage}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-5">
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Pending</p>
            <p className="mt-2 text-2xl font-bold text-yellow-600">
              {stats.pending}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Resubmitted</p>
            <p className="mt-2 text-2xl font-bold text-blue-600">
              {stats.resubmitted}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Approved</p>
            <p className="mt-2 text-2xl font-bold text-green-600">
              {stats.approved}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Rejected</p>
            <p className="mt-2 text-2xl font-bold text-red-600">
              {stats.rejected}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">All Requests</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">
              {stats.all}
            </p>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              {statusTabs.map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => setSelectedStatus(tab.value)}
                  className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                    selectedStatus === tab.value
                      ? "bg-blue-600 text-white shadow-sm"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <form
              onSubmit={handleSearchSubmit}
              className="flex w-full gap-2 lg:w-96"
            >
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Search name, phone, Ghana Card..."
                  className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-10 pr-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <button
                type="submit"
                className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-800"
              >
                Search
              </button>
            </form>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
          {loading ? (
            <div className="flex min-h-72 items-center justify-center">
              <div className="flex items-center gap-3 text-gray-600">
                <Loader2 className="h-5 w-5 animate-spin" />
                Loading verification requests...
              </div>
            </div>
          ) : requests.length === 0 ? (
            <div className="flex min-h-72 flex-col items-center justify-center p-8 text-center">
              <ShieldCheck className="h-12 w-12 text-gray-300" />
              <h3 className="mt-4 text-lg font-bold text-gray-900">
                No verification requests found
              </h3>
              <p className="mt-2 max-w-md text-sm text-gray-500">
                There are no requests matching the selected status or search
                term.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {requests.map((request) => (
                <div
                  key={request.id}
                  className="flex flex-col gap-4 p-5 transition hover:bg-gray-50 lg:flex-row lg:items-center lg:justify-between"
                >
                  <div className="flex gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                      <User className="h-6 w-6" />
                    </div>

                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-bold text-gray-900">
                          {request.full_name || "Unnamed Customer"}
                        </h3>

                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-bold ${getStatusBadge(
                            request.status
                          )}`}
                        >
                          {getStatusIcon(request.status)}
                          {request.status || "PENDING"}
                        </span>

                        {request.is_resubmitted && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">
                            <RefreshCw className="h-3.5 w-3.5" />
                            RESUBMITTED
                          </span>
                        )}
                      </div>

                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-sm text-gray-600">
                        <span className="inline-flex items-center gap-1">
                          <Phone className="h-4 w-4" />
                          {request.phone || "No phone"}
                        </span>

                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-4 w-4" />
                          {[request.city, request.region, request.country]
                            .filter(Boolean)
                            .join(", ") || "No location"}
                        </span>

                        <span className="inline-flex items-center gap-1">
                          <FileText className="h-4 w-4" />
                          {request.ghana_card_number || "No Ghana Card"}
                        </span>
                      </div>

                      <div className="mt-2 text-sm text-gray-500">
                        Submitted by:{" "}
                        <span className="font-semibold text-gray-700">
                          {request.submitted_by_agent_profile?.full_name ||
                            "Not provided"}
                        </span>{" "}
                        · {formatDate(request.created_at)}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setSelectedRequest(request)}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50"
                    >
                      <Eye className="h-4 w-4" />
                      Review
                    </button>

                    {request.status !== "APPROVED" && (
                      <button
                        onClick={() => handleAction(request.id, "APPROVE")}
                        disabled={actionLoading}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Approve
                      </button>
                    )}

                    {request.status !== "REJECTED" && (
                      <button
                        onClick={() => {
                          setSelectedRequest(request);
                          setRejectionReason("");
                          setRejectModalOpen(true);
                        }}
                        disabled={actionLoading}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <XCircle className="h-4 w-4" />
                        Reject
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-sm sm:flex-row">
          <p className="text-sm text-gray-600">
            Showing page {pagination.page} of {pagination.totalPages || 1} ·{" "}
            {pagination.total} total records
          </p>

          <div className="flex gap-2">
            <button
              disabled={pagination.page <= 1 || loading}
              onClick={() => fetchRequests(pagination.page - 1)}
              className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>

            <button
              disabled={pagination.page >= pagination.totalPages || loading}
              onClick={() => fetchRequests(pagination.page + 1)}
              className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {selectedRequest && !rejectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-6xl overflow-y-auto rounded-2xl bg-white shadow-xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white p-5">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  Review Verification Request
                </h2>
                <p className="text-sm text-gray-500">
                  {selectedRequest.full_name}
                </p>
              </div>

              <button
                onClick={() => setSelectedRequest(null)}
                className="rounded-xl p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-6 p-5">
              <div className="flex flex-wrap items-center gap-3">
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm font-bold ${getStatusBadge(
                    selectedRequest.status
                  )}`}
                >
                  {getStatusIcon(selectedRequest.status)}
                  {selectedRequest.status || "PENDING"}
                </span>

                {selectedRequest.is_resubmitted && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-bold text-blue-700">
                    <RefreshCw className="h-4 w-4" />
                    RESUBMITTED BY AGENT
                  </span>
                )}

                <span className="rounded-full bg-gray-100 px-3 py-1.5 text-sm font-semibold text-gray-700">
                  Category: {selectedRequest.user_category || "Not provided"}
                </span>
              </div>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <InfoRow
                  icon={<User className="h-4 w-4" />}
                  label="Full Name"
                  value={selectedRequest.full_name}
                />
                <InfoRow
                  icon={<Phone className="h-4 w-4" />}
                  label="Phone"
                  value={selectedRequest.phone}
                />
                <InfoRow
                  icon={<Mail className="h-4 w-4" />}
                  label="Email"
                  value={selectedRequest.email}
                />
                <InfoRow
                  icon={<MapPin className="h-4 w-4" />}
                  label="Location"
                  value={
                    [
                      selectedRequest.location,
                      selectedRequest.city,
                      selectedRequest.region,
                      selectedRequest.country,
                    ]
                      .filter(Boolean)
                      .join(", ") || null
                  }
                />
                <InfoRow
                  icon={<Calendar className="h-4 w-4" />}
                  label="Date of Birth"
                  value={formatDate(selectedRequest.date_of_birth)}
                />
                <InfoRow
                  icon={<BadgeCheck className="h-4 w-4" />}
                  label="User Category"
                  value={selectedRequest.user_category}
                />
                <InfoRow
                  icon={<Briefcase className="h-4 w-4" />}
                  label="Occupation"
                  value={selectedRequest.occupation}
                />
                <InfoRow
                  icon={<Briefcase className="h-4 w-4" />}
                  label="Employer"
                  value={selectedRequest.employer_name}
                />
                <InfoRow
                  icon={<FileText className="h-4 w-4" />}
                  label="Staff ID"
                  value={selectedRequest.staff_id}
                />
                <InfoRow
                  icon={<Briefcase className="h-4 w-4" />}
                  label="Business Name"
                  value={selectedRequest.business_name}
                />
                <InfoRow
                  icon={<Briefcase className="h-4 w-4" />}
                  label="Business Type"
                  value={selectedRequest.business_type}
                />
                <InfoRow
                  icon={<MapPin className="h-4 w-4" />}
                  label="Business Location"
                  value={selectedRequest.business_location}
                />
                <InfoRow
                  icon={<FileText className="h-4 w-4" />}
                  label="Ghana Card Number"
                  value={selectedRequest.ghana_card_number}
                />
                <InfoRow
                  icon={<Phone className="h-4 w-4" />}
                  label="MoMo Number"
                  value={selectedRequest.momo_number}
                />
                <InfoRow
                  icon={<Landmark className="h-4 w-4" />}
                  label="Bank Name"
                  value={selectedRequest.bank_name}
                />
                <InfoRow
                  icon={<Landmark className="h-4 w-4" />}
                  label="Bank Account Number"
                  value={selectedRequest.bank_account_number}
                />
                <InfoRow
                  icon={<User className="h-4 w-4" />}
                  label="Emergency Contact"
                  value={`${
                    selectedRequest.emergency_contact_name || "Not provided"
                  } — ${
                    selectedRequest.emergency_contact_phone || "No phone"
                  }`}
                />
              </div>

              <div>
                <h3 className="mb-3 text-lg font-bold text-gray-900">
                  Verification Documents
                </h3>

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {selectedDocuments.map((doc) => (
                    <div
                      key={doc.label}
                      className="overflow-hidden rounded-2xl border border-gray-100 bg-gray-50"
                    >
                      <div className="border-b border-gray-100 bg-white p-3">
                        <p className="text-sm font-bold text-gray-900">
                          {doc.label}
                        </p>
                      </div>

                      {doc.url ? (
                        <a href={doc.url} target="_blank" rel="noreferrer">
                          <img
                            src={doc.url}
                            alt={doc.label}
                            className="h-72 w-full object-cover transition hover:scale-[1.02]"
                          />
                        </a>
                      ) : (
                        <div className="flex h-72 flex-col items-center justify-center text-gray-400">
                          <ImageIcon className="h-10 w-10" />
                          <p className="mt-2 text-sm font-medium">
                            No image uploaded
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
                <h3 className="font-bold text-blue-900">
                  Agent / Review Information
                </h3>

                <div className="mt-3 grid gap-4 md:grid-cols-3">
                  <InfoRow
                    icon={<User className="h-4 w-4" />}
                    label="Submitted By Agent"
                    value={selectedRequest.submitted_by_agent_profile?.full_name}
                  />
                  <InfoRow
                    icon={<Phone className="h-4 w-4" />}
                    label="Agent Phone"
                    value={selectedRequest.submitted_by_agent_profile?.phone}
                  />
                  <InfoRow
                    icon={<Mail className="h-4 w-4" />}
                    label="Agent Email"
                    value={selectedRequest.submitted_by_agent_profile?.email}
                  />
                  <InfoRow
                    icon={<Calendar className="h-4 w-4" />}
                    label="Submitted At"
                    value={formatDateTime(selectedRequest.created_at)}
                  />
                  <InfoRow
                    icon={<User className="h-4 w-4" />}
                    label="Reviewed By"
                    value={selectedRequest.reviewed_by_profile?.full_name}
                  />
                  <InfoRow
                    icon={<Calendar className="h-4 w-4" />}
                    label="Reviewed At"
                    value={formatDateTime(selectedRequest.reviewed_at)}
                  />
                </div>
              </div>

              {selectedRequest.rejection_reason && (
                <div
                  className={`rounded-2xl border p-4 ${
                    selectedRequest.is_resubmitted
                      ? "border-blue-100 bg-blue-50"
                      : "border-red-100 bg-red-50"
                  }`}
                >
                  <h3
                    className={`font-bold ${
                      selectedRequest.is_resubmitted
                        ? "text-blue-900"
                        : "text-red-900"
                    }`}
                  >
                    {selectedRequest.is_resubmitted
                      ? "Resubmission Note"
                      : "Rejection Reason"}
                  </h3>

                  <p
                    className={`mt-2 text-sm ${
                      selectedRequest.is_resubmitted
                        ? "text-blue-700"
                        : "text-red-700"
                    }`}
                  >
                    {selectedRequest.rejection_reason}
                  </p>
                </div>
              )}
            </div>

            <div className="sticky bottom-0 flex flex-col gap-3 border-t border-gray-100 bg-white p-5 sm:flex-row sm:justify-end">
              <button
                onClick={() => setSelectedRequest(null)}
                className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
              >
                Close
              </button>

              {selectedRequest.status !== "REJECTED" && (
                <button
                  onClick={() => {
                    setRejectionReason("");
                    setRejectModalOpen(true);
                  }}
                  disabled={actionLoading}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <XCircle className="h-4 w-4" />
                  Reject
                </button>
              )}

              {selectedRequest.status !== "APPROVED" && (
                <button
                  onClick={() => handleAction(selectedRequest.id, "APPROVE")}
                  disabled={actionLoading}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {actionLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  Approve Request
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {rejectModalOpen && selectedRequest && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  Reject Verification Request
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Please provide a clear rejection reason for this customer.
                </p>
              </div>

              <button
                onClick={() => {
                  setRejectModalOpen(false);
                  setRejectionReason("");
                }}
                className="rounded-xl p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5">
              <label className="text-sm font-semibold text-gray-700">
                Rejection Reason
              </label>

              <textarea
                value={rejectionReason}
                onChange={(event) => setRejectionReason(event.target.value)}
                rows={5}
                placeholder="Example: Ghana Card image is not clear. Please upload a clearer image."
                className="mt-2 w-full rounded-xl border border-gray-200 p-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                onClick={() => {
                  setRejectModalOpen(false);
                  setRejectionReason("");
                }}
                className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
              >
                Cancel
              </button>

              <button
                onClick={() =>
                  handleAction(selectedRequest.id, "REJECT", rejectionReason)
                }
                disabled={actionLoading || !rejectionReason.trim()}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {actionLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ShieldAlert className="h-4 w-4" />
                )}
                Reject Request
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}