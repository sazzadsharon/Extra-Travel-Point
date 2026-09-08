import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

prisma.$connect().then(async () => {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS seat_locks_active_unique
      ON seat_locks (providerId, category, travelDate, seatNumber)
      WHERE releasedAt IS NULL AND expiresAt > datetime('now')
    `);
  } catch (e: any) {
    console.warn('Seat lock index creation warning:', e.message);
  }
}).catch((e: any) => {
  console.error('Prisma connection error:', e.message);
});
