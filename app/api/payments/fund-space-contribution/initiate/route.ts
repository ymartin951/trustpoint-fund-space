import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

import type { Database } from '@/lib/database.types';
import { initializePaystackTransaction } from '@/lib/payments/paystack';
import { generatePaymentReference } from '@/lib/payments/references';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type FundSpaceContributionPaymentBody = {
  contribution_id?: string;
  momo_number?: string;
  phone?: string;
};

type RelatedFundSpace = {
  id: string;
  name: string | null;
  contribution_amount: number;
  status: string;
};

type RelatedRound = {
  id: string;
  round_number: number;
  status: string;
  contribution_deadline: string | null;
};

type ContributionWithRelations = {
  id: string;
  fund_space_id: string;
  round_id: string;
  user_id: string;
  amount_due: number;
  amount_paid: number;
  status: string;
  fund_spaces: RelatedFundSpace | RelatedFundSpace[] | null;
  fund_space_rounds: RelatedRound | RelatedRound[] | null;
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

function normalizePhone(value: string | undefined | null) {
  return value?.trim() || null;
}

function normalizeRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] || null;
  return value;
}

function getAmountRemaining(contribution: Pick<ContributionWithRelations, 'amount_due' | 'amount_paid'>) {
  return Math.max(
    Number(contribution.amount_due || 0) - Number(contribution.amount_paid || 0),
    0
  );
}

function isPayableContributionStatus(status: string | null | undefined) {
  return ['PENDING', 'OVERDUE', 'PARTIALLY_PAID'].includes(
    String(status || '').toUpperCase()
  );
}

function isActiveFundSpaceStatus(status: string | null | undefined) {
  return String(status || '').toUpperCase() === 'ACTIVE';
}

function isOpenRoundStatus(status: string | null | undefined) {
  return ['COLLECTING', 'READY_FOR_ADMIN_APPROVAL'].includes(
    String(status || '').toUpperCase()
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

    const body = (await request.json()) as FundSpaceContributionPaymentBody;

    if (!body.contribution_id?.trim()) {
      return errorResponse('Contribution ID is required.');
    }

    const contributionId = body.contribution_id.trim();

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
      console.error('Contribution payment profile lookup error:', profileError);
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
      return errorResponse(
        'Only users and agents can pay Fund Space contributions.',
        403
      );
    }

    if (profile.verification_status !== 'VERIFIED') {
      return errorResponse(
        'Your account must be verified before paying Fund Space contributions.',
        403
      );
    }

    const payerEmail = profile.email || user.email;

    if (!payerEmail) {
      return errorResponse(
        'Your account needs an email address before payment can be initialized.'
      );
    }

    const { data: rawContribution, error: contributionError } = await supabase
      .from('fund_space_contributions')
      .select(
        `
        id,
        fund_space_id,
        round_id,
        user_id,
        amount_due,
        amount_paid,
        status,
        fund_spaces (
          id,
          name,
          contribution_amount,
          status
        ),
        fund_space_rounds (
          id,
          round_number,
          status,
          contribution_deadline
        )
      `
      )
      .eq('id', contributionId)
      .maybeSingle();

    if (contributionError) {
      console.error('Contribution lookup error:', contributionError);
      return errorResponse(
        'Unable to load the contribution. Please try again.',
        500
      );
    }

    if (!rawContribution) {
      return errorResponse('Contribution not found.', 404);
    }

    const contribution = rawContribution as unknown as ContributionWithRelations;
    const relatedFundSpace = normalizeRelation(contribution.fund_spaces);
    const relatedRound = normalizeRelation(contribution.fund_space_rounds);

    if (contribution.user_id !== user.id) {
      return errorResponse(
        'You can only pay your own Fund Space contribution.',
        403
      );
    }

    if (!isPayableContributionStatus(contribution.status)) {
      if (String(contribution.status).toUpperCase() === 'PAID') {
        return errorResponse('This contribution has already been paid.', 409);
      }

      if (String(contribution.status).toUpperCase() === 'WAIVED') {
        return errorResponse('This contribution has been waived.', 409);
      }

      return errorResponse(
        `This contribution cannot be paid because its status is ${contribution.status}.`,
        409
      );
    }

    if (relatedFundSpace && !isActiveFundSpaceStatus(relatedFundSpace.status)) {
      return errorResponse(
        'This Fund Space is not active, so contributions cannot be paid right now.',
        409
      );
    }

    if (relatedRound && !isOpenRoundStatus(relatedRound.status)) {
      return errorResponse(
        'This round is not currently accepting contribution payments.',
        409
      );
    }

    const amountRemaining = getAmountRemaining(contribution);

    if (!Number.isFinite(amountRemaining) || amountRemaining <= 0) {
      return errorResponse('There is no remaining amount to pay.', 409);
    }

    const { data: existingSuccessfulPayment, error: successfulPaymentError } =
      await supabase
        .from('payment_transactions')
        .select('id, status, checkout_url, internal_reference, provider_reference')
        .eq('contribution_id', contribution.id)
        .eq('provider', 'PAYSTACK')
        .in('payment_type', [
          'FUND_SPACE_CONTRIBUTION',
          'AGENT_CUSTOMER_CONTRIBUTION',
        ])
        .eq('status', 'SUCCESS')
        .maybeSingle();

    if (successfulPaymentError) {
      console.error(
        'Existing successful contribution payment lookup error:',
        successfulPaymentError
      );

      return errorResponse(
        'Unable to verify existing payments. Please try again.',
        500
      );
    }

    if (existingSuccessfulPayment) {
      return errorResponse(
        'This contribution already has a successful payment.',
        409
      );
    }

    const { data: existingPendingPayment, error: pendingPaymentError } =
      await supabase
        .from('payment_transactions')
        .select('id, status, checkout_url, internal_reference, provider_reference')
        .eq('contribution_id', contribution.id)
        .eq('provider', 'PAYSTACK')
        .in('payment_type', [
          'FUND_SPACE_CONTRIBUTION',
          'AGENT_CUSTOMER_CONTRIBUTION',
        ])
        .in('status', ['PENDING', 'PROCESSING'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (pendingPaymentError) {
      console.error(
        'Existing pending contribution payment lookup error:',
        pendingPaymentError
      );

      return errorResponse(
        'Unable to verify pending payments. Please try again.',
        500
      );
    }

    if (existingPendingPayment?.checkout_url) {
      return NextResponse.json({
        success: true,
        message:
          'You already have a pending payment for this contribution. Continue with the existing checkout.',
        payment_transaction_id: existingPendingPayment.id,
        contribution_id: contribution.id,
        reference:
          existingPendingPayment.provider_reference ||
          existingPendingPayment.internal_reference,
        authorization_url: existingPendingPayment.checkout_url,
        existing_payment: true,
        amount: amountRemaining,
      });
    }

    const payerPhone =
      normalizePhone(body.momo_number || body.phone) ||
      profile.momo_number ||
      profile.phone;

    const paymentReference = generatePaymentReference('FUND_SPACE_CONTRIBUTION');

    const { error: walletCreateError } = await supabase.rpc(
      'create_user_wallet_if_missing',
      {
        p_user_id: user.id,
      }
    );

    if (walletCreateError) {
      console.error('Wallet creation error:', walletCreateError);

      return errorResponse(
        'Unable to prepare your wallet for payment. Please try again.',
        500
      );
    }

    const { data: wallet, error: walletError } = await supabase
      .from('wallet_accounts')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (walletError || !wallet) {
      console.error('Wallet lookup error:', walletError);
      return errorResponse('Wallet account not found. Please try again.', 500);
    }

    const { data: paymentTransaction, error: paymentInsertError } =
      await supabase
        .from('payment_transactions')
        .insert({
          user_id: user.id,
          wallet_id: wallet.id,
          fund_space_id: contribution.fund_space_id,
          fund_space_round_id: contribution.round_id,
          contribution_id: contribution.id,
          payment_type: 'FUND_SPACE_CONTRIBUTION',
          direction: 'INCOMING',
          provider: 'PAYSTACK',
          channel: 'MOBILE_MONEY',
          status: 'PENDING',
          internal_reference: paymentReference,
          amount: amountRemaining,
          provider_amount: Math.round(amountRemaining * 100),
          currency: 'GHS',
          payer_name: profile.full_name,
          payer_email: payerEmail,
          payer_phone: payerPhone,
          initiated_by: user.id,
          metadata: {
            source: 'fund_space_contribution_payment_initiate_route',
            contribution_id: contribution.id,
            fund_space_id: contribution.fund_space_id,
            fund_space_name: relatedFundSpace?.name || null,
            round_id: contribution.round_id,
            round_number: relatedRound?.round_number || null,
            amount_due: contribution.amount_due,
            amount_paid: contribution.amount_paid,
            amount_remaining: amountRemaining,
            callback_page: `/dashboard/fund-space/${contribution.fund_space_id}`,
          },
        })
        .select('id, internal_reference')
        .single();

    if (paymentInsertError || !paymentTransaction) {
      console.error(
        'Contribution payment transaction insert error:',
        paymentInsertError
      );

      return errorResponse(
        'Unable to create contribution payment. Please try again.',
        500
      );
    }

    const appUrl = getAppUrl();

    const callbackUrl = `${appUrl}/dashboard/fund-space/${contribution.fund_space_id}?payment_reference=${encodeURIComponent(
      paymentReference
    )}`;

    const paystackResponse = await initializePaystackTransaction({
      email: payerEmail,
      amount: amountRemaining,
      reference: paymentReference,
      currency: 'GHS',
      channels: ['mobile_money'],
      callback_url: callbackUrl,
      metadata: {
        payment_transaction_id: paymentTransaction.id,
        payment_type: 'FUND_SPACE_CONTRIBUTION',
        user_id: user.id,
        wallet_id: wallet.id,
        contribution_id: contribution.id,
        fund_space_id: contribution.fund_space_id,
        fund_space_name: relatedFundSpace?.name || null,
        round_id: contribution.round_id,
        round_number: relatedRound?.round_number || null,
        internal_reference: paymentReference,
        payer_phone: payerPhone,
        callback_page: `/dashboard/fund-space/${contribution.fund_space_id}`,
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
      console.error(
        'Contribution payment transaction update error:',
        paymentUpdateError
      );

      return errorResponse(
        'Payment was initialized but could not be saved. Please contact support.',
        500
      );
    }

    await supabase.rpc('create_deduped_notification', {
      p_user_id: user.id,
      p_title: 'Contribution payment initiated',
      p_message: `Your Fund Space contribution payment of GH₵${amountRemaining.toFixed(
        2
      )} has been initiated. Complete the Mobile Money payment to confirm your contribution.`,
      p_type: 'INFO',
      p_related_entity_type: 'payment_transactions',
      p_related_entity_id: paymentTransaction.id,
      p_dedupe_key: `fund_contribution_payment_initiated:${paymentTransaction.id}`,
    });

    return NextResponse.json({
      success: true,
      message: 'Fund Space contribution payment initialized successfully.',
      payment_transaction_id: paymentTransaction.id,
      contribution_id: contribution.id,
      reference: paymentReference,
      callback_url: callbackUrl,
      authorization_url: checkoutUrl,
      access_code: accessCode,
      amount: amountRemaining,
    });
  } catch (error) {
    console.error('Fund Space contribution payment initiate route error:', error);

    const message =
      error instanceof Error
        ? error.message
        : 'Something went wrong while initializing contribution payment.';

    return NextResponse.json(
      {
        success: false,
        message,
      },
      { status: 500 }
    );
  }
}