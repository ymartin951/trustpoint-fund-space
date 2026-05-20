import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

import type { Database } from '@/lib/supabase/database.types';

export const dynamic = 'force-dynamic';

const supabaseUrl: string = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const serviceRoleKey: string = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

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

type VerificationAction = 'APPROVE' | 'REJECT';

type NotificationInsert =
  Database['public']['Tables']['notifications']['Insert'];

function getBearerToken(request: Request): string | null {
  const authHeader =
    request.headers.get('authorization') ||
    request.headers.get('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.replace('Bearer ', '').trim();

  return token || null;
}

function isAdminRole(role?: string | null) {
  return role === 'ADMIN' || role === 'SUPER_ADMIN';
}

function normalizeAction(action: unknown): VerificationAction | null {
  const upper = String(action || '').toUpperCase();

  if (upper === 'APPROVE') return 'APPROVE';
  if (upper === 'REJECT') return 'REJECT';

  return null;
}

async function createVerificationNotifications({
  action,
  customerUserId,
  customerName,
  submittedByAgent,
  reason,
}: {
  action: VerificationAction;
  customerUserId: string;
  customerName: string;
  submittedByAgent: string | null;
  reason?: string;
}) {
  const notifications: NotificationInsert[] = [];

  if (action === 'APPROVE') {
    notifications.push({
      user_id: customerUserId,
      title: 'Verification Approved',
      message:
        'Your TrustPoint verification has been approved. You can now join a Fund Space group and access verified customer features.',
      type: 'VERIFICATION',
      related_entity_id: customerUserId,
      related_entity_type: 'customer',
      is_read: false,
    });

    if (submittedByAgent) {
      notifications.push({
        user_id: submittedByAgent,
        title: 'Customer Verification Approved',
        message: `${customerName} has been approved successfully.`,
        type: 'VERIFICATION',
        related_entity_id: customerUserId,
        related_entity_type: 'customer',
        is_read: false,
      });
    }
  }

  if (action === 'REJECT') {
    notifications.push({
      user_id: customerUserId,
      title: 'Verification Rejected',
      message: reason
        ? `Your TrustPoint verification was rejected. Reason: ${reason}`
        : 'Your TrustPoint verification was rejected. Please review your details and resubmit.',
      type: 'VERIFICATION',
      related_entity_id: customerUserId,
      related_entity_type: 'customer',
      is_read: false,
    });

    if (submittedByAgent) {
      notifications.push({
        user_id: submittedByAgent,
        title: 'Customer Verification Rejected',
        message: reason
          ? `${customerName}'s verification was rejected. Reason: ${reason}`
          : `${customerName}'s verification was rejected.`,
        type: 'VERIFICATION',
        related_entity_id: customerUserId,
        related_entity_type: 'customer',
        is_read: false,
      });
    }
  }

  if (notifications.length === 0) {
    return;
  }

  const { error } = await adminSupabase
    .from('notifications')
    .insert(notifications);

  if (error) {
    console.error('Verification notification creation error:', error);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: requestId } = await params;

    if (!requestId) {
      return NextResponse.json(
        { success: false, message: 'Verification request ID is required.' },
        { status: 400 }
      );
    }

    const token = getBearerToken(request);

    if (!token) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized. Missing bearer token.' },
        { status: 401 }
      );
    }

    const {
      data: { user },
      error: userError,
    } = await adminSupabase.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized. Invalid session.' },
        { status: 401 }
      );
    }

    const { data: adminProfile, error: adminProfileError } =
      await adminSupabase
        .from('profiles')
        .select('id, role, status, full_name, email')
        .eq('id', user.id)
        .single();

    if (adminProfileError || !adminProfile) {
      return NextResponse.json(
        { success: false, message: 'Admin profile not found.' },
        { status: 404 }
      );
    }

    if (!isAdminRole(adminProfile.role)) {
      return NextResponse.json(
        { success: false, message: 'Forbidden. Admin access required.' },
        { status: 403 }
      );
    }

    if (adminProfile.status && adminProfile.status !== 'ACTIVE') {
      return NextResponse.json(
        { success: false, message: 'Your admin account is not active.' },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => null);

    if (!body) {
      return NextResponse.json(
        { success: false, message: 'Invalid request body.' },
        { status: 400 }
      );
    }

    const action = normalizeAction(body.action);
    const reason = String(body.reason || '').trim();

    if (!action) {
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid action. Use APPROVE or REJECT.',
        },
        { status: 400 }
      );
    }

    if (action === 'REJECT' && !reason) {
      return NextResponse.json(
        {
          success: false,
          message: 'Please provide a rejection reason.',
        },
        { status: 400 }
      );
    }

    const { data: existingRequest, error: existingRequestError } =
      await adminSupabase
        .from('verification_requests')
        .select('id, user_id, full_name, status, submitted_by_agent')
        .eq('id', requestId)
        .single();

    if (existingRequestError || !existingRequest) {
      return NextResponse.json(
        { success: false, message: 'Verification request not found.' },
        { status: 404 }
      );
    }

    if (existingRequest.status === 'APPROVED') {
      return NextResponse.json(
        {
          success: false,
          message: 'This verification request has already been approved.',
        },
        { status: 400 }
      );
    }

    if (existingRequest.status === 'REJECTED' && action === 'REJECT') {
      return NextResponse.json(
        {
          success: false,
          message: 'This verification request has already been rejected.',
        },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    if (action === 'APPROVE') {
      const { data: updatedRequest, error: updateRequestError } =
        await adminSupabase
          .from('verification_requests')
          .update({
            status: 'APPROVED',
            rejection_reason: null,
            reviewed_at: now,
            reviewed_by: adminProfile.id,
            updated_at: now,
          })
          .eq('id', requestId)
          .select('id, user_id, full_name, status, reviewed_at, reviewed_by')
          .single();

      if (updateRequestError || !updatedRequest) {
        console.error(
          'Approve verification request update error:',
          updateRequestError
        );

        return NextResponse.json(
          {
            success: false,
            message:
              updateRequestError?.message ||
              'Failed to approve verification request.',
          },
          { status: 500 }
        );
      }

      const { error: updateProfileError } = await adminSupabase
        .from('profiles')
        .update({
          verification_status: 'VERIFIED',
          verified_at: now,
          verified_by: adminProfile.id,
          ghana_card_verified: true,
          trust_score: 100,
          updated_at: now,
        })
        .eq('id', existingRequest.user_id);

      if (updateProfileError) {
        console.error('Approve profile update error:', updateProfileError);

        return NextResponse.json(
          {
            success: false,
            message:
              updateProfileError.message ||
              'Verification request approved, but customer profile could not be updated.',
          },
          { status: 500 }
        );
      }

      await createVerificationNotifications({
        action: 'APPROVE',
        customerUserId: existingRequest.user_id,
        customerName: existingRequest.full_name,
        submittedByAgent: existingRequest.submitted_by_agent,
      });

      return NextResponse.json({
        success: true,
        message:
          'Verification request approved successfully. Notifications have been sent.',
        request: updatedRequest,
      });
    }

    const { data: updatedRequest, error: updateRequestError } =
      await adminSupabase
        .from('verification_requests')
        .update({
          status: 'REJECTED',
          rejection_reason: reason,
          reviewed_at: now,
          reviewed_by: adminProfile.id,
          updated_at: now,
        })
        .eq('id', requestId)
        .select(
          'id, user_id, full_name, status, rejection_reason, reviewed_at, reviewed_by'
        )
        .single();

    if (updateRequestError || !updatedRequest) {
      console.error(
        'Reject verification request update error:',
        updateRequestError
      );

      return NextResponse.json(
        {
          success: false,
          message:
            updateRequestError?.message ||
            'Failed to reject verification request.',
        },
        { status: 500 }
      );
    }

    const { error: updateProfileError } = await adminSupabase
      .from('profiles')
      .update({
        verification_status: 'REJECTED',
        verified_at: null,
        verified_by: null,
        ghana_card_verified: false,
        updated_at: now,
      })
      .eq('id', existingRequest.user_id);

    if (updateProfileError) {
      console.error('Reject profile update error:', updateProfileError);

      return NextResponse.json(
        {
          success: false,
          message:
            updateProfileError.message ||
            'Verification request rejected, but customer profile could not be updated.',
        },
        { status: 500 }
      );
    }

    await createVerificationNotifications({
      action: 'REJECT',
      customerUserId: existingRequest.user_id,
      customerName: existingRequest.full_name,
      submittedByAgent: existingRequest.submitted_by_agent,
      reason,
    });

    return NextResponse.json({
      success: true,
      message:
        'Verification request rejected successfully. Notifications have been sent.',
      request: updatedRequest,
    });
  } catch (error: unknown) {
    console.error('Admin verification action API error:', error);

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