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
  ArrowDownCircle,
  CheckCircle2,
  CreditCard,
  History,
  Loader2,
  RefreshCcw,
  ShieldCheck,
  Smartphone,
  Wallet,
} from 'lucide-react';

import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase/client';
import { createAuditLog, AUDIT_ACTIONS, ENTITY_TYPES } from '@/lib/audit';
import type { Database } from '@/lib/database.types';

type WalletAccount = Database['public']['Tables']['wallet_accounts']['Row'];
type SavingsPlan = Database['public']['Tables']['savings_plans']['Row'];
type Group = Database['public']['Tables']['groups']['Row'];
type PaymentTransaction =
  Database['public']['Tables']['payment_transactions']['Row'];
type Transaction = Database['public']['Tables']['transactions']['Row'];

type GroupMemberWithGroup = {
  group_id: string;
  groups: Pick<Group, 'id' | 'name'> | null;
};

type DepositMode = 'REAL_MOMO' | 'MANUAL_REQUEST';

type WalletDepositResponse = {
  success?: boolean;
  message?: string;
  authorization_url?: string;
  reference?: string;
  payment_transaction_id?: string;
};

type VerifyPaymentResponse = {
  success?: boolean;
  message?: string;
  already_processed?: boolean;
  payment_status?: string;
  verification_mismatch?: boolean;
};

function formatMoney(amount: number | null | undefined) {
  const value = Number(amount || 0);

  return `GH₵${value.toLocaleString('en-GH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value: string | null) {
  if (!value) return '—';

  return new Intl.DateTimeFormat('en-GH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function statusClass(status: string) {
  switch (status) {
    case 'SUCCESS':
    case 'COMPLETED':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'PROCESSING':
    case 'PENDING':
      return 'border-yellow-200 bg-yellow-50 text-yellow-700';
    case 'FAILED':
    case 'CANCELLED':
    case 'ABANDONED':
    case 'REVERSED':
      return 'border-red-200 bg-red-50 text-red-700';
    default:
      return 'border-slate-200 bg-slate-50 text-slate-700';
  }
}

function getPaymentReferenceFromUrl(
  searchParams: {
    get: (name: string) => string | null;
  }
) {
  return (
    searchParams.get('payment_reference') ||
    searchParams.get('reference') ||
    searchParams.get('trxref') ||
    ''
  ).trim();
}

export default function DepositPage() {
  const { profile } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const verificationAttemptedRef = useRef(false);

  const [depositMode, setDepositMode] = useState<DepositMode>('REAL_MOMO');

  const [amount, setAmount] = useState('');
  const [momoNumber, setMomoNumber] = useState('');
  const [savingsPlanId, setSavingsPlanId] = useState<string | undefined>();
  const [groupId, setGroupId] = useState<string | undefined>();
  const [note, setNote] = useState('');

  const [wallet, setWallet] = useState<WalletAccount | null>(null);
  const [savingsPlans, setSavingsPlans] = useState<SavingsPlan[]>([]);
  const [groups, setGroups] = useState<Pick<Group, 'id' | 'name'>[]>([]);
  const [recentPayments, setRecentPayments] = useState<PaymentTransaction[]>(
    []
  );
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>(
    []
  );

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [verifyingPayment, setVerifyingPayment] = useState(false);

  const parsedAmount = useMemo(() => {
    return Number(amount.replace(/,/g, '').trim());
  }, [amount]);

  const amountError = useMemo(() => {
    if (!amount.trim()) return '';
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return 'Please enter a valid amount.';
    }
    if (parsedAmount < 1) return 'Minimum deposit is GH₵1.';
    if (parsedAmount > 100000) return 'Maximum deposit is GH₵100,000.';
    return '';
  }, [amount, parsedAmount]);

  const canUseRealPayment =
    profile?.status === 'ACTIVE' &&
    profile?.verification_status === 'VERIFIED' &&
    (profile?.role === 'USER' || profile?.role === 'AGENT');

  const loadDepositData = useCallback(
    async (showRefresh = false) => {
      if (!profile?.id) return;

      try {
        if (showRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        await supabase.rpc('create_user_wallet_if_missing', {
          p_user_id: profile.id,
        });

        const [
          walletResult,
          plansResult,
          groupsResult,
          paymentsResult,
          transactionsResult,
        ] = await Promise.all([
          supabase
            .from('wallet_accounts')
            .select('*')
            .eq('user_id', profile.id)
            .maybeSingle(),

          supabase
            .from('savings_plans')
            .select('*')
            .eq('user_id', profile.id)
            .eq('status', 'ACTIVE')
            .order('created_at', { ascending: false }),

          supabase
            .from('group_members')
            .select('group_id, groups(id, name)')
            .eq('user_id', profile.id),

          supabase
            .from('payment_transactions')
            .select('*')
            .eq('user_id', profile.id)
            .in('payment_type', ['WALLET_DEPOSIT', 'AGENT_CUSTOMER_DEPOSIT'])
            .order('created_at', { ascending: false })
            .limit(5),

          supabase
            .from('transactions')
            .select('*')
            .eq('user_id', profile.id)
            .order('created_at', { ascending: false })
            .limit(5),
        ]);

        if (walletResult.error) {
          console.warn('Wallet load warning:', walletResult.error.message);
        } else {
          setWallet(walletResult.data);
        }

        if (plansResult.error) {
          console.warn('Savings plans load warning:', plansResult.error.message);
        } else {
          setSavingsPlans(plansResult.data || []);
        }

        if (groupsResult.error) {
          console.warn('Groups load warning:', groupsResult.error.message);
        } else {
          const rows = (groupsResult.data ||
            []) as unknown as GroupMemberWithGroup[];

          const formattedGroups = rows
            .map((member) => member.groups)
            .filter((group): group is Pick<Group, 'id' | 'name'> =>
              Boolean(group)
            );

          setGroups(formattedGroups);
        }

        if (paymentsResult.error) {
          console.warn(
            'Payment transactions load warning:',
            paymentsResult.error.message
          );
        } else {
          setRecentPayments(paymentsResult.data || []);
        }

        if (transactionsResult.error) {
          console.warn(
            'Transactions load warning:',
            transactionsResult.error.message
          );
        } else {
          setRecentTransactions(transactionsResult.data || []);
        }
      } catch (error) {
        console.error('Deposit data load error:', error);

        toast({
          title: 'Error',
          description: 'Unable to load deposit information.',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [profile?.id, toast]
  );

  const verifyReturnedPayment = useCallback(
    async (reference: string) => {
      if (!reference || verificationAttemptedRef.current) return;

      verificationAttemptedRef.current = true;

      try {
        setVerifyingPayment(true);

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

        toast({
          title: result.already_processed
            ? 'Payment already processed'
            : 'Payment verified',
          description:
            result.message ||
            'Your payment has been verified and your wallet has been updated.',
        });

        await loadDepositData(true);

        router.replace('/dashboard/deposit');
      } catch (error) {
        console.error('Returned payment verification error:', error);

        toast({
          title: 'Payment verification failed',
          description:
            error instanceof Error
              ? error.message
              : 'Unable to verify the returned payment.',
          variant: 'destructive',
        });
      } finally {
        setVerifyingPayment(false);
      }
    },
    [loadDepositData, router, toast]
  );

  useEffect(() => {
    if (profile?.id) {
      loadDepositData();
      setMomoNumber(profile.momo_number || profile.phone || '');
    }
  }, [profile?.id, profile?.momo_number, profile?.phone, loadDepositData]);

  useEffect(() => {
    if (!profile?.id || loading) return;

    const reference = getPaymentReferenceFromUrl(searchParams);

    if (reference) {
      verifyReturnedPayment(reference);
    }
  }, [profile?.id, loading, searchParams, verifyReturnedPayment]);

  async function handleRealMomoDeposit() {
    if (!profile?.id) {
      toast({
        title: 'Login required',
        description: 'Please log in again before making a deposit.',
        variant: 'destructive',
      });
      return;
    }

    if (!canUseRealPayment) {
      toast({
        title: 'Verification required',
        description:
          'Your account must be active and verified before making real Mobile Money deposits.',
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

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session?.access_token) {
      throw new Error('Your session has expired. Please log in again.');
    }

    const response = await fetch('/api/payments/wallet-deposit/initiate', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: parsedAmount,
        momo_number: momoNumber.trim() || profile.momo_number || profile.phone,
      }),
    });

    const result = (await response.json()) as WalletDepositResponse;

    if (!response.ok || !result.success) {
      throw new Error(result.message || 'Unable to initialize deposit payment.');
    }

    if (!result.authorization_url) {
      throw new Error('Payment checkout URL was not returned.');
    }

    toast({
      title: 'Payment started',
      description: 'Redirecting you to complete your Mobile Money payment.',
    });

    window.location.href = result.authorization_url;
  }

  async function handleManualDepositRequest() {
    if (!profile?.id) {
      toast({
        title: 'Login required',
        description: 'Please log in again before recording a deposit.',
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

    const { data, error } = await supabase
      .from('transactions')
      .insert({
        user_id: profile.id,
        type: 'DEPOSIT',
        direction: 'CREDIT',
        amount: parsedAmount,
        currency: 'GHS',
        channel: 'USER_ENTRY',
        status: 'PENDING',
        created_by: profile.id,
        savings_plan_id: savingsPlanId || null,
        group_id: groupId || null,
        note:
          note.trim() ||
          'Manual deposit request submitted by user. Pending admin confirmation.',
        metadata: {
          source: 'dashboard_deposit_page',
          deposit_mode: 'MANUAL_REQUEST',
          requires_admin_confirmation: true,
        },
      })
      .select('id')
      .single();

    if (error) throw error;

    await createAuditLog(
      profile.id,
      AUDIT_ACTIONS.DEPOSIT_CREATED,
      ENTITY_TYPES.TRANSACTION,
      data.id,
      {
        amount: parsedAmount,
        channel: 'USER_ENTRY',
        status: 'PENDING',
        source: 'dashboard_deposit_page',
      }
    );

    toast({
      title: 'Deposit request recorded',
      description:
        'Your manual deposit request has been recorded and is pending admin confirmation.',
    });

    setAmount('');
    setNote('');
    setSavingsPlanId(undefined);
    setGroupId(undefined);

    await loadDepositData(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setSubmitting(true);

      if (depositMode === 'REAL_MOMO') {
        await handleRealMomoDeposit();
      } else {
        await handleManualDepositRequest();
      }
    } catch (error) {
      console.error('Deposit submit error:', error);

      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to process deposit.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-emerald-600" />
          <p className="mt-3 text-sm font-medium text-slate-600">
            Loading deposit page...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold text-slate-900">
            <ArrowDownCircle className="h-8 w-8 text-emerald-600" />
            Deposit Money
          </h1>
          <p className="mt-1 text-slate-600">
            Make a real Mobile Money deposit or record a manual deposit request.
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={() => loadDepositData(true)}
          disabled={refreshing || verifyingPayment}
          className="w-full md:w-auto"
        >
          {refreshing ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCcw className="mr-2 h-4 w-4" />
          )}
          Refresh
        </Button>
      </div>

      {verifyingPayment && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <div className="flex gap-3">
            <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin" />
            <div>
              <p className="font-bold">Verifying payment</p>
              <p className="mt-1">
                TrustPoint is confirming your Paystack transaction before
                updating your wallet balance.
              </p>
            </div>
          </div>
        </div>
      )}

      {!canUseRealPayment && (
        <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
          <div className="flex gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-bold">Real payment requires verification</p>
              <p className="mt-1">
                Your account must be active and verified before making real
                Mobile Money deposits. Manual deposit requests can still be
                recorded for admin review if allowed by your system policy.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <div className="space-y-6">
          <Card className="border-emerald-100 bg-gradient-to-br from-emerald-700 to-emerald-950 text-white shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
                  <Wallet className="h-6 w-6" />
                </div>

                <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold">
                  {wallet?.currency || 'GHS'}
                </span>
              </div>

              <p className="mt-8 text-sm font-semibold text-emerald-100">
                Available Balance
              </p>

              <h2 className="mt-2 text-4xl font-black">
                {formatMoney(wallet?.available_balance)}
              </h2>

              <div className="mt-6 rounded-2xl bg-white/10 p-4">
                <p className="text-xs font-semibold text-emerald-100">
                  Locked Balance
                </p>
                <p className="mt-1 text-lg font-extrabold">
                  {formatMoney(wallet?.locked_balance)}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-lg">
            <CardHeader>
              <CardTitle>New Deposit</CardTitle>
              <CardDescription>
                Real Mobile Money deposits are verified automatically before
                your wallet is credited.
              </CardDescription>
            </CardHeader>

            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1">
                  <button
                    type="button"
                    onClick={() => setDepositMode('REAL_MOMO')}
                    className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-bold transition ${
                      depositMode === 'REAL_MOMO'
                        ? 'bg-white text-emerald-700 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Smartphone className="h-4 w-4" />
                    Real MoMo
                  </button>

                  <button
                    type="button"
                    onClick={() => setDepositMode('MANUAL_REQUEST')}
                    className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-bold transition ${
                      depositMode === 'MANUAL_REQUEST'
                        ? 'bg-white text-emerald-700 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <CreditCard className="h-4 w-4" />
                    Manual
                  </button>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="amount">Amount (GH₵) *</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    min="1"
                    placeholder="100.00"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    required
                  />
                  {amountError && (
                    <p className="flex items-center gap-1 text-xs font-semibold text-red-600">
                      <AlertCircle className="h-3.5 w-3.5" />
                      {amountError}
                    </p>
                  )}
                </div>

                {depositMode === 'REAL_MOMO' && (
                  <div className="space-y-2">
                    <Label htmlFor="momoNumber">Mobile Money Number</Label>
                    <Input
                      id="momoNumber"
                      placeholder="0240000000"
                      value={momoNumber}
                      onChange={(event) => setMomoNumber(event.target.value)}
                      inputMode="tel"
                    />
                    <p className="text-xs text-slate-500">
                      Paystack will guide you to complete the Mobile Money
                      payment. Your wallet updates only after confirmation.
                    </p>
                  </div>
                )}

                {depositMode === 'MANUAL_REQUEST' && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="savingsPlan">
                        Savings Plan (Optional)
                      </Label>
                      <Select
                        value={savingsPlanId}
                        onValueChange={(value) =>
                          setSavingsPlanId(
                            value === 'NONE' ? undefined : value
                          )
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="No specific plan" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="NONE">
                            No specific plan
                          </SelectItem>
                          {savingsPlans.map((plan) => (
                            <SelectItem key={plan.id} value={plan.id}>
                              {plan.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="group">Group (Optional)</Label>
                      <Select
                        value={groupId}
                        onValueChange={(value) =>
                          setGroupId(value === 'NONE' ? undefined : value)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Not for a group" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="NONE">Not for a group</SelectItem>
                          {groups.map((group) => (
                            <SelectItem key={group.id} value={group.id}>
                              {group.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="note">Note (Optional)</Label>
                      <Textarea
                        id="note"
                        placeholder="Example: Deposited with Agent John at Accra Mall"
                        value={note}
                        onChange={(event) => setNote(event.target.value)}
                        rows={3}
                      />
                    </div>
                  </>
                )}

                <div className="rounded-2xl bg-slate-50 p-4 text-xs text-slate-600">
                  <p className="font-bold text-slate-800">Safety note</p>
                  <p className="mt-1">
                    Real deposits are not credited from the browser alone.
                    TrustPoint verifies the provider reference before updating
                    your wallet balance.
                  </p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button
                    type="submit"
                    className="flex-1 bg-emerald-700 hover:bg-emerald-800"
                    disabled={submitting || verifyingPayment}
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : depositMode === 'REAL_MOMO' ? (
                      'Deposit with Mobile Money'
                    ) : (
                      'Record Manual Deposit'
                    )}
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.back()}
                    disabled={submitting || verifyingPayment}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-none shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5 text-emerald-600" />
                Recent Payment Attempts
              </CardTitle>
              <CardDescription>
                These are real provider payment records from Paystack or future
                payment providers.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-3">
              {recentPayments.length === 0 ? (
                <div className="rounded-2xl bg-slate-50 p-5 text-sm text-slate-500">
                  No real payment attempts yet.
                </div>
              ) : (
                recentPayments.map((payment) => (
                  <div
                    key={payment.id}
                    className="rounded-2xl border border-slate-100 p-4"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-extrabold text-slate-950">
                          {formatMoney(payment.amount)}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {payment.provider} • {payment.channel}
                        </p>
                        <p className="mt-1 break-all text-xs text-slate-500">
                          Ref:{' '}
                          {payment.provider_reference ||
                            payment.internal_reference}
                        </p>
                      </div>

                      <span
                        className={`w-fit rounded-full border px-3 py-1 text-xs font-bold ${statusClass(
                          payment.status
                        )}`}
                      >
                        {payment.status}
                      </span>
                    </div>

                    <p className="mt-3 text-xs text-slate-400">
                      {formatDate(payment.created_at)}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="border-none shadow-lg">
            <CardHeader>
              <CardTitle>Recent Transactions</CardTitle>
              <CardDescription>
                Wallet and system transaction records.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-3">
              {recentTransactions.length === 0 ? (
                <div className="rounded-2xl bg-slate-50 p-5 text-sm text-slate-500">
                  No transactions yet.
                </div>
              ) : (
                recentTransactions.map((transaction) => (
                  <div
                    key={transaction.id}
                    className="rounded-2xl border border-slate-100 p-4"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-extrabold text-slate-950">
                          {transaction.type.replace(/_/g, ' ')}
                        </p>
                        <p className="mt-1 text-sm font-bold text-slate-700">
                          {transaction.direction === 'CREDIT' ? '+' : '-'}
                          {formatMoney(transaction.amount)}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {transaction.channel}
                        </p>
                      </div>

                      <span
                        className={`w-fit rounded-full border px-3 py-1 text-xs font-bold ${statusClass(
                          transaction.status
                        )}`}
                      >
                        {transaction.status}
                      </span>
                    </div>

                    <p className="mt-3 text-xs text-slate-400">
                      {formatDate(transaction.created_at)}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}