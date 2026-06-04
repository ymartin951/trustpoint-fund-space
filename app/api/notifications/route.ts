import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

type NotificationFilter =
  | 'ALL'
  | 'UNREAD'
  | 'READ'
  | 'FUND_SPACE'
  | 'AGENT'
  | 'PAYMENT'
  | 'VERIFICATION'
  | 'GENERAL';

type ProfileRow = {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  role: string | null;
  status: string | null;
};

type NotificationRow = {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  related_entity_id: string | null;
  related_entity_type: string | null;
  created_at: string | null;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL');
}

if (!serviceRoleKey) {
  throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
}

const adminSupabase = createClient(supabaseUrl, serviceRoleKey, {
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
  const value = normalizeRole(role);
  return value === 'ADMIN' || value === 'SUPER_ADMIN';
}

function normalizeFilter(value: string | null): NotificationFilter {
  const filter = String(value || 'ALL').toUpperCase();

  const allowed: NotificationFilter[] = [
    'ALL',
    'UNREAD',
    'READ',
    'FUND_SPACE',
    'AGENT',
    'PAYMENT',
    'VERIFICATION',
    'GENERAL',
  ];

  return allowed.includes(filter as NotificationFilter)
    ? (filter as NotificationFilter)
    : 'ALL';
}

function getNotificationCategory(notification: NotificationRow): NotificationFilter {
  const combined = `${notification.type || ''} ${notification.title || ''} ${
    notification.message || ''
  } ${notification.related_entity_type || ''}`.toUpperCase();

  if (
    combined.includes('AGENT') ||
    combined.includes('CUSTOMER_APPROVED') ||
    combined.includes('CUSTOMER_REGISTERED') ||
    combined.includes('AGENT_CUSTOMER')
  ) {
    return 'AGENT';
  }

  if (
    combined.includes('FUND_SPACE') ||
    combined.includes('FUND SPACE') ||
    combined.includes('ROUND') ||
    combined.includes('CONTRIBUTION')
  ) {
    return 'FUND_SPACE';
  }

  if (
    combined.includes('PAYMENT') ||
    combined.includes('MOMO') ||
    combined.includes('TRANSACTION') ||
    combined.includes('PAYOUT')
  ) {
    return 'PAYMENT';
  }

  if (
    combined.includes('VERIFICATION') ||
    combined.includes('KYC') ||
    combined.includes('APPROVED') ||
    combined.includes('REJECTED')
  ) {
    return 'VERIFICATION';
  }

  return 'GENERAL';
}

function matchesFilter(notification: NotificationRow, filter: NotificationFilter) {
  if (filter === 'ALL') return true;
  if (filter === 'UNREAD') return notification.is_read === false;
  if (filter === 'READ') return notification.is_read === true;

  return getNotificationCategory(notification) === filter;
}

function matchesSearch(notification: NotificationRow, search: string) {
  if (!search.trim()) return true;

  const value = search.trim().toLowerCase();

  const haystack = [
    notification.title,
    notification.message,
    notification.type,
    notification.related_entity_type,
    notification.related_entity_id,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return haystack.includes(value);
}

async function requireUser(request: NextRequest) {
  const token = getBearerToken(request);

  if (!token) {
    return {
      user: null,
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
      user: null,
      profile: null,
      errorResponse: NextResponse.json(
        {
          success: false,
          message: 'Your session has expired. Please log in again.',
        },
        { status: 401 }
      ),
    };
  }

  const { data: profile, error: profileError } = await adminSupabase
    .from('profiles')
    .select('id, full_name, phone, email, role, status')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) {
    return {
      user,
      profile: null,
      errorResponse: NextResponse.json(
        {
          success: false,
          message: profileError.message || 'Unable to load your profile.',
        },
        { status: 500 }
      ),
    };
  }

  if (!profile) {
    return {
      user,
      profile: null,
      errorResponse: NextResponse.json(
        {
          success: false,
          message:
            'No profile record was found for this account. Please contact support.',
        },
        { status: 403 }
      ),
    };
  }

  return {
    user,
    profile: profile as ProfileRow,
    errorResponse: null,
  };
}

function calculateStats(notifications: NotificationRow[]) {
  return {
    total: notifications.length,
    unread: notifications.filter((item) => item.is_read === false).length,
    read: notifications.filter((item) => item.is_read === true).length,
    fund_space: notifications.filter(
      (item) => getNotificationCategory(item) === 'FUND_SPACE'
    ).length,
    agent: notifications.filter((item) => getNotificationCategory(item) === 'AGENT')
      .length,
    payment: notifications.filter(
      (item) => getNotificationCategory(item) === 'PAYMENT'
    ).length,
    verification: notifications.filter(
      (item) => getNotificationCategory(item) === 'VERIFICATION'
    ).length,
    general: notifications.filter(
      (item) => getNotificationCategory(item) === 'GENERAL'
    ).length,
  };
}

export async function GET(request: NextRequest) {
  try {
    const { profile, errorResponse } = await requireUser(request);

    if (errorResponse || !profile) {
      return errorResponse;
    }

    const { searchParams } = new URL(request.url);
    const filter = normalizeFilter(searchParams.get('filter'));
    const search = String(searchParams.get('search') || '').trim();

    const { data, error } = await adminSupabase
      .from('notifications')
      .select(
        'id, user_id, title, message, type, is_read, related_entity_id, related_entity_type, created_at'
      )
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) {
      return NextResponse.json(
        {
          success: false,
          message: error.message || 'Unable to load notifications.',
        },
        { status: 500 }
      );
    }

    const notifications = (data || []) as NotificationRow[];

    const filtered = notifications
      .filter((item) => matchesFilter(item, filter))
      .filter((item) => matchesSearch(item, search))
      .map((item) => ({
        ...item,
        category: getNotificationCategory(item),
      }));

    return NextResponse.json({
      success: true,
      profile: {
        id: profile.id,
        role: profile.role,
        full_name: profile.full_name,
      },
      stats: calculateStats(notifications),
      notifications: filtered,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : 'Something went wrong while loading notifications.',
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { profile, errorResponse } = await requireUser(request);

    if (errorResponse || !profile) {
      return errorResponse;
    }

    const body = await request.json().catch(() => ({}));

    const action = String(body.action || '').toUpperCase();
    const notificationId = String(body.notification_id || '');

    if (action === 'MARK_ALL_READ') {
      const { error } = await adminSupabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', profile.id)
        .eq('is_read', false);

      if (error) {
        return NextResponse.json(
          {
            success: false,
            message: error.message || 'Unable to mark notifications as read.',
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'All notifications marked as read.',
      });
    }

    if (action === 'MARK_ONE_READ') {
      if (!notificationId) {
        return NextResponse.json(
          {
            success: false,
            message: 'notification_id is required.',
          },
          { status: 400 }
        );
      }

      const { error } = await adminSupabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId)
        .eq('user_id', profile.id);

      if (error) {
        return NextResponse.json(
          {
            success: false,
            message: error.message || 'Unable to mark notification as read.',
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Notification marked as read.',
      });
    }

    return NextResponse.json(
      {
        success: false,
        message: 'Unsupported notification action.',
      },
      { status: 400 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : 'Something went wrong while updating notifications.',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { profile, errorResponse } = await requireUser(request);

    if (errorResponse || !profile) {
      return errorResponse;
    }

    if (!isAdminRole(profile.role)) {
      return NextResponse.json(
        {
          success: false,
          message: 'Only admins can create system notifications from this API.',
        },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));

    const userId = String(body.user_id || '').trim();
    const title = String(body.title || '').trim();
    const message = String(body.message || '').trim();
    const type = String(body.type || 'GENERAL').trim();
    const relatedEntityId = body.related_entity_id
      ? String(body.related_entity_id)
      : null;
    const relatedEntityType = body.related_entity_type
      ? String(body.related_entity_type)
      : null;
    const dedupeKey = body.dedupe_key ? String(body.dedupe_key) : null;

    if (!userId || !title || !message) {
      return NextResponse.json(
        {
          success: false,
          message: 'user_id, title, and message are required.',
        },
        { status: 400 }
      );
    }

    const insertPayload: Record<string, unknown> = {
      user_id: userId,
      title,
      message,
      type,
      related_entity_id: relatedEntityId,
      related_entity_type: relatedEntityType,
      is_read: false,
    };

    if (dedupeKey) {
      insertPayload.dedupe_key = dedupeKey;
    }

    const { data, error } = await adminSupabase
      .from('notifications')
      .insert(insertPayload)
      .select(
        'id, user_id, title, message, type, is_read, related_entity_id, related_entity_type, created_at'
      )
      .single();

    if (error) {
      return NextResponse.json(
        {
          success: false,
          message: error.message || 'Unable to create notification.',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Notification created successfully.',
      notification: data,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : 'Something went wrong while creating notification.',
      },
      { status: 500 }
    );
  }
}