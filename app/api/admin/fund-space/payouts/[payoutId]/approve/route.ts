import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../../../../../../src/lib/supabase/database.types";

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

function isSuccessfulRpcResult(result: unknown) {
  if (!result || typeof result !== "object") {
    return true;
  }

  const data = result as {
    success?: boolean;
    error?: string;
    message?: string;
  };

  return data.success !== false;
}

function getRpcErrorMessage(result: unknown) {
  if (!result || typeof result !== "object") {
    return "Payout approval failed.";
  }

  const data = result as {
    error?: string;
    message?: string;
  };

  return data.error || data.message || "Payout approval failed.";
}

export async function POST(
  request: Request,
  { params }: { params: { payoutId: string } }
) {
  try {
    const { user, errorResponse } = await getCurrentUser(request);

    if (errorResponse || !user) {
      return errorResponse;
    }

    const payoutId = params.payoutId;

    if (!payoutId) {
      return NextResponse.json(
        {
          success: false,
          message: "Payout ID is required.",
        },
        { status: 400 }
      );
    }

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
          message: "Only admins can approve Fund Space payouts.",
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
          message: "This admin account cannot approve Fund Space payouts.",
        },
        { status: 403 }
      );
    }

    const { data: payout, error: payoutError } = await adminSupabase
      .from("fund_space_payouts")
      .select("*")
      .eq("id", payoutId)
      .single();

    if (payoutError || !payout) {
      return NextResponse.json(
        {
          success: false,
          message: payoutError?.message || "Payout record not found.",
        },
        { status: 404 }
      );
    }

    if (payout.status === "APPROVED") {
      return NextResponse.json(
        {
          success: false,
          message: "This payout has already been approved.",
        },
        { status: 409 }
      );
    }

    if (payout.status === "PAID") {
      return NextResponse.json(
        {
          success: false,
          message: "This payout has already been paid.",
        },
        { status: 409 }
      );
    }

    if (payout.status === "REJECTED") {
      return NextResponse.json(
        {
          success: false,
          message: "This payout has already been rejected.",
        },
        { status: 409 }
      );
    }

    const { data: recipient, error: recipientError } = await adminSupabase
      .from("profiles")
      .select("id, full_name, phone")
      .eq("id", payout.recipient_user_id)
      .single();

    if (recipientError || !recipient) {
      return NextResponse.json(
        {
          success: false,
          message: recipientError?.message || "Payout recipient not found.",
        },
        { status: 404 }
      );
    }

    const { data: rpcData, error: rpcError } = await adminSupabase.rpc(
      "approve_fund_space_payout",
      {
        p_payout_id: payoutId,
      }
    );

    if (rpcError || !isSuccessfulRpcResult(rpcData)) {
      console.error("Approve payout RPC error:", rpcError);
      console.error("Approve payout RPC result:", rpcData);

      return NextResponse.json(
        {
          success: false,
          message:
            rpcError?.message ||
            getRpcErrorMessage(rpcData) ||
            "Could not approve this payout.",
        },
        { status: 500 }
      );
    }

    const { data: updatedPayout, error: updatedPayoutError } =
      await adminSupabase
        .from("fund_space_payouts")
        .select("*")
        .eq("id", payoutId)
        .single();

    if (updatedPayoutError || !updatedPayout) {
      return NextResponse.json({
        success: true,
        message:
          "Payout approved, but the updated payout record could not be loaded.",
        approval_result: rpcData,
      });
    }

    await adminSupabase.from("notifications").insert({
      user_id: payout.recipient_user_id,
      title: "Fund Space Payout Approved",
      message: `Your Fund Space payout of GH₵${Number(
        payout.net_amount || 0
      ).toLocaleString("en-GH")} has been approved and is awaiting payment.`,
      type: "SUCCESS",
      related_entity_id: payout.fund_space_id,
      related_entity_type: "fund_space",
      is_read: false,
    });

    return NextResponse.json({
      success: true,
      message: `${recipient.full_name}'s payout has been approved successfully.`,
      payout: updatedPayout,
      recipient,
      approval_result: rpcData,
    });
  } catch (error: any) {
    console.error("Approve Fund Space payout API error:", error);

    return NextResponse.json(
      {
        success: false,
        message: error?.message || "Something went wrong.",
      },
      { status: 500 }
    );
  }
}