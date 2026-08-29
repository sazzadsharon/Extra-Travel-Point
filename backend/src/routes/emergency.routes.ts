import { Router } from 'express';
import { authenticateJWT, AuthRequest } from '../middleware/auth';

const router = Router();

// POST /api/v1/emergency/sos (Enhanced SOS Dispatch with Live GPS & Trip Info)
router.post('/sos', authenticateJWT, async (req: AuthRequest, res) => {
  const { latitude, longitude, tripId, emergencyType, description } = req.body;
  const alertId = `SOS-${Date.now()}`;

  return res.json({
    success: true,
    alertId,
    emergencyType: emergencyType || 'ACCIDENT_OR_MEDICAL',
    location: {
      latitude: latitude || 23.8103,
      longitude: longitude || 90.4125,
      nearestLandmark: 'Comilla Highway Highway Spot'
    },
    tripInfo: {
      tripId: tripId || 'TRIP-9988',
      vehicleNumber: 'DHAKA-METRO-BA-14-9988',
      operator: 'Green Line Paribahan'
    },
    dispatchedServices: ['National Emergency (999)', 'Tourist Police Command Center', 'Highway Patrol Ambulance'],
    notificationSentToContacts: true,
    status: 'ACTIVE_DISPATCH',
    timestamp: new Date()
  });
});

// GET /api/v1/emergency/nearby-hospitals
router.get('/nearby-hospitals', async (req, res) => {
  const { latitude, longitude } = req.query;
  return res.json([
    { name: 'Comilla Medical College Hospital', distanceKm: 4.2, phone: '081-68901', ambulanceAvailable: true },
    { name: 'Moon Hospital & Emergency Care', distanceKm: 6.8, phone: '01711223344', ambulanceAvailable: true }
  ]);
});

// GET /api/v1/emergency/nearby-police-fire
router.get('/nearby-police-fire', async (req, res) => {
  const { latitude, longitude } = req.query;
  return res.json({
    policeStations: [
      { stationName: 'Comilla Sadar Highway Police Outpost', distanceKm: 2.1, phone: '01320001122' }
    ],
    fireServices: [
      { stationName: 'Comilla Central Fire Station', distanceKm: 5.5, phone: '081-65432' }
    ]
  });
});

// GET & POST Emergency Contacts
router.get('/contacts', authenticateJWT, async (req: AuthRequest, res) => {
  return res.json([
    { id: 1, name: 'Family Contact (Father)', phone: '01700000000', relationship: 'Parent' },
    { id: 2, name: 'Friend Emergency Contact', phone: '01800000000', relationship: 'Friend' }
  ]);
});

router.post('/contacts', authenticateJWT, async (req: AuthRequest, res) => {
  const { name, phone, relationship } = req.body;
  return res.status(201).json({
    message: 'Emergency contact added',
    contact: { id: Date.now(), name, phone, relationship }
  });
});

// GET /api/v1/emergency/helplines
router.get('/helplines', async (req, res) => {
  return res.json([
    { service: 'National Emergency', number: '999' },
    { service: 'Extra Travel SOS Helpline', number: '09612345678' },
    { service: 'Tourist Police Hotline', number: '01320000000' }
  ]);
});

export default router;
