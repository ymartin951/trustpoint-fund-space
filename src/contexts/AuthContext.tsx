'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase/client';
import type { Database } from '@/lib/database.types';

export type Profile = Database['public']['Tables']['profiles']['Row'];

type AuthContextType = {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  authError: string | null;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

type ProfileQueryResult = {
  data: Profile | null;
  error: {
    message?: string;
  } | null;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const SESSION_TIMEOUT_MS = 8000;
const PROFILE_TIMEOUT_MS = 8000;

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string'
  ) {
    return error.message;
  }

  return fallback;
}

async function withTimeout<T>({
  task,
  timeoutMs,
  timeoutMessage,
}: {
  task: () => PromiseLike<T>;
  timeoutMs: number;
  timeoutMessage: string;
}): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(timeoutMessage));
    }, timeoutMs);
  });

  try {
    return await Promise.race([Promise.resolve(task()), timeoutPromise]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const mountedRef = useRef(false);
  const authSequenceRef = useRef(0);

  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const clearAuthState = useCallback(() => {
    setUser(null);
    setSession(null);
    setProfile(null);
  }, []);

  const loadProfile = useCallback(async (userId: string) => {
    const result = await withTimeout<ProfileQueryResult>({
      task: () =>
        supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle() as unknown as PromiseLike<ProfileQueryResult>,
      timeoutMs: PROFILE_TIMEOUT_MS,
      timeoutMessage:
        'Profile loading took too long. Please refresh or log in again.',
    });

    if (result.error) {
      throw new Error(result.error.message || 'Unable to load profile.');
    }

    return result.data;
  }, []);

  const applySession = useCallback(
    async (currentSession: Session | null) => {
      const sequence = ++authSequenceRef.current;

      setAuthError(null);
      setSession(currentSession);
      setUser(currentSession?.user ?? null);

      if (!currentSession?.user?.id) {
        setProfile(null);
        return;
      }

      try {
        const loadedProfile = await loadProfile(currentSession.user.id);

        if (!mountedRef.current || sequence !== authSequenceRef.current) {
          return;
        }

        if (!loadedProfile) {
          setProfile(null);
          setAuthError(
            'Your account profile could not be found. Please contact TrustPoint support.'
          );
          return;
        }

        setProfile(loadedProfile);
      } catch (error) {
        if (!mountedRef.current || sequence !== authSequenceRef.current) {
          return;
        }

        console.error('Load profile error:', error);

        setProfile(null);
        setAuthError(
          getErrorMessage(
            error,
            'Unable to load your profile. Please refresh or log in again.'
          )
        );
      }
    },
    [loadProfile]
  );

  const refreshProfile = useCallback(async () => {
    if (!user?.id) {
      setProfile(null);
      return;
    }

    try {
      setAuthError(null);

      const loadedProfile = await loadProfile(user.id);

      if (!mountedRef.current) return;

      setProfile(loadedProfile);
    } catch (error) {
      if (!mountedRef.current) return;

      console.error('Refresh profile error:', error);

      setProfile(null);
      setAuthError(
        getErrorMessage(
          error,
          'Unable to refresh your profile. Please try again.'
        )
      );
    }
  }, [loadProfile, user?.id]);

  const signOut = useCallback(async () => {
    try {
      setLoading(true);
      setAuthError(null);

      await supabase.auth.signOut();
    } catch (error) {
      console.error('Sign out error:', error);
    } finally {
      if (!mountedRef.current) return;

      ++authSequenceRef.current;
      clearAuthState();
      setLoading(false);
    }
  }, [clearAuthState]);

  useEffect(() => {
    mountedRef.current = true;

    let fallbackTimer: ReturnType<typeof setTimeout> | null = null;

    async function initializeAuth() {
      try {
        setLoading(true);
        setAuthError(null);

        const result = await withTimeout<{
          data: {
            session: Session | null;
          };
          error: {
            message?: string;
          } | null;
        }>({
          task: () => supabase.auth.getSession(),
          timeoutMs: SESSION_TIMEOUT_MS,
          timeoutMessage:
            'Session check took too long. Please refresh or log in again.',
        });

        if (!mountedRef.current) return;

        if (result.error) {
          console.error('Get session error:', result.error);
          clearAuthState();
          setAuthError(result.error.message || 'Unable to restore session.');
          return;
        }

        await applySession(result.data.session);
      } catch (error) {
        if (!mountedRef.current) return;

        console.error('Initialize auth error:', error);

        clearAuthState();
        setAuthError(
          getErrorMessage(
            error,
            'Unable to restore your session. Please log in again.'
          )
        );
      } finally {
        if (mountedRef.current) {
          setLoading(false);
        }
      }
    }

    initializeAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      if (!mountedRef.current) return;

      setLoading(true);

      Promise.resolve()
        .then(() => applySession(currentSession))
        .catch((error) => {
          if (!mountedRef.current) return;

          console.error('Auth state change error:', error);

          clearAuthState();
          setAuthError(
            getErrorMessage(
              error,
              'Unable to update your session. Please refresh or log in again.'
            )
          );
        })
        .finally(() => {
          if (mountedRef.current) {
            setLoading(false);
          }
        });
    });

    fallbackTimer = setTimeout(() => {
      if (!mountedRef.current) return;

      setLoading(false);
    }, SESSION_TIMEOUT_MS + PROFILE_TIMEOUT_MS + 2000);

    return () => {
      mountedRef.current = false;

      if (fallbackTimer) {
        clearTimeout(fallbackTimer);
      }

      subscription.unsubscribe();
    };
  }, [applySession, clearAuthState]);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        loading,
        authError,
        refreshProfile,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}