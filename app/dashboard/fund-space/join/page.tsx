'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CircleDollarSign,
  Clock,
  Loader2,
  ShieldCheck,
  Sparkles,
  Users,
  Wallet,
  XCircle,
} from 'lucide-react';

import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

type FundSpaceMember = {
  id: string;
  user_id: string;
  fund_space_id: string;
  contribution_amount: number;
  status: string | null;
  joined_at: string | null;
};

const plans = [
  {
    amount: 50,
    title: 'Starter Group',
    description: 'Best for beginners and small weekly savings.',
    highlight: 'Low commitment',
  },
  {
    amount: 100,
    title: 'Standard Group',
    description: 'A balanced plan for regular contributors.',
    highlight: 'Most flexible',
  },
  {
    amount: 200,
    title: 'Growth Group',
    description: 'Good for business owners and serious savers.',
    highlight: 'Business friendly',
  },
  {
    amount: 500,
    title: 'Premium Group',
    description: 'For high-value weekly contribution groups.',
    highlight: 'High-value savings',
  },
];

function formatCurrency(amount: number | null | undefined) {
  return `GH₵${Number(amount || 0).toLocaleString('en-GH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function JoinFundSpacePage() {
  const router = useRouter();
  const { profile, loading } = useAuth();

  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [existingMember, setExistingMember] =
    useState<FundSpaceMember | null>(null);

  const [checkingMembership, setCheckingMembership] = useState(true);
  const [joining, setJoining] = useState(false);

  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const verificationStatus = profile?.verification_status ?? '';
  const accountStatus = profile?.status ?? '';

  const isVerified = verificationStatus === 'VERIFIED';
  const isActive = accountStatus === 'ACTIVE';

  const selectedPlan = useMemo(() => {
    return plans.find((plan) => plan.amount === selectedAmount) || null;
  }, [selectedAmount]);

  const estimatedCycleValue = selectedAmount ? selectedAmount * 10 : 0;

  useEffect(() => {
    if (loading) return;

    if (!profile?.id) {
      setCheckingMembership(false);
      return;
    }

    checkExistingMembership(profile.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, profile?.id]);

  async function checkExistingMembership(userId: string) {
    try {
      setCheckingMembership(true);
      setErrorMessage('');

      const { data, error } = await supabase
        .from('fund_space_members')
        .select('id, user_id, fund_space_id, contribution_amount, status, joined_at')
        .eq('user_id', userId)
        .in('status', ['ACTIVE'])
        .order('joined_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        throw error;
      }

      setExistingMember((data || null) as FundSpaceMember | null);
    } catch (error) {
      console.error('Existing Fund Space membership check error:', error);

      setErrorMessage(
        'Could not check your current Fund Space membership. Please refresh and try again.'
      );
    } finally {
      setCheckingMembership(false);
    }
  }

  async function handleJoin() {
    try {
      setJoining(true);
      setErrorMessage('');
      setSuccessMessage('');

      if (!profile?.id) {
        throw new Error('Unable to identify your account. Please login again.');
      }

      if (!isActive) {
        throw new Error('Your account must be active before joining Fund Space.');
      }

      if (!isVerified) {
        throw new Error('You must complete verification before joining Fund Space.');
      }

      if (existingMember) {
        throw new Error(
          'You already have an active Fund Space group. Open your Fund Space dashboard instead.'
        );
      }

      if (!selectedAmount) {
        throw new Error('Please select a Fund Space contribution amount.');
      }

      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error || !session?.access_token) {
        throw new Error('Your session has expired. Please login again.');
      }

      const response = await fetch('/api/fund-space/join', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contribution_amount: selectedAmount,
        }),
      });

      const responseText = await response.text();

      let result: {
        success?: boolean;
        message?: string;
        fund_space_id?: string;
      } | null = null;

      try {
        result = responseText ? JSON.parse(responseText) : null;
      } catch {
        result = null;
      }

      if (!response.ok || !result?.success) {
        throw new Error(result?.message || 'Could not join Fund Space.');
      }

      setSuccessMessage(
        result.message ||
          'You joined Fund Space successfully. Redirecting to your dashboard...'
      );

      if (result.fund_space_id) {
        router.push(`/dashboard/fund-space/${result.fund_space_id}`);
        return;
      }

      router.push('/dashboard/fund-space');
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Something went wrong.';

      setErrorMessage(message);
    } finally {
      setJoining(false);
    }
  }

  if (loading || checkingMembership) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-emerald-600" />
          <p className="text-sm text-gray-500">Loading join page...</p>
        </div>
      </div>
    );
  }

  if (!isActive) {
    return (
      <div className="rounded-3xl border border-red-100 bg-red-50 p-6">
        <div className="flex items-start gap-3">
          <XCircle className="mt-1 h-6 w-6 shrink-0 text-red-600" />

          <div>
            <h2 className="text-xl font-black text-red-700">
              Account inactive
            </h2>

            <p className="mt-2 text-sm leading-6 text-red-600">
              Your account is currently inactive. Please contact support before
              joining Fund Space.
            </p>

            <Link
              href="/dashboard"
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-red-600 px-5 py-3 text-sm font-bold text-white hover:bg-red-700"
            >
              Back to Dashboard
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!isVerified) {
    return (
      <div className="rounded-3xl border border-amber-100 bg-amber-50 p-6">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-1 h-6 w-6 shrink-0 text-amber-600" />

          <div>
            <h2 className="text-xl font-black text-amber-800">
              Verification required
            </h2>

            <p className="mt-2 text-sm leading-6 text-amber-700">
              You must complete verification before joining TrustPoint Fund
              Space. This protects every group from fake accounts and risky
              members.
            </p>

            <Link
              href="/dashboard/verification"
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-amber-600 px-5 py-3 text-sm font-bold text-white hover:bg-amber-700"
            >
              Complete Verification
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (existingMember) {
    return (
      <div className="space-y-6">
        <Link
          href="/dashboard/fund-space"
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50"
        >
          <ArrowLeft size={16} />
          Back to Fund Space
        </Link>

        <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-6">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-1 h-6 w-6 shrink-0 text-emerald-600" />

            <div>
              <h2 className="text-xl font-black text-emerald-900">
                You already have an active Fund Space
              </h2>

              <p className="mt-2 text-sm leading-6 text-emerald-700">
                You cannot join another active Fund Space group at the same
                time. Open your current group dashboard to view your payout
                position, contribution status, and payout schedule.
              </p>

              <Link
                href={`/dashboard/fund-space/${existingMember.fund_space_id}`}
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-700"
              >
                Open My Fund Space
                <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/dashboard/fund-space"
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50"
        >
          <ArrowLeft size={16} />
          Back to Fund Space
        </Link>
      </div>

      <div className="rounded-3xl bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-600 p-6 text-white shadow-sm md:p-8">
        <div className="max-w-3xl">
          <p className="mb-3 inline-flex rounded-full bg-white/15 px-4 py-1 text-sm font-medium">
            Join TrustPoint Fund Space
          </p>

          <h1 className="text-3xl font-black md:text-4xl">
            Choose your weekly contribution plan
          </h1>

          <p className="mt-4 max-w-2xl text-sm leading-7 text-emerald-50 md:text-base">
            Select how much you want to contribute every week. The system will
            place you into a forming 10-member group with other verified
            customers.
          </p>
        </div>
      </div>

      {errorMessage && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-700">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {successMessage && (
        <div className="flex items-start gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {plans.map((plan) => {
          const selected = selectedAmount === plan.amount;

          return (
            <button
              key={plan.amount}
              type="button"
              onClick={() => {
                setSelectedAmount(plan.amount);
                setErrorMessage('');
              }}
              className={`rounded-3xl border p-6 text-left shadow-sm transition ${
                selected
                  ? 'border-emerald-400 bg-emerald-50 ring-2 ring-emerald-100'
                  : 'border-gray-100 bg-white hover:border-emerald-200 hover:bg-emerald-50/40'
              }`}
            >
              <div className="mb-5 flex items-center justify-between">
                <div className="rounded-2xl bg-emerald-100 p-3 text-emerald-700">
                  <CircleDollarSign size={24} />
                </div>

                {selected ? (
                  <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                ) : (
                  <Sparkles className="h-5 w-5 text-gray-300" />
                )}
              </div>

              <div className="mb-3 inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
                {plan.highlight}
              </div>

              <h3 className="text-lg font-black text-gray-900">{plan.title}</h3>

              <p className="mt-2 text-3xl font-black text-emerald-700">
                {formatCurrency(plan.amount)}
              </p>

              <p className="mt-1 text-sm font-semibold text-gray-500">
                Weekly contribution
              </p>

              <p className="mt-4 text-sm leading-6 text-gray-500">
                {plan.description}
              </p>

              <div className="mt-5 rounded-2xl bg-gray-50 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-gray-400">
                  Estimated group value
                </p>
                <p className="mt-1 text-lg font-black text-gray-900">
                  {formatCurrency(plan.amount * 10)}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="grid gap-5 md:grid-cols-3">
            <InfoBox
              icon={<Users className="h-6 w-6" />}
              title="10 members per group"
              description="Each Fund Space group is formed with 10 verified customers."
            />

            <InfoBox
              icon={<ShieldCheck className="h-6 w-6" />}
              title="Verified members only"
              description="Only verified active customers can join Fund Space."
            />

            <InfoBox
              icon={<Clock className="h-6 w-6" />}
              title="Weekly contribution"
              description="Your selected amount becomes your weekly contribution."
            />
          </div>

          <div className="mt-6 flex flex-col gap-4 rounded-2xl bg-gray-50 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-500">
                Selected plan
              </p>

              <p className="text-xl font-black text-gray-900">
                {selectedPlan
                  ? `${formatCurrency(selectedPlan.amount)} weekly`
                  : 'No plan selected'}
              </p>

              {selectedPlan && (
                <p className="mt-1 text-sm text-gray-500">
                  Estimated group payout pool:{' '}
                  <span className="font-bold text-gray-700">
                    {formatCurrency(estimatedCycleValue)}
                  </span>
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={handleJoin}
              disabled={joining || !selectedAmount}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {joining ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <CheckCircle2 size={18} />
              )}
              {joining ? 'Joining Fund Space...' : 'Join Fund Space'}
            </button>
          </div>
        </div>

        <aside className="rounded-3xl border border-amber-100 bg-amber-50 p-6 shadow-sm">
          <div className="mb-4 inline-flex rounded-2xl bg-white p-3 text-amber-700">
            <Wallet size={24} />
          </div>

          <h2 className="text-lg font-black text-gray-900">
            Before you join
          </h2>

          <ul className="mt-4 space-y-3 text-sm leading-6 text-gray-700">
            <li>• Choose an amount you can pay every week.</li>
            <li>• Missing payments can affect your trust score.</li>
            <li>• Your payout order will be managed by the system.</li>
            <li>• Admin will monitor contributions and payouts.</li>
            <li>• You cannot join another active Fund Space at the same time.</li>
          </ul>
        </aside>
      </div>
    </div>
  );
}

function InfoBox({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl bg-gray-50 p-5">
      <div className="mb-3 text-emerald-600">{icon}</div>

      <h3 className="font-black text-gray-900">{title}</h3>

      <p className="mt-2 text-sm leading-6 text-gray-500">{description}</p>
    </div>
  );
}