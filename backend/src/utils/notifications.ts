import { prisma } from '../prisma';

export async function notifyUser(userId: number, eventType: string, title: string, message: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, phone: true, email: true, fullName: true }
    });

    if (!user) return;

    console.log(`[Notification] ${eventType} -> User#${user.id} (${user.phone}): ${title} | ${message}`);
  } catch (err) {
    console.error('[Notification] dispatch failed:', err);
  }
}
