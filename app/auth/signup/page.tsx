'use client';

import type { FormEvent } from 'react';
import { useState } from 'react';
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
  ShieldCheck,
  Smartphone,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react';

import { supabase } from '@/lib/supabase/client';

export default function SignupPage() {
  const router = useRouter();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleSignup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setErrorMessage('');
    setSuccessMessage('');

    const cleanFullName = fullName.trim();
    const cleanPhone = phone.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanFullName) {
      setErrorMessage('Please enter your full name.');
      return;
    }

    if (!cleanPhone) {
      setErrorMessage('Please enter your phone number.');
      return;
    }

    if (!cleanEmail) {
      setErrorMessage('Please enter your email address.');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters.');
      return;
    }

    if (!acceptedTerms) {
      setErrorMessage(
        'You must accept the TrustPoint Fund Space agreement before creating an account.'
      );
      return;
    }

    try {
      setLoading(true);

      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            full_name: cleanFullName,
            phone: cleanPhone,
          },
        },
      });

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      if (!data.user) {
        setErrorMessage('Account creation failed. Please try again.');
        return;
      }

      const { error: profileUpdateError } = await supabase
        .from('profiles')
        .update({
          full_name: cleanFullName,
          phone: cleanPhone,
          email: cleanEmail,
          role: 'USER',
          status: 'ACTIVE',
          verification_status: 'UNVERIFIED',
          user_category: 'INDIVIDUAL',
          terms_accepted: true,
          terms_accepted_at: new Date().toISOString(),
        })
        .eq('id', data.user.id);

      if (profileUpdateError) {
        console.error('Signup profile update error:', profileUpdateError);

        setErrorMessage(
          profileUpdateError.message ||
            'Account was created, but profile setup failed. Please contact support.'
        );
        return;
      }

      if (data.session) {
        setSuccessMessage(
          'Account created successfully. Redirecting you to verification...'
        );

        setTimeout(() => {
          router.replace('/dashboard/verification');
        }, 1000);
      } else {
        setSuccessMessage(
          'Account created successfully. Please check your email to confirm your account, then log in.'
        );

        setTimeout(() => {
          router.replace('/auth/login');
        }, 1800);
      }
    } catch (error) {
      console.error('Signup error:', error);

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
      <div className="grid min-h-screen lg:grid-cols-[1fr_560px]">
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
              Verification before joining groups
            </p>

            <h2 className="mt-6 break-words text-5xl font-black leading-tight">
              Create your account and join a trusted contribution platform.
            </h2>

            <p className="mt-6 max-w-xl text-base font-semibold leading-8 text-emerald-50/80">
              Sign up, complete verification, choose a weekly contribution plan,
              and join a secure 10-member Fund Space group with transparent
              payout order.
            </p>

            <div className="mt-10 grid max-w-xl gap-4 sm:grid-cols-3">
              <div className="rounded-3xl border border-white/10 bg-white/10 p-4">
                <Users className="h-5 w-5 text-emerald-100" />
                <p className="mt-3 text-2xl font-black">10</p>
                <p className="mt-1 text-sm font-semibold text-emerald-50/70">
                  Members
                </p>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/10 p-4">
                <Smartphone className="h-5 w-5 text-emerald-100" />
                <p className="mt-3 text-2xl font-black">MoMo</p>
                <p className="mt-1 text-sm font-semibold text-emerald-50/70">
                  Payment records
                </p>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/10 p-4">
                <ShieldCheck className="h-5 w-5 text-emerald-100" />
                <p className="mt-3 text-2xl font-black">Trust</p>
                <p className="mt-1 text-sm font-semibold text-emerald-50/70">
                  Verification
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
            <Link href="/auth/login" className="hover:text-white">
              Login
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
                  <UserPlus className="h-6 w-6" />
                </div>

                <h2 className="text-3xl font-black text-slate-950">
                  Create your account
                </h2>

                <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
                  Start with your account details. After signup, you will
                  complete verification before joining a Fund Space group.
                </p>
              </div>

              {errorMessage && (
                <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
                  {errorMessage}
                </div>
              )}

              {successMessage && (
                <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
                  {successMessage}
                </div>
              )}

              <form onSubmit={handleSignup} className="space-y-5">
                <div>
                  <label
                    htmlFor="fullName"
                    className="mb-2 block text-sm font-black text-slate-700"
                  >
                    Full name
                  </label>

                  <input
                    id="fullName"
                    type="text"
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    placeholder="Enter your full name"
                    className="min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-100"
                  />
                </div>

                <div>
                  <label
                    htmlFor="phone"
                    className="mb-2 block text-sm font-black text-slate-700"
                  >
                    Phone number
                  </label>

                  <input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder="Example: 0240000000"
                    className="min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-100"
                  />
                </div>

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
                      placeholder="Create a password"
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

                  <p className="mt-2 text-xs font-semibold text-slate-500">
                    Password must be at least 6 characters.
                  </p>
                </div>

                <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                  <input
                    type="checkbox"
                    checked={acceptedTerms}
                    onChange={(event) =>
                      setAcceptedTerms(event.target.checked)
                    }
                    className="mt-1 h-4 w-4 rounded border-slate-300"
                  />

                  <span className="text-sm font-semibold leading-6 text-emerald-800">
                    I agree that TrustPoint Fund Space is a rotational
                    contribution platform. I understand that I must complete
                    verification before joining a group, and if I join a Fund
                    Space group, I must complete all weekly contributions.
                  </span>
                </label>

                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-5 text-sm font-black text-white shadow-sm transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {loading ? 'Creating account...' : 'Create Account'}
                  {!loading && <ArrowRight className="h-4 w-4" />}
                </button>
              </form>

              <div className="mt-6 rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
                  <p className="text-sm font-semibold leading-6 text-emerald-800">
                    After signup, you will complete verification before joining
                    an active Fund Space group.
                  </p>
                </div>
              </div>

              <p className="mt-6 text-center text-sm font-semibold text-slate-600">
                Already have an account?{' '}
                <Link
                  href="/auth/login"
                  className="font-black text-emerald-700 hover:text-emerald-800"
                >
                  Login
                </Link>
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}