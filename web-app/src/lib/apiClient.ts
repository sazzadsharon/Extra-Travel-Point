// Canonical Axios client for the ETP web app.
//
// All HTTP requests should use this instance (directly or via the
// convenience `api.get/post/...` aliases). It is the single source of
// truth for:
//   - base URL / timeout (from `config/api`)
//   - attaching the access token to outgoing requests
//   - refreshing the access token on 401 responses
//   - queuing concurrent requests while a refresh is in flight
//   - broadcasting auth state changes (login / logout)
//
// Backend contract:
//   POST /auth/refresh-token
//     body: { refreshToken: string }
//     200:  { accessToken, refreshToken? }
//
// We never modify the backend contract here; we only consume it.

import axios, {
  AxiosError,
  AxiosHeaders,
  AxiosInstance,
  InternalAxiosRequestConfig,
} from 'axios';
import { API_CONFIG } from '../config/api';
import { tokenStorage } from './tokenStorage';

type Listener = () => void;
const authListeners = new Set<Listener>();

export function onAuthChange(listener: Listener): () => void {
  authListeners.add(listener);
  return () => {
    authListeners.delete(listener);
  };
}

function notifyAuthChange() {
  authListeners.forEach((l) => {
    try {
      l();
    } catch {
      /* ignore listener failures */
    }
  });
}

export const api: AxiosInstance = axios.create({
  baseURL: API_CONFIG.API_BASE_URL,
  timeout: API_CONFIG.TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach access token to every outgoing request.
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = tokenStorage.getAccessToken();
  if (token) {
    const headers = AxiosHeaders.from(config.headers ?? {});
    if (!headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    config.headers = headers;
  }
  return config;
});

// Refresh-token queue: ensure a single refresh call is in flight and
// any 401-triggered requests wait for it to complete (success or failure).
let isRefreshing = false;
let refreshSubscribers: Array<(token: string | null) => void> = [];

function subscribeTokenRefresh(cb: (token: string | null) => void) {
  refreshSubscribers.push(cb);
}

function flushRefreshSubscribers(token: string | null) {
  const subs = refreshSubscribers;
  refreshSubscribers = [];
  subs.forEach((cb) => {
    try {
      cb(token);
    } catch {
      /* ignore subscriber errors */
    }
  });
}

async function performRefresh(): Promise<string | null> {
  const refreshToken = tokenStorage.getRefreshToken();
  if (!refreshToken) return null;

  try {
    const response = await axios.post(
      `${API_CONFIG.API_BASE_URL}/auth/refresh-token`,
      { refreshToken },
      { timeout: API_CONFIG.TIMEOUT }
    );
    const data = response.data ?? {};
    const newAccess: string | undefined = data.accessToken || data.token;
    const newRefresh: string | undefined = data.refreshToken;

    if (!newAccess) return null;

    tokenStorage.setAccessToken(newAccess);
    if (newRefresh) {
      tokenStorage.setRefreshToken(newRefresh);
    }
    api.defaults.headers.common['Authorization'] = `Bearer ${newAccess}`;
    return newAccess;
  } catch {
    return null;
  }
}

function handleAuthFailure() {
  tokenStorage.clear();
  delete api.defaults.headers.common['Authorization'];
  notifyAuthChange();
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as
      | (InternalAxiosRequestConfig & { _retry?: boolean })
      | undefined;

    if (!originalRequest || error.response?.status !== 401) {
      return Promise.reject(error);
    }

    // Avoid recursion on the refresh endpoint itself.
    const requestUrl = originalRequest.url ?? '';
    if (requestUrl.includes('/auth/refresh-token')) {
      handleAuthFailure();
      return Promise.reject(error);
    }

    // Avoid infinite retry loops.
    if (originalRequest._retry) {
      handleAuthFailure();
      return Promise.reject(error);
    }

    // If we don't have a refresh token, we can't recover.
    if (!tokenStorage.getRefreshToken()) {
      handleAuthFailure();
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        subscribeTokenRefresh((newToken) => {
          if (!newToken) {
            reject(error);
            return;
          }
          const headers = AxiosHeaders.from(originalRequest.headers ?? {});
          headers.set('Authorization', `Bearer ${newToken}`);
          originalRequest.headers = headers;
          resolve(api(originalRequest));
        });
      });
    }

    isRefreshing = true;
    const newToken = await performRefresh();
    isRefreshing = false;

    if (!newToken) {
      flushRefreshSubscribers(null);
      handleAuthFailure();
      return Promise.reject(error);
    }

    flushRefreshSubscribers(newToken);

    const headers = AxiosHeaders.from(originalRequest.headers ?? {});
    headers.set('Authorization', `Bearer ${newToken}`);
    originalRequest.headers = headers;

    return api(originalRequest);
  }
);

export default api;
