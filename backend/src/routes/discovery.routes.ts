import { Router } from 'express';
import { prisma } from '../prisma';

const router = Router();

// GET /api/v1/discovery/providers
// Public marketplace: only approved, active, published providers.
router.get('/providers', async (req, res) => {
  try {
    const { category, city, search, providerId } = req.query;
    const where: any = {
      status: 'APPROVED',
      isActive: true,
      isPublished: true,
    };

    if (category) where.category = String(category);
    if (city) where.city = { equals: String(city), mode: 'insensitive' };
    if (providerId) {
      const id = Number(providerId);
      if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid providerId' });
      where.id = id;
    }
    if (search) {
      const q = String(search);
      where.OR = [
        { businessName: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { city: { contains: q, mode: 'insensitive' } },
      ];
    }

    const providers = await prisma.serviceProvider.findMany({
      where,
      select: {
        id: true,
        businessName: true,
        category: true,
        description: true,
        address: true,
        city: true,
        latitude: true,
        longitude: true,
        logo: true,
        rating: true,
        totalReviews: true,
        isVerified: true,
        services: {
          where: { isActive: true, lifecycleStatus: 'PUBLISHED', status: 'ACTIVE' },
          select: { id: true, name: true, category: true, serviceType: true, price: true, currency: true, locationCity: true, images: true },
          orderBy: { id: 'asc' },
        },
      },
      orderBy: [{ rating: 'desc' }, { totalReviews: 'desc' }, { id: 'asc' }],
    });

    return res.json({ success: true, count: providers.length, providers });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to load marketplace providers' });
  }
});

// GET /api/v1/discovery/providers/:id
router.get('/providers/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid provider id' });

    const provider = await prisma.serviceProvider.findFirst({
      where: { id, status: 'APPROVED', isActive: true, isPublished: true },
      select: {
        id: true,
        businessName: true,
        category: true,
        description: true,
        address: true,
        city: true,
        latitude: true,
        longitude: true,
        logo: true,
        rating: true,
        totalReviews: true,
        isVerified: true,
        services: {
          where: { isActive: true, lifecycleStatus: 'PUBLISHED', status: 'ACTIVE' },
          select: {
            id: true, name: true, category: true, serviceType: true, description: true,
            route: true, price: true, currency: true, capacity: true, availability: true,
            locationCity: true, locationAddress: true, latitude: true, longitude: true,
            images: true, availableDays: true, startDate: true, endDate: true,
          },
          orderBy: { id: 'asc' },
        },
      },
    });

    if (!provider) return res.status(404).json({ error: 'Provider not found' });
    return res.json({ success: true, provider });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to load provider profile' });
  }
});

// GET /api/v1/discovery/services
router.get('/services', async (req, res) => {
  try {
    const { category, serviceType, city, providerId, minPrice, maxPrice, search } = req.query;
    const where: any = {
      isActive: true,
      status: 'ACTIVE',
      lifecycleStatus: 'PUBLISHED',
      provider: { status: 'APPROVED', isActive: true, isPublished: true },
    };

    if (category) where.category = String(category);
    if (serviceType) where.serviceType = String(serviceType);
    if (city) where.locationCity = { equals: String(city), mode: 'insensitive' };
    if (providerId) {
      const id = Number(providerId);
      if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid providerId' });
      where.providerId = id;
    }
    if (minPrice !== undefined) {
      const value = Number(minPrice);
      if (!Number.isFinite(value) || value < 0) return res.status(400).json({ error: 'Invalid minPrice' });
      where.price = { ...(where.price || {}), gte: value };
    }
    if (maxPrice !== undefined) {
      const value = Number(maxPrice);
      if (!Number.isFinite(value) || value < 0) return res.status(400).json({ error: 'Invalid maxPrice' });
      where.price = { ...(where.price || {}), lte: value };
    }
    if (search) {
      const q = String(search);
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { route: { contains: q, mode: 'insensitive' } },
      ];
    }

    const services = await prisma.service.findMany({
      where,
      select: {
        id: true, providerId: true, name: true, category: true, serviceType: true,
        description: true, route: true, price: true, currency: true, capacity: true,
        locationCity: true, locationAddress: true, latitude: true, longitude: true,
        images: true, availableDays: true, startDate: true, endDate: true,
        provider: {
          select: { id: true, businessName: true, category: true, city: true, logo: true, rating: true, totalReviews: true, isVerified: true },
        },
      },
      orderBy: [{ price: 'asc' }, { id: 'asc' }],
    });

    return res.json({ success: true, count: services.length, services });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to load marketplace services' });
  }
});

// GET /api/v1/discovery/services/:id
router.get('/services/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid service id' });

    const service = await prisma.service.findFirst({
      where: {
        id,
        isActive: true,
        status: 'ACTIVE',
        lifecycleStatus: 'PUBLISHED',
        provider: { status: 'APPROVED', isActive: true, isPublished: true },
      },
      select: {
        id: true, providerId: true, name: true, category: true, serviceType: true,
        description: true, route: true, price: true, currency: true, capacity: true,
        availability: true, locationCity: true, locationAddress: true,
        latitude: true, longitude: true, images: true, availableDays: true,
        startDate: true, endDate: true,
        provider: {
          select: { id: true, businessName: true, category: true, city: true, logo: true, rating: true, totalReviews: true, isVerified: true },
        },
        availabilities: {
          where: { isActive: true },
          orderBy: { date: 'asc' },
          select: { id: true, date: true, startTime: true, endTime: true, capacity: true, isActive: true },
        },
      },
    });

    if (!service) return res.status(404).json({ error: 'Service not found' });
    return res.json({ success: true, service });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to load marketplace service' });
  }
});

// GET /api/v1/discovery/services/:id/availability
router.get('/services/:id/availability', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid service id' });

    const availability = await prisma.serviceAvailability.findMany({
      where: {
        serviceId: id,
        isActive: true,
        service: { isActive: true, status: 'ACTIVE', lifecycleStatus: 'PUBLISHED', provider: { status: 'APPROVED', isActive: true, isPublished: true } },
      },
      select: { id: true, serviceId: true, date: true, startTime: true, endTime: true, capacity: true, isActive: true },
      orderBy: { date: 'asc' },
    });

    return res.json({ success: true, count: availability.length, availability });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to load service availability' });
  }
});

// GET /api/v1/discovery/places (Tourist Places & Destination Guide)
router.get('/places', async (req, res) => {
  const { destination } = req.query;
  const dest = (destination as string) || 'Kuakata';
  return res.json({
    destination: dest,
    overview: `${dest} is famous for its natural beauty and panoramic sea views.`,
    bestTimeToVisit: 'October to March',
    topAttractions: [
      { id: 1, name: 'Gangamati Reserved Forest & Sunrise Point', category: 'Nature', rating: 4.8, location: { lat: 21.821, lng: 90.155 } },
      { id: 2, name: 'Jhau Bon & Eco Park', category: 'Park', rating: 4.6, location: { lat: 21.815, lng: 90.122 } }
    ],
    nearbyEssentials: {
      restaurants: [{ name: 'Kuakata Seafood Cafe', rating: 4.5, distanceKm: 0.5 }],
      hospitals: [{ name: 'Kuakata 20-Bed Hospital', phone: '01700000000', distanceKm: 1.2 }],
      atms: [{ bank: 'DBBL Fast Track ATM', distanceKm: 0.3 }],
      fuelStations: [{ name: 'Kuakata Highway Filling Station', distanceKm: 2.5 }]
    },
    travelTips: [
      'Carry cash as coastal ATMs might occasionally face network issues.',
      'Book sunrise boat tours early in the morning by 05:30 AM.'
    ],
    currentWeather: { tempC: 27, condition: 'Partly Cloudy', humidityPercent: 78 }
  });
});

// POST /api/v1/discovery/route-planner (Route Planner & Maps Integration)
router.post('/route-planner', async (req, res) => {
  const { origin, destination } = req.body;
  return res.json({
    origin: origin || 'Dhaka (Gabtoli)',
    destination: destination || 'Kuakata Sea Beach',
    totalDistanceKm: 284,
    estimatedDurationHours: 6.5,
    recommendedRoute: 'Dhaka -> Padma Bridge -> Barisal -> Patuakhali -> Kuakata',
    tolls: [
      { name: 'Padma Bridge Toll Plaza', costBDT: 1400 },
      { name: 'Payra Bridge Toll Plaza', costBDT: 150 }
    ],
    waypoints: ['Padma Bridge Rest Area', 'Barisal Launch Ghat Station', 'Payra Bridge Viewpoint']
  });
});

export default router;
