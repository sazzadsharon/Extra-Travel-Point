import { Router } from 'express';

const router = Router();

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
    currentWeather: {
      tempC: 27,
      condition: 'Partly Cloudy',
      humidityPercent: 78
    }
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
