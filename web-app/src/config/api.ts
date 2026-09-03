// API Configuration
// Priority:
// 1. NEXT_PUBLIC_API_URL env var (set in .env.local / hosting platform)
// 2. NODE_ENV-based fallback (development / production)
const ENV = {
  development: {
    API_BASE_URL: 'http://localhost:5000/api/v1',
    API_URL: 'http://localhost:5000',
  },
  staging: {
    API_BASE_URL: 'https://etp-backend-staging.onrender.com/api/v1',
    API_URL: 'https://etp-backend-staging.onrender.com',
  },
  production: {
    API_BASE_URL: 'https://etp-backend.onrender.com/api/v1',
    API_URL: 'https://etp-backend.onrender.com',
  },
};

const runtimeApiUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '');
const currentEnv = (process.env.NODE_ENV as keyof typeof ENV) || 'development';

export const API_CONFIG = {
  API_BASE_URL: runtimeApiUrl ? `${runtimeApiUrl}/api/v1` : ENV[currentEnv].API_BASE_URL,
  API_URL: runtimeApiUrl || ENV[currentEnv].API_URL,
  TIMEOUT: 30000,
  RETRY_ATTEMPTS: 3,
};
