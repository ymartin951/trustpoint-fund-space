import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  ArrowRight,
  BadgeCheck,
  Bell,
  CalendarCheck,
  CheckCircle2,
  Clock,
  HandCoins,
  HelpCircle,
  Home,
  Landmark,
  LockKeyhole,
  MessageCircle,
  RefreshCcw,
  ShieldCheck,
  Smartphone,
  UserCheck,
  Users,
  Wallet,
} from 'lucide-react';

const contributionPlans = [
  { amount: '50', payout: '500', label: 'Starter' },
  { amount: '100', payout: '1,000', label: 'Standard' },
  { amount: '200', payout: '2,000', label: 'Growth' },
  { amount: '500', payout: '5,000', label: 'Premium' },
];

const quickLinks = [
  {
    title: 'Customer Dashboard',
    description: 'View your Fund Space, contribution status, and payout schedule.',
    href: '/dashboard',
    icon: <Users className="h-5 w-5" />,
  },
  {
    title: 'Agent Center',
    description: 'Register customers, collect MoMo payments, and support members.',
    href: '/agent',
    icon: <UserCheck className="h-5 w-5" />,
  },
  {
    title: 'Admin Control Center',
    description: 'Manage Fund Spaces, MoMo reviews, payouts, disputes, and alerts.',
    href: '/admin',
    icon: <ShieldCheck className="h-5 w-5" />,
  },
  {
    title: 'Support Center',
    description: 'Get help with payments, payouts, verification, and account issues.',
    href: '/support',
    icon: <HelpCircle className="h-5 w-5" />,
  },
];

const benefits = [
  {
    title: 'Verified Members',
    description:
      'Every member goes through verification before joining a Fund Space group.',
    icon: <BadgeCheck className="h-5 w-5" />,
  },
  {
    title: 'Transparent Payout Order',
    description:
      'Members can see the payout schedule and know when their turn is coming.',
    icon: <CalendarCheck className="h-5 w-5" />,
  },
  {
    title: 'MoMo Payment Review',
    description:
      'MoMo payment records are reviewed before they are marked as paid.',
    icon: <Smartphone className="h-5 w-5" />,
  },
  {
    title: 'Admin Payout Control',
    description:
      'Payouts are reviewed, approved, and marked as paid by admin for accountability.',
    icon: <HandCoins className="h-5 w-5" />,
  },
];

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
        {icon}
      </div>

      <h3 className="break-words text-lg font-black text-slate-900">{title}</h3>

      <p className="mt-2 break-words text-sm font-semibold leading-6 text-slate-500">
        {description}
      </p>
    </div>
  );
}

function PlanCard({
  amount,
  payout,
  label,
}: {
  amount: string;
  payout: string;
  label: string;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md">
      <p className="text-sm font-black uppercase tracking-wide text-emerald-700">
        {label}
      </p>

      <h3 className="mt-3 break-words text-3xl font-black text-slate-950">
        GH₵{amount}
      </h3>

      <p className="mt-1 text-sm font-semibold text-slate-500">
        Weekly contribution
      </p>

      <div className="mt-5 rounded-2xl bg-emerald-50 p-4">
        <p className="text-xs font-black uppercase tracking-wide text-emerald-700">
          Group payout
        </p>
        <p className="mt-1 break-words text-2xl font-black text-emerald-950">
          GH₵{payout}
        </p>
        <p className="mt-1 text-xs font-semibold text-emerald-700">
          Based on 10 active members
        </p>
      </div>

      <Link
        href="/auth/signup"
        className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-4 text-sm font-black text-white hover:bg-emerald-800"
      >
        Join This Plan
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

function TrustItem({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/10 p-5">
      <div className="flex items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-emerald-800">
          {icon}
        </div>

        <div>
          <h3 className="break-words text-base font-black text-white">
            {title}
          </h3>
          <p className="mt-1 break-words text-sm font-semibold leading-6 text-emerald-50/80">
            {description}
          </p>
        </div>
      </div>
    </div>
  );
}

function LinkCard({
  title,
  description,
  href,
  icon,
}: {
  title: string;
  description: string;
  href: string;
  icon: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group flex min-w-0 items-start gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md"
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
        {icon}
      </div>

      <div className="min-w-0 flex-1">
        <h3 className="break-words text-base font-black text-slate-900">
          {title}
        </h3>

        <p className="mt-1 break-words text-sm font-semibold leading-6 text-slate-500">
          {description}
        </p>
      </div>

      <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-slate-400 transition group-hover:translate-x-1 group-hover:text-emerald-700" />
    </Link>
  );
}

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 md:px-8">
          <Link href="/" className="flex min-w-0 items-center gap-2">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-700 text-white">
              <Wallet className="h-5 w-5" />
            </div>

            <div className="min-w-0">
              <h1 className="truncate text-lg font-black leading-none text-slate-900">
                TrustPoint
              </h1>
              <p className="truncate text-xs font-bold text-emerald-700">
                Fund Space
              </p>
            </div>
          </Link>

          <nav className="hidden items-center gap-7 text-sm font-black text-slate-600 lg:flex">
            <a href="#how-it-works" className="hover:text-emerald-700">
              How It Works
            </a>
            <a href="#plans" className="hover:text-emerald-700">
              Plans
            </a>
            <a href="#trust" className="hover:text-emerald-700">
              Trust
            </a>
            <Link href="/support" className="hover:text-emerald-700">
              Support
            </Link>
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/auth/login"
              className="hidden min-h-10 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 hover:bg-slate-50 sm:inline-flex"
            >
              Login
            </Link>

            <Link
              href="/auth/signup"
              className="inline-flex min-h-10 items-center justify-center rounded-2xl bg-emerald-700 px-4 text-sm font-black text-white hover:bg-emerald-800"
            >
              Join Now
            </Link>
          </div>
        </div>
      </header>

      <section className="px-4 py-8 md:px-8 md:py-12">
        <div className="mx-auto grid max-w-7xl items-center gap-8 lg:grid-cols-[1fr_480px]">
          <div className="overflow-hidden rounded-[2rem] bg-gradient-to-br from-emerald-950 via-emerald-900 to-emerald-800 p-6 text-white shadow-sm md:p-10">
            <div className="max-w-4xl">
              <p className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-xs font-black">
                <ShieldCheck className="h-4 w-4" />
                Verified rotational contribution platform
              </p>

              <h2 className="mt-6 break-words text-4xl font-black tracking-tight md:text-6xl">
                Build funds together through trusted weekly contributions.
              </h2>

              <p className="mt-6 max-w-3xl break-words text-sm font-semibold leading-7 text-emerald-50 md:text-base">
                TrustPoint Fund Space helps verified members join secure
                contribution groups, pay weekly through MoMo payment records, and
                receive payouts according to a transparent payout schedule.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/auth/signup"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-white px-5 text-sm font-black text-emerald-900 hover:bg-emerald-50"
                >
                  Join Fund Space
                  <ArrowRight className="h-4 w-4" />
                </Link>

                <Link
                  href="/auth/login"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-white/25 bg-white/10 px-5 text-sm font-black text-white hover:bg-white/20"
                >
                  Login
                </Link>

                <Link
                  href="/support"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-white/25 bg-white/10 px-5 text-sm font-black text-white hover:bg-white/20"
                >
                  Contact Support
                </Link>

                <Link
                  href="/agent"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-white/25 bg-white/10 px-5 text-sm font-black text-white hover:bg-white/20"
                >
                  Become an Agent
                </Link>
              </div>

              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl bg-white/10 p-4">
                  <p className="text-2xl font-black text-white">10</p>
                  <p className="mt-1 text-sm font-semibold text-emerald-50/80">
                    Members per group
                  </p>
                </div>

                <div className="rounded-2xl bg-white/10 p-4">
                  <p className="text-2xl font-black text-white">Weekly</p>
                  <p className="mt-1 text-sm font-semibold text-emerald-50/80">
                    Contribution cycle
                  </p>
                </div>

                <div className="rounded-2xl bg-white/10 p-4">
                  <p className="text-2xl font-black text-white">Admin</p>
                  <p className="mt-1 text-sm font-semibold text-emerald-50/80">
                    Payout control
                  </p>
                </div>
              </div>
            </div>
          </div>

          <aside className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="rounded-[1.5rem] bg-slate-950 p-5 text-white">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-slate-300">
                    Sample Fund Space
                  </p>
                  <h3 className="mt-1 break-words text-2xl font-black">
                    GH₵100 Weekly Group
                  </h3>
                </div>

                <span className="rounded-full bg-emerald-500 px-3 py-1 text-xs font-black text-white">
                  ACTIVE
                </span>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-white/10 p-4">
                  <p className="text-sm text-slate-300">Group members</p>
                  <p className="mt-2 text-3xl font-black">10/10</p>
                </div>

                <div className="rounded-2xl bg-white/10 p-4">
                  <p className="text-sm text-slate-300">Weekly payout</p>
                  <p className="mt-2 break-words text-3xl font-black">
                    GH₵1,000
                  </p>
                </div>

                <div className="rounded-2xl bg-white/10 p-4">
                  <p className="text-sm text-slate-300">Current round</p>
                  <p className="mt-2 text-3xl font-black">3/10</p>
                </div>

                <div className="rounded-2xl bg-white/10 p-4">
                  <p className="text-sm text-slate-300">Deadline</p>
                  <p className="mt-2 text-3xl font-black">Friday</p>
                </div>
              </div>

              <div className="mt-5 rounded-2xl bg-emerald-700 p-4">
                <p className="text-sm font-semibold text-emerald-50">
                  Next payout recipient
                </p>
                <p className="mt-1 break-words text-xl font-black">
                  Visible to verified group members
                </p>
              </div>
            </div>
          </aside>
        </div>
      </section>

      <section id="how-it-works" className="bg-white py-16 md:py-20">
        <div className="mx-auto max-w-7xl px-4 md:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-black uppercase tracking-wide text-emerald-700">
              How it works
            </p>
            <h2 className="mt-3 break-words text-3xl font-black text-slate-950 sm:text-4xl">
              A trusted digital version of group contribution.
            </h2>
            <p className="mt-4 break-words text-sm font-semibold leading-7 text-slate-500">
              Members are verified, grouped transparently, and guided through
              weekly contributions until every member receives their payout.
            </p>
          </div>

          <div className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            <FeatureCard
              icon={<UserCheck />}
              title="1. Get verified"
              description="Submit your profile, phone, ID, work, business, or employment details for review."
            />

            <FeatureCard
              icon={<Users />}
              title="2. Join a plan"
              description="Choose a weekly contribution amount such as GH₵50, GH₵100, GH₵200, or GH₵500."
            />

            <FeatureCard
              icon={<RefreshCcw />}
              title="3. Enter a group"
              description="Verified members are placed into Fund Space groups with clear member and payout visibility."
            />

            <FeatureCard
              icon={<HandCoins />}
              title="4. Pay and receive"
              description="Members contribute weekly through MoMo payment records and receive payout by order after admin review."
            />
          </div>
        </div>
      </section>

      <section id="plans" className="py-16 md:py-20">
        <div className="mx-auto max-w-7xl px-4 md:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-black uppercase tracking-wide text-emerald-700">
              Contribution plans
            </p>
            <h2 className="mt-3 break-words text-3xl font-black text-slate-950 sm:text-4xl">
              Choose a weekly plan that fits your income.
            </h2>
          </div>

          <div className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {contributionPlans.map((plan) => (
              <PlanCard key={plan.label} {...plan} />
            ))}
          </div>
        </div>
      </section>

      <section id="trust" className="bg-emerald-950 py-16 text-white md:py-20">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 md:px-8 lg:grid-cols-2">
          <div>
            <p className="text-sm font-black uppercase tracking-wide text-emerald-300">
              Trust & security
            </p>

            <h2 className="mt-3 break-words text-3xl font-black sm:text-4xl">
              Built for verified workers, business owners, traders, and market
              women.
            </h2>

            <p className="mt-5 break-words text-sm font-semibold leading-7 text-emerald-50/80">
              TrustPoint Fund Space is designed with strict verification,
              transparent payout order, MoMo payment review, admin payout
              control, dispute support, and agent-assisted registration.
            </p>
          </div>

          <div className="grid gap-4">
            <TrustItem
              icon={<ShieldCheck />}
              title="Strict member verification"
              description="Only verified and trusted members can join active Fund Space groups."
            />

            <TrustItem
              icon={<LockKeyhole />}
              title="Controlled payout approval"
              description="Admins review payout readiness and mark payouts as paid only after confirmation."
            />

            <TrustItem
              icon={<Bell />}
              title="Notifications and alerts"
              description="Admins receive payment, payout, verification, and dispute alerts for better control."
            />

            <TrustItem
              icon={<MessageCircle />}
              title="Complaint and support system"
              description="Members and agents can report payment, payout, or Fund Space issues for admin review."
            />
          </div>
        </div>
      </section>

      <section className="bg-white py-16 md:py-20">
        <div className="mx-auto max-w-7xl px-4 md:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-black uppercase tracking-wide text-emerald-700">
              Quick access
            </p>

            <h2 className="mt-3 break-words text-3xl font-black text-slate-950 sm:text-4xl">
              Go directly to the right place.
            </h2>
          </div>

          <div className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {quickLinks.map((item) => (
              <LinkCard key={item.title} {...item} />
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-16 md:px-8">
        <div className="mx-auto max-w-7xl rounded-[2rem] bg-gradient-to-br from-emerald-950 via-emerald-900 to-emerald-800 p-6 text-white md:p-10">
          <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p className="text-sm font-black uppercase tracking-wide text-emerald-200">
                Start today
              </p>

              <h2 className="mt-3 break-words text-3xl font-black md:text-4xl">
                Join a trusted Fund Space and grow funds with verified members.
              </h2>

              <p className="mt-3 max-w-3xl break-words text-sm font-semibold leading-7 text-emerald-50/80">
                Create your account, complete verification, join a Fund Space,
                and follow your contribution and payout journey from your
                dashboard.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/auth/signup"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-white px-5 text-sm font-black text-emerald-900 hover:bg-emerald-50"
              >
                Create Account
                <ArrowRight className="h-4 w-4" />
              </Link>

              <Link
                href="/support"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-white/25 bg-white/10 px-5 text-sm font-black text-white hover:bg-white/20"
              >
                Need Help?
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 md:flex-row md:items-center md:justify-between md:px-8">
          <div>
            <p className="text-lg font-black text-slate-900">
              TrustPoint Fund Space
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              Transparent weekly contribution groups for verified members.
            </p>
          </div>

          <div className="flex flex-wrap gap-3 text-sm font-black text-slate-600">
            <Link href="/" className="hover:text-emerald-700">
              Home
            </Link>
            <Link href="/support" className="hover:text-emerald-700">
              Support
            </Link>
            <Link href="/auth/login" className="hover:text-emerald-700">
              Login
            </Link>
            <Link href="/auth/signup" className="hover:text-emerald-700">
              Sign Up
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}