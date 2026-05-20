'use client';

import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';

import { useAuth } from '@/contexts/AuthContext';

type AppRole = 'USER' | 'AGENT' | 'ADMIN' | 'SUPER_ADMIN';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRoles?: AppRole[];
  redirectTo?: string;
}

function normalizeRole(role: string | null | undefined): AppRole {
  const value = String(role || '').toUpperCase();

  if (value === 'SUPER_ADMIN') return 'SUPER_ADMIN';
  if (value === 'ADMIN') return 'ADMIN';
  if (value === 'AGENT') return 'AGENT';

  return 'USER';
}

export function ProtectedRoute({
  children,
  requiredRoles,
  redirectTo = '/auth/login',
}: ProtectedRouteProps) {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  const currentRole = normalizeRole(profile?.role);
  const isRoleAllowed = !requiredRoles || requiredRoles.includes(currentRole);
  const shouldBlockAccess = !user || !isRoleAllowed;

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.push(redirectTo);
      return;
    }

    if (!isRoleAllowed) {
      router.push('/dashboard');
    }
  }, [user, loading, redirectTo, router, isRoleAllowed]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-b-emerald-600" />
          <p className="text-sm font-semibold text-slate-500">
            Checking access...
          </p>
        </div>
      </div>
    );
  }

  if (shouldBlockAccess) {
    return null;
  }

  return <>{children}</>;
}