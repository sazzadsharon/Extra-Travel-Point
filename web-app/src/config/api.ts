// API Configuration
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

const currentEnv = (process.env.NODE_ENV as keyof typeof ENV) || 'development';

export const API_CONFIG = {
  ...ENV[currentEnv],
  TIMEOUT: 30000,
  RETRY_ATTEMPTS: 3,
};