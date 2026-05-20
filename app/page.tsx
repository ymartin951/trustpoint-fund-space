import Link from "next/link";
import {
  ShieldCheck,
  Users,
  CalendarCheck,
  Wallet,
  BadgeCheck,
  ArrowRight,
  Landmark,
  UserCheck,
  RefreshCcw,
} from "lucide-react";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      {/* Navbar */}
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white">
              <Wallet size={22} />
            </div>
            <div>
              <h1 className="text-xl font-bold leading-none">
                TrustPoint
              </h1>
              <p className="text-xs font-medium text-blue-600">
                Fund Space
              </p>
            </div>
          </Link>

          <nav className="hidden items-center gap-8 text-sm font-medium text-slate-600 md:flex">
            <a href="#how-it-works" className="hover:text-blue-600">
              How It Works
            </a>
            <a href="#plans" className="hover:text-blue-600">
              Plans
            </a>
            <a href="#trust" className="hover:text-blue-600">
              Trust & Security
            </a>
            <Link href="/support" className="hover:text-blue-600">
              Support
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/auth/login"
              className="hidden text-sm font-semibold text-slate-700 hover:text-blue-600 sm:inline"
            >
              Login
            </Link>

            <Link
              href="/auth/signup"
              className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto grid max-w-7xl items-center gap-12 px-6 py-20 lg:grid-cols-2 lg:py-28">
        <div>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">
            <ShieldCheck size={16} />
            Verified rotational contribution platform
          </div>

          <h2 className="max-w-3xl text-4xl font-extrabold tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
            Build funds together through trusted weekly contributions.
          </h2>

          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
            TrustPoint Fund Space helps verified members join secure 10-person
            contribution groups, pay weekly, and receive their payout according
            to a transparent system-generated order.
          </p>

          <div className="mt-8 flex flex-col gap-4 sm:flex-row">
            <Link
              href="/auth/signup"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700"
            >
              Join Fund Space
              <ArrowRight size={18} />
            </Link>

            <a
              href="#how-it-works"
              className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-bold text-slate-700 transition hover:border-blue-300 hover:text-blue-600"
            >
              See How It Works
            </a>
          </div>

          <div className="mt-8 grid max-w-xl grid-cols-3 gap-4">
            <div>
              <p className="text-2xl font-extrabold text-slate-950">10</p>
              <p className="text-sm text-slate-500">Members per group</p>
            </div>
            <div>
              <p className="text-2xl font-extrabold text-slate-950">Weekly</p>
              <p className="text-sm text-slate-500">Contribution cycle</p>
            </div>
            <div>
              <p className="text-2xl font-extrabold text-slate-950">Admin</p>
              <p className="text-sm text-slate-500">Payout approval</p>
            </div>
          </div>
        </div>

        {/* Hero Card */}
        <div className="rounded-3xl border bg-white p-6 shadow-xl">
          <div className="rounded-2xl bg-slate-950 p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-300">Sample Fund Space</p>
                <h3 className="mt-1 text-2xl font-bold">
                  GH₵100 Weekly Group
                </h3>
              </div>

              <div className="rounded-full bg-green-500 px-3 py-1 text-xs font-bold text-white">
                ACTIVE
              </div>
            </div>

            <div className="mt-8 grid grid-cols-2 gap-4">
              <div className="rounded-2xl bg-white/10 p-4">
                <p className="text-sm text-slate-300">Group members</p>
                <p className="mt-2 text-3xl font-extrabold">10/10</p>
              </div>

              <div className="rounded-2xl bg-white/10 p-4">
                <p className="text-sm text-slate-300">Weekly payout</p>
                <p className="mt-2 text-3xl font-extrabold">GH₵1,000</p>
              </div>

              <div className="rounded-2xl bg-white/10 p-4">
                <p className="text-sm text-slate-300">Current round</p>
                <p className="mt-2 text-3xl font-extrabold">3/10</p>
              </div>

              <div className="rounded-2xl bg-white/10 p-4">
                <p className="text-sm text-slate-300">Deadline</p>
                <p className="mt-2 text-3xl font-extrabold">Friday</p>
              </div>
            </div>

            <div className="mt-6 rounded-2xl bg-blue-600 p-4">
              <p className="text-sm font-medium text-blue-100">
                Next payout recipient
              </p>
              <p className="mt-1 text-xl font-bold">
                Visible to all group members
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="bg-white py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-bold uppercase tracking-wide text-blue-600">
              How it works
            </p>
            <h2 className="mt-3 text-3xl font-extrabold text-slate-950 sm:text-4xl">
              A trusted digital version of group contribution.
            </h2>
            <p className="mt-4 text-slate-600">
              Members are verified, assigned into groups automatically, and
              payout order is generated by the system for transparency.
            </p>
          </div>

          <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <FeatureCard
              icon={<UserCheck />}
              title="1. Get verified"
              description="Users submit identity, phone, Ghana Card, occupation, business, or employment details for admin approval."
            />

            <FeatureCard
              icon={<Users />}
              title="2. Join a plan"
              description="Choose a weekly contribution amount such as GH₵50, GH₵100, GH₵200, or GH₵500."
            />

            <FeatureCard
              icon={<RefreshCcw />}
              title="3. System assigns group"
              description="The system automatically places verified members into 10-person Fund Space groups."
            />

            <FeatureCard
              icon={<CalendarCheck />}
              title="4. Pay and receive"
              description="Members contribute weekly, and one member receives the group payout each round after admin approval."
            />
          </div>
        </div>
      </section>

      {/* Plans */}
      <section id="plans" className="py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-bold uppercase tracking-wide text-blue-600">
              Contribution plans
            </p>
            <h2 className="mt-3 text-3xl font-extrabold text-slate-950 sm:text-4xl">
              Choose a weekly plan that fits your income.
            </h2>
          </div>

          <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <PlanCard amount="50" payout="500" label="Starter" />
            <PlanCard amount="100" payout="1,000" label="Standard" />
            <PlanCard amount="200" payout="2,000" label="Growth" />
            <PlanCard amount="500" payout="5,000" label="Premium" />
          </div>
        </div>
      </section>

      {/* Trust Section */}
      <section id="trust" className="bg-slate-950 py-20 text-white">
        <div className="mx-auto grid max-w-7xl gap-12 px-6 lg:grid-cols-2">
          <div>
            <p className="text-sm font-bold uppercase tracking-wide text-blue-400">
              Trust & security
            </p>

            <h2 className="mt-3 text-3xl font-extrabold sm:text-4xl">
              Built for verified workers, business owners, traders, and market
              women.
            </h2>

            <p className="mt-5 text-slate-300">
              TrustPoint Fund Space is designed with strict verification,
              transparent payout order, admin payout approval, agent-assisted
              registration, and default protection.
            </p>
          </div>

          <div className="grid gap-4">
            <TrustItem
              icon={<ShieldCheck />}
              title="Strict member verification"
              description="Only verified and trusted members can join active Fund Space groups."
            />

            <TrustItem
              icon={<Landmark />}
              title="Admin-approved payout"
              description="Payouts are reviewed and approved before users can withdraw."
            />

            <TrustItem
              icon={<BadgeCheck />}
              title="Trust score and default control"
              description="Members who miss payments or default after receiving payout can be suspended or blacklisted."
            />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-white py-20">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <h2 className="text-3xl font-extrabold text-slate-950 sm:text-4xl">
            Ready to join a trusted Fund Space group?
          </h2>

          <p className="mt-4 text-slate-600">
            Create your account, complete verification, choose your contribution
            plan, and let the system assign you to a secure group.
          </p>

          <div className="mt-8">
            <Link
              href="/auth/signup"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-7 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700"
            >
              Create Account
              <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-8 text-sm text-slate-500 md:flex-row md:items-center md:justify-between">
          <p>
            © {new Date().getFullYear()} TrustPoint Fund Space. All rights
            reserved.
          </p>

          <div className="flex gap-6">
            <Link href="/support" className="hover:text-blue-600">
              Support
            </Link>
            <Link href="/auth/login" className="hover:text-blue-600">
              Login
            </Link>
            <Link href="/auth/signup" className="hover:text-blue-600">
              Get Started
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border bg-white p-6 shadow-sm">
      <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
        {icon}
      </div>

      <h3 className="text-lg font-bold text-slate-950">{title}</h3>

      <p className="mt-3 text-sm leading-6 text-slate-600">{description}</p>
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
    <div className="rounded-2xl border bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
      <p className="text-sm font-bold uppercase tracking-wide text-blue-600">
        {label}
      </p>

      <div className="mt-4">
        <span className="text-4xl font-extrabold text-slate-950">
          GH₵{amount}
        </span>
        <span className="text-sm text-slate-500"> / week</span>
      </div>

      <div className="mt-6 rounded-xl bg-slate-50 p-4">
        <p className="text-sm text-slate-500">10-member payout</p>
        <p className="mt-1 text-2xl font-bold text-slate-950">
          GH₵{payout}
        </p>
      </div>

      <p className="mt-5 text-sm leading-6 text-slate-600">
        Join a 10-person group and contribute weekly until every member receives
        their turn.
      </p>

      <Link
        href="/auth/signup"
        className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-600"
      >
        Select Plan
      </Link>
    </div>
  );
}

function TrustItem({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="flex gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-500/20 text-blue-300">
          {icon}
        </div>

        <div>
          <h3 className="font-bold">{title}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            {description}
          </p>
        </div>
      </div>
    </div>
  );
}