'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import type { ElementType, ReactNode } from 'react';

import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import {
  BadgeCheck,
  Banknote,
  Bell,
  ChevronDown,
  CircleHelp,
  CreditCard,
  HandCoins,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  PiggyBank,
  Settings,
  Shield,
  User,
  UserCog,
  UserPlus,
  Users,
  Wallet,
  WalletCards,
  X,
} from 'lucide-react';

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

export function DashboardLayout({ children }: { children: ReactNode }) {
  const { profile, signOut } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const role = profile?.role || 'USER';
  const isAdmin = role === 'SUPER_ADMIN' || role === 'ADMIN';
  const isAgent = role === 'AGENT';

  const handleSignOut = async () => {
    try {
      setLoggingOut(true);

      await supabase.auth.signOut();

      if (typeof signOut === 'function') {
        await signOut();
      }

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

  const adminNavItems: NavItem[] = [
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
      href: '/admin/fund-space',
      label: 'Fund Space Management',
      icon: WalletCards,
      description: 'Manage Fund Space groups',
    },
    {
      href: '/admin/fund-space/contributions',
      label: 'Fund Space Contributions',
      icon: HandCoins,
      description: 'Track weekly contributions',
    },
    {
      href: '/admin/fund-space/payouts',
      label: 'Payout Approvals',
      icon: Banknote,
      description: 'Approve and pay payouts',
    },
    {
      href: '/admin/users',
      label: 'All Users',
      icon: User,
      description: 'Manage members',
    },
    {
      href: '/admin/agents',
      label: 'Agents',
      icon: Users,
      description: 'Manage agents',
    },
    {
      href: '/admin/transactions',
      label: 'All Transactions',
      icon: CreditCard,
      description: 'Confirmed money movement',
    },
    {
      href: '/admin/withdrawals',
      label: 'Withdrawal Requests',
      icon: Wallet,
      description: 'Review user withdrawals',
    },
    {
      href: '/admin/notifications',
      label: 'Admin Notifications',
      icon: Bell,
      description: 'System alerts',
    },
  ];

  const adminSystemItems: NavItem[] = [
    {
      href: '/admin/settings/auth',
      label: 'Audit Settings',
      icon: Settings,
      description: 'Security and auth controls',
    },
    {
      href: '/admin/audit-logs',
      label: 'Audit Logs',
      icon: Settings,
      description: 'System activity history',
    },
  ];

  const agentNavItems: NavItem[] = [
    {
      href: '/agent',
      label: 'Agent Dashboard',
      icon: UserCog,
      description: 'Agent overview',
    },
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
      description: 'Help customers pay weekly contributions',
    },
    {
      href: '/agent/deposits',
      label: 'Customer Wallet Deposits',
      icon: Wallet,
      description: 'Help customers add money to wallet',
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
  ];

  const memberNavItems: NavItem[] = [
    {
      href: '/dashboard',
      label: 'My Dashboard',
      icon: LayoutDashboard,
      description: 'Personal overview',
    },
    {
      href: '/dashboard/fund-space',
      label: 'My Fund Space',
      icon: Users,
      description: 'Your joined groups',
    },
    {
      href: '/dashboard/deposit',
      label: 'My Wallet',
      icon: Wallet,
      description: 'Wallet deposit and balance',
    },
    {
      href: '/dashboard/transactions',
      label: 'My Transactions',
      icon: CreditCard,
      description: 'Personal transaction records',
    },
    {
      href: '/dashboard/withdrawals',
      label: 'My Withdrawals',
      icon: Banknote,
      description: 'Personal withdrawal requests',
    },
    {
      href: '/dashboard/savings',
      label: 'My Savings Plans',
      icon: PiggyBank,
      description: 'Personal savings',
    },
    {
      href: '/dashboard/groups',
      label: 'My Groups',
      icon: Users,
      description: 'Your groups',
    },
  ];

  const memberViewItems: NavItem[] = [
    {
      href: '/dashboard',
      label: 'My Dashboard',
      icon: LayoutDashboard,
      description: 'Personal overview',
    },
    {
      href: '/dashboard/fund-space',
      label: 'My Fund Space',
      icon: Users,
      description: 'Your joined groups',
    },
    {
      href: '/dashboard/deposit',
      label: 'My Wallet',
      icon: Wallet,
      description: 'Wallet deposit and balance',
    },
    {
      href: '/dashboard/transactions',
      label: 'My Transactions',
      icon: CreditCard,
      description: 'Your personal records',
    },
    {
      href: '/dashboard/withdrawals',
      label: 'My Withdrawals',
      icon: Banknote,
      description: 'Your personal withdrawals',
    },
  ];

  const navSections = useMemo<NavSection[]>(() => {
    if (isAdmin) {
      return [
        {
          title: 'Admin Workspace',
          items: adminNavItems,
        },
        {
          title: 'Member View',
          items: memberViewItems,
        },
        {
          title: 'System Controls',
          items: adminSystemItems,
        },
      ];
    }

    if (isAgent) {
      return [
        {
          title: 'Agent Workspace',
          items: agentNavItems,
        },
        {
          title: 'Member View',
          items: memberViewItems,
        },
      ];
    }

    return [
      {
        title: 'Member Menu',
        items: memberNavItems,
      },
    ];
  }, [isAdmin, isAgent]);

  const getInitials = (name?: string | null) => {
    if (!name) return 'TP';

    const parts = name.trim().split(' ').filter(Boolean);

    if (parts.length === 1) {
      return parts[0].slice(0, 2).toUpperCase();
    }

    return `${parts[0]?.[0] ?? ''}${parts[1]?.[0] ?? ''}`.toUpperCase();
  };

  const getRoleLabel = (value?: string | null) => {
    if (value === 'SUPER_ADMIN') return 'Super Admin';
    if (value === 'ADMIN') return 'Admin';
    if (value === 'AGENT') return 'Agent';
    return 'Member';
  };

  const getRoleBadgeClasses = (value?: string | null) => {
    if (value === 'SUPER_ADMIN') {
      return 'border-purple-200 bg-purple-50 text-purple-700';
    }

    if (value === 'ADMIN') {
      return 'border-indigo-200 bg-indigo-50 text-indigo-700';
    }

    if (value === 'AGENT') {
      return 'border-amber-200 bg-amber-50 text-amber-700';
    }

    return 'border-blue-200 bg-blue-50 text-blue-700';
  };

  const getHomeHref = () => {
    if (isAdmin) return '/admin';
    if (isAgent) return '/agent';
    return '/dashboard';
  };

  const getNotificationsHref = () => {
    if (isAdmin) return '/admin/notifications';
    if (isAgent) return '/agent/notifications';
    return '/dashboard/notifications';
  };

  const getDashboardTitle = () => {
    if (pathname.startsWith('/admin/fund-space/contributions')) {
      return 'Fund Space Contributions';
    }

    if (pathname.startsWith('/admin/fund-space/payouts')) {
      return 'Payout Approvals';
    }

    if (pathname.startsWith('/admin/fund-space')) {
      return 'Fund Space Management';
    }

    if (pathname.startsWith('/admin/verifications')) return 'Verifications';
    if (pathname.startsWith('/admin/users')) return 'All Users';
    if (pathname.startsWith('/admin/agents')) return 'Agents';
    if (pathname.startsWith('/admin/transactions')) return 'All Transactions';
    if (pathname.startsWith('/admin/withdrawals')) return 'Withdrawal Requests';
    if (pathname.startsWith('/admin/notifications')) return 'Admin Notifications';
    if (pathname.startsWith('/admin/settings/auth')) return 'Audit Settings';
    if (pathname.startsWith('/admin/audit-logs')) return 'Audit Logs';
    if (pathname.startsWith('/admin')) return 'Admin Dashboard';

    if (pathname.startsWith('/agent/fund-space/contributions')) {
      return 'Weekly Contributions';
    }

    if (pathname.startsWith('/agent/fund-space')) {
      return 'Customer Fund Space';
    }

    if (pathname.startsWith('/agent/deposits')) return 'Customer Wallet Deposits';
    if (pathname.startsWith('/agent/customers')) return 'Customers';
    if (pathname.startsWith('/agent/register-customer')) return 'Register Customer';
    if (pathname.startsWith('/agent/notifications')) return 'Agent Notifications';
    if (pathname.startsWith('/agent')) return 'Agent Dashboard';

    if (pathname.startsWith('/dashboard/fund-space')) return 'My Fund Space';
    if (pathname.startsWith('/dashboard/deposit')) return 'My Wallet';
    if (pathname.startsWith('/dashboard/transactions')) return 'My Transactions';
    if (pathname.startsWith('/dashboard/withdrawals')) return 'My Withdrawals';
    if (pathname.startsWith('/dashboard/savings')) return 'My Savings Plans';
    if (pathname.startsWith('/dashboard/groups')) return 'My Groups';
    if (pathname.startsWith('/dashboard/profile')) return 'Profile Settings';
    if (pathname.startsWith('/dashboard/notifications')) return 'My Notifications';
    if (pathname.startsWith('/dashboard')) return 'My Dashboard';

    return 'Dashboard';
  };

  const isNavActive = (href: string) => {
    if (href === '/dashboard' || href === '/admin' || href === '/agent') {
      return pathname === href;
    }

    if (href === '/admin/fund-space') {
      return (
        pathname === '/admin/fund-space' ||
        (pathname.startsWith('/admin/fund-space/') &&
          !pathname.startsWith('/admin/fund-space/contributions') &&
          !pathname.startsWith('/admin/fund-space/payouts'))
      );
    }

    if (href === '/agent/fund-space') {
      return (
        pathname === '/agent/fund-space' ||
        (pathname.startsWith('/agent/fund-space/') &&
          !pathname.startsWith('/agent/fund-space/contributions'))
      );
    }

    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const renderNavSections = (sections: NavSection[], isMobile = false) => {
    return sections.map((section) => (
      <div key={section.title} className="space-y-2">
        <p className="px-3 pt-3 text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
          {section.title}
        </p>

        <div className="space-y-1">
          {section.items.map((item) => {
            const Icon = item.icon;
            const isActive = isNavActive(item.href);

            return (
              <Link
                key={`${section.title}-${item.href}`}
                href={item.href}
                onClick={() => {
                  if (isMobile) setMobileMenuOpen(false);
                }}
                className={`group flex items-center gap-3 rounded-2xl px-3 py-3 text-sm transition ${
                  isActive
                    ? 'bg-emerald-50 font-bold text-emerald-700'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'
                }`}
              >
                <div
                  className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${
                    isActive
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-100 text-slate-500 group-hover:bg-white'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </div>

                <div className="min-w-0 flex-1">
                  <span className="block truncate">{item.label}</span>
                  {item.description && (
                    <span
                      className={`mt-0.5 block truncate text-[11px] font-medium ${
                        isActive ? 'text-emerald-600' : 'text-slate-400'
                      }`}
                    >
                      {item.description}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    ));
  };

  return (
    <div className="h-screen overflow-hidden bg-slate-50">
      <div className="flex h-full overflow-hidden">
        <aside className="hidden h-full w-72 flex-shrink-0 border-r border-slate-200 bg-white lg:flex lg:flex-col">
          <div className="flex h-20 flex-shrink-0 items-center border-b border-slate-100 px-5">
            <Link href={getHomeHref()} className="flex min-w-0 items-center gap-3">
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-sm">
                <Wallet className="h-6 w-6" />
              </div>

              <div className="min-w-0">
                <p className="truncate text-lg font-black leading-none text-slate-950">
                  TrustPoint
                </p>
                <p className="mt-1 truncate text-xs font-bold text-emerald-600">
                  Fund Space
                </p>
              </div>
            </Link>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
            <nav className="space-y-5">{renderNavSections(navSections)}</nav>
          </div>

          <div className="flex-shrink-0 border-t border-slate-100 p-3">
            <Link
              href="/support"
              className="flex items-center gap-3 rounded-2xl bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-600 transition hover:bg-emerald-50 hover:text-emerald-700"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-emerald-600">
                <CircleHelp className="h-4 w-4" />
              </div>

              <div>
                <p>Support</p>
                <p className="text-[11px] font-medium text-slate-400">
                  Get help
                </p>
              </div>
            </Link>
          </div>
        </aside>

        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button
              type="button"
              aria-label="Close menu overlay"
              className="absolute inset-0 bg-slate-950/40"
              onClick={() => setMobileMenuOpen(false)}
            />

            <aside className="relative flex h-full w-[88vw] max-w-sm flex-col bg-white shadow-2xl">
              <div className="flex h-20 flex-shrink-0 items-center justify-between border-b border-slate-100 px-4">
                <Link
                  href={getHomeHref()}
                  className="flex min-w-0 items-center gap-3"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-sm">
                    <Wallet className="h-6 w-6" />
                  </div>

                  <div className="min-w-0">
                    <p className="truncate text-lg font-black leading-none text-slate-950">
                      TrustPoint
                    </p>
                    <p className="mt-1 truncate text-xs font-bold text-emerald-600">
                      Fund Space
                    </p>
                  </div>
                </Link>

                <button
                  type="button"
                  className="rounded-xl p-2 text-slate-700 hover:bg-slate-100"
                  onClick={() => setMobileMenuOpen(false)}
                  aria-label="Close menu"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="border-b border-slate-100 px-4 py-4">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-emerald-600 text-sm font-black text-white">
                      {getInitials(profile?.full_name)}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-slate-900">
                        {profile?.full_name || 'TrustPoint User'}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {getRoleLabel(profile?.role)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
                <nav className="space-y-5">
                  {renderNavSections(navSections, true)}
                </nav>
              </div>

              <div className="flex-shrink-0 border-t border-slate-100 p-3">
                <Link
                  href="/support"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 rounded-2xl bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-600"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-emerald-600">
                    <CircleHelp className="h-4 w-4" />
                  </div>
                  Support
                </Link>
              </div>
            </aside>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <header className="flex h-16 flex-shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 sm:h-20 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3 sm:gap-4">
              <button
                type="button"
                className="rounded-xl p-2 text-slate-700 transition hover:bg-slate-100 lg:hidden"
                onClick={() => setMobileMenuOpen(true)}
                aria-label="Open menu"
              >
                <Menu className="h-6 w-6" />
              </button>

              <div className="min-w-0">
                <p className="hidden text-xs font-bold uppercase tracking-wide text-emerald-600 sm:block">
                  TrustPoint Fund Space
                </p>
                <h1 className="truncate text-lg font-black text-slate-950 sm:mt-1 sm:text-2xl">
                  {getDashboardTitle()}
                </h1>
              </div>
            </div>

            <div className="hidden flex-1 items-center justify-center px-8 xl:flex">
              <div className="flex w-full max-w-md items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-500">
                <SearchPlaceholder />
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <button
                type="button"
                className="relative flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 sm:h-11 sm:w-11"
                aria-label="Notifications"
                onClick={() => router.push(getNotificationsHref())}
              >
                <Bell className="h-5 w-5" />
                <span className="absolute right-2.5 top-2.5 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white" />
              </button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="h-auto rounded-2xl border border-slate-200 bg-white px-2 py-2 shadow-sm transition hover:bg-slate-50 sm:px-3"
                  >
                    <div className="flex items-center gap-2 sm:gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-600 text-sm font-bold text-white sm:h-10 sm:w-10">
                        {getInitials(profile?.full_name)}
                      </div>

                      <div className="hidden text-left md:block">
                        <p className="max-w-[150px] truncate text-sm font-semibold text-slate-900">
                          {profile?.full_name || 'TrustPoint User'}
                        </p>
                        <p className="text-xs text-slate-500">
                          {getRoleLabel(profile?.role)}
                        </p>
                      </div>

                      <ChevronDown className="hidden h-4 w-4 text-slate-500 md:block" />
                    </div>
                  </Button>
                </DropdownMenuTrigger>

                <DropdownMenuContent
                  align="end"
                  sideOffset={10}
                  className="w-80 rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl"
                >
                  <div className="rounded-xl bg-slate-50 p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-600 text-base font-bold text-white">
                        {getInitials(profile?.full_name)}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-900">
                          {profile?.full_name || 'TrustPoint User'}
                        </p>

                        <p className="mt-1 truncate text-xs text-slate-500">
                          {profile?.phone || 'No phone number'}
                        </p>

                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getRoleBadgeClasses(
                              profile?.role
                            )}`}
                          >
                            {getRoleLabel(profile?.role)}
                          </span>

                          {profile?.verification_status === 'VERIFIED' && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                              <BadgeCheck className="h-3 w-3" />
                              Verified
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="px-2 py-2">
                    <p className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      Account
                    </p>

                    <DropdownMenuItem
                      onClick={() => router.push('/dashboard/profile')}
                      className="flex cursor-pointer items-center rounded-xl px-3 py-3 text-sm text-slate-700 outline-none transition hover:bg-slate-100 focus:bg-slate-100"
                    >
                      <div className="mr-3 flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                        <Settings className="h-4 w-4" />
                      </div>

                      <div>
                        <p className="font-medium">Profile Settings</p>
                        <p className="text-xs text-slate-500">
                          Update your personal details
                        </p>
                      </div>
                    </DropdownMenuItem>

                    <DropdownMenuItem
                      onClick={() => router.push('/support')}
                      className="mt-1 flex cursor-pointer items-center rounded-xl px-3 py-3 text-sm text-slate-700 outline-none transition hover:bg-slate-100 focus:bg-slate-100"
                    >
                      <div className="mr-3 flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                        <CircleHelp className="h-4 w-4" />
                      </div>

                      <div>
                        <p className="font-medium">Help & Support</p>
                        <p className="text-xs text-slate-500">
                          Get help with your account
                        </p>
                      </div>
                    </DropdownMenuItem>
                  </div>

                  <DropdownMenuSeparator className="my-2 bg-slate-200" />

                  <div className="px-2 pb-2">
                    <DropdownMenuItem
                      onClick={handleSignOut}
                      disabled={loggingOut}
                      className="flex cursor-pointer items-center rounded-xl px-3 py-3 text-sm text-red-600 outline-none transition hover:bg-red-50 focus:bg-red-50 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      <div className="mr-3 flex h-9 w-9 items-center justify-center rounded-lg bg-red-50 text-red-600">
                        {loggingOut ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <LogOut className="h-4 w-4" />
                        )}
                      </div>

                      <div>
                        <p className="font-medium">
                          {loggingOut ? 'Signing out...' : 'Sign Out'}
                        </p>
                        <p className="text-xs text-red-400">
                          Securely log out of your account
                        </p>
                      </div>
                    </DropdownMenuItem>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          <main className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-[1600px] px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

function SearchPlaceholder() {
  return (
    <span className="text-sm">
      Search members, Fund Spaces, wallets, contributions, transactions...
    </span>
  );
}