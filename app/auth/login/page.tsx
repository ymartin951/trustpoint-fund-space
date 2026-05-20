'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  ShieldCheck,
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

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

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

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role, verification_status, status')
        .eq('id', data.user.id)
        .maybeSingle();

      if (profileError || !profile) {
        console.error('Login profile lookup error:', profileError);

        setErrorMessage(
          'Your account profile could not be found. Please contact support.'
        );
        return;
      }

      const routeProfile: ProfileRouteData = {
        role: profile.role as UserRole,
        verification_status: profile.verification_status as VerificationStatus,
        status: profile.status as AccountStatus,
      };

      if (routeProfile.status !== 'ACTIVE') {
        setErrorMessage(
          'Your account is not active. Please contact TrustPoint support.'
        );
        return;
      }

      router.replace(getRedirectPath(routeProfile));
    } catch (error) {
      console.error('Login error:', error);

      const message =
        error instanceof Error
          ? error.message
          : 'Something went wrong. Please try again.';

      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="grid min-h-screen lg:grid-cols-2">
        <section className="hidden bg-slate-950 px-12 py-10 text-white lg:flex lg:flex-col lg:justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600">
              <Wallet size={24} />
            </div>

            <div>
              <h1 className="text-xl font-bold leading-none">TrustPoint</h1>
              <p className="text-sm font-medium text-blue-300">Fund Space</p>
            </div>
          </Link>

          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-blue-200">
              <ShieldCheck size={16} />
              Secure access for verified members
            </div>

            <h2 className="max-w-xl text-5xl font-extrabold leading-tight">
              Welcome back to your Fund Space dashboard.
            </h2>

            <p className="mt-6 max-w-lg text-lg leading-8 text-slate-300">
              Login to manage your verification, join a weekly contribution
              group, track payments, view payout order, and request withdrawals.
            </p>

            <div className="mt-10 rounded-3xl border border-white/10 bg-white/5 p-6">
              <p className="text-sm font-semibold text-blue-200">
                TrustPoint Fund Space protects members through:
              </p>

              <ul className="mt-5 space-y-4 text-sm text-slate-300">
                <li className="flex gap-3">
                  <span className="mt-1 h-2 w-2 rounded-full bg-blue-400" />
                  Strict identity and account verification
                </li>

                <li className="flex gap-3">
                  <span className="mt-1 h-2 w-2 rounded-full bg-blue-400" />
                  Transparent system-generated payout order
                </li>

                <li className="flex gap-3">
                  <span className="mt-1 h-2 w-2 rounded-full bg-blue-400" />
                  Admin approval before payout and withdrawal
                </li>
              </ul>
            </div>
          </div>

          <p className="text-sm text-slate-500">
            © {new Date().getFullYear()} TrustPoint Fund Space
          </p>
        </section>

        <section className="flex items-center justify-center px-6 py-10">
          <div className="w-full max-w-md">
            <div className="mb-8 lg:hidden">
              <Link href="/" className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-white">
                  <Wallet size={24} />
                </div>

                <div>
                  <h1 className="text-xl font-bold leading-none text-slate-950">
                    TrustPoint
                  </h1>
                  <p className="text-sm font-medium text-blue-600">
                    Fund Space
                  </p>
                </div>
              </Link>
            </div>

            <div className="rounded-3xl border bg-white p-6 shadow-sm sm:p-8">
              <div className="mb-8">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <LockKeyhole size={24} />
                </div>

                <h2 className="text-2xl font-extrabold text-slate-950">
                  Login to your account
                </h2>

                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Access your TrustPoint Fund Space dashboard securely.
                </p>
              </div>

              {errorMessage && (
                <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {errorMessage}
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-5">
                <div>
                  <label
                    htmlFor="email"
                    className="mb-2 block text-sm font-semibold text-slate-700"
                  >
                    Email address
                  </label>

                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="Enter your email"
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-50"
                  />
                </div>

                <div>
                  <label
                    htmlFor="password"
                    className="mb-2 block text-sm font-semibold text-slate-700"
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
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 pr-12 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-50"
                    />

                    <button
                      type="button"
                      onClick={() => setShowPassword((current) => !current)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {loading && <Loader2 size={18} className="animate-spin" />}
                  {loading ? 'Logging in...' : 'Login'}
                </button>
              </form>

              <div className="mt-6 flex flex-col gap-3 text-center text-sm text-slate-600">
                <p>
                  New to TrustPoint Fund Space?{' '}
                  <Link
                    href="/auth/signup"
                    className="font-bold text-blue-600 hover:text-blue-700"
                  >
                    Create account
                  </Link>
                </p>

                <Link
                  href="/support"
                  className="font-semibold text-slate-500 hover:text-blue-600"
                >
                  Need help accessing your account?
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}