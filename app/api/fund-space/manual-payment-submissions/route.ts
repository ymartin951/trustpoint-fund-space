import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

import type { Database } from '@/lib/database.types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type PayerType = 'CUSTOMER_SELF' | 'THIRD_PARTY' | 'AGENT_ASSISTED';

type ManualPaymentSubmissionBody = {
  contribution_id?: string;
  total_amount_paid?: number | string;
  transaction_reference?: string;
  sender_name?: string;
  sender_phone?: string;
  sender_network?: string;
  company_payment_account_id?: string;
  payer_type?: string;
  payer_relationship?: string;
  payment_note?: string;
  screenshot_url?: string;
};

type ProfileRole = 'USER' | 'AGENT' | 'ADMIN' | 'SUPER_ADMIN' | string;

type ContributionRow = {
  id: string;
  fund_space_id: string;
  round_id: string | null;
  user_id: string;
  amount_due: number | null;
  amount_paid: number | null;
  status: string | null;
};

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

function normalizeText(value: string | null | undefined) {
  return value?.trim() || null;
}

function normalizeNumber(value: number | string | null | undefined) {
  const amount =
    typeof value === 'string' ? Number(value.replace(/,/g, '')) : Number(value);

  if (!Number.isFinite(amount)) return 0;

  return amount;
}

function normalizeRole(role: ProfileRole | null | undefined) {
  return String(role || '').trim().toUpperCase().replaceAll('-', '_');
}

function normalizeSenderNetwork(value: string | null | undefined) {
  const normalized = String(value || '').trim().toUpperCase();

  if (
    [
      'MTN_MOMO',
      'TELECEL_CASH',
      'AIRTELTIGO_MONEY',
      'BANK',
      'OTHER',
    ].includes(normalized)
  ) {
    return normalized;
  }

  return null;
}

function normalizePayerType(value: string | null | undefined): PayerType {
  const normalized = String(value || '').trim().toUpperCase();

  if (
    normalized === 'CUSTOMER_SELF' ||
    normalized === 'THIRD_PARTY' ||
    normalized === 'AGENT_ASSISTED'
  ) {
    return normalized;
  }

  return 'CUSTOMER_SELF';
}

function normalizePayerRelationship({
  payerType,
  payerRelationship,
}: {
  payerType: PayerType;
  payerRelationship?: string | null;
}) {
  const relationship = normalizeText(payerRelationship);

  if (payerType === 'CUSTOMER_SELF') {
    return 'Self';
  }

  if (payerType === 'AGENT_ASSISTED') {
    return relationship || 'Agent';
  }

  return relationship || null;
}

function buildPaymentNote({
  payerType,
  payerRelationship,
  paymentNote,
}: {
  payerType: PayerType;
  payerRelationship: string | null;
  paymentNote: string | null;
}) {
  const parts = [
    `Payer Type: ${payerType}`,
    `Payer Relationship: ${payerRelationship || 'Not provided'}`,
  ];

  if (paymentNote) {
    parts.push(`Note: ${paymentNote}`);
  }

  return parts.join('\n');
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

function isPayableContributionStatus(status: string | null | undefined) {
  const value = String(status || '').toUpperCase();

  return ['PENDING', 'DUE', 'OVERDUE', 'UNPAID', 'PARTIAL'].includes(value);
}

function isAdminRole(role: string) {
  return role === 'ADMIN' || role === 'SUPER_ADMIN';
}

function isActiveAgentCustomerRelationship(status: string | null | undefined) {
  const value = String(status || '').toUpperCase();

  return ['ACTIVE', 'APPROVED', 'VERIFIED'].includes(value);
}

async function guardAgainstDuplicatePendingSubmission({
  contributionId,
  transactionReference,
}: {
  contributionId: string;
  transactionReference: string;
}) {
  const serviceSupabase = createServiceClient();

  const { data: existingPending, error: pendingError } = await serviceSupabase
    .from('manual_payment_submissions')
    .select('id, transaction_reference, status, created_at')
    .eq('contribution_id', contributionId)
    .eq('status', 'PENDING_REVIEW')
    .maybeSingle();

  if (pendingError) {
    console.error('Pending MoMo submission lookup error:', pendingError);
    throw new Error(
      'Unable to check existing payment submissions. Please try again.'
    );
  }

  if (existingPending) {
    return {
      blocked: true,
      status: 409,
      message:
        'A MoMo payment reference for this contribution is already awaiting admin verification. Please wait for admin review before submitting another reference.',
    };
  }

  const { data: existingReference, error: referenceError } =
    await serviceSupabase
      .from('manual_payment_submissions')
      .select('id, contribution_id, status, created_at')
      .eq('transaction_reference', transactionReference)
      .maybeSingle();

  if (referenceError) {
    console.error('Transaction reference lookup error:', referenceError);
    throw new Error('Unable to check transaction reference. Please try again.');
  }

  if (existingReference) {
    return {
      blocked: true,
      status: 409,
      message:
        'This transaction reference has already been submitted. Please check the reference and submit only a new, valid MoMo transaction ID.',
    };
  }

  return {
    blocked: false,
    status: 200,
    message: '',
  };
}

export async function POST(request: NextRequest) {
  try {
    const accessToken = await getAccessToken(request);

    if (!accessToken) {
      return errorResponse('Unauthorized request. Please log in again.', 401);
    }

    const body = (await request.json()) as ManualPaymentSubmissionBody;

    const contributionId = normalizeText(body.contribution_id);
    const transactionReference = normalizeText(body.transaction_reference);
    const totalAmountPaid = normalizeNumber(body.total_amount_paid);
    const payerType = normalizePayerType(body.payer_type);
    const payerRelationship = normalizePayerRelationship({
      payerType,
      payerRelationship: body.payer_relationship,
    });
    const cleanPaymentNote = normalizeText(body.payment_note);
    const enhancedPaymentNote = buildPaymentNote({
      payerType,
      payerRelationship,
      paymentNote: cleanPaymentNote,
    });

    if (!contributionId) {
      return errorResponse('Contribution ID is required.');
    }

    if (!transactionReference) {
      return errorResponse('Transaction reference is required.');
    }

    if (totalAmountPaid <= 0) {
      return errorResponse('Total amount paid must be greater than zero.');
    }

    if (payerType !== 'CUSTOMER_SELF' && !payerRelationship) {
      return errorResponse(
        'Please provide the relationship of the person who made this payment.'
      );
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
      .select('id, full_name, phone, email, role, status, verification_status')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      console.error('Manual payment profile lookup error:', profileError);
      return errorResponse('Unable to verify your profile.', 500);
    }

    if (!profile) {
      return errorResponse('Profile not found for this account.', 404);
    }

    const role = normalizeRole(profile.role);

    if (!['USER', 'AGENT', 'ADMIN', 'SUPER_ADMIN'].includes(role)) {
      return errorResponse('Your account role cannot submit this payment.', 403);
    }

    if (profile.status !== 'ACTIVE') {
      return errorResponse('Your account is not active.', 403);
    }

    if (profile.verification_status !== 'VERIFIED') {
      return errorResponse(
        'Your account must be verified before submitting payment.',
        403
      );
    }

    const { data: contributionData, error: contributionError } =
      await serviceSupabase
        .from('fund_space_contributions')
        .select('id, fund_space_id, round_id, user_id, amount_due, amount_paid, status')
        .eq('id', contributionId)
        .maybeSingle();

    if (contributionError) {
      console.error('Manual payment contribution lookup error:', contributionError);
      return errorResponse('Unable to load contribution record.', 500);
    }

    if (!contributionData) {
      return errorResponse('Contribution record not found.', 404);
    }

    const contribution = contributionData as ContributionRow;
    const isOwnContribution = contribution.user_id === user.id;

    if (role === 'USER' && !isOwnContribution) {
      return errorResponse(
        'You can only submit payment for your own contribution.',
        403
      );
    }

    if (role === 'AGENT' && !isOwnContribution) {
      const { data: agentCustomer, error: agentCustomerError } =
        await serviceSupabase
          .from('agent_customers')
          .select('id, agent_id, customer_id, relationship_status')
          .eq('agent_id', user.id)
          .eq('customer_id', contribution.user_id)
          .maybeSingle();

      if (agentCustomerError) {
        console.error('Agent customer lookup error:', agentCustomerError);
        return errorResponse('Unable to verify customer assignment.', 500);
      }

      if (!agentCustomer) {
        return errorResponse(
          'This customer is not assigned to your agent account.',
          403
        );
      }

      if (
        !isActiveAgentCustomerRelationship(
          String(agentCustomer.relationship_status || '')
        )
      ) {
        return errorResponse(
          'This customer assignment is not active, so payment cannot be submitted.',
          403
        );
      }
    }

    const { data: contributionOwnerProfile, error: ownerProfileError } =
      await serviceSupabase
        .from('profiles')
        .select('id, full_name, phone, email, role, status, verification_status')
        .eq('id', contribution.user_id)
        .maybeSingle();

    if (ownerProfileError) {
      console.error('Contribution owner profile lookup error:', ownerProfileError);
      return errorResponse('Unable to load contribution owner profile.', 500);
    }

    if (!contributionOwnerProfile) {
      return errorResponse('Contribution owner profile was not found.', 404);
    }

    if (contributionOwnerProfile.status !== 'ACTIVE') {
      return errorResponse('The contribution owner account is not active.', 403);
    }

    if (contributionOwnerProfile.verification_status !== 'VERIFIED') {
      return errorResponse(
        'The contribution owner must be verified before payment can be submitted.',
        403
      );
    }

    if (!isPayableContributionStatus(contribution.status)) {
      if (String(contribution.status || '').toUpperCase() === 'PAID') {
        return errorResponse('This contribution has already been paid.', 409);
      }

      return errorResponse(
        `This contribution cannot be paid because its current status is ${contribution.status || 'UNKNOWN'}.`,
        409
      );
    }

    const amountDue = Number(contribution.amount_due || 0);
    const amountPaid = Number(contribution.amount_paid || 0);

    if (amountDue > 0 && amountPaid >= amountDue) {
      return errorResponse('This contribution has already been fully paid.', 409);
    }

    const duplicateGuard = await guardAgainstDuplicatePendingSubmission({
      contributionId,
      transactionReference,
    });

    if (duplicateGuard.blocked) {
      return errorResponse(duplicateGuard.message, duplicateGuard.status);
    }

    const normalizedSenderNetwork = normalizeSenderNetwork(body.sender_network);

    /*
      This is the important fix:
      We insert using the service client after validating ownership ourselves.
      We do not call submit_manual_fund_space_payment here because that RPC is
      still rejecting agent self-contributions as if they were unassigned customers.
    */
    const insertPayload = {
      contribution_id: contribution.id,
      fund_space_id: contribution.fund_space_id,
      round_id: contribution.round_id,
      user_id: contribution.user_id,
      agent_id: role === 'AGENT' && !isOwnContribution ? user.id : null,
      status: 'PENDING_REVIEW',
      transaction_reference: transactionReference,
      total_amount_paid: totalAmountPaid,
      sender_name: normalizeText(body.sender_name),
      sender_phone: normalizeText(body.sender_phone),
      sender_network: normalizedSenderNetwork,
      company_payment_account_id: normalizeText(body.company_payment_account_id),
      payment_note: enhancedPaymentNote || null,
      screenshot_url: normalizeText(body.screenshot_url),
      payer_type: payerType,
      payer_relationship: payerRelationship,
    };

    const { data: submission, error: insertError } = await serviceSupabase
      .from('manual_payment_submissions')
      .insert(insertPayload as never)
      .select('id, contribution_id, fund_space_id, user_id, agent_id, status, transaction_reference, total_amount_paid, created_at')
      .single();

    if (insertError) {
      console.error('Manual MoMo payment submission insert error:', insertError);

      return errorResponse(
        insertError.message || 'Unable to submit payment for verification.',
        500
      );
    }

    await serviceSupabase.rpc('create_deduped_notification', {
      p_user_id: contribution.user_id,
      p_title: 'MoMo payment submitted',
      p_message:
        'Your MoMo payment reference has been submitted successfully and is awaiting admin verification.',
      p_type: 'INFO',
      p_related_entity_type: 'manual_payment_submissions',
      p_related_entity_id: submission.id,
      p_dedupe_key: `manual_payment_submitted:${submission.id}:customer`,
    });

    if (role === 'AGENT' && !isOwnContribution) {
      await serviceSupabase.rpc('create_deduped_notification', {
        p_user_id: user.id,
        p_title: 'Customer MoMo payment submitted',
        p_message:
          'You submitted a customer MoMo payment reference successfully. It is awaiting admin verification.',
        p_type: 'INFO',
        p_related_entity_type: 'manual_payment_submissions',
        p_related_entity_id: submission.id,
        p_dedupe_key: `manual_payment_submitted:${submission.id}:agent`,
      });
    }

    const { data: admins } = await serviceSupabase
      .from('profiles')
      .select('id')
      .in('role', ['ADMIN', 'SUPER_ADMIN']);

    if (admins && admins.length > 0) {
      const adminNotifications = admins.map((admin) => ({
        user_id: admin.id,
        title: 'New MoMo payment needs verification',
        message: `${
          contributionOwnerProfile.full_name || 'A Fund Space member'
        } submitted a MoMo payment reference for admin verification.`,
        type: 'MOMO_VERIFICATION_REQUIRED',
        related_entity_type: 'manual_payment_submissions',
        related_entity_id: submission.id,
        dedupe_key: `manual_payment_submitted:${submission.id}:admin:${admin.id}`,
        is_read: false,
      }));

      const { error: adminNotificationError } = await serviceSupabase
        .from('notifications')
        .insert(adminNotifications as never);

      if (adminNotificationError) {
        console.error(
          'Admin manual payment notification warning:',
          adminNotificationError
        );
      }
    }

    return NextResponse.json({
      success: true,
      message:
        'MoMo payment reference submitted successfully. Admin will verify the transaction before confirming the contribution.',
      submission,
    });
  } catch (error) {
    console.error('MoMo payment submission route error:', error);

    const message =
      error instanceof Error
        ? error.message
        : 'Something went wrong while submitting payment.';

    return NextResponse.json(
      {
        success: false,
        message,
      },
      { status: 500 }
    );
  }
}