'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  AlertCircle,
  ArrowLeft,
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

type MessageState = {
  type: 'success' | 'error' | 'info';
  text: string;
};

type StatCardItem = {
  title: string;
  value: number;
  description: string;
  icon: ReactNode;
  href: string;
  tone: 'emerald' | 'amber' | 'red' | 'blue' | 'indigo' | 'gray';
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
  { label: 'Read', value: 'READ', statKey: 'read' },
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

const allowedFilters: AdminNotificationFilter[] = [
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

function normalize(value: string | null | undefined) {
  return String(value || '').trim().toUpperCase();
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return 'Not available';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return 'Invalid date';

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

function getNotificationCategoryLabel(category: string | null | undefined) {
  const value = normalize(category);

  if (value === 'MANUAL_PAYMENT') return 'MoMo Payment';
  if (value === 'AWAITING_REVIEW') return 'Payment Review';
  if (value === 'REJECTED_PAYMENT') return 'Rejected MoMo';
  if (value === 'APPROVED_PAYMENT') return 'Approved MoMo';
  if (value === 'PAYOUT') return 'Payout Alert';
  if (value === 'VERIFICATION') return 'Verification';
  if (value === 'FUND_SPACE') return 'Fund Space';
  if (value === 'GENERAL') return 'System Alert';

  return formatLabel(category);
}

function getNotificationSourceLabel(source: AdminNotificationItem['source']) {
  if (source === 'MANUAL_PAYMENT_SYSTEM') return 'MoMo payment system';

  return 'Database notification';
}

function getActionLabel(label: string | null | undefined) {
  const value = String(label || '').trim();

  if (!value) return 'Open';

  return value
    .replaceAll('Manual Payment', 'MoMo Payment')
    .replaceAll('Manual MoMo', 'MoMo Payment')
    .replaceAll('Manual payment', 'MoMo payment')
    .replaceAll('manual payment', 'MoMo payment')
    .replaceAll('Manual', 'MoMo');
}

function getNotificationTitle(item: AdminNotificationItem) {
  const category = normalize(item.category);

  if (category === 'AWAITING_REVIEW') return 'MoMo Payment Awaiting Review';
  if (category === 'REJECTED_PAYMENT') return 'MoMo Payment Rejected';
  if (category === 'APPROVED_PAYMENT') return 'MoMo Payment Approved';
  if (category === 'MANUAL_PAYMENT') return 'MoMo Payment Alert';
  if (category === 'PAYOUT') return 'Payout Alert';
  if (category === 'VERIFICATION') return 'Verification Alert';
  if (category === 'FUND_SPACE') return 'Fund Space Alert';

  return item.title
    .replaceAll('Manual Payment', 'MoMo Payment')
    .replaceAll('Manual MoMo', 'MoMo Payment')
    .replaceAll('Manual payment', 'MoMo payment')
    .replaceAll('manual payment', 'MoMo payment')
    .replaceAll('Manual', 'MoMo');
}

function getNotificationMessage(item: AdminNotificationItem) {
  const category = normalize(item.category);

  if (category === 'AWAITING_REVIEW') {
    return 'A MoMo payment reference has been submitted and is waiting for admin review.';
  }

  if (category === 'REJECTED_PAYMENT') {
    return (
      item.rejection_reason ||
      'A MoMo payment reference was reviewed and rejected.'
    );
  }

  if (category === 'APPROVED_PAYMENT') {
    return 'A MoMo payment has been reviewed, approved, and recorded successfully.';
  }

  if (category === 'MANUAL_PAYMENT') {
    return 'A MoMo payment activity has been recorded for Fund Space review.';
  }

  return item.message
    .replaceAll('manual MoMo payment submissions', 'MoMo payment submissions')
    .replaceAll('manual MoMo payment', 'MoMo payment')
    .replaceAll('Manual MoMo payment', 'MoMo payment')
    .replaceAll('manual payment', 'MoMo payment')
    .replaceAll('Manual payment', 'MoMo payment')
    .replaceAll('manual', 'MoMo')
    .replaceAll('Manual', 'MoMo');
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
    return 'border-slate-200 bg-slate-50 text-slate-600';
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

  return 'border-slate-200 bg-white text-slate-700';
}

function getPriorityStyle(priority: AdminNotificationItem['priority']) {
  if (priority === 'HIGH') {
    return 'border-red-100 bg-red-50 text-red-700';
  }

  if (priority === 'MEDIUM') {
    return 'border-amber-100 bg-amber-50 text-amber-700';
  }

  return 'border-slate-100 bg-slate-50 text-slate-600';
}

function buildFilterUrl(filter: AdminNotificationFilter) {
  return `/admin/notifications?filter=${encodeURIComponent(filter)}`;
}

function getFilterFromSearchParams(searchParams: { get: (key: string) => string | null }) {
  const value = normalize(searchParams.get('filter'));

  return allowedFilters.includes(value as AdminNotificationFilter)
    ? (value as AdminNotificationFilter)
    : 'ALL';
}

async function readApiJson(response: Response): Promise<ApiResponse> {
  const text = await response.text();

  if (!text) {
    return {
      success: false,
      message: 'The server returned an empty response.',
    };
  }

  try {
    return JSON.parse(text) as ApiResponse;
  } catch {
    return {
      success: false,
      message: 'The server returned an invalid response.',
    };
  }
}

function StatCard({ item }: { item: StatCardItem }) {
  const styles = {
    emerald:
      'bg-emerald-50 text-emerald-700 group-hover:bg-emerald-600 group-hover:text-white',
    amber:
      'bg-amber-50 text-amber-700 group-hover:bg-amber-500 group-hover:text-white',
    red: 'bg-red-50 text-red-700 group-hover:bg-red-600 group-hover:text-white',
    blue: 'bg-blue-50 text-blue-700 group-hover:bg-blue-600 group-hover:text-white',
    indigo:
      'bg-indigo-50 text-indigo-700 group-hover:bg-indigo-600 group-hover:text-white',
    gray: 'bg-slate-50 text-slate-700 group-hover:bg-slate-900 group-hover:text-white',
  };

  return (
    <Link
      href={item.href}
      className="group block min-w-0 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md"
    >
      <div className="flex min-w-0 items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="min-w-0 break-words text-sm font-black text-slate-500 [overflow-wrap:anywhere]">
            {item.title}
          </p>

          <h3 className="mt-2 min-w-0 break-words text-[clamp(1.5rem,5vw,2rem)] font-black leading-tight text-slate-900 [overflow-wrap:anywhere]">
            {item.value}
          </h3>

          <p className="mt-1 min-w-0 break-words text-sm leading-6 text-slate-500 [overflow-wrap:anywhere]">
            {item.description}
          </p>

          <p className="mt-3 inline-flex items-center gap-1 text-xs font-black text-emerald-700 opacity-0 transition group-hover:opacity-100">
            Open filtered view <ArrowRight className="h-3.5 w-3.5" />
          </p>
        </div>

        <div className={`shrink-0 rounded-2xl p-3 transition ${styles[item.tone]}`}>
          {item.icon}
        </div>
      </div>
    </Link>
  );
}

function MessageBox({ message }: { message: MessageState }) {
  return (
    <div
      className={`flex items-start gap-3 rounded-3xl border p-5 ${
        message.type === 'success'
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
          : message.type === 'info'
            ? 'border-blue-200 bg-blue-50 text-blue-700'
            : 'border-red-200 bg-red-50 text-red-700'
      }`}
    >
      {message.type === 'success' ? (
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
      ) : message.type === 'info' ? (
        <Info className="mt-0.5 h-5 w-5 shrink-0" />
      ) : (
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
      )}

      <p className="min-w-0 break-words text-sm font-bold leading-6 [overflow-wrap:anywhere]">
        {message.text}
      </p>
    </div>
  );
}

function MiniInfo({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-2xl bg-white/75 p-4">
      <p className="break-words text-xs font-black uppercase tracking-wide text-slate-400 [overflow-wrap:anywhere]">
        {label}
      </p>

      <div className="mt-1 min-w-0 break-words text-sm font-black text-slate-900 [overflow-wrap:anywhere]">
        {value || 'Not set'}
      </div>
    </div>
  );
}

export default function AdminNotificationsPage() {
  const searchParams = useSearchParams();

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
  const [message, setMessage] = useState<MessageState | null>(null);

  const queryFilter = useMemo(() => {
    return getFilterFromSearchParams(searchParams);
  }, [searchParams]);

  const statCards: StatCardItem[] = [
    {
      title: 'Awaiting MoMo Review',
      value: stats.awaiting_review,
      description: 'Payment references waiting for admin confirmation',
      icon: <Clock className="h-5 w-5" />,
      href: buildFilterUrl('AWAITING_REVIEW'),
      tone: 'amber',
    },
    {
      title: 'MoMo Payment Alerts',
      value: stats.manual_payment,
      description: 'All MoMo payment system alerts',
      icon: <Smartphone className="h-5 w-5" />,
      href: buildFilterUrl('MANUAL_PAYMENT'),
      tone: 'emerald',
    },
    {
      title: 'Rejected MoMo',
      value: stats.rejected_payment,
      description: 'Rejected MoMo payment records',
      icon: <XCircle className="h-5 w-5" />,
      href: buildFilterUrl('REJECTED_PAYMENT'),
      tone: 'red',
    },
    {
      title: 'Unread',
      value: stats.unread,
      description: 'Unread database notifications',
      icon: <Bell className="h-5 w-5" />,
      href: buildFilterUrl('UNREAD'),
      tone: 'blue',
    },
    {
      title: 'Approved MoMo',
      value: stats.approved_payment,
      description: 'Confirmed MoMo payment records',
      icon: <CheckCircle2 className="h-5 w-5" />,
      href: buildFilterUrl('APPROVED_PAYMENT'),
      tone: 'emerald',
    },
    {
      title: 'Payout Alerts',
      value: stats.payout,
      description: 'Payout related admin notifications',
      icon: <HandCoins className="h-5 w-5" />,
      href: buildFilterUrl('PAYOUT'),
      tone: 'indigo',
    },
    {
      title: 'Verifications',
      value: stats.verification,
      description: 'Customer and account verification alerts',
      icon: <ShieldCheck className="h-5 w-5" />,
      href: buildFilterUrl('VERIFICATION'),
      tone: 'blue',
    },
    {
      title: 'Fund Space',
      value: stats.fund_space,
      description: 'Round, contribution, and group alerts',
      icon: <Users className="h-5 w-5" />,
      href: buildFilterUrl('FUND_SPACE'),
      tone: 'gray',
    },
  ];

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

        const result = await readApiJson(response);

        if (!response.ok || !result.success) {
          throw new Error(result.message || 'Could not load notifications.');
        }

        setNotifications(result.notifications || []);
        setStats(result.stats || defaultStats);
        setPagination(result.pagination || defaultPagination);
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
            'This is a live MoMo payment alert. Open the MoMo Reviews page to manage it.',
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

      const result = await readApiJson(response);

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

      const result = await readApiJson(response);

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Could not mark all notifications as read.');
      }

      setMessage({
        type: 'success',
        text: result.message || 'All database notifications marked as read.',
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
    <main className="min-h-screen bg-slate-50 px-4 py-5 md:px-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <Link
            href="/admin"
            className="inline-flex min-h-11 w-fit items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-100"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Admin Control Center
          </Link>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => fetchNotifications(pagination.page)}
              disabled={loading}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
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
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-4 text-sm font-black text-white shadow-sm transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <CheckCheck className="h-4 w-4" />
              Mark Database Alerts Read
            </button>
          </div>
        </div>

        <section className="overflow-hidden rounded-[2rem] bg-gradient-to-br from-emerald-950 via-emerald-900 to-emerald-800 text-white shadow-sm">
          <div className="p-5 md:p-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <p className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-xs font-black">
                  <Bell className="h-4 w-4" />
                  Admin Action Center
                </p>

                <h1 className="mt-5 break-words text-3xl font-black tracking-tight md:text-5xl">
                  Notifications & MoMo Payment Alerts
                </h1>

                <p className="mt-4 max-w-3xl break-words text-sm font-semibold leading-7 text-emerald-50 md:text-base">
                  Monitor admin notifications, MoMo payment submissions, rejected
                  payment records, approved payments, payout alerts, verification
                  alerts, and Fund Space updates from one place.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Link
                  href="/admin/manual-payment-submissions"
                  className="inline-flex min-h-9 items-center justify-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 text-xs font-black text-white ring-1 ring-white/10 transition hover:bg-white/20"
                >
                  MoMo Reviews
                </Link>

                <Link
                  href="/admin/fund-space/payouts"
                  className="inline-flex min-h-9 items-center justify-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 text-xs font-black text-white ring-1 ring-white/10 transition hover:bg-white/20"
                >
                  Payouts
                </Link>

                <Link
                  href="/admin/verifications"
                  className="inline-flex min-h-9 items-center justify-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 text-xs font-black text-white ring-1 ring-white/10 transition hover:bg-white/20"
                >
                  Verifications
                </Link>
              </div>
            </div>
          </div>
        </section>

        {message && <MessageBox message={message} />}

        <section className="grid auto-rows-fr gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {statCards.map((item) => (
            <StatCard key={item.title} item={item} />
          ))}
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="relative w-full xl:max-w-md">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    submitSearch();
                  }
                }}
                placeholder="Search customer, phone, reference, Fund Space..."
                className="min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm font-semibold outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-100"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {filters.map((filter) => (
                <button
                  key={filter.value}
                  type="button"
                  onClick={() => updateFilter(filter.value)}
                  className={`min-h-10 rounded-2xl px-4 text-sm font-black transition ${
                    activeFilter === filter.value
                      ? 'bg-emerald-700 text-white shadow-sm hover:bg-emerald-800'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <span className="break-words">{filter.label}</span>{' '}
                  <span className="ml-1 opacity-75">
                    {stats[filter.statKey] || 0}
                  </span>
                </button>
              ))}

              <button
                type="button"
                onClick={submitSearch}
                className="min-h-10 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 transition hover:bg-slate-50"
              >
                Search
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          {loading ? (
            <div className="flex min-h-[300px] flex-col items-center justify-center gap-3 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
              </div>

              <p className="text-sm font-semibold text-slate-500">
                Loading admin notifications...
              </p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex min-h-[300px] flex-col items-center justify-center gap-3 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-50">
                <Bell className="h-8 w-8 text-slate-400" />
              </div>

              <h2 className="text-lg font-black text-slate-900">
                No notifications found
              </h2>

              <p className="max-w-md text-sm leading-6 text-slate-500">
                Try another filter or search term. New MoMo payment alerts
                awaiting admin review will appear here automatically.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {notifications.map((notification) => {
                const style = getNotificationStyle(notification);
                const priorityStyle = getPriorityStyle(notification.priority);
                const isMoMoPayment =
                  notification.source === 'MANUAL_PAYMENT_SYSTEM';

                return (
                  <div key={notification.id} className="py-5 first:pt-0 last:pb-0">
                    <article
                      className={`rounded-3xl border p-5 transition hover:shadow-sm ${style}`}
                    >
                      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                        <div className="flex min-w-0 flex-1 gap-4">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/80 shadow-sm">
                            {getNotificationIcon(notification)}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="break-words text-lg font-black text-slate-900 [overflow-wrap:anywhere]">
                                {getNotificationTitle(notification)}
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

                              <span className="rounded-full border border-slate-100 bg-white px-2.5 py-1 text-xs font-black text-slate-600">
                                {getNotificationCategoryLabel(
                                  notification.category
                                )}
                              </span>

                              {isMoMoPayment && (
                                <span className="rounded-full border border-emerald-100 bg-white px-2.5 py-1 text-xs font-black text-emerald-700">
                                  Live MoMo Alert
                                </span>
                              )}
                            </div>

                            <p className="mt-2 break-words text-sm leading-6 text-slate-700 [overflow-wrap:anywhere]">
                              {getNotificationMessage(notification)}
                            </p>

                            {isMoMoPayment && (
                              <div className="mt-4 grid gap-3 rounded-2xl bg-white/70 p-4 text-sm text-slate-700 md:grid-cols-2 xl:grid-cols-4">
                                <MiniInfo
                                  label="Customer"
                                  value={
                                    <>
                                      <span>{notification.customer_name || 'Unknown'}</span>
                                      <span className="mt-1 block text-xs font-semibold text-slate-500">
                                        {notification.customer_phone || 'No phone'}
                                      </span>
                                    </>
                                  }
                                />

                                <MiniInfo
                                  label="Fund Space"
                                  value={
                                    <>
                                      <span>
                                        {notification.fund_space_name || 'Not set'}
                                      </span>
                                      <span className="mt-1 block text-xs font-semibold text-slate-500">
                                        Agent:{' '}
                                        {notification.agent_name || 'Not assigned'}
                                      </span>
                                    </>
                                  }
                                />

                                <MiniInfo
                                  label="Amount Submitted"
                                  value={
                                    <>
                                      <span>
                                        {formatMoney(
                                          notification.total_amount_paid
                                        )}
                                      </span>
                                      <span className="mt-1 block text-xs font-semibold text-slate-500">
                                        Due: {formatMoney(notification.amount_due)} •
                                        Fee: {formatMoney(notification.service_fee)}
                                      </span>
                                    </>
                                  }
                                />

                                <MiniInfo
                                  label="Reference"
                                  value={
                                    <>
                                      <span>
                                        {notification.transaction_reference ||
                                          'Not provided'}
                                      </span>
                                      <span className="mt-1 block text-xs font-semibold text-slate-500">
                                        Status:{' '}
                                        {formatLabel(
                                          notification.manual_payment_status
                                        )}
                                      </span>
                                    </>
                                  }
                                />
                              </div>
                            )}

                            {notification.rejection_reason && (
                              <div className="mt-4 rounded-2xl border border-red-100 bg-white/70 p-4 text-sm text-red-700">
                                <p className="font-black">Rejection reason</p>
                                <p className="mt-1 break-words leading-6 [overflow-wrap:anywhere]">
                                  {notification.rejection_reason}
                                </p>
                              </div>
                            )}

                            <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                              <span>{formatDateTime(notification.created_at)}</span>

                              <span>
                                Source: {getNotificationSourceLabel(notification.source)}
                              </span>

                              {notification.related_entity_id && (
                                <span className="rounded-full bg-white px-2 py-1 font-semibold">
                                  Ref: {notification.related_entity_id.slice(0, 8)}
                                  ...
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
                                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                <Eye className="h-4 w-4" />
                                Mark Read
                              </button>
                            )}

                          {isMoMoPayment && (
                            <Link
                              href="/admin/manual-payment-submissions"
                              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 hover:bg-slate-50"
                            >
                              <FileCheck2 className="h-4 w-4" />
                              MoMo Reviews
                            </Link>
                          )}

                          <Link
                            href={notification.action_href}
                            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-4 py-2 text-sm font-black text-white hover:bg-emerald-800"
                          >
                            <span className="break-words [overflow-wrap:anywhere]">
                              {getActionLabel(notification.action_label)}
                            </span>
                            <ArrowRight className="h-4 w-4 shrink-0" />
                          </Link>
                        </div>
                      </div>
                    </article>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-6 flex flex-col items-center justify-between gap-3 border-t border-slate-100 pt-5 sm:flex-row">
            <p className="break-words text-sm text-slate-500">
              Showing page {pagination.page} of {pagination.totalPages || 1} •{' '}
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
                className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-black text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
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
                className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-black text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}