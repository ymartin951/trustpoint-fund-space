'use client';

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  CreditCard,
  Loader2,
  RefreshCw,
  Search,
  Smartphone,
  User,
  Wallet,
  XCircle,
} from 'lucide-react';

import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/lib/database.types';

type AgentCustomer = {
  id: string;
  agent_id: string;
  customer_id: string;
  created_at: string | null;
};

type CustomerProfile = {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  momo_number: string | null;
  status: string | null;
  verification_status: string | null;
};

type CustomerWithLink = AgentCustomer & {
  customer: CustomerProfile | null;
};

type PaymentTransaction =
  Database['public']['Tables']['payment_transactions']['Row'];

type AgentPaymentRecord = PaymentTransaction & {
  customer_profile?: CustomerProfile | null;
};

type AgentDepositResponse = {
  success?: boolean;
  message?: string;
  authorization_url?: string;
  reference?: string;
  payment_transaction_id?: string;
  customer_id?: string;
  amount?: number;
};

type VerifyPaymentResponse = {
  success?: boolean;
  message?: string;
  already_processed?: boolean;
  payment_status?: string;
};

type AgentDepositHistoryResponse = {
  success?: boolean;
  message?: string;
  payments?: AgentPaymentRecord[];
};

function formatCurrency(amount: number | string | null | undefined) {
  return `GH₵${Number(amount || 0).toLocaleString('en-GH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return 'Not set';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return 'Invalid date';

  return date.toLocaleString('en-GH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatLabel(value: string | null | undefined) {
  if (!value) return 'Not set';

  return value
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getStatusStyle(status: string | null | undefined) {
  const value = String(status || 'PENDING').toUpperCase();

  if (
    ['SUCCESS', 'COMPLETED', 'PAID', 'APPROVED', 'CONFIRMED', 'ACTIVE'].includes(
      value
    )
  ) {
    return 'border-emerald-100 bg-emerald-50 text-emerald-700';
  }

  if (['PENDING', 'PROCESSING', 'PENDING_ADMIN_APPROVAL'].includes(value)) {
    return 'border-amber-100 bg-amber-50 text-amber-700';
  }

  if (
    ['FAILED', 'REJECTED', 'CANCELLED', 'ABANDONED', 'REVERSED', 'INACTIVE'].includes(
      value
    )
  ) {
    return 'border-red-100 bg-red-50 text-red-700';
  }

  return 'border-gray-100 bg-gray-50 text-gray-700';
}

function getPaymentReferenceFromUrl(searchParams: {
  get: (name: string) => string | null;
}) {
  return (
    searchParams.get('payment_reference') ||
    searchParams.get('reference') ||
    searchParams.get('trxref') ||
    ''
  ).trim();
}

function isSuccessStatus(status: string | null | undefined) {
  return ['SUCCESS', 'COMPLETED', 'PAID', 'APPROVED', 'CONFIRMED'].includes(
    String(status || '').toUpperCase()
  );
}

function isPendingStatus(status: string | null | undefined) {
  return ['PENDING', 'PROCESSING', 'PENDING_ADMIN_APPROVAL'].includes(
    String(status || '').toUpperCase()
  );
}

function isFailedStatus(status: string | null | undefined) {
  return ['FAILED', 'REJECTED', 'CANCELLED', 'ABANDONED', 'REVERSED'].includes(
    String(status || '').toUpperCase()
  );
}

export default function AgentDepositsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { profile, loading } = useAuth();
  const { toast } = useToast();

  const verificationAttemptedRef = useRef(false);

  const [customers, setCustomers] = useState<CustomerWithLink[]>([]);
  const [payments, setPayments] = useState<AgentPaymentRecord[]>([]);

  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [amount, setAmount] = useState('');
  const [momoNumber, setMomoNumber] = useState('');

  const [pageLoading, setPageLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [verifyingPayment, setVerifyingPayment] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [paymentNotice, setPaymentNotice] = useState('');

  const parsedAmount = useMemo(() => {
    return Number(amount.replace(/,/g, '').trim());
  }, [amount]);

  const selectedCustomer = useMemo(() => {
    return (
      customers.find((customer) => customer.customer_id === selectedCustomerId) ||
      null
    );
  }, [customers, selectedCustomerId]);

  const amountError = useMemo(() => {
    if (!amount.trim()) return '';

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return 'Please enter a valid amount.';
    }

    if (parsedAmount < 1) {
      return 'Minimum deposit is GH₵1.';
    }

    if (parsedAmount > 100000) {
      return 'Maximum deposit is GH₵100,000.';
    }

    return '';
  }, [amount, parsedAmount]);

  const filteredCustomers = useMemo(() => {
    const value = searchTerm.trim().toLowerCase();

    if (!value) return customers;

    return customers.filter((item) => {
      const customer = item.customer;

      return (
        customer?.full_name?.toLowerCase().includes(value) ||
        customer?.phone?.toLowerCase().includes(value) ||
        customer?.email?.toLowerCase().includes(value) ||
        item.customer_id.toLowerCase().includes(value)
      );
    });
  }, [customers, searchTerm]);

  const successfulPaymentsCount = useMemo(() => {
    return payments.filter((item) => isSuccessStatus(item.status)).length;
  }, [payments]);

  const pendingPaymentsCount = useMemo(() => {
    return payments.filter((item) => isPendingStatus(item.status)).length;
  }, [payments]);

  const failedPaymentsCount = useMemo(() => {
    return payments.filter((item) => isFailedStatus(item.status)).length;
  }, [payments]);

  const successfulValue = useMemo(() => {
    return payments
      .filter((item) => isSuccessStatus(item.status))
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  }, [payments]);

  const loadCustomers = useCallback(async (agentId: string) => {
    const { data: linkData, error: linkError } = await supabase
      .from('agent_customers')
      .select('id, agent_id, customer_id, created_at')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false });

    if (linkError) {
      throw new Error(linkError.message || 'Unable to load agent customers.');
    }

    const links = (linkData || []) as unknown as AgentCustomer[];

    if (links.length === 0) {
      setCustomers([]);
      return;
    }

    const customerIds = Array.from(
      new Set(links.map((item) => item.customer_id).filter(Boolean))
    );

    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select(
        'id, full_name, phone, email, momo_number, status, verification_status'
      )
      .in('id', customerIds);

    if (profileError) {
      throw new Error(profileError.message || 'Unable to load customer profiles.');
    }

    const profileMap = new Map(
      ((profileData || []) as CustomerProfile[]).map((item) => [item.id, item])
    );

    setCustomers(
      links.map((link) => ({
        ...link,
        customer: profileMap.get(link.customer_id) || null,
      }))
    );
  }, []);

  const loadPayments = useCallback(async () => {
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session?.access_token) {
      throw new Error('Your session has expired. Please log in again.');
    }

    const response = await fetch('/api/agent/deposits?limit=30', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    const result = (await response.json()) as AgentDepositHistoryResponse;

    if (!response.ok || !result.success) {
      throw new Error(result.message || 'Unable to load deposit records.');
    }

    setPayments(result.payments || []);
  }, []);

  const loadPage = useCallback(
    async (showRefresh = false) => {
      if (!profile?.id) return;

      try {
        if (showRefresh) {
          setRefreshing(true);
        } else {
          setPageLoading(true);
        }

        setErrorMessage('');

        if (profile.role !== 'AGENT') {
          setErrorMessage('Only agents can access this page.');
          return;
        }

        if (profile.status !== 'ACTIVE') {
          setErrorMessage('Your agent account is not active.');
          return;
        }

        await Promise.all([loadCustomers(profile.id), loadPayments()]);
      } catch (error) {
        console.error('Agent deposits page load error:', error);

        const message =
          error instanceof Error
            ? error.message
            : 'Unable to load agent deposit page.';

        setErrorMessage(message);
      } finally {
        setPageLoading(false);
        setRefreshing(false);
      }
    },
    [profile?.id, profile?.role, profile?.status, loadCustomers, loadPayments]
  );

  const verifyReturnedPayment = useCallback(
    async (reference: string) => {
      if (!reference || verificationAttemptedRef.current) return;

      verificationAttemptedRef.current = true;

      try {
        setVerifyingPayment(true);
        setPaymentNotice('');

        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError || !session?.access_token) {
          throw new Error('Your session has expired. Please log in again.');
        }

        const response = await fetch(
          `/api/payments/verify?reference=${encodeURIComponent(reference)}`,
          {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
          }
        );

        const result = (await response.json()) as VerifyPaymentResponse;

        if (!response.ok || !result.success) {
          throw new Error(
            result.message ||
              'Payment could not be verified. Please refresh or contact support.'
          );
        }

        const notice = result.already_processed
          ? 'This customer deposit was already processed successfully.'
          : 'Customer deposit verified successfully. The customer wallet has been updated.';

        setPaymentNotice(notice);

        toast({
          title: result.already_processed
            ? 'Payment already processed'
            : 'Payment verified',
          description: result.message || notice,
        });

        await loadPage(true);

        router.replace('/agent/deposits');
      } catch (error) {
        console.error('Agent deposit verification error:', error);

        const message =
          error instanceof Error
            ? error.message
            : 'Unable to verify returned payment.';

        setPaymentNotice(`Payment verification failed: ${message}`);

        toast({
          title: 'Payment verification failed',
          description: message,
          variant: 'destructive',
        });
      } finally {
        setVerifyingPayment(false);
      }
    },
    [loadPage, router, toast]
  );

  useEffect(() => {
    if (loading) return;
    loadPage();
  }, [loading, loadPage]);

  useEffect(() => {
    if (!profile?.id || pageLoading) return;

    const reference = getPaymentReferenceFromUrl(searchParams);

    if (reference) {
      verifyReturnedPayment(reference);
    }
  }, [profile?.id, pageLoading, searchParams, verifyReturnedPayment]);

  useEffect(() => {
    if (selectedCustomer?.customer) {
      setMomoNumber(
        selectedCustomer.customer.momo_number ||
          selectedCustomer.customer.phone ||
          ''
      );
    }
  }, [selectedCustomer]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setPaymentNotice('');

    if (!selectedCustomerId) {
      toast({
        title: 'Customer required',
        description: 'Please select a customer before starting deposit.',
        variant: 'destructive',
      });
      return;
    }

    const customer = selectedCustomer?.customer;

    if (!customer) {
      toast({
        title: 'Customer profile missing',
        description: 'Unable to find the selected customer profile.',
        variant: 'destructive',
      });
      return;
    }

    if (customer.status !== 'ACTIVE') {
      toast({
        title: 'Customer inactive',
        description: 'This customer account is not active.',
        variant: 'destructive',
      });
      return;
    }

    if (customer.verification_status !== 'VERIFIED') {
      toast({
        title: 'Customer not verified',
        description: 'Customer must be verified before receiving real deposits.',
        variant: 'destructive',
      });
      return;
    }

    if (!amount.trim() || amountError) {
      toast({
        title: 'Invalid amount',
        description: amountError || 'Please enter a deposit amount.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSubmitting(true);

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.access_token) {
        throw new Error('Your session has expired. Please log in again.');
      }

      const response = await fetch(
        '/api/payments/agent-customer-deposit/initiate',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            customer_id: selectedCustomerId,
            amount: parsedAmount,
            momo_number: momoNumber.trim(),
          }),
        }
      );

      const result = (await response.json()) as AgentDepositResponse;

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Unable to start customer deposit.');
      }

      if (!result.authorization_url) {
        throw new Error('Payment checkout URL was not returned.');
      }

      toast({
        title: 'Customer wallet deposit started',
        description:
          'Redirecting to Paystack Mobile Money checkout. This is a wallet deposit, not a Fund Space contribution.',
      });

      window.location.href = result.authorization_url;
    } catch (error) {
      console.error('Agent customer deposit submit error:', error);

      toast({
        title: 'Deposit failed',
        description:
          error instanceof Error
            ? error.message
            : 'Unable to start customer deposit.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || pageLoading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-4">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-emerald-600" />
          <p className="text-sm text-gray-500">Loading agent deposits...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="rounded-3xl bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-600 p-6 text-white shadow-sm md:p-8">
        <div className="flex flex-col justify-between gap-6 xl:flex-row xl:items-center">
          <div>
            <p className="mb-3 inline-flex rounded-full bg-white/15 px-4 py-1 text-sm font-medium">
              Agent Wallet Deposits
            </p>

            <h1 className="text-3xl font-black md:text-4xl">
              Customer Wallet Deposit
            </h1>

            <p className="mt-4 max-w-3xl text-sm leading-7 text-emerald-50 md:text-base">
              Use this page only when a customer wants to add money to their
              TrustPoint wallet. This is different from paying a Fund Space
              weekly contribution.
            </p>
          </div>

          <button
            type="button"
            onClick={() => loadPage(true)}
            disabled={refreshing || verifyingPayment}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-emerald-700 hover:bg-emerald-50 disabled:opacity-60"
          >
            <RefreshCw
              size={16}
              className={refreshing ? 'animate-spin' : ''}
            />
            Refresh
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-5">
          <div className="flex gap-3">
            <Wallet className="mt-1 h-6 w-6 shrink-0 text-emerald-700" />
            <div>
              <h2 className="font-black text-emerald-900">
                Wallet Deposit
              </h2>
              <p className="mt-1 text-sm leading-6 text-emerald-700">
                Use this when the customer says: “I want to deposit money into
                my wallet.” The money becomes wallet balance after payment
                verification.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-amber-100 bg-amber-50 p-5">
          <div className="flex gap-3">
            <CreditCard className="mt-1 h-6 w-6 shrink-0 text-amber-700" />
            <div>
              <h2 className="font-black text-amber-900">
                Not Contribution Payment
              </h2>
              <p className="mt-1 text-sm leading-6 text-amber-700">
                If the customer wants to pay a weekly Fund Space contribution,
                use the Fund Space contribution payment page, not this wallet
                deposit page.
              </p>
            </div>
          </div>
        </div>
      </div>

      {paymentNotice && (
        <div
          className={`flex items-start gap-3 rounded-2xl border p-4 text-sm font-semibold ${
            paymentNotice.toLowerCase().includes('failed')
              ? 'border-red-100 bg-red-50 text-red-700'
              : 'border-emerald-100 bg-emerald-50 text-emerald-700'
          }`}
        >
          {paymentNotice.toLowerCase().includes('failed') ? (
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          ) : (
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
          )}
          <span>{paymentNotice}</span>
        </div>
      )}

      {errorMessage && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-700">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {verifyingPayment && (
        <div className="flex items-start gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">
          <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin" />
          <span>
            Verifying customer wallet deposit before updating the customer’s
            wallet balance.
          </span>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm md:p-6">
          <h2 className="text-xl font-black text-gray-900">
            Start Customer Wallet Deposit
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Select a customer and start a Mobile Money wallet deposit. This does
            not pay Fund Space contributions.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            <div>
              <label className="mb-2 block text-sm font-bold text-gray-700">
                Search Customer
              </label>

              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search name, phone, email..."
                  className="min-h-12 w-full rounded-xl border border-gray-200 py-3 pl-10 pr-4 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-gray-700">
                Customer
              </label>

              <select
                value={selectedCustomerId}
                onChange={(event) => setSelectedCustomerId(event.target.value)}
                className="min-h-12 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              >
                <option value="">Select customer</option>
                {filteredCustomers.map((item) => (
                  <option key={item.id} value={item.customer_id}>
                    {item.customer?.full_name || 'Unnamed customer'} —{' '}
                    {item.customer?.phone || 'No phone'}
                  </option>
                ))}
              </select>
            </div>

            {selectedCustomer?.customer && (
              <div className="rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-800">
                <p className="font-bold">
                  {selectedCustomer.customer.full_name || 'Selected customer'}
                </p>
                <p className="mt-1">
                  {selectedCustomer.customer.phone || 'No phone'} •{' '}
                  {selectedCustomer.customer.email || 'No email'}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <StatusPill label={selectedCustomer.customer.status} />
                  <StatusPill
                    label={selectedCustomer.customer.verification_status}
                  />
                </div>
              </div>
            )}

            <div>
              <label className="mb-2 block text-sm font-bold text-gray-700">
                Wallet Deposit Amount
              </label>
              <input
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="Example: 100"
                inputMode="decimal"
                className="min-h-12 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
              {amountError && (
                <p className="mt-2 text-xs font-semibold text-red-600">
                  {amountError}
                </p>
              )}
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-gray-700">
                Customer MoMo Number
              </label>
              <input
                value={momoNumber}
                onChange={(event) => setMomoNumber(event.target.value)}
                placeholder="0240000000"
                inputMode="tel"
                className="min-h-12 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
              <p className="mt-2 text-xs text-gray-500">
                The customer pays by Mobile Money. Wallet balance updates only
                after verification.
              </p>
            </div>

            <button
              type="submit"
              disabled={submitting || verifyingPayment}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Starting Wallet Deposit...
                </>
              ) : (
                <>
                  <Smartphone className="h-4 w-4" />
                  Start Customer Wallet Deposit
                </>
              )}
            </button>
          </form>
        </div>

        <div className="space-y-6">
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              title="Assigned Customers"
              value={customers.length}
              icon={<User size={22} />}
            />

            <SummaryCard
              title="Deposit Attempts"
              value={payments.length}
              icon={<CreditCard size={22} />}
            />

            <SummaryCard
              title="Successful"
              value={successfulPaymentsCount}
              icon={<CheckCircle2 size={22} />}
            />

            <SummaryCard
              title="Successful Value"
              valueText={formatCurrency(successfulValue)}
              icon={<Wallet size={22} />}
            />
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <SummaryCard
              title="Pending"
              value={pendingPaymentsCount}
              icon={<Clock size={22} />}
            />

            <SummaryCard
              title="Failed"
              value={failedPaymentsCount}
              icon={<XCircle size={22} />}
            />
          </div>

          <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm md:p-6">
            <h2 className="text-xl font-black text-gray-900">
              Customer Wallet Deposit History
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              These are wallet deposit payment attempts initiated by you for
              customers.
            </p>

            <div className="mt-5 space-y-3">
              {payments.length === 0 ? (
                <div className="rounded-2xl bg-gray-50 p-6 text-center text-sm text-gray-500">
                  No customer wallet deposit attempts yet.
                </div>
              ) : (
                payments.map((payment) => (
                  <div
                    key={payment.id}
                    className="rounded-2xl border border-gray-100 p-4"
                  >
                    <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                      <div>
                        <p className="font-black text-gray-900">
                          {formatCurrency(payment.amount)}
                        </p>

                        <p className="mt-1 text-sm font-bold text-gray-700">
                          {payment.customer_profile?.full_name ||
                            payment.payer_name ||
                            'Customer'}
                        </p>

                        <p className="mt-1 text-xs text-gray-500">
                          Wallet Deposit • {formatLabel(payment.provider)} •{' '}
                          {formatLabel(payment.channel)}
                        </p>

                        <p className="mt-1 break-all text-xs text-gray-500">
                          Ref:{' '}
                          {payment.provider_reference ||
                            payment.internal_reference}
                        </p>
                      </div>

                      <StatusBadge status={payment.status} />
                    </div>

                    {isSuccessStatus(payment.status) && (
                      <p className="mt-3 rounded-xl bg-emerald-50 p-3 text-xs font-semibold text-emerald-700">
                        Successful wallet deposit. Customer wallet should now be
                        credited.
                      </p>
                    )}

                    {isPendingStatus(payment.status) && (
                      <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs font-semibold text-amber-700">
                        Payment is still pending or processing. The wallet is
                        not credited yet.
                      </p>
                    )}

                    {payment.failure_reason && (
                      <p className="mt-3 rounded-xl bg-red-50 p-3 text-xs text-red-700">
                        {payment.failure_reason}
                      </p>
                    )}

                    <p className="mt-3 text-xs text-gray-400">
                      {formatDateTime(payment.created_at)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusPill({ label }: { label: string | null | undefined }) {
  return (
    <span
      className={`rounded-full border px-3 py-1 text-xs font-bold ${getStatusStyle(
        label
      )}`}
    >
      {formatLabel(label)}
    </span>
  );
}

function StatusBadge({ status }: { status: string | null | undefined }) {
  const value = String(status || 'PENDING').toUpperCase();

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-bold ${getStatusStyle(
        status
      )}`}
    >
      {isSuccessStatus(value) && <CheckCircle2 size={13} />}
      {isPendingStatus(value) && <Clock size={13} />}
      {isFailedStatus(value) && <XCircle size={13} />}
      {formatLabel(status)}
    </span>
  );
}

function SummaryCard({
  title,
  value,
  valueText,
  icon,
}: {
  title: string;
  value?: number;
  valueText?: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="mb-4 inline-flex rounded-2xl bg-emerald-50 p-3 text-emerald-700">
        {icon}
      </div>
      <p className="text-sm text-gray-500">{title}</p>
      <h3 className="mt-1 text-3xl font-black text-gray-900">
        {valueText ?? value ?? 0}
      </h3>
    </div>
  );
}