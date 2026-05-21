import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

import type { Database } from '@/lib/database.types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type CompanyPaymentAccountRow =
  Database['public']['Tables']['company_payment_accounts']['Row'];

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

function getDisplayNetwork(network: string | null | undefined) {
  const value = String(network || '').toUpperCase();

  if (value === 'MTN_MOMO') return 'MTN Mobile Money';
  if (value === 'TELECEL_CASH') return 'Telecel Cash';
  if (value === 'AIRTELTIGO_MONEY') return 'AirtelTigo Money';
  if (value === 'BANK') return 'Bank Transfer';

  return 'Other';
}

function getDisplayProvider(provider: string | null | undefined) {
  const value = String(provider || '').toUpperCase();

  if (value === 'MOMO') return 'Mobile Money';
  if (value === 'BANK_TRANSFER') return 'Bank Transfer';

  return 'Other';
}

function normalizeAccount(account: CompanyPaymentAccountRow) {
  return {
    id: account.id,
    account_name: account.account_name,
    provider: account.provider,
    provider_label: getDisplayProvider(account.provider),
    network: account.network,
    network_label: getDisplayNetwork(account.network),
    merchant_number: account.merchant_number,
    merchant_id: account.merchant_id,
    instructions: account.instructions,
    is_active: account.is_active,
    is_default: account.is_default,
    created_at: account.created_at,
    updated_at: account.updated_at,
  };
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceClient();

    const activeOnly =
      request.nextUrl.searchParams.get('active_only') !== 'false';

    const defaultOnly =
      request.nextUrl.searchParams.get('default_only') === 'true';

    let query = supabase
      .from('company_payment_accounts')
      .select('*')
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: true });

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    if (defaultOnly) {
      query = query.eq('is_default', true);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Company payment accounts load error:', error);

      return errorResponse(
        'Unable to load company payment account details.',
        500
      );
    }

    const accounts = ((data || []) as CompanyPaymentAccountRow[]).map(
      normalizeAccount
    );

    const defaultAccount =
      accounts.find((account) => account.is_default) || accounts[0] || null;

    return NextResponse.json({
      success: true,
      message: 'Company payment account details loaded successfully.',
      default_account: defaultAccount,
      accounts,
    });
  } catch (error) {
    console.error('Company payment accounts route error:', error);

    const message =
      error instanceof Error
        ? error.message
        : 'Something went wrong while loading company payment accounts.';

    return NextResponse.json(
      {
        success: false,
        message,
      },
      { status: 500 }
    );
  }
}