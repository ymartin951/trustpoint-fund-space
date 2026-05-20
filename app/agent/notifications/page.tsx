"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  Bell,
  CheckCheck,
  CheckCircle2,
  Clock,
  Eye,
  Info,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  WalletCards,
  XCircle,
} from "lucide-react";

import { supabase } from "@/lib/supabase/client";

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
};

type NotificationStats = {
  all: number;
  unread: number;
  read: number;
};

type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

type FilterType = "ALL" | "UNREAD" | "READ";

const filters: { label: string; value: FilterType }[] = [
  { label: "All", value: "ALL" },
  { label: "Unread", value: "UNREAD" },
  { label: "Read", value: "READ" },
];

function formatDateTime(dateString: string | null | undefined) {
  if (!dateString) return "Not available";

  return new Date(dateString).toLocaleString("en-GH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getNotificationIcon(type: string, title: string) {
  const combined = `${type} ${title}`.toUpperCase();

  if (combined.includes("VERIFICATION") && combined.includes("APPROVED")) {
    return <ShieldCheck className="h-5 w-5" />;
  }

  if (combined.includes("VERIFICATION") && combined.includes("REJECTED")) {
    return <XCircle className="h-5 w-5" />;
  }

  if (combined.includes("PAYMENT") || combined.includes("PAYOUT")) {
    return <WalletCards className="h-5 w-5" />;
  }

  if (combined.includes("SUCCESS") || combined.includes("APPROVED")) {
    return <CheckCircle2 className="h-5 w-5" />;
  }

  if (combined.includes("ERROR") || combined.includes("REJECTED")) {
    return <AlertCircle className="h-5 w-5" />;
  }

  return <Info className="h-5 w-5" />;
}

function getNotificationStyle(type: string, title: string, isRead: boolean) {
  const combined = `${type} ${title}`.toUpperCase();

  if (!isRead) {
    if (combined.includes("APPROVED") || combined.includes("SUCCESS")) {
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    }

    if (combined.includes("REJECTED") || combined.includes("ERROR")) {
      return "border-red-200 bg-red-50 text-red-700";
    }

    if (combined.includes("PAYMENT") || combined.includes("PAYOUT")) {
      return "border-blue-200 bg-blue-50 text-blue-700";
    }

    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-gray-100 bg-gray-50 text-gray-500";
}

function getNotificationLink(notification: NotificationItem) {
  if (
    notification.related_entity_type === "customer" &&
    notification.related_entity_id
  ) {
    return `/agent/customers/${notification.related_entity_id}`;
  }

  return null;
}

export default function AgentNotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [stats, setStats] = useState<NotificationStats>({
    all: 0,
    unread: 0,
    read: 0,
  });
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });

  const [selectedFilter, setSelectedFilter] = useState<FilterType>("ALL");
  const [searchTerm, setSearchTerm] = useState("");

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  async function getAuthToken() {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error || !session?.access_token) {
      throw new Error("Your session has expired. Please log in again.");
    }

    return session.access_token;
  }

  async function fetchNotifications(page = 1) {
    try {
      setLoading(true);
      setErrorMessage("");
      setSuccessMessage("");

      const token = await getAuthToken();

      const params = new URLSearchParams({
        filter: selectedFilter,
        page: String(page),
        limit: String(pagination.limit),
      });

      const response = await fetch(`/api/agent/notifications?${params}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const responseText = await response.text();
      const result = responseText ? JSON.parse(responseText) : null;

      if (!response.ok || !result?.success) {
        throw new Error(result?.message || "Failed to load notifications.");
      }

      setNotifications(result.notifications || []);
      setStats(
        result.stats || {
          all: 0,
          unread: 0,
          read: 0,
        }
      );
      setPagination(
        result.pagination || {
          page,
          limit: 20,
          total: 0,
          totalPages: 1,
        }
      );
    } catch (error: any) {
      setErrorMessage(error?.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function markOneAsRead(notificationId: string) {
    try {
      setActionLoading(true);
      setErrorMessage("");
      setSuccessMessage("");

      const token = await getAuthToken();

      const response = await fetch("/api/agent/notifications", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "MARK_ONE_READ",
          notification_id: notificationId,
        }),
      });

      const responseText = await response.text();
      const result = responseText ? JSON.parse(responseText) : null;

      if (!response.ok || !result?.success) {
        throw new Error(result?.message || "Failed to update notification.");
      }

      setSuccessMessage("Notification marked as read.");
      await fetchNotifications(pagination.page);
    } catch (error: any) {
      setErrorMessage(error?.message || "Something went wrong.");
    } finally {
      setActionLoading(false);
    }
  }

  async function markAllAsRead() {
    try {
      setActionLoading(true);
      setErrorMessage("");
      setSuccessMessage("");

      const token = await getAuthToken();

      const response = await fetch("/api/agent/notifications", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "MARK_ALL_READ",
        }),
      });

      const responseText = await response.text();
      const result = responseText ? JSON.parse(responseText) : null;

      if (!response.ok || !result?.success) {
        throw new Error(
          result?.message || "Failed to mark notifications as read."
        );
      }

      setSuccessMessage("All notifications marked as read.");
      await fetchNotifications(1);
    } catch (error: any) {
      setErrorMessage(error?.message || "Something went wrong.");
    } finally {
      setActionLoading(false);
    }
  }

  const filteredNotifications = useMemo(() => {
    const value = searchTerm.trim().toLowerCase();

    if (!value) return notifications;

    return notifications.filter((notification) => {
      return (
        notification.title.toLowerCase().includes(value) ||
        notification.message.toLowerCase().includes(value) ||
        notification.type.toLowerCase().includes(value)
      );
    });
  }, [notifications, searchTerm]);

  useEffect(() => {
    fetchNotifications(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFilter]);

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="rounded-3xl bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-600 p-5 text-white shadow-sm md:p-8">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
          <div>
            <Link
              href="/agent"
              className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-xs font-semibold text-white hover:bg-white/20"
            >
              <ArrowLeft size={14} />
              Back to Agent Dashboard
            </Link>

            <p className="mb-3 inline-flex rounded-full bg-white/15 px-4 py-1 text-xs font-medium md:text-sm">
              Agent Notifications
            </p>

            <h1 className="text-2xl font-bold md:text-4xl">
              Notifications Center
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-7 text-emerald-50 md:text-base">
              Track customer verification updates, payment alerts, Fund Space
              updates, and important messages from TrustPoint.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => fetchNotifications(pagination.page)}
              disabled={loading}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>

            <button
              type="button"
              onClick={markAllAsRead}
              disabled={actionLoading || stats.unread === 0}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-950 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <CheckCheck size={16} />
              Mark All Read
            </button>
          </div>
        </div>
      </div>

      {errorMessage && (
        <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-700">
          {errorMessage}
        </div>
      )}

      {successMessage && (
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">
          {successMessage}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm md:p-6">
          <div className="mb-4 inline-flex rounded-2xl bg-emerald-50 p-3 text-emerald-700">
            <Bell size={24} />
          </div>
          <p className="text-sm text-gray-500">All Notifications</p>
          <h3 className="mt-1 text-3xl font-black text-gray-900">
            {stats.all}
          </h3>
        </div>

        <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm md:p-6">
          <div className="mb-4 inline-flex rounded-2xl bg-amber-50 p-3 text-amber-700">
            <Clock size={24} />
          </div>
          <p className="text-sm text-gray-500">Unread</p>
          <h3 className="mt-1 text-3xl font-black text-gray-900">
            {stats.unread}
          </h3>
        </div>

        <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm md:p-6">
          <div className="mb-4 inline-flex rounded-2xl bg-blue-50 p-3 text-blue-700">
            <CheckCheck size={24} />
          </div>
          <p className="text-sm text-gray-500">Read</p>
          <h3 className="mt-1 text-3xl font-black text-gray-900">
            {stats.read}
          </h3>
        </div>
      </div>

      <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm md:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {filters.map((filter) => (
              <button
                key={filter.value}
                onClick={() => setSelectedFilter(filter.value)}
                className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
                  selectedFilter === filter.value
                    ? "bg-emerald-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>

          <div className="relative w-full lg:w-96">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />

            <input
              type="text"
              placeholder="Search notifications..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="min-h-12 w-full rounded-xl border border-gray-200 py-3 pl-10 pr-4 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
          </div>
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
            <div className="rounded-2xl border border-gray-100 p-8 text-center">
              <Bell className="mx-auto mb-4 h-10 w-10 text-gray-300" />
              <h3 className="font-bold text-gray-900">
                No notifications found
              </h3>
              <p className="mt-2 text-sm text-gray-500">
                You do not have notifications under this filter yet.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredNotifications.map((notification) => {
                const customerLink = getNotificationLink(notification);

                return (
                  <div
                    key={notification.id}
                    className={`rounded-3xl border p-4 shadow-sm transition ${
                      notification.is_read
                        ? "border-gray-100 bg-white"
                        : "border-emerald-100 bg-emerald-50/40"
                    }`}
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div className="flex gap-4">
                        <div
                          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border ${getNotificationStyle(
                            notification.type,
                            notification.title,
                            notification.is_read
                          )}`}
                        >
                          {getNotificationIcon(
                            notification.type,
                            notification.title
                          )}
                        </div>

                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-bold text-gray-900">
                              {notification.title}
                            </h3>

                            {!notification.is_read && (
                              <span className="rounded-full bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white">
                                New
                              </span>
                            )}

                            <span className="rounded-full border border-gray-100 bg-gray-50 px-2.5 py-1 text-xs font-bold text-gray-600">
                              {notification.type || "INFO"}
                            </span>
                          </div>

                          <p className="mt-2 text-sm leading-6 text-gray-600">
                            {notification.message}
                          </p>

                          <p className="mt-2 text-xs text-gray-400">
                            {formatDateTime(notification.created_at)}
                          </p>
                        </div>
                      </div>

                      <div className="flex shrink-0 flex-wrap gap-2 md:justify-end">
                        {!notification.is_read && (
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

                        {customerLink && (
                          <Link
                            href={customerLink}
                            className="inline-flex min-h-10 items-center justify-center rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700"
                          >
                            View Customer
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
            Showing page {pagination.page} of {pagination.totalPages || 1} ·{" "}
            {pagination.total} total notifications
          </p>

          <div className="flex gap-2">
            <button
              disabled={pagination.page <= 1 || loading}
              onClick={() => fetchNotifications(pagination.page - 1)}
              className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>

            <button
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