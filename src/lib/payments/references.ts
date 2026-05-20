import type { PaymentTransactionType } from './payment-types';

const REFERENCE_PREFIXES: Record<PaymentTransactionType, string> = {
  WALLET_DEPOSIT: 'TP-WALLET',
  FUND_SPACE_CONTRIBUTION: 'TP-FSC',
  AGENT_CUSTOMER_DEPOSIT: 'TP-AGDEP',
  AGENT_CUSTOMER_CONTRIBUTION: 'TP-AGFSC',
  WITHDRAWAL_PAYOUT: 'TP-WDRAW',
  FUND_SPACE_PAYOUT: 'TP-FSPAY',
  ADMIN_MANUAL_ADJUSTMENT: 'TP-ADMIN',
};

function randomCode(length = 12) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let value = '';

  for (let index = 0; index < length; index += 1) {
    value += alphabet[Math.floor(Math.random() * alphabet.length)];
  }

  return value;
}

export function generatePaymentReference(type: PaymentTransactionType) {
  const prefix = REFERENCE_PREFIXES[type] || 'TP-PAY';
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:.TZ]/g, '')
    .slice(0, 14);

  return `${prefix}-${timestamp}-${randomCode(10)}`;
}

export function normalizePaymentReference(reference: string) {
  return reference.trim().toUpperCase();
}

export function isTrustPointReference(reference: string) {
  const normalized = normalizePaymentReference(reference);

  return normalized.startsWith('TP-');
}