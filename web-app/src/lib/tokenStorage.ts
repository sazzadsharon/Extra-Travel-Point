// Centralized token storage for the web app.
// Keeps the existing localStorage keys (`etp_access_token`, `etp_user`)
// for backwards compatibility and adds a refresh-token key.

const ACCESS_TOKEN_KEY = 'etp_access_token';
const REFRESH_TOKEN_KEY = 'etp_refresh_token';
const USER_KEY = 'etp_user';

export const tokenStorage = {
  getAccessToken(): string | null {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(ACCESS_TOKEN_KEY);
  },
  setAccessToken(token: string | null): void {
    if (typeof window === 'undefined') return;
    if (token) {
      window.localStorage.setItem(ACCESS_TOKEN_KEY, token);
    } else {
      window.localStorage.removeItem(ACCESS_TOKEN_KEY);
    }
  },
  getRefreshToken(): string | null {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(REFRESH_TOKEN_KEY);
  },
  setRefreshToken(token: string | null): void {
    if (typeof window === 'undefined') return;
    if (token) {
      window.localStorage.setItem(REFRESH_TOKEN_KEY, token);
    } else {
      window.localStorage.removeItem(REFRESH_TOKEN_KEY);
    }
  },
  getUser<T = unknown>(): T | null {
    if (typeof window === 'undefined') return null;
    const raw = window.localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      window.localStorage.removeItem(USER_KEY);
      return null;
    }
  },
  setUser<T>(user: T | null): void {
    if (typeof window === 'undefined') return;
    if (user) {
      window.localStorage.setItem(USER_KEY, JSON.stringify(user));
    } else {
      window.localStorage.removeItem(USER_KEY);
    }
  },
  clear(): void {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(ACCESS_TOKEN_KEY);
    window.localStorage.removeItem(REFRESH_TOKEN_KEY);
    window.localStorage.removeItem(USER_KEY);
  },
};

export const TOKEN_KEYS = {
  access: ACCESS_TOKEN_KEY,
  refresh: REFRESH_TOKEN_KEY,
  user: USER_KEY,
};
