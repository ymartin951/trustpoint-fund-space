import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../../../src/lib/supabase/database.types";

export const runtime = "nodejs";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
  throw new Error("Missing Supabase environment variables.");
}

const supabaseAdmin = createClient<Database>(
  supabaseUrl,
  supabaseServiceRoleKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

type ExtendedProfile = Database["public"]["Tables"]["profiles"]["Row"] & {
  id_type?: string | null;
  id_number?: string | null;
  id_document_front_url?: string | null;
  id_document_back_url?: string | null;
  selfie_url?: string | null;
};

export async function GET(request: Request) {
  try {
    const authHeader =
      request.headers.get("authorization") ||
      request.headers.get("Authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        {
          success: false,
          message: "Unauthorized request. Please login again.",
        },
        { status: 401 }
      );
    }

    const token = authHeader.replace("Bearer ", "").trim();

    const supabaseAuth = createClient<Database>(
      supabaseUrl!,
      supabaseAnonKey!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      }
    );

    const {
      data: { user },
      error: userError,
    } = await supabaseAuth.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json(
        {
          success: false,
          message: "Your session has expired. Please login again.",
        },
        { status: 401 }
      );
    }

    const { data: agentProfile, error: agentError } = await supabaseAdmin
      .from("profiles")
      .select("id, role, status, full_name")
      .eq("id", user.id)
      .single();

    if (agentError || !agentProfile) {
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
          message: "Only agents can view assigned customers.",
        },
        { status: 403 }
      );
    }

    if (agentProfile.status !== "ACTIVE") {
      return NextResponse.json(
        {
          success: false,
          message: "Your agent account is not active.",
        },
        { status: 403 }
      );
    }

    const { data: relationships, error: relationshipError } =
      await supabaseAdmin
        .from("agent_customers")
        .select(
          "id, agent_id, customer_id, relationship_status, notes, created_at, updated_at"
        )
        .eq("agent_id", user.id)
        .order("created_at", { ascending: false });

    if (relationshipError) {
      return NextResponse.json(
        {
          success: false,
          message:
            relationshipError.message || "Could not load assigned customers.",
        },
        { status: 500 }
      );
    }

    if (!relationships || relationships.length === 0) {
      return NextResponse.json({
        success: true,
        customers: [],
        stats: {
          total: 0,
          active: 0,
          pending: 0,
          verified: 0,
          rejected: 0,
        },
      });
    }

    const customerIds = relationships
      .map((item) => item.customer_id)
      .filter(Boolean);

    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .in("id", customerIds);

    if (profilesError) {
      return NextResponse.json(
        {
          success: false,
          message:
            profilesError.message || "Could not load customer profile details.",
        },
        { status: 500 }
      );
    }

    const profileMap = new Map<string, ExtendedProfile>();

    (profiles || []).forEach((profile) => {
      profileMap.set(profile.id, profile as ExtendedProfile);
    });

    const customers = relationships.map((relationship) => {
      const profile = profileMap.get(relationship.customer_id);

      return {
        relationship_id: relationship.id,
        agent_id: relationship.agent_id,
        customer_id: relationship.customer_id,
        relationship_status: relationship.relationship_status,
        notes: relationship.notes,
        assigned_at: relationship.created_at,
        updated_at: relationship.updated_at,
        profile,
      };
    });

    const stats = {
      total: customers.length,
      active: customers.filter(
        (customer) => customer.relationship_status === "ACTIVE"
      ).length,
      pending: customers.filter(
        (customer) => customer.profile?.verification_status === "PENDING"
      ).length,
      verified: customers.filter(
        (customer) => customer.profile?.verification_status === "VERIFIED"
      ).length,
      rejected: customers.filter(
        (customer) => customer.profile?.verification_status === "REJECTED"
      ).length,
    };

    return NextResponse.json({
      success: true,
      customers,
      stats,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Something went wrong.";

    return NextResponse.json(
      {
        success: false,
        message,
      },
      { status: 500 }
    );
  }
}