import Link from 'next/link';
import {
  ArrowRight,
  Bell,
  CheckCircle2,
  Clock,
  FileQuestion,
  HandCoins,
  HelpCircle,
  Home,
  Mail,
  MessageCircle,
  Phone,
  ShieldCheck,
  Smartphone,
  UserRound,
  Users,
  Wallet,
} from 'lucide-react';

const supportCards = [
  {
    title: 'Phone Support',
    description: 'Call us directly when you need quick assistance.',
    value: '054-222-4630',
    href: 'tel:0542224630',
    action: 'Call Support',
    icon: <Phone className="h-6 w-6" />,
    tone: 'emerald',
  },
  {
    title: 'WhatsApp Support',
    description: 'Chat with our support team on WhatsApp for faster response.',
    value: '054-222-4630',
    href: 'https://wa.me/233542224630',
    action: 'Chat on WhatsApp',
    icon: <MessageCircle className="h-6 w-6" />,
    tone: 'green',
  },
  {
    title: 'Email Support',
    description: 'Send us a detailed message and we will respond as soon as possible.',
    value: 'support@trustpointgh.com',
    href: 'mailto:support@trustpointgh.com',
    action: 'Send Email',
    icon: <Mail className="h-6 w-6" />,
    tone: 'blue',
  },
  {
    title: 'Support Hours',
    description: 'Our support team is available during working hours.',
    value: 'Mon - Sat, 8:00 AM - 6:00 PM',
    href: '#support-hours',
    action: 'View Hours',
    icon: <Clock className="h-6 w-6" />,
    tone: 'amber',
  },
];

const quickLinks = [
  {
    title: 'Customer Dashboard',
    description: 'Go back to your Fund Space dashboard.',
    href: '/dashboard',
    icon: <UserRound className="h-5 w-5" />,
  },
  {
    title: 'Agent Dashboard',
    description: 'Open your agent control center.',
    href: '/agent',
    icon: <Users className="h-5 w-5" />,
  },
  {
    title: 'Admin Control Center',
    description: 'Return to the admin dashboard.',
    href: '/admin',
    icon: <ShieldCheck className="h-5 w-5" />,
  },
  {
    title: 'Admin Complaints',
    description: 'Admins can manage Fund Space complaints here.',
    href: '/admin/fund-space/disputes',
    icon: <Bell className="h-5 w-5" />,
  },
];

const issueLinks = [
  {
    title: 'MoMo Payment Issue',
    description:
      'Use this when your MoMo payment has been submitted but is not showing as paid.',
    href: '/dashboard/fund-space/disputes',
    icon: <Smartphone className="h-5 w-5" />,
  },
  {
    title: 'Payout Issue',
    description:
      'Use this when your payout is delayed, wrong, rejected, or not received.',
    href: '/dashboard/fund-space/disputes',
    icon: <HandCoins className="h-5 w-5" />,
  },
  {
    title: 'Verification Issue',
    description:
      'Use this when your ID, profile, or account verification needs attention.',
    href: '/dashboard/verification',
    icon: <ShieldCheck className="h-5 w-5" />,
  },
  {
    title: 'Agent Customer Support',
    description:
      'Agents can support customers and raise Fund Space complaints from here.',
    href: '/agent/fund-space/disputes',
    icon: <Users className="h-5 w-5" />,
  },
];

const faqs = [
  {
    question: 'How do I submit my weekly Fund Space payment?',
    answer:
      'Open your Fund Space page, choose the active round, submit your MoMo payment details, and wait for admin review. Once approved, your contribution will show as paid.',
  },
  {
    question: 'Why is my MoMo payment still pending?',
    answer:
      'MoMo payments must be reviewed by admin before they are marked as paid. Make sure your reference, sender name, sender phone, and amount are correct.',
  },
  {
    question: 'What should I do if my MoMo payment was rejected?',
    answer:
      'Check the rejection reason, correct the issue, and submit the right payment details again. You may also raise a complaint from your Fund Space page.',
  },
  {
    question: 'How do I report a payout problem?',
    answer:
      'Go to your Fund Space dispute page and submit a complaint with the payout details. Add screenshots or payment evidence where possible.',
  },
  {
    question: 'Can an agent help me with my Fund Space payment?',
    answer:
      'Yes. If you were registered by an agent, the agent can help you submit your MoMo payment record and follow up on your Fund Space status.',
  },
  {
    question: 'Where should admins handle complaints?',
    answer:
      'Admins should use the Admin Complaints page under Fund Space management. This public support page is mainly for guidance and contact information.',
  },
];

function getToneClass(tone: string) {
  if (tone === 'green') return 'bg-green-50 text-green-700';
  if (tone === 'blue') return 'bg-blue-50 text-blue-700';
  if (tone === 'amber') return 'bg-amber-50 text-amber-700';

  return 'bg-emerald-50 text-emerald-700';
}

function SupportCard({
  title,
  description,
  value,
  href,
  action,
  icon,
  tone,
}: {
  title: string;
  description: string;
  value: string;
  href: string;
  action: string;
  icon: React.ReactNode;
  tone: string;
}) {
  return (
    <a
      href={href}
      target={href.startsWith('http') ? '_blank' : undefined}
      rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}
      className="group block min-w-0 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md"
    >
      <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-2xl ${getToneClass(tone)}`}>
        {icon}
      </div>

      <h2 className="text-lg font-black text-slate-900">{title}</h2>

      <p className="mt-2 min-w-0 break-words text-sm font-semibold leading-6 text-slate-500">
        {description}
      </p>

      <p className="mt-4 min-w-0 break-words text-base font-black text-slate-900 [overflow-wrap:anywhere]">
        {value}
      </p>

      <p className="mt-4 inline-flex items-center gap-2 text-sm font-black text-emerald-700">
        {action}
        <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
      </p>
    </a>
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
  icon: React.ReactNode;
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

export default function SupportPage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 md:px-8">
          <Link href="/" className="flex min-w-0 items-center gap-2">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-700 text-white">
              <Wallet className="h-5 w-5" />
            </div>

            <div className="min-w-0">
              <p className="truncate text-lg font-black text-slate-900">
                TrustPoint
              </p>
              <p className="truncate text-xs font-bold text-slate-500">
                Fund Space Support
              </p>
            </div>
          </Link>

          <nav className="flex items-center gap-2">
            <Link
              href="/"
              className="hidden min-h-10 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 hover:bg-slate-50 sm:inline-flex"
            >
              <Home className="h-4 w-4" />
              Home
            </Link>

            <Link
              href="/auth/login"
              className="inline-flex min-h-10 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 hover:bg-slate-50"
            >
              Login
            </Link>

            <Link
              href="/auth/signup"
              className="inline-flex min-h-10 items-center justify-center rounded-2xl bg-emerald-700 px-4 text-sm font-black text-white hover:bg-emerald-800"
            >
              Sign Up
            </Link>
          </nav>
        </div>
      </header>

      <section className="px-4 py-8 md:px-8 md:py-12">
        <div className="mx-auto max-w-7xl">
          <div className="overflow-hidden rounded-[2rem] bg-gradient-to-br from-emerald-950 via-emerald-900 to-emerald-800 text-white shadow-sm">
            <div className="p-6 md:p-10">
              <div className="max-w-4xl">
                <p className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-xs font-black">
                  <HelpCircle className="h-4 w-4" />
                  Help & Support Center
                </p>

                <h1 className="mt-5 break-words text-4xl font-black tracking-tight md:text-6xl">
                  How can we help you today?
                </h1>

                <p className="mt-5 max-w-3xl break-words text-sm font-semibold leading-7 text-emerald-50 md:text-base">
                  Get help with MoMo payments, Fund Space contributions, payout
                  questions, verification issues, account access, agent support,
                  and general TrustPoint questions.
                </p>

                <div className="mt-7 flex flex-wrap gap-3">
                  <a
                    href="https://wa.me/233542224630"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-white px-5 text-sm font-black text-emerald-900 hover:bg-emerald-50"
                  >
                    <MessageCircle className="h-4 w-4" />
                    Chat on WhatsApp
                  </a>

                  <Link
                    href="/dashboard/fund-space/disputes"
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-white/25 bg-white/10 px-5 text-sm font-black text-white hover:bg-white/20"
                  >
                    Raise a Complaint
                    <ArrowRight className="h-4 w-4" />
                  </Link>

                  <Link
                    href="/admin"
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-white/25 bg-white/10 px-5 text-sm font-black text-white hover:bg-white/20"
                  >
                    Admin Area
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </div>
          </div>

          <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {supportCards.map((card) => (
              <SupportCard key={card.title} {...card} />
            ))}
          </section>

          <section className="mt-8 grid gap-6 xl:grid-cols-[1fr_420px]">
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
              <div className="mb-5">
                <p className="text-xs font-black uppercase tracking-wide text-emerald-700">
                  Get the right support faster
                </p>

                <h2 className="mt-2 text-2xl font-black text-slate-900">
                  Choose the issue you need help with
                </h2>

                <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
                  Select the best option below so your issue goes to the right
                  place. Payment and payout issues should be reported through the
                  Fund Space complaint system.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {issueLinks.map((item) => (
                  <LinkCard key={item.title} {...item} />
                ))}
              </div>
            </div>

            <aside className="space-y-5">
              <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-emerald-700" />

                  <div>
                    <h2 className="text-lg font-black text-emerald-950">
                      Before contacting support
                    </h2>

                    <div className="mt-3 space-y-3 text-sm font-semibold leading-6 text-emerald-800">
                      <p>1. Check that your MoMo reference is correct.</p>
                      <p>2. Confirm the sender phone number and network.</p>
                      <p>3. Keep a screenshot of your payment message.</p>
                      <p>4. Check your Fund Space contribution status.</p>
                      <p>5. Use the complaint page for payment or payout issues.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div
                id="support-hours"
                className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <Clock className="mt-1 h-5 w-5 shrink-0 text-amber-600" />

                  <div>
                    <h2 className="text-lg font-black text-slate-900">
                      Support Hours
                    </h2>

                    <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
                      Monday - Saturday
                    </p>

                    <p className="mt-1 text-xl font-black text-slate-900">
                      8:00 AM - 6:00 PM
                    </p>

                    <p className="mt-3 text-sm leading-6 text-slate-500">
                      Urgent Fund Space payment or payout issues should be
                      reported through the complaint system first, then followed
                      up by phone or WhatsApp.
                    </p>
                  </div>
                </div>
              </div>
            </aside>
          </section>

          <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
            <div className="mb-5">
              <p className="text-xs font-black uppercase tracking-wide text-emerald-700">
                Navigation
              </p>

              <h2 className="mt-2 text-2xl font-black text-slate-900">
                Quick links for customers, agents, and admins
              </h2>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {quickLinks.map((item) => (
                <LinkCard key={item.title} {...item} />
              ))}
            </div>
          </section>

          <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
            <div className="mb-6">
              <p className="text-xs font-black uppercase tracking-wide text-emerald-700">
                Frequently Asked Questions
              </p>

              <h2 className="mt-2 text-2xl font-black text-slate-900">
                Answers to common questions
              </h2>

              <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
                These answers help customers and agents understand what to do
                before contacting support.
              </p>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              {faqs.map((faq) => (
                <div
                  key={faq.question}
                  className="rounded-3xl border border-slate-100 bg-slate-50 p-5"
                >
                  <div className="flex items-start gap-3">
                    <FileQuestion className="mt-1 h-5 w-5 shrink-0 text-emerald-700" />

                    <div>
                      <h3 className="break-words text-base font-black text-slate-900">
                        {faq.question}
                      </h3>

                      <p className="mt-2 break-words text-sm font-semibold leading-6 text-slate-500">
                        {faq.answer}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-8 rounded-3xl border border-amber-200 bg-amber-50 p-5 md:p-6">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-1 h-5 w-5 shrink-0 text-amber-700" />

              <div>
                <h2 className="text-lg font-black text-amber-950">
                  Important security reminder
                </h2>

                <p className="mt-2 break-words text-sm font-semibold leading-6 text-amber-800">
                  TrustPoint will never ask you to share your password. For MoMo
                  payments, always keep your transaction reference and payment
                  screenshot. Only submit payment details through the official
                  Fund Space payment page or through your registered agent.
                </p>
              </div>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}