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

async function updatePayerDetails({
  contributionId,
  transactionReference,
  payerType,
  payerRelationship,
}: {
  contributionId: string;
  transactionReference: string;
  payerType: PayerType;
  payerRelationship: string | null;
}) {
  const serviceSupabase = createServiceClient();

  const { error } = await serviceSupabase
    .from('manual_payment_submissions')
    .update({
      payer_type: payerType,
      payer_relationship: payerRelationship,
    } as never)
    .eq('contribution_id', contributionId)
    .eq('transaction_reference', transactionReference)
    .eq('status', 'PENDING_REVIEW');

  if (error) {
    console.error('Payer details update warning:', error);
  }
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

    const supabase = createUserClient(accessToken);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(accessToken);

    if (userError || !user) {
      return errorResponse('Your session has expired. Please log in again.', 401);
    }

    const duplicateGuard = await guardAgainstDuplicatePendingSubmission({
      contributionId,
      transactionReference,
    });

    if (duplicateGuard.blocked) {
      return errorResponse(duplicateGuard.message, duplicateGuard.status);
    }

    const { data, error } = await supabase.rpc(
      'submit_manual_fund_space_payment',
      {
        p_contribution_id: contributionId,
        p_total_amount_paid: totalAmountPaid,
        p_transaction_reference: transactionReference,
        p_sender_name: normalizeText(body.sender_name) || undefined,
        p_sender_phone: normalizeText(body.sender_phone) || undefined,
        p_sender_network: normalizeSenderNetwork(body.sender_network) || undefined,
        p_company_payment_account_id:
          normalizeText(body.company_payment_account_id) || undefined,
        p_payment_note: enhancedPaymentNote || undefined,
        p_screenshot_url: normalizeText(body.screenshot_url) || undefined,
      }
    );

    if (error) {
      console.error('MoMo payment submission RPC error:', error);

      return errorResponse(
        error.message || 'Unable to submit payment for verification.',
        500
      );
    }

    await updatePayerDetails({
      contributionId,
      transactionReference,
      payerType,
      payerRelationship,
    });

    return NextResponse.json({
      success: true,
      message:
        'MoMo payment reference submitted successfully. Admin will verify the transaction before confirming the contribution.',
      result: data,
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