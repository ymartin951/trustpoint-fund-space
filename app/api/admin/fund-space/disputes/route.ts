import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

type AppRole = 'USER' | 'AGENT' | 'ADMIN' | 'SUPER_ADMIN';

type DisputeStatus =
  | 'OPEN'
  | 'UNDER_REVIEW'
  | 'WAITING_FOR_USER'
  | 'RESOLVED'
  | 'REJECTED'
  | 'CANCELLED';

type DisputePriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

const allowedStatuses: DisputeStatus[] = [
  'OPEN',
  'UNDER_REVIEW',
  'WAITING_FOR_USER',
  'RESOLVED',
  'REJECTED',
  'CANCELLED',
];

const allowedPriorities: DisputePriority[] = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];

function getBearerToken(request: NextRequest) {
  const authHeader = request.headers.get('authorization') || '';
  const [scheme, token] = authHeader.split(' ');

  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return null;
  }

  return token;
}

function normalizeText(value: unknown) {
  return String(value || '').trim();
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

function normalizeStatus(value: unknown): DisputeStatus | null {
  const status = normalizeText(value).toUpperCase() as DisputeStatus;

  if (allowedStatuses.includes(status)) {
    return status;
  }

  return null;
}

function normalizePriority(value: unknown): DisputePriority | null {
  const priority = normalizeText(value).toUpperCase() as DisputePriority;

  if (allowedPriorities.includes(priority)) {
    return priority;
  }

  return null;
}

export async function PATCH(request: NextRequest) {
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

    const { data: adminProfile, error: profileError } = await adminSupabase
      .from('profiles')
      .select('id, full_name, role, status')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError || !adminProfile) {
      return NextResponse.json(
        {
          success: false,
          message: 'Could not verify your admin profile.',
        },
        { status: 403 }
      );
    }

    const role = normalizeRole(adminProfile.role);

    if (!isAdminRole(role)) {
      return NextResponse.json(
        {
          success: false,
          message: 'Only admins can update complaints.',
        },
        { status: 403 }
      );
    }

    if (String(adminProfile.status || '').toUpperCase() !== 'ACTIVE') {
      return NextResponse.json(
        {
          success: false,
          message: 'Your admin account must be active.',
        },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));

    const disputeId = normalizeText(body.dispute_id);
    const status = normalizeStatus(body.status);
    const priority = normalizePriority(body.priority);
    const adminNote = normalizeText(body.admin_note);
    const resolutionNote = normalizeText(body.resolution_note);
    const assignedTo = normalizeText(body.assigned_to);

    if (!disputeId) {
      return NextResponse.json(
        {
          success: false,
          message: 'Complaint ID is required.',
        },
        { status: 400 }
      );
    }

    const { data: existingDispute, error: existingError } = await adminSupabase
      .from('fund_space_disputes')
      .select('id, user_id, subject, status')
      .eq('id', disputeId)
      .maybeSingle();

    if (existingError || !existingDispute) {
      return NextResponse.json(
        {
          success: false,
          message: 'Complaint record was not found.',
        },
        { status: 404 }
      );
    }

    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      last_response_at: new Date().toISOString(),
    };

    if (status) {
      updatePayload.status = status;
    }

    if (priority) {
      updatePayload.priority = priority;
    }

    if (adminNote) {
      updatePayload.admin_note = adminNote;
    }

    if (assignedTo) {
      updatePayload.assigned_to = assignedTo;
    }

    if (status === 'RESOLVED' || status === 'REJECTED' || status === 'CANCELLED') {
      updatePayload.resolved_by = user.id;
      updatePayload.resolved_at = new Date().toISOString();

      if (resolutionNote) {
        updatePayload.resolution_note = resolutionNote;
      }
    }

    if (
      (status === 'RESOLVED' || status === 'REJECTED') &&
      !resolutionNote &&
      !existingDispute.status?.includes(status)
    ) {
      return NextResponse.json(
        {
          success: false,
          message: 'Please add a resolution note before resolving or rejecting.',
        },
        { status: 400 }
      );
    }

    const { data: updatedDispute, error: updateError } = await adminSupabase
      .from('fund_space_disputes')
      .update(updatePayload)
      .eq('id', disputeId)
      .select('*')
      .single();

    if (updateError) {
      return NextResponse.json(
        {
          success: false,
          message: updateError.message || 'Unable to update complaint.',
        },
        { status: 500 }
      );
    }

    const notificationTitle =
      status === 'RESOLVED'
        ? 'Complaint Resolved'
        : status === 'REJECTED'
          ? 'Complaint Rejected'
          : status === 'WAITING_FOR_USER'
            ? 'Complaint Needs Your Response'
            : 'Complaint Updated';

    const notificationMessage =
      status === 'RESOLVED'
        ? `Your complaint "${existingDispute.subject}" has been resolved.`
        : status === 'REJECTED'
          ? `Your complaint "${existingDispute.subject}" was reviewed and rejected.`
          : status === 'WAITING_FOR_USER'
            ? `TrustPoint needs more information about "${existingDispute.subject}".`
            : `Your complaint "${existingDispute.subject}" has been updated.`;

    await adminSupabase.from('notifications').insert({
      user_id: existingDispute.user_id,
      title: notificationTitle,
      message: notificationMessage,
      type: 'DISPUTE_UPDATED',
      related_entity_type: 'fund_space_disputes',
      related_entity_id: disputeId,
      is_read: false,
    });

    return NextResponse.json({
      success: true,
      message: 'Complaint updated successfully.',
      dispute: updatedDispute,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : 'Something went wrong while updating complaint.',
      },
      { status: 500 }
    );
  }
}