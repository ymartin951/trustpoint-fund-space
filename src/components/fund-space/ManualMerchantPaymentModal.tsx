'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  Info,
  Loader2,
  ShieldCheck,
  Smartphone,
  UserRound,
  X,
} from 'lucide-react';

import { supabase } from '@/lib/supabase/client';

type CompanyPaymentAccount = {
  id: string;
  account_name: string;
  provider: string;
  provider_label: string;
  network: string;
  network_label: string;
  merchant_number: string;
  merchant_id: string | null;
  instructions: string | null;
  is_active: boolean;
  is_default: boolean;
};

type CompanyAccountsResponse = {
  success?: boolean;
  message?: string;
  default_account?: CompanyPaymentAccount | null;
  accounts?: CompanyPaymentAccount[];
};

type ManualPaymentResponse = {
  success?: boolean;
  message?: string;
  result?: unknown;
};

type PayerType = 'CUSTOMER_SELF' | 'THIRD_PARTY' | 'AGENT_ASSISTED';

type ManualMerchantPaymentModalProps = {
  open: boolean;
  onClose: () => void;
  onSubmitted?: () => Promise<void> | void;
  contributionId: string;
  customerName?: string | null;
  amountDue: number;
  title?: string;
};

function formatCurrency(amount: number | null | undefined) {
  return `GH₵${Number(amount || 0).toLocaleString('en-GH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function calculateServiceFee(amountDue: number) {
  return Math.max(Number((Number(amountDue || 0) * 0.03).toFixed(2)), 2);
}

function getSenderNetworkOptions() {
  return [
    { value: '', label: 'Select sender network' },
    { value: 'MTN_MOMO', label: 'MTN Mobile Money' },
    { value: 'TELECEL_CASH', label: 'Telecel Cash' },
    { value: 'AIRTELTIGO_MONEY', label: 'AirtelTigo Money' },
    { value: 'BANK', label: 'Bank Transfer' },
    { value: 'OTHER', label: 'Other' },
  ];
}

function getRelationshipOptions(payerType: PayerType) {
  if (payerType === 'CUSTOMER_SELF') {
    return [{ value: 'Self', label: 'Self' }];
  }

  if (payerType === 'AGENT_ASSISTED') {
    return [
      { value: 'Agent', label: 'Agent' },
      { value: 'Field Officer', label: 'Field Officer' },
      { value: 'Other', label: 'Other' },
    ];
  }

  return [
    { value: '', label: 'Select relationship to customer' },
    { value: 'Mother', label: 'Mother' },
    { value: 'Father', label: 'Father' },
    { value: 'Brother', label: 'Brother' },
    { value: 'Sister', label: 'Sister' },
    { value: 'Husband', label: 'Husband' },
    { value: 'Wife', label: 'Wife' },
    { value: 'Spouse', label: 'Spouse' },
    { value: 'Friend', label: 'Friend' },
    { value: 'Relative', label: 'Relative' },
    { value: 'Customer used another phone', label: 'Customer used another phone' },
    { value: 'Other', label: 'Other' },
  ];
}

function getPayerTypeLabel(value: PayerType) {
  if (value === 'CUSTOMER_SELF') return 'Customer paid personally';
  if (value === 'THIRD_PARTY') return 'Someone paid for the customer';
  return 'Agent assisted the payment';
}

export function ManualMerchantPaymentModal({
  open,
  onClose,
  onSubmitted,
  contributionId,
  customerName,
  amountDue,
  title = 'Complete MoMo Payment',
}: ManualMerchantPaymentModalProps) {
  const [companyAccount, setCompanyAccount] =
    useState<CompanyPaymentAccount | null>(null);

  const [loadingAccount, setLoadingAccount] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [copyMessage, setCopyMessage] = useState('');

  const [payerType, setPayerType] = useState<PayerType>('CUSTOMER_SELF');
  const [payerRelationship, setPayerRelationship] = useState('Self');

  const [senderName, setSenderName] = useState('');
  const [senderPhone, setSenderPhone] = useState('');
  const [senderNetwork, setSenderNetwork] = useState('');
  const [transactionReference, setTransactionReference] = useState('');
  const [totalAmountPaid, setTotalAmountPaid] = useState('');
  const [paymentNote, setPaymentNote] = useState('');

  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const serviceFee = useMemo(() => calculateServiceFee(amountDue), [amountDue]);

  const expectedTotal = useMemo(
    () => Number(amountDue || 0) + serviceFee,
    [amountDue, serviceFee]
  );

  useEffect(() => {
    if (!open) return;

    setPayerType('CUSTOMER_SELF');
    setPayerRelationship('Self');
    setSenderName('');
    setSenderPhone('');
    setSenderNetwork('');
    setTransactionReference('');
    setTotalAmountPaid(expectedTotal.toFixed(2));
    setPaymentNote('');
    setCopyMessage('');
    setMessage(null);

    loadCompanyAccount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, expectedTotal]);

  useEffect(() => {
    if (!open) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [open]);

  const relationshipOptions = useMemo(
    () => getRelationshipOptions(payerType),
    [payerType]
  );

  const getAccessToken = async () => {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error || !session?.access_token) {
      throw new Error('Your session has expired. Please log in again.');
    }

    return session.access_token;
  };

  const loadCompanyAccount = async () => {
    try {
      setLoadingAccount(true);
      setCompanyAccount(null);

      const response = await fetch(
        '/api/company-payment-accounts?default_only=true',
        {
          method: 'GET',
        }
      );

      const result = (await response.json()) as CompanyAccountsResponse;

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || 'Unable to load company payment account.'
        );
      }

      setCompanyAccount(result.default_account || null);
    } catch (error) {
      setMessage({
        type: 'error',
        text:
          error instanceof Error
            ? error.message
            : 'Unable to load company merchant account.',
      });
    } finally {
      setLoadingAccount(false);
    }
  };

  const copyToClipboard = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopyMessage(`${label} copied successfully.`);
      window.setTimeout(() => setCopyMessage(''), 2500);
    } catch {
      setCopyMessage('Could not copy. Please copy manually.');
      window.setTimeout(() => setCopyMessage(''), 2500);
    }
  };

  const handlePayerTypeChange = (value: PayerType) => {
    setPayerType(value);

    if (value === 'CUSTOMER_SELF') {
      setPayerRelationship('Self');
      return;
    }

    if (value === 'AGENT_ASSISTED') {
      setPayerRelationship('Agent');
      return;
    }

    setPayerRelationship('');
  };

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      setMessage(null);

      if (!companyAccount?.id) {
        throw new Error('Company merchant account is not available.');
      }

      if (!contributionId) {
        throw new Error('Contribution record is missing. Please refresh.');
      }

      if (!transactionReference.trim()) {
        throw new Error('Please enter the MoMo transaction reference.');
      }

      if (!totalAmountPaid || Number(totalAmountPaid) <= 0) {
        throw new Error('Please enter the total amount you paid.');
      }

      if (payerType !== 'CUSTOMER_SELF' && !payerRelationship.trim()) {
        throw new Error(
          'Please select the relationship of the person who made this payment.'
        );
      }

      const token = await getAccessToken();

      const response = await fetch('/api/fund-space/manual-payment-submissions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contribution_id: contributionId,
          total_amount_paid: totalAmountPaid,
          transaction_reference: transactionReference.trim(),
          sender_name: senderName.trim(),
          sender_phone: senderPhone.trim(),
          sender_network: senderNetwork,
          company_payment_account_id: companyAccount.id,
          payer_type: payerType,
          payer_relationship: payerRelationship.trim(),
          payment_note: paymentNote.trim(),
        }),
      });

      const result = (await response.json()) as ManualPaymentResponse;

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Unable to submit payment.');
      }

      setMessage({
        type: 'success',
        text:
          result.message ||
          'Payment submitted successfully and is awaiting admin verification.',
      });

      await onSubmitted?.();

      window.setTimeout(() => {
        onClose();
      }, 900);
    } catch (error) {
      setMessage({
        type: 'error',
        text:
          error instanceof Error
            ? error.message
            : 'Something went wrong while submitting payment.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] overflow-y-auto bg-slate-950/60 px-3 py-6 backdrop-blur-sm sm:px-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="manual-momo-payment-title"
    >
      <div className="flex min-h-full items-center justify-center">
        <button
          type="button"
          aria-label="Close modal overlay"
          className="fixed inset-0 cursor-default"
          onClick={submitting ? undefined : onClose}
        />

        <div className="relative z-10 flex w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl max-h-[calc(100vh-48px)]">
          <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 bg-white px-4 py-4 sm:px-6 sm:py-5">
            <div className="min-w-0">
              <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-emerald-700">
                <Smartphone className="h-3.5 w-3.5" />
                TrustPoint MoMo
              </div>

              <h2
                id="manual-momo-payment-title"
                className="text-xl font-black text-slate-950 sm:text-2xl"
              >
                {title}
              </h2>

              <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500 sm:text-sm">
                Pay to the TrustPoint merchant line, then submit your transaction
                reference for verification.
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              aria-label="Close payment modal"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6">
            {message && (
              <div
                className={`mb-5 flex items-start gap-3 rounded-2xl border p-4 text-sm font-semibold ${
                  message.type === 'success'
                    ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
                    : 'border-red-100 bg-red-50 text-red-700'
                }`}
              >
                {message.type === 'success' ? (
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
                ) : (
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                )}
                <p>{message.text}</p>
              </div>
            )}

            <section className="rounded-3xl border border-emerald-100 bg-emerald-50 p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <div className="rounded-2xl bg-emerald-600 p-3 text-white shadow-sm">
                  <Smartphone className="h-6 w-6" />
                </div>

                <div>
                  <h3 className="text-base font-black text-slate-950">
                    Merchant Payment Details
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-emerald-700">
                    Send your contribution to this official TrustPoint payment
                    account.
                  </p>
                </div>
              </div>

              {loadingAccount ? (
                <div className="mt-5 flex items-center gap-3 rounded-2xl bg-white p-4 text-sm font-semibold text-emerald-700">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Loading merchant account...
                </div>
              ) : companyAccount ? (
                <div className="mt-5 space-y-3">
                  <DetailBox
                    label="Account Name"
                    value={companyAccount.account_name}
                  />

                  <DetailBox
                    label="Payment Network"
                    value={companyAccount.network_label}
                  />

                  <CopyBox
                    label="Merchant Number"
                    value={companyAccount.merchant_number}
                    onCopy={() =>
                      copyToClipboard(
                        companyAccount.merchant_number,
                        'Merchant number'
                      )
                    }
                  />

                  {companyAccount.merchant_id && (
                    <CopyBox
                      label="Merchant ID"
                      value={companyAccount.merchant_id}
                      onCopy={() =>
                        copyToClipboard(
                          companyAccount.merchant_id || '',
                          'Merchant ID'
                        )
                      }
                    />
                  )}

                  {copyMessage && (
                    <div className="flex items-start gap-2 rounded-2xl border border-emerald-100 bg-white p-3 text-sm font-bold text-emerald-700">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                      <p>{copyMessage}</p>
                    </div>
                  )}

                  {companyAccount.instructions && (
                    <div className="rounded-2xl border border-emerald-100 bg-white p-4">
                      <p className="mb-1 text-xs font-black uppercase tracking-wide text-emerald-700">
                        Instructions
                      </p>
                      <p className="text-sm leading-6 text-slate-600">
                        {companyAccount.instructions}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="mt-5 rounded-2xl border border-red-100 bg-white p-4 text-sm font-semibold text-red-700">
                  No active company merchant account found. Please contact
                  support before making payment.
                </div>
              )}
            </section>

            <section className="mt-4 rounded-3xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5">
              <div className="flex items-start gap-3">
                <div className="rounded-2xl bg-slate-100 p-3 text-slate-700">
                  <ClipboardCheck className="h-6 w-6" />
                </div>

                <div>
                  <h3 className="text-base font-black text-slate-950">
                    Amount to Pay
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    Pay the total amount below, then submit your transaction ID.
                  </p>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                <BreakdownRow
                  label="Customer"
                  value={customerName || 'Customer'}
                />

                <BreakdownRow
                  label="Weekly Contribution"
                  value={formatCurrency(amountDue)}
                />

                <BreakdownRow
                  label="Service Fee"
                  value={formatCurrency(serviceFee)}
                />

                <div className="rounded-3xl bg-emerald-600 p-5 text-white">
                  <p className="text-sm font-bold text-emerald-50">
                    Total to Pay
                  </p>
                  <p className="mt-1 text-3xl font-black">
                    {formatCurrency(expectedTotal)}
                  </p>
                  <p className="mt-2 text-xs leading-5 text-emerald-50">
                    Please pay this exact amount to make admin verification
                    faster.
                  </p>
                </div>
              </div>

              <div className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm leading-6 text-amber-800">
                <Info className="mt-0.5 h-5 w-5 shrink-0" />
                <p>
                  The contribution belongs to the registered customer, even when
                  another person sends the MoMo payment on their behalf.
                </p>
              </div>
            </section>

            <section className="mt-4 rounded-3xl border border-slate-100 bg-slate-50 p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <div className="rounded-2xl bg-white p-3 text-emerald-700 shadow-sm">
                  <UserRound className="h-6 w-6" />
                </div>

                <div>
                  <h3 className="text-base font-black text-slate-950">
                    Who Made This Payment?
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    Select this correctly so admin can verify third-party
                    payments without confusion.
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-3">
                {(['CUSTOMER_SELF', 'THIRD_PARTY', 'AGENT_ASSISTED'] as const).map(
                  (item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => handlePayerTypeChange(item)}
                      className={`rounded-2xl border p-4 text-left transition ${
                        payerType === item
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <p className="font-black">{getPayerTypeLabel(item)}</p>
                      <p className="mt-1 text-sm leading-5 opacity-80">
                        {item === 'CUSTOMER_SELF'
                          ? 'Use this when the customer paid with their own MoMo number.'
                          : item === 'THIRD_PARTY'
                            ? 'Use this when a relative, friend, spouse, or another person paid for the customer.'
                            : 'Use this when an agent helped the customer complete the payment.'}
                      </p>
                    </button>
                  )
                )}
              </div>

              {payerType !== 'CUSTOMER_SELF' && (
                <div className="mt-4">
                  <label className="text-sm font-bold text-slate-700">
                    Relationship to Customer
                  </label>
                  <select
                    value={payerRelationship}
                    onChange={(event) => setPayerRelationship(event.target.value)}
                    className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                  >
                    {relationshipOptions.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </section>

            <section className="mt-4 rounded-3xl border border-slate-100 bg-slate-50 p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <div className="rounded-2xl bg-white p-3 text-emerald-700 shadow-sm">
                  <ShieldCheck className="h-6 w-6" />
                </div>

                <div>
                  <h3 className="text-base font-black text-slate-950">
                    Submit Transaction Details
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    Enter the sender details exactly as they appear on the MoMo
                    transaction message or merchant statement.
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <InputField
                  label="Sender Name"
                  value={senderName}
                  onChange={setSenderName}
                  placeholder="Name used to send the MoMo"
                />

                <InputField
                  label="Sender Phone"
                  value={senderPhone}
                  onChange={setSenderPhone}
                  placeholder="Phone number used for payment"
                  inputMode="tel"
                />

                <div>
                  <label className="text-sm font-bold text-slate-700">
                    Sender Network
                  </label>
                  <select
                    value={senderNetwork}
                    onChange={(event) => setSenderNetwork(event.target.value)}
                    className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                  >
                    {getSenderNetworkOptions().map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>

                <InputField
                  label="Total Amount Paid"
                  value={totalAmountPaid}
                  onChange={setTotalAmountPaid}
                  placeholder="Example: 103"
                  type="number"
                  inputMode="decimal"
                />

                <div className="md:col-span-2">
                  <InputField
                    label="Transaction Reference"
                    value={transactionReference}
                    onChange={setTransactionReference}
                    placeholder="Enter MoMo transaction ID/reference"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="text-sm font-bold text-slate-700">
                    Payment Note
                  </label>
                  <textarea
                    value={paymentNote}
                    onChange={(event) => setPaymentNote(event.target.value)}
                    rows={3}
                    placeholder={
                      payerType === 'THIRD_PARTY'
                        ? 'Example: Customer used brother’s MoMo number to pay.'
                        : 'Optional note for admin verification'
                    }
                    className="mt-2 w-full resize-none rounded-2xl border border-slate-200 bg-white p-4 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                  />
                </div>
              </div>
            </section>
          </div>

          <div className="shrink-0 border-t border-slate-100 bg-white px-4 py-4 shadow-[0_-10px_30px_rgba(15,23,42,0.08)] sm:px-6">
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-center text-xs leading-5 text-slate-500 sm:max-w-md sm:text-left">
                Check the amount, sender details, and reference carefully before
                submitting.
              </p>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={submitting}
                  className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting || loadingAccount || !companyAccount}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      Confirm & Submit
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-emerald-100 bg-white p-4">
      <p className="text-xs font-black uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-1 break-words text-base font-black text-slate-950">
        {value}
      </p>
    </div>
  );
}

function CopyBox({
  label,
  value,
  onCopy,
}: {
  label: string;
  value: string;
  onCopy: () => void;
}) {
  return (
    <div className="rounded-2xl border border-emerald-100 bg-white p-4">
      <p className="text-xs font-black uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <div className="mt-2 flex items-center justify-between gap-3">
        <p className="break-all text-base font-black text-slate-950">{value}</p>

        <button
          type="button"
          onClick={onCopy}
          className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 transition hover:bg-slate-50"
        >
          <Copy className="h-3.5 w-3.5" />
          Copy
        </button>
      </div>
    </div>
  );
}

function BreakdownRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl bg-slate-50 p-4">
      <p className="text-sm font-semibold text-slate-500">{label}</p>
      <p className="text-right text-sm font-black text-slate-950">{value}</p>
    </div>
  );
}

function InputField({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: string;
  inputMode?: 'text' | 'tel' | 'decimal' | 'numeric' | 'email' | 'search' | 'url';
}) {
  return (
    <div>
      <label className="text-sm font-bold text-slate-700">{label}</label>
      <input
        type={type}
        inputMode={inputMode}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
      />
    </div>
  );
}