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
  durationDays: z.number().min(1).max(30).optional(),
  locale: z.enum(['en', 'bn']).optional()
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

    const { prompt, maxBudget, origin, destination, durationDays, locale = 'en' } = parse.data;

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
      aiMessage = locale === 'bn' ? `${dest} ভ্রমণের ${days} দিনের পরিকল্পনা তৈরি করা হচ্ছে...` : `Planning your ${days}-day trip to ${dest}...`;
    } else {
      try {
        const context = `You are a travel assistant for Extra Travel Point, a Bangladesh travel super app.
        A user wants to plan a trip from ${startCity} to ${dest} for ${days} days with a budget of BDT ${budget}.
        Respond in ${locale === 'bn' ? 'natural, simple Bangladesh-friendly Bangla. Do not translate word-for-word from English; use short, clear sentences.' : 'clear, natural English'}. Keep names, prices and verified availability accurate. Do not invent ETP services or prices.`;

        const userPrompt =
          prompt || (locale === 'bn' ? `${startCity} থেকে ${dest} যেতে ${days} দিনের ভ্রমণ পরিকল্পনা তৈরি করুন। বাজেট ${budget} টাকা।` : `Plan a ${days}-day trip from ${startCity} to ${dest} within BDT ${budget}`);

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
        aiMessage = locale === 'bn' ? `${dest} ভ্রমণের ${days} দিনের পরিকল্পনা তৈরি করা হচ্ছে...` : `Planning your ${days}-day trip to ${dest}...`;
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
          title: locale === 'bn' ? `${dest} পৌঁছানো ও সমুদ্রসৈকতে সূর্যাস্ত দেখা` : `Arrival & ${dest} Beach Sunset View`,
          activities: locale === 'bn' ? [`${startCity} থেকে ${dest} যাওয়ার বাসযাত্রা`, 'হোটেলে ওঠা ও নাশতা', 'মূল সমুদ্রসৈকতে সময় কাটানো ও সূর্যাস্ত দেখা'] : [`Night Bus from ${startCity} to ${dest}`, 'Hotel Check-in & Breakfast', 'Relaxation at Main Beach & Sunset view']
        },
        {
          day: 2,
          title: locale === 'bn' ? 'সূর্যোদয়, স্থানীয় দর্শনীয় স্থান ও সমুদ্রসৈকত' : 'Sunrise, Local Spots & Beach',
          activities: locale === 'bn' ? ['সকালে সমুদ্রসৈকতে সূর্যোদয় দেখা', 'ঝাউবন ও বৌদ্ধমন্দির ঘুরে দেখা', 'বিকেলে সমুদ্রসৈকতে হাঁটা'] : ['Early Morning Sunrise at Beach Viewpoint', 'Visit Jhau Bon & Buddhist Temple', 'Evening Beach Walk']
        },
        {
          day: 3,
          title: locale === 'bn' ? 'কেনাকাটা ও ফেরার যাত্রা' : 'Souvenir Shopping & Return Journey',
          activities: locale === 'bn' ? ['সকালে সমুদ্রসৈকতে হাঁটা', 'স্মারক ও স্থানীয় পণ্য কেনাকাটা', `${dest} থেকে ফেরার বাসযাত্রা`] : ['Morning Beach Walk', 'Souvenir & Local Craft Shopping', 'Return Bus Journey to Dhaka']
        }
      ],

      weatherForecast: {
        condition: locale === 'bn' ? 'আবহাওয়ার তথ্য পাওয়া যায়নি' : 'Weather data unavailable',
        temperatureC: 0,
        recommendation: locale === 'bn' ? 'এই মুহূর্তে যাচাই করা আবহাওয়ার তথ্য পাওয়া যাচ্ছে না।' : 'No verified weather data available at this time.'
      },

      suggestedBooking: {
        transport: { type: suggestedBusName, fare: suggestedBusFare },
        hotel: { name: suggestedHotelName, pricePerNight: suggestedHotelPrice },
        recommendedAction: locale === 'bn' ? 'ETP-তে পাওয়া যাচ্ছে এমন সেবাগুলো দেখে নিন' : 'Review available ETP options'
      },

      alternativePlan: {
        title: locale === 'bn' ? 'কম খরচের বিকল্প পরিকল্পনা' : 'Super Saver Economy Plan',
        totalCost: 0,
        savings: 0,
        details: locale === 'bn' ? 'বর্তমানে ETP-তে কী কী সেবা পাওয়া যাচ্ছে, তার ওপর ভিত্তি করে বিকল্প থাকতে পারে।' : 'Alternative ETP options may be available based on current inventory.'
      },

      aiMessage
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
