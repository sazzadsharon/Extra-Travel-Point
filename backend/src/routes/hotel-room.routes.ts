import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { authenticateJWT, AuthRequest, requireRole } from '../middleware/auth';
import { datesInRange, nightsBetween } from '../utils/pricing';
import { safeError } from '../utils/safeError';

const router = Router();

async function ensureRoomOwnership(roomId: number, userId: number, role: string) {
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    include: { provider: { select: { id: true, businessName: true, category: true, userId: true } } }
  });
  if (!room) return { ok: false as const, status: 404, error: 'Room not found' };
  if (!room.provider || room.provider.category !== 'hotel') return { ok: false as const, status: 400, error: 'Room does not belong to a hotel' };
  if (room.provider.userId !== userId && role !== 'admin') return { ok: false as const, status: 403, error: 'Access denied' };
  return { ok: true as const, room, hotel: room.provider };
}

const approvedHotel = { category: 'hotel', isVerified: true, isActive: true, status: 'APPROVED', lifecycleStatus: 'APPROVED', isPublished: true } as const;

// Create a room under a hotel
const roomCreateSchema = z.object({
  hotelId: z.number().int().positive(),
  name: z.string().min(2).max(200),
  type: z.string().min(1).max(100),
  description: z.string().optional(),
  price: z.number().nonnegative(),
  capacity: z.number().int().positive().optional().default(2),
  adultCapacity: z.number().int().positive().optional().default(2),
  childCapacity: z.number().int().nonnegative().optional().default(0),
  totalRooms: z.number().int().positive().optional().default(1),
  roomNumber: z.string().max(50).optional(),
  bedConfig: z.string().max(100).optional(),
  amenities: z.string().optional(),
  images: z.string().optional(),
  isAvailable: z.boolean().optional().default(true),
  size: z.string().max(50).optional()
});

router.post('/', authenticateJWT, requireRole(['vendor', 'admin']), async (req: AuthRequest, res) => {
  try {
    const parse = roomCreateSchema.safeParse(req.body);
    if (!parse.success) return res.status(400).json({ error: parse.error.issues });
    const data = parse.data;

    const hotel = await prisma.serviceProvider.findUnique({ where: { id: data.hotelId } });
    if (!hotel || hotel.category !== 'hotel') return res.status(404).json({ error: 'Hotel not found' });
    if (hotel.userId !== req.user!.id && req.user!.role !== 'admin') return res.status(403).json({ error: 'Access denied' });

    const room = await prisma.room.create({
      data: {
        providerId: data.hotelId,
        name: data.name,
        type: data.type,
        description: data.description,
        price: data.price,
        capacity: data.capacity,
        adultCapacity: data.adultCapacity,
        childCapacity: data.childCapacity,
        totalRooms: data.totalRooms,
        roomNumber: data.roomNumber,
        bedConfig: data.bedConfig,
        amenities: data.amenities,
        images: data.images,
        isAvailable: data.isAvailable,
        size: data.size,
        baseCurrency: 'BDT',
        status: 'ACTIVE'
      }
    });
    return res.status(201).json({ message: 'Room created', room });
  } catch (err: any) {
    return res.status(500).json({ error: safeError(err) });
  }
});

// Update a room
router.patch('/:roomId', authenticateJWT, requireRole(['vendor', 'admin']), async (req: AuthRequest, res) => {
  try {
    const roomId = parseInt(req.params.roomId);
    if (!Number.isFinite(roomId) || roomId <= 0) return res.status(400).json({ error: 'Invalid id' });
    const own = await ensureRoomOwnership(roomId, req.user!.id, req.user!.role);
    if (!own.ok) return res.status(own.status).json({ error: own.error });

    const updateSchema = roomCreateSchema.partial().omit({ hotelId: true });
    const parse = updateSchema.safeParse(req.body);
    if (!parse.success) return res.status(400).json({ error: parse.error.issues });

    const room = await prisma.room.update({ where: { id: roomId }, data: parse.data });
    return res.json({ message: 'Room updated', room });
  } catch (err: any) {
    return res.status(500).json({ error: safeError(err) });
  }
});

// Soft-delete (deactivate) a room
router.delete('/:roomId', authenticateJWT, requireRole(['vendor', 'admin']), async (req: AuthRequest, res) => {
  try {
    const roomId = parseInt(req.params.roomId);
    if (!Number.isFinite(roomId) || roomId <= 0) return res.status(400).json({ error: 'Invalid id' });
    const own = await ensureRoomOwnership(roomId, req.user!.id, req.user!.role);
    if (!own.ok) return res.status(own.status).json({ error: own.error });
    const room = await prisma.room.update({ where: { id: roomId }, data: { status: 'INACTIVE', isAvailable: false } });
    return res.json({ message: 'Room deactivated', room });
  } catch (err: any) {
    return res.status(500).json({ error: safeError(err) });
  }
});

// Mark room out-of-service / maintenance
const statusUpdateSchema = z.object({
  status: z.enum(['ACTIVE', 'MAINTENANCE', 'OUT_OF_SERVICE']),
  notes: z.string().max(500).optional()
});

router.post('/:roomId/status', authenticateJWT, requireRole(['vendor', 'admin']), async (req: AuthRequest, res) => {
  try {
    const roomId = parseInt(req.params.roomId);
    if (!Number.isFinite(roomId) || roomId <= 0) return res.status(400).json({ error: 'Invalid id' });
    const own = await ensureRoomOwnership(roomId, req.user!.id, req.user!.role);
    if (!own.ok) return res.status(own.status).json({ error: own.error });

    const parse = statusUpdateSchema.safeParse(req.body);
    if (!parse.success) return res.status(400).json({ error: parse.error.issues });

    const isBookable = parse.data.status === 'ACTIVE';
    const room = await prisma.room.update({
      where: { id: roomId },
      data: { status: parse.data.status, isAvailable: isBookable }
    });

    if (parse.data.status === 'MAINTENANCE' || parse.data.status === 'OUT_OF_SERVICE') {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const horizon = new Date(today); horizon.setDate(horizon.getDate() + 30);
      const dates: Date[] = [];
      for (let d = new Date(today); d < horizon; d.setDate(d.getDate() + 1)) {
        dates.push(new Date(d));
      }
      await prisma.$transaction(
        dates.map(d => prisma.hotelAvailability.upsert({
          where: { roomId_date: { roomId, date: d } },
          update: { isActive: false },
          create: { roomId, date: d, totalRooms: own.room.totalRooms, bookedRooms: 0, isActive: false }
        }))
      );
    }

    if (parse.data.notes) {
      await prisma.hotelMaintenanceRequest.create({
        data: {
          providerId: own.room.providerId,
          roomId,
          title: `Room status update: ${parse.data.status}`,
          description: parse.data.notes,
          category: 'OTHER',
          status: parse.data.status === 'MAINTENANCE' ? 'IN_PROGRESS' : 'REPORTED'
        }
      });
    }

    return res.json({ message: `Room marked ${parse.data.status}`, room });
  } catch (err: any) {
    return res.status(500).json({ error: safeError(err) });
  }
});

// Provider: list own rooms
router.get('/mine', authenticateJWT, requireRole(['vendor', 'admin']), async (req: AuthRequest, res) => {
  try {
    const hotels = await prisma.serviceProvider.findMany({
      where: { userId: req.user!.id, category: 'hotel' },
      select: { id: true }
    });
    const hotelIds = hotels.map(h => h.id);
    if (hotelIds.length === 0) return res.json({ count: 0, rooms: [] });

    const rooms = await prisma.room.findMany({
      where: { providerId: { in: hotelIds } },
      include: { ratePlans: { where: { isActive: true } } },
      orderBy: { createdAt: 'desc' }
    });
    return res.json({ count: rooms.length, rooms });
  } catch (err: any) {
    return res.status(500).json({ error: safeError(err) });
  }
});

// Provider: get own room detail
router.get('/mine/:roomId', authenticateJWT, requireRole(['vendor', 'admin']), async (req: AuthRequest, res) => {
  try {
    const roomId = parseInt(req.params.roomId);
    if (!Number.isFinite(roomId) || roomId <= 0) return res.status(400).json({ error: 'Invalid id' });
    const own = await ensureRoomOwnership(roomId, req.user!.id, req.user!.role);
    if (!own.ok) return res.status(own.status).json({ error: own.error });

    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: {
        ratePlans: true,
        availabilities: { orderBy: { date: 'asc' }, take: 60 }
      }
    });
    return res.json({ room });
  } catch (err: any) {
    return res.status(500).json({ error: safeError(err) });
  }
});

// Public: list rooms for an approved hotel
router.get('/', async (req, res) => {
  try {
    const hotelId = req.query.hotelId ? parseInt(String(req.query.hotelId)) : null;
    if (!hotelId) return res.status(400).json({ error: 'hotelId required' });

    const hotel = await prisma.serviceProvider.findFirst({
      where: { id: hotelId, ...approvedHotel }
    });
    if (!hotel) return res.status(404).json({ error: 'Hotel not found or not available for booking' });

    const rooms = await prisma.room.findMany({
      where: { providerId: hotelId, status: 'ACTIVE' },
      include: {
        ratePlans: { where: { isActive: true } },
        availabilities: { orderBy: { date: 'asc' }, take: 30 }
      },
      orderBy: { price: 'asc' }
    });
    return res.json({ count: rooms.length, rooms: rooms.map(r => ({
      id: r.id,
      name: r.name,
      type: r.type,
      description: r.description,
      price: r.price,
      capacity: r.capacity,
      adultCapacity: r.adultCapacity,
      childCapacity: r.childCapacity,
      totalRooms: r.totalRooms,
      roomNumber: r.roomNumber,
      bedConfig: r.bedConfig,
      amenities: r.amenities,
      images: r.images,
      size: r.size,
      status: r.status,
      isAvailable: r.isAvailable,
      ratePlans: r.ratePlans.map(p => ({ id: p.id, name: p.name, price: p.price, mealPlan: p.mealPlan, refundable: p.refundable }))
    })) });
  } catch (err: any) {
    return res.status(500).json({ error: safeError(err) });
  }
});

// Public: get single room detail for approved hotel
router.get('/:roomId', async (req, res) => {
  try {
    const roomId = parseInt(req.params.roomId);
    if (!Number.isFinite(roomId) || roomId <= 0) return res.status(400).json({ error: 'Invalid id' });

    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: {
        ratePlans: { where: { isActive: true } },
        availabilities: { orderBy: { date: 'asc' }, take: 60 }
      }
    });
    if (!room) return res.status(404).json({ error: 'Room not found' });

    const hotel = await prisma.serviceProvider.findFirst({
      where: { id: room.providerId, category: 'hotel', isVerified: true, isActive: true, status: 'APPROVED', lifecycleStatus: 'APPROVED', isPublished: true },
      select: { id: true, businessName: true, city: true, address: true, phone: true }
    });
    if (!hotel) return res.status(404).json({ error: 'Room not found' });

    return res.json({ room: {
      id: room.id,
      name: room.name,
      type: room.type,
      description: room.description,
      price: room.price,
      capacity: room.capacity,
      adultCapacity: room.adultCapacity,
      childCapacity: room.childCapacity,
      totalRooms: room.totalRooms,
      roomNumber: room.roomNumber,
      bedConfig: room.bedConfig,
      amenities: room.amenities,
      images: room.images,
      size: room.size,
      status: room.status,
      isAvailable: room.isAvailable,
      ratePlans: room.ratePlans.map(p => ({ id: p.id, name: p.name, price: p.price, mealPlan: p.mealPlan, refundable: p.refundable, minStay: p.minStay, maxStay: p.maxStay })),
      availabilities: room.availabilities.map(a => ({
        date: a.date.toISOString().split('T')[0],
        totalRooms: a.totalRooms,
        bookedRooms: a.bookedRooms,
        isActive: a.isActive
      })),
      hotel
    } });
  } catch (err: any) {
    return res.status(500).json({ error: safeError(err) });
  }
});

// Public: check availability for a room
router.get('/:roomId/availability', async (req, res) => {
  try {
    const roomId = parseInt(req.params.roomId);
    if (!Number.isFinite(roomId) || roomId <= 0) return res.status(400).json({ error: 'Invalid id' });

    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: { provider: true }
    });
    if (!room || !room.provider) return res.status(404).json({ error: 'Room not found' });

    const hotel = room.provider;
    if (hotel.category !== 'hotel' || !hotel.isVerified || !hotel.isActive || hotel.status !== 'APPROVED' || hotel.lifecycleStatus !== 'APPROVED' || !hotel.isPublished) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const from = req.query.from ? new Date(String(req.query.from)) : null;
    const to = req.query.to ? new Date(String(req.query.to)) : null;
    const where: any = { roomId };
    if (from || to) {
      where.date = {};
      if (from) { const f = new Date(from); f.setHours(0, 0, 0, 0); where.date.gte = f; }
      if (to) { const t = new Date(to); t.setHours(23, 59, 59, 999); where.date.lte = t; }
    }

    const avail = await prisma.hotelAvailability.findMany({ where, orderBy: { date: 'asc' } });
    return res.json({ count: avail.length, availability: avail.map(a => ({
      date: a.date.toISOString().split('T')[0],
      totalRooms: a.totalRooms,
      bookedRooms: a.bookedRooms,
      remaining: Math.max(0, a.totalRooms - a.bookedRooms),
      isActive: a.isActive
    })) });
  } catch (err: any) {
    return res.status(500).json({ error: safeError(err) });
  }
});

export default router;
