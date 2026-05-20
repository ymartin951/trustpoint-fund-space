import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

import type { Database } from '@/lib/supabase/database.types';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL');
}

if (!serviceRoleKey) {
  throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
}

const adminSupabase = createClient<Database>(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

type AdminNotificationFilter =
  | 'ALL'
  | 'UNREAD'
  | 'READ'
  | 'VERIFICATION'
  | 'PAYOUT'
  | 'CONTRIBUTION'
  | 'WITHDRAWAL'
  | 'FUND_SPACE';

type NotificationStats = {
  all: number;
  unread: number;
  read: number;
  verification: number;
  payout: number;
  contribution: number;
  withdrawal: number;
  fund_space: number;
};

type NotificationStatsRow = {
  is_read: boolean | null;
  type: string | null;
  related_entity_type: string | null;
  title?: string | null;
  message?: string | null;
};

function getBearerToken(request: Request) {
  const authHeader = request.headers.get('authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  return authHeader.replace('Bearer ', '').trim();
}

function isAdminRole(role?: string | null) {
  return role === 'ADMIN' || role === 'SUPER_ADMIN';
}

function normalizeFilter(value: string | null): AdminNotificationFilter {
  const filter = String(value || 'ALL').toUpperCase();

  if (
    filter === 'ALL' ||
    filter === 'UNREAD' ||
    filter === 'READ' ||
    filter === 'VERIFICATION' ||
    filter === 'PAYOUT' ||
    filter === 'CONTRIBUTION' ||
    filter === 'WITHDRAWAL' ||
    filter === 'FUND_SPACE'
  ) {
    return filter;
  }

  return 'ALL';
}

function normalizePositiveNumber(value: string | null, fallback: number) {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue) || numberValue <= 0) {
    return fallback;
  }

  return Math.floor(numberValue);
}

function getCombinedNotificationText(item: {
  type?: string | null;
  related_entity_type?: string | null;
  title?: string | null;
  message?: string | null;
}) {
  return `${item.type || ''} ${item.related_entity_type || ''} ${
    item.title || ''
  } ${item.message || ''}`.toUpperCase();
}

function notificationMatchesCategory(
  item: {
    type?: string | null;
    related_entity_type?: string | null;
    title?: string | null;
    message?: string | null;
  },
  category: Exclude<AdminNotificationFilter, 'ALL' | 'UNREAD' | 'READ'>
) {
  const value = getCombinedNotificationText(item);

  if (category === 'VERIFICATION') {
    return (
      value.includes('VERIFICATION') ||
      value.includes('RESUBMITTED') ||
      value.includes('CUSTOMER')
    );
  }

  if (category === 'PAYOUT') {
    return value.includes('PAYOUT');
  }

  if (category === 'CONTRIBUTION') {
    return value.includes('CONTRIBUTION') || value.includes('PAYMENT');
  }

  if (category === 'WITHDRAWAL') {
    return value.includes('WITHDRAWAL');
  }

  if (category === 'FUND_SPACE') {
    return (
      value.includes('FUND_SPACE') ||
      value.includes('FUND SPACE') ||
      value.includes('FUND-SPACE')
    );
  }

  return false;
}

function calculateStats(rows: NotificationStatsRow[]): NotificationStats {
  return {
    all: rows.length,
    unread: rows.filter((item) => item.is_read === false).length,
    read: rows.filter((item) => item.is_read === true).length,
    verification: rows.filter((item) =>
      notificationMatchesCategory(item, 'VERIFICATION')
    ).length,
    payout: rows.filter((item) => notificationMatchesCategory(item, 'PAYOUT'))
      .length,
    contribution: rows.filter((item) =>
      notificationMatchesCategory(item, 'CONTRIBUTION')
    ).length,
    withdrawal: rows.filter((item) =>
      notificationMatchesCategory(item, 'WITHDRAWAL')
    ).length,
    fund_space: rows.filter((item) =>
      notificationMatchesCategory(item, 'FUND_SPACE')
    ).length,
  };
}

async function getAdminFromRequest(request: Request) {
  const token = getBearerToken(request);

  if (!token) {
    return {
      error: NextResponse.json(
        { success: false, message: 'Unauthorized. Missing bearer token.' },
        { status: 401 }
      ),
      profile: null,
    };
  }

  const {
    data: { user },
    error: userError,
  } = await adminSupabase.auth.getUser(token);

  if (userError || !user) {
    return {
      error: NextResponse.json(
        { success: false, message: 'Unauthorized. Invalid session.' },
        { status: 401 }
      ),
      profile: null,
    };
  }

  const { data: profile, error: profileError } = await adminSupabase
    .from('profiles')
    .select('id, role, status, full_name, email')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return {
      error: NextResponse.json(
        { success: false, message: 'Admin profile not found.' },
        { status: 404 }
      ),
      profile: null,
    };
  }

  if (!isAdminRole(profile.role)) {
    return {
      error: NextResponse.json(
        { success: false, message: 'Admin access required.' },
        { status: 403 }
      ),
      profile: null,
    };
  }

  if (profile.status !== 'ACTIVE') {
    return {
      error: NextResponse.json(
        { success: false, message: 'Your admin account is not active.' },
        { status: 403 }
      ),
      profile: null,
    };
  }

  return {
    error: null,
    profile,
  };
}

export async function GET(request: Request) {
  try {
    const { error, profile } = await getAdminFromRequest(request);

    if (error || !profile) {
      return error;
    }

    const { searchParams } = new URL(request.url);

    const filter = normalizeFilter(searchParams.get('filter'));
    const page = normalizePositiveNumber(searchParams.get('page'), 1);
    const limit = Math.min(
      normalizePositiveNumber(searchParams.get('limit'), 20),
      100
    );

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data: statsData, error: statsError } = await adminSupabase
      .from('notifications')
      .select('is_read, type, related_entity_type, title, message')
      .eq('user_id', profile.id);

    if (statsError) {
      console.warn('Admin notification stats warning:', statsError.message);
    }

    const allStatsRows = (statsData || []) as NotificationStatsRow[];
    const stats = calculateStats(allStatsRows);

    if (
      filter === 'VERIFICATION' ||
      filter === 'PAYOUT' ||
      filter === 'CONTRIBUTION' ||
      filter === 'WITHDRAWAL' ||
      filter === 'FUND_SPACE'
    ) {
      const { data: categoryData, error: categoryError } = await adminSupabase
        .from('notifications')
        .select(
          `
          id,
          user_id,
          title,
          message,
          type,
          is_read,
          related_entity_id,
          related_entity_type,
          created_at
        `
        )
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false });

      if (categoryError) {
        console.error('Admin category notifications load error:', categoryError);

        return NextResponse.json(
          {
            success: false,
            message: categoryError.message || 'Failed to load notifications.',
          },
          { status: 500 }
        );
      }

      const filtered = (categoryData || []).filter((item) =>
        notificationMatchesCategory(item, filter)
      );

      const paged = filtered.slice(from, to + 1);

      return NextResponse.json({
        success: true,
        notifications: paged,
        stats,
        pagination: {
          page,
          limit,
          total: filtered.length,
          totalPages: Math.max(1, Math.ceil(filtered.length / limit)),
        },
      });
    }

    let query = adminSupabase
      .from('notifications')
      .select(
        `
        id,
        user_id,
        title,
        message,
        type,
        is_read,
        related_entity_id,
        related_entity_type,
        created_at
      `,
        { count: 'exact' }
      )
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false });

    if (filter === 'UNREAD') {
      query = query.eq('is_read', false);
    }

    if (filter === 'READ') {
      query = query.eq('is_read', true);
    }

    const { data: notifications, error: notificationsError, count } =
      await query.range(from, to);

    if (notificationsError) {
      console.error('Admin notifications load error:', notificationsError);

      return NextResponse.json(
        {
          success: false,
          message:
            notificationsError.message || 'Failed to load notifications.',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      notifications: notifications || [],
      stats,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.max(1, Math.ceil((count || 0) / limit)),
      },
    });
  } catch (error: unknown) {
    console.error('Admin notifications API error:', error);

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

export async function PATCH(request: Request) {
  try {
    const { error, profile } = await getAdminFromRequest(request);

    if (error || !profile) {
      return error;
    }

    const body = await request.json().catch(() => null);

    if (!body) {
      return NextResponse.json(
        { success: false, message: 'Invalid request body.' },
        { status: 400 }
      );
    }

    const action = String(body.action || '').toUpperCase();
    const notificationId = body.notification_id
      ? String(body.notification_id)
      : null;

    if (action === 'MARK_ONE_READ') {
      if (!notificationId) {
        return NextResponse.json(
          { success: false, message: 'Notification ID is required.' },
          { status: 400 }
        );
      }

      const { error: updateError } = await adminSupabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId)
        .eq('user_id', profile.id);

      if (updateError) {
        console.error('Mark admin notification read error:', updateError);

        return NextResponse.json(
          {
            success: false,
            message:
              updateError.message || 'Failed to mark notification as read.',
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Notification marked as read.',
      });
    }

    if (action === 'MARK_ALL_READ') {
      const { error: updateError } = await adminSupabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', profile.id)
        .eq('is_read', false);

      if (updateError) {
        console.error('Mark all admin notifications read error:', updateError);

        return NextResponse.json(
          {
            success: false,
            message:
              updateError.message ||
              'Failed to mark all notifications as read.',
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'All notifications marked as read.',
      });
    }

    return NextResponse.json(
      {
        success: false,
        message: 'Invalid action. Use MARK_ONE_READ or MARK_ALL_READ.',
      },
      { status: 400 }
    );
  } catch (error: unknown) {
    console.error('Admin notifications update API error:', error);

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