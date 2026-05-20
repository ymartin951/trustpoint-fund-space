"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  CircleDollarSign,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  Users,
  Wallet,
  XCircle,
} from "lucide-react";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase public environment variables.");
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const contributionAmounts = [50, 100, 200, 500];

type Summary = {
  total_customers: number;
  verified_customers: number;
  eligible_customers: number;
  already_in_fund_space: number;
  blocked_customers: number;
};

type AgentCustomer = {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  location: string | null;
  city: string | null;
  region: string | null;
  occupation: string | null;
  business_name: string | null;
  business_type: string | null;
  user_category: string;
  status: string;
  verification_status: string;
  is_blacklisted: boolean;
  created_at: string | null;
  agent_customer: {
    id: string;
    relationship_status: string;
    created_at: string | null;
    notes: string | null;
  } | null;
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
  can_add_to_fund_space: boolean;
  eligibility_reason: string;
};

type CustomersApiResponse = {
  success: boolean;
  message?: string;
  summary?: Summary;
  customers?: AgentCustomer[];
};

type JoinApiResponse = {
  success: boolean;
  message?: string;
  mode?: string;
  fund_space?: {
    id: string;
    name: string;
    status: string;
    contribution_amount: number;
    member_count?: number;
    max_members?: number;
  };
};

function formatCurrency(amount: number | null | undefined) {
  return `GH₵${Number(amount || 0).toLocaleString("en-GH")}`;
}

function formatDate(dateString: string | null) {
  if (!dateString) return "Not available";

  return new Intl.DateTimeFormat("en-GH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(dateString));
}

function getStatusStyle(status: string | null | undefined) {
  const value = status || "PENDING";

  if (["ACTIVE", "VERIFIED", "APPROVED", "COMPLETED"].includes(value)) {
    return "border-emerald-100 bg-emerald-50 text-emerald-700";
  }

  if (["PENDING", "FORMING", "PENDING_VERIFICATION"].includes(value)) {
    return "border-amber-100 bg-amber-50 text-amber-700";
  }

  if (
    [
      "REJECTED",
      "FAILED",
      "INACTIVE",
      "SUSPENDED",
      "BLACKLISTED",
      "REMOVED",
      "DEFAULTED",
    ].includes(value)
  ) {
    return "border-red-100 bg-red-50 text-red-700";
  }

  return "border-gray-100 bg-gray-50 text-gray-700";
}

function StatCard({
  title,
  value,
  icon,
  description,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-gray-500">{title}</p>
          <h3 className="mt-2 text-3xl font-bold text-gray-900">{value}</h3>
          <p className="mt-1 text-sm leading-6 text-gray-500">{description}</p>
        </div>

        <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-700">
          {icon}
        </div>
      </div>
    </div>
  );
}

export default function AgentFundSpacePage() {
  const [customers, setCustomers] = useState<AgentCustomer[]>([]);
  const [summary, setSummary] = useState<Summary>({
    total_customers: 0,
    verified_customers: 0,
    eligible_customers: 0,
    already_in_fund_space: 0,
    blocked_customers: 0,
  });

  const [loading, setLoading] = useState(true);
  const [actionLoadingCustomerId, setActionLoadingCustomerId] = useState<
    string | null
  >(null);
  const [selectedAmounts, setSelectedAmounts] = useState<
    Record<string, number>
  >({});
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState<
    "ALL" | "ELIGIBLE" | "JOINED" | "BLOCKED"
  >("ALL");
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const getAccessToken = async () => {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error || !session?.access_token) {
      throw new Error("Your session has expired. Please login again.");
    }

    return session.access_token;
  };

  const loadCustomers = async () => {
    try {
      setLoading(true);
      setMessage(null);

      const token = await getAccessToken();

      const response = await fetch("/api/agent/fund-space/customers", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const result = (await response.json()) as CustomersApiResponse;

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || "Could not load Fund Space customers."
        );
      }

      setCustomers(result.customers || []);
      setSummary(
        result.summary || {
          total_customers: 0,
          verified_customers: 0,
          eligible_customers: 0,
          already_in_fund_space: 0,
          blocked_customers: 0,
        }
      );
    } catch (error: any) {
      setMessage({
        type: "error",
        text:
          error?.message || "Something went wrong while loading customers.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  const filteredCustomers = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return customers.filter((customer) => {
      const matchesSearch =
        !normalizedSearch ||
        customer.full_name.toLowerCase().includes(normalizedSearch) ||
        customer.phone?.toLowerCase().includes(normalizedSearch) ||
        customer.location?.toLowerCase().includes(normalizedSearch) ||
        customer.city?.toLowerCase().includes(normalizedSearch) ||
        customer.region?.toLowerCase().includes(normalizedSearch) ||
        customer.business_name?.toLowerCase().includes(normalizedSearch);

      const matchesFilter =
        filter === "ALL" ||
        (filter === "ELIGIBLE" && customer.can_add_to_fund_space) ||
        (filter === "JOINED" && Boolean(customer.fund_space_member)) ||
        (filter === "BLOCKED" && !customer.can_add_to_fund_space);

      return matchesSearch && matchesFilter;
    });
  }, [customers, searchTerm, filter]);

  const handleAmountChange = (customerId: string, amount: number) => {
    setSelectedAmounts((current) => ({
      ...current,
      [customerId]: amount,
    }));
  };

  const handleAddToFundSpace = async (customer: AgentCustomer) => {
    try {
      setMessage(null);
      setActionLoadingCustomerId(customer.id);

      const contributionAmount = selectedAmounts[customer.id];

      if (!contributionAmount) {
        throw new Error("Please select a contribution amount first.");
      }

      const token = await getAccessToken();

      const response = await fetch("/api/fund-space/join", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          customer_id: customer.id,
          contribution_amount: contributionAmount,
        }),
      });

      const result = (await response.json()) as JoinApiResponse;

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || "Could not add customer to Fund Space."
        );
      }

      setMessage({
        type: "success",
        text:
          result.message ||
          `${customer.full_name} has been added to Fund Space successfully.`,
      });

      await loadCustomers();
    } catch (error: any) {
      setMessage({
        type: "error",
        text:
          error?.message ||
          "Something went wrong while adding customer to Fund Space.",
      });
    } finally {
      setActionLoadingCustomerId(null);
    }
  };

  return (
    <div className="space-y-8">
      <div className="rounded-3xl bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-600 p-6 text-white shadow-sm md:p-8">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
          <div className="max-w-3xl">
            <p className="mb-3 inline-flex rounded-full bg-white/15 px-4 py-1 text-sm font-medium">
              Agent Fund Space
            </p>

            <h1 className="text-3xl font-bold md:text-4xl">
              Add verified customers to Fund Space
            </h1>

            <p className="mt-4 max-w-2xl text-sm leading-7 text-emerald-50 md:text-base">
              Manage your registered customers, select a contribution plan, and
              add eligible verified customers into trusted contribution groups.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <div className="rounded-2xl bg-white/15 px-4 py-3">
                <p className="text-xs font-medium text-emerald-50">
                  Eligible Customers
                </p>
                <p className="mt-1 text-2xl font-bold">
                  {summary.eligible_customers}
                </p>
              </div>

              <div className="rounded-2xl bg-white/15 px-4 py-3">
                <p className="text-xs font-medium text-emerald-50">
                  Already Joined
                </p>
                <p className="mt-1 text-2xl font-bold">
                  {summary.already_in_fund_space}
                </p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={loadCustomers}
            disabled={loading}
            className="inline-flex min-h-12 w-fit items-center justify-center gap-2 rounded-xl bg-white/15 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <RefreshCw size={16} />
            )}
            Refresh
          </button>
        </div>
      </div>

      {message && (
        <div
          className={`flex items-start gap-3 rounded-2xl border p-4 text-sm font-semibold ${
            message.type === "success"
              ? "border-emerald-100 bg-emerald-50 text-emerald-700"
              : "border-red-100 bg-red-50 text-red-700"
          }`}
        >
          {message.type === "success" ? (
            <CheckCircle2 className="mt-0.5 h-5 w-5 flex-none" />
          ) : (
            <AlertCircle className="mt-0.5 h-5 w-5 flex-none" />
          )}
          <p>{message.text}</p>
        </div>
      )}

      <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-5">
        <StatCard
          title="Total Customers"
          value={summary.total_customers}
          description="Registered under you"
          icon={<Users className="h-5 w-5" />}
        />
        <StatCard
          title="Verified"
          value={summary.verified_customers}
          description="Ready for Fund Space"
          icon={<ShieldCheck className="h-5 w-5" />}
        />
        <StatCard
          title="Eligible"
          value={summary.eligible_customers}
          description="Can be added now"
          icon={<CheckCircle2 className="h-5 w-5" />}
        />
        <StatCard
          title="Joined"
          value={summary.already_in_fund_space}
          description="Currently in Fund Space"
          icon={<Wallet className="h-5 w-5" />}
        />
        <StatCard
          title="Blocked"
          value={summary.blocked_customers}
          description="Not eligible now"
          icon={<XCircle className="h-5 w-5" />}
        />
      </section>

      <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-md">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search by name, phone, location, or business..."
              className="w-full rounded-2xl border border-gray-200 bg-gray-50 py-3 pl-11 pr-4 text-sm outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-50"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {(["ALL", "ELIGIBLE", "JOINED", "BLOCKED"] as const).map(
              (item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setFilter(item)}
                  className={`rounded-xl px-4 py-2.5 text-sm font-bold transition ${
                    filter === item
                      ? "bg-emerald-600 text-white shadow-sm hover:bg-emerald-700"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {item === "ALL"
                    ? "All"
                    : item === "ELIGIBLE"
                      ? "Eligible"
                      : item === "JOINED"
                        ? "Already Joined"
                        : "Blocked"}
                </button>
              )
            )}
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-gray-100 bg-white shadow-sm">
        {loading ? (
          <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 p-8 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
            </div>
            <p className="text-sm font-medium text-gray-500">
              Loading your registered customers...
            </p>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 p-8 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-50">
              <Users className="h-8 w-8 text-gray-400" />
            </div>
            <h2 className="text-lg font-bold text-gray-900">
              No customers found
            </h2>
            <p className="max-w-md text-sm leading-6 text-gray-500">
              No customer matches your current search or filter. Try changing
              the filter or refresh the page.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredCustomers.map((customer) => {
              const selectedAmount = selectedAmounts[customer.id];
              const isAdding = actionLoadingCustomerId === customer.id;
              const isJoined = Boolean(customer.fund_space_member);

              return (
                <div key={customer.id} className="p-5 md:p-6">
                  <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-xl font-bold text-gray-900">
                          {customer.full_name}
                        </h3>

                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-bold ${getStatusStyle(
                            customer.verification_status
                          )}`}
                        >
                          {customer.verification_status}
                        </span>

                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-bold ${getStatusStyle(
                            customer.status
                          )}`}
                        >
                          {customer.status}
                        </span>

                        {customer.is_blacklisted && (
                          <span className="rounded-full border border-red-100 bg-red-50 px-3 py-1 text-xs font-bold text-red-700">
                            Blacklisted
                          </span>
                        )}
                      </div>

                      <div className="mt-4 grid gap-3 text-sm text-gray-600 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="rounded-2xl bg-gray-50 p-4">
                          <p className="text-xs font-semibold uppercase text-gray-400">
                            Phone
                          </p>
                          <p className="mt-1 font-bold text-gray-800">
                            {customer.phone || "Not provided"}
                          </p>
                        </div>

                        <div className="rounded-2xl bg-gray-50 p-4">
                          <p className="text-xs font-semibold uppercase text-gray-400">
                            Location
                          </p>
                          <p className="mt-1 font-bold text-gray-800">
                            {customer.location ||
                              customer.city ||
                              customer.region ||
                              "Not provided"}
                          </p>
                        </div>

                        <div className="rounded-2xl bg-gray-50 p-4">
                          <p className="text-xs font-semibold uppercase text-gray-400">
                            Category
                          </p>
                          <p className="mt-1 font-bold text-gray-800">
                            {customer.user_category || "Not provided"}
                          </p>
                        </div>

                        <div className="rounded-2xl bg-gray-50 p-4">
                          <p className="text-xs font-semibold uppercase text-gray-400">
                            Registered
                          </p>
                          <p className="mt-1 font-bold text-gray-800">
                            {formatDate(customer.created_at)}
                          </p>
                        </div>
                      </div>

                      {(customer.business_name ||
                        customer.business_type ||
                        customer.occupation) && (
                        <div className="mt-4 rounded-2xl bg-gray-50 p-4 text-sm text-gray-600">
                          <span className="font-bold text-gray-800">
                            Work/Business:
                          </span>{" "}
                          {customer.business_name ||
                            customer.business_type ||
                            customer.occupation}
                        </div>
                      )}

                      {isJoined && customer.fund_space && (
                        <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 p-5">
                          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                            <div>
                              <p className="text-sm font-bold text-emerald-700">
                                Already in Fund Space
                              </p>
                              <p className="mt-1 text-sm leading-6 text-emerald-700">
                                {customer.fund_space.name} •{" "}
                                {formatCurrency(
                                  customer.fund_space.contribution_amount
                                )}{" "}
                                • {customer.fund_space.status}
                              </p>
                            </div>

                            <Link
                              href={`/agent/fund-space/${customer.id}`}
                              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-700"
                            >
                              View Customer Fund Space
                              <ArrowRight size={16} />
                            </Link>
                          </div>
                        </div>
                      )}

                      {!customer.can_add_to_fund_space && !isJoined && (
                        <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm font-semibold text-amber-700">
                          {customer.eligibility_reason}
                        </div>
                      )}
                    </div>

                    <div className="w-full rounded-3xl border border-gray-100 bg-gray-50 p-5 xl:w-[340px]">
                      <div className="flex items-center gap-3">
                        <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-700">
                          <CircleDollarSign className="h-5 w-5" />
                        </div>

                        <div>
                          <p className="text-sm font-bold text-gray-900">
                            Fund Space Action
                          </p>
                          <p className="text-xs text-gray-500">
                            Choose weekly amount
                          </p>
                        </div>
                      </div>

                      <div className="mt-5 grid grid-cols-2 gap-2">
                        {contributionAmounts.map((amount) => (
                          <button
                            key={amount}
                            type="button"
                            disabled={
                              !customer.can_add_to_fund_space || isAdding
                            }
                            onClick={() =>
                              handleAmountChange(customer.id, amount)
                            }
                            className={`rounded-xl border px-3 py-3 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                              selectedAmount === amount
                                ? "border-emerald-600 bg-emerald-600 text-white shadow-sm"
                                : "border-gray-200 bg-white text-gray-700 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
                            }`}
                          >
                            {formatCurrency(amount)}
                          </button>
                        ))}
                      </div>

                      <button
                        type="button"
                        disabled={
                          !customer.can_add_to_fund_space ||
                          !selectedAmount ||
                          isAdding
                        }
                        onClick={() => handleAddToFundSpace(customer)}
                        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                      >
                        {isAdding ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Adding...
                          </>
                        ) : (
                          <>
                            Add to Fund Space
                            <ArrowRight size={16} />
                          </>
                        )}
                      </button>

                      <p className="mt-4 text-center text-xs font-medium text-gray-500">
                        Status: {customer.eligibility_reason}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}