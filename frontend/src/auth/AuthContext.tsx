import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ApiError, api, sessionToken, type User } from '../api/client';

interface AuthState {
  /** The logged-in user, or null for visitors. */
  user: User | null;
  /** True while a stored session is being checked on startup. */
  loading: boolean;
  login(email: string, password: string): Promise<void>;
  /** Creates the account and logs in (accounts are active as soon as they are created). */
  register(email: string, password: string): Promise<void>;
  logout(): Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

/** Current user for the whole app (docs/17-CUENTAS-DE-USUARIO.md). Accounts are optional. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(() => sessionToken.get() !== null);

  // A stored token may have expired or been closed elsewhere: ask the API who it belongs to.
  useEffect(() => {
    if (!sessionToken.get()) return;
    let active = true;
    api
      .me()
      .then(({ user: current }) => {
        if (active) setUser(current);
      })
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 401) sessionToken.clear();
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await api.login(email, password);
    sessionToken.set(result.token);
    setUser(result.user);
  }, []);

  const register = useCallback(
    async (email: string, password: string) => {
      await api.register(email, password);
      await login(email, password);
    },
    [login],
  );

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      // The session is closed locally anyway; an expired token is already invalid.
    }
    sessionToken.clear();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, register, logout }),
    [user, loading, login, register, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error('useAuth must be used inside <AuthProvider>');
  return auth;
}
