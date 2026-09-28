import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

prisma.$connect().then(async () => {
  const isSQLite = (process.env.DATABASE_URL || '').startsWith('file:');
  try {
    if (isSQLite) {
      await prisma.$executeRawUnsafe(`
        CREATE UNIQUE INDEX IF NOT EXISTS seat_locks_active_unique
        ON seat_locks (providerId, category, travelDate, seatNumber)
        WHERE releasedAt IS NULL AND expiresAt > datetime('now')
      `);
    } else {
      await prisma.$executeRawUnsafe(`
        CREATE UNIQUE INDEX IF NOT EXISTS seat_locks_active_unique
        ON "seat_locks" ("providerId", "category", "travelDate", "seatNumber")
        WHERE "releasedAt" IS NULL
      `);
    }
  } catch (e: any) {
    console.warn('Seat lock index creation warning:', e.message);
  }
}).catch((e: any) => {
  console.error('Prisma connection error:', e.message);
});
