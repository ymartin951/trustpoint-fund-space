'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import type { ElementType, ReactNode } from 'react';
import {
  BadgeCheck,
  Banknote,
  Bell,
  ChevronDown,
  CircleHelp,
  ClipboardCheck,
  CreditCard,
  HandCoins,
  Home,
  LayoutDashboard,
  LifeBuoy,
  Loader2,
  LogOut,
  Menu,
  Settings,
  Shield,
  Smartphone,
  User,
  UserCog,
  UserPlus,
  Users,
  WalletCards,
  X,
} from 'lucide-react';

import { useAuth } from '@/contexts/AuthContext';

type AppRole = 'USER' | 'AGENT' | 'ADMIN' | 'SUPER_ADMIN';

type NavItem = {
  href: string;
  label: string;
  icon: ElementType;
  description?: string;
};

type NavSection = {
  title: string;
  items: NavItem[];
};

type ProfileLike = {
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  role?: string | null;
  verification_status?: string | null;
  status?: string | null;
};

function normalizeRole(role: string | null | undefined): AppRole {
  const value = String(role || 'USER').toUpperCase();

  if (value === 'SUPER_ADMIN') return 'SUPER_ADMIN';
  if (value === 'ADMIN') return 'ADMIN';
  if (value === 'AGENT') return 'AGENT';

  return 'USER';
}

function formatRole(role: AppRole) {
  if (role === 'SUPER_ADMIN') return 'Super Admin';
  if (role === 'ADMIN') return 'Admin';
  if (role === 'AGENT') return 'Agent';

  return 'Member';
}

function formatLabel(value: string | null | undefined) {
  if (!value) return 'Not set';

  return value
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getRoleBadgeClass(role: AppRole) {
  if (role === 'SUPER_ADMIN') {
    return 'border-amber-200 bg-amber-50 text-amber-800';
  }

  if (role === 'ADMIN') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  }

  if (role === 'AGENT') {
    return 'border-blue-200 bg-blue-50 text-blue-800';
  }

  return 'border-slate-200 bg-slate-50 text-slate-700';
}

function getVerificationBadgeClass(status: string | null | undefined) {
  const value = String(status || '').toUpperCase();

  if (value === 'VERIFIED') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  }

  if (value === 'PENDING') {
    return 'border-amber-200 bg-amber-50 text-amber-800';
  }

  if (value === 'REJECTED' || value === 'SUSPENDED') {
    return 'border-red-200 bg-red-50 text-red-800';
  }

  return 'border-slate-200 bg-slate-50 text-slate-700';
}

function isActivePath(pathname: string, href: string) {
  if (href === '/') {
    return pathname === '/';
  }

  if (href === '/admin' || href === '/agent' || href === '/dashboard') {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function getInitials(name: string | null | undefined) {
  const cleanName = String(name || 'TrustPoint Member').trim();

  return cleanName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

const globalNavItems: NavItem[] = [
  {
    href: '/',
    label: 'Home',
    icon: Home,
    description: 'Public homepage',
  },
  {
    href: '/support',
    label: 'Support',
    icon: LifeBuoy,
    description: 'Help and contact center',
  },
];

const adminNavSections: NavSection[] = [
  {
    title: 'Admin Control',
    items: [
      {
        href: '/admin',
        label: 'Admin Dashboard',
        icon: Shield,
        description: 'System overview',
      },
      {
        href: '/admin/verifications',
        label: 'Verifications',
        icon: BadgeCheck,
        description: 'Approve member verification',
      },
      {
        href: '/admin/transactions',
        label: 'Transactions',
        icon: CreditCard,
        description: 'System and MoMo records',
      },
      {
        href: '/admin/notifications',
        label: 'Admin Notifications',
        icon: Bell,
        description: 'System alerts and MoMo alerts',
      },
    ],
  },
  {
    title: 'Fund Space',
    items: [
      {
        href: '/admin/fund-space',
        label: 'Fund Space Management',
        icon: WalletCards,
        description: 'Manage contribution groups',
      },
      {
        href: '/admin/fund-space/contributions',
        label: 'Weekly Contributions',
        icon: HandCoins,
        description: 'Track member contributions',
      },
      {
        href: '/admin/manual-payment-submissions',
        label: 'MoMo Reviews',
        icon: Smartphone,
        description: 'Review MoMo payment records',
      },
      {
        href: '/admin/fund-space/payouts',
        label: 'Payout Approvals',
        icon: Banknote,
        description: 'Approve and mark payouts paid',
      },
      {
        href: '/admin/fund-space/disputes',
        label: 'Complaints',
        icon: CircleHelp,
        description: 'Review member and agent issues',
      },
    ],
  },
  {
    title: 'People & System',
    items: [
      {
        href: '/admin/users',
        label: 'Members',
        icon: User,
        description: 'Manage member accounts',
      },
      {
        href: '/admin/agents',
        label: 'Agents',
        icon: Users,
        description: 'Manage field agents',
      },
      {
        href: '/admin/settings/auth',
        label: 'Audit Settings',
        icon: Settings,
        description: 'Security and auth controls',
      },
      {
        href: '/admin/audit-logs',
        label: 'Audit Logs',
        icon: ClipboardCheck,
        description: 'System activity history',
      },
    ],
  },
];

const agentNavSections: NavSection[] = [
  {
    title: 'Agent Control',
    items: [
      {
        href: '/agent',
        label: 'Agent Dashboard',
        icon: UserCog,
        description: 'Agent overview',
      },
      {
        href: '/agent/customers',
        label: 'Customers',
        icon: Users,
        description: 'Registered customers',
      },
      {
        href: '/agent/register-customer',
        label: 'Register Customer',
        icon: UserPlus,
        description: 'Create customer account',
      },
      {
        href: '/agent/notifications',
        label: 'Agent Notifications',
        icon: Bell,
        description: 'Agent alerts',
      },
    ],
  },
  {
    title: 'Fund Space',
    items: [
      {
        href: '/agent/fund-space',
        label: 'Customer Fund Space',
        icon: WalletCards,
        description: 'Manage customer groups',
      },
      {
        href: '/agent/fund-space/contributions',
        label: 'Weekly Contributions',
        icon: HandCoins,
        description: 'Help customers pay weekly',
      },
      {
        href: '/agent/fund-space/disputes',
        label: 'Complaints',
        icon: CircleHelp,
        description: 'Report customer payment issues',
      },
    ],
  },
];

const memberNavSections: NavSection[] = [
  {
    title: 'My Account',
    items: [
      {
        href: '/dashboard',
        label: 'My Dashboard',
        icon: LayoutDashboard,
        description: 'Account overview',
      },
      {
        href: '/dashboard/verification',
        label: 'Verification',
        icon: BadgeCheck,
        description: 'Submit or review verification',
      },
      {
        href: '/dashboard/fund-space/disputes',
        label: 'Disputes & Complaints',
        icon: CircleHelp,
        description: 'Report Fund Space issues',
      },
    ],
  },
];

export function DashboardLayout({ children }: { children: ReactNode }) {
  const { profile, signOut, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const profileRecord = profile as ProfileLike | null;
  const role = normalizeRole(profileRecord?.role);
  const isAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN';
  const isAgent = role === 'AGENT';

  const navSections = useMemo(() => {
    if (isAdmin) return adminNavSections;
    if (isAgent) return agentNavSections;

    return memberNavSections;
  }, [isAdmin, isAgent]);

  const dashboardHref = useMemo(() => {
    if (isAdmin) return '/admin';
    if (isAgent) return '/agent';

    return '/dashboard';
  }, [isAdmin, isAgent]);

  const displayName = profileRecord?.full_name || 'TrustPoint Member';
  const displayEmail = profileRecord?.email || profileRecord?.phone || '';
  const verificationStatus = profileRecord?.verification_status || 'UNVERIFIED';

  const closeMenus = () => {
    setMobileMenuOpen(false);
    setProfileMenuOpen(false);
  };

  const handleSignOut = async () => {
    try {
      setLoggingOut(true);
      setProfileMenuOpen(false);
      setMobileMenuOpen(false);

      await signOut();

      router.replace('/auth/login');
      router.refresh();
    } catch (error) {
      console.error('Logout error:', error);
      router.replace('/auth/login');
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-sm rounded-[2rem] border border-slate-200 bg-white p-8 text-center shadow-sm">
          <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-emerald-700" />
          <p className="text-sm font-bold text-slate-700">
            Loading TrustPoint Fund Space...
          </p>
          <p className="mt-2 text-xs leading-5 text-slate-500">
            Preparing your secure dashboard.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {mobileMenuOpen && (
        <button
          type="button"
          aria-label="Close navigation overlay"
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-sm lg:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[88vw] max-w-[340px] flex-col border-r border-emerald-950/10 bg-white shadow-2xl transition-transform duration-300 lg:w-80 lg:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex min-h-20 items-center justify-between border-b border-slate-100 px-5">
          <Link
            href={dashboardHref}
            onClick={closeMenus}
            className="flex min-w-0 items-center gap-3"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-950 to-emerald-700 text-sm font-black text-white shadow-sm">
              TP
            </div>

            <div className="min-w-0">
              <p className="truncate text-sm font-black uppercase tracking-[0.18em] text-emerald-900">
                TrustPoint
              </p>
              <p className="truncate text-xs font-semibold text-slate-500">
                Fund Space
              </p>
            </div>
          </Link>

          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 text-slate-600 hover:bg-slate-50 lg:hidden"
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
          <div className="mb-5 rounded-[1.5rem] border border-emerald-100 bg-emerald-50 p-4">
            <div className="flex gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-900 text-sm font-black text-white">
                {getInitials(displayName)}
              </div>

              <div className="min-w-0">
                <p className="truncate text-sm font-black text-slate-950">
                  {displayName}
                </p>

                {displayEmail && (
                  <p className="mt-1 truncate text-xs font-semibold text-slate-500">
                    {displayEmail}
                  </p>
                )}

                <div className="mt-3 flex flex-wrap gap-2">
                  <span
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-black ${getRoleBadgeClass(
                      role
                    )}`}
                  >
                    {formatRole(role)}
                  </span>

                  <span
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-black ${getVerificationBadgeClass(
                      verificationStatus
                    )}`}
                  >
                    {formatLabel(verificationStatus)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <nav className="space-y-6">
            {navSections.map((section) => (
              <div key={section.title}>
                <p className="px-3 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">
                  {section.title}
                </p>

                <div className="mt-2 space-y-1">
                  {section.items.map((item) => (
                    <SidebarLink
                      key={item.href}
                      item={item}
                      active={isActivePath(pathname, item.href)}
                      onClick={closeMenus}
                    />
                  ))}
                </div>
              </div>
            ))}

            <div>
              <p className="px-3 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">
                General
              </p>

              <div className="mt-2 space-y-1">
                {globalNavItems.map((item) => (
                  <SidebarLink
                    key={item.href}
                    item={item}
                    active={isActivePath(pathname, item.href)}
                    onClick={closeMenus}
                  />
                ))}
              </div>
            </div>
          </nav>
        </div>

        <div className="border-t border-slate-100 p-4">
          <button
            type="button"
            onClick={handleSignOut}
            disabled={loggingOut}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-black text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loggingOut ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <LogOut size={17} />
            )}
            {loggingOut ? 'Signing out...' : 'Sign Out'}
          </button>
        </div>
      </aside>

      <div className="lg:pl-80">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur-xl">
          <div className="flex min-h-20 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200 text-slate-700 hover:bg-slate-50 lg:hidden"
                aria-label="Open menu"
              >
                <Menu size={22} />
              </button>

              <div className="min-w-0">
                <p className="truncate text-sm font-black text-slate-950 sm:text-base">
                  {getCurrentPageTitle(pathname, navSections)}
                </p>
                <p className="truncate text-xs font-semibold text-slate-500">
                  {formatRole(role)} workspace
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <Link
                href="/support"
                className="hidden min-h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-2 text-sm font-black text-slate-700 hover:bg-slate-50 sm:inline-flex"
              >
                <LifeBuoy size={17} />
                Support
              </Link>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setProfileMenuOpen((value) => !value)}
                  className="flex min-h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-2.5 py-2 text-sm font-black text-slate-800 hover:bg-slate-50 sm:px-3"
                  aria-expanded={profileMenuOpen}
                  aria-haspopup="menu"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-900 text-xs font-black text-white">
                    {getInitials(displayName)}
                  </span>

                  <span className="hidden max-w-36 truncate sm:block">
                    {displayName}
                  </span>

                  <ChevronDown size={16} />
                </button>

                {profileMenuOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 mt-2 w-72 overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-xl"
                  >
                    <div className="border-b border-slate-100 p-4">
                      <p className="truncate text-sm font-black text-slate-950">
                        {displayName}
                      </p>

                      {displayEmail && (
                        <p className="mt-1 truncate text-xs font-semibold text-slate-500">
                          {displayEmail}
                        </p>
                      )}

                      <div className="mt-3 flex flex-wrap gap-2">
                        <span
                          className={`rounded-full border px-2.5 py-1 text-[11px] font-black ${getRoleBadgeClass(
                            role
                          )}`}
                        >
                          {formatRole(role)}
                        </span>

                        <span
                          className={`rounded-full border px-2.5 py-1 text-[11px] font-black ${getVerificationBadgeClass(
                            verificationStatus
                          )}`}
                        >
                          {formatLabel(verificationStatus)}
                        </span>
                      </div>
                    </div>

                    <div className="p-2">
                      <Link
                        href={dashboardHref}
                        onClick={closeMenus}
                        className="flex items-center gap-2 rounded-2xl px-3 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
                      >
                        <LayoutDashboard size={17} />
                        Dashboard
                      </Link>

                      <Link
                        href="/support"
                        onClick={closeMenus}
                        className="flex items-center gap-2 rounded-2xl px-3 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
                      >
                        <LifeBuoy size={17} />
                        Support
                      </Link>

                      <button
                        type="button"
                        onClick={handleSignOut}
                        disabled={loggingOut}
                        className="flex w-full items-center gap-2 rounded-2xl px-3 py-3 text-left text-sm font-bold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {loggingOut ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <LogOut size={17} />
                        )}
                        {loggingOut ? 'Signing out...' : 'Sign Out'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        <div className="min-h-[calc(100vh-5rem)]">{children}</div>
      </div>
    </div>
  );
}

function SidebarLink({
  item,
  active,
  onClick,
}: {
  item: NavItem;
  active: boolean;
  onClick: () => void;
}) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={`group flex min-h-14 items-center gap-3 rounded-2xl px-3 py-3 transition ${
        active
          ? 'bg-emerald-900 text-white shadow-sm'
          : 'text-slate-700 hover:bg-emerald-50 hover:text-emerald-900'
      }`}
    >
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
          active
            ? 'bg-white/15 text-white'
            : 'bg-slate-50 text-slate-500 group-hover:bg-white group-hover:text-emerald-800'
        }`}
      >
        <Icon size={19} />
      </span>

      <span className="min-w-0">
        <span className="block truncate text-sm font-black">{item.label}</span>

        {item.description && (
          <span
            className={`mt-0.5 block truncate text-xs font-medium ${
              active ? 'text-emerald-50/80' : 'text-slate-400'
            }`}
          >
            {item.description}
          </span>
        )}
      </span>
    </Link>
  );
}

function getCurrentPageTitle(pathname: string, sections: NavSection[]) {
  const allItems = [...sections.flatMap((section) => section.items), ...globalNavItems];

  const exactMatch = allItems.find((item) => pathname === item.href);

  if (exactMatch) return exactMatch.label;

  const nestedMatch = allItems
    .filter(
      (item) =>
        item.href !== '/' &&
        pathname !== item.href &&
        pathname.startsWith(`${item.href}/`)
    )
    .sort((a, b) => b.href.length - a.href.length)[0];

  if (nestedMatch) return nestedMatch.label;

  return 'TrustPoint Fund Space';
}

export default DashboardLayout;