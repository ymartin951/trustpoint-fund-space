'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Bell } from 'lucide-react';

import { supabase } from '@/lib/supabase/client';

type UnreadCountResponse = {
  success: boolean;
  message?: string;
  unread_count?: number;
};

export default function NotificationBellLink({
  href,
  label = 'Notifications',
  className = '',
  iconClassName = 'h-5 w-5',
  showText = true,
}: {
  href: string;
  label?: string;
  className?: string;
  iconClassName?: string;
  showText?: boolean;
}) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const accessTokenRef = useRef<string | null>(null);

  const loadUnreadCount = useCallback(async () => {
    try {
      const token = accessTokenRef.current;

      if (!token) return;

      const response = await fetch('/api/notifications/unread-count', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const result = (await response.json()) as UnreadCountResponse;

      if (!response.ok || !result.success) {
        setUnreadCount(0);
        return;
      }

      setUnreadCount(Number(result.unread_count || 0));
    } catch {
      setUnreadCount(0);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const setup = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!mounted) return;

      if (!session?.user?.id || !session.access_token) {
        setUserId(null);
        setUnreadCount(0);
        return;
      }

      accessTokenRef.current = session.access_token;
      setUserId(session.user.id);

      await loadUnreadCount();
    };

    setup();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      accessTokenRef.current = session?.access_token || null;
      setUserId(session?.user?.id || null);

      if (!session?.user?.id) {
        setUnreadCount(0);
        return;
      }

      loadUnreadCount();
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadUnreadCount]);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`notification-badge-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          loadUnreadCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, loadUnreadCount]);

  return (
    <Link
      href={href}
      className={`relative inline-flex items-center gap-2 ${className}`}
      aria-label={
        unreadCount > 0
          ? `${label}. ${unreadCount} unread notification${
              unreadCount === 1 ? '' : 's'
            }`
          : label
      }
    >
      <span className="relative inline-flex">
        <Bell className={iconClassName} />

        {unreadCount > 0 && (
          <span className="absolute -right-2 -top-2 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[10px] font-black leading-none text-white ring-2 ring-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </span>

      {showText && <span>{label}</span>}
    </Link>
  );
}