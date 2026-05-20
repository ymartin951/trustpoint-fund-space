import { supabase } from './client';
import type { Database } from '@/lib/database.types';

export type Profile = Database['public']['Tables']['profiles']['Row'];

export type UserRole = 'USER' | 'AGENT' | 'ADMIN' | 'SUPER_ADMIN';

type CreateProfileData = {
  full_name: string;
  phone?: string | null;
  email?: string | null;
  location?: string | null;
  business_type?: string | null;
  role?: UserRole;
};

function normalizeRole(role: string | null | undefined): UserRole {
  const value = String(role || '').toUpperCase();

  if (value === 'SUPER_ADMIN') return 'SUPER_ADMIN';
  if (value === 'ADMIN') return 'ADMIN';
  if (value === 'AGENT') return 'AGENT';

  return 'USER';
}

export async function signInWithPhone(phone: string) {
  const { data, error } = await supabase.auth.signInWithOtp({
    phone,
    options: {
      channel: 'sms',
    },
  });

  return { data, error };
}

export async function verifyOTP(phone: string, token: string) {
  const { data, error } = await supabase.auth.verifyOtp({
    phone,
    token,
    type: 'sms',
  });

  return { data, error };
}

export async function signInWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  return { data, error };
}

export async function signUpWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  return { data, error };
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();

  return { error };
}

export async function getCurrentUser() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  return { user, error };
}

export async function getCurrentProfile(): Promise<Profile | null> {
  const { user } = await getCurrentUser();

  if (!user) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (error || !data) return null;

  return data;
}

export async function createProfile(
  userId: string,
  profileData: CreateProfileData
) {
  const { data, error } = await supabase
    .from('profiles')
    .insert({
      id: userId,
      full_name: profileData.full_name,
      phone: profileData.phone || null,
      email: profileData.email || null,
      location: profileData.location || null,
      business_type: profileData.business_type || null,
      role: normalizeRole(profileData.role),
      status: 'ACTIVE',
    })
    .select()
    .single();

  return { data, error };
}

export async function updateProfile(
  userId: string,
  updates: Database['public']['Tables']['profiles']['Update']
) {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single();

  return { data, error };
}

export function isAdmin(role: string | null | undefined): boolean {
  const normalizedRole = normalizeRole(role);

  return normalizedRole === 'ADMIN' || normalizedRole === 'SUPER_ADMIN';
}

export function isAgent(role: string | null | undefined): boolean {
  return normalizeRole(role) === 'AGENT';
}

export function isGroupAdmin(role: string | null | undefined): boolean {
  return isAdmin(role);
}

export function hasRole(
  userRole: string | null | undefined,
  requiredRoles: UserRole[]
): boolean {
  return requiredRoles.includes(normalizeRole(userRole));
}