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

type NotificationInsert =
  Database['public']['Tables']['notifications']['Insert'];

type PayoutRow = Database['public']['Tables']['fund_space_payouts']['Row'];

type AdminProfile = {
  id: string;
  full_name: string | null;
  role: string | null;
  status: string | null;
  is_blacklisted: boolean | null;
};

type RecipientProfile = {
  id: string;
  full_name: string | null;
  phone: string | null;
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

function isAdminRole(role?: string | null) {
  return role === 'ADMIN' || role === 'SUPER_ADMIN';
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
    return 'Payout rejection failed.';
  }

  const data = result as {
    error?: string;
    message?: string;
  };

  return data.error || data.message || 'Payout rejection failed.';
}

function formatCurrency(amount: number | null | undefined) {
  return `GH₵${Number(amount || 0).toLocaleString('en-GH')}`;
}

async function createPayoutRejectedNotification({
  payout,
  reason,
}: {
  payout: PayoutRow;
  reason: string;
}) {
  const notification: NotificationInsert = {
    user_id: payout.recipient_user_id,
    title: 'Fund Space Payout Rejected',
    message: `Your Fund Space payout request of ${formatCurrency(
      Number(payout.net_amount || payout.gross_amount || 0)
    )} was rejected. Reason: ${reason}`,
    type: 'WARNING',
    related_entity_id: payout.id,
    related_entity_type: 'fund_space_payout',
    is_read: false,
  };

  const { error } = await adminSupabase
    .from('notifications')
    .insert(notification);

  if (error) {
    console.error('Payout rejection notification error:', error);
  }
}

export async function POST(
  request: Request,
  { params }: { params: { payoutId: string } }
) {
  try {
    const { user, errorResponse } = await getCurrentUser(request);

    if (errorResponse || !user) {
      return errorResponse;
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

    const body = await request.json().catch(() => null);

    if (!body) {
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid request body.',
        },
        { status: 400 }
      );
    }

    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';

    if (!reason) {
      return NextResponse.json(
        {
          success: false,
          message: 'Rejection reason is required.',
        },
        { status: 400 }
      );
    }

    const { data: adminProfile, error: adminProfileError } =
      await adminSupabase
        .from('profiles')
        .select('id, full_name, role, status, is_blacklisted')
        .eq('id', user.id)
        .single();

    if (adminProfileError || !adminProfile) {
      return NextResponse.json(
        {
          success: false,
          message: 'Admin profile not found.',
        },
        { status: 404 }
      );
    }

    const currentAdmin = adminProfile as AdminProfile;

    if (!isAdminRole(currentAdmin.role)) {
      return NextResponse.json(
        {
          success: false,
          message: 'Only admins can reject Fund Space payouts.',
        },
        { status: 403 }
      );
    }

    if (currentAdmin.status !== 'ACTIVE') {
      return NextResponse.json(
        {
          success: false,
          message: 'Your admin account must be active.',
        },
        { status: 403 }
      );
    }

    if (currentAdmin.is_blacklisted) {
      return NextResponse.json(
        {
          success: false,
          message: 'This admin account cannot reject Fund Space payouts.',
        },
        { status: 403 }
      );
    }

    const { data: payout, error: payoutError } = await adminSupabase
      .from('fund_space_payouts')
      .select('*')
      .eq('id', payoutId)
      .single();

    if (payoutError || !payout) {
      return NextResponse.json(
        {
          success: false,
          message: payoutError?.message || 'Payout record not found.',
        },
        { status: 404 }
      );
    }

    const existingPayout = payout as PayoutRow;

    if (existingPayout.status === 'REJECTED') {
      return NextResponse.json(
        {
          success: false,
          message: 'This payout has already been rejected.',
        },
        { status: 409 }
      );
    }

    if (existingPayout.status === 'PAID') {
      return NextResponse.json(
        {
          success: false,
          message: 'This payout has already been paid and cannot be rejected.',
        },
        { status: 409 }
      );
    }

    if (existingPayout.status === 'APPROVED') {
      return NextResponse.json(
        {
          success: false,
          message:
            'This payout has already been approved. Reject it before approval or handle it through the correct payout correction process.',
        },
        { status: 409 }
      );
    }

    const { data: recipient, error: recipientError } = await adminSupabase
      .from('profiles')
      .select('id, full_name, phone')
      .eq('id', existingPayout.recipient_user_id)
      .single();

    if (recipientError || !recipient) {
      return NextResponse.json(
        {
          success: false,
          message: recipientError?.message || 'Payout recipient not found.',
        },
        { status: 404 }
      );
    }

    const payoutRecipient = recipient as RecipientProfile;

    const { data: rpcData, error: rpcError } = await adminSupabase.rpc(
      'reject_fund_space_payout',
      {
        p_payout_id: payoutId,
        p_reason: reason,
      }
    );

    if (rpcError || !isSuccessfulRpcResult(rpcData)) {
      console.error('Reject payout RPC error:', rpcError);
      console.error('Reject payout RPC result:', rpcData);

      return NextResponse.json(
        {
          success: false,
          message:
            rpcError?.message ||
            getRpcErrorMessage(rpcData) ||
            'Could not reject this payout.',
        },
        { status: 500 }
      );
    }

    const { data: updatedPayout, error: updatedPayoutError } =
      await adminSupabase
        .from('fund_space_payouts')
        .select('*')
        .eq('id', payoutId)
        .single();

    if (updatedPayoutError || !updatedPayout) {
      await createPayoutRejectedNotification({
        payout: existingPayout,
        reason,
      });

      return NextResponse.json({
        success: true,
        message:
          'Payout rejected, but the updated payout record could not be loaded.',
        rejection_result: rpcData,
      });
    }

    await createPayoutRejectedNotification({
      payout: updatedPayout as PayoutRow,
      reason,
    });

    return NextResponse.json({
      success: true,
      message: `${
        payoutRecipient.full_name || 'Recipient'
      }'s payout has been rejected successfully.`,
      payout: updatedPayout,
      recipient: payoutRecipient,
      rejection_result: rpcData,
    });
  } catch (error: unknown) {
    console.error('Reject Fund Space payout API error:', error);

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