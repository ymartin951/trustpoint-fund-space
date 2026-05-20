import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

import type { Database } from '@/lib/database.types';
import { initializePaystackTransaction } from '@/lib/payments/paystack';
import { generatePaymentReference } from '@/lib/payments/references';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type AgentCustomerContributionBody = {
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

function errorResponse(message: string, status = 400) {
  return NextResponse.json(
    {
      success: false,
      message,
    },
    { status }
  );
}

function getAppUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ||
    'http://localhost:3000'
  );
}

function normalizeText(value: string | null | undefined) {
  return value?.trim() || null;
}

function normalizeRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] || null;
  return value;
}

function getAmountRemaining(contribution: ContributionWithRelations) {
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

function isActiveAgentCustomerRelationship(
  relationshipStatus: string | null | undefined
) {
  return String(relationshipStatus || '').toUpperCase() === 'ACTIVE';
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

    const body = (await request.json()) as AgentCustomerContributionBody;
    const contributionId = normalizeText(body.contribution_id);

    if (!contributionId) {
      return errorResponse('Contribution ID is required.');
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
      return errorResponse('Unable to verify agent profile.', 500);
    }

    if (!agentProfile) {
      return errorResponse('Agent profile could not be found.', 404);
    }

    if (agentProfile.role !== 'AGENT') {
      return errorResponse(
        'Only agents can initiate customer contribution payments.',
        403
      );
    }

    if (agentProfile.status !== 'ACTIVE') {
      return errorResponse('Your agent account is not active.', 403);
    }

    if (agentProfile.verification_status !== 'VERIFIED') {
      return errorResponse(
        'Your agent account must be verified before initiating payments.',
        403
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
      console.error('Agent contribution lookup error:', contributionError);
      return errorResponse('Unable to load contribution record.', 500);
    }

    if (!rawContribution) {
      return errorResponse('Contribution record not found.', 404);
    }

    const contribution = rawContribution as unknown as ContributionWithRelations;
    const relatedFundSpace = normalizeRelation(contribution.fund_spaces);
    const relatedRound = normalizeRelation(contribution.fund_space_rounds);

    const { data: agentCustomer, error: agentCustomerError } = await supabase
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

    if (!isActiveAgentCustomerRelationship(agentCustomer.relationship_status)) {
      return errorResponse(
        'This customer assignment is not active, so payment cannot be initiated.',
        403
      );
    }

    const { data: customerProfile, error: customerProfileError } =
      await supabase
        .from('profiles')
        .select(
          'id, full_name, email, phone, momo_number, role, status, verification_status'
        )
        .eq('id', contribution.user_id)
        .maybeSingle();

    if (customerProfileError) {
      console.error('Customer profile lookup error:', customerProfileError);
      return errorResponse('Unable to load customer profile.', 500);
    }

    if (!customerProfile) {
      return errorResponse('Customer profile could not be found.', 404);
    }

    if (customerProfile.role !== 'USER') {
      return errorResponse('Contribution payments can only be made for users.', 403);
    }

    if (customerProfile.status !== 'ACTIVE') {
      return errorResponse('Customer account is not active.', 403);
    }

    if (customerProfile.verification_status !== 'VERIFIED') {
      return errorResponse(
        'Customer must be verified before paying Fund Space contributions.',
        403
      );
    }

    if (!isPayableContributionStatus(contribution.status)) {
      if (String(contribution.status).toUpperCase() === 'PAID') {
        return errorResponse('This contribution has already been paid.', 409);
      }

      return errorResponse(
        `This contribution cannot be paid because its status is ${contribution.status}.`,
        409
      );
    }

    if (!relatedFundSpace) {
      return errorResponse('The related Fund Space could not be found.', 404);
    }

    if (!isActiveFundSpaceStatus(relatedFundSpace.status)) {
      return errorResponse(
        'This Fund Space is not active, so contributions cannot be paid right now.',
        409
      );
    }

    if (!relatedRound) {
      return errorResponse('The related Fund Space round could not be found.', 404);
    }

    if (!isOpenRoundStatus(relatedRound.status)) {
      return errorResponse(
        'This round is not currently accepting contribution payments.',
        409
      );
    }

    const amountRemaining = getAmountRemaining(contribution);

    if (!Number.isFinite(amountRemaining) || amountRemaining <= 0) {
      return errorResponse('There is no remaining amount to pay.', 409);
    }

    const { data: existingSuccess, error: successLookupError } = await supabase
      .from('payment_transactions')
      .select('id')
      .eq('contribution_id', contribution.id)
      .eq('provider', 'PAYSTACK')
      .in('payment_type', [
        'FUND_SPACE_CONTRIBUTION',
        'AGENT_CUSTOMER_CONTRIBUTION',
      ])
      .eq('status', 'SUCCESS')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (successLookupError) {
      console.error('Existing successful payment lookup error:', successLookupError);
      return errorResponse('Unable to verify existing payments.', 500);
    }

    if (existingSuccess) {
      return errorResponse(
        'This contribution already has a successful payment.',
        409
      );
    }

    const { data: existingPending, error: pendingLookupError } = await supabase
      .from('payment_transactions')
      .select('id, checkout_url, internal_reference, provider_reference, amount')
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

    if (pendingLookupError) {
      console.error('Existing pending payment lookup error:', pendingLookupError);
      return errorResponse('Unable to verify pending payments.', 500);
    }

    if (existingPending?.checkout_url) {
      return NextResponse.json({
        success: true,
        message:
          'This contribution already has a pending payment. Continue with the existing checkout.',
        payment_transaction_id: existingPending.id,
        contribution_id: contribution.id,
        reference:
          existingPending.provider_reference || existingPending.internal_reference,
        authorization_url: existingPending.checkout_url,
        existing_payment: true,
        amount: existingPending.amount || amountRemaining,
      });
    }

    const payerEmail = customerProfile.email || agentProfile.email || user.email;

    if (!payerEmail) {
      return errorResponse(
        'Customer or agent account needs an email before payment can be initialized.'
      );
    }

    const payerPhone =
      normalizeText(body.momo_number || body.phone) ||
      customerProfile.momo_number ||
      customerProfile.phone ||
      agentProfile.phone ||
      null;

    const { error: walletCreateError } = await supabase.rpc(
      'create_user_wallet_if_missing',
      {
        p_user_id: customerProfile.id,
      }
    );

    if (walletCreateError) {
      console.error('Customer wallet creation error:', walletCreateError);
      return errorResponse('Unable to prepare customer wallet.', 500);
    }

    const { data: wallet, error: walletError } = await supabase
      .from('wallet_accounts')
      .select('id')
      .eq('user_id', customerProfile.id)
      .maybeSingle();

    if (walletError) {
      console.error('Customer wallet lookup error:', walletError);
      return errorResponse('Unable to load customer wallet account.', 500);
    }

    if (!wallet) {
      return errorResponse('Customer wallet account was not found.', 500);
    }

    const paymentReference = generatePaymentReference(
      'AGENT_CUSTOMER_CONTRIBUTION'
    );

    const { data: paymentTransaction, error: paymentInsertError } =
      await supabase
        .from('payment_transactions')
        .insert({
          user_id: customerProfile.id,
          customer_id: customerProfile.id,
          agent_id: user.id,
          initiated_by: user.id,
          wallet_id: wallet.id,
          fund_space_id: contribution.fund_space_id,
          fund_space_round_id: contribution.round_id,
          contribution_id: contribution.id,
          payment_type: 'AGENT_CUSTOMER_CONTRIBUTION',
          direction: 'INCOMING',
          provider: 'PAYSTACK',
          channel: 'MOBILE_MONEY',
          status: 'PENDING',
          internal_reference: paymentReference,
          amount: amountRemaining,
          provider_amount: Math.round(amountRemaining * 100),
          currency: 'GHS',
          payer_name: customerProfile.full_name,
          payer_email: payerEmail,
          payer_phone: payerPhone,
          metadata: {
            source: 'agent_customer_contribution_initiate_route',
            callback_page: '/agent/fund-space/contributions',
            agent_id: user.id,
            agent_name: agentProfile.full_name,
            customer_id: customerProfile.id,
            customer_name: customerProfile.full_name,
            contribution_id: contribution.id,
            fund_space_id: contribution.fund_space_id,
            fund_space_name: relatedFundSpace.name,
            round_id: contribution.round_id,
            round_number: relatedRound.round_number,
            amount_remaining: amountRemaining,
          },
        })
        .select('id, internal_reference')
        .single();

    if (paymentInsertError || !paymentTransaction) {
      console.error(
        'Agent customer contribution payment insert error:',
        paymentInsertError
      );

      return errorResponse(
        'Unable to create contribution payment. Please try again.',
        500
      );
    }

    const appUrl = getAppUrl();

    const callbackUrl = `${appUrl}/agent/fund-space/contributions?payment_reference=${encodeURIComponent(
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
        payment_type: 'AGENT_CUSTOMER_CONTRIBUTION',
        agent_id: user.id,
        user_id: customerProfile.id,
        customer_id: customerProfile.id,
        contribution_id: contribution.id,
        fund_space_id: contribution.fund_space_id,
        round_id: contribution.round_id,
        wallet_id: wallet.id,
        internal_reference: paymentReference,
        payer_phone: payerPhone,
        callback_page: '/agent/fund-space/contributions',
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
      p_user_id: customerProfile.id,
      p_title: 'Fund Space contribution payment initiated',
      p_message: `Your weekly Fund Space contribution payment of GH₵${amountRemaining.toFixed(
        2
      )} has been initiated by your agent.`,
      p_type: 'INFO',
      p_related_entity_type: 'payment_transactions',
      p_related_entity_id: paymentTransaction.id,
      p_dedupe_key: `agent_customer_contribution_initiated:${paymentTransaction.id}:customer`,
    });

    await supabase.rpc('create_deduped_notification', {
      p_user_id: user.id,
      p_title: 'Customer contribution payment initiated',
      p_message: `You initiated a weekly Fund Space contribution payment of GH₵${amountRemaining.toFixed(
        2
      )} for ${customerProfile.full_name || 'a customer'}.`,
      p_type: 'INFO',
      p_related_entity_type: 'payment_transactions',
      p_related_entity_id: paymentTransaction.id,
      p_dedupe_key: `agent_customer_contribution_initiated:${paymentTransaction.id}:agent`,
    });

    return NextResponse.json({
      success: true,
      message: 'Customer weekly contribution payment initialized successfully.',
      payment_transaction_id: paymentTransaction.id,
      contribution_id: contribution.id,
      customer_id: customerProfile.id,
      reference: paymentReference,
      callback_url: callbackUrl,
      authorization_url: checkoutUrl,
      access_code: accessCode,
      amount: amountRemaining,
    });
  } catch (error) {
    console.error('Agent customer contribution initiate route error:', error);

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