import type {
  PaystackInitializePayload,
  PaystackInitializeResponse,
  PaystackVerifyResponse,
} from './payment-types';

const PAYSTACK_BASE_URL = 'https://api.paystack.co';

function getPaystackSecretKey() {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;

  if (!secretKey) {
    throw new Error('PAYSTACK_SECRET_KEY is not configured.');
  }

  return secretKey;
}

function toPesewas(amount: number) {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Amount must be greater than zero.');
  }

  return Math.round(amount * 100);
}

async function paystackRequest<T>({
  path,
  method,
  body,
}: {
  path: string;
  method: 'GET' | 'POST';
  body?: Record<string, unknown>;
}) {
  const response = await fetch(`${PAYSTACK_BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${getPaystackSecretKey()}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });

  const result = (await response.json()) as T;

  if (!response.ok) {
    const message =
      typeof result === 'object' &&
      result &&
      'message' in result &&
      typeof result.message === 'string'
        ? result.message
        : 'Paystack request failed.';

    throw new Error(message);
  }

  return result;
}

export async function initializePaystackTransaction({
  email,
  amount,
  reference,
  currency = 'GHS',
  callback_url,
  channels = ['mobile_money'],
  metadata = {},
}: Omit<PaystackInitializePayload, 'amount'> & {
  amount: number;
}) {
  const payload: PaystackInitializePayload = {
    email,
    amount: toPesewas(amount),
    reference,
    currency,
    callback_url,
    channels,
    metadata,
  };

  const result = await paystackRequest<PaystackInitializeResponse>({
    path: '/transaction/initialize',
    method: 'POST',
    body: payload,
  });

  if (!result.status || !result.data?.authorization_url) {
    throw new Error(result.message || 'Unable to initialize Paystack payment.');
  }

  return result;
}

export async function verifyPaystackTransaction(reference: string) {
  if (!reference.trim()) {
    throw new Error('Payment reference is required.');
  }

  const encodedReference = encodeURIComponent(reference.trim());

  const result = await paystackRequest<PaystackVerifyResponse>({
    path: `/transaction/verify/${encodedReference}`,
    method: 'GET',
  });

  if (!result.status || !result.data) {
    throw new Error(result.message || 'Unable to verify Paystack transaction.');
  }

  return result;
}

export function isPaystackPaymentSuccessful(response: PaystackVerifyResponse) {
  return response.status === true && response.data?.status === 'success';
}

export function convertPaystackAmountToMajorUnit(amount: number | null) {
  if (!amount || amount <= 0) {
    return 0;
  }

  return amount / 100;
}

export function getPaystackPublicKey() {
  const publicKey = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY;

  if (!publicKey) {
    throw new Error('NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY is not configured.');
  }

  return publicKey;
}