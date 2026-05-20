import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

import type { Database } from '@/lib/database.types';
import { initializePaystackTransaction } from '@/lib/payments/paystack';
import { generatePaymentReference } from '@/lib/payments/references';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type WalletDepositRequestBody = {
  amount?: number | string;
  phone?: string;
  momo_number?: string;
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

function parseAmount(value: number | string | undefined) {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string') {
    return Number(value.replace(/,/g, '').trim());
  }

  return NaN;
}

function normalizePhone(value: string | undefined | null) {
  return value?.trim() || null;
}

function getAppUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ||
    'http://localhost:3000'
  );
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

    const body = (await request.json()) as WalletDepositRequestBody;

    const amount = parseAmount(body.amount);
    const payerPhone = normalizePhone(body.phone || body.momo_number);

    if (!Number.isFinite(amount) || amount <= 0) {
      return errorResponse('Please enter a valid deposit amount.');
    }

    if (amount < 1) {
      return errorResponse('Minimum wallet deposit amount is GH₵1.');
    }

    if (amount > 100000) {
      return errorResponse('Maximum wallet deposit amount is GH₵100,000.');
    }

    const supabase = createServiceClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(accessToken);

    if (userError || !user) {
      return errorResponse('Your session has expired. Please log in again.', 401);
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select(
        'id, full_name, email, phone, momo_number, role, status, verification_status'
      )
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      console.error('Wallet deposit profile lookup error:', profileError);
      return errorResponse('Unable to load your profile. Please try again.', 500);
    }

    if (!profile) {
      return errorResponse('Profile not found. Please contact support.', 404);
    }

    if (profile.status !== 'ACTIVE') {
      return errorResponse(
        'Your account is not active. Please contact TrustPoint support.',
        403
      );
    }

    if (profile.role !== 'USER' && profile.role !== 'AGENT') {
      return errorResponse('Only users and agents can make wallet deposits.', 403);
    }

    if (profile.verification_status !== 'VERIFIED') {
      return errorResponse(
        'Your account must be verified before making real wallet deposits.',
        403
      );
    }

    const payerEmail = profile.email || user.email;

    if (!payerEmail) {
      return errorResponse(
        'Your account needs an email address before payment can be initialized.'
      );
    }

    const paymentReference = generatePaymentReference('WALLET_DEPOSIT');

    const { data: walletData, error: walletError } = await supabase.rpc(
      'create_user_wallet_if_missing',
      {
        p_user_id: user.id,
      }
    );

    if (walletError) {
      console.error('Wallet creation error:', walletError, walletData);
      return errorResponse(
        'Unable to prepare your wallet for deposit. Please try again.',
        500
      );
    }

    const { data: wallet, error: walletLookupError } = await supabase
      .from('wallet_accounts')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (walletLookupError || !wallet) {
      console.error('Wallet lookup error:', walletLookupError);
      return errorResponse('Wallet account not found. Please try again.', 500);
    }

    const { data: paymentTransaction, error: paymentInsertError } =
      await supabase
        .from('payment_transactions')
        .insert({
          user_id: user.id,
          wallet_id: wallet.id,
          payment_type: 'WALLET_DEPOSIT',
          direction: 'INCOMING',
          provider: 'PAYSTACK',
          channel: 'MOBILE_MONEY',
          status: 'PENDING',
          internal_reference: paymentReference,
          amount,
          provider_amount: Math.round(amount * 100),
          currency: 'GHS',
          payer_name: profile.full_name,
          payer_email: payerEmail,
          payer_phone: payerPhone || profile.momo_number || profile.phone,
          initiated_by: user.id,
          metadata: {
            source: 'wallet_deposit_initiate_route',
            user_role: profile.role,
            callback_page: '/dashboard/deposit',
          },
        })
        .select('id, internal_reference')
        .single();

    if (paymentInsertError || !paymentTransaction) {
      console.error('Payment transaction insert error:', paymentInsertError);
      return errorResponse(
        'Unable to create payment transaction. Please try again.',
        500
      );
    }

    const appUrl = getAppUrl();

    const callbackUrl = `${appUrl}/dashboard/deposit?payment_reference=${encodeURIComponent(
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
        payment_type: 'WALLET_DEPOSIT',
        user_id: user.id,
        wallet_id: wallet.id,
        internal_reference: paymentReference,
        payer_phone: payerPhone || profile.momo_number || profile.phone,
        callback_page: '/dashboard/deposit',
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
      console.error('Payment transaction update error:', paymentUpdateError);
      return errorResponse(
        'Payment was initialized but could not be saved. Please contact support.',
        500
      );
    }

    await supabase.rpc('create_deduped_notification', {
      p_user_id: user.id,
      p_title: 'Payment initiated',
      p_message: `Your wallet deposit of GH₵${amount.toFixed(
        2
      )} has been initiated. Complete the Mobile Money payment to credit your wallet.`,
      p_type: 'INFO',
      p_related_entity_type: 'payment_transactions',
      p_related_entity_id: paymentTransaction.id,
      p_dedupe_key: `wallet_deposit_initiated:${paymentTransaction.id}`,
    });

    return NextResponse.json({
      success: true,
      message: 'Wallet deposit payment initialized successfully.',
      payment_transaction_id: paymentTransaction.id,
      reference: paymentReference,
      callback_url: callbackUrl,
      authorization_url: checkoutUrl,
      access_code: accessCode,
    });
  } catch (error) {
    console.error('Wallet deposit initiate route error:', error);

    const message =
      error instanceof Error
        ? error.message
        : 'Something went wrong while initializing wallet deposit.';

    return NextResponse.json(
      {
        success: false,
        message,
      },
      { status: 500 }
    );
  }
}