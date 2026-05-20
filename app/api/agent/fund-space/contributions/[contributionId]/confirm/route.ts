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
    return "Contribution confirmation failed.";
  }

  const data = result as {
    error?: string;
    message?: string;
  };

  return data.error || data.message || "Contribution confirmation failed.";
}

function normalizePaymentMethod(value: unknown) {
  if (typeof value !== "string") return "";

  return value.trim().toUpperCase();
}

export async function POST(
  request: Request,
  { params }: { params: { contributionId: string } }
) {
  try {
    const { user, errorResponse } = await getCurrentUser(request);

    if (errorResponse || !user) {
      return errorResponse;
    }

    const contributionId = params.contributionId;

    if (!contributionId) {
      return NextResponse.json(
        {
          success: false,
          message: "Contribution ID is required.",
        },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => null);

    if (!body) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid request body.",
        },
        { status: 400 }
      );
    }

    const amount = Number(body.amount);
    const paymentMethod = normalizePaymentMethod(body.payment_method);
    const paymentReference =
      typeof body.payment_reference === "string"
        ? body.payment_reference.trim()
        : "";

    if (!amount || Number.isNaN(amount) || amount <= 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Please enter a valid amount paid.",
        },
        { status: 400 }
      );
    }

    if (!paymentMethod) {
      return NextResponse.json(
        {
          success: false,
          message: "Payment method is required.",
        },
        { status: 400 }
      );
    }

    const { data: agentProfile, error: agentProfileError } =
      await adminSupabase
        .from("profiles")
        .select("id, full_name, role, status, is_blacklisted")
        .eq("id", user.id)
        .single();

    if (agentProfileError || !agentProfile) {
      return NextResponse.json(
        {
          success: false,
          message: "Agent profile not found.",
        },
        { status: 404 }
      );
    }

    if (agentProfile.role !== "AGENT") {
      return NextResponse.json(
        {
          success: false,
          message: "Only agents can confirm customer contributions.",
        },
        { status: 403 }
      );
    }

    if (agentProfile.status !== "ACTIVE") {
      return NextResponse.json(
        {
          success: false,
          message: "Your agent account must be active.",
        },
        { status: 403 }
      );
    }

    if (agentProfile.is_blacklisted) {
      return NextResponse.json(
        {
          success: false,
          message:
            "This agent account cannot confirm Fund Space contributions.",
        },
        { status: 403 }
      );
    }

    const { data: contribution, error: contributionError } =
      await adminSupabase
        .from("fund_space_contributions")
        .select("*")
        .eq("id", contributionId)
        .single();

    if (contributionError || !contribution) {
      return NextResponse.json(
        {
          success: false,
          message:
            contributionError?.message || "Contribution record not found.",
        },
        { status: 404 }
      );
    }

    if (contribution.status === "PAID") {
      return NextResponse.json(
        {
          success: false,
          message: "This contribution has already been marked as paid.",
        },
        { status: 409 }
      );
    }

    const { data: relationship, error: relationshipError } =
      await adminSupabase
        .from("agent_customers")
        .select("id, relationship_status")
        .eq("agent_id", user.id)
        .eq("customer_id", contribution.user_id)
        .eq("relationship_status", "ACTIVE")
        .maybeSingle();

    if (relationshipError) {
      return NextResponse.json(
        {
          success: false,
          message:
            relationshipError.message ||
            "Could not verify customer relationship.",
        },
        { status: 500 }
      );
    }

    if (!relationship) {
      return NextResponse.json(
        {
          success: false,
          message:
            "You can only confirm contributions for customers registered under you.",
        },
        { status: 403 }
      );
    }

    const { data: customer, error: customerError } = await adminSupabase
      .from("profiles")
      .select("id, full_name, phone")
      .eq("id", contribution.user_id)
      .single();

    if (customerError || !customer) {
      return NextResponse.json(
        {
          success: false,
          message: customerError?.message || "Customer profile not found.",
        },
        { status: 404 }
      );
    }

    const { data: rpcData, error: rpcError } = await adminSupabase.rpc(
      "confirm_fund_space_contribution",
      {
        p_contribution_id: contributionId,
        p_amount: amount,
        p_payment_method: paymentMethod,
        p_payment_reference: paymentReference || undefined,
      }
    );

    if (rpcError || !isSuccessfulRpcResult(rpcData)) {
      console.error("Confirm contribution RPC error:", rpcError);
      console.error("Confirm contribution RPC result:", rpcData);

      return NextResponse.json(
        {
          success: false,
          message:
            rpcError?.message ||
            getRpcErrorMessage(rpcData) ||
            "Could not confirm this contribution.",
        },
        { status: 500 }
      );
    }

    let roundCheckResult: unknown = null;

    const { data: roundData, error: roundCheckError } =
      await adminSupabase.rpc("check_round_ready_for_payout", {
        p_round_id: contribution.round_id,
      });

    if (roundCheckError) {
      console.warn("Round ready check warning:", roundCheckError.message);
    } else {
      roundCheckResult = roundData;
    }

    const { data: updatedContribution, error: updatedContributionError } =
      await adminSupabase
        .from("fund_space_contributions")
        .select("*")
        .eq("id", contributionId)
        .single();

    if (updatedContributionError || !updatedContribution) {
      return NextResponse.json(
        {
          success: true,
          message:
            "Contribution confirmed, but the updated record could not be loaded.",
          confirmation_result: rpcData,
          round_check_result: roundCheckResult,
        },
        { status: 200 }
      );
    }

    await adminSupabase.from("notifications").insert({
      user_id: contribution.user_id,
      title: "Contribution Confirmed",
      message: `Your Fund Space contribution of GH₵${amount.toLocaleString(
        "en-GH"
      )} has been confirmed.`,
      type: "SUCCESS",
      related_entity_id: contribution.fund_space_id,
      related_entity_type: "fund_space",
      is_read: false,
    });

    return NextResponse.json({
      success: true,
      message: `${customer.full_name}'s contribution has been confirmed successfully.`,
      contribution: updatedContribution,
      customer,
      confirmation_result: rpcData,
      round_check_result: roundCheckResult,
    });
  } catch (error: any) {
    console.error("Confirm Fund Space contribution API error:", error);

    return NextResponse.json(
      {
        success: false,
        message: error?.message || "Something went wrong.",
      },
      { status: 500 }
    );
  }
}