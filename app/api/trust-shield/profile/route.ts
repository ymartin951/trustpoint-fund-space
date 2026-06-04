import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

type ProfileRole = 'USER' | 'AGENT' | 'ADMIN' | 'SUPER_ADMIN' | string;

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;

const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL');
}

if (!serviceRoleKey) {
  throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
}

const adminSupabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

function getBearerToken(request: NextRequest) {
  const authHeader =
    request.headers.get('authorization') ||
    request.headers.get('Authorization') ||
    '';

  const [scheme, token] = authHeader.split(' ');

  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return null;
  }

  return token.trim();
}

function normalizeRole(role: ProfileRole | null | undefined) {
  return String(role || '').trim().toUpperCase().replaceAll('-', '_');
}

function isAdminRole(role: string) {
  return role === 'ADMIN' || role === 'SUPER_ADMIN';
}

async function canAgentViewUser({
  agentId,
  targetUserId,
}: {
  agentId: string;
  targetUserId: string;
}) {
  const { data, error } = await adminSupabase
    .from('agent_customers')
    .select('id')
    .eq('agent_id', agentId)
    .eq('customer_id', targetUserId)
    .maybeSingle();

  if (error) {
    console.error('Trust Shield agent customer permission error:', error);
    return false;
  }

  if (data) return true;

  const { data: profileData, error: profileError } = await adminSupabase
    .from('profiles')
    .select('id, registered_by_agent')
    .eq('id', targetUserId)
    .maybeSingle();

  if (profileError) {
    console.error('Trust Shield registered agent permission error:', profileError);
    return false;
  }

  return profileData?.registered_by_agent === agentId;
}

export async function GET(request: NextRequest) {
  try {
    const token = getBearerToken(request);

    if (!token) {
      return NextResponse.json(
        {
          success: false,
          message: 'Unauthorized. Please log in again.',
        },
        { status: 401 }
      );
    }

    const {
      data: { user },
      error: userError,
    } = await adminSupabase.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json(
        {
          success: false,
          message: 'Your session has expired. Please log in again.',
        },
        { status: 401 }
      );
    }

    const { data: viewerProfile, error: viewerProfileError } =
      await adminSupabase
        .from('profiles')
        .select('id, role, status')
        .eq('id', user.id)
        .maybeSingle();

    if (viewerProfileError) {
      console.error('Trust Shield viewer profile error:', viewerProfileError);

      return NextResponse.json(
        {
          success: false,
          message: 'Unable to verify your profile.',
        },
        { status: 500 }
      );
    }

    if (!viewerProfile) {
      return NextResponse.json(
        {
          success: false,
          message: 'Profile not found for this account.',
        },
        { status: 404 }
      );
    }

    const viewerRole = normalizeRole(viewerProfile.role);

    const { searchParams } = new URL(request.url);
    const requestedUserId = searchParams.get('user_id')?.trim() || user.id;

    const isOwnProfile = requestedUserId === user.id;

    let allowed = isOwnProfile || isAdminRole(viewerRole);

    if (!allowed && viewerRole === 'AGENT') {
      allowed = await canAgentViewUser({
        agentId: user.id,
        targetUserId: requestedUserId,
      });
    }

    if (!allowed) {
      return NextResponse.json(
        {
          success: false,
          message: 'You are not allowed to view this Trust Shield profile.',
        },
        { status: 403 }
      );
    }

    const rpcClient = adminSupabase as any;

    const { data, error } = await rpcClient.rpc('get_trust_shield_profile', {
      p_user_id: requestedUserId,
    });

    if (error) {
      console.error('Trust Shield RPC error:', error);

      return NextResponse.json(
        {
          success: false,
          message: error.message || 'Unable to load Trust Shield profile.',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      trust_shield: data,
    });
  } catch (error) {
    console.error('Trust Shield profile API error:', error);

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : 'Unable to load Trust Shield profile.',
      },
      { status: 500 }
    );
  }
}