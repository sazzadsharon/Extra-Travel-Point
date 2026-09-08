import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { authenticateJWT, AuthRequest, requireRole } from '../middleware/auth';
import { calculatePrice, datesInRange, nightsBetween } from '../utils/pricing';
import { safeError } from '../utils/safeError';

const router = Router();

const hotelCreateSchema = z.object({
  businessName: z.string().min(2).max(200),
  description: z.string().optional(),
  address: z.string().min(1).max(500),
  city: z.string().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  phone: z.string().optional(),
  starRating: z.number().int().min(1).max(5).optional(),
  onboardingMode: z.enum(['SIMPLE', 'ADVANCED']).optional().default('ADVANCED')
});

const hotelUpdateSchema = hotelCreateSchema.partial();

const imageSchema = z.object({
  url: z.string().min(1).max(1000),
  caption: z.string().max(200).optional(),
  isPrimary: z.boolean().optional().default(false),
  sortOrder: z.number().int().optional().default(0)
});

const amenitySchema = z.object({
  name: z.string().min(1).max(100),
  icon: z.string().max(50).optional()
});

const policySchema = z.object({
  cancellationPolicy: z.string().optional(),
  checkInTime: z.string().optional(),
  checkOutTime: z.string().optional(),
  childPolicy: z.string().optional(),
  petPolicy: z.string().optional(),
  smokingPolicy: z.string().optional()
});

const ratePlanSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  mealPlan: z.string().optional().default('RO'),
  refundable: z.boolean().optional().default(true),
  price: z.number().nonnegative(),
  currency: z.string().optional().default('BDT'),
  minStay: z.number().int().positive().optional().default(1),
  maxStay: z.number().int().positive().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  isActive: z.boolean().optional().default(true)
});

const promotionSchema = z.object({
  code: z.string().min(2).max(50),
  name: z.string().min(2).max(150),
  description: z.string().optional(),
  discountType: z.enum(['percentage', 'fixed']),
  discountValue: z.number().positive(),
  minNights: z.number().int().positive().optional().default(1),
  minAmount: z.number().nonnegative().optional().default(0),
  usageLimit: z.number().int().positive().optional(),
  validFrom: z.string(),
  validUntil: z.string()
});

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
}

async function ensureOwnership(hotelId: number, userId: number, role: string) {
  const hotel = await prisma.serviceProvider.findUnique({ where: { id: hotelId } });
  if (!hotel || hotel.category !== 'hotel') return { ok: false as const, status: 404, error: 'Hotel not found' };
  if (hotel.userId !== userId && role !== 'admin') return { ok: false as const, status: 403, error: 'Access denied' };
  return { ok: true as const, hotel };
}

router.post('/manage', authenticateJWT, requireRole(['vendor', 'admin']), async (req: AuthRequest, res) => {
  try {
    const parse = hotelCreateSchema.safeParse(req.body);
    if (!parse.success) return res.status(400).json({ error: parse.error.issues });

    const existing = await prisma.serviceProvider.findFirst({ where: { userId: req.user!.id, category: 'hotel' } });
    if (existing && req.user!.role !== 'admin') {
      return res.status(409).json({ error: 'You already own a hotel. Update it instead.' });
    }

    let slug = slugify(parse.data.businessName);
    let suffix = 0;
    while (await prisma.serviceProvider.findUnique({ where: { slug } })) {
      suffix += 1;
      slug = `${slugify(parse.data.businessName)}-${suffix}`;
    }

    const hotel = await prisma.serviceProvider.create({
      data: {
        userId: req.user!.id,
        businessName: parse.data.businessName,
        category: 'hotel',
        description: parse.data.description,
        address: parse.data.address,
        city: parse.data.city,
        latitude: parse.data.latitude,
        longitude: parse.data.longitude,
        phone: parse.data.phone,
        starRating: parse.data.starRating,
        onboardingMode: parse.data.onboardingMode,
        slug,
        status: 'PENDING',
        lifecycleStatus: 'DRAFT',
        isVerified: false,
        isActive: false,
        isPublished: false
      }
    });

    return res.status(201).json({ message: 'Hotel created in DRAFT. Submit for admin approval when ready.', hotel });
  } catch (err: any) {
    return res.status(500).json({ error: safeError(err) });
  }
});

router.get('/manage/mine', authenticateJWT, requireRole(['vendor', 'admin']), async (req: AuthRequest, res) => {
  try {
    const hotels = await prisma.serviceProvider.findMany({
      where: { userId: req.user!.id, category: 'hotel' },
      include: {
        rooms: true,
        hotelImages: { orderBy: { sortOrder: 'asc' } },
        hotelAmenities: true,
        hotelPolicy: true
      },
      orderBy: { createdAt: 'desc' }
    });
    return res.json({ count: hotels.length, hotels });
  } catch (err: any) {
    return res.status(500).json({ error: safeError(err) });
  }
});

router.get('/manage/:id', authenticateJWT, requireRole(['vendor', 'admin']), async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
    const own = await ensureOwnership(id, req.user!.id, req.user!.role);
    if (!own.ok) return res.status(own.status).json({ error: own.error });
    const hotel = await prisma.serviceProvider.findUnique({
      where: { id },
      include: {
        rooms: { include: { ratePlans: true } },
        hotelImages: { orderBy: { sortOrder: 'asc' } },
        hotelAmenities: true,
        hotelPolicy: true,
        hotelPromotions: { where: { isActive: true } }
      }
    });
    return res.json({ hotel });
  } catch (err: any) {
    return res.status(500).json({ error: safeError(err) });
  }
});

router.patch('/manage/:id', authenticateJWT, requireRole(['vendor', 'admin']), async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
    const own = await ensureOwnership(id, req.user!.id, req.user!.role);
    if (!own.ok) return res.status(own.status).json({ error: own.error });
    const parse = hotelUpdateSchema.safeParse(req.body);
    if (!parse.success) return res.status(400).json({ error: parse.error.issues });
    const updated = await prisma.serviceProvider.update({ where: { id }, data: parse.data });
    return res.json({ message: 'Hotel updated', hotel: updated });
  } catch (err: any) {
    return res.status(500).json({ error: safeError(err) });
  }
});

router.post('/manage/:id/submit', authenticateJWT, requireRole(['vendor', 'admin']), async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
    const own = await ensureOwnership(id, req.user!.id, req.user!.role);
    if (!own.ok) return res.status(own.status).json({ error: own.error });

    const hotel = own.hotel;
    const errors: string[] = [];
    if (!hotel.businessName || hotel.businessName.trim().length < 2) errors.push('Hotel name is required');
    if (!hotel.address || hotel.address.trim().length < 1) errors.push('Address is required');
    if (!hotel.phone || hotel.phone.trim().length < 1) errors.push('Contact phone is required');

    const rooms = await prisma.room.findMany({ where: { providerId: id } });
    if (rooms.length === 0) {
      errors.push('At least one room type is required');
    } else {
      const hasPricedRoom = rooms.some(r => r.price > 0);
      if (!hasPricedRoom) errors.push('At least one room must have a price greater than 0');
    }

    if (errors.length > 0) {
      return res.status(400).json({ error: 'Incomplete hotel information', details: errors });
    }

    const updated = await prisma.serviceProvider.update({
      where: { id },
      data: { lifecycleStatus: 'PENDING_APPROVAL', status: 'PENDING' }
    });
    return res.json({ message: 'Hotel submitted for admin approval', hotel: updated });
  } catch (err: any) {
    return res.status(500).json({ error: safeError(err) });
  }
});

router.post('/manage/:id/publish', authenticateJWT, requireRole(['vendor', 'admin']), async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
    const own = await ensureOwnership(id, req.user!.id, req.user!.role);
    if (!own.ok) return res.status(own.status).json({ error: own.error });
    if (own.hotel.status !== 'APPROVED') {
      return res.status(400).json({ error: 'Hotel must be approved by admin before publishing.' });
    }
    const updated = await prisma.serviceProvider.update({
      where: { id },
      data: { isPublished: true, publishedAt: new Date(), lifecycleStatus: 'APPROVED', isActive: true }
    });
    return res.json({ message: 'Hotel published', hotel: updated });
  } catch (err: any) {
    return res.status(500).json({ error: safeError(err) });
  }
});

router.post('/manage/:id/unpublish', authenticateJWT, requireRole(['vendor', 'admin']), async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
    const own = await ensureOwnership(id, req.user!.id, req.user!.role);
    if (!own.ok) return res.status(own.status).json({ error: own.error });
    const updated = await prisma.serviceProvider.update({
      where: { id },
      data: { isPublished: false, isActive: false, lifecycleStatus: 'INACTIVE' }
    });
    return res.json({ message: 'Hotel unpublished', hotel: updated });
  } catch (err: any) {
    return res.status(500).json({ error: safeError(err) });
  }
});

router.post('/manage/:id/images', authenticateJWT, requireRole(['vendor', 'admin']), async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
    const own = await ensureOwnership(id, req.user!.id, req.user!.role);
    if (!own.ok) return res.status(own.status).json({ error: own.error });
    const arr = z.array(imageSchema).min(1).max(20).safeParse(req.body);
    if (!arr.success) return res.status(400).json({ error: arr.error.issues });
    if (arr.data.some(i => i.isPrimary)) {
      await prisma.hotelImage.updateMany({ where: { providerId: id }, data: { isPrimary: false } });
    }
    const created = await prisma.$transaction(
      arr.data.map(img => prisma.hotelImage.create({ data: { providerId: id, ...img } }))
    );
    return res.status(201).json({ message: 'Images added', images: created });
  } catch (err: any) {
    return res.status(500).json({ error: safeError(err) });
  }
});

router.delete('/manage/:id/images/:imageId', authenticateJWT, requireRole(['vendor', 'admin']), async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id);
    const imageId = parseInt(req.params.imageId);
    if (!Number.isFinite(id) || !Number.isFinite(imageId)) return res.status(400).json({ error: 'Invalid id' });
    const own = await ensureOwnership(id, req.user!.id, req.user!.role);
    if (!own.ok) return res.status(own.status).json({ error: own.error });
    await prisma.hotelImage.delete({ where: { id: imageId } });
    return res.json({ message: 'Image deleted' });
  } catch (err: any) {
    return res.status(500).json({ error: safeError(err) });
  }
});

router.post('/manage/:id/amenities', authenticateJWT, requireRole(['vendor', 'admin']), async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
    const own = await ensureOwnership(id, req.user!.id, req.user!.role);
    if (!own.ok) return res.status(own.status).json({ error: own.error });
    const arr = z.array(amenitySchema).min(1).max(50).safeParse(req.body);
    if (!arr.success) return res.status(400).json({ error: arr.error.issues });
    const result = await prisma.$transaction(
      arr.data.map(a => prisma.hotelAmenity.upsert({
        where: { providerId_name: { providerId: id, name: a.name } },
        update: { icon: a.icon },
        create: { providerId: id, name: a.name, icon: a.icon }
      }))
    );
    return res.status(201).json({ message: 'Amenities saved', amenities: result });
  } catch (err: any) {
    return res.status(500).json({ error: safeError(err) });
  }
});

router.delete('/manage/:id/amenities/:amenityId', authenticateJWT, requireRole(['vendor', 'admin']), async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id);
    const amenityId = parseInt(req.params.amenityId);
    if (!Number.isFinite(id) || !Number.isFinite(amenityId)) return res.status(400).json({ error: 'Invalid id' });
    const own = await ensureOwnership(id, req.user!.id, req.user!.role);
    if (!own.ok) return res.status(own.status).json({ error: own.error });
    await prisma.hotelAmenity.delete({ where: { id: amenityId } });
    return res.json({ message: 'Amenity removed' });
  } catch (err: any) {
    return res.status(500).json({ error: safeError(err) });
  }
});

router.put('/manage/:id/policy', authenticateJWT, requireRole(['vendor', 'admin']), async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
    const own = await ensureOwnership(id, req.user!.id, req.user!.role);
    if (!own.ok) return res.status(own.status).json({ error: own.error });
    const parse = policySchema.safeParse(req.body);
    if (!parse.success) return res.status(400).json({ error: parse.error.issues });
    const policy = await prisma.hotelPolicy.upsert({
      where: { providerId: id },
      update: parse.data,
      create: { providerId: id, ...parse.data }
    });
    return res.json({ message: 'Policy saved', policy });
  } catch (err: any) {
    return res.status(500).json({ error: safeError(err) });
  }
});

router.post('/rooms/:roomId/rate-plans', authenticateJWT, requireRole(['vendor', 'admin']), async (req: AuthRequest, res) => {
  try {
    const roomId = parseInt(req.params.roomId);
    if (!Number.isFinite(roomId) || roomId <= 0) return res.status(400).json({ error: 'Invalid id' });
    const room = await prisma.room.findUnique({ where: { id: roomId } });
    if (!room) return res.status(404).json({ error: 'Room not found' });
    const own = await ensureOwnership(room.providerId, req.user!.id, req.user!.role);
    if (!own.ok) return res.status(own.status).json({ error: own.error });
    const parse = ratePlanSchema.safeParse(req.body);
    if (!parse.success) return res.status(400).json({ error: parse.error.issues });
    const plan = await prisma.ratePlan.create({
      data: {
        roomId,
        name: parse.data.name,
        description: parse.data.description,
        mealPlan: parse.data.mealPlan,
        refundable: parse.data.refundable,
        price: parse.data.price,
        currency: parse.data.currency,
        minStay: parse.data.minStay,
        maxStay: parse.data.maxStay,
        isActive: parse.data.isActive,
        startDate: parse.data.startDate ? new Date(parse.data.startDate) : null,
        endDate: parse.data.endDate ? new Date(parse.data.endDate) : null
      }
    });
    return res.status(201).json({ message: 'Rate plan created', plan });
  } catch (err: any) {
    return res.status(500).json({ error: safeError(err) });
  }
});

router.get('/rooms/:roomId/rate-plans', async (req, res) => {
  try {
    const roomId = parseInt(req.params.roomId);
    if (!Number.isFinite(roomId)) return res.status(400).json({ error: 'Invalid id' });
    const room = await prisma.room.findUnique({ where: { id: roomId } });
    if (!room) return res.status(404).json({ error: 'Room not found' });
    const hotel = await prisma.serviceProvider.findFirst({
      where: { id: room.providerId, category: 'hotel', isVerified: true, isActive: true, status: 'APPROVED', lifecycleStatus: 'APPROVED', isPublished: true }
    });
    if (!hotel) return res.status(404).json({ error: 'Room not found' });
    const plans = await prisma.ratePlan.findMany({ where: { roomId, isActive: true }, orderBy: { price: 'asc' } });
    return res.json({ count: plans.length, plans });
  } catch (err: any) {
    return res.status(500).json({ error: safeError(err) });
  }
});

router.patch('/rooms/:roomId/rate-plans/:planId', authenticateJWT, requireRole(['vendor', 'admin']), async (req: AuthRequest, res) => {
  try {
    const roomId = parseInt(req.params.roomId);
    const planId = parseInt(req.params.planId);
    if (!Number.isFinite(roomId) || !Number.isFinite(planId)) return res.status(400).json({ error: 'Invalid id' });
    const room = await prisma.room.findUnique({ where: { id: roomId } });
    if (!room) return res.status(404).json({ error: 'Room not found' });
    const own = await ensureOwnership(room.providerId, req.user!.id, req.user!.role);
    if (!own.ok) return res.status(own.status).json({ error: own.error });

    const plan = await prisma.ratePlan.findUnique({ where: { id: planId } });
    if (!plan || plan.roomId !== roomId) return res.status(404).json({ error: 'Rate plan not found' });

    const updateSchema = ratePlanSchema.partial();
    const parse = updateSchema.safeParse(req.body);
    if (!parse.success) return res.status(400).json({ error: parse.error.issues });

    const updated = await prisma.ratePlan.update({
      where: { id: planId },
      data: {
        name: parse.data.name,
        description: parse.data.description,
        mealPlan: parse.data.mealPlan,
        refundable: parse.data.refundable,
        price: parse.data.price,
        currency: parse.data.currency,
        minStay: parse.data.minStay,
        maxStay: parse.data.maxStay,
        isActive: parse.data.isActive,
        startDate: parse.data.startDate ? new Date(parse.data.startDate) : undefined,
        endDate: parse.data.endDate ? new Date(parse.data.endDate) : undefined
      }
    });
    return res.json({ message: 'Rate plan updated', plan: updated });
  } catch (err: any) {
    return res.status(500).json({ error: safeError(err) });
  }
});

router.delete('/rooms/:roomId/rate-plans/:planId', authenticateJWT, requireRole(['vendor', 'admin']), async (req: AuthRequest, res) => {
  try {
    const roomId = parseInt(req.params.roomId);
    const planId = parseInt(req.params.planId);
    if (!Number.isFinite(roomId) || !Number.isFinite(planId)) return res.status(400).json({ error: 'Invalid id' });
    const room = await prisma.room.findUnique({ where: { id: roomId } });
    if (!room) return res.status(404).json({ error: 'Room not found' });
    const own = await ensureOwnership(room.providerId, req.user!.id, req.user!.role);
    if (!own.ok) return res.status(own.status).json({ error: own.error });

    const plan = await prisma.ratePlan.findUnique({ where: { id: planId } });
    if (!plan || plan.roomId !== roomId) return res.status(404).json({ error: 'Rate plan not found' });

    await prisma.ratePlan.update({ where: { id: planId }, data: { isActive: false } });
    return res.json({ message: 'Rate plan deactivated' });
  } catch (err: any) {
    return res.status(500).json({ error: safeError(err) });
  }
});

router.post('/manage/:id/promotions', authenticateJWT, requireRole(['vendor', 'admin']), async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
    const own = await ensureOwnership(id, req.user!.id, req.user!.role);
    if (!own.ok) return res.status(own.status).json({ error: own.error });
    const parse = promotionSchema.safeParse(req.body);
    if (!parse.success) return res.status(400).json({ error: parse.error.issues });
    const promo = await prisma.hotelPromotion.create({
      data: {
        providerId: id,
        code: parse.data.code.toUpperCase(),
        name: parse.data.name,
        description: parse.data.description,
        discountType: parse.data.discountType,
        discountValue: parse.data.discountValue,
        minNights: parse.data.minNights,
        minAmount: parse.data.minAmount,
        usageLimit: parse.data.usageLimit,
        validFrom: new Date(parse.data.validFrom),
        validUntil: new Date(parse.data.validUntil)
      }
    });
    return res.status(201).json({ message: 'Promotion created', promotion: promo });
  } catch (err: any) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'Promotion code already exists' });
    return res.status(500).json({ error: safeError(err) });
  }
});

router.get('/manage/:id/promotions', authenticateJWT, requireRole(['vendor', 'admin']), async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
    const own = await ensureOwnership(id, req.user!.id, req.user!.role);
    if (!own.ok) return res.status(own.status).json({ error: own.error });
    const promos = await prisma.hotelPromotion.findMany({ where: { providerId: id }, orderBy: { createdAt: 'desc' } });
    return res.json({ count: promos.length, promotions: promos });
  } catch (err: any) {
    return res.status(500).json({ error: safeError(err) });
  }
});

router.post('/quote', async (req, res) => {
  try {
    const schema = z.object({
      roomId: z.number().int().positive(),
      ratePlanId: z.number().int().positive().optional(),
      checkIn: z.string().refine(v => !isNaN(Date.parse(v))),
      checkOut: z.string().refine(v => !isNaN(Date.parse(v))),
      promoCode: z.string().optional(),
      numberOfRooms: z.number().int().positive().optional().default(1)
    });
    const parse = schema.safeParse(req.body);
    if (!parse.success) return res.status(400).json({ error: parse.error.issues });

    const { roomId, ratePlanId, promoCode, numberOfRooms } = parse.data;

    const room = await prisma.room.findUnique({ where: { id: roomId } });
    if (!room) return res.status(404).json({ error: 'Room not found' });

    const checkIn = new Date(parse.data.checkIn);
    const checkOut = new Date(parse.data.checkOut);
    checkIn.setHours(0, 0, 0, 0);
    checkOut.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (checkIn < today) return res.status(400).json({ error: 'Check-in date cannot be in the past' });
    if (checkOut <= checkIn) return res.status(400).json({ error: 'Invalid date range' });
    const nights = nightsBetween(checkIn, checkOut);
    if (nights > 365) return res.status(400).json({ error: 'Stay duration cannot exceed 365 nights' });

    let ratePlan = null as null | { id: number; name: string; price: number; currency: string; mealPlan: string; refundable: boolean; minStay: number; maxStay: number | null };
    if (ratePlanId != null) {
      const rp = await prisma.ratePlan.findUnique({ where: { id: ratePlanId } });
      if (!rp || rp.roomId !== roomId) {
        return res.status(404).json({ error: 'Rate plan not found for this room' });
      }
      if (!rp.isActive) {
        return res.status(400).json({ error: 'Selected rate plan is inactive' });
      }
      if (rp.startDate && checkIn < rp.startDate) {
        return res.status(400).json({ error: 'Booking check-in date is before rate plan start date' });
      }
      if (rp.endDate && checkOut > rp.endDate) {
        return res.status(400).json({ error: 'Booking check-out date is after rate plan end date' });
      }
      if (rp.minStay && nights < rp.minStay) {
        return res.status(400).json({ error: `Rate plan requires a minimum stay of ${rp.minStay} night(s)` });
      }
      if (rp.maxStay && nights > rp.maxStay) {
        return res.status(400).json({ error: `Rate plan allows a maximum stay of ${rp.maxStay} night(s)` });
      }
      ratePlan = {
        id: rp.id,
        name: rp.name,
        price: rp.price,
        currency: rp.currency,
        mealPlan: rp.mealPlan,
        refundable: rp.refundable,
        minStay: rp.minStay,
        maxStay: rp.maxStay
      };
    }

    const effectivePrice = ratePlan ? ratePlan.price : room.price;
    const effectiveCurrency = ratePlan ? ratePlan.currency : room.baseCurrency;

    let promotion = null;
    if (promoCode) {
      const now = new Date();
      const p = await prisma.hotelPromotion.findFirst({
        where: {
          providerId: room.providerId,
          code: promoCode.toUpperCase(),
          isActive: true,
          validFrom: { lte: now },
          validUntil: { gte: now }
        }
      });
      if (p) {
        const exceedsUsage = p.usageLimit != null && p.usedCount >= p.usageLimit;
        if (!exceedsUsage) {
          promotion = {
            discountType: (p.discountType === 'percentage' ? 'percentage' : 'fixed') as 'percentage' | 'fixed',
            discountValue: p.discountValue,
            minNights: p.minNights,
            minAmount: p.minAmount
          };
        }
      }
    }

    // Aggregate active hotel taxes (sum of percentage / fixed)
    const taxes = await prisma.hotelTax.findMany({
      where: { providerId: room.providerId, isActive: true }
    });
    const taxRate = taxes
      .filter(t => t.type === 'percentage')
      .reduce((s, t) => s + (Number.isFinite(t.value) ? t.value : 0), 0);
    const taxFlat = taxes
      .filter(t => t.type === 'fixed')
      .reduce((s, t) => s + (Number.isFinite(t.value) ? t.value : 0), 0);

    const breakdown = calculatePrice({
      basePrice: effectivePrice,
      nights,
      currency: effectiveCurrency,
      promotion,
      taxRate,
      serviceFeeFlat: taxFlat
    });

    // Multiply by numberOfRooms
    if (numberOfRooms > 1) {
      breakdown.baseAmount = Math.round(breakdown.baseAmount * numberOfRooms * 100) / 100;
      breakdown.taxAmount = Math.round(breakdown.taxAmount * numberOfRooms * 100) / 100;
      breakdown.serviceFee = Math.round(breakdown.serviceFee * numberOfRooms * 100) / 100;
      breakdown.discountAmount = Math.round(breakdown.discountAmount * numberOfRooms * 100) / 100;
      breakdown.finalAmount = Math.round(breakdown.finalAmount * numberOfRooms * 100) / 100;
    }

    return res.json({ roomId: room.id, ratePlanId: ratePlan?.id ?? null, ratePlanName: ratePlan?.name ?? null, checkIn, checkOut, nights, numberOfRooms, breakdown, taxesApplied: taxes.length });
  } catch (err: any) {
    return res.status(500).json({ error: safeError(err) });
  }
});

// Hotel tax CRUD
const taxSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['percentage', 'fixed']),
  value: z.number().nonnegative(),
  isInclusive: z.boolean().optional().default(false)
});

router.post('/manage/:id/taxes', authenticateJWT, requireRole(['vendor', 'admin']), async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
    const own = await ensureOwnership(id, req.user!.id, req.user!.role);
    if (!own.ok) return res.status(own.status).json({ error: own.error });
    const arr = z.array(taxSchema).min(1).max(10).safeParse(req.body);
    if (!arr.success) return res.status(400).json({ error: arr.error.issues });
    const result = await prisma.$transaction(
      arr.data.map(t => prisma.hotelTax.create({ data: { providerId: id, ...t } }))
    );
    return res.status(201).json({ message: 'Taxes added', taxes: result });
  } catch (err: any) {
    return res.status(500).json({ error: safeError(err) });
  }
});

router.delete('/manage/:id/taxes/:taxId', authenticateJWT, requireRole(['vendor', 'admin']), async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id);
    const taxId = parseInt(req.params.taxId);
    const own = await ensureOwnership(id, req.user!.id, req.user!.role);
    if (!own.ok) return res.status(own.status).json({ error: own.error });
    await prisma.hotelTax.delete({ where: { id: taxId } });
    return res.json({ message: 'Tax removed' });
  } catch (err: any) {
    return res.status(500).json({ error: safeError(err) });
  }
});

router.post('/rooms/:roomId/availability/bulk', authenticateJWT, requireRole(['vendor', 'admin']), async (req: AuthRequest, res) => {
  try {
    const roomId = parseInt(req.params.roomId);
    if (!Number.isFinite(roomId) || roomId <= 0) return res.status(400).json({ error: 'Invalid id' });
    const room = await prisma.room.findUnique({ where: { id: roomId } });
    if (!room) return res.status(404).json({ error: 'Room not found' });
    const own = await ensureOwnership(room.providerId, req.user!.id, req.user!.role);
    if (!own.ok) return res.status(own.status).json({ error: own.error });

    const schema = z.object({
      from: z.string().refine(v => !isNaN(Date.parse(v))),
      to: z.string().refine(v => !isNaN(Date.parse(v))),
      totalRooms: z.number().int().positive(),
      isActive: z.boolean().optional().default(true)
    });
    const parse = schema.safeParse(req.body);
    if (!parse.success) return res.status(400).json({ error: parse.error.issues });

    const from = new Date(parse.data.from); from.setHours(0, 0, 0, 0);
    const to = new Date(parse.data.to); to.setHours(0, 0, 0, 0);
    if (to < from) return res.status(400).json({ error: 'Invalid range' });

    const dates = datesInRange(from, to);
    if (dates.length === 0) return res.json({ message: 'No dates in range', saved: 0 });
    if (dates.length > 366) return res.status(400).json({ error: 'Range too large (max 366 nights)' });

    const ops = dates.map(d => prisma.hotelAvailability.upsert({
      where: { roomId_date: { roomId, date: d } },
      update: { totalRooms: parse.data.totalRooms, isActive: parse.data.isActive },
      create: { roomId, date: d, totalRooms: parse.data.totalRooms, bookedRooms: 0, isActive: parse.data.isActive }
    }));
    const result = await prisma.$transaction(ops);
    return res.json({ message: 'Bulk availability saved', count: result.length });
  } catch (err: any) {
    return res.status(500).json({ error: safeError(err) });
  }
});

router.get('/rooms/:roomId/availability', async (req, res) => {
  try {
    const roomId = parseInt(req.params.roomId);
    if (!Number.isFinite(roomId) || roomId <= 0) return res.status(400).json({ error: 'Invalid id' });
    const from = req.query.from ? new Date(String(req.query.from)) : null;
    const to = req.query.to ? new Date(String(req.query.to)) : null;
    const where: any = { roomId };
    if (from || to) {
      where.date = {};
      if (from) { const f = new Date(from); f.setHours(0, 0, 0, 0); where.date.gte = f; }
      if (to) { const t = new Date(to); t.setHours(23, 59, 59, 999); where.date.lte = t; }
    }
    const avail = await prisma.hotelAvailability.findMany({ where, orderBy: { date: 'asc' } });
    return res.json({ count: avail.length, availability: avail });
  } catch (err: any) {
    return res.status(500).json({ error: safeError(err) });
  }
});

router.post('/admin/:id/approve', authenticateJWT, requireRole(['admin']), async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
    const hotel = await prisma.serviceProvider.findUnique({ where: { id } });
    if (!hotel || hotel.category !== 'hotel') return res.status(404).json({ error: 'Hotel not found' });
    const updated = await prisma.serviceProvider.update({
      where: { id },
      data: { status: 'APPROVED', isVerified: true, isActive: true, verifiedAt: new Date(), lifecycleStatus: 'APPROVED' }
    });
    await prisma.auditLog.create({
      data: {
        action: 'HOTEL_APPROVED',
        actorId: req.user!.id,
        actorRole: req.user!.role,
        details: `Approved hotel #${id} ${updated.businessName}`,
        metadata: JSON.stringify({ hotelId: id })
      }
    });
    return res.json({ message: 'Hotel approved', hotel: updated });
  } catch (err: any) {
    return res.status(500).json({ error: safeError(err) });
  }
});

router.post('/admin/:id/suspend', authenticateJWT, requireRole(['admin']), async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
    const reason = z.string().max(500).optional().parse(req.body?.reason || undefined);
    const hotel = await prisma.serviceProvider.findUnique({ where: { id } });
    if (!hotel || hotel.category !== 'hotel') return res.status(404).json({ error: 'Hotel not found' });
    const updated = await prisma.serviceProvider.update({
      where: { id },
      data: { status: 'SUSPENDED', isActive: false, isPublished: false, lifecycleStatus: 'SUSPENDED', rejectionReason: reason || null }
    });
    await prisma.auditLog.create({
      data: {
        action: 'HOTEL_SUSPENDED',
        actorId: req.user!.id,
        actorRole: req.user!.role,
        details: `Suspended hotel #${id} ${updated.businessName}`,
        metadata: JSON.stringify({ hotelId: id, reason })
      }
    });
    return res.json({ message: 'Hotel suspended', hotel: updated });
  } catch (err: any) {
    return res.status(500).json({ error: safeError(err) });
  }
});

router.post('/admin/:id/reject', authenticateJWT, requireRole(['admin']), async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
    const reason = z.string().max(500).optional().parse(req.body?.reason || undefined);
    const hotel = await prisma.serviceProvider.findUnique({ where: { id } });
    if (!hotel || hotel.category !== 'hotel') return res.status(404).json({ error: 'Hotel not found' });
    const updated = await prisma.serviceProvider.update({
      where: { id },
      data: { status: 'REJECTED', lifecycleStatus: 'REJECTED', rejectionReason: reason || null }
    });
    await prisma.auditLog.create({
      data: {
        action: 'HOTEL_REJECTED',
        actorId: req.user!.id,
        actorRole: req.user!.role,
        details: `Rejected hotel #${id} ${updated.businessName}`,
        metadata: JSON.stringify({ hotelId: id, reason })
      }
    });
    return res.json({ message: 'Hotel rejected', hotel: updated });
  } catch (err: any) {
    return res.status(500).json({ error: safeError(err) });
  }
});

router.post('/admin/:id/reactivate', authenticateJWT, requireRole(['admin']), async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
    const hotel = await prisma.serviceProvider.findUnique({ where: { id } });
    if (!hotel || hotel.category !== 'hotel') return res.status(404).json({ error: 'Hotel not found' });
    const updated = await prisma.serviceProvider.update({
      where: { id },
      data: { status: 'PENDING', isActive: false, isPublished: false, lifecycleStatus: 'DRAFT', rejectionReason: null }
    });
    await prisma.auditLog.create({
      data: {
        action: 'HOTEL_REACTIVATED',
        actorId: req.user!.id,
        actorRole: req.user!.role,
        details: `Reactivated hotel #${id} ${updated.businessName}`,
        metadata: JSON.stringify({ hotelId: id })
      }
    });
    return res.json({ message: 'Hotel reactivated to DRAFT', hotel: updated });
  } catch (err: any) {
    return res.status(500).json({ error: safeError(err) });
  }
});

// Admin: list all hotels (filterable)
router.get('/admin/list', authenticateJWT, requireRole(['admin']), async (req: AuthRequest, res) => {
  try {
    const status = req.query.status ? String(req.query.status) : null;
    const lifecycleStatus = req.query.lifecycleStatus ? String(req.query.lifecycleStatus) : null;
    const city = req.query.city ? String(req.query.city) : null;
    const page = Math.max(1, parseInt(String(req.query.page || '1')));
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '20'))));

    const where: any = { category: 'hotel' };
    if (status) where.status = status;
    if (lifecycleStatus) where.lifecycleStatus = lifecycleStatus;
    if (city) where.city = city;

    const [total, hotels] = await Promise.all([
      prisma.serviceProvider.count({ where }),
      prisma.serviceProvider.findMany({
        where,
        include: {
          rooms: { select: { id: true, name: true, price: true, totalRooms: true } },
          hotelImages: { where: { isPrimary: true }, select: { url: true } }
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      })
    ]);

    return res.json({
      total,
      page,
      limit,
      count: hotels.length,
      hotels: hotels.map(h => ({
        id: h.id,
        businessName: h.businessName,
        slug: h.slug,
        city: h.city,
        address: h.address,
        starRating: h.starRating,
        status: h.status,
        lifecycleStatus: h.lifecycleStatus,
        isVerified: h.isVerified,
        isActive: h.isActive,
        isPublished: h.isPublished,
        rating: h.rating,
        totalReviews: h.totalReviews,
        roomCount: h.rooms.length,
        primaryImage: h.hotelImages?.[0]?.url || null,
        createdAt: h.createdAt,
        publishedAt: h.publishedAt
      }))
    });
  } catch (err: any) {
    return res.status(500).json({ error: safeError(err) });
  }
});

// Public: list promotions for a hotel
router.get('/:id/promotions/public', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
    const now = new Date();
    const promos = await prisma.hotelPromotion.findMany({
      where: {
        providerId: id,
        isActive: true,
        validFrom: { lte: now },
        validUntil: { gte: now }
      },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        discountType: true,
        discountValue: true,
        minNights: true,
        validUntil: true
      }
    });
    return res.json({ count: promos.length, promotions: promos });
  } catch (err: any) {
    return res.status(500).json({ error: safeError(err) });
  }
});

export default router;
