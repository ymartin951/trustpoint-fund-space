import crypto from 'crypto';

function toUint8Array(value: string) {
  return new Uint8Array(Buffer.from(value, 'utf8'));
}

export function verifyPaystackWebhookSignature({
  rawBody,
  signature,
  secretKey,
}: {
  rawBody: string;
  signature: string | null;
  secretKey: string;
}) {
  if (!rawBody || !signature || !secretKey) {
    return false;
  }

  const hash = crypto
    .createHmac('sha512', secretKey)
    .update(rawBody)
    .digest('hex');

  const expectedSignature = toUint8Array(hash);
  const receivedSignature = toUint8Array(signature);

  if (expectedSignature.length !== receivedSignature.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedSignature, receivedSignature);
}

export async function readRawRequestBody(request: Request) {
  return await request.text();
}

export function safeJsonParse<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}