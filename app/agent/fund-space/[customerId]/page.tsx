"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import {
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Clock,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Trophy,
  Users,
  Wallet,
} from "lucide-react";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase public environment variables.");
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

type Customer = {
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
};

type FundSpace = {
  id: string;
  name: string | null;
  contribution_amount: number;
  status: string;
  member_limit: number;
  current_round_number: number;
  frequency: string | null;
  start_date: string | null;
  completed_at: string | null;
  created_at: string | null;
};

type FundSpaceMember = {
  id: string;
  user_id: string;
  fund_space_id: string;
  contribution_amount: number;
  status: string;
  joined_at: string | null;
  joined_by_agent: string | null;
  has_received_payout: boolean;
  payout_order: number | null;
  position_number: number | null;
  received_round_number: number | null;
};

type MemberWithProfile = FundSpaceMember & {
  profile: {
    id: string;
    full_name: string;
    phone: string | null;
    verification_status: string;
  } | null;
};

type Round = {
  id: string;
  fund_space_id: string;
  round_number: number;
  recipient_user_id: string;
  contribution_amount: number;
  expected_total_amount: number;
  contribution_deadline: string;
  week_start_date: string;
  week_end_date: string;
  status: string;
  completed_at: string | null;
  created_at: string | null;
};

type Contribution = {
  id: string;
  fund_space_id: string;
  round_id: string;
  user_id: string;
  amount_due: number;
  amount_paid: number;
  status: string;
  paid_at: string | null;
  payment_method: string | null;
  payment_reference: string | null;
  created_at: string | null;
};

type Payout = {
  id: string;
  fund_space_id: string;
  round_id: string;
  recipient_user_id: string;
  gross_amount: number;
  net_amount: number;
  platform_fee: number;
  status: string;
  approved_at: string | null;
  paid_at: string | null;
  payout_method: string | null;
  payout_reference: string | null;
  created_at: string | null;
};

type PayoutOrderItem = {
  member_id: string;
  user_id: string;
  full_name: string;
  phone: string | null;
  verification_status: string | null;
  contribution_amount: number;
  member_status: string;
  joined_at: string | null;
  position_number: number | null;
  payout_order: number;
  received_round_number: number | null;
  has_received_payout: boolean | null;
  is_selected_customer: boolean;
  round: {
    id: string;
    round_number: number;
    status: string;
    week_start_date: string | null;
    week_end_date: string | null;
    contribution_deadline: string | null;
    contribution_amount: number;
    expected_total_amount: number;
    completed_at: string | null;
  } | null;
};

type DetailsApiResponse = {
  success: boolean;
  message?: string;
  customer?: Customer;
  fund_space_member?: FundSpaceMember | null;
  fund_space?: FundSpace | null;
  member_count?: number;
  join_position?: number | null;
  members?: MemberWithProfile[];
  rounds?: Round[];
  contributions?: Contribution[];
  payouts?: Payout[];
  payout_order_list?: PayoutOrderItem[];
  selected_customer_payout?: PayoutOrderItem | null;
};

function formatCurrency(amount: number | null | undefined) {
  return `GH₵${Number(amount || 0).toLocaleString("en-GH")}`;
}

function formatDate(dateString: string | null | undefined) {
  if (!dateString) return "Not set";

  return new Intl.DateTimeFormat("en-GH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(dateString));
}

function getStatusStyle(status: string | null | undefined) {
  const value = status || "PENDING";

  if (["ACTIVE", "VERIFIED", "APPROVED", "COMPLETED", "PAID"].includes(value)) {
    return "border-emerald-100 bg-emerald-50 text-emerald-700";
  }

  if (
    ["PENDING", "FORMING", "COLLECTING", "READY_FOR_PAYOUT"].includes(value)
  ) {
    return "border-amber-100 bg-amber-50 text-amber-700";
  }

  if (
    ["REJECTED", "FAILED", "INACTIVE", "SUSPENDED", "DEFAULTED"].includes(value)
  ) {
    return "border-red-100 bg-red-50 text-red-700";
  }

  return "border-gray-100 bg-gray-50 text-gray-700";
}

function InfoCard({
  title,
  value,
  description,
  icon,
}: {
  title: string;
  value: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-gray-50 p-5">
      <div className="mb-3 text-gray-500">{icon}</div>
      <p className="text-sm text-gray-500">{title}</p>
      <p className="mt-1 text-xl font-bold text-gray-900">{value}</p>
      <p className="mt-1 text-xs leading-5 text-gray-500">{description}</p>
    </div>
  );
}

export default function AgentCustomerFundSpaceDetailsPage() {
  const params = useParams();
  const customerId = String(params?.customerId || "");

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [fundSpace, setFundSpace] = useState<FundSpace | null>(null);
  const [membership, setMembership] = useState<FundSpaceMember | null>(null);
  const [memberCount, setMemberCount] = useState(0);
  const [joinPosition, setJoinPosition] = useState<number | null>(null);
  const [members, setMembers] = useState<MemberWithProfile[]>([]);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [payoutOrderList, setPayoutOrderList] = useState<PayoutOrderItem[]>([]);
  const [selectedCustomerPayout, setSelectedCustomerPayout] =
    useState<PayoutOrderItem | null>(null);

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

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

  const loadDetails = async () => {
    try {
      setLoading(true);
      setErrorMessage("");

      const token = await getAccessToken();

      const response = await fetch(
        `/api/agent/fund-space/customers/${customerId}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const result = (await response.json()) as DetailsApiResponse;

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || "Could not load customer Fund Space details."
        );
      }

      setCustomer(result.customer || null);
      setFundSpace(result.fund_space || null);
      setMembership(result.fund_space_member || null);
      setMemberCount(result.member_count || 0);
      setJoinPosition(result.join_position || null);
      setMembers(result.members || []);
      setRounds(result.rounds || []);
      setContributions(result.contributions || []);
      setPayouts(result.payouts || []);
      setPayoutOrderList(result.payout_order_list || []);
      setSelectedCustomerPayout(result.selected_customer_payout || null);
    } catch (error: any) {
      setErrorMessage(
        error?.message || "Something went wrong while loading details."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (customerId) {
      loadDetails();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  const maxMembers = fundSpace?.member_limit || 10;
  const progress =
    maxMembers > 0 ? Math.min((memberCount / maxMembers) * 100, 100) : 0;

  const currentRound = useMemo(() => {
    if (!rounds.length || !fundSpace) return null;

    return (
      rounds.find(
        (round) => round.round_number === fundSpace.current_round_number
      ) || rounds[rounds.length - 1]
    );
  }, [rounds, fundSpace]);

  const selectedPayoutLabel = selectedCustomerPayout
    ? `Week ${selectedCustomerPayout.payout_order}`
    : "Pending";

  if (loading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
        </div>
        <p className="text-sm font-medium text-gray-500">
          Loading customer Fund Space details...
        </p>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="space-y-6">
        <Link
          href="/agent/fund-space"
          className="inline-flex items-center gap-2 text-sm font-bold text-emerald-700 hover:text-emerald-800"
        >
          <ArrowLeft size={16} />
          Back to Agent Fund Space
        </Link>

        <div className="rounded-2xl border border-red-100 bg-red-50 p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-1 h-6 w-6 text-red-600" />
            <div>
              <h2 className="text-xl font-bold text-red-700">
                Could not load details
              </h2>
              <p className="mt-2 text-sm text-red-600">{errorMessage}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="rounded-2xl border border-red-100 bg-red-50 p-6">
        <h2 className="text-xl font-bold text-red-700">Customer not found</h2>
      </div>
    );
  }

  if (!membership || !fundSpace) {
    return (
      <div className="space-y-6">
        <Link
          href="/agent/fund-space"
          className="inline-flex items-center gap-2 text-sm font-bold text-emerald-700 hover:text-emerald-800"
        >
          <ArrowLeft size={16} />
          Back to Agent Fund Space
        </Link>

        <div className="rounded-3xl bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-600 p-6 text-white shadow-sm md:p-8">
          <p className="mb-3 inline-flex rounded-full bg-white/15 px-4 py-1 text-sm font-medium">
            Customer Fund Space
          </p>
          <h1 className="text-3xl font-bold md:text-4xl">
            {customer.full_name}
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-emerald-50 md:text-base">
            This customer is not currently in any active Fund Space group.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <Link
        href="/agent/fund-space"
        className="inline-flex items-center gap-2 text-sm font-bold text-emerald-700 hover:text-emerald-800"
      >
        <ArrowLeft size={16} />
        Back to Agent Fund Space
      </Link>

      <div className="rounded-3xl bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-600 p-6 text-white shadow-sm md:p-8">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
          <div className="max-w-3xl">
            <p className="mb-3 inline-flex rounded-full bg-white/15 px-4 py-1 text-sm font-medium">
              Customer Fund Space Details
            </p>

            <h1 className="text-3xl font-bold md:text-4xl">
              {customer.full_name}
            </h1>

            <p className="mt-4 max-w-2xl text-sm leading-7 text-emerald-50 md:text-base">
              Viewing this customer’s Fund Space membership, contribution
              progress, payout position, weekly payout order, and current round.
            </p>

            <div className="mt-6 flex flex-wrap gap-2">
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

              <span className="rounded-full border border-white/20 bg-white/15 px-3 py-1 text-xs font-bold text-white">
                Payout: {selectedPayoutLabel}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={loadDetails}
            disabled={loading}
            className="inline-flex min-h-12 w-fit items-center justify-center gap-2 rounded-xl bg-white/15 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>
      </div>

      <section className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-emerald-600">
              Current Fund Space
            </p>

            <h2 className="mt-2 text-2xl font-bold text-gray-900">
              {fundSpace.name || "TrustPoint Fund Space"}
            </h2>

            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                Weekly: {formatCurrency(fundSpace.contribution_amount)}
              </span>

              <span
                className={`rounded-full border px-3 py-1 text-xs font-bold ${getStatusStyle(
                  fundSpace.status
                )}`}
              >
                Group: {fundSpace.status}
              </span>

              <span
                className={`rounded-full border px-3 py-1 text-xs font-bold ${getStatusStyle(
                  membership.status
                )}`}
              >
                Member: {membership.status}
              </span>
            </div>

            <p className="mt-3 text-sm text-gray-500">
              Joined: {formatDate(membership.joined_at)}
            </p>
          </div>

          <div className="rounded-2xl bg-emerald-50 px-5 py-4 text-center">
            <p className="text-xs font-semibold uppercase text-emerald-600">
              Payout Week
            </p>
            <p className="mt-1 text-lg font-bold text-emerald-800">
              {selectedPayoutLabel}
            </p>
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-4">
          <InfoCard
            title="Members"
            value={`${memberCount}/${maxMembers}`}
            description="Current group formation"
            icon={<Users className="h-5 w-5" />}
          />
          <InfoCard
            title="Current Round"
            value={`${fundSpace.current_round_number || 0}`}
            description="Active contribution round"
            icon={<Clock className="h-5 w-5" />}
          />
          <InfoCard
            title="Payout Position"
            value={
              selectedCustomerPayout
                ? `#${selectedCustomerPayout.payout_order}`
                : joinPosition
                  ? `#${joinPosition}`
                  : "Pending"
            }
            description="Customer payout order"
            icon={<Trophy className="h-5 w-5" />}
          />
          <InfoCard
            title="Contribution"
            value={formatCurrency(membership.contribution_amount)}
            description="Weekly amount selected"
            icon={<CircleDollarSign className="h-5 w-5" />}
          />
        </div>

        <div className="mt-8">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-medium text-gray-600">
              Group formation progress
            </span>
            <span className="font-bold text-emerald-700">
              {Math.round(progress)}%
            </span>
          </div>

          <div className="h-3 overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-emerald-600 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-3">
          <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-700">
            <Trophy className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">
              Payout Order Schedule
            </h3>
            <p className="text-sm text-gray-500">
              Weekly receiver order for this Fund Space group
            </p>
          </div>
        </div>

        {fundSpace.status !== "ACTIVE" && payoutOrderList.length === 0 ? (
          <div className="rounded-2xl border border-amber-100 bg-amber-50 p-5 text-sm font-semibold text-amber-700">
            Payout order will be generated when this group becomes active.
          </div>
        ) : payoutOrderList.length > 0 ? (
          <div className="space-y-3">
            {payoutOrderList.map((item) => (
              <div
                key={item.member_id}
                className={`rounded-2xl border p-5 transition ${
                  item.is_selected_customer
                    ? "border-emerald-200 bg-emerald-50 shadow-sm"
                    : "border-gray-100 bg-gray-50"
                }`}
              >
                <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
                  <div className="flex items-start gap-4">
                    <div
                      className={`flex h-12 w-12 flex-none items-center justify-center rounded-2xl text-lg font-black ${
                        item.is_selected_customer
                          ? "bg-emerald-600 text-white"
                          : "bg-white text-gray-700"
                      }`}
                    >
                      #{item.payout_order}
                    </div>

                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-lg font-bold text-gray-900">
                          Week {item.payout_order} → {item.full_name}
                        </p>

                        {item.is_selected_customer && (
                          <span className="rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-bold text-emerald-700">
                            Selected Customer
                          </span>
                        )}

                        {item.has_received_payout && (
                          <span className="rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-bold text-emerald-700">
                            Payout Received
                          </span>
                        )}
                      </div>

                      <p className="mt-1 text-sm text-gray-500">
                        {item.phone || "No phone"} • Weekly contribution:{" "}
                        {formatCurrency(item.contribution_amount)}
                      </p>

                      {item.round ? (
                        <p className="mt-1 text-sm text-gray-500">
                          Round {item.round.round_number} •{" "}
                          {formatDate(item.round.week_start_date)} -{" "}
                          {formatDate(item.round.week_end_date)}
                        </p>
                      ) : (
                        <p className="mt-1 text-sm text-gray-500">
                          Round details will appear after the schedule is
                          generated.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-bold ${getStatusStyle(
                        item.round?.status || item.member_status
                      )}`}
                    >
                      {item.round?.status || item.member_status}
                    </span>

                    <span className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-bold text-gray-700">
                      Join Position #{item.position_number || "N/A"}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-2xl bg-gray-50 p-5 text-sm text-gray-500">
            No payout order found for this group yet.
          </p>
        )}
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center gap-3">
            <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-700">
              <CalendarDays className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">
                Current Round
              </h3>
              <p className="text-sm text-gray-500">
                Contribution collection and payout status
              </p>
            </div>
          </div>

          {currentRound ? (
            <div className="rounded-2xl bg-gray-50 p-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xl font-bold text-gray-900">
                  Round {currentRound.round_number}
                </span>
                <span
                  className={`rounded-full border px-3 py-1 text-xs font-bold ${getStatusStyle(
                    currentRound.status
                  )}`}
                >
                  {currentRound.status}
                </span>
              </div>

              <div className="mt-4 grid gap-3 text-sm text-gray-600 sm:grid-cols-2">
                <p>
                  <span className="font-bold text-gray-800">Amount:</span>{" "}
                  {formatCurrency(currentRound.contribution_amount)}
                </p>
                <p>
                  <span className="font-bold text-gray-800">Expected:</span>{" "}
                  {formatCurrency(currentRound.expected_total_amount)}
                </p>
                <p>
                  <span className="font-bold text-gray-800">Deadline:</span>{" "}
                  {formatDate(currentRound.contribution_deadline)}
                </p>
                <p>
                  <span className="font-bold text-gray-800">Week:</span>{" "}
                  {formatDate(currentRound.week_start_date)} -{" "}
                  {formatDate(currentRound.week_end_date)}
                </p>
              </div>
            </div>
          ) : (
            <p className="rounded-2xl bg-gray-50 p-5 text-sm text-gray-500">
              No contribution round has been generated yet.
            </p>
          )}
        </div>

        <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center gap-3">
            <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-700">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">
                Customer Contributions
              </h3>
              <p className="text-sm text-gray-500">
                Payment history for this Fund Space
              </p>
            </div>
          </div>

          {contributions.length > 0 ? (
            <div className="space-y-3">
              {contributions.map((contribution) => (
                <div
                  key={contribution.id}
                  className="rounded-2xl bg-gray-50 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-bold text-gray-900">
                      {formatCurrency(contribution.amount_due)}
                    </p>
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-bold ${getStatusStyle(
                        contribution.status
                      )}`}
                    >
                      {contribution.status}
                    </span>
                  </div>

                  <p className="mt-2 text-sm text-gray-500">
                    Paid: {formatCurrency(contribution.amount_paid)} •{" "}
                    {contribution.paid_at
                      ? `Paid on ${formatDate(contribution.paid_at)}`
                      : "Not paid yet"}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-2xl bg-gray-50 p-5 text-sm text-gray-500">
              No contribution record found for this customer yet.
            </p>
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-3">
          <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-700">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">Group Members</h3>
            <p className="text-sm text-gray-500">
              Members currently in this Fund Space group
            </p>
          </div>
        </div>

        {members.length > 0 ? (
          <div className="divide-y divide-gray-100">
            {members.map((member, index) => (
              <div
                key={member.id}
                className="flex flex-col justify-between gap-3 py-4 md:flex-row md:items-center"
              >
                <div>
                  <p className="font-bold text-gray-900">
                    #
                    {member.payout_order ||
                      member.position_number ||
                      index + 1}{" "}
                    {member.profile?.full_name || "Unknown member"}
                  </p>
                  <p className="mt-1 text-sm text-gray-500">
                    {member.profile?.phone || "No phone"} • Joined{" "}
                    {formatDate(member.joined_at)}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-bold ${getStatusStyle(
                      member.status
                    )}`}
                  >
                    {member.status}
                  </span>

                  {member.user_id === customer.id && (
                    <span className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                      Selected Customer
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-2xl bg-gray-50 p-5 text-sm text-gray-500">
            No group members found.
          </p>
        )}
      </section>

      <section className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-3">
          <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-700">
            <CircleDollarSign className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">
              Customer Payouts
            </h3>
            <p className="text-sm text-gray-500">
              Payout records where this customer is the receiver
            </p>
          </div>
        </div>

        {payouts.length > 0 ? (
          <div className="space-y-3">
            {payouts.map((payout) => (
              <div key={payout.id} className="rounded-2xl bg-gray-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-bold text-gray-900">
                    Net: {formatCurrency(payout.net_amount)}
                  </p>
                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-bold ${getStatusStyle(
                      payout.status
                    )}`}
                  >
                    {payout.status}
                  </span>
                </div>

                <p className="mt-2 text-sm text-gray-500">
                  Gross: {formatCurrency(payout.gross_amount)} • Fee:{" "}
                  {formatCurrency(payout.platform_fee)} •{" "}
                  {payout.paid_at
                    ? `Paid on ${formatDate(payout.paid_at)}`
                    : "Not paid yet"}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-2xl bg-gray-50 p-5 text-sm text-gray-500">
            No payout record found for this customer yet.
          </p>
        )}
      </section>
    </div>
  );
}