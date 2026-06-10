import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type AppRole = 'USER' | 'AGENT' | 'ADMIN' | 'SUPER_ADMIN';
type PayerType = 'CUSTOMER_SELF' | 'THIRD_PARTY' | 'AGENT_ASSISTED';

type ManualPaymentSubmissionBody = {
  contribution_id?: string;
  amount_due?: number | string;
  service_fee?: number | string;
  total_amount_paid?: number | string;
  transaction_reference?: string;
  sender_name?: string;
  sender_phone?: string;
  sender_network?: string;
  company_payment_account_id?: string | null;
  payer_type?: string;
  payer_relationship?: string;
  payment_note?: string;
  screenshot_url?: string;
  actual_payment_date?: string;
  actual_payment_time?: string;
};

type ContributionOwnershipRow = {
  id: string;
  user_id: string;
};

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

function getAnonKey() {
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!anonKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is not configured.');
  }

  return anonKey;
}

function getServiceRoleKey() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured.');
  }

  return serviceRoleKey;
}

function createUserClient(accessToken: string) {
  return createClient(getSupabaseUrl(), getAnonKey(), {
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
  return createClient(getSupabaseUrl(), getServiceRoleKey(), {
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

async function getAccessToken(request: NextRequest) {
  const authorizationHeader =
    request.headers.get('authorization') ||
    request.headers.get('Authorization');

  if (!authorizationHeader?.startsWith('Bearer ')) {
    return null;
  }

  return authorizationHeader.replace('Bearer ', '').trim();
}

function normalizeText(value: string | null | undefined) {
  return String(value || '').trim() || null;
}

function normalizeNumber(value: number | string | null | undefined) {
  const amount =
    typeof value === 'string' ? Number(value.replace(/,/g, '')) : Number(value);

  if (!Number.isFinite(amount)) return 0;

  return amount;
}

function normalizeRole(role: string | null | undefined): AppRole | 'UNKNOWN' {
  const value = String(role || '')
    .trim()
    .toUpperCase()
    .replaceAll(' ', '_')
    .replaceAll('-', '_');

  if (value === 'SUPER_ADMIN') return 'SUPER_ADMIN';
  if (value === 'ADMIN') return 'ADMIN';
  if (value === 'AGENT') return 'AGENT';
  if (value === 'USER') return 'USER';

  return 'UNKNOWN';
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

  return 'AGENT_ASSISTED';
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
    return relationship || 'Agent assisted payment';
  }

  return relationship || null;
}

function buildPaymentNote({
  payerType,
  payerRelationship,
  paymentNote,
  actualPaymentDate,
  actualPaymentTime,
}: {
  payerType: PayerType;
  payerRelationship: string | null;
  paymentNote: string | null;
  actualPaymentDate: string | null;
  actualPaymentTime: string | null;
}) {
  const parts = [
    `Payer Type: ${payerType}`,
    `Payer Relationship: ${payerRelationship || 'Not provided'}`,
  ];

  if (actualPaymentDate || actualPaymentTime) {
    parts.push(
      `Actual Payment Date/Time: ${actualPaymentDate || 'Not provided'} ${
        actualPaymentTime || ''
      }`.trim()
    );
  }

  if (paymentNote) {
    parts.push(`Note: ${paymentNote}`);
  }

  return parts.join('\n');
}

function parseContributionIds(value: string | null) {
  if (!value) return [];

  return Array.from(
    new Set(
      value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
}

function isPayableContributionStatus(status: string | null | undefined) {
  const value = String(status || '').toUpperCase();

  return [
    'PENDING',
    'DUE',
    'OVERDUE',
    'UNPAID',
    'PARTIAL',
    'PARTIALLY_PAID',
    'LATE',
    'MISSED',
  ].includes(value);
}

function isActiveAgentCustomerRelationship(status: string | null | undefined) {
  const value = String(status || '').toUpperCase();

  return ['ACTIVE', 'APPROVED', 'VERIFIED'].includes(value);
}

function isValidDateInput(value: string | null | undefined) {
  if (!value) return false;

  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isValidTimeInput(value: string | null | undefined) {
  if (!value) return false;

  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

async function loadSubmissionsForContributions(
  serviceSupabase: ReturnType<typeof createServiceClient>,
  contributionIds: string[]
) {
  if (contributionIds.length === 0) {
    return {
      submissions: [],
      error: null,
    };
  }

  const { data, error } = await serviceSupabase
    .from('manual_payment_submissions')
    .select(
      `
      id,
      contribution_id,
      fund_space_id,
      user_id,
      agent_id,
      status,
      transaction_reference,
      total_amount_paid,
      rejection_reason,
      actual_payment_date,
      actual_payment_time,
      actual_payment_at,
      actual_payment_source,
      created_at,
      reviewed_at
    `
    )
    .in('contribution_id', contributionIds)
    .in('status', ['PENDING_REVIEW', 'REJECTED'])
    .order('created_at', { ascending: false });

  return {
    submissions: data || [],
    error,
  };
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
    console.error('Pending agent MoMo submission lookup error:', pendingError);

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
    console.error('Agent transaction reference lookup error:', referenceError);

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

export async function GET(request: NextRequest) {
  try {
    const accessToken = await getAccessToken(request);

    if (!accessToken) {
      return errorResponse('Unauthorized request. Please log in again.', 401);
    }

    const { searchParams } = new URL(request.url);
    const contributionIds = parseContributionIds(
      searchParams.get('contribution_ids')
    );

    if (contributionIds.length === 0) {
      return NextResponse.json({
        success: true,
        submissions: [],
      });
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
      .select('id, role, status')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError || !profile) {
      return errorResponse('Agent profile was not found.', 403);
    }

    const role = normalizeRole(profile.role);
    const status = String(profile.status || '').toUpperCase();

    if (status !== 'ACTIVE') {
      return errorResponse('Your account is not active.', 403);
    }

    if (!['AGENT', 'ADMIN', 'SUPER_ADMIN'].includes(role)) {
      return errorResponse(
        'Only agents, admins, or super admins can access these payment submissions.',
        403
      );
    }

    const { data: contributionRows, error: contributionError } =
      await serviceSupabase
        .from('fund_space_contributions')
        .select('id, user_id')
        .in('id', contributionIds);

    if (contributionError) {
      console.error(
        'Agent contribution ownership lookup error:',
        contributionError
      );

      return errorResponse('Unable to verify contribution ownership.', 500);
    }

    const contributions = (contributionRows || []) as ContributionOwnershipRow[];

    if (contributions.length === 0) {
      return NextResponse.json({
        success: true,
        submissions: [],
      });
    }

    if (role === 'ADMIN' || role === 'SUPER_ADMIN') {
      const { submissions, error } = await loadSubmissionsForContributions(
        serviceSupabase,
        contributionIds
      );

      if (error) {
        console.error('Manual payment submissions load error:', error);

        return errorResponse(
          'Unable to load MoMo verification submissions.',
          500
        );
      }

      return NextResponse.json({
        success: true,
        submissions,
      });
    }

    const ownContributionIds = contributions
      .filter((item) => item.user_id === user.id)
      .map((item) => item.id);

    const customerIdsNeedingAssignmentCheck = Array.from(
      new Set(
        contributions
          .filter((item) => item.user_id !== user.id)
          .map((item) => item.user_id)
          .filter(Boolean)
      )
    );

    let assignedCustomerIds = new Set<string>();

    if (customerIdsNeedingAssignmentCheck.length > 0) {
      const { data: assignedCustomers, error: assignedError } =
        await serviceSupabase
          .from('agent_customers')
          .select('customer_id, relationship_status')
          .eq('agent_id', user.id)
          .in('customer_id', customerIdsNeedingAssignmentCheck);

      if (assignedError) {
        console.error('Agent assigned customers lookup error:', assignedError);

        return errorResponse('Unable to verify assigned customers.', 500);
      }

      assignedCustomerIds = new Set(
        (assignedCustomers || [])
          .filter((item) =>
            isActiveAgentCustomerRelationship(item.relationship_status)
          )
          .map((item) => item.customer_id)
          .filter(Boolean)
      );
    }

    const assignedCustomerContributionIds = contributions
      .filter(
        (item) =>
          item.user_id !== user.id && assignedCustomerIds.has(item.user_id)
      )
      .map((item) => item.id);

    const allowedContributionIds = Array.from(
      new Set([...ownContributionIds, ...assignedCustomerContributionIds])
    );

    if (allowedContributionIds.length === 0) {
      return NextResponse.json({
        success: true,
        submissions: [],
      });
    }

    const { submissions, error } = await loadSubmissionsForContributions(
      serviceSupabase,
      allowedContributionIds
    );

    if (error) {
      console.error('Agent manual payment submissions load error:', error);

      return errorResponse('Unable to load MoMo verification submissions.', 500);
    }

    return NextResponse.json({
      success: true,
      submissions,
    });
  } catch (error) {
    console.error('Agent manual submissions GET route error:', error);

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : 'Something went wrong while loading MoMo submissions.',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const accessToken = await getAccessToken(request);

    if (!accessToken) {
      return errorResponse('Unauthorized request. Please log in again.', 401);
    }

    const body = (await request.json().catch(() => null)) as
      | ManualPaymentSubmissionBody
      | null;

    if (!body) {
      return errorResponse('Invalid request body.', 400);
    }

    const contributionId = normalizeText(body.contribution_id);
    const transactionReference = normalizeText(body.transaction_reference);
    const totalAmountPaid = normalizeNumber(body.total_amount_paid);
    const submittedAmountDue = normalizeNumber(body.amount_due);
    const submittedServiceFee = normalizeNumber(body.service_fee);

    const actualPaymentDate = normalizeText(body.actual_payment_date);
    const actualPaymentTime = normalizeText(body.actual_payment_time);

    const payerType = normalizePayerType(body.payer_type);
    const payerRelationship = normalizePayerRelationship({
      payerType,
      payerRelationship: body.payer_relationship,
    });

    const cleanPaymentNote = normalizeText(body.payment_note);

    if (!contributionId) {
      return errorResponse('Contribution ID is required.');
    }

    if (!transactionReference) {
      return errorResponse('Transaction reference is required.');
    }

    if (totalAmountPaid <= 0) {
      return errorResponse('Total amount paid must be greater than zero.');
    }

    if (!actualPaymentDate || !isValidDateInput(actualPaymentDate)) {
      return errorResponse('Please provide a valid actual payment date.');
    }

    if (!actualPaymentTime || !isValidTimeInput(actualPaymentTime)) {
      return errorResponse('Please provide a valid actual payment time.');
    }

    if (payerType !== 'CUSTOMER_SELF' && !payerRelationship) {
      return errorResponse(
        'Please provide the relationship of the person who made this payment.'
      );
    }

    const enhancedPaymentNote = buildPaymentNote({
      payerType,
      payerRelationship,
      paymentNote: cleanPaymentNote,
      actualPaymentDate,
      actualPaymentTime,
    });

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
      console.error('Agent manual payment profile lookup error:', profileError);
      return errorResponse('Unable to verify your profile.', 500);
    }

    if (!profile) {
      return errorResponse('Profile not found for this account.', 404);
    }

    const role = normalizeRole(profile.role);

    if (!['AGENT', 'ADMIN', 'SUPER_ADMIN'].includes(role)) {
      return errorResponse(
        'Only agents, admins, or super admins can submit payment from this route.',
        403
      );
    }

    if (String(profile.status || '').toUpperCase() !== 'ACTIVE') {
      return errorResponse('Your account is not active.', 403);
    }

    if (String(profile.verification_status || '').toUpperCase() !== 'VERIFIED') {
      return errorResponse(
        'Your account must be verified before submitting payment.',
        403
      );
    }

    const { data: contributionData, error: contributionError } =
      await serviceSupabase
        .from('fund_space_contributions')
        .select(
          'id, fund_space_id, round_id, user_id, amount_due, amount_paid, status'
        )
        .eq('id', contributionId)
        .maybeSingle();

    if (contributionError) {
      console.error(
        'Agent manual payment contribution lookup error:',
        contributionError
      );
      return errorResponse('Unable to load contribution record.', 500);
    }

    if (!contributionData) {
      return errorResponse('Contribution record not found.', 404);
    }

    const contribution = contributionData as ContributionRow;
    const isOwnContribution = contribution.user_id === user.id;

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

      if (!isActiveAgentCustomerRelationship(agentCustomer.relationship_status)) {
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
      console.error(
        'Contribution owner profile lookup error:',
        ownerProfileError
      );
      return errorResponse('Unable to load contribution owner profile.', 500);
    }

    if (!contributionOwnerProfile) {
      return errorResponse('Contribution owner profile was not found.', 404);
    }

    if (String(contributionOwnerProfile.status || '').toUpperCase() !== 'ACTIVE') {
      return errorResponse('The contribution owner account is not active.', 403);
    }

    if (
      String(contributionOwnerProfile.verification_status || '').toUpperCase() !==
      'VERIFIED'
    ) {
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
        `This contribution cannot be paid because its current status is ${
          contribution.status || 'UNKNOWN'
        }.`,
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

    const insertPayload: Record<string, unknown> = {
      contribution_id: contribution.id,
      fund_space_id: contribution.fund_space_id,
      round_id: contribution.round_id,
      user_id: contribution.user_id,
      agent_id: role === 'AGENT' && !isOwnContribution ? user.id : null,

      company_payment_account_id: normalizeText(body.company_payment_account_id),

      amount_due: submittedAmountDue > 0 ? submittedAmountDue : amountDue,
      service_fee: submittedServiceFee,
      total_amount_paid: totalAmountPaid,

      sender_name: normalizeText(body.sender_name),
      sender_phone: normalizeText(body.sender_phone),
      sender_network: normalizedSenderNetwork,

      transaction_reference: transactionReference,
      payment_note: enhancedPaymentNote || null,
      screenshot_url: normalizeText(body.screenshot_url),

      submitted_by: user.id,
      submitted_by_role: role,

      status: 'PENDING_REVIEW',

      payer_type: payerType,
      payer_relationship: payerRelationship,

      actual_payment_date: actualPaymentDate,
      actual_payment_time: actualPaymentTime,
      actual_payment_source: 'USER_PROVIDED',
    };

    const { data: submission, error: insertError } = await serviceSupabase
      .from('manual_payment_submissions')
      .insert(insertPayload)
      .select(
        `
        id,
        contribution_id,
        fund_space_id,
        user_id,
        agent_id,
        status,
        transaction_reference,
        total_amount_paid,
        actual_payment_date,
        actual_payment_time,
        actual_payment_at,
        actual_payment_source,
        created_at
      `
      )
      .single();

    if (insertError) {
      console.error('Agent manual MoMo payment insert error:', insertError);

      return errorResponse(
        insertError.message || 'Unable to submit payment for verification.',
        500
      );
    }

    const submissionId = String(submission?.id || '');

    if (!submissionId) {
      return errorResponse(
        'Payment submission was created but no submission ID was returned.',
        500
      );
    }

    const rpcClient = serviceSupabase as any;

    await rpcClient.rpc('create_deduped_notification', {
      p_user_id: contribution.user_id,
      p_title: 'MoMo payment submitted',
      p_message:
        'Your MoMo payment reference has been submitted successfully and is awaiting admin verification.',
      p_type: 'INFO',
      p_related_entity_type: 'manual_payment_submissions',
      p_related_entity_id: submissionId,
      p_dedupe_key: `manual_payment_submitted:${submissionId}:customer`,
    });

    if (role === 'AGENT' && !isOwnContribution) {
      await rpcClient.rpc('create_deduped_notification', {
        p_user_id: user.id,
        p_title: 'Customer MoMo payment submitted',
        p_message:
          'You submitted a customer MoMo payment reference successfully. It is awaiting admin verification.',
        p_type: 'INFO',
        p_related_entity_type: 'manual_payment_submissions',
        p_related_entity_id: submissionId,
        p_dedupe_key: `manual_payment_submitted:${submissionId}:agent`,
      });
    }

    const { data: admins, error: adminsError } = await serviceSupabase
      .from('profiles')
      .select('id')
      .in('role', ['ADMIN', 'SUPER_ADMIN'])
      .eq('status', 'ACTIVE');

    if (adminsError) {
      console.error(
        'Admin lookup for agent manual payment notification warning:',
        adminsError
      );
    }

    if (admins && admins.length > 0) {
      await Promise.all(
        admins.map((admin) =>
          rpcClient.rpc('create_deduped_notification', {
            p_user_id: admin.id,
            p_title: 'New MoMo payment needs verification',
            p_message: `${
              contributionOwnerProfile.full_name || 'A Fund Space member'
            } submitted a MoMo payment reference for admin verification.`,
            p_type: 'INFO',
            p_related_entity_type: 'manual_payment_submissions',
            p_related_entity_id: submissionId,
            p_dedupe_key: `manual_payment_submitted:${submissionId}:admin:${admin.id}`,
          })
        )
      );
    }

    return NextResponse.json({
      success: true,
      message:
        'MoMo payment reference submitted successfully. Admin will verify the transaction before confirming the contribution.',
      submission,
    });
  } catch (error) {
    console.error('Agent manual submissions POST route error:', error);

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : 'Something went wrong while submitting MoMo payment.',
      },
      { status: 500 }
    );
  }
}