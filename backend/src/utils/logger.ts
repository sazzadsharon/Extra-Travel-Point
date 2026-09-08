type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

let currentLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
}

function sanitize(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') {
    if (obj.length > 1000) return obj.slice(0, 1000) + '...';
    return obj;
  }
  if (Array.isArray(obj)) return obj.map(sanitize);
  if (typeof obj === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();
      if (lowerKey.includes('password') || lowerKey.includes('secret') || lowerKey.includes('token') || lowerKey.includes('key') || lowerKey.includes('authorization')) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = sanitize(value);
      }
    }
    return sanitized;
  }
  return obj;
}

export function log(level: LogLevel, message: string, data?: unknown): void {
  if (!shouldLog(level)) return;
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
  if (data !== undefined) {
    console.log(`${prefix} ${message}`, JSON.stringify(sanitize(data)));
  } else {
    console.log(`${prefix} ${message}`);
  }
}

export function logDebug(message: string, data?: unknown): void {
  log('debug', message, data);
}

export function logInfo(message: string, data?: unknown): void {
  log('info', message, data);
}

export function logWarn(message: string, data?: unknown): void {
  log('warn', message, data);
}

export function logError(message: string, error?: unknown, meta?: unknown): void {
  if (error instanceof Error) {
    log('error', message, { message: error.message, stack: process.env.NODE_ENV === 'development' ? error.stack : undefined, ...(meta as Record<string, unknown>) });
  } else if (error !== undefined) {
    log('error', message, { data: error, ...(meta as Record<string, unknown>) });
  } else if (meta !== undefined) {
    log('error', message, meta);
  } else {
    log('error', message);
  }
}
