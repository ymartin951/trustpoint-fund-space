import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

import type { Database } from '@/lib/database.types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getSupabaseUrl() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;

  if (!supabaseUrl) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL is not configured.'
    );
  }

  return supabaseUrl;
}

function createUserClient(accessToken: string) {
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!anonKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is not configured.');
  }

  return createClient<Database>(getSupabaseUrl(), anonKey, {
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

function createServiceClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured.');
  }

  return createClient<Database>(getSupabaseUrl(), serviceRoleKey, {
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

async function getAccessToken(request: NextRequest) {
  const authorizationHeader =
    request.headers.get('authorization') ||
    request.headers.get('Authorization');

  if (!authorizationHeader?.startsWith('Bearer ')) {
    return null;
  }

  return authorizationHeader.replace('Bearer ', '').trim();
}

function parseContributionIds(value: string | null) {
  if (!value) return [];

  return Array.from(
    new Set(
      value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
}

export async function GET(request: NextRequest) {
  try {
    const accessToken = await getAccessToken(request);

    if (!accessToken) {
      return errorResponse('Unauthorized request. Please log in again.', 401);
    }

    const { searchParams } = new URL(request.url);
    const contributionIds = parseContributionIds(
      searchParams.get('contribution_ids')
    );

    if (contributionIds.length === 0) {
      return NextResponse.json({
        success: true,
        submissions: [],
      });
    }

    const userSupabase = createUserClient(accessToken);
    const serviceSupabase = createServiceClient();

    const {
      data: { user },
      error: userError,
    } = await userSupabase.auth.getUser(accessToken);

    if (userError || !user) {
      return errorResponse('Your session has expired. Please log in again.', 401);
    }

    const { data: profile, error: profileError } = await serviceSupabase
      .from('profiles')
      .select('id, role, status')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError || !profile) {
      return errorResponse('Agent profile was not found.', 403);
    }

    if (profile.status !== 'ACTIVE') {
      return errorResponse('Your agent account is not active.', 403);
    }

    if (profile.role !== 'AGENT' && profile.role !== 'ADMIN' && profile.role !== 'SUPER_ADMIN') {
      return errorResponse('Only agents can access these payment submissions.', 403);
    }

    const { data: contributionRows, error: contributionError } =
      await serviceSupabase
        .from('fund_space_contributions')
        .select('id, user_id')
        .in('id', contributionIds);

    if (contributionError) {
      console.error('Agent contribution ownership lookup error:', contributionError);

      return errorResponse(
        'Unable to verify contribution ownership.',
        500
      );
    }

    const customerIds = Array.from(
      new Set((contributionRows || []).map((item) => item.user_id).filter(Boolean))
    );

    if (
      profile.role === 'AGENT' &&
      customerIds.length > 0
    ) {
      const { data: assignedCustomers, error: assignedError } =
        await serviceSupabase
          .from('agent_customers')
          .select('customer_id')
          .eq('agent_id', user.id)
          .in('customer_id', customerIds);

      if (assignedError) {
        console.error('Agent assigned customers lookup error:', assignedError);

        return errorResponse(
          'Unable to verify assigned customers.',
          500
        );
      }

      const assignedCustomerSet = new Set(
        (assignedCustomers || []).map((item) => item.customer_id)
      );

      const allowedContributionIds = (contributionRows || [])
        .filter((item) => assignedCustomerSet.has(item.user_id))
        .map((item) => item.id);

      if (allowedContributionIds.length === 0) {
        return NextResponse.json({
          success: true,
          submissions: [],
        });
      }

      const { data: submissions, error: submissionsError } =
        await serviceSupabase
          .from('manual_payment_submissions')
          .select(
            'id, contribution_id, fund_space_id, user_id, agent_id, status, transaction_reference, total_amount_paid, rejection_reason, created_at, reviewed_at'
          )
          .in('contribution_id', allowedContributionIds)
          .in('status', ['PENDING_REVIEW', 'REJECTED'])
          .order('created_at', { ascending: false });

      if (submissionsError) {
        console.error('Agent manual payment submissions load error:', submissionsError);

        return errorResponse(
          'Unable to load MoMo verification submissions.',
          500
        );
      }

      return NextResponse.json({
        success: true,
        submissions: submissions || [],
      });
    }

    const { data: submissions, error: submissionsError } = await serviceSupabase
      .from('manual_payment_submissions')
      .select(
        'id, contribution_id, fund_space_id, user_id, agent_id, status, transaction_reference, total_amount_paid, rejection_reason, created_at, reviewed_at'
      )
      .in('contribution_id', contributionIds)
      .in('status', ['PENDING_REVIEW', 'REJECTED'])
      .order('created_at', { ascending: false });

    if (submissionsError) {
      console.error('Manual payment submissions load error:', submissionsError);

      return errorResponse(
        'Unable to load MoMo verification submissions.',
        500
      );
    }

    return NextResponse.json({
      success: true,
      submissions: submissions || [],
    });
  } catch (error) {
    console.error('Agent manual submissions route error:', error);

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : 'Something went wrong while loading MoMo submissions.',
      },
      { status: 500 }
    );
  }
}