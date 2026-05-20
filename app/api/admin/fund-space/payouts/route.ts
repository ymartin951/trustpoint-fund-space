import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../../../../src/lib/supabase/database.types";

export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
  throw new Error("Missing Supabase environment variables.");
}

const adminSupabase = createClient<Database>(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

type PayoutStatus =
  | "ALL"
  | "PENDING_ADMIN_APPROVAL"
  | "APPROVED"
  | "REJECTED"
  | "PAID"
  | "FAILED";

type RecipientLite = {
  id: string;
  full_name: string;
  phone: string | null;
  momo_number: string | null;
  bank_name: string | null;
  bank_account_name: string | null;
  bank_account_number: string | null;
  verification_status: string;
  status: string;
};

type FundSpaceLite = {
  id: string;
  name: string;
  contribution_amount: number;
  status: string;
  member_limit: number;
  current_round_number: number;
};

type RoundLite = {
  id: string;
  round_number: number;
  recipient_user_id: string;
  contribution_amount: number;
  expected_total_amount: number;
  contribution_deadline: string;
  week_start_date: string;
  week_end_date: string;
  status: string;
};

function getBearerToken(request: Request) {
  const authHeader =
    request.headers.get("authorization") ||
    request.headers.get("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  return authHeader.replace("Bearer ", "").trim();
}

async function getCurrentUser(request: Request) {
  const token = getBearerToken(request);

  if (!token) {
    return {
      user: null,
      errorResponse: NextResponse.json(
        {
          success: false,
          message: "Unauthorized. Please login again.",
        },
        { status: 401 }
      ),
    };
  }

  const authSupabase = createClient<Database>(supabaseUrl!, supabaseAnonKey!, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });

  const {
    data: { user },
    error,
  } = await authSupabase.auth.getUser(token);

  if (error || !user) {
    return {
      user: null,
      errorResponse: NextResponse.json(
        {
          success: false,
          message: "Your session has expired. Please login again.",
        },
        { status: 401 }
      ),
    };
  }

  return {
    user,
    errorResponse: null,
  };
}

function normalizeStatus(value: string | null): PayoutStatus {
  const status = (value || "ALL").toUpperCase();

  if (
    status === "PENDING_ADMIN_APPROVAL" ||
    status === "APPROVED" ||
    status === "REJECTED" ||
    status === "PAID" ||
    status === "FAILED"
  ) {
    return status;
  }

  return "ALL";
}

export async function GET(request: Request) {
  try {
    const { user, errorResponse } = await getCurrentUser(request);

    if (errorResponse || !user) {
      return errorResponse;
    }

    const url = new URL(request.url);
    const statusFilter = normalizeStatus(url.searchParams.get("status"));
    const search = (url.searchParams.get("search") || "").trim().toLowerCase();

    const { data: adminProfile, error: adminProfileError } =
      await adminSupabase
        .from("profiles")
        .select("id, full_name, role, status, is_blacklisted")
        .eq("id", user.id)
        .single();

    if (adminProfileError || !adminProfile) {
      return NextResponse.json(
        {
          success: false,
          message: "Admin profile not found.",
        },
        { status: 404 }
      );
    }

    if (!["ADMIN", "SUPER_ADMIN"].includes(adminProfile.role)) {
      return NextResponse.json(
        {
          success: false,
          message: "Only admins can view Fund Space payouts.",
        },
        { status: 403 }
      );
    }

    if (adminProfile.status !== "ACTIVE") {
      return NextResponse.json(
        {
          success: false,
          message: "Your admin account must be active.",
        },
        { status: 403 }
      );
    }

    if (adminProfile.is_blacklisted) {
      return NextResponse.json(
        {
          success: false,
          message: "This admin account cannot access Fund Space payouts.",
        },
        { status: 403 }
      );
    }

    let payoutQuery = adminSupabase
      .from("fund_space_payouts")
      .select("*")
      .order("created_at", { ascending: false });

    if (statusFilter !== "ALL") {
      payoutQuery = payoutQuery.eq("status", statusFilter);
    }

    const { data: payoutsData, error: payoutsError } = await payoutQuery;

    if (payoutsError) {
      return NextResponse.json(
        {
          success: false,
          message: payoutsError.message || "Could not load payout records.",
        },
        { status: 500 }
      );
    }

    const payouts = payoutsData || [];

    const recipientIds = Array.from(
      new Set(
        payouts
          .map((payout) => payout.recipient_user_id)
          .filter(Boolean)
      )
    );

    const fundSpaceIds = Array.from(
      new Set(
        payouts
          .map((payout) => payout.fund_space_id)
          .filter(Boolean)
      )
    );

    const roundIds = Array.from(
      new Set(payouts.map((payout) => payout.round_id).filter(Boolean))
    );

    let recipients: RecipientLite[] = [];
    let fundSpaces: FundSpaceLite[] = [];
    let rounds: RoundLite[] = [];

    if (recipientIds.length > 0) {
      const { data: recipientsData, error: recipientsError } =
        await adminSupabase
          .from("profiles")
          .select(
            `
            id,
            full_name,
            phone,
            momo_number,
            bank_name,
            bank_account_name,
            bank_account_number,
            verification_status,
            status
          `
          )
          .in("id", recipientIds);

      if (recipientsError) {
        return NextResponse.json(
          {
            success: false,
            message:
              recipientsError.message || "Could not load payout recipients.",
          },
          { status: 500 }
        );
      }

      recipients = (recipientsData || []) as RecipientLite[];
    }

    if (fundSpaceIds.length > 0) {
      const { data: fundSpacesData, error: fundSpacesError } =
        await adminSupabase
          .from("fund_spaces")
          .select(
            `
            id,
            name,
            contribution_amount,
            status,
            member_limit,
            current_round_number
          `
          )
          .in("id", fundSpaceIds);

      if (fundSpacesError) {
        return NextResponse.json(
          {
            success: false,
            message:
              fundSpacesError.message || "Could not load Fund Space details.",
          },
          { status: 500 }
        );
      }

      fundSpaces = (fundSpacesData || []) as FundSpaceLite[];
    }

    if (roundIds.length > 0) {
      const { data: roundsData, error: roundsError } = await adminSupabase
        .from("fund_space_rounds")
        .select(
          `
          id,
          round_number,
          recipient_user_id,
          contribution_amount,
          expected_total_amount,
          contribution_deadline,
          week_start_date,
          week_end_date,
          status
        `
        )
        .in("id", roundIds);

      if (roundsError) {
        return NextResponse.json(
          {
            success: false,
            message:
              roundsError.message || "Could not load payout round details.",
          },
          { status: 500 }
        );
      }

      rounds = (roundsData || []) as RoundLite[];
    }

    const recipientById = new Map(
      recipients.map((recipient) => [recipient.id, recipient])
    );

    const fundSpaceById = new Map(
      fundSpaces.map((fundSpace) => [fundSpace.id, fundSpace])
    );

    const roundById = new Map(rounds.map((round) => [round.id, round]));

    const enrichedPayouts = payouts
      .map((payout) => {
        const recipient = recipientById.get(payout.recipient_user_id) || null;
        const fundSpace = fundSpaceById.get(payout.fund_space_id) || null;
        const round = roundById.get(payout.round_id) || null;

        return {
          ...payout,
          recipient,
          fund_space: fundSpace,
          round,
        };
      })
      .filter((item) => {
        if (!search) return true;

        return (
          item.recipient?.full_name?.toLowerCase().includes(search) ||
          item.recipient?.phone?.toLowerCase().includes(search) ||
          item.recipient?.momo_number?.toLowerCase().includes(search) ||
          item.recipient?.bank_name?.toLowerCase().includes(search) ||
          item.fund_space?.name?.toLowerCase().includes(search) ||
          String(item.round?.round_number || "").includes(search) ||
          item.payout_reference?.toLowerCase().includes(search)
        );
      });

    const summarySource = payouts.map((payout) => ({
      gross_amount: Number(payout.gross_amount || 0),
      net_amount: Number(payout.net_amount || 0),
      platform_fee: Number(payout.platform_fee || 0),
      status: payout.status,
    }));

    const summary = {
      total_payouts: summarySource.length,
      pending_payouts: summarySource.filter(
        (payout) => payout.status === "PENDING_ADMIN_APPROVAL"
      ).length,
      approved_payouts: summarySource.filter(
        (payout) => payout.status === "APPROVED"
      ).length,
      paid_payouts: summarySource.filter((payout) => payout.status === "PAID")
        .length,
      rejected_payouts: summarySource.filter(
        (payout) => payout.status === "REJECTED"
      ).length,
      total_gross_amount: summarySource.reduce(
        (sum, payout) => sum + payout.gross_amount,
        0
      ),
      total_net_amount: summarySource.reduce(
        (sum, payout) => sum + payout.net_amount,
        0
      ),
      total_platform_fee: summarySource.reduce(
        (sum, payout) => sum + payout.platform_fee,
        0
      ),
    };

    return NextResponse.json({
      success: true,
      summary,
      payouts: enrichedPayouts,
    });
  } catch (error: any) {
    console.error("Admin Fund Space payouts API error:", error);

    return NextResponse.json(
      {
        success: false,
        message: error?.message || "Something went wrong.",
      },
      { status: 500 }
    );
  }
}