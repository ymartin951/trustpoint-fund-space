import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../../../../../src/lib/supabase/database.types";

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

type MemberProfileLite = {
  id: string;
  full_name: string;
  phone: string | null;
  verification_status: string | null;
};

type MemberWithProfile = {
  id: string;
  user_id: string;
  fund_space_id: string;
  contribution_amount: number;
  status: string;
  joined_at: string | null;
  joined_by_agent: string | null;
  has_received_payout: boolean | null;
  payout_order: number | null;
  position_number: number | null;
  received_round_number: number | null;
  profile: MemberProfileLite | null;
};

type RoundLite = {
  id: string;
  fund_space_id: string;
  round_number: number;
  recipient_user_id: string;
  contribution_amount: number;
  expected_total_amount: number;
  contribution_deadline: string | null;
  week_start_date: string | null;
  week_end_date: string | null;
  status: string;
  completed_at: string | null;
  created_at: string | null;
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

function getSafeOrderValue(member: {
  payout_order: number | null;
  position_number: number | null;
}) {
  return member.payout_order || member.position_number || 999999;
}

export async function GET(
  request: Request,
  { params }: { params: { customerId: string } }
) {
  try {
    const { user, errorResponse } = await getCurrentUser(request);

    if (errorResponse || !user) {
      return errorResponse;
    }

    const customerId = params.customerId;

    if (!customerId) {
      return NextResponse.json(
        {
          success: false,
          message: "Customer ID is required.",
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
          message: "Only agents can view customer Fund Space details.",
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

    const { data: relationship, error: relationshipError } =
      await adminSupabase
        .from("agent_customers")
        .select("id, relationship_status, created_at, notes")
        .eq("agent_id", user.id)
        .eq("customer_id", customerId)
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
            "You can only view Fund Space details for customers registered under you.",
        },
        { status: 403 }
      );
    }

    const { data: customer, error: customerError } = await adminSupabase
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
      .eq("id", customerId)
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

    const { data: membership, error: membershipError } = await adminSupabase
      .from("fund_space_members")
      .select("*")
      .eq("user_id", customerId)
      .in("status", ["ACTIVE"])
      .order("joined_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (membershipError) {
      return NextResponse.json(
        {
          success: false,
          message:
            membershipError.message ||
            "Could not load customer Fund Space membership.",
        },
        { status: 500 }
      );
    }

    if (!membership) {
      return NextResponse.json({
        success: true,
        customer,
        agent_customer: relationship,
        fund_space_member: null,
        fund_space: null,
        member_count: 0,
        join_position: null,
        payout_order_list: [],
        selected_customer_payout: null,
        members: [],
        rounds: [],
        contributions: [],
        payouts: [],
      });
    }

    const { data: fundSpace, error: fundSpaceError } = await adminSupabase
      .from("fund_spaces")
      .select("*")
      .eq("id", membership.fund_space_id)
      .single();

    if (fundSpaceError || !fundSpace) {
      return NextResponse.json(
        {
          success: false,
          message:
            fundSpaceError?.message ||
            "Customer Fund Space group could not be found.",
        },
        { status: 404 }
      );
    }

    const memberCount = await getFundSpaceMemberCount(fundSpace.id);

    const { data: members, error: membersError } = await adminSupabase
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
        has_received_payout,
        payout_order,
        position_number,
        received_round_number
      `
      )
      .eq("fund_space_id", fundSpace.id)
      .in("status", ["ACTIVE"])
      .order("position_number", { ascending: true });

    if (membersError) {
      return NextResponse.json(
        {
          success: false,
          message:
            membersError.message || "Could not load Fund Space members.",
        },
        { status: 500 }
      );
    }

    const memberUserIds =
      members?.map((member) => member.user_id).filter(Boolean) || [];

    let memberProfiles: MemberProfileLite[] = [];

    if (memberUserIds.length > 0) {
      const { data: profiles, error: profilesError } = await adminSupabase
        .from("profiles")
        .select("id, full_name, phone, verification_status")
        .in("id", memberUserIds);

      if (profilesError) {
        return NextResponse.json(
          {
            success: false,
            message:
              profilesError.message || "Could not load member profiles.",
          },
          { status: 500 }
        );
      }

      memberProfiles = (profiles || []) as MemberProfileLite[];
    }

    const profileById = new Map(
      memberProfiles.map((profile) => [profile.id, profile])
    );

    const membersWithProfiles: MemberWithProfile[] =
      members?.map((member) => ({
        id: member.id,
        user_id: member.user_id,
        fund_space_id: member.fund_space_id,
        contribution_amount: Number(member.contribution_amount || 0),
        status: member.status,
        joined_at: member.joined_at,
        joined_by_agent: member.joined_by_agent,
        has_received_payout: member.has_received_payout,
        payout_order: member.payout_order,
        position_number: member.position_number,
        received_round_number: member.received_round_number,
        profile: profileById.get(member.user_id) || null,
      })) || [];

    const joinPosition =
      membership.position_number ||
      membership.payout_order ||
      membersWithProfiles.findIndex((member) => member.id === membership.id) +
        1 ||
      null;

    const { data: rounds, error: roundsError } = await adminSupabase
      .from("fund_space_rounds")
      .select("*")
      .eq("fund_space_id", fundSpace.id)
      .order("round_number", { ascending: true });

    if (roundsError) {
      return NextResponse.json(
        {
          success: false,
          message: roundsError.message || "Could not load contribution rounds.",
        },
        { status: 500 }
      );
    }

    const roundList = (rounds || []) as RoundLite[];

    const roundByRecipientUserId = new Map(
      roundList.map((round) => [round.recipient_user_id, round])
    );

    const roundByRoundNumber = new Map(
      roundList.map((round) => [round.round_number, round])
    );

    const sortedMembersByPayoutOrder = [...membersWithProfiles].sort((a, b) => {
      return getSafeOrderValue(a) - getSafeOrderValue(b);
    });

    const payoutOrderList = sortedMembersByPayoutOrder.map((member, index) => {
      const payoutOrder = member.payout_order || index + 1;

      const matchingRound =
        roundByRecipientUserId.get(member.user_id) ||
        roundByRoundNumber.get(payoutOrder) ||
        null;

      return {
        member_id: member.id,
        user_id: member.user_id,
        full_name: member.profile?.full_name || "Unknown member",
        phone: member.profile?.phone || null,
        verification_status: member.profile?.verification_status || null,
        contribution_amount: member.contribution_amount,
        member_status: member.status,
        joined_at: member.joined_at,
        position_number: member.position_number,
        payout_order: payoutOrder,
        received_round_number: member.received_round_number,
        has_received_payout: member.has_received_payout,
        is_selected_customer: member.user_id === customerId,
        round: matchingRound
          ? {
              id: matchingRound.id,
              round_number: matchingRound.round_number,
              status: matchingRound.status,
              week_start_date: matchingRound.week_start_date,
              week_end_date: matchingRound.week_end_date,
              contribution_deadline: matchingRound.contribution_deadline,
              contribution_amount: matchingRound.contribution_amount,
              expected_total_amount: matchingRound.expected_total_amount,
              completed_at: matchingRound.completed_at,
            }
          : null,
      };
    });

    const selectedCustomerPayout =
      payoutOrderList.find((item) => item.user_id === customerId) || null;

    const { data: contributions, error: contributionsError } =
      await adminSupabase
        .from("fund_space_contributions")
        .select("*")
        .eq("fund_space_id", fundSpace.id)
        .eq("user_id", customerId)
        .order("created_at", { ascending: false });

    if (contributionsError) {
      return NextResponse.json(
        {
          success: false,
          message:
            contributionsError.message ||
            "Could not load customer contributions.",
        },
        { status: 500 }
      );
    }

    const { data: payouts, error: payoutsError } = await adminSupabase
      .from("fund_space_payouts")
      .select("*")
      .eq("fund_space_id", fundSpace.id)
      .eq("recipient_user_id", customerId)
      .order("created_at", { ascending: false });

    if (payoutsError) {
      return NextResponse.json(
        {
          success: false,
          message: payoutsError.message || "Could not load customer payouts.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      customer,
      agent_customer: relationship,
      fund_space_member: membership,
      fund_space: fundSpace,
      member_count: memberCount,
      join_position: joinPosition,

      payout_order_list: payoutOrderList,
      selected_customer_payout: selectedCustomerPayout,

      members: membersWithProfiles,
      rounds: roundList,
      contributions: contributions || [],
      payouts: payouts || [],
    });
  } catch (error: any) {
    console.error("Agent customer Fund Space details API error:", error);

    return NextResponse.json(
      {
        success: false,
        message: error?.message || "Something went wrong.",
      },
      { status: 500 }
    );
  }
}