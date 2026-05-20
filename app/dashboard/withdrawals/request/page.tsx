'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Wallet,
  XCircle,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase/client';
import {
  calculateNetWithdrawal,
  calculateWalletBalance,
  calculateWithdrawalFee,
  getPendingWithdrawals,
} from '@/lib/wallet';

type RpcJson =
  | string
  | number
  | boolean
  | null
  | { [key: string]: RpcJson | undefined }
  | RpcJson[];

type RequestWithdrawalResult = {
  success?: boolean;
  message?: string;
  withdrawal_id?: string;
  request_id?: string;
  balance?: number;
  available_balance?: number;
};

type SupabaseWithWithdrawalRpc = typeof supabase & {
  rpc(
    fn: 'request_withdrawal',
    args: {
      p_amount: number;
      p_withdrawal_method?: string;
      p_momo_number?: string | null;
      p_bank_name?: string | null;
    }
  ): Promise<{
    data: RpcJson;
    error: {
      message: string;
    } | null;
  }>;
};

type UserPaymentProfile = {
  momo_number: string | null;
  phone: string | null;
  full_name: string | null;
};

function formatCurrency(value: number) {
  return `GH₵ ${Number(value || 0).toFixed(2)}`;
}

function cleanPhone(value: string) {
  return value.trim().replace(/\s+/g, '');
}

function asResult(value: RpcJson): RequestWithdrawalResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return value as RequestWithdrawalResult;
}

function getAmountStatus({
  amount,
  availableBalance,
}: {
  amount: number;
  availableBalance: number;
}) {
  if (availableBalance <= 0) {
    return {
      valid: false,
      message:
        'You do not have available balance for withdrawal at the moment.',
    };
  }

  if (amount <= 0) {
    return {
      valid: false,
      message: 'Enter an amount greater than zero.',
    };
  }

  if (amount > availableBalance) {
    return {
      valid: false,
      message: `You cannot request more than your available balance of ${formatCurrency(
        availableBalance
      )}.`,
    };
  }

  return {
    valid: true,
    message: 'This amount is available for withdrawal.',
  };
}

export default function RequestWithdrawalPage() {
  const { profile } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [amount, setAmount] = useState('');
  const [momoNumber, setMomoNumber] = useState('');
  const [savedMomoNumber, setSavedMomoNumber] = useState('');
  const [paymentProfile, setPaymentProfile] =
    useState<UserPaymentProfile | null>(null);

  const [walletBalance, setWalletBalance] = useState(0);
  const [pendingWithdrawals, setPendingWithdrawals] = useState(0);
  const [availableBalance, setAvailableBalance] = useState(0);

  const [loadingBalance, setLoadingBalance] = useState(true);
  const [loadingPaymentProfile, setLoadingPaymentProfile] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [errorMessage, setErrorMessage] = useState('');

  const withdrawalAmount = useMemo(() => {
    const value = Number(amount);
    return Number.isFinite(value) ? value : 0;
  }, [amount]);

  const amountStatus = useMemo(() => {
    return getAmountStatus({
      amount: withdrawalAmount,
      availableBalance,
    });
  }, [withdrawalAmount, availableBalance]);

  const shouldShowAmountError =
    amount.trim().length > 0 && !amountStatus.valid;

  const fee = useMemo(() => {
    if (withdrawalAmount <= 0) return 0;
    return calculateWithdrawalFee(withdrawalAmount);
  }, [withdrawalAmount]);

  const netAmount = useMemo(() => {
    if (withdrawalAmount <= 0) return 0;
    return calculateNetWithdrawal(withdrawalAmount);
  }, [withdrawalAmount]);

  const cleanMomoNumber = useMemo(() => {
    return cleanPhone(momoNumber);
  }, [momoNumber]);

  const momoIsMissing = cleanMomoNumber.length === 0;
  const momoIsInvalid =
    cleanMomoNumber.length > 0 && cleanMomoNumber.length < 10;

  const canSubmit =
    !submitting &&
    !loadingBalance &&
    !loadingPaymentProfile &&
    amountStatus.valid &&
    cleanMomoNumber.length >= 10;

  async function loadPaymentProfile() {
    if (!profile?.id) {
      setLoadingPaymentProfile(false);
      return;
    }

    try {
      setLoadingPaymentProfile(true);

      const { data, error } = await supabase
        .from('profiles')
        .select('momo_number, phone, full_name')
        .eq('id', profile.id)
        .maybeSingle();

      if (error) {
        throw new Error(error.message);
      }

      const loadedProfile: UserPaymentProfile = {
        momo_number: data?.momo_number || null,
        phone: data?.phone || null,
        full_name: data?.full_name || null,
      };

      setPaymentProfile(loadedProfile);

      const detectedMomo =
        cleanPhone(loadedProfile.momo_number || '') ||
        cleanPhone(loadedProfile.phone || '');

      setSavedMomoNumber(detectedMomo);
      setMomoNumber(detectedMomo);
    } catch (error) {
      console.error('Load payment profile error:', error);

      setErrorMessage(
        'Could not detect your saved Mobile Money number. You can still enter it manually.'
      );
    } finally {
      setLoadingPaymentProfile(false);
    }
  }

  async function loadBalance() {
    if (!profile?.id) {
      setLoadingBalance(false);
      return;
    }

    try {
      setLoadingBalance(true);
      setErrorMessage('');

      const balance = await calculateWalletBalance(profile.id);
      const pending = await getPendingWithdrawals(profile.id);
      const available = Math.max(0, balance - pending);

      setWalletBalance(balance);
      setPendingWithdrawals(pending);
      setAvailableBalance(available);
    } catch (error) {
      console.error('Withdrawal balance load error:', error);

      setErrorMessage(
        'Could not load your wallet balance. Please refresh and try again.'
      );
    } finally {
      setLoadingBalance(false);
    }
  }

  async function loadPageData() {
    await Promise.all([loadPaymentProfile(), loadBalance()]);
  }

  useEffect(() => {
    loadPageData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setErrorMessage('');

    if (!profile?.id) {
      setErrorMessage('Your session has expired. Please login again.');
      return;
    }

    if (availableBalance <= 0) {
      setErrorMessage(
        'You do not have available balance for withdrawal at the moment.'
      );
      return;
    }

    if (!amount.trim()) {
      setErrorMessage('Please enter the withdrawal amount.');
      return;
    }

    if (!amountStatus.valid) {
      setErrorMessage(amountStatus.message);
      return;
    }

    if (momoIsMissing) {
      setErrorMessage(
        'No Mobile Money number was detected. Please enter your MoMo number.'
      );
      return;
    }

    if (momoIsInvalid) {
      setErrorMessage('Please enter a valid Mobile Money number.');
      return;
    }

    try {
      setSubmitting(true);

      const rpcSupabase = supabase as SupabaseWithWithdrawalRpc;

      const { data, error } = await rpcSupabase.rpc('request_withdrawal', {
        p_amount: withdrawalAmount,
        p_withdrawal_method: 'MOMO',
        p_momo_number: cleanMomoNumber,
        p_bank_name: null,
      });

      if (error) {
        throw new Error(error.message || 'Failed to submit withdrawal request.');
      }

      const result = asResult(data);

      if (result.success === false) {
        throw new Error(
          result.message || 'Failed to submit withdrawal request.'
        );
      }

      toast({
        title: 'Withdrawal request submitted',
        description:
          result.message ||
          'Your withdrawal request has been submitted for admin review.',
      });

      router.push('/dashboard/withdrawals');
    } catch (error) {
      console.error('Submit withdrawal request error:', error);

      const message =
        error instanceof Error
          ? error.message
          : 'Failed to submit withdrawal request.';

      setErrorMessage(message);

      toast({
        title: 'Withdrawal failed',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="rounded-3xl bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-600 p-6 text-white shadow-sm md:p-8">
        <div className="flex flex-col justify-between gap-6 xl:flex-row xl:items-center">
          <div>
            <p className="mb-3 inline-flex rounded-full bg-white/15 px-4 py-1 text-sm font-medium">
              Wallet Withdrawal
            </p>

            <h1 className="flex items-center gap-3 text-3xl font-black md:text-4xl">
              <Wallet className="h-8 w-8" />
              Request Withdrawal
            </h1>

            <p className="mt-4 max-w-3xl text-sm leading-7 text-emerald-50 md:text-base">
              Request a withdrawal from your available wallet balance. Your
              saved Mobile Money number will be detected automatically where
              available.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/dashboard/withdrawals"
                className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-emerald-700 hover:bg-emerald-50"
              >
                <ArrowLeft size={16} />
                Back to Withdrawals
              </Link>

              <Link
                href="/dashboard/transactions"
                className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-5 py-3 text-sm font-bold text-white ring-1 ring-white/20 hover:bg-white/20"
              >
                View Transactions
                <ArrowRight size={16} />
              </Link>
            </div>
          </div>

          <button
            type="button"
            onClick={loadPageData}
            disabled={loadingBalance || loadingPaymentProfile}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white/15 px-5 py-3 text-sm font-bold text-white ring-1 ring-white/20 hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw
              size={16}
              className={
                loadingBalance || loadingPaymentProfile ? 'animate-spin' : ''
              }
            />
            Refresh Details
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-700">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <BalanceCard
          title="Wallet Balance"
          value={loadingBalance ? '...' : formatCurrency(walletBalance)}
          icon={<Wallet size={24} />}
          color="emerald"
        />

        <BalanceCard
          title="Pending Withdrawals"
          value={loadingBalance ? '...' : formatCurrency(pendingWithdrawals)}
          icon={<ShieldCheck size={24} />}
          color="amber"
        />

        <BalanceCard
          title="Available Balance"
          value={loadingBalance ? '...' : formatCurrency(availableBalance)}
          icon={<CheckCircle2 size={24} />}
          color={availableBalance > 0 ? 'blue' : 'red'}
        />
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <Card className="rounded-3xl border-gray-100 shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl font-black text-gray-900">
              Withdrawal Details
            </CardTitle>

            <CardDescription>
              Enter the amount you want to withdraw. The form will stop you if
              the amount is more than your available balance.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {availableBalance <= 0 && !loadingBalance && (
                <div className="flex items-start gap-3 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
                  <XCircle className="mt-0.5 h-5 w-5 shrink-0" />
                  <div>
                    <p className="font-bold">Withdrawal unavailable</p>
                    <p className="mt-1">
                      You currently do not have available wallet balance to
                      request a withdrawal.
                    </p>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="amount">Amount (GH₵) *</Label>

                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="1"
                  max={availableBalance > 0 ? availableBalance : undefined}
                  placeholder="100.00"
                  value={amount}
                  onChange={(event) => {
                    setAmount(event.target.value);
                    setErrorMessage('');
                  }}
                  disabled={availableBalance <= 0 || loadingBalance}
                  className={`min-h-12 rounded-xl font-semibold transition ${
                    shouldShowAmountError || availableBalance <= 0
                      ? 'border-red-500 bg-red-50 text-red-700 placeholder:text-red-300 focus:border-red-500 focus:ring-red-100'
                      : withdrawalAmount > 0 && amountStatus.valid
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-800 focus:border-emerald-500 focus:ring-emerald-100'
                        : 'border-gray-200'
                  }`}
                  required
                />

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-gray-500">
                    Maximum available: {formatCurrency(availableBalance)}
                  </p>

                  {amount.trim().length > 0 && (
                    <p
                      className={`text-xs font-bold ${
                        amountStatus.valid ? 'text-emerald-700' : 'text-red-700'
                      }`}
                    >
                      {amountStatus.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="momoNumber">Mobile Money Number *</Label>

                <div
                  className={`rounded-2xl border p-4 ${
                    savedMomoNumber
                      ? 'border-emerald-100 bg-emerald-50'
                      : 'border-amber-100 bg-amber-50'
                  }`}
                >
                  <div className="mb-3 flex items-start gap-3">
                    <Smartphone
                      className={`mt-0.5 h-5 w-5 shrink-0 ${
                        savedMomoNumber ? 'text-emerald-700' : 'text-amber-700'
                      }`}
                    />

                    <div>
                      <p
                        className={`text-sm font-bold ${
                          savedMomoNumber ? 'text-emerald-800' : 'text-amber-800'
                        }`}
                      >
                        {savedMomoNumber
                          ? 'MoMo number detected automatically'
                          : 'No saved MoMo number detected'}
                      </p>

                      <p
                        className={`mt-1 text-xs ${
                          savedMomoNumber ? 'text-emerald-700' : 'text-amber-700'
                        }`}
                      >
                        {savedMomoNumber
                          ? 'You can still edit it if you want the payment sent to another active number.'
                          : 'Enter your MoMo number manually before submitting.'}
                      </p>
                    </div>
                  </div>

                  <Input
                    id="momoNumber"
                    type="tel"
                    placeholder="0240000000"
                    value={momoNumber}
                    onChange={(event) => {
                      setMomoNumber(event.target.value);
                      setErrorMessage('');
                    }}
                    disabled={loadingPaymentProfile}
                    className={`min-h-12 rounded-xl bg-white font-semibold ${
                      momoIsInvalid
                        ? 'border-red-500 text-red-700 focus:border-red-500 focus:ring-red-100'
                        : 'border-gray-200'
                    }`}
                    required
                  />

                  {momoIsInvalid && (
                    <p className="mt-2 text-xs font-bold text-red-700">
                      Please enter a valid Mobile Money number.
                    </p>
                  )}
                </div>
              </div>

              {withdrawalAmount > 0 && (
                <div
                  className={`rounded-2xl border p-5 ${
                    amountStatus.valid
                      ? 'border-emerald-100 bg-emerald-50'
                      : 'border-red-100 bg-red-50'
                  }`}
                >
                  <h3
                    className={`mb-4 text-sm font-black ${
                      amountStatus.valid ? 'text-emerald-900' : 'text-red-900'
                    }`}
                  >
                    Withdrawal Summary
                  </h3>

                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between gap-4">
                      <span
                        className={
                          amountStatus.valid
                            ? 'text-emerald-700'
                            : 'text-red-700'
                        }
                      >
                        Requested Amount
                      </span>
                      <span
                        className={
                          amountStatus.valid
                            ? 'font-bold text-emerald-900'
                            : 'font-bold text-red-900'
                        }
                      >
                        {formatCurrency(withdrawalAmount)}
                      </span>
                    </div>

                    <div className="flex justify-between gap-4">
                      <span
                        className={
                          amountStatus.valid
                            ? 'text-emerald-700'
                            : 'text-red-700'
                        }
                      >
                        Processing Fee
                      </span>
                      <span className="font-bold text-red-600">
                        -{formatCurrency(fee)}
                      </span>
                    </div>

                    <div
                      className={`border-t pt-3 ${
                        amountStatus.valid
                          ? 'border-emerald-200'
                          : 'border-red-200'
                      }`}
                    >
                      <div className="flex justify-between gap-4">
                        <span
                          className={
                            amountStatus.valid
                              ? 'font-black text-emerald-900'
                              : 'font-black text-red-900'
                          }
                        >
                          You Will Receive
                        </span>
                        <span
                          className={
                            amountStatus.valid
                              ? 'font-black text-emerald-700'
                              : 'font-black text-red-700'
                          }
                        >
                          {amountStatus.valid
                            ? formatCurrency(netAmount)
                            : 'Not allowed'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <Button
                type="submit"
                disabled={!canSubmit}
                className="min-h-12 w-full rounded-xl bg-emerald-600 text-sm font-bold hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting Request...
                  </>
                ) : (
                  <>
                    Submit Withdrawal Request
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                className="min-h-12 w-full rounded-xl text-sm font-bold"
              >
                Cancel
              </Button>
            </form>
          </CardContent>
        </Card>

        <aside className="space-y-5">
          <Card className="rounded-3xl border-amber-100 bg-amber-50 shadow-sm">
            <CardContent className="p-6">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-amber-700">
                <AlertCircle size={24} />
              </div>

              <h3 className="text-lg font-black text-gray-900">
                Important Information
              </h3>

              <ul className="mt-4 space-y-3 text-sm leading-6 text-gray-700">
                <li>• Withdrawal requests are reviewed by admin.</li>
                <li>• Pending withdrawals reduce your available balance.</li>
                <li>• You cannot request more than your available balance.</li>
                <li>• Approved requests are paid to your MoMo number.</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-gray-100 shadow-sm">
            <CardContent className="p-6">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
                <Smartphone size={24} />
              </div>

              <h3 className="text-lg font-black text-gray-900">
                Detected Payment Details
              </h3>

              <div className="mt-4 space-y-3 text-sm text-gray-600">
                <div className="rounded-2xl bg-gray-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-gray-400">
                    Saved MoMo Number
                  </p>
                  <p className="mt-1 font-black text-gray-900">
                    {loadingPaymentProfile
                      ? 'Checking...'
                      : savedMomoNumber || 'Not saved'}
                  </p>
                </div>

                <div className="rounded-2xl bg-gray-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-gray-400">
                    Profile Name
                  </p>
                  <p className="mt-1 font-black text-gray-900">
                    {paymentProfile?.full_name || 'Not available'}
                  </p>
                </div>
              </div>

              <p className="mt-4 text-sm leading-6 text-gray-600">
                Make sure the MoMo number is active and belongs to you before
                submitting the request.
              </p>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function BalanceCard({
  title,
  value,
  icon,
  color,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  color: 'emerald' | 'amber' | 'blue' | 'red';
}) {
  const classes = {
    emerald: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    blue: 'bg-blue-50 text-blue-700',
    red: 'bg-red-50 text-red-700',
  };

  return (
    <Card className="rounded-3xl border-gray-100 shadow-sm">
      <CardContent className="p-6">
        <div className={`mb-4 inline-flex rounded-2xl p-3 ${classes[color]}`}>
          {icon}
        </div>

        <p className="text-sm text-gray-500">{title}</p>

        <h3 className="mt-1 text-3xl font-black text-gray-900">{value}</h3>
      </CardContent>
    </Card>
  );
}