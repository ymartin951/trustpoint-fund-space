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

function normalizeRole(role: string | null | undefined): AppRole | null {
  const value = String(role || '').toUpperCase();

  if (value === 'SUPER_ADMIN') return 'SUPER_ADMIN';
  if (value === 'ADMIN') return 'ADMIN';
  if (value === 'AGENT') return 'AGENT';
  if (value === 'USER') return 'USER';

  return null;
}

function getRoleHomePath(role: AppRole | null) {
  if (role === 'SUPER_ADMIN' || role === 'ADMIN') {
    return '/admin';
  }

  if (role === 'AGENT') {
    return '/agent';
  }

  return '/dashboard';
}

export function ProtectedRoute({
  children,
  requiredRoles,
  redirectTo = '/auth/login',
}: ProtectedRouteProps) {
  const { user, profile, loading, authError } = useAuth();
  const router = useRouter();

  const currentRole = normalizeRole(profile?.role);

  const waitingForProfile = Boolean(user) && !profile && !authError;

  const isRoleAllowed =
    !requiredRoles || Boolean(currentRole && requiredRoles.includes(currentRole));

  useEffect(() => {
    if (loading || waitingForProfile) return;

    if (!user) {
      router.replace(redirectTo);
      return;
    }

    if (!profile || authError) {
      router.replace('/auth/login');
      return;
    }

    if (!isRoleAllowed) {
      router.replace(getRoleHomePath(currentRole));
    }
  }, [
    user,
    profile,
    loading,
    authError,
    waitingForProfile,
    redirectTo,
    router,
    isRoleAllowed,
    currentRole,
  ]);

  if (loading || waitingForProfile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4 rounded-3xl border border-slate-100 bg-white p-8 shadow-sm">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-b-emerald-600" />
          <div className="text-center">
            <p className="text-sm font-bold text-slate-700">
              Checking access...
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Please wait while we confirm your account.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!user || !profile || authError) {
    return null;
  }

  if (!isRoleAllowed) {
    return null;
  }

  return <>{children}</>;
}