import { Router } from 'express';
import { authenticateJWT, AuthRequest } from '../middleware/auth';
import { prisma } from '../prisma';

const router = Router();

// POST /api/v1/ai/assistant
router.post('/assistant', async (req, res) => {
  try {
    const { prompt, maxBudget, origin, destination, durationDays } = req.body;

    const budget = Math.max(1000, Number(maxBudget) || 5000);
    const dest = destination || 'Kuakata';
    const startCity = origin || 'Dhaka';
    const days = durationDays || 3;

    const busFare = Math.floor(budget * 0.20);
    const hotelCost = Math.floor(budget * 0.36);
    const foodEstimate = Math.floor(budget * 0.24);
    const localTransport = Math.floor(budget * 0.10);
    const emergencyFund = budget - (busFare + hotelCost + foodEstimate + localTransport);

    const recommendations = {
      query: prompt || `${startCity} to ${dest} ${days} Days Trip within BDT ${budget}`,
      destination: dest,
      origin: startCity,
      durationDays: days,
      totalBudget: budget,
      
      budgetBreakdown: {
        busTicket: busFare,
        hotelCost: hotelCost,
        foodEstimate: foodEstimate,
        localTransport: localTransport,
        emergencyExtra: emergencyFund,
        totalCalculated: budget
      },

      dayByDayItinerary: [
        {
          day: 1,
          title: `Arrival & ${dest} Beach Sunset View`,
          activities: [`Night Bus from ${startCity} to ${dest}`, 'Hotel Check-in & Breakfast', 'Relaxation at Main Beach & Sunset view']
        },
        {
          day: 2,
          title: 'Sunrise, Gangamati & Local Spots',
          activities: ['Early Morning Sunrise at Gangamati Spot', 'Visit Jhau Bon & Buddhist Temple', 'Seafood Dinner at Local Spot']
        },
        {
          day: 3,
          title: 'Souvenir Shopping & Return Journey',
          activities: ['Morning Beach Walk', 'Souvenir & Local Craft Shopping', 'Return Bus Journey to Dhaka']
        }
      ],

      weatherForecast: {
        condition: 'Sunny with pleasant sea breeze',
        temperatureC: 28,
        recommendation: 'Perfect weather for beach walk & sunrise view.'
      },

      suggestedBooking: {
        transport: { type: 'Non-AC Deluxe Bus (Sakura Paribahan)', fare: busFare },
        hotel: { name: 'Kuakata Sea Haven Resort (Standard AC)', pricePerNight: Math.floor(hotelCost / 2) },
        recommendedAction: 'Book All-in-One ETP Smart Combo Package & Save 15%'
      },

      alternativePlan: {
        title: 'Super Saver Economy Plan',
        totalCost: Math.floor(budget * 0.8),
        savings: Math.floor(budget * 0.2),
        details: 'Includes Non-AC Bus & Standard Guest House.'
      },

      aiMessage: `আপনার ৳${budget} বাজেটে ${dest} ৩ দিনের জন্য বাস ৳${busFare}, হোটেল ৳${hotelCost}, খাবার ৳${foodEstimate}, লোকাল ট্রান্সপোর্ট ৳${localTransport} এবং ৳${emergencyFund} ইমার্জেন্সি ফান্ড বরাদ্দ করা হয়েছে।`
    };

    return res.json(recommendations);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
