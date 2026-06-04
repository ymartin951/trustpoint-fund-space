import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

type PenaltyAction = 'APPLY_ROUND_FEES' | 'WAIVE_LATE_FEE' | 'MARK_LATE_FEE_PAID';

type ActionBody = {
  action?: PenaltyAction | string;
  round_id?: string;
  contribution_id?: string;
  reason?: string;
};

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
    const status = cleanText(searchParams.get('status')).toUpperCase();
    const lateFeeStatus = cleanText(searchParams.get('late_fee_status')).toUpperCase();
    const search = cleanText(searchParams.get('search')).toLowerCase();

    let query = serviceSupabase
      .from('fund_space_contributions')
      .select(
        `
        id,
        fund_space_id,
        round_id,
        user_id,
        amount_due,
        amount_paid,
        status,
        payment_method,
        payment_reference,
        paid_at,
        confirmed_by,
        created_at,
        updated_at,
        payment_timing,
        is_late,
        late_fee_amount,
        late_fee_status,
        late_fee_paid_at,
        late_fee_waived_by,
        late_fee_waived_at,
        late_fee_waiver_reason,
        penalty_applied_at,
        penalty_applied_by
      `
      )
      .order('created_at', { ascending: false });

    if (
      ['PENDING', 'PARTIALLY_PAID', 'PAID', 'LATE', 'MISSED', 'WAIVED'].includes(
        status
      )
    ) {
      query = query.eq('status', status);
    }

    if (['NONE', 'APPLIED', 'PAID', 'WAIVED'].includes(lateFeeStatus)) {
      query = query.eq('late_fee_status', lateFeeStatus);
    }

    const { data: contributions, error: contributionError } = await query;

    if (contributionError) {
      return errorResponse(
        contributionError.message || 'Unable to load penalty records.',
        500
      );
    }

    const userIds = Array.from(
      new Set(
        (contributions || [])
          .map((item) => item.user_id)
          .filter(Boolean)
      )
    );

    const fundSpaceIds = Array.from(
      new Set(
        (contributions || [])
          .map((item) => item.fund_space_id)
          .filter(Boolean)
      )
    );

    const roundIds = Array.from(
      new Set(
        (contributions || [])
          .map((item) => item.round_id)
          .filter(Boolean)
      )
    );

    const adminIds = Array.from(
      new Set(
        (contributions || [])
          .flatMap((item) => [
            item.confirmed_by,
            item.late_fee_waived_by,
            item.penalty_applied_by,
          ])
          .filter(Boolean)
      )
    );

    const profileIds = Array.from(new Set([...userIds, ...adminIds]));

    const [profilesResult, fundSpacesResult, roundsResult] = await Promise.all([
      profileIds.length
        ? serviceSupabase
            .from('profiles')
            .select('id, full_name, phone, email, role, status, verification_status')
            .in('id', profileIds)
        : Promise.resolve({ data: [], error: null }),

      fundSpaceIds.length
        ? serviceSupabase
            .from('fund_spaces')
            .select('id, name, contribution_amount, status, current_round_number')
            .in('id', fundSpaceIds)
        : Promise.resolve({ data: [], error: null }),

      roundIds.length
        ? serviceSupabase
            .from('fund_space_rounds')
            .select(
              'id, fund_space_id, round_number, contribution_deadline, week_start_date, week_end_date, status'
            )
            .in('id', roundIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (profilesResult.error) {
      return errorResponse(profilesResult.error.message, 500);
    }

    if (fundSpacesResult.error) {
      return errorResponse(fundSpacesResult.error.message, 500);
    }

    if (roundsResult.error) {
      return errorResponse(roundsResult.error.message, 500);
    }

    const profileMap = new Map(
      (profilesResult.data || []).map((item) => [item.id, item])
    );

    const fundSpaceMap = new Map(
      (fundSpacesResult.data || []).map((item) => [item.id, item])
    );

    const roundMap = new Map(
      (roundsResult.data || []).map((item) => [item.id, item])
    );

    const records = (contributions || []).map((contribution) => ({
      ...contribution,
      member: profileMap.get(contribution.user_id) || null,
      fund_space: fundSpaceMap.get(contribution.fund_space_id) || null,
      round: roundMap.get(contribution.round_id) || null,
      confirmed_by_profile: contribution.confirmed_by
        ? profileMap.get(contribution.confirmed_by) || null
        : null,
      waived_by_profile: contribution.late_fee_waived_by
        ? profileMap.get(contribution.late_fee_waived_by) || null
        : null,
      penalty_applied_by_profile: contribution.penalty_applied_by
        ? profileMap.get(contribution.penalty_applied_by) || null
        : null,
    }));

    const filteredRecords = search
      ? records.filter((record) => {
          const haystack = [
            record.member?.full_name,
            record.member?.phone,
            record.member?.email,
            record.fund_space?.name,
            record.round?.round_number ? `round ${record.round.round_number}` : '',
            record.status,
            record.payment_timing,
            record.late_fee_status,
            record.payment_reference,
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();

          return haystack.includes(search);
        })
      : records;

    const stats = {
      total: records.length,
      pending: records.filter((item) =>
        ['PENDING', 'PARTIALLY_PAID'].includes(String(item.status).toUpperCase())
      ).length,
      paid: records.filter((item) => String(item.status).toUpperCase() === 'PAID')
        .length,
      late: records.filter((item) => String(item.payment_timing).toUpperCase() === 'LATE')
        .length,
      missed: records.filter((item) => String(item.status).toUpperCase() === 'MISSED')
        .length,
      late_fee_applied: records.filter(
        (item) => String(item.late_fee_status).toUpperCase() === 'APPLIED'
      ).length,
      late_fee_paid: records.filter(
        (item) => String(item.late_fee_status).toUpperCase() === 'PAID'
      ).length,
      late_fee_waived: records.filter(
        (item) => String(item.late_fee_status).toUpperCase() === 'WAIVED'
      ).length,
      total_late_fee_value: records.reduce(
        (sum, item) => sum + Number(item.late_fee_amount || 0),
        0
      ),
      unpaid_late_fee_value: records
        .filter((item) => String(item.late_fee_status).toUpperCase() === 'APPLIED')
        .reduce((sum, item) => sum + Number(item.late_fee_amount || 0), 0),
    };

    const uniqueRounds = Array.from(
      new Map(
        records
          .filter((item) => item.round)
          .map((item) => [
            item.round_id,
            {
              id: item.round_id,
              round_number: item.round?.round_number || null,
              contribution_deadline: item.round?.contribution_deadline || null,
              status: item.round?.status || null,
              fund_space_name: item.fund_space?.name || 'Fund Space',
              fund_space_id: item.fund_space_id,
            },
          ])
      ).values()
    );

    return NextResponse.json({
      success: true,
      records: filteredRecords,
      stats,
      rounds: uniqueRounds,
    });
  } catch (error) {
    console.error('Admin penalties GET error:', error);

    return errorResponse(
      error instanceof Error ? error.message : 'Unable to load penalty records.',
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

    const body = (await request.json().catch(() => null)) as ActionBody | null;

    if (!body) {
      return errorResponse('Invalid request body.');
    }

    const action = cleanText(body.action).toUpperCase();
    const rpcClient = serviceSupabase as any;

    if (action === 'APPLY_ROUND_FEES') {
      const roundId = cleanText(body.round_id);

      if (!roundId) {
        return errorResponse('Round ID is required.');
      }

      const { data, error } = await rpcClient.rpc('apply_late_fees_for_round', {
        p_round_id: roundId,
        p_admin_id: auth.user.id,
      });

      if (error) {
        return errorResponse(error.message || 'Unable to apply late fees.', 500);
      }

      return NextResponse.json({
        success: true,
        message: data?.message || 'Late fees applied successfully.',
        result: data,
      });
    }

    if (action === 'WAIVE_LATE_FEE') {
      const contributionId = cleanText(body.contribution_id);
      const reason = cleanText(body.reason);

      if (!contributionId) {
        return errorResponse('Contribution ID is required.');
      }

      if (!reason) {
        return errorResponse('Waiver reason is required.');
      }

      const { data, error } = await rpcClient.rpc('waive_contribution_late_fee', {
        p_contribution_id: contributionId,
        p_admin_id: auth.user.id,
        p_reason: reason,
      });

      if (error) {
        return errorResponse(error.message || 'Unable to waive late fee.', 500);
      }

      return NextResponse.json({
        success: true,
        message: data?.message || 'Late fee waived successfully.',
        result: data,
      });
    }

    if (action === 'MARK_LATE_FEE_PAID') {
      const contributionId = cleanText(body.contribution_id);

      if (!contributionId) {
        return errorResponse('Contribution ID is required.');
      }

      const { data, error } = await rpcClient.rpc(
        'mark_contribution_late_fee_paid',
        {
          p_contribution_id: contributionId,
          p_admin_id: auth.user.id,
        }
      );

      if (error) {
        return errorResponse(
          error.message || 'Unable to mark late fee as paid.',
          500
        );
      }

      return NextResponse.json({
        success: true,
        message: data?.message || 'Late fee marked as paid successfully.',
        result: data,
      });
    }

    return errorResponse('Unknown penalty action.');
  } catch (error) {
    console.error('Admin penalties POST error:', error);

    return errorResponse(
      error instanceof Error ? error.message : 'Unable to complete penalty action.',
      500
    );
  }
}