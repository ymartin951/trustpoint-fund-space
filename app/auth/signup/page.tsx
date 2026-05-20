'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Eye,
  EyeOff,
  Loader2,
  ShieldCheck,
  UserPlus,
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

      /*
        The database trigger handle_new_user() should create the profile.
        This update makes sure new customers are NOT marked as PENDING
        before submitting verification.

        Correct flow:
        UNVERIFIED = created account, has not submitted verification
        PENDING = submitted verification, waiting for admin review
        VERIFIED = admin approved
        REJECTED = admin rejected, user can resubmit
      */
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
              Strict verification before joining groups
            </div>

            <h2 className="max-w-xl text-5xl font-extrabold leading-tight">
              Join a trusted digital contribution platform.
            </h2>

            <p className="mt-6 max-w-lg text-lg leading-8 text-slate-300">
              Create your account, complete verification, choose a weekly
              contribution plan, and let the system assign you to a secure
              10-member Fund Space group.
            </p>

            <div className="mt-10 grid max-w-xl grid-cols-3 gap-4">
              <div className="rounded-2xl bg-white/5 p-4">
                <p className="text-2xl font-extrabold">10</p>
                <p className="mt-1 text-sm text-slate-400">Members</p>
              </div>

              <div className="rounded-2xl bg-white/5 p-4">
                <p className="text-2xl font-extrabold">Weekly</p>
                <p className="mt-1 text-sm text-slate-400">Payments</p>
              </div>

              <div className="rounded-2xl bg-white/5 p-4">
                <p className="text-2xl font-extrabold">Admin</p>
                <p className="mt-1 text-sm text-slate-400">Approval</p>
              </div>
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
                  <UserPlus size={24} />
                </div>

                <h2 className="text-2xl font-extrabold text-slate-950">
                  Create your account
                </h2>

                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Start by creating your account. After signup, you will complete
                  strict verification before joining a Fund Space group.
                </p>
              </div>

              {errorMessage && (
                <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {errorMessage}
                </div>
              )}

              {successMessage && (
                <div className="mb-5 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                  {successMessage}
                </div>
              )}

              <form onSubmit={handleSignup} className="space-y-5">
                <div>
                  <label
                    htmlFor="fullName"
                    className="mb-2 block text-sm font-semibold text-slate-700"
                  >
                    Full name
                  </label>

                  <input
                    id="fullName"
                    type="text"
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    placeholder="Enter your full name"
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-50"
                  />
                </div>

                <div>
                  <label
                    htmlFor="phone"
                    className="mb-2 block text-sm font-semibold text-slate-700"
                  >
                    Phone number
                  </label>

                  <input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder="Example: 0240000000"
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-50"
                  />
                </div>

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
                      placeholder="Create a password"
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

                  <p className="mt-2 text-xs text-slate-500">
                    Password must be at least 6 characters.
                  </p>
                </div>

                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <input
                    type="checkbox"
                    checked={acceptedTerms}
                    onChange={(event) =>
                      setAcceptedTerms(event.target.checked)
                    }
                    className="mt-1 h-4 w-4 rounded border-slate-300"
                  />

                  <span className="text-sm leading-6 text-slate-600">
                    I agree that TrustPoint Fund Space is a rotational
                    contribution platform. I understand that I must complete
                    verification before joining a group, and if I join a Fund
                    Space group, I must complete all weekly contributions.
                  </span>
                </label>

                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {loading && <Loader2 size={18} className="animate-spin" />}
                  {loading ? 'Creating account...' : 'Create Account'}
                </button>
              </form>

              <p className="mt-6 text-center text-sm text-slate-600">
                Already have an account?{' '}
                <Link
                  href="/auth/login"
                  className="font-bold text-blue-600 hover:text-blue-700"
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