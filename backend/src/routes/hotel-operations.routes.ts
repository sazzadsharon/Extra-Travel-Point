import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import type { Prisma } from '@prisma/client';
import { authenticateJWT, AuthRequest, requireRole } from '../middleware/auth';
import { safeError } from '../utils/safeError';

const router = Router();

// =====================================================================
// HELPER — ensure provider ownership for operational resources
// =====================================================================
async function ensureHotelOwnership(hotelId: number, userId: number, role: string) {
  const hotel = await prisma.serviceProvider.findUnique({ where: { id: hotelId } });
  if (!hotel || hotel.category !== 'hotel') return { ok: false as const, status: 404, error: 'Hotel not found' };
  if (hotel.userId !== userId && role !== 'admin') return { ok: false as const, status: 403, error: 'Access denied' };
  return { ok: true as const, hotel };
}

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

async function getVendorHotelIds(userId: number, role: string): Promise<number[]> {
  if (role === 'admin') {
    const all = await prisma.serviceProvider.findMany({ where: { category: 'hotel' }, select: { id: true } });
    return all.map(p => p.id);
  }
  const hotels = await prisma.serviceProvider.findMany({ where: { userId, category: 'hotel' }, select: { id: true } });
  return hotels.map(h => h.id);
}

// =====================================================================
// STATE TRANSITION VALIDATION
// =====================================================================

const HOUSEKEEPING_TRANSITIONS: Record<string, string[]> = {
  PENDING: ['ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
  ASSIGNED: ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
  IN_PROGRESS: ['PENDING', 'ASSIGNED', 'COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: []
};

const MAINTENANCE_TRANSITIONS: Record<string, string[]> = {
  REPORTED: ['ASSIGNED', 'IN_PROGRESS', 'CANCELLED'],
  ASSIGNED: ['REPORTED', 'IN_PROGRESS', 'RESOLVED', 'CANCELLED'],
  IN_PROGRESS: ['REPORTED', 'ASSIGNED', 'RESOLVED', 'CANCELLED'],
  RESOLVED: [],
  CANCELLED: []
};

// =====================================================================
// HOUSEKEEPING
// =====================================================================

const housekeepingCreateSchema = z.object({
  providerId: z.number().int().positive(),
  roomId: z.number().int().positive(),
  assignedTo: z.number().int().positive().optional().nullable(),
  notes: z.string().max(500).optional().nullable()
});

const housekeepingUpdateSchema = z.object({
  status: z.enum(['PENDING', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
  assignedTo: z.number().int().positive().optional().nullable(),
  notes: z.string().max(500).optional().nullable()
});

router.post('/housekeeping', authenticateJWT, requireRole(['vendor', 'admin']), async (req: AuthRequest, res) => {
  try {
    const parse = housekeepingCreateSchema.safeParse(req.body);
    if (!parse.success) return res.status(400).json({ error: parse.error.issues });

    const { providerId, roomId, assignedTo, notes } = parse.data;
    const own = await ensureHotelOwnership(providerId, req.user!.id, req.user!.role);
    if (!own.ok) return res.status(own.status).json({ error: own.error });

    const room = await prisma.room.findUnique({ where: { id: roomId } });
    if (!room || room.providerId !== providerId) return res.status(400).json({ error: 'Room does not belong to this hotel' });

    const task = await prisma.housekeepingTask.create({
      data: {
        providerId,
        roomId,
        assignedTo: assignedTo ?? undefined,
        notes: notes ?? undefined,
        status: 'PENDING'
      },
      include: { provider: { select: { id: true, businessName: true } } }
    });

    const response: any = { ...task, room: room ? { id: room.id, name: room.name } : null };
    return res.status(201).json({ message: 'Housekeeping task created', task: response });
  } catch (err: any) {
    return res.status(500).json({ error: safeError(err) });
  }
});

router.get('/housekeeping', authenticateJWT, requireRole(['vendor', 'admin']), async (req: AuthRequest, res) => {
  try {
    const hotelIds = await getVendorHotelIds(req.user!.id, req.user!.role);
    if (hotelIds.length === 0) return res.json({ count: 0, tasks: [] });

    const status = req.query.status ? String(req.query.status) : null;
    const where: any = { providerId: { in: hotelIds } };
    if (status) where.status = status;

    const tasks = await prisma.housekeepingTask.findMany({
      where,
      include: {
        provider: { select: { id: true, businessName: true } },
        room: { select: { id: true, name: true, roomNumber: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    return res.json({ count: tasks.length, tasks });
  } catch (err: any) {
    return res.status(500).json({ error: safeError(err) });
  }
});

router.patch('/housekeeping/:taskId', authenticateJWT, requireRole(['vendor', 'admin']), async (req: AuthRequest, res) => {
  try {
    const taskId = parseInt(req.params.taskId);
    if (!Number.isFinite(taskId) || taskId <= 0) return res.status(400).json({ error: 'Invalid task id' });

    const task = await prisma.housekeepingTask.findUnique({ where: { id: taskId } });
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const own = await ensureHotelOwnership(task.providerId, req.user!.id, req.user!.role);
    if (!own.ok) return res.status(own.status).json({ error: own.error });

    const parse = housekeepingUpdateSchema.safeParse(req.body);
    if (!parse.success) return res.status(400).json({ error: parse.error.issues });

    if (parse.data.status && task.status === 'COMPLETED') {
      return res.status(400).json({ error: 'Cannot modify a completed task' });
    }
    if (parse.data.status && task.status === 'CANCELLED') {
      return res.status(400).json({ error: 'Cannot modify a cancelled task' });
    }
    if (parse.data.status && !HOUSEKEEPING_TRANSITIONS[task.status]?.includes(parse.data.status)) {
      return res.status(400).json({ error: `Invalid status transition from ${task.status} to ${parse.data.status}` });
    }

    if (parse.data.assignedTo && Number.isInteger(parse.data.assignedTo)) {
      const staff = await prisma.hotelStaff.findFirst({
        where: { providerId: task.providerId, userId: parse.data.assignedTo, isActive: true }
      });
      if (!staff) {
        return res.status(400).json({ error: 'Assigned user is not active staff for this hotel' });
      }
    }

    const data: any = { ...parse.data };
    if (data.assignedTo === undefined) delete data.assignedTo;
    if (data.notes === undefined) delete data.notes;
    if (data.status === 'COMPLETED' && !task.completedAt) {
      data.completedAt = new Date();
    }

    const updated = await prisma.housekeepingTask.update({
      where: { id: taskId },
      data,
      include: { provider: { select: { id: true, businessName: true } }, room: { select: { id: true, name: true, status: true } } }
    });

    if (data.status === 'COMPLETED' && updated.room && updated.room.status === 'CLEANING') {
      await prisma.room.update({ where: { id: task.roomId }, data: { status: 'ACTIVE' } });
    }

    await prisma.auditLog.create({
      data: {
        action: 'HOUSEKEEPING_UPDATED',
        actorId: req.user!.id,
        actorRole: req.user!.role,
        details: `Updated housekeeping task #${taskId}${parse.data.status ? ` to ${parse.data.status}` : ''}`,
        metadata: JSON.stringify({ taskId, providerId: task.providerId, roomId: task.roomId, changes: parse.data })
      }
    });

    return res.json({ message: 'Housekeeping task updated', task: updated });
  } catch (err: any) {
    return res.status(500).json({ error: safeError(err) });
  }
});

router.post('/housekeeping/:taskId/cancel', authenticateJWT, requireRole(['vendor', 'admin']), async (req: AuthRequest, res) => {
  try {
    const taskId = parseInt(req.params.taskId);
    if (!Number.isFinite(taskId) || taskId <= 0) return res.status(400).json({ error: 'Invalid task id' });

    const task = await prisma.housekeepingTask.findUnique({ where: { id: taskId } });
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const own = await ensureHotelOwnership(task.providerId, req.user!.id, req.user!.role);
    if (!own.ok) return res.status(own.status).json({ error: own.error });

    if (task.status === 'COMPLETED') return res.status(400).json({ error: 'Cannot cancel a completed task' });
    if (task.status === 'CANCELLED') return res.status(400).json({ error: 'Task already cancelled' });

    const updated = await prisma.housekeepingTask.update({
      where: { id: taskId },
      data: { status: 'CANCELLED' }
    });

    await prisma.auditLog.create({
      data: {
        action: 'HOUSEKEEPING_CANCELLED',
        actorId: req.user!.id,
        actorRole: req.user!.role,
        details: `Cancelled housekeeping task #${taskId}`,
        metadata: JSON.stringify({ taskId, providerId: task.providerId, roomId: task.roomId })
      }
    });

    return res.json({ message: 'Housekeeping task cancelled', task: updated });
  } catch (err: any) {
    return res.status(500).json({ error: safeError(err) });
  }
});

// =====================================================================
// MAINTENANCE
// =====================================================================

const maintenanceCreateSchema = z.object({
  providerId: z.number().int().positive(),
  roomId: z.number().int().positive().optional().nullable(),
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional().nullable(),
  category: z.string().max(100).optional().default('OTHER'),
  assignedTo: z.string().max(200).optional().nullable()
});

const maintenanceUpdateSchema = z.object({
  status: z.enum(['REPORTED', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CANCELLED']).optional(),
  assignedTo: z.string().max(200).optional().nullable(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional().nullable(),
  category: z.string().max(100).optional()
});

router.post('/maintenance', authenticateJWT, requireRole(['vendor', 'admin']), async (req: AuthRequest, res) => {
  try {
    const parse = maintenanceCreateSchema.safeParse(req.body);
    if (!parse.success) return res.status(400).json({ error: parse.error.issues });

    const { providerId, roomId, title, description, category, assignedTo } = parse.data;
    const own = await ensureHotelOwnership(providerId, req.user!.id, req.user!.role);
    if (!own.ok) return res.status(own.status).json({ error: own.error });

    if (roomId) {
      const room = await prisma.room.findUnique({ where: { id: roomId } });
      if (!room || room.providerId !== providerId) return res.status(400).json({ error: 'Room does not belong to this hotel' });
    }

    const request = await prisma.hotelMaintenanceRequest.create({
      data: {
        providerId,
        roomId: roomId ?? undefined,
        title,
        description: description ?? undefined,
        category,
        assignedTo: assignedTo ?? undefined,
        status: 'REPORTED'
      },
      include: { provider: { select: { id: true, businessName: true } } }
    });

    return res.status(201).json({ message: 'Maintenance request created', request });
  } catch (err: any) {
    return res.status(500).json({ error: safeError(err) });
  }
});

router.get('/maintenance', authenticateJWT, requireRole(['vendor', 'admin']), async (req: AuthRequest, res) => {
  try {
    const hotelIds = await getVendorHotelIds(req.user!.id, req.user!.role);
    if (hotelIds.length === 0) return res.json({ count: 0, requests: [] });

    const status = req.query.status ? String(req.query.status) : null;
    const where: any = { providerId: { in: hotelIds } };
    if (status) where.status = status;

    const requests = await prisma.hotelMaintenanceRequest.findMany({
      where,
      include: {
        provider: { select: { id: true, businessName: true } },
        room: { select: { id: true, name: true, roomNumber: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    return res.json({ count: requests.length, requests });
  } catch (err: any) {
    return res.status(500).json({ error: safeError(err) });
  }
});

router.patch('/maintenance/:requestId', authenticateJWT, requireRole(['vendor', 'admin']), async (req: AuthRequest, res) => {
  try {
    const requestId = parseInt(req.params.requestId);
    if (!Number.isFinite(requestId) || requestId <= 0) return res.status(400).json({ error: 'Invalid request id' });

    const request = await prisma.hotelMaintenanceRequest.findUnique({ where: { id: requestId } });
    if (!request) return res.status(404).json({ error: 'Request not found' });

    const own = await ensureHotelOwnership(request.providerId, req.user!.id, req.user!.role);
    if (!own.ok) return res.status(own.status).json({ error: own.error });

    const parse = maintenanceUpdateSchema.safeParse(req.body);
    if (!parse.success) return res.status(400).json({ error: parse.error.issues });

    if (parse.data.status && request.status === 'RESOLVED') {
      return res.status(400).json({ error: 'Cannot modify a resolved request' });
    }
    if (parse.data.status && request.status === 'CANCELLED') {
      return res.status(400).json({ error: 'Cannot modify a cancelled request' });
    }
    if (parse.data.status && !MAINTENANCE_TRANSITIONS[request.status]?.includes(parse.data.status)) {
      return res.status(400).json({ error: `Invalid status transition from ${request.status} to ${parse.data.status}` });
    }

    const data: any = { ...parse.data };
    if (data.assignedTo === undefined) delete data.assignedTo;
    if (data.description === undefined) delete data.description;
    if (data.category === undefined) delete data.category;
    if (data.status === 'RESOLVED' && !request.resolvedAt) {
      data.resolvedAt = new Date();
    }

    const updated = await prisma.hotelMaintenanceRequest.update({
      where: { id: requestId },
      data,
      include: { provider: { select: { id: true, businessName: true } } }
    });

    await prisma.auditLog.create({
      data: {
        action: 'MAINTENANCE_UPDATED',
        actorId: req.user!.id,
        actorRole: req.user!.role,
        details: `Updated maintenance request #${requestId}${parse.data.status ? ` to ${parse.data.status}` : ''}`,
        metadata: JSON.stringify({ requestId, providerId: request.providerId, changes: parse.data })
      }
    });

    return res.json({ message: 'Maintenance request updated', request: updated });
  } catch (err: any) {
    return res.status(500).json({ error: safeError(err) });
  }
});

router.post('/maintenance/:requestId/cancel', authenticateJWT, requireRole(['vendor', 'admin']), async (req: AuthRequest, res) => {
  try {
    const requestId = parseInt(req.params.requestId);
    if (!Number.isFinite(requestId) || requestId <= 0) return res.status(400).json({ error: 'Invalid request id' });

    const request = await prisma.hotelMaintenanceRequest.findUnique({ where: { id: requestId } });
    if (!request) return res.status(404).json({ error: 'Request not found' });

    const own = await ensureHotelOwnership(request.providerId, req.user!.id, req.user!.role);
    if (!own.ok) return res.status(own.status).json({ error: own.error });

    if (request.status === 'RESOLVED') return res.status(400).json({ error: 'Cannot cancel a resolved request' });
    if (request.status === 'CANCELLED') return res.status(400).json({ error: 'Request already cancelled' });

    const updated = await prisma.hotelMaintenanceRequest.update({
      where: { id: requestId },
      data: { status: 'CANCELLED' }
    });

    await prisma.auditLog.create({
      data: {
        action: 'MAINTENANCE_CANCELLED',
        actorId: req.user!.id,
        actorRole: req.user!.role,
        details: `Cancelled maintenance request #${requestId}`,
        metadata: JSON.stringify({ requestId, providerId: request.providerId })
      }
    });

    return res.json({ message: 'Maintenance request cancelled', request: updated });
  } catch (err: any) {
    return res.status(500).json({ error: safeError(err) });
  }
});

// =====================================================================
// HOTEL STAFF
// =====================================================================

const staffCreateSchema = z.object({
  providerId: z.number().int().positive(),
  userId: z.number().int().positive(),
  role: z.enum(['RECEPTIONIST', 'HOUSEKEEPING', 'MAINTENANCE', 'MANAGER']).optional().default('RECEPTIONIST')
});

const staffUpdateSchema = z.object({
  role: z.enum(['RECEPTIONIST', 'HOUSEKEEPING', 'MAINTENANCE', 'MANAGER']).optional(),
  isActive: z.boolean().optional()
});

router.post('/staff', authenticateJWT, requireRole(['vendor', 'admin']), async (req: AuthRequest, res) => {
  try {
    const parse = staffCreateSchema.safeParse(req.body);
    if (!parse.success) return res.status(400).json({ error: parse.error.issues });

    const { providerId, userId, role } = parse.data;
    const own = await ensureHotelOwnership(providerId, req.user!.id, req.user!.role);
    if (!own.ok) return res.status(own.status).json({ error: own.error });

    const targetUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!targetUser) return res.status(404).json({ error: 'User not found' });
    if (targetUser.role === 'admin' || targetUser.role === 'master_admin') {
      return res.status(400).json({ error: 'Cannot assign admin users as hotel staff' });
    }

    const staff = await prisma.hotelStaff.upsert({
      where: { providerId_userId: { providerId, userId } },
      update: { isActive: true, role },
      create: { providerId, userId, role, isActive: true }
    });

     await prisma.auditLog.create({
      data: {
        action: 'STAFF_ASSIGNED',
        actorId: req.user!.id,
        actorRole: req.user!.role,
        details: `Assigned staff user #${userId} (role: ${role}) to provider #${providerId}`,
        metadata: JSON.stringify({ staffId: staff.id, providerId, userId, role })
      }
    });

    return res.status(201).json({ message: 'Staff assigned', staff });
  } catch (err: any) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'User is already staff for this hotel' });
    return res.status(500).json({ error: safeError(err) });
  }
});

router.get('/staff', authenticateJWT, requireRole(['vendor', 'admin']), async (req: AuthRequest, res) => {
  try {
    const hotelIds = await getVendorHotelIds(req.user!.id, req.user!.role);
    if (hotelIds.length === 0) return res.json({ count: 0, staff: [] });

    const staff = await prisma.hotelStaff.findMany({
      where: { providerId: { in: hotelIds }, isActive: true },
      include: {
        user: { select: { id: true, fullName: true, phone: true, email: true, role: true } },
        provider: { select: { id: true, businessName: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    return res.json({ count: staff.length, staff });
  } catch (err: any) {
    return res.status(500).json({ error: safeError(err) });
  }
});

router.patch('/staff/:staffId', authenticateJWT, requireRole(['vendor', 'admin']), async (req: AuthRequest, res) => {
  try {
    const staffId = parseInt(req.params.staffId);
    if (!Number.isFinite(staffId) || staffId <= 0) return res.status(400).json({ error: 'Invalid staff id' });

    const staff = await prisma.hotelStaff.findUnique({ where: { id: staffId } });
    if (!staff) return res.status(404).json({ error: 'Staff not found' });

    const own = await ensureHotelOwnership(staff.providerId, req.user!.id, req.user!.role);
    if (!own.ok) return res.status(own.status).json({ error: own.error });

    const parse = staffUpdateSchema.safeParse(req.body);
    if (!parse.success) return res.status(400).json({ error: parse.error.issues });

    const updated = await prisma.hotelStaff.update({
      where: { id: staffId },
      data: parse.data,
      include: { user: { select: { id: true, fullName: true, phone: true } } }
    });

     await prisma.auditLog.create({
      data: {
        action: 'STAFF_UPDATED',
        actorId: req.user!.id,
        actorRole: req.user!.role,
        details: `Updated staff #${staffId}`,
        metadata: JSON.stringify({ staffId, providerId: staff.providerId, changes: parse.data })
      }
    });

    return res.json({ message: 'Staff updated', staff: updated });
  } catch (err: any) {
    return res.status(500).json({ error: safeError(err) });
  }
});

router.delete('/staff/:staffId', authenticateJWT, requireRole(['vendor', 'admin']), async (req: AuthRequest, res) => {
  try {
    const staffId = parseInt(req.params.staffId);
    if (!Number.isFinite(staffId) || staffId <= 0) return res.status(400).json({ error: 'Invalid staff id' });

    const staff = await prisma.hotelStaff.findUnique({ where: { id: staffId } });
    if (!staff) return res.status(404).json({ error: 'Staff not found' });

    const own = await ensureHotelOwnership(staff.providerId, req.user!.id, req.user!.role);
    if (!own.ok) return res.status(own.status).json({ error: own.error });

    await prisma.hotelStaff.update({ where: { id: staffId }, data: { isActive: false } });

    await prisma.auditLog.create({
      data: {
        action: 'STAFF_DEACTIVATED',
        actorId: req.user!.id,
        actorRole: req.user!.role,
        details: `Deactivated staff #${staffId}`,
        metadata: JSON.stringify({ staffId, providerId: staff.providerId })
      }
    });

    return res.json({ message: 'Staff deactivated' });
  } catch (err: any) {
    return res.status(500).json({ error: safeError(err) });
  }
});

// =====================================================================
// ROOM OPERATIONAL STATUS
// =====================================================================

const roomOperationalStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'OCCUPIED', 'CLEANING', 'MAINTENANCE', 'OUT_OF_SERVICE']),
  notes: z.string().max(500).optional().nullable()
});

router.post('/rooms/:roomId/operational-status', authenticateJWT, requireRole(['vendor', 'admin']), async (req: AuthRequest, res) => {
  try {
    const roomId = parseInt(req.params.roomId);
    if (!Number.isFinite(roomId) || roomId <= 0) return res.status(400).json({ error: 'Invalid room id' });

    const own = await ensureRoomOwnership(roomId, req.user!.id, req.user!.role);
    if (!own.ok) return res.status(own.status).json({ error: own.error });

    const parse = roomOperationalStatusSchema.safeParse(req.body);
    if (!parse.success) return res.status(400).json({ error: parse.error.issues });

    const { status, notes } = parse.data;

    if (own.room.status === 'OCCUPIED' && status === 'ACTIVE') {
      return res.status(400).json({ error: 'Cannot mark an occupied room as available. Guest must check out first.' });
    }

    const isBookable = status === 'ACTIVE';
    const room = await prisma.room.update({
      where: { id: roomId },
      data: { status, isAvailable: isBookable }
    });

    if (status === 'MAINTENANCE' || status === 'OUT_OF_SERVICE') {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const horizon = new Date(today); horizon.setDate(horizon.getDate() + 30);
      const dates: Date[] = [];
      for (let d = new Date(today); d < horizon; d.setDate(d.getDate() + 1)) {
        dates.push(new Date(d));
      }
      const existing = await prisma.hotelAvailability.findMany({
        where: { roomId, date: { gte: today, lt: horizon } },
        select: { date: true }
      });
      const existingDates = new Set(existing.map(e => e.date.getTime()));
      const missing = dates.filter(d => !existingDates.has(d.getTime()));
      await prisma.$transaction([
        prisma.hotelAvailability.updateMany({
          where: { roomId, date: { gte: today, lt: horizon } },
          data: { isActive: false }
        }),
        ...(missing.length > 0 ? [prisma.hotelAvailability.createMany({
          data: missing.map(d => ({ roomId, date: d, totalRooms: own.room.totalRooms, bookedRooms: 0, isActive: false })) as Prisma.HotelAvailabilityCreateManyInput[]
        })] : [])
      ]);
    }

    if (status === 'ACTIVE') {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const horizon = new Date(today); horizon.setDate(horizon.getDate() + 30);
      const dates: Date[] = [];
      for (let d = new Date(today); d < horizon; d.setDate(d.getDate() + 1)) {
        dates.push(new Date(d));
      }
      const existing = await prisma.hotelAvailability.findMany({
        where: { roomId, date: { gte: today, lt: horizon } },
        select: { date: true }
      });
      const existingDates = new Set(existing.map(e => e.date.getTime()));
      const missing = dates.filter(d => !existingDates.has(d.getTime()));
      await prisma.$transaction([
        prisma.hotelAvailability.updateMany({
          where: { roomId, date: { gte: today, lt: horizon } },
          data: { isActive: true }
        }),
        ...(missing.length > 0 ? [prisma.hotelAvailability.createMany({
          data: missing.map(d => ({ roomId, date: d, totalRooms: own.room.totalRooms, bookedRooms: 0, isActive: true })) as Prisma.HotelAvailabilityCreateManyInput[]
        })] : [])
      ]);
    }

    if (notes) {
      await prisma.hotelMaintenanceRequest.create({
        data: {
          providerId: own.hotel.id,
          roomId,
          title: `Room status update: ${status}`,
          description: notes,
          category: 'OTHER',
          status: status === 'MAINTENANCE' ? 'IN_PROGRESS' : 'REPORTED'
        }
      });
    }

     await prisma.auditLog.create({
      data: {
        action: 'ROOM_OPERATIONAL_STATUS_UPDATED',
        actorId: req.user!.id,
        actorRole: req.user!.role,
        details: `Set room #${roomId} operational status to ${status}`,
        metadata: JSON.stringify({ roomId, status })
      }
    });

    return res.json({ message: `Room operational status set to ${status}`, room });
  } catch (err: any) {
    return res.status(500).json({ error: safeError(err) });
  }
});

// =====================================================================
// OPERATIONAL DASHBOARD
// =====================================================================

router.get('/dashboard/arrivals-today', authenticateJWT, requireRole(['vendor', 'admin']), async (req: AuthRequest, res) => {
  try {
    const hotelIds = await getVendorHotelIds(req.user!.id, req.user!.role);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);

    const bookings = await prisma.booking.findMany({
      where: {
        providerId: { in: hotelIds },
        category: 'hotel',
        travelDate: { gte: today, lt: tomorrow },
        status: { in: ['pending', 'confirmed'] }
      },
      include: {
        user: { select: { id: true, fullName: true, phone: true } },
        room: { select: { id: true, name: true, type: true } }
      },
      orderBy: { travelDate: 'asc' }
    });

    return res.json({
      date: today.toISOString().split('T')[0],
      count: bookings.length,
      arrivals: bookings.map(b => ({
        bookingId: b.id,
        bookingCode: b.bookingCode,
        guestName: b.user.fullName || b.user.phone,
        roomName: b.room?.name || 'N/A',
        status: b.status,
        paymentStatus: b.paymentStatus
      }))
    });
  } catch (err: any) {
    return res.status(500).json({ error: safeError(err) });
  }
});

router.get('/dashboard/departures-today', authenticateJWT, requireRole(['vendor', 'admin']), async (req: AuthRequest, res) => {
  try {
    const hotelIds = await getVendorHotelIds(req.user!.id, req.user!.role);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);

    const bookings = await prisma.booking.findMany({
      where: {
        providerId: { in: hotelIds },
        category: 'hotel',
        status: 'confirmed',
        returnDate: { gte: today, lt: tomorrow }
      },
      include: {
        user: { select: { id: true, fullName: true, phone: true } },
        room: { select: { id: true, name: true, type: true } }
      },
      orderBy: { returnDate: 'asc' }
    });

    return res.json({
      date: today.toISOString().split('T')[0],
      count: bookings.length,
      departures: bookings.map(b => ({
        bookingId: b.id,
        bookingCode: b.bookingCode,
        guestName: b.user.fullName || b.user.phone,
        roomName: b.room?.name || 'N/A',
        status: b.status
      }))
    });
  } catch (err: any) {
    return res.status(500).json({ error: safeError(err) });
  }
});

router.get('/dashboard/current-guests', authenticateJWT, requireRole(['vendor', 'admin']), async (req: AuthRequest, res) => {
  try {
    const hotelIds = await getVendorHotelIds(req.user!.id, req.user!.role);

    const bookings = await prisma.booking.findMany({
      where: {
        providerId: { in: hotelIds },
        category: 'hotel',
        status: 'confirmed',
        checkedInAt: { not: null }
      },
      include: {
        user: { select: { id: true, fullName: true, phone: true } },
        room: { select: { id: true, name: true, type: true } }
      },
      orderBy: { checkedInAt: 'desc' }
    });

    return res.json({ count: bookings.length, guests: bookings });
  } catch (err: any) {
    return res.status(500).json({ error: safeError(err) });
  }
});

router.get('/dashboard/rooms-status', authenticateJWT, requireRole(['vendor', 'admin']), async (req: AuthRequest, res) => {
  try {
    const hotelIds = await getVendorHotelIds(req.user!.id, req.user!.role);

    const rooms = await prisma.room.findMany({
      where: { providerId: { in: hotelIds } },
      select: {
        id: true,
        name: true,
        type: true,
        status: true,
        isAvailable: true,
        totalRooms: true,
        providerId: true
      }
    });

    const byStatus = rooms.reduce((acc, r) => {
      const key = r.status || 'ACTIVE';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return res.json({
      total: rooms.length,
      byStatus,
      rooms
    });
  } catch (err: any) {
    return res.status(500).json({ error: safeError(err) });
  }
});

router.get('/dashboard/housekeeping', authenticateJWT, requireRole(['vendor', 'admin']), async (req: AuthRequest, res) => {
  try {
    const hotelIds = await getVendorHotelIds(req.user!.id, req.user!.role);

    const pending = await prisma.housekeepingTask.count({
      where: { providerId: { in: hotelIds }, status: 'PENDING' }
    });
    const inProgress = await prisma.housekeepingTask.count({
      where: { providerId: { in: hotelIds }, status: 'IN_PROGRESS' }
    });
    const completedToday = await prisma.housekeepingTask.count({
      where: {
        providerId: { in: hotelIds },
        status: 'COMPLETED',
        completedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) }
      }
    });

    const tasks = await prisma.housekeepingTask.findMany({
      where: { providerId: { in: hotelIds }, status: { in: ['PENDING', 'IN_PROGRESS'] } },
      include: {
        provider: { select: { id: true, businessName: true } },
        room: { select: { id: true, name: true, roomNumber: true } }
      },
      orderBy: { createdAt: 'asc' }
    });

    const tasksWithRoom = tasks.map((t) => ({ ...t, room: t.room ? { id: t.room.id, name: t.room.name, roomNumber: t.room.roomNumber } : null }));

    return res.json({ pending, inProgress, completedToday, tasks: tasksWithRoom });
  } catch (err: any) {
    return res.status(500).json({ error: safeError(err) });
  }
});

router.get('/dashboard/maintenance', authenticateJWT, requireRole(['vendor', 'admin']), async (req: AuthRequest, res) => {
  try {
    const hotelIds = await getVendorHotelIds(req.user!.id, req.user!.role);

    const open = await prisma.hotelMaintenanceRequest.count({
      where: { providerId: { in: hotelIds }, status: { in: ['REPORTED', 'ASSIGNED', 'IN_PROGRESS'] } }
    });
    const resolved = await prisma.hotelMaintenanceRequest.count({
      where: { providerId: { in: hotelIds }, status: 'RESOLVED' }
    });

    const requests = await prisma.hotelMaintenanceRequest.findMany({
      where: { providerId: { in: hotelIds }, status: { in: ['REPORTED', 'ASSIGNED', 'IN_PROGRESS'] } },
      include: {
        provider: { select: { id: true, businessName: true } },
        room: { select: { id: true, name: true, roomNumber: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    const requestsWithRoom = requests.map((r) => ({ ...r, room: r.room ? { id: r.room.id, name: r.room.name, roomNumber: r.room.roomNumber } : null }));

    return res.json({ open, resolved, requests: requestsWithRoom });
  } catch (err: any) {
    return res.status(500).json({ error: safeError(err) });
  }
});

router.get('/dashboard/upcoming-bookings', authenticateJWT, requireRole(['vendor', 'admin']), async (req: AuthRequest, res) => {
  try {
    const hotelIds = await getVendorHotelIds(req.user!.id, req.user!.role);
    const today = new Date(); today.setHours(0, 0, 0, 0);

    const bookings = await prisma.booking.findMany({
      where: {
        providerId: { in: hotelIds },
        category: 'hotel',
        status: { in: ['pending', 'confirmed'] },
        travelDate: { gte: today }
      },
      include: {
        user: { select: { id: true, fullName: true, phone: true } },
        room: { select: { id: true, name: true, type: true } }
      },
      orderBy: { travelDate: 'asc' },
      take: 100
    });

    return res.json({ count: bookings.length, bookings });
  } catch (err: any) {
    return res.status(500).json({ error: safeError(err) });
  }
});

router.get('/dashboard/cancelled-bookings', authenticateJWT, requireRole(['vendor', 'admin']), async (req: AuthRequest, res) => {
  try {
    const hotelIds = await getVendorHotelIds(req.user!.id, req.user!.role);

    const bookings = await prisma.booking.findMany({
      where: {
        providerId: { in: hotelIds },
        category: 'hotel',
        status: 'cancelled'
      },
      include: {
        user: { select: { id: true, fullName: true, phone: true } },
        room: { select: { id: true, name: true, type: true } }
      },
      orderBy: { cancelledAt: 'desc' },
      take: 100
    });

    return res.json({ count: bookings.length, bookings });
  } catch (err: any) {
    return res.status(500).json({ error: safeError(err) });
  }
});

export default router;
