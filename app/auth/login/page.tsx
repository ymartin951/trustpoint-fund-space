'use client';

import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  HelpCircle,
  Loader2,
  LockKeyhole,
  ShieldCheck,
  Smartphone,
  UserRound,
  Wallet,
} from 'lucide-react';

import { supabase } from '@/lib/supabase/client';

type UserRole = 'USER' | 'AGENT' | 'ADMIN' | 'SUPER_ADMIN';

type AccountStatus = 'ACTIVE' | 'SUSPENDED' | 'BLACKLISTED' | 'DELETED';

type VerificationStatus =
  | 'UNVERIFIED'
  | 'PENDING'
  | 'VERIFIED'
  | 'REJECTED'
  | 'SUSPENDED';

type ProfileRouteData = {
  role: UserRole;
  verification_status: VerificationStatus;
  status: AccountStatus;
};

function getRedirectPath(profile: ProfileRouteData) {
  if (profile.role === 'SUPER_ADMIN' || profile.role === 'ADMIN') {
    return '/admin';
  }

  if (profile.role === 'AGENT') {
    return '/agent';
  }

  if (profile.verification_status !== 'VERIFIED') {
    return '/dashboard/verification';
  }

  return '/dashboard';
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

async function loadProfileRoute(userId: string) {
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role, verification_status, status')
    .eq('id', userId)
    .maybeSingle();

  if (profileError || !profile) {
    console.error('Login profile lookup error:', profileError);

    throw new Error(
      'Your account profile could not be found. Please contact support.'
    );
  }

  const routeProfile: ProfileRouteData = {
    role: profile.role as UserRole,
    verification_status: profile.verification_status as VerificationStatus,
    status: profile.status as AccountStatus,
  };

  if (routeProfile.status !== 'ACTIVE') {
    throw new Error(
      'Your account is not active. Please contact TrustPoint support.'
    );
  }

  return getRedirectPath(routeProfile);
}

export default function LoginPage() {
  const router = useRouter();

  const [checkingSession, setCheckingSession] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let mounted = true;

    async function redirectIfAlreadyLoggedIn() {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (!mounted) return;

        if (error || !session?.user?.id) {
          return;
        }

        const redirectPath = await loadProfileRoute(session.user.id);

        if (!mounted) return;

        router.replace(redirectPath);
        router.refresh();
      } catch (error) {
        console.warn('Existing session check warning:', error);

        if (mounted) {
          await supabase.auth.signOut();
        }
      } finally {
        if (mounted) {
          setCheckingSession(false);
        }
      }
    }

    redirectIfAlreadyLoggedIn();

    const fallback = setTimeout(() => {
      if (mounted) {
        setCheckingSession(false);
      }
    }, 7000);

    return () => {
      mounted = false;
      clearTimeout(fallback);
    };
  }, [router]);

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setErrorMessage('');

    if (!email.trim()) {
      setErrorMessage('Please enter your email address.');
      return;
    }

    if (!password) {
      setErrorMessage('Please enter your password.');
      return;
    }

    try {
      setLoading(true);

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      if (!data.user) {
        setErrorMessage('Login failed. Please try again.');
        return;
      }

      const redirectPath = await loadProfileRoute(data.user.id);

      router.replace(redirectPath);
      router.refresh();
    } catch (error) {
      console.error('Login error:', error);

      setErrorMessage(
        getErrorMessage(error, 'Something went wrong. Please try again.')
      );
    } finally {
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <Loader2 className="mx-auto h-10 w-10 animate-spin text-emerald-700" />
          <p className="mt-4 text-sm font-black text-slate-600">
            Checking your session...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="grid min-h-screen lg:grid-cols-[1fr_520px]">
        <section className="hidden overflow-hidden bg-gradient-to-br from-emerald-950 via-emerald-900 to-emerald-800 px-10 py-8 text-white lg:flex lg:flex-col lg:justify-between xl:px-14">
          <div>
            <Link href="/" className="inline-flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-emerald-900">
                <Wallet className="h-6 w-6" />
              </div>

              <div>
                <h1 className="text-xl font-black leading-none">TrustPoint</h1>
                <p className="text-sm font-bold text-emerald-100">
                  Fund Space
                </p>
              </div>
            </Link>
          </div>

          <div className="max-w-2xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-black text-emerald-50">
              <ShieldCheck className="h-4 w-4" />
              Secure account access
            </p>

            <h2 className="mt-6 break-words text-5xl font-black leading-tight">
              Welcome back to your trusted Fund Space.
            </h2>

            <p className="mt-6 max-w-xl text-base font-semibold leading-8 text-emerald-50/80">
              Login to view your contribution status, MoMo payment records,
              payout schedule, verification progress, agent tools, or admin
              control center.
            </p>

            <div className="mt-10 grid max-w-xl gap-4 sm:grid-cols-3">
              <div className="rounded-3xl border border-white/10 bg-white/10 p-4">
                <UserRound className="h-5 w-5 text-emerald-100" />
                <p className="mt-3 text-2xl font-black">Members</p>
                <p className="mt-1 text-sm font-semibold text-emerald-50/70">
                  Track Fund Space
                </p>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/10 p-4">
                <Smartphone className="h-5 w-5 text-emerald-100" />
                <p className="mt-3 text-2xl font-black">MoMo</p>
                <p className="mt-1 text-sm font-semibold text-emerald-50/70">
                  Payment review
                </p>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/10 p-4">
                <ShieldCheck className="h-5 w-5 text-emerald-100" />
                <p className="mt-3 text-2xl font-black">Admin</p>
                <p className="mt-1 text-sm font-semibold text-emerald-50/70">
                  Control center
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-4 text-sm font-black text-emerald-50/80">
            <Link href="/" className="hover:text-white">
              Home
            </Link>
            <Link href="/support" className="hover:text-white">
              Support
            </Link>
            <Link href="/auth/signup" className="hover:text-white">
              Create Account
            </Link>
          </div>
        </section>

        <section className="flex items-center justify-center px-4 py-8 md:px-8">
          <div className="w-full max-w-md">
            <div className="mb-6 flex items-center justify-between gap-3">
              <Link
                href="/"
                className="inline-flex min-h-10 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 shadow-sm hover:bg-slate-50"
              >
                <ArrowLeft className="h-4 w-4" />
                Home
              </Link>

              <Link
                href="/support"
                className="inline-flex min-h-10 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 shadow-sm hover:bg-slate-50"
              >
                <HelpCircle className="h-4 w-4" />
                Support
              </Link>
            </div>

            <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <div className="mb-8">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                  <LockKeyhole className="h-6 w-6" />
                </div>

                <h2 className="text-3xl font-black text-slate-950">
                  Login to TrustPoint
                </h2>

                <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
                  Access your Fund Space dashboard, agent center, or admin
                  control center.
                </p>
              </div>

              {errorMessage && (
                <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
                  {errorMessage}
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-5">
                <div>
                  <label
                    htmlFor="email"
                    className="mb-2 block text-sm font-black text-slate-700"
                  >
                    Email address
                  </label>

                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="Enter your email"
                    className="min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-100"
                  />
                </div>

                <div>
                  <label
                    htmlFor="password"
                    className="mb-2 block text-sm font-black text-slate-700"
                  >
                    Password
                  </label>

                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="Enter your password"
                      className="min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 pr-12 text-sm font-semibold outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-100"
                    />

                    <button
                      type="button"
                      onClick={() => setShowPassword((current) => !current)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-5 text-sm font-black text-white shadow-sm transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {loading ? 'Logging in...' : 'Login'}
                  {!loading && <ArrowRight className="h-4 w-4" />}
                </button>
              </form>

              <div className="mt-6 rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
                  <p className="text-sm font-semibold leading-6 text-emerald-800">
                    New users must complete verification before joining an active
                    Fund Space group.
                  </p>
                </div>
              </div>

              <p className="mt-6 text-center text-sm font-semibold text-slate-600">
                Do not have an account?{' '}
                <Link
                  href="/auth/signup"
                  className="font-black text-emerald-700 hover:text-emerald-800"
                >
                  Create account
                </Link>
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}