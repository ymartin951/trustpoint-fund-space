import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

import type { Database } from '@/lib/supabase/database.types';

export const dynamic = 'force-dynamic';

const supabaseUrl: string = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey: string =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
const serviceRoleKey: string = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
  throw new Error('Missing Supabase environment variables.');
}

const adminSupabase = createClient<Database>(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const allowedContributionAmounts = [50, 100, 200, 500];

type ProfileLite = {
  id: string;
  full_name: string | null;
  role: string | null;
  status: string | null;
  verification_status: string | null;
  is_blacklisted: boolean | null;
};

type FundSpaceRow = Database['public']['Tables']['fund_spaces']['Row'];
type FundSpaceMemberRow =
  Database['public']['Tables']['fund_space_members']['Row'];
type NotificationInsert =
  Database['public']['Tables']['notifications']['Insert'];

type JoinRequestBody = {
  contribution_amount?: number | string;
  customer_id?: string | null;
  agreement_accepted?: boolean;
  agreement_version_id?: string | null;
};

type EligibilityResult = {
  user_id?: string;
  contribution_amount?: number;
  is_eligible?: boolean;
  missing_requirements?: string[];
  has_verified_identity?: boolean;
  has_emergency_contact?: boolean;
  has_approved_guarantor?: boolean;
  approved_guarantor_count?: number;
  has_business_or_employment_proof?: boolean;
  eligible_for_50?: boolean;
  eligible_for_100?: boolean;
  eligible_for_200?: boolean;
  eligible_for_500?: boolean;
};

function getBearerToken(request: Request): string | null {
  const authHeader =
    request.headers.get('authorization') ||
    request.headers.get('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.replace('Bearer ', '').trim();

  return token || null;
}

function getRequestIp(request: Request) {
  const forwardedFor = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');

  if (forwardedFor) {
    return forwardedFor.split(',')[0]?.trim() || null;
  }

  return realIp?.trim() || null;
}

function getRequestUserAgent(request: Request) {
  return request.headers.get('user-agent') || null;
}

async function getCurrentUser(request: Request) {
  const token = getBearerToken(request);

  if (!token) {
    return {
      user: null,
      errorResponse: NextResponse.json(
        {
          success: false,
          message: 'Unauthorized. Please login again.',
        },
        { status: 401 }
      ),
    };
  }

  const authSupabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
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
          message: 'Your session has expired. Please login again.',
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

function generateFundSpaceName(amount: number) {
  const now = new Date();
  const month = now.toLocaleString('en-GH', { month: 'short' });
  const year = now.getFullYear();

  return `TrustPoint GH₵${amount} Fund Space - ${month} ${year}`;
}

async function getFundSpaceMemberCount(fundSpaceId: string) {
  const { count, error } = await adminSupabase
    .from('fund_space_members')
    .select('id', { count: 'exact', head: true })
    .eq('fund_space_id', fundSpaceId)
    .in('status', ['ACTIVE']);

  if (error) {
    throw new Error(error.message || 'Could not count Fund Space members.');
  }

  return count || 0;
}

async function getProfileById(userId: string) {
  const { data, error } = await adminSupabase
    .from('profiles')
    .select('id, full_name, role, status, verification_status, is_blacklisted')
    .eq('id', userId)
    .single();

  if (error || !data) {
    return {
      profile: null,
      error: error?.message || 'Profile not found.',
    };
  }

  return {
    profile: data as ProfileLite,
    error: null,
  };
}

function validateMemberCanJoin(profile: ProfileLite) {
  if (profile.status !== 'ACTIVE') {
    return 'This customer account must be active before joining Fund Space.';
  }

  if (profile.verification_status !== 'VERIFIED') {
    return 'This customer must complete verification before joining TrustPoint Fund Space.';
  }

  if (profile.is_blacklisted) {
    return 'This customer account cannot join Fund Space. Please contact support.';
  }

  return null;
}

function formatEligibilityMessage({
  isAgentAddingCustomer,
  memberName,
  contributionAmount,
  missingRequirements,
}: {
  isAgentAddingCustomer: boolean;
  memberName: string | null;
  contributionAmount: number;
  missingRequirements: string[];
}) {
  const targetName = isAgentAddingCustomer
    ? memberName || 'This customer'
    : 'Your account';

  const requirementText =
    missingRequirements.length > 0
      ? missingRequirements.join(' ')
      : 'Required safety information is missing.';

  return `${targetName} is not eligible to join the GH₵${contributionAmount} Fund Space yet. ${requirementText}`;
}

async function checkMemberEligibility({
  userId,
  contributionAmount,
}: {
  userId: string;
  contributionAmount: number;
}) {
  const rpcClient = adminSupabase as any;

  const { data, error } = await rpcClient.rpc(
    'get_member_fund_space_eligibility',
    {
      p_user_id: userId,
      p_contribution_amount: contributionAmount,
    }
  );

  if (error) {
    console.error('Fund Space eligibility check error:', error);

    return {
      eligibility: null as EligibilityResult | null,
      error:
        error.message ||
        'Could not check Fund Space eligibility requirements.',
    };
  }

  return {
    eligibility: data as EligibilityResult,
    error: null,
  };
}

async function checkAgentCustomerRelationship(
  agentId: string,
  customerId: string
) {
  const { data, error } = await adminSupabase
    .from('agent_customers')
    .select('id, relationship_status')
    .eq('agent_id', agentId)
    .eq('customer_id', customerId)
    .eq('relationship_status', 'ACTIVE')
    .maybeSingle();

  if (error) {
    return {
      exists: false,
      error:
        error.message ||
        'Could not verify that this customer belongs to the agent.',
    };
  }

  return {
    exists: Boolean(data),
    error: null,
  };
}

async function checkExistingFundSpaceMembership(userId: string) {
  const { data, error } = await adminSupabase
    .from('fund_space_members')
    .select('id, fund_space_id, status')
    .eq('user_id', userId)
    .in('status', ['ACTIVE'])
    .maybeSingle();

  if (error) {
    return {
      existingMember: null,
      error:
        error.message || 'Could not check existing Fund Space membership.',
    };
  }

  return {
    existingMember: data,
    error: null,
  };
}

async function findOrCreateFundSpace(contributionAmount: number) {
  const { data: formingSpaces, error: formingSpacesError } =
    await adminSupabase
      .from('fund_spaces')
      .select('*')
      .eq('contribution_amount', contributionAmount)
      .eq('status', 'FORMING')
      .order('created_at', { ascending: true });

  if (formingSpacesError) {
    return {
      fundSpace: null,
      memberCount: 0,
      error:
        formingSpacesError.message ||
        'Could not find available Fund Space groups.',
    };
  }

  for (const space of formingSpaces || []) {
    const memberCount = await getFundSpaceMemberCount(space.id);
    const memberLimit = Number(space.member_limit || 10);

    if (memberCount < memberLimit) {
      return {
        fundSpace: space as FundSpaceRow,
        memberCount,
        error: null,
      };
    }
  }

  const { data: newFundSpace, error: createFundSpaceError } =
    await adminSupabase
      .from('fund_spaces')
      .insert({
        name: generateFundSpaceName(contributionAmount),
        contribution_amount: contributionAmount,
        status: 'FORMING',
        member_limit: 10,
        current_round_number: 0,
        frequency: 'WEEKLY',
      })
      .select('*')
      .single();

  if (createFundSpaceError || !newFundSpace) {
    return {
      fundSpace: null,
      memberCount: 0,
      error:
        createFundSpaceError?.message ||
        'Could not create a new Fund Space group.',
    };
  }

  return {
    fundSpace: newFundSpace as FundSpaceRow,
    memberCount: 0,
    error: null,
  };
}

function isSuccessfulRpcResult(result: unknown) {
  if (!result || typeof result !== 'object') {
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
  if (!result || typeof result !== 'object') {
    return 'Fund Space activation failed.';
  }

  const data = result as {
    error?: string;
    message?: string;
  };

  return data.error || data.message || 'Fund Space activation failed.';
}

async function sendNotification(input: {
  userId: string;
  title: string;
  message: string;
  type?: NotificationInsert['type'];
  relatedEntityId?: string | null;
  relatedEntityType?: string | null;
}) {
  const notification: NotificationInsert = {
    user_id: input.userId,
    title: input.title,
    message: input.message,
    type: input.type || 'SUCCESS',
    related_entity_id: input.relatedEntityId || null,
    related_entity_type: input.relatedEntityType || null,
    is_read: false,
  };

  const { error } = await adminSupabase
    .from('notifications')
    .insert(notification);

  if (error) {
    console.error('Notification error:', error);
  }
}

async function acceptAgreementForMember({
  userId,
  fundSpaceId,
  request,
  acceptedBy,
  mode,
}: {
  userId: string;
  fundSpaceId: string;
  request: Request;
  acceptedBy: string;
  mode: 'SELF_JOIN' | 'AGENT_CUSTOMER_JOIN';
}) {
  const rpcClient = adminSupabase as any;

  const { data, error } = await rpcClient.rpc(
    'accept_current_fund_space_agreement',
    {
      p_user_id: userId,
      p_fund_space_id: fundSpaceId,
      p_ip_address: getRequestIp(request),
      p_user_agent: getRequestUserAgent(request),
      p_device_info: {
        source: 'fund_space_join_api',
        mode,
        accepted_by: acceptedBy,
        accepted_for_user_id: userId,
      },
    }
  );

  if (error) {
    console.error('Fund Space agreement acceptance error:', error);
    throw new Error(
      error.message || 'Could not record Fund Space agreement acceptance.'
    );
  }

  return data;
}

function buildJoinSuccessMessage({
  isAgentAddingCustomer,
  groupIsActive,
  fullName,
}: {
  isAgentAddingCustomer: boolean;
  groupIsActive: boolean;
  fullName: string | null;
}) {
  if (isAgentAddingCustomer) {
    if (groupIsActive) {
      return `${
        fullName || 'Customer'
      } has been added to Fund Space successfully. The agreement was recorded, the group is now active, and Round 1 has started.`;
    }

    return `${
      fullName || 'Customer'
    } has been added to Fund Space successfully. The agreement was recorded and the group is still forming.`;
  }

  if (groupIsActive) {
    return 'You accepted the agreement and joined Fund Space successfully. Your group is now active and Round 1 has started.';
  }

  return 'You accepted the agreement and joined Fund Space successfully. Your group is still forming.';
}

export async function POST(request: Request) {
  try {
    const { user: actorUser, errorResponse } = await getCurrentUser(request);

    if (errorResponse || !actorUser) {
      return errorResponse;
    }

    const body = (await request.json().catch(() => null)) as
      | JoinRequestBody
      | null;

    if (!body) {
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid request body.',
        },
        { status: 400 }
      );
    }

    const contributionAmount = Number(body.contribution_amount);
    const agreementAccepted = body.agreement_accepted === true;

    const customerId =
      typeof body.customer_id === 'string' && body.customer_id.trim()
        ? body.customer_id.trim()
        : null;

    const isAgentAddingCustomer = Boolean(customerId);

    if (!allowedContributionAmounts.includes(contributionAmount)) {
      return NextResponse.json(
        {
          success: false,
          message: 'Please select a valid contribution amount.',
        },
        { status: 400 }
      );
    }

    if (!agreementAccepted) {
      return NextResponse.json(
        {
          success: false,
          message:
            'Please accept the TrustPoint Fund Space agreement before joining.',
        },
        { status: 400 }
      );
    }

    const { profile: actorProfile, error: actorProfileError } =
      await getProfileById(actorUser.id);

    if (actorProfileError || !actorProfile) {
      return NextResponse.json(
        {
          success: false,
          message: actorProfileError || 'Profile not found.',
        },
        { status: 404 }
      );
    }

    if (actorProfile.status !== 'ACTIVE') {
      return NextResponse.json(
        {
          success: false,
          message: 'Your account must be active before using Fund Space.',
        },
        { status: 403 }
      );
    }

    if (actorProfile.is_blacklisted) {
      return NextResponse.json(
        {
          success: false,
          message: 'This account cannot use Fund Space. Please contact support.',
        },
        { status: 403 }
      );
    }

    let memberProfile: ProfileLite = actorProfile;
    let joinedByAgent: string | null = null;

    if (isAgentAddingCustomer) {
      if (actorProfile.role !== 'AGENT') {
        return NextResponse.json(
          {
            success: false,
            message: 'Only agents can add customers to Fund Space.',
          },
          { status: 403 }
        );
      }

      if (!customerId) {
        return NextResponse.json(
          {
            success: false,
            message: 'Customer ID is required.',
          },
          { status: 400 }
        );
      }

      if (customerId === actorUser.id) {
        return NextResponse.json(
          {
            success: false,
            message:
              'Agents cannot add themselves as a customer using this option.',
          },
          { status: 400 }
        );
      }

      const relationshipCheck = await checkAgentCustomerRelationship(
        actorUser.id,
        customerId
      );

      if (relationshipCheck.error) {
        return NextResponse.json(
          {
            success: false,
            message: relationshipCheck.error,
          },
          { status: 500 }
        );
      }

      if (!relationshipCheck.exists) {
        return NextResponse.json(
          {
            success: false,
            message:
              'You can only add customers who are actively registered under you.',
          },
          { status: 403 }
        );
      }

      const { profile: customerProfile, error: customerProfileError } =
        await getProfileById(customerId);

      if (customerProfileError || !customerProfile) {
        return NextResponse.json(
          {
            success: false,
            message: customerProfileError || 'Customer profile not found.',
          },
          { status: 404 }
        );
      }

      memberProfile = customerProfile;
      joinedByAgent = actorUser.id;
    } else if (actorProfile.verification_status !== 'VERIFIED') {
      return NextResponse.json(
        {
          success: false,
          message:
            'You must complete verification before joining TrustPoint Fund Space.',
        },
        { status: 403 }
      );
    }

    const joinValidationError = validateMemberCanJoin(memberProfile);

    if (joinValidationError) {
      return NextResponse.json(
        {
          success: false,
          message: isAgentAddingCustomer
            ? joinValidationError
            : joinValidationError
                .replace('This customer account', 'Your account')
                .replace('This customer', 'You'),
        },
        { status: 403 }
      );
    }

    const { eligibility, error: eligibilityError } =
      await checkMemberEligibility({
        userId: memberProfile.id,
        contributionAmount,
      });

    if (eligibilityError || !eligibility) {
      return NextResponse.json(
        {
          success: false,
          message:
            eligibilityError ||
            'Could not check Fund Space eligibility requirements.',
        },
        { status: 500 }
      );
    }

    if (eligibility.is_eligible !== true) {
      const missingRequirements = Array.isArray(
        eligibility.missing_requirements
      )
        ? eligibility.missing_requirements
        : [];

      return NextResponse.json(
        {
          success: false,
          message: formatEligibilityMessage({
            isAgentAddingCustomer,
            memberName: memberProfile.full_name,
            contributionAmount,
            missingRequirements,
          }),
          eligibility,
        },
        { status: 403 }
      );
    }

    const { existingMember, error: existingMemberError } =
      await checkExistingFundSpaceMembership(memberProfile.id);

    if (existingMemberError) {
      return NextResponse.json(
        {
          success: false,
          message: existingMemberError,
        },
        { status: 500 }
      );
    }

    if (existingMember) {
      return NextResponse.json(
        {
          success: false,
          message: isAgentAddingCustomer
            ? `${
                memberProfile.full_name || 'This customer'
              } is already in a Fund Space group.`
            : 'You are already in a Fund Space group.',
          fund_space_id: existingMember.fund_space_id,
        },
        { status: 409 }
      );
    }

    const {
      fundSpace: selectedFundSpace,
      memberCount: selectedFundSpaceMemberCount,
      error: fundSpaceError,
    } = await findOrCreateFundSpace(contributionAmount);

    if (fundSpaceError || !selectedFundSpace) {
      return NextResponse.json(
        {
          success: false,
          message: fundSpaceError || 'Could not prepare Fund Space group.',
        },
        { status: 500 }
      );
    }

    const memberLimit = Number(selectedFundSpace.member_limit || 10);

    if (selectedFundSpaceMemberCount >= memberLimit) {
      return NextResponse.json(
        {
          success: false,
          message:
            'This Fund Space group is already full. Please try joining again.',
        },
        { status: 409 }
      );
    }

    const agreementResult = await acceptAgreementForMember({
      userId: memberProfile.id,
      fundSpaceId: selectedFundSpace.id,
      request,
      acceptedBy: actorUser.id,
      mode: isAgentAddingCustomer ? 'AGENT_CUSTOMER_JOIN' : 'SELF_JOIN',
    });

    const nextPosition = selectedFundSpaceMemberCount + 1;
    const now = new Date().toISOString();

    const { data: member, error: memberError } = await adminSupabase
      .from('fund_space_members')
      .insert({
        user_id: memberProfile.id,
        fund_space_id: selectedFundSpace.id,
        contribution_amount: contributionAmount,
        status: 'ACTIVE',
        joined_at: now,
        joined_by_agent: joinedByAgent,
        has_received_payout: false,
        position_number: nextPosition,
      })
      .select('*')
      .single();

    if (memberError || !member) {
      const duplicateMessage = memberError?.message?.toLowerCase() || '';

      const isDuplicate =
        duplicateMessage.includes('duplicate') ||
        duplicateMessage.includes('unique');

      return NextResponse.json(
        {
          success: false,
          message: isDuplicate
            ? isAgentAddingCustomer
              ? `${
                  memberProfile.full_name || 'This customer'
                } is already in a Fund Space group.`
              : 'You are already in a Fund Space group.'
            : isAgentAddingCustomer
              ? memberError?.message ||
                'Could not add this customer to Fund Space.'
              : memberError?.message || 'Could not add you to Fund Space.',
        },
        { status: isDuplicate ? 409 : 500 }
      );
    }

    const createdMember = member as FundSpaceMemberRow;

    const updatedMemberCount = await getFundSpaceMemberCount(
      selectedFundSpace.id
    );

    const shouldActivateGroup = updatedMemberCount >= memberLimit;

    let activationResult: unknown = null;

    if (shouldActivateGroup && selectedFundSpace.status === 'FORMING') {
      const { data: rpcData, error: activationError } =
        await adminSupabase.rpc('activate_fund_space', {
          p_fund_space_id: selectedFundSpace.id,
        });

      activationResult = rpcData;

      if (activationError || !isSuccessfulRpcResult(rpcData)) {
        console.error('Fund Space activation error:', activationError);
        console.error('Fund Space activation result:', rpcData);

        return NextResponse.json(
          {
            success: false,
            message:
              activationError?.message ||
              getRpcErrorMessage(rpcData) ||
              'The customer was added to Fund Space, but the group could not be activated.',
            fund_space_id: selectedFundSpace.id,
            member: createdMember,
            agreement: agreementResult,
          },
          { status: 500 }
        );
      }
    } else {
      await adminSupabase
        .from('fund_spaces')
        .update({
          updated_at: now,
        })
        .eq('id', selectedFundSpace.id);
    }

    const { data: refreshedFundSpace, error: refreshedFundSpaceError } =
      await adminSupabase
        .from('fund_spaces')
        .select('*')
        .eq('id', selectedFundSpace.id)
        .single();

    if (refreshedFundSpaceError || !refreshedFundSpace) {
      return NextResponse.json(
        {
          success: false,
          message:
            refreshedFundSpaceError?.message ||
            'The member was added, but the updated group could not be loaded.',
          fund_space_id: selectedFundSpace.id,
          member: createdMember,
          agreement: agreementResult,
        },
        { status: 500 }
      );
    }

    const finalFundSpace = refreshedFundSpace as FundSpaceRow;
    const groupIsActive = finalFundSpace.status === 'ACTIVE';

    if (isAgentAddingCustomer) {
      await sendNotification({
        userId: memberProfile.id,
        title: 'Added to Fund Space',
        message: groupIsActive
          ? 'Your agent has added you to a TrustPoint Fund Space group. The agreement has been recorded, the group is now active, and Round 1 has started.'
          : `Your agent has added you to a TrustPoint Fund Space group. The agreement has been recorded and the group will activate when it reaches ${memberLimit} verified members.`,
        type: 'SUCCESS',
        relatedEntityId: selectedFundSpace.id,
        relatedEntityType: 'fund_space',
      });

      await sendNotification({
        userId: actorProfile.id,
        title: 'Customer Added to Fund Space',
        message: groupIsActive
          ? `You added ${
              memberProfile.full_name || 'this customer'
            } to Fund Space successfully. The agreement was recorded, the group is now active, and Round 1 has started.`
          : `You added ${
              memberProfile.full_name || 'this customer'
            } to Fund Space successfully. The agreement was recorded and the group is still forming.`,
        type: 'SUCCESS',
        relatedEntityId: selectedFundSpace.id,
        relatedEntityType: 'fund_space',
      });
    } else {
      await sendNotification({
        userId: memberProfile.id,
        title: 'Fund Space Joined',
        message: groupIsActive
          ? 'You accepted the Fund Space agreement and joined a group. Your group is now active and the first contribution round has started.'
          : `You accepted the Fund Space agreement and joined a group. Your group will activate when it reaches ${memberLimit} verified members.`,
        type: 'SUCCESS',
        relatedEntityId: selectedFundSpace.id,
        relatedEntityType: 'fund_space',
      });
    }

    const successMessage = buildJoinSuccessMessage({
      isAgentAddingCustomer,
      groupIsActive,
      fullName: memberProfile.full_name,
    });

    return NextResponse.json({
      success: true,
      mode: isAgentAddingCustomer ? 'AGENT_ADDED_CUSTOMER' : 'CUSTOMER_JOINED',
      message: successMessage,
      fund_space_id: finalFundSpace.id,
      fund_space: {
        ...finalFundSpace,
        member_count: updatedMemberCount,
        max_members: memberLimit,
      },
      member: createdMember,
      agreement: agreementResult,
      eligibility,
      customer: isAgentAddingCustomer
        ? {
            id: memberProfile.id,
            full_name: memberProfile.full_name,
            verification_status: memberProfile.verification_status,
            status: memberProfile.status,
          }
        : null,
      joined_by_agent: joinedByAgent,
      activation_result: activationResult,
    });
  } catch (error: unknown) {
    console.error('Join Fund Space API error:', error);

    const message =
      error instanceof Error ? error.message : 'Something went wrong.';

    return NextResponse.json(
      {
        success: false,
        message,
      },
      { status: 500 }
    );
  }
}