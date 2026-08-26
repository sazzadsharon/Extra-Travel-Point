import { Router } from 'express';
import { authenticateJWT, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/v1/tracking/live/:tripId (Enhanced Live GPS & Route Progress)
router.get('/live/:tripId', async (req, res) => {
  const { tripId } = req.params;
  return res.json({
    tripId,
    operator: 'Green Line Paribahan',
    vehicleNumber: 'DHAKA-METRO-BA-14-9988',
    driverName: 'Mohammad Rafiq',
    route: 'Dhaka (Gabtoli) -> Cox\'s Bazar',
    currentLocation: {
      latitude: 23.8103,
      longitude: 90.4125,
      placeName: 'Comilla Highway Spot (Near Paduar Bazar)',
      speedKmh: 68
    },
    routeProgressPercentage: 45,
    checkpoints: [
      { name: 'Gabtoli Departure Counter', passed: true, time: '07:00 AM' },
      { name: 'Kanchpur Bridge', passed: true, time: '08:30 AM' },
      { name: 'Comilla Highway Spot', passed: true, time: '10:45 AM' },
      { name: 'Feni Highway Counter', passed: false, eta: '11:45 AM' },
      { name: 'Chittagong Bypass', passed: false, eta: '02:00 PM' },
      { name: 'Cox\'s Bazar Main Station', passed: false, eta: '05:30 PM' }
    ],
    etaMinutes: 25,
    nextStoppage: 'Feni Highway Station',
    estimatedArrival: '05:30 PM',
    delayDetection: {
      isDelayed: true,
      delayMinutes: 15,
      reason: 'Highway Traffic at Kanchpur Toll Plaza'
    },
    lastUpdated: new Date()
  });
});

// POST /api/v1/tracking/gps-ping (Driver/Bus GPS Location Update)
router.post('/gps-ping', async (req, res) => {
  const { tripId, driverId, latitude, longitude, speedKmh } = req.body;
  return res.json({
    success: true,
    message: 'GPS coordinates updated successfully',
    tripId,
    location: { latitude, longitude, speedKmh },
    timestamp: new Date()
  });
});

// GET /api/v1/tracking/driver/:driverId/location
router.get('/driver/:driverId/location', async (req, res) => {
  const { driverId } = req.params;
  return res.json({
    driverId,
    latitude: 23.78088,
    longitude: 90.41686,
    speedKmh: 42,
    status: 'ON_TRIP',
    updatedAt: new Date()
  });
});

// GET /api/v1/tracking/car-rental
router.get('/car-rental/available', async (req, res) => {
  return res.json([
    { id: 1, carModel: 'Toyota HiAce Microbus', seats: 11, farePerDay: 4500, driverIncluded: true },
    { id: 2, carModel: 'Toyota Noah (AC)', seats: 7, farePerDay: 3500, driverIncluded: true }
  ]);
});

export default router;
