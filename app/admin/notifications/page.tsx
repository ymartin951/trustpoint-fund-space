'use client';

import { useEffect, useMemo, useState } from 'react';
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
  HandCoins,
  Info,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  Users,
  Wallet,
  WalletCards,
  XCircle,
} from 'lucide-react';

import { supabase } from '@/lib/supabase/client';

type NotificationItem = {
  id: string;
  user_id: string;
  title: string | null;
  message: string | null;
  type: string | null;
  is_read: boolean | null;
  related_entity_id: string | null;
  related_entity_type: string | null;
  created_at: string | null;
};

type NotificationStats = {
  all: number;
  unread: number;
  read: number;
  verification: number;
  payout: number;
  contribution: number;
  withdrawal: number;
  fund_space: number;
};

type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

type FilterType =
  | 'ALL'
  | 'UNREAD'
  | 'READ'
  | 'VERIFICATION'
  | 'PAYOUT'
  | 'CONTRIBUTION'
  | 'WITHDRAWAL'
  | 'FUND_SPACE';

const filters: {
  label: string;
  value: FilterType;
  statKey: keyof NotificationStats;
}[] = [
  { label: 'All', value: 'ALL', statKey: 'all' },
  { label: 'Unread', value: 'UNREAD', statKey: 'unread' },
  { label: 'Read', value: 'READ', statKey: 'read' },
  { label: 'Verification', value: 'VERIFICATION', statKey: 'verification' },
  { label: 'Payout', value: 'PAYOUT', statKey: 'payout' },
  { label: 'Contribution', value: 'CONTRIBUTION', statKey: 'contribution' },
  { label: 'Withdrawal', value: 'WITHDRAWAL', statKey: 'withdrawal' },
  { label: 'Fund Space', value: 'FUND_SPACE', statKey: 'fund_space' },
];

const defaultStats: NotificationStats = {
  all: 0,
  unread: 0,
  read: 0,
  verification: 0,
  payout: 0,
  contribution: 0,
  withdrawal: 0,
  fund_space: 0,
};

const defaultPagination: Pagination = {
  page: 1,
  limit: 20,
  total: 0,
  totalPages: 1,
};

function safeText(value: string | null | undefined, fallback = '') {
  return value || fallback;
}

function formatDateTime(dateString: string | null | undefined) {
  if (!dateString) return 'Not available';

  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) {
    return 'Invalid date';
  }

  return date.toLocaleString('en-GH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getCombinedNotificationText(notification: {
  type?: string | null;
  title?: string | null;
  message?: string | null;
  related_entity_type?: string | null;
}) {
  return `${notification.type || ''} ${notification.title || ''} ${
    notification.message || ''
  } ${notification.related_entity_type || ''}`.toUpperCase();
}

function getNotificationIcon(notification: NotificationItem) {
  const combined = getCombinedNotificationText(notification);

  if (combined.includes('VERIFICATION') || combined.includes('RESUBMITTED')) {
    return <ShieldCheck className="h-5 w-5" />;
  }

  if (combined.includes('PAYOUT')) {
    return <HandCoins className="h-5 w-5" />;
  }

  if (combined.includes('CONTRIBUTION') || combined.includes('PAYMENT')) {
    return <WalletCards className="h-5 w-5" />;
  }

  if (combined.includes('WITHDRAWAL')) {
    return <Wallet className="h-5 w-5" />;
  }

  if (
    combined.includes('FUND_SPACE') ||
    combined.includes('FUND SPACE') ||
    combined.includes('FUND-SPACE')
  ) {
    return <Users className="h-5 w-5" />;
  }

  if (
    combined.includes('SUCCESS') ||
    combined.includes('APPROVED') ||
    combined.includes('CONFIRMED')
  ) {
    return <CheckCircle2 className="h-5 w-5" />;
  }

  if (
    combined.includes('ERROR') ||
    combined.includes('REJECTED') ||
    combined.includes('FAILED') ||
    combined.includes('DEFAULTED') ||
    combined.includes('OVERDUE')
  ) {
    return <XCircle className="h-5 w-5" />;
  }

  return <Info className="h-5 w-5" />;
}

function getNotificationStyle(notification: NotificationItem) {
  const combined = getCombinedNotificationText(notification);
  const isRead = notification.is_read === true;

  if (isRead) {
    return 'border-gray-100 bg-gray-50 text-gray-500';
  }

  if (combined.includes('VERIFICATION') || combined.includes('RESUBMITTED')) {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }

  if (combined.includes('PAYOUT')) {
    return 'border-indigo-200 bg-indigo-50 text-indigo-700';
  }

  if (combined.includes('CONTRIBUTION') || combined.includes('PAYMENT')) {
    return 'border-amber-200 bg-amber-50 text-amber-700';
  }

  if (combined.includes('WITHDRAWAL')) {
    return 'border-orange-200 bg-orange-50 text-orange-700';
  }

  if (
    combined.includes('FUND_SPACE') ||
    combined.includes('FUND SPACE') ||
    combined.includes('FUND-SPACE')
  ) {
    return 'border-teal-200 bg-teal-50 text-teal-700';
  }

  if (
    combined.includes('ERROR') ||
    combined.includes('REJECTED') ||
    combined.includes('FAILED') ||
    combined.includes('DEFAULTED') ||
    combined.includes('OVERDUE')
  ) {
    return 'border-red-200 bg-red-50 text-red-700';
  }

  return 'border-blue-200 bg-blue-50 text-blue-700';
}

function getNotificationLink(notification: NotificationItem) {
  const entityType = safeText(notification.related_entity_type).toLowerCase();
  const combined = `${safeText(notification.type)} ${safeText(
    notification.title
  )} ${safeText(notification.message)} ${entityType}`.toLowerCase();

  if (
    entityType.includes('verification') ||
    entityType === 'customer' ||
    combined.includes('verification') ||
    combined.includes('resubmitted')
  ) {
    return {
      href: '/admin/verifications',
      label: 'Review Verification',
    };
  }

  if (entityType.includes('payout') || combined.includes('payout')) {
    return {
      href: '/admin/fund-space/payouts',
      label: 'Review Payouts',
    };
  }

  if (
    entityType.includes('contribution') ||
    combined.includes('contribution') ||
    combined.includes('payment')
  ) {
    return {
      href: '/admin/fund-space/contributions',
      label: 'View Contributions',
    };
  }

  if (
    entityType.includes('withdrawal') ||
    combined.includes('withdrawal')
  ) {
    return {
      href: '/admin/withdrawals',
      label: 'Review Withdrawals',
    };
  }

  if (
    entityType.includes('fund_space') ||
    entityType.includes('fund-space') ||
    entityType.includes('fund space') ||
    combined.includes('fund_space') ||
    combined.includes('fund-space') ||
    combined.includes('fund space')
  ) {
    return {
      href: notification.related_entity_id
        ? `/admin/fund-space/${notification.related_entity_id}`
        : '/admin/fund-space',
      label: 'View Fund Space',
    };
  }

  return null;
}

function safeParseJson(text: string) {
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

function getFilterCount(stats: NotificationStats, filter: FilterType) {
  if (filter === 'ALL') return stats.all;
  if (filter === 'UNREAD') return stats.unread;
  if (filter === 'READ') return stats.read;
  if (filter === 'VERIFICATION') return stats.verification;
  if (filter === 'PAYOUT') return stats.payout;
  if (filter === 'CONTRIBUTION') return stats.contribution;
  if (filter === 'WITHDRAWAL') return stats.withdrawal;
  if (filter === 'FUND_SPACE') return stats.fund_space;

  return 0;
}

export default function AdminNotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [stats, setStats] = useState<NotificationStats>(defaultStats);
  const [pagination, setPagination] = useState<Pagination>(defaultPagination);

  const [selectedFilter, setSelectedFilter] = useState<FilterType>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  async function getAuthToken() {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error || !session?.access_token) {
      throw new Error('Your session has expired. Please log in again.');
    }

    return session.access_token;
  }

  async function fetchNotifications(page = 1) {
    try {
      setLoading(true);
      setErrorMessage('');
      setSuccessMessage('');

      const token = await getAuthToken();

      const params = new URLSearchParams({
        filter: selectedFilter,
        page: String(page),
        limit: String(pagination.limit || defaultPagination.limit),
      });

      const response = await fetch(`/api/admin/notifications?${params}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const responseText = await response.text();
      const result = safeParseJson(responseText);

      if (!response.ok || !result?.success) {
        throw new Error(result?.message || 'Failed to load notifications.');
      }

      setNotifications(Array.isArray(result.notifications) ? result.notifications : []);
      setStats({
        ...defaultStats,
        ...(result.stats || {}),
      });
      setPagination({
        ...defaultPagination,
        ...(result.pagination || {}),
        page,
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Something went wrong.';

      setErrorMessage(message);
      setNotifications([]);
      setStats(defaultStats);
    } finally {
      setLoading(false);
    }
  }

  async function markOneAsRead(notificationId: string) {
    try {
      setActionLoading(true);
      setErrorMessage('');
      setSuccessMessage('');

      const token = await getAuthToken();

      const response = await fetch('/api/admin/notifications', {
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

      const responseText = await response.text();
      const result = safeParseJson(responseText);

      if (!response.ok || !result?.success) {
        throw new Error(result?.message || 'Failed to update notification.');
      }

      setSuccessMessage(result.message || 'Notification marked as read.');
      await fetchNotifications(pagination.page);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Something went wrong.';

      setErrorMessage(message);
    } finally {
      setActionLoading(false);
    }
  }

  async function markAllAsRead() {
    try {
      setActionLoading(true);
      setErrorMessage('');
      setSuccessMessage('');

      const token = await getAuthToken();

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

      const responseText = await response.text();
      const result = safeParseJson(responseText);

      if (!response.ok || !result?.success) {
        throw new Error(
          result?.message || 'Failed to mark notifications as read.'
        );
      }

      setSuccessMessage(result.message || 'All notifications marked as read.');
      await fetchNotifications(1);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Something went wrong.';

      setErrorMessage(message);
    } finally {
      setActionLoading(false);
    }
  }

  const filteredNotifications = useMemo(() => {
    const value = searchTerm.trim().toLowerCase();

    if (!value) return notifications;

    return notifications.filter((notification) => {
      return (
        safeText(notification.title).toLowerCase().includes(value) ||
        safeText(notification.message).toLowerCase().includes(value) ||
        safeText(notification.type).toLowerCase().includes(value) ||
        safeText(notification.related_entity_type).toLowerCase().includes(value)
      );
    });
  }, [notifications, searchTerm]);

  useEffect(() => {
    fetchNotifications(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFilter]);

  return (
    <div className="space-y-8">
      <div className="rounded-3xl bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-600 p-6 text-white shadow-sm md:p-8">
        <div className="flex flex-col justify-between gap-6 xl:flex-row xl:items-center">
          <div>
            <p className="mb-3 inline-flex rounded-full bg-white/15 px-4 py-1 text-sm font-medium">
              Admin Notification Center
            </p>

            <h1 className="text-3xl font-black md:text-4xl">
              Notifications Center
            </h1>

            <p className="mt-4 max-w-3xl text-sm leading-7 text-emerald-50 md:text-base">
              Track verification updates, contribution alerts, payout activity,
              withdrawal requests, Fund Space changes, and important system
              messages from one place.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/admin"
                className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-emerald-700 hover:bg-emerald-50"
              >
                Admin Dashboard
                <ArrowRight size={16} />
              </Link>

              <Link
                href="/admin/verifications"
                className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-5 py-3 text-sm font-bold text-white ring-1 ring-white/20 hover:bg-white/20"
              >
                Verifications
                <ArrowRight size={16} />
              </Link>

              <Link
                href="/admin/fund-space"
                className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-5 py-3 text-sm font-bold text-white ring-1 ring-white/20 hover:bg-white/20"
              >
                Fund Space
                <ArrowRight size={16} />
              </Link>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => fetchNotifications(pagination.page)}
              disabled={loading}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white/15 px-5 py-3 text-sm font-bold text-white ring-1 ring-white/20 hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>

            <button
              type="button"
              onClick={markAllAsRead}
              disabled={actionLoading || stats.unread === 0}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <CheckCheck size={16} />
              Mark All Read
            </button>
          </div>
        </div>
      </div>

      {errorMessage && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-700">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {successMessage && (
        <div className="flex items-start gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <NotificationStatCard
          title="All Notifications"
          value={stats.all}
          icon={<Bell size={24} />}
          color="emerald"
        />

        <NotificationStatCard
          title="Unread"
          value={stats.unread}
          icon={<Clock size={24} />}
          color="amber"
        />

        <NotificationStatCard
          title="Read"
          value={stats.read}
          icon={<CheckCheck size={24} />}
          color="blue"
        />

        <NotificationStatCard
          title="Verification"
          value={stats.verification}
          icon={<ShieldCheck size={24} />}
          color="purple"
        />

        <NotificationStatCard
          title="Payout"
          value={stats.payout}
          icon={<HandCoins size={24} />}
          color="indigo"
        />

        <NotificationStatCard
          title="Contribution"
          value={stats.contribution}
          icon={<WalletCards size={24} />}
          color="amber"
        />

        <NotificationStatCard
          title="Withdrawal"
          value={stats.withdrawal}
          icon={<Wallet size={24} />}
          color="orange"
        />

        <NotificationStatCard
          title="Fund Space"
          value={stats.fund_space}
          icon={<Users size={24} />}
          color="teal"
        />
      </div>

      <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm md:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="text-xl font-black text-gray-900">
              Notification Records
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Search, filter, review, and mark admin notifications as read.
            </p>
          </div>

          <div className="relative w-full xl:w-96">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />

            <input
              type="text"
              placeholder="Search title, message, type..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="min-h-11 w-full rounded-xl border border-gray-200 py-3 pl-10 pr-4 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {filters.map((filter) => {
            const count = stats[filter.statKey] || 0;
            const active = selectedFilter === filter.value;

            return (
              <button
                key={filter.value}
                type="button"
                onClick={() => setSelectedFilter(filter.value)}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition ${
                  active
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {filter.label}
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    active
                      ? 'bg-white/20 text-white'
                      : 'bg-white text-gray-500'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-6">
          {loading ? (
            <div className="flex min-h-72 items-center justify-center">
              <div className="text-center">
                <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-emerald-600" />

                <p className="text-sm text-gray-500">
                  Loading notifications...
                </p>
              </div>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="rounded-2xl border border-gray-100 p-10 text-center">
              <Bell className="mx-auto mb-4 h-10 w-10 text-gray-300" />

              <h3 className="font-bold text-gray-900">
                No notifications found
              </h3>

              <p className="mt-2 text-sm text-gray-500">
                There are no notifications under this filter or search yet.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredNotifications.map((notification) => {
                const reviewLink = getNotificationLink(notification);
                const isRead = notification.is_read === true;
                const title = safeText(notification.title, 'Untitled notification');
                const message = safeText(
                  notification.message,
                  'No message was provided for this notification.'
                );
                const type = safeText(notification.type, 'INFO');
                const relatedEntityType = safeText(notification.related_entity_type);

                return (
                  <div
                    key={notification.id}
                    className={`rounded-3xl border p-4 shadow-sm transition ${
                      isRead
                        ? 'border-gray-100 bg-white'
                        : 'border-emerald-100 bg-emerald-50/40'
                    }`}
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div className="flex gap-4">
                        <div
                          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border ${getNotificationStyle(
                            notification
                          )}`}
                        >
                          {getNotificationIcon(notification)}
                        </div>

                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-bold text-gray-900">
                              {title}
                            </h3>

                            {!isRead && (
                              <span className="rounded-full bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white">
                                New
                              </span>
                            )}

                            <span className="rounded-full border border-gray-100 bg-gray-50 px-2.5 py-1 text-xs font-bold text-gray-600">
                              {type}
                            </span>

                            {relatedEntityType && (
                              <span className="rounded-full border border-gray-100 bg-white px-2.5 py-1 text-xs font-bold text-gray-500">
                                {relatedEntityType}
                              </span>
                            )}
                          </div>

                          <p className="mt-2 text-sm leading-6 text-gray-600">
                            {message}
                          </p>

                          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-gray-400">
                            <span>{formatDateTime(notification.created_at)}</span>

                            {notification.related_entity_id && (
                              <span className="rounded-full bg-gray-50 px-2 py-1 font-medium text-gray-500">
                                Ref: {notification.related_entity_id.slice(0, 8)}...
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex shrink-0 flex-wrap gap-2 md:justify-end">
                        {!isRead && (
                          <button
                            type="button"
                            onClick={() => markOneAsRead(notification.id)}
                            disabled={actionLoading}
                            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <Eye size={15} />
                            Mark Read
                          </button>
                        )}

                        {reviewLink && (
                          <Link
                            href={reviewLink.href}
                            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700"
                          >
                            {reviewLink.label}
                            <ArrowRight size={15} />
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="mt-6 flex flex-col items-center justify-between gap-3 border-t border-gray-100 pt-5 sm:flex-row">
          <p className="text-sm text-gray-500">
            Showing page {pagination.page} of {pagination.totalPages || 1} ·{' '}
            {pagination.total} total notification
            {pagination.total === 1 ? '' : 's'}
          </p>

          <div className="flex gap-2">
            <button
              type="button"
              disabled={pagination.page <= 1 || loading}
              onClick={() => fetchNotifications(pagination.page - 1)}
              className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>

            <button
              type="button"
              disabled={pagination.page >= pagination.totalPages || loading}
              onClick={() => fetchNotifications(pagination.page + 1)}
              className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function NotificationStatCard({
  title,
  value,
  icon,
  color,
}: {
  title: string;
  value: number;
  icon: ReactNode;
  color:
    | 'emerald'
    | 'amber'
    | 'blue'
    | 'purple'
    | 'indigo'
    | 'orange'
    | 'teal';
}) {
  const classes = {
    emerald: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    blue: 'bg-blue-50 text-blue-700',
    purple: 'bg-purple-50 text-purple-700',
    indigo: 'bg-indigo-50 text-indigo-700',
    orange: 'bg-orange-50 text-orange-700',
    teal: 'bg-teal-50 text-teal-700',
  };

  return (
    <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
      <div className={`mb-4 inline-flex rounded-2xl p-3 ${classes[color]}`}>
        {icon}
      </div>

      <p className="text-sm text-gray-500">{title}</p>

      <h3 className="mt-1 text-3xl font-black text-gray-900">
        {value}
      </h3>
    </div>
  );
}