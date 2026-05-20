import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

import type { Database } from '@/lib/database.types';
import { initializePaystackTransaction } from '@/lib/payments/paystack';
import { generatePaymentReference } from '@/lib/payments/references';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type AgentCustomerDepositBody = {
  customer_id?: string;
  amount?: number | string;
  momo_number?: string;
  phone?: string;
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

function parseAmount(value: number | string | undefined) {
  if (typeof value === 'number') return value;

  if (typeof value === 'string') {
    return Number(value.replace(/,/g, '').trim());
  }

  return NaN;
}

function normalizeText(value: string | null | undefined) {
  return value?.trim() || null;
}

function getAppUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ||
    'http://localhost:3000'
  );
}

export async function POST(request: NextRequest) {
  try {
    const authorizationHeader = request.headers.get('authorization');

    if (!authorizationHeader?.startsWith('Bearer ')) {
      return errorResponse('Unauthorized request. Please log in again.', 401);
    }

    const accessToken = authorizationHeader.replace('Bearer ', '').trim();

    if (!accessToken) {
      return errorResponse('Missing access token. Please log in again.', 401);
    }

    const body = (await request.json()) as AgentCustomerDepositBody;

    const customerId = normalizeText(body.customer_id);
    const amount = parseAmount(body.amount);
    const submittedPhone = normalizeText(body.momo_number || body.phone);

    if (!customerId) {
      return errorResponse('Customer is required.');
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      return errorResponse('Please enter a valid deposit amount.');
    }

    if (amount < 1) {
      return errorResponse('Minimum customer deposit amount is GH₵1.');
    }

    if (amount > 100000) {
      return errorResponse('Maximum customer deposit amount is GH₵100,000.');
    }

    const supabase = createServiceClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(accessToken);

    if (userError || !user) {
      return errorResponse('Your session has expired. Please log in again.', 401);
    }

    const { data: agentProfile, error: agentProfileError } = await supabase
      .from('profiles')
      .select('id, full_name, email, phone, role, status, verification_status')
      .eq('id', user.id)
      .maybeSingle();

    if (agentProfileError) {
      console.error('Agent profile lookup error:', agentProfileError);
      return errorResponse('Unable to load agent profile.', 500);
    }

    if (!agentProfile) {
      return errorResponse('Agent profile not found.', 404);
    }

    if (agentProfile.status !== 'ACTIVE') {
      return errorResponse('Your agent account is not active.', 403);
    }

    if (agentProfile.role !== 'AGENT') {
      return errorResponse('Only agents can initiate customer deposits.', 403);
    }

    if (agentProfile.verification_status !== 'VERIFIED') {
      return errorResponse(
        'Your agent account must be verified before initiating deposits.',
        403
      );
    }

    const { data: agentCustomer, error: agentCustomerError } = await supabase
  .from('agent_customers')
  .select('id, agent_id, customer_id')
  .eq('agent_id', user.id)
  .eq('customer_id', customerId)
  .maybeSingle();

    if (agentCustomerError) {
      console.error('Agent customer lookup error:', agentCustomerError);
      return errorResponse('Unable to verify this customer under your account.', 500);
    }

    if (!agentCustomer) {
      return errorResponse(
        'This customer is not assigned to your agent account.',
        403
      );
    }

    const { data: customerProfile, error: customerProfileError } =
      await supabase
        .from('profiles')
        .select(
          'id, full_name, email, phone, momo_number, role, status, verification_status'
        )
        .eq('id', customerId)
        .maybeSingle();

    if (customerProfileError) {
      console.error('Customer profile lookup error:', customerProfileError);
      return errorResponse('Unable to load customer profile.', 500);
    }

    if (!customerProfile) {
      return errorResponse('Customer profile not found.', 404);
    }

    if (customerProfile.status !== 'ACTIVE') {
      return errorResponse('Customer account is not active.', 403);
    }

    if (customerProfile.role !== 'USER') {
      return errorResponse('Deposits can only be made for customer accounts.', 403);
    }

    if (customerProfile.verification_status !== 'VERIFIED') {
      return errorResponse(
        'Customer must be verified before receiving real deposits.',
        403
      );
    }

    const payerEmail = customerProfile.email || agentProfile.email || user.email;

    if (!payerEmail) {
      return errorResponse(
        'Customer or agent account needs an email before payment can be initialized.'
      );
    }

    const payerPhone =
      submittedPhone || customerProfile.momo_number || customerProfile.phone;

    const { error: walletCreateError } = await supabase.rpc(
      'create_user_wallet_if_missing',
      {
        p_user_id: customerProfile.id,
      }
    );

    if (walletCreateError) {
      console.error('Customer wallet creation error:', walletCreateError);
      return errorResponse(
        'Unable to prepare customer wallet. Please try again.',
        500
      );
    }

    const { data: wallet, error: walletLookupError } = await supabase
      .from('wallet_accounts')
      .select('id')
      .eq('user_id', customerProfile.id)
      .maybeSingle();

    if (walletLookupError || !wallet) {
      console.error('Customer wallet lookup error:', walletLookupError);
      return errorResponse('Customer wallet account not found.', 500);
    }

    const paymentReference = generatePaymentReference('AGENT_CUSTOMER_DEPOSIT');

    const { data: paymentTransaction, error: paymentInsertError } =
      await supabase
        .from('payment_transactions')
        .insert({
          user_id: customerProfile.id,
          customer_id: customerProfile.id,
          wallet_id: wallet.id,
          payment_type: 'AGENT_CUSTOMER_DEPOSIT',
          direction: 'INCOMING',
          provider: 'PAYSTACK',
          channel: 'MOBILE_MONEY',
          status: 'PENDING',
          internal_reference: paymentReference,
          amount,
          provider_amount: Math.round(amount * 100),
          currency: 'GHS',
          payer_name: customerProfile.full_name,
          payer_email: payerEmail,
          payer_phone: payerPhone,
          initiated_by: user.id,
          metadata: {
            source: 'agent_customer_deposit_initiate_route',
            agent_id: user.id,
            agent_name: agentProfile.full_name,
            customer_id: customerProfile.id,
            customer_name: customerProfile.full_name,
            callback_page: '/agent/deposits',
          },
        })
        .select('id, internal_reference')
        .single();

    if (paymentInsertError || !paymentTransaction) {
      console.error('Agent customer deposit insert error:', paymentInsertError);
      return errorResponse(
        'Unable to create customer deposit payment. Please try again.',
        500
      );
    }

    const appUrl = getAppUrl();

    const callbackUrl = `${appUrl}/agent/deposits?payment_reference=${encodeURIComponent(
      paymentReference
    )}`;

    const paystackResponse = await initializePaystackTransaction({
      email: payerEmail,
      amount,
      reference: paymentReference,
      currency: 'GHS',
      channels: ['mobile_money'],
      callback_url: callbackUrl,
      metadata: {
        payment_transaction_id: paymentTransaction.id,
        payment_type: 'AGENT_CUSTOMER_DEPOSIT',
        agent_id: user.id,
        agent_name: agentProfile.full_name,
        user_id: customerProfile.id,
        customer_id: customerProfile.id,
        customer_name: customerProfile.full_name,
        wallet_id: wallet.id,
        internal_reference: paymentReference,
        payer_phone: payerPhone,
        callback_page: '/agent/deposits',
      },
    });

    const checkoutUrl = paystackResponse.data?.authorization_url;
    const accessCode = paystackResponse.data?.access_code;
    const providerReference = paystackResponse.data?.reference;

    if (!checkoutUrl || !accessCode) {
      return errorResponse(
        'Payment provider did not return a checkout URL. Please try again.',
        500
      );
    }

    const { error: paymentUpdateError } = await supabase
      .from('payment_transactions')
      .update({
        status: 'PROCESSING',
        checkout_url: checkoutUrl,
        access_code: accessCode,
        provider_reference: providerReference || paymentReference,
        provider_response: paystackResponse,
      })
      .eq('id', paymentTransaction.id);

    if (paymentUpdateError) {
      console.error('Agent customer payment update error:', paymentUpdateError);

      return errorResponse(
        'Payment was initialized but could not be saved. Please contact support.',
        500
      );
    }

    await supabase.rpc('create_deduped_notification', {
      p_user_id: customerProfile.id,
      p_title: 'Deposit initiated by agent',
      p_message: `Your TrustPoint deposit of GH₵${amount.toFixed(
        2
      )} has been initiated by your agent. Complete the Mobile Money payment to credit your wallet.`,
      p_type: 'INFO',
      p_related_entity_type: 'payment_transactions',
      p_related_entity_id: paymentTransaction.id,
      p_dedupe_key: `agent_customer_deposit_initiated:${paymentTransaction.id}:customer`,
    });

    await supabase.rpc('create_deduped_notification', {
      p_user_id: user.id,
      p_title: 'Customer deposit initiated',
      p_message: `You initiated a deposit of GH₵${amount.toFixed(2)} for ${
        customerProfile.full_name || 'a customer'
      }.`,
      p_type: 'INFO',
      p_related_entity_type: 'payment_transactions',
      p_related_entity_id: paymentTransaction.id,
      p_dedupe_key: `agent_customer_deposit_initiated:${paymentTransaction.id}:agent`,
    });

    return NextResponse.json({
      success: true,
      message: 'Customer deposit payment initialized successfully.',
      payment_transaction_id: paymentTransaction.id,
      customer_id: customerProfile.id,
      reference: paymentReference,
      callback_url: callbackUrl,
      authorization_url: checkoutUrl,
      access_code: accessCode,
      amount,
    });
  } catch (error) {
    console.error('Agent customer deposit initiate route error:', error);

    const message =
      error instanceof Error
        ? error.message
        : 'Something went wrong while initializing customer deposit.';

    return NextResponse.json(
      {
        success: false,
        message,
      },
      { status: 500 }
    );
  }
}