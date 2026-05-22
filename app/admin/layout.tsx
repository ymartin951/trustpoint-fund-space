'use client';

import type { ReactNode } from 'react';

import { AuthProvider } from '@/contexts/AuthContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { DashboardLayout } from '@/components/DashboardLayout';

export default function AdminLayoutWrapper({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <AuthProvider>
      <ProtectedRoute requiredRoles={['SUPER_ADMIN', 'ADMIN']}>
        <DashboardLayout>{children}</DashboardLayout>
      </ProtectedRoute>
    </AuthProvider>
  );
}