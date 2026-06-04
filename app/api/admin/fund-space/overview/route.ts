import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

type FundSpaceOverviewRow = {
  id: string | null;
  name: string | null;
  status: string | null;
  contribution_amount: number | null;
  created_at: string | null;
  current_round_number: number | null;
  defaulted_members: number | null;
  member_count: number | null;
  member_limit: number | null;
  members_paid_out: number | null;
  start_date: string | null;
};

type OverviewStats = {
  total_groups: number;
  forming_groups: number;
  active_groups: number;
  completed_groups: number;
  paused_groups: number;
  total_members: number;
  defaulted_members: number;
  members_paid_out: number;
  expected_weekly_volume: number;
};

type AdminFundSpaceAction =
  | 'SEND_DEADLINE_REMINDERS'
  | 'PROCESS_DUE_ROUNDS'
  | 'CHECK_ROUND_READY_FOR_PAYOUT'
  | 'START_NEXT_ROUND';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL');
}

if (!serviceRoleKey) {
  throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
}

const adminSupabase = createSupabaseClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

function getBearerToken(request: NextRequest) {
  const authHeader = request.headers.get('authorization') || '';
  const [scheme, token] = authHeader.split(' ');

  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return null;
  }

  return token;
}

function normalizeRole(role: string | null | undefined) {
  return String(role || '')
    .trim()
    .toUpperCase()
    .replaceAll(' ', '_')
    .replaceAll('-', '_');
}

function isAdminRole(role: string | null | undefined) {
  const normalizedRole = normalizeRole(role);

  return normalizedRole === 'ADMIN' || normalizedRole === 'SUPER_ADMIN';
}

function calculateStats(rows: FundSpaceOverviewRow[]): OverviewStats {
  return rows.reduce<OverviewStats>(
    (stats, row) => {
      const status = String(row.status || 'FORMING').toUpperCase();
      const memberCount = Number(row.member_count || 0);
      const defaultedMembers = Number(row.defaulted_members || 0);
      const membersPaidOut = Number(row.members_paid_out || 0);
      const contributionAmount = Number(row.contribution_amount || 0);

      stats.total_groups += 1;
      stats.total_members += memberCount;
      stats.defaulted_members += defaultedMembers;
      stats.members_paid_out += membersPaidOut;
      stats.expected_weekly_volume += contributionAmount * memberCount;

      if (status === 'FORMING') stats.forming_groups += 1;
      if (status === 'ACTIVE') stats.active_groups += 1;
      if (status === 'COMPLETED') stats.completed_groups += 1;
      if (status === 'PAUSED') stats.paused_groups += 1;

      return stats;
    },
    {
      total_groups: 0,
      forming_groups: 0,
      active_groups: 0,
      completed_groups: 0,
      paused_groups: 0,
      total_members: 0,
      defaulted_members: 0,
      members_paid_out: 0,
      expected_weekly_volume: 0,
    }
  );
}

async function requireAdmin(request: NextRequest) {
  const token = getBearerToken(request);

  if (!token) {
    return {
      profile: null,
      errorResponse: NextResponse.json(
        {
          success: false,
          message: 'Unauthorized. Please log in again.',
        },
        { status: 401 }
      ),
    };
  }

  const {
    data: { user },
    error: userError,
  } = await adminSupabase.auth.getUser(token);

  if (userError || !user) {
    return {
      profile: null,
      errorResponse: NextResponse.json(
        {
          success: false,
          message: 'Unauthorized. Please log in again.',
        },
        { status: 401 }
      ),
    };
  }

  const { data: profile, error: profileError } = await adminSupabase
    .from('profiles')
    .select('id, full_name, email, phone, role, status')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) {
    return {
      profile: null,
      errorResponse: NextResponse.json(
        {
          success: false,
          message:
            profileError.message || 'Unable to verify admin profile.',
        },
        { status: 500 }
      ),
    };
  }

  if (!profile) {
    return {
      profile: null,
      errorResponse: NextResponse.json(
        {
          success: false,
          message:
            'No profile record was found for the logged-in account. Please make sure this auth user exists in the profiles table.',
          user_id: user.id,
          user_email: user.email,
        },
        { status: 403 }
      ),
    };
  }

  if (!isAdminRole(profile.role)) {
    return {
      profile: null,
      errorResponse: NextResponse.json(
        {
          success: false,
          message: `Access denied. Admin account required. Current role: ${profile.role}`,
        },
        { status: 403 }
      ),
    };
  }

  return {
    profile,
    errorResponse: null,
  };
}

export async function GET(request: NextRequest) {
  try {
    const { errorResponse } = await requireAdmin(request);

    if (errorResponse) {
      return errorResponse;
    }

    const { data, error } = await adminSupabase
      .from('admin_fund_space_overview')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json(
        {
          success: false,
          message: error.message || 'Unable to load Fund Space overview.',
        },
        { status: 500 }
      );
    }

    const rows = (data || []) as FundSpaceOverviewRow[];

    return NextResponse.json({
      success: true,
      data: rows,
      stats: calculateStats(rows),
    });
  } catch (error) {
    console.error('Admin Fund Space overview API error:', error);

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : 'Unable to load Fund Space overview.',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { errorResponse } = await requireAdmin(request);

    if (errorResponse) {
      return errorResponse;
    }

    const body = await request.json().catch(() => ({}));

    const action = String(body.action || '').toUpperCase() as AdminFundSpaceAction;
    const roundId = String(body.round_id || '').trim();
    const fundSpaceId = String(body.fund_space_id || '').trim();

    const rpcClient = adminSupabase as any;

    if (action === 'SEND_DEADLINE_REMINDERS') {
      const { data, error } = await rpcClient.rpc(
        'send_fund_space_deadline_reminders',
        {
          p_round_id: roundId || undefined,
        }
      );

      if (error) {
        return NextResponse.json(
          {
            success: false,
            message: error.message || 'Unable to send deadline reminders.',
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Deadline reminders processed successfully.',
        data,
      });
    }

    if (action === 'PROCESS_DUE_ROUNDS') {
      const { data, error } = await rpcClient.rpc(
        'process_due_fund_space_rounds'
      );

      if (error) {
        return NextResponse.json(
          {
            success: false,
            message: error.message || 'Unable to process due rounds.',
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Due rounds processed successfully.',
        data,
      });
    }

    if (action === 'CHECK_ROUND_READY_FOR_PAYOUT') {
      if (!roundId) {
        return NextResponse.json(
          {
            success: false,
            message: 'round_id is required to check payout readiness.',
          },
          { status: 400 }
        );
      }

      const { data, error } = await rpcClient.rpc(
        'check_round_ready_for_payout',
        {
          p_round_id: roundId,
        }
      );

      if (error) {
        return NextResponse.json(
          {
            success: false,
            message:
              error.message || 'Unable to check round payout readiness.',
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Round payout readiness checked successfully.',
        data,
      });
    }

    if (action === 'START_NEXT_ROUND') {
      if (!fundSpaceId) {
        return NextResponse.json(
          {
            success: false,
            message: 'fund_space_id is required to start the next round.',
          },
          { status: 400 }
        );
      }

      const { data, error } = await rpcClient.rpc(
        'start_next_fund_space_round',
        {
          p_fund_space_id: fundSpaceId,
        }
      );

      if (error) {
        return NextResponse.json(
          {
            success: false,
            message: error.message || 'Unable to start next Fund Space round.',
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Next round started successfully.',
        data,
      });
    }

    return NextResponse.json(
      {
        success: false,
        message:
          'Unsupported action. Use SEND_DEADLINE_REMINDERS, PROCESS_DUE_ROUNDS, CHECK_ROUND_READY_FOR_PAYOUT, or START_NEXT_ROUND.',
      },
      { status: 400 }
    );
  } catch (error) {
    console.error('Admin Fund Space action API error:', error);

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : 'Unable to process Fund Space admin action.',
      },
      { status: 500 }
    );
  }
}