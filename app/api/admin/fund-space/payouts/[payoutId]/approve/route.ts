import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

import type { Database } from '@/lib/database.types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
  throw new Error('Missing Supabase environment variables.');
}

const adminSupabase = createClient<Database>(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

type AuthenticatedAdminResult =
  | {
      success: true;
      userId: string;
      userSupabase: ReturnType<typeof createUserClient>;
      adminProfile: {
        id: string;
        full_name: string | null;
        role: string;
        status: string;
        is_blacklisted: boolean;
      };
    }
  | {
      success: false;
      response: NextResponse;
    };

function createUserClient(token: string) {
  return createClient<Database>(supabaseUrl!, supabaseAnonKey!, {
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
}

function getBearerToken(request: Request) {
  const authHeader =
    request.headers.get('authorization') ||
    request.headers.get('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  return authHeader.replace('Bearer ', '').trim();
}

function normalizeRole(role: string | null | undefined) {
  return String(role || '').trim().toUpperCase();
}

function isAdminRole(role: string | null | undefined) {
  const normalizedRole = normalizeRole(role);

  return normalizedRole === 'ADMIN' || normalizedRole === 'SUPER_ADMIN';
}

function getGhanaWeekday() {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    timeZone: 'Africa/Accra',
  }).format(new Date());
}

function isFridayInGhana() {
  return getGhanaWeekday() === 'Friday';
}

async function getAuthenticatedAdmin(
  request: Request
): Promise<AuthenticatedAdminResult> {
  const token = getBearerToken(request);

  if (!token) {
    return {
      success: false,
      response: NextResponse.json(
        {
          success: false,
          message: 'Unauthorized. Please login again.',
        },
        { status: 401 }
      ),
    };
  }

  const userSupabase = createUserClient(token);

  const {
    data: { user },
    error: userError,
  } = await userSupabase.auth.getUser(token);

  if (userError || !user) {
    return {
      success: false,
      response: NextResponse.json(
        {
          success: false,
          message: 'Your session has expired. Please login again.',
        },
        { status: 401 }
      ),
    };
  }

  const { data: adminProfile, error: adminProfileError } = await adminSupabase
    .from('profiles')
    .select('id, full_name, role, status, is_blacklisted')
    .eq('id', user.id)
    .maybeSingle();

  if (adminProfileError || !adminProfile) {
    return {
      success: false,
      response: NextResponse.json(
        {
          success: false,
          message: adminProfileError?.message || 'Admin profile not found.',
        },
        { status: 404 }
      ),
    };
  }

  if (!isAdminRole(adminProfile.role)) {
    return {
      success: false,
      response: NextResponse.json(
        {
          success: false,
          message: 'Only admins can approve Fund Space payouts.',
        },
        { status: 403 }
      ),
    };
  }

  if (adminProfile.status !== 'ACTIVE') {
    return {
      success: false,
      response: NextResponse.json(
        {
          success: false,
          message: 'Your admin account must be active.',
        },
        { status: 403 }
      ),
    };
  }

  if (adminProfile.is_blacklisted) {
    return {
      success: false,
      response: NextResponse.json(
        {
          success: false,
          message: 'This admin account cannot approve Fund Space payouts.',
        },
        { status: 403 }
      ),
    };
  }

  return {
    success: true,
    userId: user.id,
    userSupabase,
    adminProfile,
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
    return 'Payout approval failed.';
  }

  const data = result as {
    error?: string;
    message?: string;
  };

  return data.error || data.message || 'Payout approval failed.';
}

export async function POST(
  request: Request,
  { params }: { params: { payoutId: string } }
): Promise<NextResponse> {
  try {
    const authResult = await getAuthenticatedAdmin(request);

    if (!authResult.success) {
      return authResult.response;
    }

    if (!isFridayInGhana()) {
      return NextResponse.json(
        {
          success: false,
          message: `Payout approvals are only allowed on Fridays. Today is ${getGhanaWeekday()} in Ghana.`,
        },
        { status: 403 }
      );
    }

    const payoutId = params.payoutId;

    if (!payoutId) {
      return NextResponse.json(
        {
          success: false,
          message: 'Payout ID is required.',
        },
        { status: 400 }
      );
    }

    const { data: payout, error: payoutError } = await adminSupabase
      .from('fund_space_payouts')
      .select('*')
      .eq('id', payoutId)
      .maybeSingle();

    if (payoutError || !payout) {
      return NextResponse.json(
        {
          success: false,
          message: payoutError?.message || 'Payout record not found.',
        },
        { status: 404 }
      );
    }

    if (payout.status === 'APPROVED') {
      return NextResponse.json(
        {
          success: false,
          message: 'This payout has already been approved.',
        },
        { status: 409 }
      );
    }

    if (payout.status === 'PAID') {
      return NextResponse.json(
        {
          success: false,
          message: 'This payout has already been paid.',
        },
        { status: 409 }
      );
    }

    if (payout.status === 'REJECTED') {
      return NextResponse.json(
        {
          success: false,
          message: 'This payout has already been rejected.',
        },
        { status: 409 }
      );
    }

    const { data: recipient, error: recipientError } = await adminSupabase
      .from('profiles')
      .select('id, full_name, phone')
      .eq('id', payout.recipient_user_id)
      .maybeSingle();

    if (recipientError || !recipient) {
      return NextResponse.json(
        {
          success: false,
          message: recipientError?.message || 'Payout recipient not found.',
        },
        { status: 404 }
      );
    }

    /*
      Important:
      We call the RPC with userSupabase, not adminSupabase.
      This preserves the logged-in admin identity for auth.uid()
      and for SQL helpers like is_admin_or_super_admin().
    */
    const { data: rpcData, error: rpcError } =
      await authResult.userSupabase.rpc('approve_fund_space_payout', {
        p_payout_id: payoutId,
      });

    if (rpcError || !isSuccessfulRpcResult(rpcData)) {
      console.error('Approve payout RPC error:', rpcError);
      console.error('Approve payout RPC result:', rpcData);

      return NextResponse.json(
        {
          success: false,
          message:
            rpcError?.message ||
            getRpcErrorMessage(rpcData) ||
            'Could not approve this payout.',
        },
        { status: 500 }
      );
    }

    const { data: updatedPayout, error: updatedPayoutError } =
      await adminSupabase
        .from('fund_space_payouts')
        .select('*')
        .eq('id', payoutId)
        .maybeSingle();

    if (updatedPayoutError || !updatedPayout) {
      return NextResponse.json({
        success: true,
        message:
          'Payout approved, but the updated payout record could not be loaded.',
        approval_result: rpcData,
      });
    }

    return NextResponse.json({
      success: true,
      message: `${recipient.full_name || 'Recipient'}'s payout has been approved successfully.`,
      payout: updatedPayout,
      recipient,
      approval_result: rpcData,
    });
  } catch (error: unknown) {
    console.error('Approve Fund Space payout API error:', error);

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error ? error.message : 'Something went wrong.',
      },
      { status: 500 }
    );
  }
}