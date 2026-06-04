import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

import type { Database } from '@/lib/database.types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ManualSubmissionActionBody = {
  submission_id?: string;
  action?: 'APPROVE' | 'REJECT';
  rejection_reason?: string;
};

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

function createUserClient(accessToken: string) {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;

  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL is not configured.'
    );
  }

  if (!anonKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is not configured.');
  }

  return createClient<Database>(supabaseUrl, anonKey, {
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

function errorResponse(message: string, status = 400) {
  return NextResponse.json(
    {
      success: false,
      message,
    },
    { status }
  );
}

function normalizeText(value: string | null | undefined) {
  return value?.trim() || '';
}

function getAccessToken(request: NextRequest) {
  const authorizationHeader =
    request.headers.get('authorization') ||
    request.headers.get('Authorization');

  if (!authorizationHeader?.startsWith('Bearer ')) {
    return '';
  }

  return authorizationHeader.replace('Bearer ', '').trim();
}

function isAdminRole(role: string | null | undefined) {
  const value = String(role || '').toUpperCase();

  return value === 'ADMIN' || value === 'SUPER_ADMIN';
}

async function getAuthenticatedAdmin(request: NextRequest) {
  const accessToken = getAccessToken(request);

  if (!accessToken) {
    return {
      accessToken: '',
      userSupabase: null,
      user: null,
      response: errorResponse('Unauthorized request. Please log in again.', 401),
    };
  }

  const userSupabase = createUserClient(accessToken);

  const {
    data: { user },
    error: userError,
  } = await userSupabase.auth.getUser(accessToken);

  if (userError || !user) {
    return {
      accessToken,
      userSupabase,
      user: null,
      response: errorResponse('Your session has expired. Please log in again.', 401),
    };
  }

  const serviceSupabase = createServiceClient();

  const { data: profile, error: profileError } = await serviceSupabase
    .from('profiles')
    .select('id, role, status, is_blacklisted')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) {
    console.error('Admin profile lookup error:', profileError);

    return {
      accessToken,
      userSupabase,
      user,
      response: errorResponse('Unable to verify admin profile.', 500),
    };
  }

  if (!profile) {
    return {
      accessToken,
      userSupabase,
      user,
      response: errorResponse('Admin profile not found.', 404),
    };
  }

  if (!isAdminRole(profile.role)) {
    return {
      accessToken,
      userSupabase,
      user,
      response: errorResponse('Only admins can manage manual payment submissions.', 403),
    };
  }

  if (profile.status !== 'ACTIVE') {
    return {
      accessToken,
      userSupabase,
      user,
      response: errorResponse('Your admin account must be active.', 403),
    };
  }

  if (profile.is_blacklisted) {
    return {
      accessToken,
      userSupabase,
      user,
      response: errorResponse('This admin account cannot manage submissions.', 403),
    };
  }

  return {
    accessToken,
    userSupabase,
    user,
    response: null,
  };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedAdmin(request);

    if (auth.response) {
      return auth.response;
    }

    const status = normalizeText(request.nextUrl.searchParams.get('status'));
    const search = normalizeText(request.nextUrl.searchParams.get('search')).toLowerCase();

    const supabase = createServiceClient();

    let query = supabase
      .from('manual_payment_submissions')
      .select(
        `
        *,
        customer:profiles!manual_payment_submissions_user_id_fkey (
          id,
          full_name,
          phone,
          email
        ),
        agent:profiles!manual_payment_submissions_agent_id_fkey (
          id,
          full_name,
          phone,
          email
        ),
        fund_space:fund_spaces (
          id,
          name,
          contribution_amount,
          status
        ),
        round:fund_space_rounds (
          id,
          round_number,
          contribution_deadline,
          status
        ),
        company_account:company_payment_accounts (
          id,
          account_name,
          provider,
          network,
          merchant_number,
          merchant_id
        )
      `
      )
      .order('created_at', { ascending: false })
      .limit(500);

    if (status && status !== 'ALL') {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Manual payment submissions load error:', error);

      return errorResponse('Unable to load manual payment submissions.', 500);
    }

    const submissions = (data || []).filter((item) => {
      if (!search) return true;

      const values = [
        item.transaction_reference,
        item.sender_name,
        item.sender_phone,
        item.status,
        item.customer?.full_name,
        item.customer?.phone,
        item.agent?.full_name,
        item.fund_space?.name,
        item.company_account?.merchant_number,
      ];

      return values.some((value) =>
        String(value || '').toLowerCase().includes(search)
      );
    });

    const summary = submissions.reduce(
      (acc, item) => {
        acc.total += 1;
        acc.total_amount += Number(item.total_amount_paid || 0);

        if (item.status === 'PENDING_REVIEW') acc.pending += 1;
        if (item.status === 'APPROVED') acc.approved += 1;
        if (item.status === 'REJECTED') acc.rejected += 1;

        return acc;
      },
      {
        total: 0,
        pending: 0,
        approved: 0,
        rejected: 0,
        total_amount: 0,
      }
    );

    return NextResponse.json({
      success: true,
      message: 'Manual payment submissions loaded successfully.',
      summary,
      submissions,
    });
  } catch (error) {
    console.error('Manual payment submissions GET error:', error);

    const message =
      error instanceof Error
        ? error.message
        : 'Something went wrong while loading submissions.';

    return NextResponse.json(
      {
        success: false,
        message,
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedAdmin(request);

    if (auth.response) {
      return auth.response;
    }

    if (!auth.user) {
      return errorResponse('Unable to verify admin session.', 401);
    }

    const body = (await request.json()) as ManualSubmissionActionBody;

    const submissionId = normalizeText(body.submission_id);
    const action = normalizeText(body.action).toUpperCase();

    if (!submissionId) {
      return errorResponse('Submission ID is required.');
    }

    if (!['APPROVE', 'REJECT'].includes(action)) {
      return errorResponse('Action must be APPROVE or REJECT.');
    }

    const supabase = createServiceClient();

    const { data: submission, error: submissionError } = await supabase
      .from('manual_payment_submissions')
      .select(
        `
        id,
        contribution_id,
        fund_space_id,
        round_id,
        user_id,
        agent_id,
        status,
        transaction_reference,
        total_amount_paid,
        sender_name,
        sender_phone,
        sender_network,
        payment_note,
        screenshot_url,
        created_at
      `
      )
      .eq('id', submissionId)
      .maybeSingle();

    if (submissionError) {
      console.error('Manual payment submission lookup error:', submissionError);

      return errorResponse(
        submissionError.message || 'Unable to load payment submission.',
        500
      );
    }

    if (!submission) {
      return errorResponse('Manual payment submission not found.', 404);
    }

    if (submission.status !== 'PENDING_REVIEW') {
      return errorResponse(
        `This submission has already been ${String(
          submission.status || 'processed'
        ).toLowerCase()}.`,
        409
      );
    }

    const paymentAmount = Number(submission.total_amount_paid || 0);

    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
      return errorResponse(
        'Payment amount must be greater than zero. The manual payment submission has no valid total_amount_paid value.',
        400
      );
    }

    if (action === 'APPROVE') {
      const rpcClient = supabase as any;

      const { data, error } = await rpcClient.rpc(
  'approve_manual_fund_space_payment_submission',
  {
    p_submission_id: submission.id,
    p_admin_id: auth.user.id,
  }
);

      if (error) {
        console.error('Approve manual payment submission RPC error:', {
          error,
          submission_id: submission.id,
          contribution_id: submission.contribution_id,
          total_amount_paid: submission.total_amount_paid,
          parsed_payment_amount: paymentAmount,
        });

        return errorResponse(
          error.message || 'Unable to approve payment submission.',
          500
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Payment submission approved successfully.',
        result: data,
      });
    }

    const reason = normalizeText(body.rejection_reason);

    if (!reason) {
      return errorResponse('Rejection reason is required.');
    }

    const rpcClient = supabase as any;

    const { data, error } = await rpcClient.rpc(
      'reject_manual_fund_space_payment_submission',
      {
        p_submission_id: submission.id,
        p_reason: reason,
      }
    );

    if (error) {
      console.error('Reject manual payment submission RPC error:', error);

      return errorResponse(
        error.message || 'Unable to reject payment submission.',
        500
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Payment submission rejected successfully.',
      result: data,
    });
  } catch (error) {
    console.error('Manual payment submissions POST error:', error);

    const message =
      error instanceof Error
        ? error.message
        : 'Something went wrong while processing submission.';

    return NextResponse.json(
      {
        success: false,
        message,
      },
      { status: 500 }
    );
  }
}