import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
}

if (!serviceRoleKey) {
  throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
}

const adminSupabase = createClient<Database>(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

function getBearerToken(request: Request) {
  const authHeader = request.headers.get("authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  return authHeader.replace("Bearer ", "").trim();
}

async function getAgentFromRequest(request: Request) {
  const token = getBearerToken(request);

  if (!token) {
    return {
      error: NextResponse.json(
        { success: false, message: "Unauthorized. Missing bearer token." },
        { status: 401 }
      ),
      profile: null,
    };
  }

  const {
    data: { user },
    error: userError,
  } = await adminSupabase.auth.getUser(token);

  if (userError || !user) {
    return {
      error: NextResponse.json(
        { success: false, message: "Unauthorized. Invalid session." },
        { status: 401 }
      ),
      profile: null,
    };
  }

  const { data: profile, error: profileError } = await adminSupabase
    .from("profiles")
    .select("id, role, status, full_name, email")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    return {
      error: NextResponse.json(
        { success: false, message: "Agent profile not found." },
        { status: 404 }
      ),
      profile: null,
    };
  }

  if (profile.role !== "AGENT") {
    return {
      error: NextResponse.json(
        { success: false, message: "Only agents can access this page." },
        { status: 403 }
      ),
      profile: null,
    };
  }

  if (profile.status !== "ACTIVE") {
    return {
      error: NextResponse.json(
        { success: false, message: "Your agent account is not active." },
        { status: 403 }
      ),
      profile: null,
    };
  }

  return {
    error: null,
    profile,
  };
}

export async function GET(request: Request) {
  try {
    const { error, profile } = await getAgentFromRequest(request);

    if (error || !profile) {
      return error;
    }

    const { searchParams } = new URL(request.url);

    const filter = searchParams.get("filter") || "ALL";
    const page = Number(searchParams.get("page") || "1");
    const limit = Math.min(Number(searchParams.get("limit") || "20"), 100);

    const safePage = Number.isFinite(page) && page > 0 ? page : 1;
    const safeLimit = Number.isFinite(limit) && limit > 0 ? limit : 20;

    const from = (safePage - 1) * safeLimit;
    const to = from + safeLimit - 1;

    let query = adminSupabase
      .from("notifications")
      .select(
        `
        id,
        user_id,
        title,
        message,
        type,
        is_read,
        related_entity_id,
        related_entity_type,
        created_at
      `,
        { count: "exact" }
      )
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (filter === "UNREAD") {
      query = query.eq("is_read", false);
    }

    if (filter === "READ") {
      query = query.eq("is_read", true);
    }

    const { data: notifications, error: notificationsError, count } = await query;

    if (notificationsError) {
      console.error("Agent notifications load error:", notificationsError);

      return NextResponse.json(
        {
          success: false,
          message:
            notificationsError.message || "Failed to load notifications.",
        },
        { status: 500 }
      );
    }

    const { data: statsData, error: statsError } = await adminSupabase
      .from("notifications")
      .select("is_read")
      .eq("user_id", profile.id);

    if (statsError) {
      console.error("Agent notification stats error:", statsError);
    }

    const stats = {
      all: statsData?.length || 0,
      unread: statsData?.filter((item) => item.is_read === false).length || 0,
      read: statsData?.filter((item) => item.is_read === true).length || 0,
    };

    return NextResponse.json({
      success: true,
      notifications: notifications || [],
      stats,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total: count || 0,
        totalPages: Math.max(1, Math.ceil((count || 0) / safeLimit)),
      },
    });
  } catch (error: any) {
    console.error("Agent notifications API error:", error);

    return NextResponse.json(
      {
        success: false,
        message: error?.message || "Something went wrong.",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const { error, profile } = await getAgentFromRequest(request);

    if (error || !profile) {
      return error;
    }

    const body = await request.json().catch(() => null);

    if (!body) {
      return NextResponse.json(
        { success: false, message: "Invalid request body." },
        { status: 400 }
      );
    }

    const action = String(body.action || "").toUpperCase();
    const notificationId = body.notification_id
      ? String(body.notification_id)
      : null;

    if (action === "MARK_ONE_READ") {
      if (!notificationId) {
        return NextResponse.json(
          { success: false, message: "Notification ID is required." },
          { status: 400 }
        );
      }

      const { error: updateError } = await adminSupabase
        .from("notifications")
        .update({ is_read: true })
        .eq("id", notificationId)
        .eq("user_id", profile.id);

      if (updateError) {
        console.error("Mark notification read error:", updateError);

        return NextResponse.json(
          {
            success: false,
            message: updateError.message || "Failed to mark notification as read.",
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: "Notification marked as read.",
      });
    }

    if (action === "MARK_ALL_READ") {
      const { error: updateError } = await adminSupabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", profile.id)
        .eq("is_read", false);

      if (updateError) {
        console.error("Mark all notifications read error:", updateError);

        return NextResponse.json(
          {
            success: false,
            message:
              updateError.message || "Failed to mark all notifications as read.",
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: "All notifications marked as read.",
      });
    }

    return NextResponse.json(
      {
        success: false,
        message: "Invalid action. Use MARK_ONE_READ or MARK_ALL_READ.",
      },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("Agent notifications update API error:", error);

    return NextResponse.json(
      {
        success: false,
        message: error?.message || "Something went wrong.",
      },
      { status: 500 }
    );
  }
}