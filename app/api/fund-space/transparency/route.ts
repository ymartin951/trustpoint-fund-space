import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

type AppRole = 'USER' | 'AGENT' | 'ADMIN' | 'SUPER_ADMIN';

function getBearerToken(request: NextRequest) {
  const authHeader = request.headers.get('authorization') || '';
  const [scheme, token] = authHeader.split(' ');

  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return null;
  }

  return token;
}

function normalizeRole(role: string | null | undefined): AppRole {
  const value = String(role || '').trim().toUpperCase();

  if (value === 'SUPER_ADMIN') return 'SUPER_ADMIN';
  if (value === 'ADMIN') return 'ADMIN';
  if (value === 'AGENT') return 'AGENT';

  return 'USER';
}

function isAdminRole(role: AppRole) {
  return role === 'ADMIN' || role === 'SUPER_ADMIN';
}

export async function GET(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        {
          success: false,
          message: 'Server configuration is missing.',
        },
        { status: 500 }
      );
    }

    const token = getBearerToken(request);

    if (!token) {
      return NextResponse.json(
        {
          success: false,
          message: 'Unauthorized request. Please log in again.',
        },
        { status: 401 }
      );
    }

    const adminSupabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

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

    const { data: profile, error: profileError } = await adminSupabase
      .from('profiles')
      .select('id, full_name, phone, role, status')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError || !profile) {
      return NextResponse.json(
        {
          success: false,
          message: 'Could not verify your profile.',
        },
        { status: 403 }
      );
    }

    const role = normalizeRole(profile.role);
    const { searchParams } = new URL(request.url);
    const fundSpaceId = searchParams.get('fund_space_id');

    if (!fundSpaceId) {
      return NextResponse.json(
        {
          success: false,
          message: 'Fund Space ID is required.',
        },
        { status: 400 }
      );
    }

    if (!isAdminRole(role)) {
      const { data: membership } = await adminSupabase
        .from('fund_space_members')
        .select('id')
        .eq('fund_space_id', fundSpaceId)
        .eq('user_id', user.id)
        .maybeSingle();

      let allowed = Boolean(membership);

      if (!allowed && role === 'AGENT') {
        const { data: assignedCustomers } = await adminSupabase
          .from('agent_customers')
          .select('customer_id')
          .eq('agent_id', user.id);

        const customerIds =
          assignedCustomers?.map((item: any) => item.customer_id).filter(Boolean) || [];

        if (customerIds.length > 0) {
          const { data: customerMembership } = await adminSupabase
            .from('fund_space_members')
            .select('id')
            .eq('fund_space_id', fundSpaceId)
            .in('user_id', customerIds)
            .limit(1)
            .maybeSingle();

          allowed = Boolean(customerMembership);
        }
      }

      if (!allowed) {
        return NextResponse.json(
          {
            success: false,
            message: 'You are not allowed to view this Fund Space transparency record.',
          },
          { status: 403 }
        );
      }
    }

    const { data: transparency, error: transparencyError } = await adminSupabase
      .from('fund_space_transparency_dashboard')
      .select('*')
      .eq('fund_space_id', fundSpaceId)
      .maybeSingle();

    if (transparencyError) {
      return NextResponse.json(
        {
          success: false,
          message: transparencyError.message || 'Unable to load transparency summary.',
        },
        { status: 500 }
      );
    }

    if (!transparency) {
      return NextResponse.json(
        {
          success: false,
          message: 'Transparency record was not found for this Fund Space.',
        },
        { status: 404 }
      );
    }

    const currentRoundNumber = Number(transparency.current_round_number || 0);

    const { data: currentMembers, error: membersError } = await adminSupabase
      .from('fund_space_round_member_transparency')
      .select('*')
      .eq('fund_space_id', fundSpaceId)
      .eq('round_number', currentRoundNumber)
      .order('payout_order', { ascending: true });

    if (membersError) {
      return NextResponse.json(
        {
          success: false,
          message: membersError.message || 'Unable to load member transparency records.',
        },
        { status: 500 }
      );
    }

    const { data: roundHistory, error: historyError } = await adminSupabase
      .from('fund_space_round_member_transparency')
      .select(
        `
        round_id,
        round_number,
        round_status,
        week_start_date,
        contribution_deadline,
        week_end_date,
        is_current_payout_recipient,
        full_name,
        phone,
        contribution_status,
        amount_due,
        amount_paid,
        payment_timing,
        is_late,
        late_fee_amount,
        late_fee_status
        `
      )
      .eq('fund_space_id', fundSpaceId)
      .order('round_number', { ascending: false })
      .order('payout_order', { ascending: true });

    if (historyError) {
      return NextResponse.json(
        {
          success: false,
          message: historyError.message || 'Unable to load round history.',
        },
        { status: 500 }
      );
    }

    const groupedHistory = Object.values(
      (roundHistory || []).reduce((acc: Record<string, any>, row: any) => {
        const key = String(row.round_number || 'unknown');

        if (!acc[key]) {
          acc[key] = {
            round_id: row.round_id,
            round_number: row.round_number,
            round_status: row.round_status,
            week_start_date: row.week_start_date,
            contribution_deadline: row.contribution_deadline,
            week_end_date: row.week_end_date,
            recipient_name: null,
            recipient_phone: null,
            total_members: 0,
            paid_members: 0,
            unpaid_members: 0,
            late_members: 0,
            total_due: 0,
            total_paid: 0,
            members: [],
          };
        }

        if (row.is_current_payout_recipient) {
          acc[key].recipient_name = row.full_name;
          acc[key].recipient_phone = row.phone;
        }

        acc[key].total_members += 1;

        if (String(row.contribution_status || '').toUpperCase() === 'PAID') {
          acc[key].paid_members += 1;
        } else {
          acc[key].unpaid_members += 1;
        }

        if (row.is_late) {
          acc[key].late_members += 1;
        }

        acc[key].total_due += Number(row.amount_due || 0);
        acc[key].total_paid += Number(row.amount_paid || 0);
        acc[key].members.push(row);

        return acc;
      }, {})
    );

    return NextResponse.json({
      success: true,
      profile,
      role,
      transparency,
      current_members: currentMembers || [],
      round_history: groupedHistory,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : 'Something went wrong while loading transparency dashboard.',
      },
      { status: 500 }
    );
  }
}