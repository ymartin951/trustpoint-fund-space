import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;

const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL');
}

if (!supabaseAnonKey) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY');
}

if (!serviceRoleKey) {
  throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
}

const serviceSupabase = createClient(supabaseUrl, serviceRoleKey, {
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

function createUserClient(accessToken: string) {
  return createClient(supabaseUrl!, supabaseAnonKey!, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}

function cleanText(value: string | null | undefined) {
  return String(value || '').trim();
}

function isAdminRole(role: string | null | undefined) {
  const value = String(role || '').toUpperCase();

  return value === 'ADMIN' || value === 'SUPER_ADMIN';
}

function errorResponse(message: string, status = 400) {
  return NextResponse.json(
    {
      success: false,
      message,
    },
    { status }
  );
}

async function getAuthenticatedAdmin(request: NextRequest) {
  const token = getBearerToken(request);

  if (!token) {
    return {
      user: null,
      profile: null,
      response: errorResponse('Unauthorized. Please log in again.', 401),
    };
  }

  const userSupabase = createUserClient(token);

  const {
    data: { user },
    error: userError,
  } = await userSupabase.auth.getUser(token);

  if (userError || !user) {
    return {
      user: null,
      profile: null,
      response: errorResponse(
        'Your session has expired. Please log in again.',
        401
      ),
    };
  }

  const { data: profile, error: profileError } = await serviceSupabase
    .from('profiles')
    .select('id, full_name, phone, email, role, status')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) {
    console.error('Payout risk admin profile error:', profileError);

    return {
      user,
      profile: null,
      response: errorResponse(
        profileError.message || 'Unable to verify admin profile.',
        500
      ),
    };
  }

  if (!profile || !isAdminRole(profile.role)) {
    return {
      user,
      profile,
      response: errorResponse('Access denied. Admin account required.', 403),
    };
  }

  if (String(profile.status || '').toUpperCase() !== 'ACTIVE') {
    return {
      user,
      profile,
      response: errorResponse('Admin account must be active.', 403),
    };
  }

  return {
    user,
    profile,
    response: null,
  };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedAdmin(request);

    if (auth.response || !auth.user || !auth.profile) {
      return auth.response;
    }

    const { searchParams } = new URL(request.url);
    const payoutId = cleanText(searchParams.get('payout_id'));

    if (!payoutId) {
      return errorResponse('Payout ID is required.', 400);
    }

    const rpcClient = serviceSupabase as any;

    const { data, error } = await rpcClient.rpc('get_fund_space_payout_risk', {
      p_payout_id: payoutId,
    });

    if (error) {
      console.error('Payout risk RPC error:', error);

      return errorResponse(
        error.message || 'Unable to calculate payout risk.',
        500
      );
    }

    return NextResponse.json({
      success: true,
      risk: data,
    });
  } catch (error) {
    console.error('Payout risk GET API error:', error);

    return errorResponse(
      error instanceof Error
        ? error.message
        : 'Unable to calculate payout risk.',
      500
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedAdmin(request);

    if (auth.response || !auth.user || !auth.profile) {
      return auth.response;
    }

    const body = (await request.json().catch(() => null)) as
      | { payout_id?: string }
      | null;

    const payoutId = cleanText(body?.payout_id);

    if (!payoutId) {
      return errorResponse('Payout ID is required.', 400);
    }

    const rpcClient = serviceSupabase as any;

    const { data, error } = await rpcClient.rpc('get_fund_space_payout_risk', {
      p_payout_id: payoutId,
    });

    if (error) {
      console.error('Payout risk RPC error:', error);

      return errorResponse(
        error.message || 'Unable to calculate payout risk.',
        500
      );
    }

    return NextResponse.json({
      success: true,
      risk: data,
    });
  } catch (error) {
    console.error('Payout risk POST API error:', error);

    return errorResponse(
      error instanceof Error
        ? error.message
        : 'Unable to calculate payout risk.',
      500
    );
  }
}