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
  UsersRound,
  Wallet,
} from 'lucide-react';

import { supabase } from '@/lib/supabase/client';

type NotificationFilter =
  | 'ALL'
  | 'UNREAD'
  | 'READ'
  | 'FUND_SPACE'
  | 'AGENT'
  | 'PAYMENT'
  | 'VERIFICATION'
  | 'GENERAL';

type NotificationItem = {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  related_entity_id: string | null;
  related_entity_type: string | null;
  created_at: string | null;
  category: NotificationFilter;
};

type NotificationStats = {
  total: number;
  unread: number;
  read: number;
  fund_space: number;
  agent: number;
  payment: number;
  verification: number;
  general: number;
};

type ApiResponse = {
  success: boolean;
  message?: string;
  stats?: NotificationStats;
  notifications?: NotificationItem[];
};

const defaultStats: NotificationStats = {
  total: 0,
  unread: 0,
  read: 0,
  fund_space: 0,
  agent: 0,
  payment: 0,
  verification: 0,
  general: 0,
};

const filters: {
  label: string;
  value: NotificationFilter;
  statKey: keyof NotificationStats;
}[] = [
  { label: 'All', value: 'ALL', statKey: 'total' },
  { label: 'Unread', value: 'UNREAD', statKey: 'unread' },
  { label: 'Fund Space', value: 'FUND_SPACE', statKey: 'fund_space' },
  { label: 'Agent', value: 'AGENT', statKey: 'agent' },
  { label: 'Payment', value: 'PAYMENT', statKey: 'payment' },
  { label: 'Verification', value: 'VERIFICATION', statKey: 'verification' },
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

function formatLabel(value: string | null | undefined) {
  if (!value) return 'General';

  return value
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getIcon(category: NotificationFilter) {
  if (category === 'FUND_SPACE') return <UsersRound className="h-5 w-5" />;
  if (category === 'AGENT') return <ShieldCheck className="h-5 w-5" />;
  if (category === 'PAYMENT') return <Smartphone className="h-5 w-5" />;
  if (category === 'VERIFICATION') return <FileCheck2 className="h-5 w-5" />;
  return <Info className="h-5 w-5" />;
}

function getStyle(category: NotificationFilter, isRead: boolean) {
  if (isRead) {
    return 'border-gray-100 bg-gray-50 text-gray-600';
  }

  if (category === 'FUND_SPACE') {
    return 'border-emerald-100 bg-emerald-50 text-emerald-700';
  }

  if (category === 'AGENT') {
    return 'border-blue-100 bg-blue-50 text-blue-700';
  }

  if (category === 'PAYMENT') {
    return 'border-amber-100 bg-amber-50 text-amber-700';
  }

  if (category === 'VERIFICATION') {
    return 'border-purple-100 bg-purple-50 text-purple-700';
  }

  return 'border-gray-100 bg-white text-gray-700';
}

function getNotificationHref(notification: NotificationItem, basePath: string) {
  const entityType = String(notification.related_entity_type || '').toLowerCase();
  const type = String(notification.type || '').toUpperCase();

  if (entityType.includes('fund_space') || type.includes('FUND_SPACE')) {
    if (basePath.startsWith('/agent')) {
      return '/agent/fund-space/contributions';
    }

    return '/dashboard/fund-space';
  }

  if (entityType.includes('payment') || type.includes('PAYMENT') || type.includes('MOMO')) {
    if (basePath.startsWith('/agent')) {
      return '/agent/fund-space/contributions';
    }

    return '/dashboard/transactions';
  }

  if (type.includes('WITHDRAWAL')) {
    return `${basePath}/withdrawals`;
  }

  return `${basePath}/notifications`;
}

function StatCard({
  title,
  value,
  description,
  icon,
  active,
  onClick,
}: {
  title: string;
  value: number;
  description: string;
  icon: ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group rounded-3xl border p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md md:p-6 ${
        active
          ? 'border-emerald-200 bg-emerald-50'
          : 'border-gray-100 bg-white hover:border-emerald-200'
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-gray-500">{title}</p>
          <h3 className="mt-2 text-3xl font-black text-gray-900">{value}</h3>
          <p className="mt-1 text-sm leading-6 text-gray-500">{description}</p>
          <p className="mt-3 inline-flex items-center gap-1 text-xs font-black text-emerald-700 opacity-0 transition group-hover:opacity-100">
            Open filtered notifications <ArrowRight className="h-3.5 w-3.5" />
          </p>
        </div>

        <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-700 transition group-hover:bg-emerald-600 group-hover:text-white">
          {icon}
        </div>
      </div>
    </button>
  );
}

export default function GeneralNotificationsPage({
  basePath,
  title,
  subtitle,
}: {
  basePath: '/dashboard' | '/agent' | '/admin';
  title: string;
  subtitle: string;
}) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [stats, setStats] = useState<NotificationStats>(defaultStats);
  const [activeFilter, setActiveFilter] = useState<NotificationFilter>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const [message, setMessage] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

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

  const loadNotifications = useCallback(async () => {
    try {
      setLoading(true);
      setMessage(null);

      const token = await getToken();

      const params = new URLSearchParams();
      params.set('filter', activeFilter);

      if (searchTerm.trim()) {
        params.set('search', searchTerm.trim());
      }

      const response = await fetch(`/api/notifications?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const result = (await response.json()) as ApiResponse;

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Unable to load notifications.');
      }

      setNotifications(result.notifications || []);
      setStats(result.stats || defaultStats);
    } catch (error) {
      setNotifications([]);
      setStats(defaultStats);
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
  }, [activeFilter, searchTerm]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const visibleNotifications = useMemo(() => notifications, [notifications]);

  const markOneRead = async (notificationId: string) => {
    try {
      setActionLoading(true);
      setMessage(null);

      const token = await getToken();

      const response = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'MARK_ONE_READ',
          notification_id: notificationId,
        }),
      });

      const result = (await response.json()) as ApiResponse;

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Unable to update notification.');
      }

      setMessage({
        type: 'success',
        text: result.message || 'Notification marked as read.',
      });

      await loadNotifications();
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

  const markAllRead = async () => {
    try {
      setActionLoading(true);
      setMessage(null);

      const token = await getToken();

      const response = await fetch('/api/notifications', {
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
        throw new Error(result.message || 'Unable to mark all notifications as read.');
      }

      setMessage({
        type: 'success',
        text: result.message || 'All notifications marked as read.',
      });

      await loadNotifications();
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
          <div className="max-w-4xl">
            <p className="mb-3 inline-flex rounded-full bg-white/15 px-4 py-1 text-sm font-semibold">
              Notification Center
            </p>

            <h1 className="text-3xl font-black md:text-4xl">{title}</h1>

            <p className="mt-4 max-w-3xl text-sm leading-7 text-emerald-50 md:text-base">
              {subtitle}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={loadNotifications}
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
              onClick={markAllRead}
              disabled={actionLoading || stats.unread === 0}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <CheckCheck className="h-4 w-4" />
              Mark All Read
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
          title="All"
          value={stats.total}
          description="All notifications"
          icon={<Bell className="h-5 w-5" />}
          active={activeFilter === 'ALL'}
          onClick={() => setActiveFilter('ALL')}
        />

        <StatCard
          title="Unread"
          value={stats.unread}
          description="Notifications needing attention"
          icon={<Clock className="h-5 w-5" />}
          active={activeFilter === 'UNREAD'}
          onClick={() => setActiveFilter('UNREAD')}
        />

        <StatCard
          title="Fund Space"
          value={stats.fund_space}
          description="Rounds, contributions, reminders"
          icon={<UsersRound className="h-5 w-5" />}
          active={activeFilter === 'FUND_SPACE'}
          onClick={() => setActiveFilter('FUND_SPACE')}
        />

        <StatCard
          title="Payments"
          value={stats.payment}
          description="MoMo, payout, and transaction alerts"
          icon={<HandCoins className="h-5 w-5" />}
          active={activeFilter === 'PAYMENT'}
          onClick={() => setActiveFilter('PAYMENT')}
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
                  loadNotifications();
                }
              }}
              placeholder="Search notifications..."
              className="w-full rounded-2xl border border-gray-200 bg-gray-50 py-3 pl-11 pr-4 text-sm outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-50"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {filters.map((filter) => (
              <button
                key={filter.value}
                type="button"
                onClick={() => setActiveFilter(filter.value)}
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
              onClick={loadNotifications}
              className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-black text-gray-700 transition hover:bg-gray-50"
            >
              Search
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-gray-100 bg-white shadow-sm">
        {loading ? (
          <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 p-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
            <p className="text-sm font-semibold text-gray-500">
              Loading notifications...
            </p>
          </div>
        ) : visibleNotifications.length === 0 ? (
          <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 p-8 text-center">
            <Bell className="h-10 w-10 text-gray-300" />
            <h2 className="text-lg font-black text-gray-900">
              No notifications found
            </h2>
            <p className="max-w-md text-sm leading-6 text-gray-500">
              New reminders and alerts will appear here when they are created.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {visibleNotifications.map((notification) => {
              const href = getNotificationHref(notification, basePath);

              return (
                <div key={notification.id} className="p-5 md:p-6">
                  <div
                    className={`rounded-3xl border p-5 ${getStyle(
                      notification.category,
                      notification.is_read
                    )}`}
                  >
                    <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                      <div className="flex min-w-0 flex-1 gap-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/80 shadow-sm">
                          {getIcon(notification.category)}
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

                            <span className="rounded-full border border-gray-100 bg-white px-2.5 py-1 text-xs font-black text-gray-600">
                              {formatLabel(notification.category)}
                            </span>
                          </div>

                          <p className="mt-2 text-sm leading-6 text-gray-700">
                            {notification.message}
                          </p>

                          <div className="mt-4 flex flex-wrap gap-3 text-xs text-gray-500">
                            <span>{formatDateTime(notification.created_at)}</span>
                            <span>Type: {formatLabel(notification.type)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex shrink-0 flex-wrap gap-2">
                        {!notification.is_read && (
                          <button
                            type="button"
                            onClick={() => markOneRead(notification.id)}
                            disabled={actionLoading}
                            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-black text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <Eye className="h-4 w-4" />
                            Mark Read
                          </button>
                        )}

                        <Link
                          href={href}
                          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-black text-white hover:bg-emerald-700"
                        >
                          Open
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
      </section>
    </div>
  );
}