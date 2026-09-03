const ENV: Record<string, { API_URL: string }> = {
  development: { API_URL: 'http://localhost:5000' },
  production: { API_URL: 'https://etp-backend.onrender.com' },
};

const runtimeApiUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '');
const currentEnv = (process.env.NODE_ENV as keyof typeof ENV) || 'development';

export const API_CONFIG = {
  API_URL: runtimeApiUrl || ENV[currentEnv]?.API_URL || 'http://localhost:5000',
  TIMEOUT: 30000,
};

export interface ApiOptions extends RequestInit {
  auth?: boolean;
}

export class ApiError extends Error {
  status: number;
  data: any;
  constructor(status: number, message: string, data?: any) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

export async function api<T = any>(path: string, opts: ApiOptions = {}): Promise<T> {
  const { auth = true, headers, ...rest } = opts;
  const finalHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(headers as Record<string, string> | undefined),
  };
  if (auth && typeof window !== 'undefined') {
    const token = window.localStorage.getItem('etp_admin_token');
    if (token) finalHeaders.Authorization = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_CONFIG.TIMEOUT);

  try {
    const res = await fetch(`${API_CONFIG.API_URL}${path}`, {
      ...rest,
      headers: finalHeaders,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    let data: any = null;
    const text = await res.text();
    if (text) {
      try { data = JSON.parse(text); } catch { data = text; }
    }

    if (!res.ok) {
      const message = (data && (data.error || data.message)) || `Request failed (${res.status})`;
      if (res.status === 401 && typeof window !== 'undefined') {
        window.localStorage.removeItem('etp_admin_token');
        window.localStorage.removeItem('etp_admin_user');
        if (!window.location.pathname.startsWith('/login')) {
          window.location.href = '/login';
        }
      }
      throw new ApiError(res.status, message, data);
    }
    return data as T;
  } catch (err: any) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') throw new ApiError(408, 'Request timed out');
    if (err instanceof ApiError) throw err;
    throw new ApiError(0, err.message || 'Network error');
  }
}
