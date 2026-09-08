import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

export default async () => {
  const backendDir = path.resolve(__dirname, '..');
  const prismaDir = path.join(backendDir, 'prisma');
  const testDbPath = path.join(prismaDir, 'test.db');

  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }

  const env = { ...process.env, DATABASE_URL: 'file:./test.db' };
  try {
    execSync('npx prisma db push', {
      cwd: backendDir,
      stdio: 'inherit',
      env
    });
  } catch (error) {
    console.error('Failed to create test database schema:', error);
    process.exit(1);
  }

  const { PrismaClient } = require('@prisma/client');
  const p = new PrismaClient();
  try {
    await p.$connect();
    // NOTE: SQLite forbids non-deterministic functions (e.g. datetime('now'))
    // inside a partial-index WHERE clause, so the "not yet expired" filter uses
    // a deterministic column-only expression. Expired locks are still excluded
    // from blocking by the application layer (expiresAt > now) in booking.routes.
    await p.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS seat_locks_active_unique
      ON seat_locks (providerId, category, travelDate, seatNumber)
      WHERE releasedAt IS NULL
    `);
  } catch (e) {
    console.error('Failed to create seat lock index:', e);
  } finally {
    await p.$disconnect();
  }
};
