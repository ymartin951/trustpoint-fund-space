import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';

type CreateAgentBody = {
  full_name?: string;
  email?: string;
  phone?: string;
  password?: string;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function errorResponse(message: string, status = 400) {
  return NextResponse.json(
    {
      success: false,
      error: message,
    },
    { status }
  );
}

export async function POST(request: Request) {
  try {
    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
      return errorResponse('Missing Supabase environment variables.', 500);
    }

    const authHeader = request.headers.get('authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return errorResponse('Unauthorized request.', 401);
    }

    const accessToken = authHeader.replace('Bearer ', '').trim();

    let body: CreateAgentBody;

    try {
      body = (await request.json()) as CreateAgentBody;
    } catch {
      return errorResponse('Invalid request body.', 400);
    }

    const fullName = body.full_name?.trim();
    const email = body.email?.trim().toLowerCase();
    const phone = body.phone?.trim();
    const password = body.password?.trim();

    if (!fullName) {
      return errorResponse('Agent full name is required.', 400);
    }

    if (!email) {
      return errorResponse('Agent email is required.', 400);
    }

    if (!phone) {
      return errorResponse('Agent phone number is required.', 400);
    }

    if (!password || password.length < 6) {
      return errorResponse('Password must be at least 6 characters.', 400);
    }

    const userClient = createClient<Database>(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const adminClient = createClient<Database>(
      supabaseUrl,
      supabaseServiceRoleKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      return errorResponse('Invalid admin session.', 401);
    }

    const { data: requesterProfile, error: requesterProfileError } =
      await adminClient
        .from('profiles')
        .select('id, role, status')
        .eq('id', user.id)
        .maybeSingle();

    if (requesterProfileError) {
      return errorResponse(requesterProfileError.message, 500);
    }

    if (!requesterProfile) {
      return errorResponse('Admin profile not found.', 403);
    }

    if (requesterProfile.role !== 'SUPER_ADMIN') {
      return errorResponse('Only Super Admin can create agents.', 403);
    }

    if (requesterProfile.status !== 'ACTIVE') {
      return errorResponse('Your Super Admin account is not active.', 403);
    }

   const { data: existingEmailProfile, error: existingEmailProfileError } =
  await adminClient
    .from('profiles')
    .select('id, email, role')
    .eq('email', email)
    .maybeSingle();

if (existingEmailProfileError) {
  return errorResponse(existingEmailProfileError.message, 500);
}

if (existingEmailProfile) {
  return errorResponse('A user profile with this email already exists.', 409);
}

const { data: existingPhoneProfile, error: existingPhoneProfileError } =
  await adminClient
    .from('profiles')
    .select('id, phone, role')
    .eq('phone', phone)
    .maybeSingle();

if (existingPhoneProfileError) {
  return errorResponse(existingPhoneProfileError.message, 500);
}

if (existingPhoneProfile) {
  return errorResponse('A user profile with this phone number already exists.', 409);
}

 const { data: createdUserData, error: createUserError } =
  await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      phone,
      role: 'AGENT',
      user_category: 'OTHER',
      country: 'Ghana',
    },
    app_metadata: {
      role: 'AGENT',
    },
  });

if (createUserError) {
  console.error('Supabase create agent auth error:', createUserError);

  return errorResponse(
    createUserError.message || 'Unable to create agent auth account.',
    500
  );
}

if (!createdUserData.user) {
  return errorResponse('Supabase did not return the created agent user.', 500);
}


    const createdUser = createdUserData.user;

const { error: profileError } = await adminClient.from('profiles').upsert(
  {
    id: createdUser.id,
    full_name: fullName,
    email,
    phone,
    role: 'AGENT',
    status: 'ACTIVE',
    user_category: 'OTHER',
    country: 'Ghana',
    verification_status: 'VERIFIED',
    ghana_card_verified: false,
    trust_score: 100,
    missed_payment_count: 0,
    successful_cycles_count: 0,
    has_received_payout_before: false,
    is_blacklisted: false,
    terms_accepted: true,
    terms_accepted_at: new Date().toISOString(),
    verified_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } as any,
  {
    onConflict: 'id',
  }
);

    if (profileError) {
      await adminClient.auth.admin.deleteUser(createdUser.id);

      return errorResponse(profileError.message, 500);
    }

    return NextResponse.json({
      success: true,
      message: 'Agent created successfully.',
      agent: {
        id: createdUser.id,
        full_name: fullName,
        email,
        phone,
        role: 'AGENT',
        status: 'ACTIVE',
      },
    });
  } catch (error) {
    console.error('Create agent API error:', error);

    const message =
      error instanceof Error ? error.message : 'Unable to create agent.';

    return errorResponse(message, 500);
  }
}