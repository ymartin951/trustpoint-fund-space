export type PaymentProvider =
  | 'PAYSTACK'
  | 'HUBTEL'
  | 'FLUTTERWAVE'
  | 'MTN_MOMO'
  | 'MANUAL_ADMIN';

export type PaymentChannel =
  | 'MOBILE_MONEY'
  | 'CARD'
  | 'BANK_TRANSFER'
  | 'USSD'
  | 'QR'
  | 'CASH_AGENT'
  | 'MANUAL_ADMIN'
  | 'PAYMENT_GATEWAY';

export type PaymentDirection = 'INCOMING' | 'OUTGOING';

export type PaymentTransactionStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'SUCCESS'
  | 'FAILED'
  | 'CANCELLED'
  | 'ABANDONED'
  | 'REVERSED';

export type PaymentTransactionType =
  | 'WALLET_DEPOSIT'
  | 'FUND_SPACE_CONTRIBUTION'
  | 'AGENT_CUSTOMER_DEPOSIT'
  | 'AGENT_CUSTOMER_CONTRIBUTION'
  | 'WITHDRAWAL_PAYOUT'
  | 'FUND_SPACE_PAYOUT'
  | 'ADMIN_MANUAL_ADJUSTMENT';

export type PaystackInitializePayload = {
  email: string;
  amount: number;
  reference: string;
  currency?: string;
  callback_url?: string;
  channels?: string[];
  metadata?: Record<string, unknown>;
};

export type PaystackInitializeResponse = {
  status: boolean;
  message: string;
  data?: {
    authorization_url: string;
    access_code: string;
    reference: string;
  };
};

export type PaystackVerifyResponse = {
  status: boolean;
  message: string;
  data?: {
    id: number;
    domain: string;
    status: string;
    reference: string;
    amount: number;
    message: string | null;
    gateway_response: string;
    paid_at: string | null;
    created_at: string;
    channel: string;
    currency: string;
    ip_address: string | null;
    fees: number | null;
    customer?: {
      id?: number;
      first_name?: string | null;
      last_name?: string | null;
      email?: string;
      customer_code?: string;
      phone?: string | null;
    };
    authorization?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  };
};

export type PaystackWebhookEvent = {
  event: string;
  data?: {
    id?: number;
    status?: string;
    reference?: string;
    amount?: number;
    currency?: string;
    channel?: string;
    gateway_response?: string;
    fees?: number | null;
    paid_at?: string | null;
    customer?: {
      email?: string;
      phone?: string | null;
    };
    metadata?: Record<string, unknown>;
  };
};