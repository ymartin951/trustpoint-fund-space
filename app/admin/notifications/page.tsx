'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  ArrowRight,
  Bell,
  CheckCheck,
  CheckCircle2,
  Clock,
  Eye,
  FileCheck2,
  HandCoins,
  Info,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  Smartphone,
  Users,
  WalletCards,
  XCircle,
} from 'lucide-react';

import { supabase } from '@/lib/supabase/client';

type AdminNotificationFilter =
  | 'ALL'
  | 'UNREAD'
  | 'READ'
  | 'MANUAL_PAYMENT'
  | 'AWAITING_REVIEW'
  | 'REJECTED_PAYMENT'
  | 'APPROVED_PAYMENT'
  | 'PAYOUT'
  | 'VERIFICATION'
  | 'FUND_SPACE'
  | 'GENERAL';

type NotificationStats = {
  all: number;
  unread: number;
  read: number;
  manual_payment: number;
  awaiting_review: number;
  rejected_payment: number;
  approved_payment: number;
  payout: number;
  verification: number;
  fund_space: number;
  general: number;
};

type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

type AdminNotificationItem = {
  id: string;
  source: 'DATABASE' | 'MANUAL_PAYMENT_SYSTEM';
  real_notification_id: string | null;
  title: string;
  message: string;
  type: string;
  category: AdminNotificationFilter;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  is_read: boolean;
  related_entity_id: string | null;
  related_entity_type: string | null;
  created_at: string | null;
  action_label: string;
  action_href: string;
  customer_name?: string | null;
  customer_phone?: string | null;
  agent_name?: string | null;
  fund_space_name?: string | null;
  amount_due?: number | null;
  service_fee?: number | null;
  total_amount_paid?: number | null;
  transaction_reference?: string | null;
  manual_payment_status?: string | null;
  rejection_reason?: string | null;
};

type ApiResponse = {
  success: boolean;
  message?: string;
  stats?: NotificationStats;
  notifications?: AdminNotificationItem[];
  pagination?: Pagination;
};

const defaultStats: NotificationStats = {
  all: 0,
  unread: 0,
  read: 0,
  manual_payment: 0,
  awaiting_review: 0,
  rejected_payment: 0,
  approved_payment: 0,
  payout: 0,
  verification: 0,
  fund_space: 0,
  general: 0,
};

const defaultPagination: Pagination = {
  page: 1,
  limit: 20,
  total: 0,
  totalPages: 1,
};

const filters: {
  label: string;
  value: AdminNotificationFilter;
  statKey: keyof NotificationStats;
}[] = [
  { label: 'All', value: 'ALL', statKey: 'all' },
  { label: 'Unread', value: 'UNREAD', statKey: 'unread' },
  { label: 'MoMo Payments', value: 'MANUAL_PAYMENT', statKey: 'manual_payment' },
  {
    label: 'Awaiting Review',
    value: 'AWAITING_REVIEW',
    statKey: 'awaiting_review',
  },
  {
    label: 'Rejected MoMo',
    value: 'REJECTED_PAYMENT',
    statKey: 'rejected_payment',
  },
  {
    label: 'Approved MoMo',
    value: 'APPROVED_PAYMENT',
    statKey: 'approved_payment',
  },
  { label: 'Payouts', value: 'PAYOUT', statKey: 'payout' },
  { label: 'Verifications', value: 'VERIFICATION', statKey: 'verification' },
  { label: 'Fund Space', value: 'FUND_SPACE', statKey: 'fund_space' },
  { label: 'General', value: 'GENERAL', statKey: 'general' },
];

function formatDateTime(value: string | null | undefined) {
  if (!value) return 'Not available';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Invalid date';
  }

  return new Intl.DateTimeFormat('en-GH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatMoney(amount: number | null | undefined) {
  return `GH₵${Number(amount || 0).toLocaleString('en-GH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatLabel(value: string | null | undefined) {
  if (!value) return 'Not set';

  return value
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getNotificationIcon(item: AdminNotificationItem) {
  if (item.category === 'APPROVED_PAYMENT') {
    return <CheckCircle2 className="h-5 w-5" />;
  }

  if (item.category === 'REJECTED_PAYMENT') {
    return <XCircle className="h-5 w-5" />;
  }

  if (
    item.category === 'MANUAL_PAYMENT' ||
    item.category === 'AWAITING_REVIEW'
  ) {
    return <Smartphone className="h-5 w-5" />;
  }

  if (item.category === 'PAYOUT') {
    return <HandCoins className="h-5 w-5" />;
  }

  if (item.category === 'VERIFICATION') {
    return <ShieldCheck className="h-5 w-5" />;
  }

  if (item.category === 'FUND_SPACE') {
    return <Users className="h-5 w-5" />;
  }

  return <Info className="h-5 w-5" />;
}

function getNotificationStyle(item: AdminNotificationItem) {
  if (item.is_read && item.source === 'DATABASE') {
    return 'border-gray-100 bg-gray-50 text-gray-500';
  }

  if (item.category === 'AWAITING_REVIEW') {
    return 'border-amber-200 bg-amber-50 text-amber-800';
  }

  if (item.category === 'REJECTED_PAYMENT') {
    return 'border-red-200 bg-red-50 text-red-700';
  }

  if (item.category === 'APPROVED_PAYMENT') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }

  if (item.category === 'MANUAL_PAYMENT') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }

  if (item.category === 'PAYOUT') {
    return 'border-indigo-200 bg-indigo-50 text-indigo-700';
  }

  if (item.category === 'VERIFICATION') {
    return 'border-blue-200 bg-blue-50 text-blue-700';
  }

  if (item.category === 'FUND_SPACE') {
    return 'border-teal-200 bg-teal-50 text-teal-700';
  }

  return 'border-gray-100 bg-white text-gray-700';
}

function getPriorityStyle(priority: AdminNotificationItem['priority']) {
  if (priority === 'HIGH') {
    return 'border-red-100 bg-red-50 text-red-700';
  }

  if (priority === 'MEDIUM') {
    return 'border-amber-100 bg-amber-50 text-amber-700';
  }

  return 'border-gray-100 bg-gray-50 text-gray-600';
}

function buildFilterUrl(filter: AdminNotificationFilter) {
  return `/admin/notifications?filter=${encodeURIComponent(filter)}`;
}

function StatCard({
  title,
  value,
  description,
  icon,
  href,
  tone,
}: {
  title: string;
  value: number;
  description: string;
  icon: ReactNode;
  href: string;
  tone: 'emerald' | 'amber' | 'red' | 'blue' | 'indigo' | 'gray';
}) {
  const styles = {
    emerald: 'bg-emerald-50 text-emerald-700 group-hover:bg-emerald-600 group-hover:text-white',
    amber: 'bg-amber-50 text-amber-700 group-hover:bg-amber-500 group-hover:text-white',
    red: 'bg-red-50 text-red-700 group-hover:bg-red-600 group-hover:text-white',
    blue: 'bg-blue-50 text-blue-700 group-hover:bg-blue-600 group-hover:text-white',
    indigo: 'bg-indigo-50 text-indigo-700 group-hover:bg-indigo-600 group-hover:text-white',
    gray: 'bg-gray-50 text-gray-700 group-hover:bg-gray-900 group-hover:text-white',
  };

  return (
    <Link
      href={href}
      className="group block rounded-3xl border border-gray-100 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-gray-500">{title}</p>
          <h3 className="mt-2 text-3xl font-black text-gray-900">{value}</h3>
          <p className="mt-1 text-sm leading-6 text-gray-500">{description}</p>
          <p className="mt-3 inline-flex items-center gap-1 text-xs font-black text-emerald-700 opacity-0 transition group-hover:opacity-100">
            Open filtered view <ArrowRight className="h-3.5 w-3.5" />
          </p>
        </div>

        <div className={`rounded-2xl p-3 transition ${styles[tone]}`}>
          {icon}
        </div>
      </div>
    </Link>
  );
}

export default function AdminNotificationsPage() {
  const [notifications, setNotifications] = useState<AdminNotificationItem[]>(
    []
  );
  const [stats, setStats] = useState<NotificationStats>(defaultStats);
  const [pagination, setPagination] = useState<Pagination>(defaultPagination);
  const [activeFilter, setActiveFilter] =
    useState<AdminNotificationFilter>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

  const queryFilter = useMemo(() => {
    if (typeof window === 'undefined') return 'ALL';

    const params = new URLSearchParams(window.location.search);
    const value = String(params.get('filter') || 'ALL').toUpperCase();

    const allowed: AdminNotificationFilter[] = [
      'ALL',
      'UNREAD',
      'READ',
      'MANUAL_PAYMENT',
      'AWAITING_REVIEW',
      'REJECTED_PAYMENT',
      'APPROVED_PAYMENT',
      'PAYOUT',
      'VERIFICATION',
      'FUND_SPACE',
      'GENERAL',
    ];

    return allowed.includes(value as AdminNotificationFilter)
      ? (value as AdminNotificationFilter)
      : 'ALL';
  }, []);

  const getToken = async () => {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error || !session?.access_token) {
      throw new Error('Your session has expired. Please log in again.');
    }

    return session.access_token;
  };

  const fetchNotifications = useCallback(
    async (page = 1, filter = activeFilter, search = searchTerm) => {
      try {
        setLoading(true);
        setMessage(null);

        const token = await getToken();

        const params = new URLSearchParams();
        params.set('page', String(page));
        params.set('limit', '20');
        params.set('filter', filter);

        if (search.trim()) {
          params.set('search', search.trim());
        }

        const response = await fetch(
          `/api/admin/notifications?${params.toString()}`,
          {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const result = (await response.json()) as ApiResponse;

        if (!response.ok || !result.success) {
          throw new Error(result.message || 'Could not load notifications.');
        }

        setNotifications(result.notifications || []);
        setStats(result.stats || defaultStats);
        setPagination(result.pagination || defaultPagination);
      } catch (error) {
        setMessage({
          type: 'error',
          text:
            error instanceof Error
              ? error.message
              : 'Something went wrong while loading notifications.',
        });
      } finally {
        setLoading(false);
      }
    },
    [activeFilter, searchTerm]
  );

  useEffect(() => {
    setActiveFilter(queryFilter);
    fetchNotifications(1, queryFilter, '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryFilter]);

  const updateFilter = (filter: AdminNotificationFilter) => {
    setActiveFilter(filter);

    const nextUrl = buildFilterUrl(filter);
    window.history.pushState({}, '', nextUrl);

    fetchNotifications(1, filter, searchTerm);
  };

  const submitSearch = () => {
    fetchNotifications(1, activeFilter, searchTerm);
  };

  const markOneAsRead = async (notification: AdminNotificationItem) => {
    try {
      setActionLoading(true);
      setMessage(null);

      if (notification.source === 'MANUAL_PAYMENT_SYSTEM') {
        setMessage({
          type: 'info',
          text:
            'This is a live manual payment alert. Open the MoMo verification page to manage it.',
        });
        return;
      }

      const token = await getToken();

      const response = await fetch('/api/admin/notifications', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'MARK_ONE_READ',
          notification_id: notification.real_notification_id || notification.id,
        }),
      });

      const result = (await response.json()) as ApiResponse;

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Could not mark notification as read.');
      }

      setMessage({
        type: 'success',
        text: result.message || 'Notification marked as read.',
      });

      await fetchNotifications(pagination.page, activeFilter, searchTerm);
    } catch (error) {
      setMessage({
        type: 'error',
        text:
          error instanceof Error
            ? error.message
            : 'Something went wrong while updating notification.',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const markAllAsRead = async () => {
    try {
      setActionLoading(true);
      setMessage(null);

      const token = await getToken();

      const response = await fetch('/api/admin/notifications', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'MARK_ALL_READ',
        }),
      });

      const result = (await response.json()) as ApiResponse;

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Could not mark all notifications as read.');
      }

      setMessage({
        type: 'success',
        text: result.message || 'All notifications marked as read.',
      });

      await fetchNotifications(1, activeFilter, searchTerm);
    } catch (error) {
      setMessage({
        type: 'error',
        text:
          error instanceof Error
            ? error.message
            : 'Something went wrong while updating notifications.',
      });
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="rounded-3xl bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-600 p-6 text-white shadow-sm md:p-8">
        <div className="flex flex-col justify-between gap-6 xl:flex-row xl:items-center">
          <div className="max-w-3xl">
            <p className="mb-3 inline-flex rounded-full bg-white/15 px-4 py-1 text-sm font-semibold">
              Admin Action Center
            </p>

            <h1 className="text-3xl font-black md:text-4xl">
              Notifications and MoMo payment alerts
            </h1>

            <p className="mt-4 max-w-2xl text-sm leading-7 text-emerald-50 md:text-base">
              Monitor admin notifications, manual MoMo payment submissions,
              rejected payment records, approved payments, payout alerts, and
              Fund Space updates from one place.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => fetchNotifications(pagination.page)}
              disabled={loading}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white/15 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Refresh
            </button>

            <button
              type="button"
              onClick={markAllAsRead}
              disabled={actionLoading}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <CheckCheck className="h-4 w-4" />
              Mark Database Alerts Read
            </button>
          </div>
        </div>
      </div>

      {message && (
        <div
          className={`flex items-start gap-3 rounded-2xl border p-4 text-sm font-semibold ${
            message.type === 'success'
              ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
              : message.type === 'info'
                ? 'border-blue-100 bg-blue-50 text-blue-700'
                : 'border-red-100 bg-red-50 text-red-700'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
          ) : message.type === 'info' ? (
            <Info className="mt-0.5 h-5 w-5 shrink-0" />
          ) : (
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          )}
          <p>{message.text}</p>
        </div>
      )}

      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Awaiting MoMo Review"
          value={stats.awaiting_review}
          description="Payment references waiting for admin confirmation"
          icon={<Clock className="h-5 w-5" />}
          href={buildFilterUrl('AWAITING_REVIEW')}
          tone="amber"
        />

        <StatCard
          title="Manual MoMo Alerts"
          value={stats.manual_payment}
          description="All manual payment system alerts"
          icon={<Smartphone className="h-5 w-5" />}
          href={buildFilterUrl('MANUAL_PAYMENT')}
          tone="emerald"
        />

        <StatCard
          title="Rejected MoMo"
          value={stats.rejected_payment}
          description="Rejected submissions needing visibility"
          icon={<XCircle className="h-5 w-5" />}
          href={buildFilterUrl('REJECTED_PAYMENT')}
          tone="red"
        />

        <StatCard
          title="Unread"
          value={stats.unread}
          description="Unread database notifications"
          icon={<Bell className="h-5 w-5" />}
          href={buildFilterUrl('UNREAD')}
          tone="blue"
        />

        <StatCard
          title="Approved MoMo"
          value={stats.approved_payment}
          description="Confirmed payment records"
          icon={<CheckCircle2 className="h-5 w-5" />}
          href={buildFilterUrl('APPROVED_PAYMENT')}
          tone="emerald"
        />

        <StatCard
          title="Payout Alerts"
          value={stats.payout}
          description="Payout related admin notifications"
          icon={<HandCoins className="h-5 w-5" />}
          href={buildFilterUrl('PAYOUT')}
          tone="indigo"
        />

        <StatCard
          title="Verifications"
          value={stats.verification}
          description="Customer and account verification alerts"
          icon={<ShieldCheck className="h-5 w-5" />}
          href={buildFilterUrl('VERIFICATION')}
          tone="blue"
        />

        <StatCard
          title="Fund Space"
          value={stats.fund_space}
          description="Round, contribution, and group alerts"
          icon={<Users className="h-5 w-5" />}
          href={buildFilterUrl('FUND_SPACE')}
          tone="gray"
        />
      </section>

      <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="relative w-full xl:max-w-md">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  submitSearch();
                }
              }}
              placeholder="Search customer, phone, reference, Fund Space..."
              className="w-full rounded-2xl border border-gray-200 bg-gray-50 py-3 pl-11 pr-4 text-sm outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-50"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {filters.map((filter) => (
              <button
                key={filter.value}
                type="button"
                onClick={() => updateFilter(filter.value)}
                className={`rounded-xl px-4 py-2.5 text-sm font-black transition ${
                  activeFilter === filter.value
                    ? 'bg-emerald-600 text-white shadow-sm hover:bg-emerald-700'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {filter.label}{' '}
                <span className="ml-1 opacity-75">
                  {stats[filter.statKey] || 0}
                </span>
              </button>
            ))}

            <button
              type="button"
              onClick={submitSearch}
              className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-black text-gray-700 transition hover:bg-gray-50"
            >
              Search
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm md:p-6">
        {loading ? (
          <div className="flex min-h-[300px] flex-col items-center justify-center gap-3 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
            </div>
            <p className="text-sm font-semibold text-gray-500">
              Loading admin notifications...
            </p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex min-h-[300px] flex-col items-center justify-center gap-3 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-50">
              <Bell className="h-8 w-8 text-gray-400" />
            </div>
            <h2 className="text-lg font-black text-gray-900">
              No notifications found
            </h2>
            <p className="max-w-md text-sm leading-6 text-gray-500">
              Try another filter or search term. New MoMo submissions awaiting
              admin verification will appear here automatically.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {notifications.map((notification) => {
              const style = getNotificationStyle(notification);
              const priorityStyle = getPriorityStyle(notification.priority);
              const isManualPayment =
                notification.source === 'MANUAL_PAYMENT_SYSTEM';

              return (
                <div
                  key={notification.id}
                  className="py-5 first:pt-0 last:pb-0"
                >
                  <div
                    className={`rounded-3xl border p-5 transition hover:shadow-sm ${style}`}
                  >
                    <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                      <div className="flex min-w-0 flex-1 gap-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/80 shadow-sm">
                          {getNotificationIcon(notification)}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-lg font-black text-gray-900">
                              {notification.title}
                            </h3>

                            {!notification.is_read && (
                              <span className="rounded-full bg-emerald-600 px-2.5 py-1 text-xs font-black text-white">
                                New
                              </span>
                            )}

                            <span
                              className={`rounded-full border px-2.5 py-1 text-xs font-black ${priorityStyle}`}
                            >
                              {formatLabel(notification.priority)} Priority
                            </span>

                            <span className="rounded-full border border-gray-100 bg-white px-2.5 py-1 text-xs font-black text-gray-600">
                              {formatLabel(notification.category)}
                            </span>

                            {isManualPayment && (
                              <span className="rounded-full border border-emerald-100 bg-white px-2.5 py-1 text-xs font-black text-emerald-700">
                                Live MoMo Alert
                              </span>
                            )}
                          </div>

                          <p className="mt-2 text-sm leading-6 text-gray-700">
                            {notification.message}
                          </p>

                          {isManualPayment && (
                            <div className="mt-4 grid gap-3 rounded-2xl bg-white/70 p-4 text-sm text-gray-700 md:grid-cols-2 xl:grid-cols-4">
                              <div>
                                <p className="text-xs font-bold uppercase text-gray-400">
                                  Customer
                                </p>
                                <p className="mt-1 font-black">
                                  {notification.customer_name || 'Unknown'}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {notification.customer_phone || 'No phone'}
                                </p>
                              </div>

                              <div>
                                <p className="text-xs font-bold uppercase text-gray-400">
                                  Fund Space
                                </p>
                                <p className="mt-1 font-black">
                                  {notification.fund_space_name || 'Not set'}
                                </p>
                                <p className="text-xs text-gray-500">
                                  Agent:{' '}
                                  {notification.agent_name || 'Not assigned'}
                                </p>
                              </div>

                              <div>
                                <p className="text-xs font-bold uppercase text-gray-400">
                                  Amount Submitted
                                </p>
                                <p className="mt-1 font-black">
                                  {formatMoney(notification.total_amount_paid)}
                                </p>
                                <p className="text-xs text-gray-500">
                                  Due: {formatMoney(notification.amount_due)} ·
                                  Fee: {formatMoney(notification.service_fee)}
                                </p>
                              </div>

                              <div>
                                <p className="text-xs font-bold uppercase text-gray-400">
                                  Reference
                                </p>
                                <p className="mt-1 font-black">
                                  {notification.transaction_reference ||
                                    'Not provided'}
                                </p>
                                <p className="text-xs text-gray-500">
                                  Status:{' '}
                                  {formatLabel(
                                    notification.manual_payment_status
                                  )}
                                </p>
                              </div>
                            </div>
                          )}

                          {notification.rejection_reason && (
                            <div className="mt-4 rounded-2xl border border-red-100 bg-white/70 p-4 text-sm text-red-700">
                              <p className="font-black">Rejection reason</p>
                              <p className="mt-1 leading-6">
                                {notification.rejection_reason}
                              </p>
                            </div>
                          )}

                          <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                            <span>{formatDateTime(notification.created_at)}</span>

                            <span>
                              Source:{' '}
                              {notification.source === 'DATABASE'
                                ? 'Database notification'
                                : 'Manual payment system'}
                            </span>

                            {notification.related_entity_id && (
                              <span className="rounded-full bg-white px-2 py-1 font-semibold">
                                Ref:{' '}
                                {notification.related_entity_id.slice(0, 8)}...
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex shrink-0 flex-wrap gap-2 xl:justify-end">
                        {!notification.is_read &&
                          notification.source === 'DATABASE' && (
                            <button
                              type="button"
                              onClick={() => markOneAsRead(notification)}
                              disabled={actionLoading}
                              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-black text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              <Eye className="h-4 w-4" />
                              Mark Read
                            </button>
                          )}

                        {isManualPayment && (
                          <Link
                            href="/admin/manual-payment-submissions"
                            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-black text-gray-700 hover:bg-gray-50"
                          >
                            <FileCheck2 className="h-4 w-4" />
                            MoMo Page
                          </Link>
                        )}

                        <Link
                          href={notification.action_href}
                          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-black text-white hover:bg-emerald-700"
                        >
                          {notification.action_label}
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-6 flex flex-col items-center justify-between gap-3 border-t border-gray-100 pt-5 sm:flex-row">
          <p className="text-sm text-gray-500">
            Showing page {pagination.page} of {pagination.totalPages || 1} ·{' '}
            {pagination.total} total alert
            {pagination.total === 1 ? '' : 's'}
          </p>

          <div className="flex gap-2">
            <button
              type="button"
              disabled={pagination.page <= 1 || loading}
              onClick={() =>
                fetchNotifications(
                  pagination.page - 1,
                  activeFilter,
                  searchTerm
                )
              }
              className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-black text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>

            <button
              type="button"
              disabled={pagination.page >= pagination.totalPages || loading}
              onClick={() =>
                fetchNotifications(
                  pagination.page + 1,
                  activeFilter,
                  searchTerm
                )
              }
              className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-black text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}