import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

import type { Database } from '@/lib/database.types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type CustomerProfile = Pick<
  Database['public']['Tables']['profiles']['Row'],
  | 'id'
  | 'full_name'
  | 'phone'
  | 'email'
  | 'momo_number'
  | 'status'
  | 'verification_status'
>;

function createServiceClient() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL is not configured.'
    );
  }

  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured.');
  }

  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
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

function parseLimit(value: string | null) {
  const limit = Number(value || 30);

  if (!Number.isFinite(limit) || limit <= 0) {
    return 30;
  }

  return Math.min(limit, 100);
}

export async function GET(request: NextRequest) {
  try {
    const authorizationHeader = request.headers.get('authorization');

    if (!authorizationHeader?.startsWith('Bearer ')) {
      return errorResponse('Unauthorized request. Please log in again.', 401);
    }

    const accessToken = authorizationHeader.replace('Bearer ', '').trim();

    if (!accessToken) {
      return errorResponse('Missing access token. Please log in again.', 401);
    }

    const supabase = createServiceClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(accessToken);

    if (userError || !user) {
      return errorResponse('Your session has expired. Please log in again.', 401);
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, role, status')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError || !profile) {
      return errorResponse('Agent profile could not be found.', 404);
    }

    if (profile.status !== 'ACTIVE') {
      return errorResponse('Your agent account is not active.', 403);
    }

    if (profile.role !== 'AGENT') {
      return errorResponse('Only agents can view agent deposits.', 403);
    }

    const limit = parseLimit(request.nextUrl.searchParams.get('limit'));

    const { data: paymentRows, error: paymentError } = await supabase
      .from('payment_transactions')
      .select('*')
      .eq('initiated_by', user.id)
      .eq('payment_type', 'AGENT_CUSTOMER_DEPOSIT')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (paymentError) {
      console.error('Agent deposit history error:', paymentError);
      return errorResponse('Unable to load agent deposit records.', 500);
    }

    const payments = paymentRows || [];

    const customerIds = Array.from(
      new Set(
        payments
          .map((payment) => payment.customer_id || payment.user_id)
          .filter((value): value is string => Boolean(value))
      )
    );

    let customerProfiles: CustomerProfile[] = [];

    if (customerIds.length > 0) {
      const { data: profiles, error: customerProfileError } = await supabase
        .from('profiles')
        .select(
          'id, full_name, phone, email, momo_number, status, verification_status'
        )
        .in('id', customerIds);

      if (customerProfileError) {
        console.warn(
          'Agent deposit customer profile warning:',
          customerProfileError.message
        );
      } else {
        customerProfiles = (profiles || []) as CustomerProfile[];
      }
    }

    const profileMap = new Map(
      customerProfiles.map((customer) => [customer.id, customer])
    );

    const enrichedPayments = payments.map((payment) => ({
      ...payment,
      customer_profile:
        profileMap.get(payment.customer_id || payment.user_id || '') || null,
    }));

    return NextResponse.json({
      success: true,
      payments: enrichedPayments,
    });
  } catch (error) {
    console.error('Agent deposits API error:', error);

    const message =
      error instanceof Error
        ? error.message
        : 'Unable to load agent deposit records.';

    return NextResponse.json(
      {
        success: false,
        message,
      },
      { status: 500 }
    );
  }
}