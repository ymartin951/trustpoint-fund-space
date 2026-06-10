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
  WalletCards,
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
  submission?: unknown;
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

function getTodayDateValue() {
  return new Date().toISOString().slice(0, 10);
}

function getCurrentTimeValue() {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');

  return `${hours}:${minutes}`;
}

function normalizeText(value: string | null | undefined) {
  return String(value || '').trim();
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
      { value: 'Agent assisted payment', label: 'Agent assisted payment' },
      {
        value: 'Customer paid through agent',
        label: 'Customer paid through agent',
      },
    ];
  }

  return [
    { value: '', label: 'Select relationship' },
    { value: 'Parent', label: 'Parent' },
    { value: 'Spouse', label: 'Spouse' },
    { value: 'Sibling', label: 'Sibling' },
    { value: 'Child', label: 'Child' },
    { value: 'Friend', label: 'Friend' },
    { value: 'Business partner', label: 'Business partner' },
    { value: 'Other', label: 'Other' },
  ];
}

function getManualPaymentEndpoint() {
  if (typeof window === 'undefined') {
    return '/api/fund-space/manual-payment-submissions';
  }

  const path = window.location.pathname.toLowerCase();

  if (path.startsWith('/agent')) {
    return '/api/agent/fund-space/manual-payment-submissions';
  }

  return '/api/fund-space/manual-payment-submissions';
}

async function readApiResponse(response: Response): Promise<ManualPaymentResponse> {
  const text = await response.text();

  if (!text) {
    return {
      success: false,
      message: 'The server returned an empty response.',
    };
  }

  try {
    return JSON.parse(text) as ManualPaymentResponse;
  } catch {
    return {
      success: false,
      message: 'The server returned an invalid response.',
    };
  }
}

async function copyToClipboard(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}
 function ManualMerchantPaymentModal({
  open,
  onClose,
  onSubmitted,
  contributionId,
  customerName,
  amountDue,
  title,
}: ManualMerchantPaymentModalProps) {
  const serviceFee = useMemo(() => calculateServiceFee(amountDue), [amountDue]);

  const totalAmount = useMemo(() => {
    return Number((Number(amountDue || 0) + serviceFee).toFixed(2));
  }, [amountDue, serviceFee]);

  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [accounts, setAccounts] = useState<CompanyPaymentAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [copiedValue, setCopiedValue] = useState('');

  const [payerType, setPayerType] = useState<PayerType>('CUSTOMER_SELF');
  const [payerRelationship, setPayerRelationship] = useState('Self');

  const [senderName, setSenderName] = useState('');
  const [senderPhone, setSenderPhone] = useState('');
  const [senderNetwork, setSenderNetwork] = useState('');
  const [transactionReference, setTransactionReference] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const [screenshotUrl, setScreenshotUrl] = useState('');

  const [actualPaymentDate, setActualPaymentDate] = useState(
    getTodayDateValue()
  );
  const [actualPaymentTime, setActualPaymentTime] = useState(
    getCurrentTimeValue()
  );

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const selectedAccount = useMemo(() => {
    return (
      accounts.find((account) => account.id === selectedAccountId) ||
      accounts.find((account) => account.is_default) ||
      accounts[0] ||
      null
    );
  }, [accounts, selectedAccountId]);

  const relationshipOptions = useMemo(() => {
    return getRelationshipOptions(payerType);
  }, [payerType]);

  useEffect(() => {
    if (!open) return;

    setCopiedValue('');
    setErrorMessage('');
    setSuccessMessage('');
    setActualPaymentDate(getTodayDateValue());
    setActualPaymentTime(getCurrentTimeValue());
    loadCompanyAccounts();

    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = '';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (payerType === 'CUSTOMER_SELF') {
      setPayerRelationship('Self');
      return;
    }

    if (payerType === 'AGENT_ASSISTED') {
      setPayerRelationship('Agent assisted payment');
      return;
    }

    setPayerRelationship('');
  }, [payerType]);

  async function loadCompanyAccounts() {
    try {
      setLoadingAccounts(true);

      const response = await fetch('/api/company-payment-accounts', {
        method: 'GET',
      });

      const text = await response.text();

      let result: CompanyAccountsResponse | null = null;

      try {
        result = text ? (JSON.parse(text) as CompanyAccountsResponse) : null;
      } catch {
        result = null;
      }

      if (!response.ok || !result?.success) {
        setAccounts([]);
        setSelectedAccountId('');
        return;
      }

      const activeAccounts = (result.accounts || []).filter(
        (account) => account.is_active
      );

      setAccounts(activeAccounts);

      const defaultAccount =
        result.default_account ||
        activeAccounts.find((account) => account.is_default) ||
        activeAccounts[0] ||
        null;

      setSelectedAccountId(defaultAccount?.id || '');
    } catch {
      setAccounts([]);
      setSelectedAccountId('');
    } finally {
      setLoadingAccounts(false);
    }
  }

  function validateForm() {
    if (!contributionId) return 'Contribution ID is missing.';
    if (!senderName.trim()) return 'Sender name is required.';
    if (!senderPhone.trim()) return 'Sender phone number is required.';
    if (!senderNetwork.trim()) return 'Please select the sender network.';
    if (!transactionReference.trim()) return 'MoMo transaction reference is required.';
    if (!actualPaymentDate.trim()) return 'Please select the actual payment date.';
    if (!actualPaymentTime.trim()) return 'Please select the actual payment time.';

    if (payerType !== 'CUSTOMER_SELF' && !payerRelationship.trim()) {
      return 'Please select the payer relationship.';
    }

    return '';
  }

  async function handleSubmit() {
    try {
      setSubmitting(true);
      setErrorMessage('');
      setSuccessMessage('');

      const validationError = validateForm();

      if (validationError) {
        throw new Error(validationError);
      }

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.access_token) {
        throw new Error('Your session has expired. Please log in again.');
      }

      const response = await fetch(getManualPaymentEndpoint(), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contribution_id: contributionId,
          company_payment_account_id: selectedAccount?.id || null,

          amount_due: Number(amountDue || 0),
          service_fee: Number(serviceFee || 0),
          total_amount_paid: Number(totalAmount || 0),

          sender_name: normalizeText(senderName),
          sender_phone: normalizeText(senderPhone),
          sender_network: normalizeText(senderNetwork),

          transaction_reference: normalizeText(transactionReference),
          payment_note: normalizeText(paymentNote),
          screenshot_url: normalizeText(screenshotUrl),

          payer_type: payerType,
          payer_relationship: normalizeText(payerRelationship),

          actual_payment_date: actualPaymentDate,
          actual_payment_time: actualPaymentTime,
        }),
      });

      const result = await readApiResponse(response);

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || 'Unable to submit MoMo payment for review.'
        );
      }

      setSuccessMessage(
        result.message ||
          'Payment submitted successfully. Admin will review and approve it.'
      );

      await onSubmitted?.();

      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to submit MoMo payment for review.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCopy(value: string, label: string) {
    const copied = await copyToClipboard(value);

    if (copied) {
      setCopiedValue(label);
      setTimeout(() => setCopiedValue(''), 1500);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 px-3 py-4">
      <div
        role="dialog"
        aria-modal="true"
        className="flex w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
        style={{
          maxHeight: '88vh',
        }}
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 bg-white px-5 py-4">
          <div>
            <p className="mb-2 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">
              <Smartphone className="h-4 w-4" />
              Manual Mobile Money
            </p>

            <h2 className="text-lg font-black text-slate-900">
              {title || 'Pay with MoMo'}
            </h2>

            <p className="mt-1 text-sm leading-6 text-slate-500">
              Send your MoMo payment, then submit the transaction details for
              admin review.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-2xl p-2 text-slate-500 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div
          className="flex-1 overflow-y-auto px-5 py-5"
          style={{
            WebkitOverflowScrolling: 'touch',
          }}
        >
          <div className="space-y-5 pb-2">
            {successMessage && (
              <MessageBox type="success" message={successMessage} />
            )}

            {errorMessage && <MessageBox type="error" message={errorMessage} />}

            <section className="rounded-3xl border border-emerald-100 bg-emerald-50 p-4">
              <div className="flex items-start gap-3">
                <div className="rounded-2xl bg-white p-3 text-emerald-700">
                  <WalletCards className="h-5 w-5" />
                </div>

                <div className="flex-1">
                  <h3 className="font-black text-emerald-950">
                    Amount to Pay
                  </h3>

                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <AmountBox
                      label="Contribution"
                      value={formatCurrency(amountDue)}
                    />
                    <AmountBox
                      label="Service Fee"
                      value={formatCurrency(serviceFee)}
                    />
                    <AmountBox
                      label="Total"
                      value={formatCurrency(totalAmount)}
                      strong
                    />
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
              <SectionHeader
                icon={<ShieldCheck className="h-5 w-5" />}
                title="TrustPoint Payment Account"
                description="Send the total amount to this account."
              />

              {loadingAccounts ? (
                <div className="mt-4 flex items-center gap-2 rounded-2xl bg-slate-50 p-4 text-sm font-bold text-slate-600">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading payment account...
                </div>
              ) : selectedAccount ? (
                <div className="mt-4 space-y-4">
                  {accounts.length > 1 && (
                    <label className="block">
                      <span className="text-sm font-black text-slate-700">
                        Choose payment account
                      </span>
                      <select
                        value={selectedAccountId}
                        onChange={(event) =>
                          setSelectedAccountId(event.target.value)
                        }
                        className="mt-2 min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                      >
                        {accounts.map((account) => (
                          <option key={account.id} value={account.id}>
                            {account.account_name} • {account.network_label}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}

                  <div className="grid gap-3 sm:grid-cols-2">
                    <CopyBox
                      label="Account Name"
                      value={selectedAccount.account_name}
                      copiedValue={copiedValue}
                      onCopy={handleCopy}
                    />

                    <CopyBox
                      label="Network"
                      value={selectedAccount.network_label}
                      copiedValue={copiedValue}
                      onCopy={handleCopy}
                    />

                    <CopyBox
                      label="MoMo Number"
                      value={selectedAccount.merchant_number}
                      copiedValue={copiedValue}
                      onCopy={handleCopy}
                      highlight
                    />

                    <CopyBox
                      label="Merchant ID"
                      value={selectedAccount.merchant_id || 'Not provided'}
                      copiedValue={copiedValue}
                      onCopy={handleCopy}
                    />
                  </div>

                  {selectedAccount.instructions && (
                    <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                      <p className="text-sm font-bold leading-6 text-emerald-800">
                        {selectedAccount.instructions}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-700">
                  <div className="flex items-start gap-3">
                    <Info className="mt-0.5 h-5 w-5 shrink-0" />
                    <p className="text-sm font-bold leading-6">
                      No TrustPoint payment account was loaded. Contact admin if
                      you do not know the correct MoMo account.
                    </p>
                  </div>
                </div>
              )}
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
              <SectionHeader
                icon={<UserRound className="h-5 w-5" />}
                title="Sender Details"
                description="Enter the sender details exactly as shown on the MoMo transaction."
              />

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-black text-slate-700">
                    Who paid? <span className="text-red-500">*</span>
                  </span>
                  <select
                    value={payerType}
                    onChange={(event) =>
                      setPayerType(event.target.value as PayerType)
                    }
                    className="mt-2 min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  >
                    <option value="CUSTOMER_SELF">
                      Customer paid personally
                    </option>
                    <option value="THIRD_PARTY">
                      Someone paid for customer
                    </option>
                    <option value="AGENT_ASSISTED">
                      Agent assisted payment
                    </option>
                  </select>
                </label>

                <label className="block">
                  <span className="text-sm font-black text-slate-700">
                    Relationship <span className="text-red-500">*</span>
                  </span>
                  <select
                    value={payerRelationship}
                    onChange={(event) =>
                      setPayerRelationship(event.target.value)
                    }
                    className="mt-2 min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  >
                    {relationshipOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <TextInput
                  label="Sender Name"
                  required
                  value={senderName}
                  onChange={setSenderName}
                  placeholder="Name on MoMo transaction"
                />

                <TextInput
                  label="Sender Phone"
                  required
                  value={senderPhone}
                  onChange={setSenderPhone}
                  placeholder="Phone number used to pay"
                  inputMode="tel"
                />

                <label className="block">
                  <span className="text-sm font-black text-slate-700">
                    Sender Network <span className="text-red-500">*</span>
                  </span>
                  <select
                    value={senderNetwork}
                    onChange={(event) => setSenderNetwork(event.target.value)}
                    className="mt-2 min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  >
                    {getSenderNetworkOptions().map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <TextInput
                  label="Transaction Reference"
                  required
                  value={transactionReference}
                  onChange={setTransactionReference}
                  placeholder="Example: 1234567890"
                />
              </div>
            </section>

            <section className="rounded-3xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
              <SectionHeader
                icon={<ClipboardCheck className="h-5 w-5" />}
                title="Actual Payment Date & Time"
                description="Use the real date and time on the MoMo transaction."
                warm
              />

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-black text-slate-700">
                    Payment Date <span className="text-red-500">*</span>
                  </span>
                  <input
                    type="date"
                    value={actualPaymentDate}
                    max={getTodayDateValue()}
                    onChange={(event) =>
                      setActualPaymentDate(event.target.value)
                    }
                    className="mt-2 min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-black text-slate-700">
                    Payment Time <span className="text-red-500">*</span>
                  </span>
                  <input
                    type="time"
                    value={actualPaymentTime}
                    onChange={(event) =>
                      setActualPaymentTime(event.target.value)
                    }
                    className="mt-2 min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  />
                </label>
              </div>

              <p className="mt-3 rounded-2xl bg-white/70 p-3 text-xs font-bold leading-5 text-amber-900">
                This helps TrustPoint decide if the payment was on time or late.
                Do not use the time you are submitting this form unless that is
                when you actually paid.
              </p>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
              <SectionHeader
                icon={<Info className="h-5 w-5" />}
                title="Optional Information"
                description="Add screenshot link or note only if needed."
              />

              <div className="mt-4 space-y-4">
                <TextInput
                  label="Screenshot URL"
                  value={screenshotUrl}
                  onChange={setScreenshotUrl}
                  placeholder="Optional screenshot link"
                />

                <label className="block">
                  <span className="text-sm font-black text-slate-700">
                    Payment Note
                  </span>
                  <textarea
                    value={paymentNote}
                    onChange={(event) => setPaymentNote(event.target.value)}
                    rows={3}
                    placeholder="Optional note for admin"
                    className="mt-2 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-800 outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-100"
                  />
                </label>
              </div>
            </section>
          </div>
        </div>

        <div className="shrink-0 border-t border-slate-100 bg-white px-5 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                Total Amount
              </p>
              <p className="text-2xl font-black text-emerald-700">
                {formatCurrency(totalAmount)}
              </p>
              <p className="text-xs font-semibold text-slate-500">
                Customer: {customerName || 'Customer'}
              </p>
            </div>

            <div className="grid gap-2 sm:min-w-56">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-5 text-sm font-black text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-5 w-5" />
                )}
                {submitting ? 'Submitting...' : 'Submit for Review'}
              </button>

              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="inline-flex min-h-11 w-full items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MessageBox({
  type,
  message,
}: {
  type: 'success' | 'error';
  message: string;
}) {
  const isSuccess = type === 'success';

  return (
    <div
      className={`rounded-2xl border p-4 ${
        isSuccess
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
          : 'border-red-200 bg-red-50 text-red-700'
      }`}
    >
      <div className="flex items-start gap-3">
        {isSuccess ? (
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
        ) : (
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
        )}
        <p className="text-sm font-bold leading-6">{message}</p>
      </div>
    </div>
  );
}

function SectionHeader({
  icon,
  title,
  description,
  warm,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  warm?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <div
        className={`rounded-2xl p-3 ${
          warm ? 'bg-white text-amber-700' : 'bg-emerald-50 text-emerald-700'
        }`}
      >
        {icon}
      </div>

      <div>
        <h3
          className={
            warm ? 'font-black text-amber-950' : 'font-black text-slate-900'
          }
        >
          {title}
        </h3>
        <p
          className={
            warm
              ? 'mt-1 text-sm leading-6 text-amber-800'
              : 'mt-1 text-sm leading-6 text-slate-500'
          }
        >
          {description}
        </p>
      </div>
    </div>
  );
}

function AmountBox({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="rounded-2xl bg-white p-4">
      <p className="text-xs font-black uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p
        className={`mt-1 ${
          strong
            ? 'text-xl font-black text-emerald-700'
            : 'text-sm font-black text-slate-900'
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function TextInput({
  label,
  value,
  onChange,
  placeholder,
  required,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  required?: boolean;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
}) {
  return (
    <label className="block">
      <span className="text-sm font-black text-slate-700">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>

      <input
        value={value}
        inputMode={inputMode}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-2 min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-800 outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-100"
      />
    </label>
  );
}

function CopyBox({
  label,
  value,
  copiedValue,
  onCopy,
  highlight,
}: {
  label: string;
  value: string;
  copiedValue: string;
  onCopy: (value: string, label: string) => Promise<void>;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 ${
        highlight
          ? 'border-emerald-200 bg-emerald-50'
          : 'border-slate-100 bg-slate-50'
      }`}
    >
      <p className="text-xs font-black uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <div className="mt-2 flex items-center justify-between gap-3">
        <p
          className={`break-all text-sm font-black ${
            highlight ? 'text-emerald-800' : 'text-slate-900'
          }`}
        >
          {value}
        </p>

        <button
          type="button"
          onClick={() => onCopy(value, label)}
          className="shrink-0 rounded-xl bg-white p-2 text-slate-600 ring-1 ring-slate-200 transition hover:bg-emerald-100 hover:text-emerald-700"
        >
          {copiedValue === label ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </button>
      </div>
    </div>
  );
}

export { ManualMerchantPaymentModal };
export default ManualMerchantPaymentModal;