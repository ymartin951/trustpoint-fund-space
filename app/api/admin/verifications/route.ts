import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../../../src/lib/supabase/database.types";

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

type VerificationStatus =
  | "ALL"
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "RESUBMITTED";

function getBearerToken(request: Request) {
  const authHeader = request.headers.get("authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  return authHeader.replace("Bearer ", "").trim();
}

function isAdminRole(role?: string | null) {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

function normalizeStatus(status: string | null): VerificationStatus {
  const upper = (status || "PENDING").toUpperCase();

  if (upper === "ALL") return "ALL";
  if (upper === "APPROVED") return "APPROVED";
  if (upper === "REJECTED") return "REJECTED";
  if (upper === "RESUBMITTED") return "RESUBMITTED";

  return "PENDING";
}

function isResubmittedRequest(request: {
  status: string | null;
  rejection_reason: string | null;
}) {
  return (
    request.status === "PENDING" &&
    Boolean(request.rejection_reason?.startsWith("Resubmitted by agent"))
  );
}

async function createSignedUrl(pathOrUrl?: string | null) {
  if (!pathOrUrl) return null;

  if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) {
    return pathOrUrl;
  }

  const cleanPath = pathOrUrl.replace(/^\/+/, "");

  const { data, error } = await adminSupabase.storage
    .from("kyc-documents")
    .createSignedUrl(cleanPath, 60 * 60);

  if (error) {
    console.error("Signed URL error:", error.message);
    return null;
  }

  return data.signedUrl;
}

export async function GET(request: Request) {
  try {
    const token = getBearerToken(request);

    if (!token) {
      return NextResponse.json(
        { success: false, message: "Unauthorized. Missing bearer token." },
        { status: 401 }
      );
    }

    const {
      data: { user },
      error: userError,
    } = await adminSupabase.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized. Invalid session." },
        { status: 401 }
      );
    }

    const { data: adminProfile, error: adminProfileError } = await adminSupabase
      .from("profiles")
      .select("id, role, status, full_name, email")
      .eq("id", user.id)
      .single();

    if (adminProfileError || !adminProfile) {
      return NextResponse.json(
        { success: false, message: "Admin profile not found." },
        { status: 404 }
      );
    }

    if (!isAdminRole(adminProfile.role)) {
      return NextResponse.json(
        { success: false, message: "Forbidden. Admin access required." },
        { status: 403 }
      );
    }

    if (adminProfile.status && adminProfile.status !== "ACTIVE") {
      return NextResponse.json(
        { success: false, message: "Your admin account is not active." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);

    const selectedStatus = normalizeStatus(searchParams.get("status"));
    const search = searchParams.get("search")?.trim() || "";
    const page = Number(searchParams.get("page") || "1");
    const limit = Math.min(Number(searchParams.get("limit") || "20"), 100);

    const safePage = Number.isFinite(page) && page > 0 ? page : 1;
    const safeLimit = Number.isFinite(limit) && limit > 0 ? limit : 20;

    const from = (safePage - 1) * safeLimit;
    const to = from + safeLimit - 1;

    let query = adminSupabase
      .from("verification_requests")
      .select(
        `
        id,
        user_id,
        full_name,
        phone,
        email,
        country,
        region,
        city,
        location,
        gender,
        date_of_birth,
        user_category,
        occupation,
        employer_name,
        staff_id,
        business_name,
        business_type,
        business_location,
        ghana_card_number,
        ghana_card_front_url,
        ghana_card_back_url,
        selfie_url,
        employment_proof_url,
        business_proof_url,
        momo_number,
        bank_name,
        bank_account_number,
        bank_account_name,
        emergency_contact_name,
        emergency_contact_phone,
        submitted_by_agent,
        status,
        rejection_reason,
        reviewed_at,
        reviewed_by,
        created_at,
        updated_at
      `,
        { count: "exact" }
      )
      .order("created_at", { ascending: false });

    if (selectedStatus === "RESUBMITTED") {
      query = query
        .eq("status", "PENDING")
        .ilike("rejection_reason", "Resubmitted by agent%");
    } else if (selectedStatus !== "ALL") {
      query = query.eq("status", selectedStatus);
    }

    if (search) {
      query = query.or(
        [
          `full_name.ilike.%${search}%`,
          `phone.ilike.%${search}%`,
          `email.ilike.%${search}%`,
          `ghana_card_number.ilike.%${search}%`,
          `city.ilike.%${search}%`,
          `location.ilike.%${search}%`,
          `business_name.ilike.%${search}%`,
        ].join(",")
      );
    }

    query = query.range(from, to);

    const { data: requests, error: requestsError, count } = await query;

    if (requestsError) {
      console.error("Verification requests error:", requestsError);

      return NextResponse.json(
        {
          success: false,
          message:
            requestsError.message || "Failed to load verification requests.",
        },
        { status: 500 }
      );
    }

    const agentIds = Array.from(
      new Set(
        (requests || [])
          .map((request) => request.submitted_by_agent)
          .filter(Boolean) as string[]
      )
    );

    const reviewedByIds = Array.from(
      new Set(
        (requests || [])
          .map((request) => request.reviewed_by)
          .filter(Boolean) as string[]
      )
    );

    const profileIds = Array.from(new Set([...agentIds, ...reviewedByIds]));

    let relatedProfiles: {
      id: string;
      full_name: string | null;
      email: string | null;
      phone: string | null;
      role: string;
    }[] = [];

    if (profileIds.length > 0) {
      const { data: profiles, error: profilesError } = await adminSupabase
        .from("profiles")
        .select("id, full_name, email, phone, role")
        .in("id", profileIds);

      if (profilesError) {
        console.error("Related profiles error:", profilesError);
      } else {
        relatedProfiles = profiles || [];
      }
    }

    const profileMap = new Map(
      relatedProfiles.map((profile) => [profile.id, profile])
    );

    const enhancedRequests = await Promise.all(
      (requests || []).map(async (request) => {
        const is_resubmitted = isResubmittedRequest(request);

        return {
          ...request,
          is_resubmitted,
          ghana_card_front_signed_url: await createSignedUrl(
            request.ghana_card_front_url
          ),
          ghana_card_back_signed_url: await createSignedUrl(
            request.ghana_card_back_url
          ),
          selfie_signed_url: await createSignedUrl(request.selfie_url),
          employment_proof_signed_url: await createSignedUrl(
            request.employment_proof_url
          ),
          business_proof_signed_url: await createSignedUrl(
            request.business_proof_url
          ),
          submitted_by_agent_profile: request.submitted_by_agent
            ? profileMap.get(request.submitted_by_agent) || null
            : null,
          reviewed_by_profile: request.reviewed_by
            ? profileMap.get(request.reviewed_by) || null
            : null,
        };
      })
    );

    const { data: statsData, error: statsError } = await adminSupabase
      .from("verification_requests")
      .select("status, rejection_reason");

    if (statsError) {
      console.error("Verification stats error:", statsError);
    }

    const stats = {
      all: statsData?.length || 0,
      pending:
        statsData?.filter((item) => item.status === "PENDING").length || 0,
      approved:
        statsData?.filter((item) => item.status === "APPROVED").length || 0,
      rejected:
        statsData?.filter((item) => item.status === "REJECTED").length || 0,
      resubmitted:
        statsData?.filter((item) => isResubmittedRequest(item)).length || 0,
    };

    return NextResponse.json({
      success: true,
      requests: enhancedRequests,
      stats,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total: count || 0,
        totalPages: Math.max(1, Math.ceil((count || 0) / safeLimit)),
      },
    });
  } catch (error: any) {
    console.error("Admin verification list API error:", error);

    return NextResponse.json(
      {
        success: false,
        message: error?.message || "Something went wrong.",
      },
      { status: 500 }
    );
  }
}