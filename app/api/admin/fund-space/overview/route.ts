import { NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/supabase/database.types';

type FundSpaceOverviewRow =
  Database['public']['Views']['admin_fund_space_overview']['Row'];

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

function isAdminRole(role: string | null | undefined) {
  return role === 'ADMIN' || role === 'SUPER_ADMIN';
}

function calculateStats(rows: FundSpaceOverviewRow[]): OverviewStats {
  return rows.reduce<OverviewStats>(
    (stats, row) => {
      const status = row.status || 'FORMING';
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

export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized. Please log in again.' },
        { status: 401 }
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, role, status')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      return NextResponse.json(
        {
          success: false,
          message: profileError.message || 'Unable to verify admin profile.',
        },
        { status: 500 }
      );
    }

    if (!profile || !isAdminRole(profile.role)) {
      return NextResponse.json(
        {
          success: false,
          message: 'Access denied. Admin account required.',
        },
        { status: 403 }
      );
    }

    const { data, error } = await supabase
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
  } catch (error: unknown) {
    console.error('Admin Fund Space overview API error:', error);

    const message =
      error instanceof Error
        ? error.message
        : 'Unable to load Fund Space overview.';

    return NextResponse.json(
      {
        success: false,
        message,
      },
      { status: 500 }
    );
  }
}