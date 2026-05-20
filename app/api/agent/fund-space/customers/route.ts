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

type CustomerProfileLite = {
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

type ActiveFundSpaceMember = {
  id: string;
  user_id: string;
  fund_space_id: string;
  contribution_amount: number;
  status: string;
  joined_at: string | null;
  joined_by_agent: string | null;
  position_number: number | null;
  payout_order: number | null;
};

type FundSpaceLite = {
  id: string;
  name: string;
  contribution_amount: number;
  status: string;
  member_limit: number;
  current_round_number: number;
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

function getCustomerEligibility(input: {
  customer: CustomerProfileLite;
  activeMembership?: ActiveFundSpaceMember | null;
}) {
  const { customer, activeMembership } = input;

  if (activeMembership) {
    return {
      can_add_to_fund_space: false,
      reason: "Already in Fund Space",
    };
  }

  if (customer.status !== "ACTIVE") {
    return {
      can_add_to_fund_space: false,
      reason: "Account is not active",
    };
  }

  if (customer.verification_status !== "VERIFIED") {
    return {
      can_add_to_fund_space: false,
      reason: "Customer is not verified",
    };
  }

  if (customer.is_blacklisted) {
    return {
      can_add_to_fund_space: false,
      reason: "Customer is blacklisted",
    };
  }

  return {
    can_add_to_fund_space: true,
    reason: "Eligible",
  };
}

export async function GET(request: Request) {
  try {
    const { user, errorResponse } = await getCurrentUser(request);

    if (errorResponse || !user) {
      return errorResponse;
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
          message: "Only agents can access this resource.",
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
          message: "This agent account cannot access Fund Space.",
        },
        { status: 403 }
      );
    }

    const { data: relationships, error: relationshipsError } =
      await adminSupabase
        .from("agent_customers")
        .select("id, customer_id, relationship_status, created_at, notes")
        .eq("agent_id", user.id)
        .eq("relationship_status", "ACTIVE")
        .order("created_at", { ascending: false });

    if (relationshipsError) {
      return NextResponse.json(
        {
          success: false,
          message:
            relationshipsError.message ||
            "Could not load your registered customers.",
        },
        { status: 500 }
      );
    }

    const customerIds =
      relationships
        ?.map((relationship) => relationship.customer_id)
        .filter(Boolean) || [];

    if (customerIds.length === 0) {
      return NextResponse.json({
        success: true,
        summary: {
          total_customers: 0,
          verified_customers: 0,
          eligible_customers: 0,
          already_in_fund_space: 0,
          blocked_customers: 0,
        },
        customers: [],
      });
    }

    const { data: customerProfiles, error: customerProfilesError } =
      await adminSupabase
        .from("profiles")
        .select(
          `
          id,
          full_name,
          phone,
          email,
          location,
          city,
          region,
          occupation,
          business_name,
          business_type,
          user_category,
          status,
          verification_status,
          is_blacklisted,
          created_at
        `
        )
        .in("id", customerIds)
        .order("created_at", { ascending: false });

    if (customerProfilesError) {
      return NextResponse.json(
        {
          success: false,
          message:
            customerProfilesError.message ||
            "Could not load customer profiles.",
        },
        { status: 500 }
      );
    }

    const typedCustomerProfiles =
      (customerProfiles || []) as CustomerProfileLite[];

    const { data: activeMemberships, error: membershipsError } =
      await adminSupabase
        .from("fund_space_members")
        .select(
          `
          id,
          user_id,
          fund_space_id,
          contribution_amount,
          status,
          joined_at,
          joined_by_agent,
          position_number,
          payout_order
        `
        )
        .in("user_id", customerIds)
        .in("status", ["ACTIVE"]);

    if (membershipsError) {
      return NextResponse.json(
        {
          success: false,
          message:
            membershipsError.message ||
            "Could not check customers' Fund Space membership.",
        },
        { status: 500 }
      );
    }

    const typedMemberships =
      (activeMemberships || []) as ActiveFundSpaceMember[];

    const fundSpaceIds = Array.from(
      new Set(
        typedMemberships
          .map((membership) => membership.fund_space_id)
          .filter(Boolean)
      )
    );

    let fundSpaces: FundSpaceLite[] = [];

    if (fundSpaceIds.length > 0) {
      const { data: fundSpaceRows, error: fundSpacesError } =
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
              fundSpacesError.message ||
              "Could not load Fund Space details.",
          },
          { status: 500 }
        );
      }

      fundSpaces = (fundSpaceRows || []) as FundSpaceLite[];
    }

    const relationshipByCustomerId = new Map(
      (relationships || []).map((relationship) => [
        relationship.customer_id,
        relationship,
      ])
    );

    const membershipByCustomerId = new Map(
      typedMemberships.map((membership) => [membership.user_id, membership])
    );

    const fundSpaceById = new Map(
      fundSpaces.map((fundSpace) => [fundSpace.id, fundSpace])
    );

    const customers = typedCustomerProfiles.map((customer) => {
      const relationship = relationshipByCustomerId.get(customer.id) || null;
      const membership = membershipByCustomerId.get(customer.id) || null;
      const fundSpace = membership
        ? fundSpaceById.get(membership.fund_space_id) || null
        : null;

      const eligibility = getCustomerEligibility({
        customer,
        activeMembership: membership,
      });

      return {
        id: customer.id,
        full_name: customer.full_name,
        phone: customer.phone,
        email: customer.email,
        location: customer.location,
        city: customer.city,
        region: customer.region,
        occupation: customer.occupation,
        business_name: customer.business_name,
        business_type: customer.business_type,
        user_category: customer.user_category,
        status: customer.status,
        verification_status: customer.verification_status,
        is_blacklisted: customer.is_blacklisted,
        created_at: customer.created_at,
        agent_customer: relationship
          ? {
              id: relationship.id,
              relationship_status: relationship.relationship_status,
              created_at: relationship.created_at,
              notes: relationship.notes,
            }
          : null,
        fund_space_member: membership
          ? {
              id: membership.id,
              fund_space_id: membership.fund_space_id,
              contribution_amount: membership.contribution_amount,
              status: membership.status,
              joined_at: membership.joined_at,
              joined_by_agent: membership.joined_by_agent,
              position_number: membership.position_number,
              payout_order: membership.payout_order,
            }
          : null,
        fund_space: fundSpace
          ? {
              id: fundSpace.id,
              name: fundSpace.name,
              contribution_amount: fundSpace.contribution_amount,
              status: fundSpace.status,
              member_limit: fundSpace.member_limit,
              current_round_number: fundSpace.current_round_number,
            }
          : null,
        can_add_to_fund_space: eligibility.can_add_to_fund_space,
        eligibility_reason: eligibility.reason,
      };
    });

    const summary = {
      total_customers: customers.length,
      verified_customers: customers.filter(
        (customer) => customer.verification_status === "VERIFIED"
      ).length,
      eligible_customers: customers.filter(
        (customer) => customer.can_add_to_fund_space
      ).length,
      already_in_fund_space: customers.filter(
        (customer) => Boolean(customer.fund_space_member)
      ).length,
      blocked_customers: customers.filter(
        (customer) =>
          customer.status !== "ACTIVE" ||
          customer.verification_status !== "VERIFIED" ||
          customer.is_blacklisted
      ).length,
    };

    return NextResponse.json({
      success: true,
      summary,
      customers,
    });
  } catch (error: any) {
    console.error("Agent Fund Space customers API error:", error);

    return NextResponse.json(
      {
        success: false,
        message: error?.message || "Something went wrong.",
      },
      { status: 500 }
    );
  }
}