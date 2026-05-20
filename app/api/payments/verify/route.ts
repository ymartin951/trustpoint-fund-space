import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

import type { Database, Json } from '@/lib/database.types';
import {
  isPaystackPaymentSuccessful,
  verifyPaystackTransaction,
} from '@/lib/payments/paystack';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type SupabaseServiceClient = ReturnType<typeof createServiceClient>;

type PaymentTransactionRow =
  Database['public']['Tables']['payment_transactions']['Row'];

type VerifyPaymentBody = {
  reference?: string;
};

function createServiceClient() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL is not configured.'
    );
  }

  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured.');
  }

  return createClient<Database>(supabaseUrl, serviceRoleKey, {
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

function toJson(value: unknown): Json {
  return value as Json;
}

function nullableToUndefined<T>(value: T | null | undefined): T | undefined {
  return value ?? undefined;
}

function normalizeReference(value: string | null | undefined) {
  return value?.trim() || '';
}

function getReferenceFromRequest(request: NextRequest, body?: VerifyPaymentBody) {
  const searchReference =
    request.nextUrl.searchParams.get('reference') ||
    request.nextUrl.searchParams.get('payment_reference') ||
    request.nextUrl.searchParams.get('trxref');

  const bodyReference = body?.reference;

  return normalizeReference(searchReference || bodyReference);
}

function amountsMatch({
  expectedProviderAmount,
  verifiedProviderAmount,
}: {
  expectedProviderAmount: number | null;
  verifiedProviderAmount: number | undefined;
}) {
  if (!expectedProviderAmount || !verifiedProviderAmount) {
    return false;
  }

  return Number(expectedProviderAmount) === Number(verifiedProviderAmount);
}

function currenciesMatch({
  expectedCurrency,
  verifiedCurrency,
}: {
  expectedCurrency: string | null;
  verifiedCurrency: string | undefined;
}) {
  if (!expectedCurrency || !verifiedCurrency) {
    return false;
  }

  return expectedCurrency.toUpperCase() === verifiedCurrency.toUpperCase();
}

function isFailureStatus(status: string | undefined) {
  return ['failed', 'abandoned', 'reversed'].includes(
    String(status || '').toLowerCase()
  );
}

function getFailureReason(verification: Awaited<ReturnType<typeof verifyPaystackTransaction>>) {
  return (
    verification.data?.gateway_response ||
    verification.data?.message ||
    verification.message ||
    'Payment was not successful.'
  );
}

async function findPaymentByReference({
  supabase,
  reference,
}: {
  supabase: SupabaseServiceClient;
  reference: string;
}) {
  const { data, error } = await supabase
    .from('payment_transactions')
    .select('*')
    .eq('provider', 'PAYSTACK')
    .or(`internal_reference.eq.${reference},provider_reference.eq.${reference}`)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

async function getAuthenticatedUser({
  supabase,
  accessToken,
}: {
  supabase: SupabaseServiceClient;
  accessToken: string;
}) {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(accessToken);

  if (error || !user) {
    return null;
  }

  return user;
}

async function getProfileRole({
  supabase,
  userId,
}: {
  supabase: SupabaseServiceClient;
  userId: string;
}) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, role, status')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.warn('Verify payment profile role warning:', error.message);
    return null;
  }

  return data;
}

function canUserVerifyPayment({
  payment,
  userId,
  role,
}: {
  payment: PaymentTransactionRow;
  userId: string;
  role?: string | null;
}) {
  if (payment.user_id === userId) return true;
  if (payment.customer_id === userId) return true;
  if (payment.initiated_by === userId) return true;

  if (role === 'ADMIN' || role === 'SUPER_ADMIN') {
    return true;
  }

  return false;
}

async function processSuccessfulPayment({
  supabase,
  payment,
  verification,
}: {
  supabase: SupabaseServiceClient;
  payment: PaymentTransactionRow;
  verification: Awaited<ReturnType<typeof verifyPaystackTransaction>>;
}) {
  const providerReference =
    verification.data?.reference ?? nullableToUndefined(payment.provider_reference);

  const providerTransactionId = verification.data?.id
    ? String(verification.data.id)
    : nullableToUndefined(payment.provider_transaction_id);

  const providerStatus =
    verification.data?.status ?? nullableToUndefined(payment.provider_status);

  if (
    payment.payment_type === 'WALLET_DEPOSIT' ||
    payment.payment_type === 'AGENT_CUSTOMER_DEPOSIT'
  ) {
    const { data, error } = await supabase.rpc(
      'process_successful_wallet_deposit',
      {
        p_payment_transaction_id: payment.id,
        p_provider_reference: providerReference,
        p_provider_transaction_id: providerTransactionId,
        p_provider_status: providerStatus,
        p_provider_response: toJson(verification),
      }
    );

    if (error) {
      throw error;
    }

    return data;
  }

  if (
    payment.payment_type === 'FUND_SPACE_CONTRIBUTION' ||
    payment.payment_type === 'AGENT_CUSTOMER_CONTRIBUTION'
  ) {
    const { data, error } = await supabase.rpc(
      'process_successful_fund_space_contribution_payment',
      {
        p_payment_transaction_id: payment.id,
        p_provider_reference: providerReference,
        p_provider_transaction_id: providerTransactionId,
        p_provider_status: providerStatus,
        p_provider_response: toJson(verification),
      }
    );

    if (error) {
      throw error;
    }

    return data;
  }

  throw new Error(`Unsupported successful payment type: ${payment.payment_type}`);
}

async function processFailedPayment({
  supabase,
  payment,
  reason,
  verification,
}: {
  supabase: SupabaseServiceClient;
  payment: PaymentTransactionRow;
  reason: string;
  verification: Awaited<ReturnType<typeof verifyPaystackTransaction>>;
}) {
  const { data, error } = await supabase.rpc(
    'process_failed_payment_transaction',
    {
      p_payment_transaction_id: payment.id,
      p_failure_reason: reason,
      p_provider_reference:
        verification.data?.reference ??
        nullableToUndefined(payment.provider_reference),
      p_provider_status:
        verification.data?.status ?? nullableToUndefined(payment.provider_status),
      p_provider_response: toJson(verification),
    }
  );

  if (error) {
    throw error;
  }

  return data;
}

async function handleVerify(request: NextRequest, body?: VerifyPaymentBody) {
  try {
    const authorizationHeader = request.headers.get('authorization');

    if (!authorizationHeader?.startsWith('Bearer ')) {
      return errorResponse('Unauthorized request. Please log in again.', 401);
    }

    const accessToken = authorizationHeader.replace('Bearer ', '').trim();

    if (!accessToken) {
      return errorResponse('Missing access token. Please log in again.', 401);
    }

    const reference = getReferenceFromRequest(request, body);

    if (!reference) {
      return errorResponse('Payment reference is required.');
    }

    const supabase = createServiceClient();

    const user = await getAuthenticatedUser({
      supabase,
      accessToken,
    });

    if (!user) {
      return errorResponse('Your session has expired. Please log in again.', 401);
    }

    const payment = await findPaymentByReference({
      supabase,
      reference,
    });

    if (!payment) {
      return errorResponse('Payment transaction not found.', 404);
    }

    const profile = await getProfileRole({
      supabase,
      userId: user.id,
    });

    const allowed = canUserVerifyPayment({
      payment,
      userId: user.id,
      role: profile?.role,
    });

    if (!allowed) {
      return errorResponse(
        'You are not allowed to verify this payment transaction.',
        403
      );
    }

    if (payment.status === 'SUCCESS' && payment.processed_at) {
      return NextResponse.json({
        success: true,
        already_processed: true,
        message: 'Payment has already been processed.',
        payment_status: payment.status,
        payment_transaction_id: payment.id,
        reference,
      });
    }

    const verification = await verifyPaystackTransaction(reference);

    const verifiedAmountMatches = amountsMatch({
      expectedProviderAmount: payment.provider_amount,
      verifiedProviderAmount: verification.data?.amount,
    });

    const verifiedCurrencyMatches = currenciesMatch({
      expectedCurrency: payment.currency,
      verifiedCurrency: verification.data?.currency,
    });

    if (!verifiedAmountMatches || !verifiedCurrencyMatches) {
      const reason = `Payment verification mismatch. Expected ${
        payment.currency
      } ${payment.amount}, provider returned ${
        verification.data?.currency || ''
      } ${verification.data?.amount || ''}.`;

      const result = await processFailedPayment({
        supabase,
        payment,
        reason,
        verification,
      });

      return NextResponse.json({
        success: false,
        message: 'Payment failed verification checks.',
        verification_mismatch: true,
        payment_transaction_id: payment.id,
        reference,
        result,
      });
    }

    if (isPaystackPaymentSuccessful(verification)) {
      const result = await processSuccessfulPayment({
        supabase,
        payment,
        verification,
      });

      return NextResponse.json({
        success: true,
        message: 'Payment verified and processed successfully.',
        payment_status: 'SUCCESS',
        payment_transaction_id: payment.id,
        reference,
        result,
      });
    }

    if (isFailureStatus(verification.data?.status)) {
      const result = await processFailedPayment({
        supabase,
        payment,
        reason: getFailureReason(verification),
        verification,
      });

      return NextResponse.json({
        success: false,
        message: getFailureReason(verification),
        payment_status: verification.data?.status || 'FAILED',
        payment_transaction_id: payment.id,
        reference,
        result,
      });
    }

    const { error: updateError } = await supabase
      .from('payment_transactions')
      .update({
        provider_reference: verification.data?.reference || reference,
        provider_transaction_id: verification.data?.id
          ? String(verification.data.id)
          : payment.provider_transaction_id,
        provider_status: verification.data?.status || payment.provider_status,
        provider_response: toJson(verification),
      })
      .eq('id', payment.id);

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({
      success: true,
      message: 'Payment verification checked. Payment is not final yet.',
      payment_status: verification.data?.status || payment.status,
      payment_transaction_id: payment.id,
      reference,
    });
  } catch (error) {
    console.error('Payment verification route error:', error);

    const message =
      error instanceof Error
        ? error.message
        : 'Something went wrong while verifying payment.';

    return NextResponse.json(
      {
        success: false,
        message,
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return handleVerify(request);
}

export async function POST(request: NextRequest) {
  let body: VerifyPaymentBody = {};

  try {
    body = (await request.json()) as VerifyPaymentBody;
  } catch {
    body = {};
  }

  return handleVerify(request, body);
}