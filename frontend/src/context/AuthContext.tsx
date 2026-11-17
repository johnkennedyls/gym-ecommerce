import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { auth } from '../lib/api';
import { readSession, writeSession, type StoredSession } from '../lib/session';
import type { PublicUser, Role } from '../types/api';

type AuthState = {
  user: PublicUser | undefined;
  ready: boolean;
  isAuthenticated: boolean;
  hasRole: (...roles: Role[]) => boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: Parameters<typeof auth.register>[0]) => Promise<void>;
  logout: () => Promise<void>;
  patchUser: (user: PublicUser) => void;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<StoredSession | null>(() => readSession());
  const [ready, setReady] = useState(false);

  // El token guardado puede estar firmado por una sesión anterior: se valida contra la API.
  useEffect(() => {
    if (!session) {
      setReady(true);
      return;
    }
    let cancelled = false;
    auth
      .session()
      .then((current) => {
        if (cancelled) return;
        if (current.id !== session.user.id) {
          writeSession(null);
          setSession(null);
        } else {
          setSession({ ...session, user: current });
        }
      })
      .catch(() => {
        if (cancelled) return;
        writeSession(null);
        setSession(null);
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const sync = () => setSession(readSession());
    window.addEventListener('gymsoftware:session-changed', sync);
    return () => window.removeEventListener('gymsoftware:session-changed', sync);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setSession(await auth.login(email, password));
  }, []);

  const register = useCallback(async (input: Parameters<typeof auth.register>[0]) => {
    setSession(await auth.register(input));
  }, []);

  const logout = useCallback(async () => {
    const current = readSession();
    if (current) await auth.logout(current.refreshToken);
    writeSession(null);
    setSession(null);
  }, []);

  const patchUser = useCallback((user: PublicUser) => {
    setSession((current) => {
      if (!current) return current;
      const next = { ...current, user };
      writeSession(next);
      return next;
    });
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user: session?.user,
      ready,
      isAuthenticated: Boolean(session),
      hasRole: (...roles: Role[]) => Boolean(session && roles.includes(session.user.role)),
      login,
      register,
      logout,
      patchUser,
    }),
    [session, ready, login, register, logout, patchUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return context;
}
