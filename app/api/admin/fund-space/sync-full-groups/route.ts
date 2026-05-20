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
    return "Fund Space activation failed.";
  }

  const data = result as {
    error?: string;
    message?: string;
  };

  return data.error || data.message || "Fund Space activation failed.";
}

async function getFundSpaceMemberCount(fundSpaceId: string) {
  const { count, error } = await adminSupabase
    .from("fund_space_members")
    .select("id", { count: "exact", head: true })
    .eq("fund_space_id", fundSpaceId)
    .in("status", ["ACTIVE"]);

  if (error) {
    throw new Error(error.message || "Could not count Fund Space members.");
  }

  return count || 0;
}

export async function POST(request: Request) {
  try {
    const { user, errorResponse } = await getCurrentUser(request);

    if (errorResponse || !user) {
      return errorResponse;
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
          message: "Only admins can sync Fund Space groups.",
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
          message: "This admin account cannot sync Fund Space groups.",
        },
        { status: 403 }
      );
    }

    const { data: formingGroups, error: formingGroupsError } =
      await adminSupabase
        .from("fund_spaces")
        .select("*")
        .eq("status", "FORMING")
        .order("created_at", { ascending: true });

    if (formingGroupsError) {
      return NextResponse.json(
        {
          success: false,
          message:
            formingGroupsError.message || "Could not load forming groups.",
        },
        { status: 500 }
      );
    }

    const results: Array<{
      fund_space_id: string;
      name: string | null;
      member_count: number;
      member_limit: number;
      activated: boolean;
      message: string;
      activation_result?: unknown;
    }> = [];

    for (const group of formingGroups || []) {
      const memberLimit = Number(group.member_limit || 10);
      const memberCount = await getFundSpaceMemberCount(group.id);

      if (memberCount < memberLimit) {
        results.push({
          fund_space_id: group.id,
          name: group.name,
          member_count: memberCount,
          member_limit: memberLimit,
          activated: false,
          message: "Group is not full yet.",
        });

        continue;
      }

      const { data: rpcData, error: rpcError } = await adminSupabase.rpc(
        "activate_fund_space",
        {
          p_fund_space_id: group.id,
        }
      );

      if (rpcError || !isSuccessfulRpcResult(rpcData)) {
        results.push({
          fund_space_id: group.id,
          name: group.name,
          member_count: memberCount,
          member_limit: memberLimit,
          activated: false,
          message:
            rpcError?.message ||
            getRpcErrorMessage(rpcData) ||
            "Activation failed.",
          activation_result: rpcData,
        });

        continue;
      }

      results.push({
        fund_space_id: group.id,
        name: group.name,
        member_count: memberCount,
        member_limit: memberLimit,
        activated: true,
        message: "Group activated successfully.",
        activation_result: rpcData,
      });
    }

    const activatedCount = results.filter((item) => item.activated).length;

    return NextResponse.json({
      success: true,
      message:
        activatedCount > 0
          ? `${activatedCount} full Fund Space group(s) activated successfully.`
          : "No full forming Fund Space group needed activation.",
      activated_count: activatedCount,
      checked_count: results.length,
      results,
    });
  } catch (error: any) {
    console.error("Sync full Fund Space groups error:", error);

    return NextResponse.json(
      {
        success: false,
        message: error?.message || "Something went wrong.",
      },
      { status: 500 }
    );
  }
}