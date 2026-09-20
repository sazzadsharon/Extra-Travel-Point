import { Router, Request, Response } from 'express';
import { authenticateJWT, AuthRequest } from '../middleware/auth';
import { prisma } from '../prisma';
import { aiFactory } from '../ai';
import { z } from 'zod';
import { logError } from '../utils/logger';

const router = Router();

const aiRequestSchema = z.object({
  prompt: z.string().max(1000).optional(),
  maxBudget: z.number().min(100).max(500000).optional(),
  origin: z.string().max(100).optional(),
  destination: z.string().max(100).optional(),
  durationDays: z.number().min(1).max(30).optional()
});

router.get('/health', async (req: Request, res: Response) => {
  try {
    const provider = aiFactory.getDefaultProvider();
    if (!provider) {
      return res.status(503).json({
        success: false,
        provider: null,
        model: null,
        reachable: false,
        error: 'AI provider is temporarily unavailable.'
      });
    }

    const reachable = await provider.isAvailable();

    let modelName: string | null = null;
    if (provider.name === 'gemini') {
      modelName = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
    } else {
      modelName = process.env.OMNIROUTE_MODEL || 'auto';
    }

    return res.json({
      success: reachable,
      provider: provider.name,
      model: modelName,
      reachable
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      provider: null,
      model: null,
      reachable: false
    });
  }
});

router.post('/assistant', async (req: Request, res: Response) => {
  try {
    const parse = aiRequestSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ error: parse.error.issues });
    }

    const { prompt, maxBudget, origin, destination, durationDays } = parse.data;

    const budget = Math.max(1000, Number(maxBudget) || 5000);
    const dest = destination || 'Kuakata';
    const startCity = origin || 'Dhaka';
    const days = durationDays || 3;

    let suggestedHotelName = 'No hotel currently available';
    let suggestedHotelPrice = 0;
    try {
      const hotel = await prisma.serviceProvider.findFirst({
        where: {
          category: 'hotel',
          city: dest,
          isVerified: true,
          isActive: true,
          status: 'APPROVED',
          isPublished: true,
          lifecycleStatus: 'APPROVED'
        },
        include: { rooms: true }
      });
      if (hotel) {
        suggestedHotelName = hotel.businessName;
        if (hotel.rooms && hotel.rooms.length > 0) {
          const prices = hotel.rooms.map(r => r.price);
          suggestedHotelPrice = Math.floor(Math.min(...prices));
        }
      }
    } catch {
      // keep neutral fallback
    }

    const hotelCost = suggestedHotelPrice * days;
    const foodEstimate = Math.floor(budget * 0.24);
    const localTransport = Math.floor(budget * 0.10);

    let suggestedBusName = 'No bus currently available';
    let suggestedBusFare = 0;
    try {
      const travelDate = req.body?.date as string | undefined;
      const bus = await prisma.service.findFirst({
        where: {
          category: { in: ['bus', 'bus_ac', 'bus_non_ac'] },
          isActive: true,
          provider: { status: 'APPROVED', isActive: true, city: origin },
          route: { contains: dest },
          ...(travelDate ? {
            availabilities: {
              some: {
                isActive: true,
                date: {
                  gte: new Date(travelDate),
                  lt: new Date(new Date(travelDate).getTime() + 86400000)
                }
              }
            }
          } : {})
        },
        select: { name: true, price: true }
      });
      if (bus) {
        suggestedBusName = bus.name;
        suggestedBusFare = bus.price;
      }
    } catch {
      // keep neutral fallback
    }

    const emergencyFund = Math.max(
      0,
      budget - (suggestedBusFare + hotelCost + foodEstimate + localTransport)
    );

    let aiMessage = '';
    const provider = aiFactory.getDefaultProvider();

    if (!provider) {
      aiMessage = `Planning your ${days}-day trip to ${dest}...`;
    } else {
      try {
        const context = `You are a travel assistant for Extra Travel Point, a Bangladesh travel super app.
        A user wants to plan a trip from ${startCity} to ${dest} for ${days} days with a budget of BDT ${budget}.
        Provide a helpful, concise response in Bengali mixed with English.`;

        const userPrompt =
          prompt || `Plan a ${days}-day trip from ${startCity} to ${dest} within BDT ${budget}`;

        const response = await provider.chat([
          { role: 'system', content: context },
          { role: 'user', content: userPrompt }
        ]);
        aiMessage = response.content;
      } catch (aiError: any) {
        logError('AI assistant failed to generate a response', aiError, {
          provider: provider.name,
          destination: dest
        });
        aiMessage = `Planning your ${days}-day trip to ${dest}...`;
      }
    }

    return res.json({
      query: prompt || `${startCity} to ${dest} ${days} Days Trip within BDT ${budget}`,
      destination: dest,
      origin: startCity,
      durationDays: days,
      totalBudget: budget,

      budgetBreakdown: {
        busTicket: suggestedBusFare,
        hotelCost: hotelCost,
        foodEstimate: foodEstimate,
        localTransport: localTransport,
        emergencyExtra: emergencyFund,
        totalCalculated:
          suggestedBusFare +
          hotelCost +
          foodEstimate +
          localTransport +
          emergencyFund
      },

      dayByDayItinerary: [
        {
          day: 1,
          title: `Arrival & ${dest} Beach Sunset View`,
          activities: [`Night Bus from ${startCity} to ${dest}`, 'Hotel Check-in & Breakfast', 'Relaxation at Main Beach & Sunset view']
        },
        {
          day: 2,
          title: 'Sunrise, Local Spots & Beach',
          activities: ['Early Morning Sunrise at Beach Viewpoint', 'Visit Jhau Bon & Buddhist Temple', 'Evening Beach Walk']
        },
        {
          day: 3,
          title: 'Souvenir Shopping & Return Journey',
          activities: ['Morning Beach Walk', 'Souvenir & Local Craft Shopping', 'Return Bus Journey to Dhaka']
        }
      ],

      weatherForecast: {
        condition: 'Weather data unavailable',
        temperatureC: 0,
        recommendation: 'No verified weather data available at this time.'
      },

      suggestedBooking: {
        transport: { type: suggestedBusName, fare: suggestedBusFare },
        hotel: { name: suggestedHotelName, pricePerNight: suggestedHotelPrice },
        recommendedAction: 'Review available ETP options'
      },

      alternativePlan: {
        title: 'Super Saver Economy Plan',
        totalCost: 0,
        savings: 0,
        details: 'Alternative ETP options may be available based on current inventory.'
      },

      aiMessage
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
