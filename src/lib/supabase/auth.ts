import { supabase } from './client';
import { Profile, UserRole } from './types';

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
  const { data: { user }, error } = await supabase.auth.getUser();
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

export async function createProfile(userId: string, profileData: {
  full_name: string;
  phone: string;
  email?: string;
  location?: string;
  business_type?: string;
  role?: UserRole;
}) {
  const { data, error } = await supabase
    .from('profiles')
    .insert({
      id: userId,
      full_name: profileData.full_name,
      phone: profileData.phone,
      email: profileData.email || null,
      location: profileData.location || null,
      business_type: profileData.business_type || null,
      role: profileData.role || 'USER',
      status: 'ACTIVE',
    })
    .select()
    .single();

  return { data, error };
}

export async function updateProfile(userId: string, updates: Partial<Profile>) {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single();

  return { data, error };
}

export function isAdmin(role: UserRole): boolean {
  return role === 'SUPER_ADMIN';
}

export function isAgent(role: UserRole): boolean {
  return role === 'AGENT';
}

export function isGroupAdmin(role: UserRole): boolean {
  return role === 'GROUP_ADMIN' || role === 'SUPER_ADMIN';
}

export function hasRole(userRole: UserRole, requiredRoles: UserRole[]): boolean {
  return requiredRoles.includes(userRole);
}
