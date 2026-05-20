import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

import type { Database, Json } from '@/lib/database.types';
import { isPaystackPaymentSuccessful } from '@/lib/payments/paystack';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type SupabaseServiceClient = ReturnType<typeof createServiceClient>;

type PaymentTransactionRow =
  Database['public']['Tables']['payment_transactions']['Row'];

type PaystackWebhookEvent = {
  event?: string;
  data?: {
    id?: number | string;
    reference?: string;
    status?: string;
    amount?: number;
    currency?: string;
    gateway_response?: string;
    message?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
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

function getPaystackSecretKey() {
  const secretKey =
    process.env.PAYSTACK_SECRET_KEY ||
    process.env.PAYSTACK_SECRET ||
    process.env.NEXT_PUBLIC_PAYSTACK_SECRET_KEY;

  if (!secretKey) {
    throw new Error('PAYSTACK_SECRET_KEY is not configured.');
  }

  return secretKey;
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

function verifyPaystackSignature({
  rawBody,
  signature,
}: {
  rawBody: string;
  signature: string | null;
}) {
  if (!signature) return false;

  const secretKey = getPaystackSecretKey();

  const expectedSignature = crypto
    .createHmac('sha512', secretKey)
    .update(rawBody)
    .digest('hex');

  if (expectedSignature.length !== signature.length) {
    return false;
  }

  try {
    return crypto.timingSafeEqual(
      Uint8Array.from(Buffer.from(expectedSignature, 'utf8')),
      Uint8Array.from(Buffer.from(signature, 'utf8'))
    );
  } catch {
    return false;
  }
}

function isFailureStatus(status: string | undefined) {
  return ['failed', 'abandoned', 'reversed'].includes(
    String(status || '').toLowerCase()
  );
}

function getFailureReason(event: PaystackWebhookEvent) {
  return (
    event.data?.gateway_response ||
    event.data?.message ||
    'Payment was not successful.'
  );
}

function amountsMatch({
  expectedProviderAmount,
  webhookProviderAmount,
}: {
  expectedProviderAmount: number | null;
  webhookProviderAmount: number | undefined;
}) {
  if (!expectedProviderAmount || !webhookProviderAmount) {
    return false;
  }

  return Number(expectedProviderAmount) === Number(webhookProviderAmount);
}

function currenciesMatch({
  expectedCurrency,
  webhookCurrency,
}: {
  expectedCurrency: string | null;
  webhookCurrency: string | undefined;
}) {
  if (!expectedCurrency || !webhookCurrency) {
    return false;
  }

  return expectedCurrency.toUpperCase() === webhookCurrency.toUpperCase();
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

async function storeWebhookEvent({
  supabase,
  event,
  paymentTransactionId,
  signatureValid,
  processingError,
}: {
  supabase: SupabaseServiceClient;
  event: PaystackWebhookEvent;
  paymentTransactionId?: string | null;
  signatureValid: boolean;
  processingError?: string | null;
}) {
  const reference = normalizeReference(event.data?.reference);

  const { error } = await supabase.from('payment_webhook_events').insert({
    provider: 'PAYSTACK',
    event_type: event.event || 'UNKNOWN',
    event_id: event.data?.id ? String(event.data.id) : null,
    provider_reference: reference || null,
    payment_transaction_id: paymentTransactionId || null,
    payload: toJson(event),
    signature_valid: signatureValid,
    processed: !processingError,
    processed_at: !processingError ? new Date().toISOString() : null,
    processing_error: processingError || null,
  });

  if (error) {
    console.error('Paystack webhook event insert error:', error);
  }
}

async function processSuccessfulPayment({
  supabase,
  payment,
  event,
}: {
  supabase: SupabaseServiceClient;
  payment: PaymentTransactionRow;
  event: PaystackWebhookEvent;
}) {
  const providerReference =
    event.data?.reference ?? nullableToUndefined(payment.provider_reference);

  const providerTransactionId = event.data?.id
    ? String(event.data.id)
    : nullableToUndefined(payment.provider_transaction_id);

  const providerStatus =
    event.data?.status ?? nullableToUndefined(payment.provider_status);

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
        p_provider_response: toJson(event),
      }
    );

    if (error) throw error;

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
        p_provider_response: toJson(event),
      }
    );

    if (error) throw error;

    return data;
  }

  throw new Error(`Unsupported successful payment type: ${payment.payment_type}`);
}

async function processFailedPayment({
  supabase,
  payment,
  reason,
  event,
}: {
  supabase: SupabaseServiceClient;
  payment: PaymentTransactionRow;
  reason: string;
  event: PaystackWebhookEvent;
}) {
  const { data, error } = await supabase.rpc(
    'process_failed_payment_transaction',
    {
      p_payment_transaction_id: payment.id,
      p_failure_reason: reason,
      p_provider_reference:
        event.data?.reference ?? nullableToUndefined(payment.provider_reference),
      p_provider_status:
        event.data?.status ?? nullableToUndefined(payment.provider_status),
      p_provider_response: toJson(event),
    }
  );

  if (error) throw error;

  return data;
}

export async function POST(request: NextRequest) {
  const supabase = createServiceClient();

  let parsedEvent: PaystackWebhookEvent | null = null;
  let paymentId: string | null = null;
  let signatureValid = false;

  try {
    const rawBody = await request.text();
    const signature = request.headers.get('x-paystack-signature');

    signatureValid = verifyPaystackSignature({
      rawBody,
      signature,
    });

    if (!signatureValid) {
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid Paystack webhook signature.',
        },
        { status: 401 }
      );
    }

    parsedEvent = JSON.parse(rawBody) as PaystackWebhookEvent;

    const reference = normalizeReference(parsedEvent.data?.reference);

    if (!reference) {
      await storeWebhookEvent({
        supabase,
        event: parsedEvent,
        signatureValid,
        processingError: 'Webhook event does not include a payment reference.',
      });

      return NextResponse.json({
        success: true,
        message: 'Webhook received without payment reference.',
      });
    }

    const payment = await findPaymentByReference({
      supabase,
      reference,
    });

    if (!payment) {
      await storeWebhookEvent({
        supabase,
        event: parsedEvent,
        signatureValid,
        processingError: 'Payment transaction not found.',
      });

      return NextResponse.json({
        success: true,
        message: 'Webhook received but payment transaction was not found.',
      });
    }

    paymentId = payment.id;

    if (payment.status === 'SUCCESS' && payment.processed_at) {
      await storeWebhookEvent({
        supabase,
        event: parsedEvent,
        paymentTransactionId: payment.id,
        signatureValid,
        processingError: null,
      });

      return NextResponse.json({
        success: true,
        already_processed: true,
        message: 'Payment already processed.',
      });
    }

    const amountOk = amountsMatch({
      expectedProviderAmount: payment.provider_amount,
      webhookProviderAmount: parsedEvent.data?.amount,
    });

    const currencyOk = currenciesMatch({
      expectedCurrency: payment.currency,
      webhookCurrency: parsedEvent.data?.currency,
    });

    if (!amountOk || !currencyOk) {
      const reason = `Payment webhook mismatch. Expected ${
        payment.currency
      } ${payment.amount}, provider returned ${
        parsedEvent.data?.currency || ''
      } ${parsedEvent.data?.amount || ''}.`;

      await processFailedPayment({
        supabase,
        payment,
        reason,
        event: parsedEvent,
      });

      await storeWebhookEvent({
        supabase,
        event: parsedEvent,
        paymentTransactionId: payment.id,
        signatureValid,
        processingError: reason,
      });

      return NextResponse.json({
        success: true,
        message: 'Webhook received. Payment failed verification checks.',
      });
    }

    if (
      parsedEvent.event === 'charge.success' ||
      isPaystackPaymentSuccessful(parsedEvent as Parameters<typeof isPaystackPaymentSuccessful>[0])
    ) {
      await processSuccessfulPayment({
        supabase,
        payment,
        event: parsedEvent,
      });

      await storeWebhookEvent({
        supabase,
        event: parsedEvent,
        paymentTransactionId: payment.id,
        signatureValid,
        processingError: null,
      });

      return NextResponse.json({
        success: true,
        message: 'Webhook received and payment processed successfully.',
      });
    }

    if (isFailureStatus(parsedEvent.data?.status)) {
      await processFailedPayment({
        supabase,
        payment,
        reason: getFailureReason(parsedEvent),
        event: parsedEvent,
      });

      await storeWebhookEvent({
        supabase,
        event: parsedEvent,
        paymentTransactionId: payment.id,
        signatureValid,
        processingError: null,
      });

      return NextResponse.json({
        success: true,
        message: 'Webhook received and failed payment recorded.',
      });
    }

    const { error: updateError } = await supabase
      .from('payment_transactions')
      .update({
        provider_reference: parsedEvent.data?.reference || reference,
        provider_transaction_id: parsedEvent.data?.id
          ? String(parsedEvent.data.id)
          : payment.provider_transaction_id,
        provider_status: parsedEvent.data?.status || payment.provider_status,
        provider_response: toJson(parsedEvent),
      })
      .eq('id', payment.id);

    if (updateError) {
      throw updateError;
    }

    await storeWebhookEvent({
      supabase,
      event: parsedEvent,
      paymentTransactionId: payment.id,
      signatureValid,
      processingError: null,
    });

    return NextResponse.json({
      success: true,
      message: 'Webhook received. Payment status updated.',
    });
  } catch (error) {
    console.error('Paystack webhook route error:', error);

    const message =
      error instanceof Error
        ? error.message
        : 'Something went wrong while processing Paystack webhook.';

    if (parsedEvent) {
      await storeWebhookEvent({
        supabase,
        event: parsedEvent,
        paymentTransactionId: paymentId,
        signatureValid,
        processingError: message,
      });
    }

    return NextResponse.json(
      {
        success: false,
        message,
      },
      { status: 500 }
    );
  }
}