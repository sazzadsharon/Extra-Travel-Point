import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const DEMO_TAG = '[INVESTOR DEMO]';

if (process.env.NODE_ENV === 'production' && process.env.DEMO_MODE !== 'true') {
  console.error('Refusing to run investor demo seed in production without DEMO_MODE=true');
  process.exit(1);
}

const DEMO_PASSWORD = 'Demo@ETP2026';

async function hash(p: string) {
  return bcrypt.hash(p, 10);
}

async function upsertUser(opts: {
  phone: string;
  email: string;
  fullName: string;
  role: 'customer' | 'vendor' | 'admin';
  password: string;
}) {
  const passwordHash = await hash(opts.password);
  return prisma.user.upsert({
    where: { phone: opts.phone },
    update: { email: opts.email, fullName: opts.fullName, role: opts.role, isActive: true, passwordHash },
    create: {
      phone: opts.phone,
      email: opts.email,
      fullName: opts.fullName,
      passwordHash,
      role: opts.role,
      isActive: true,
    },
  });
}

async function findOrCreateProvider(opts: {
  userId: number;
  businessName: string;
  category: string;
  description: string;
  address: string;
  city: string;
  phone?: string;
  rating?: number;
  totalReviews?: number;
}) {
  const existing = await prisma.serviceProvider.findFirst({
    where: { businessName: opts.businessName, category: opts.category },
  });
  if (existing) return existing;
  return prisma.serviceProvider.create({
    data: {
      userId: opts.userId,
      businessName: opts.businessName,
      category: opts.category,
      description: opts.description,
      address: opts.address,
      city: opts.city,
      phone: opts.phone,
      status: 'APPROVED',
      isVerified: true,
      isActive: true,
      verifiedAt: new Date(),
      rating: opts.rating ?? 4.3,
      totalReviews: opts.totalReviews ?? 0,
    },
  });
}

async function findOrCreateBus(opts: {
  providerId: number;
  registrationNumber: string;
  busName: string;
  busType: string;
  totalSeats: number;
  amenities?: string;
}) {
  const existing = await prisma.bus.findFirst({
    where: { registrationNumber: opts.registrationNumber },
  });
  if (existing) return existing;
  return prisma.bus.create({
    data: {
      providerId: opts.providerId,
      registrationNumber: opts.registrationNumber,
      busName: opts.busName,
      busType: opts.busType,
      totalSeats: opts.totalSeats,
      amenities: opts.amenities,
      status: 'ACTIVE',
      isActive: true,
    },
  });
}

async function findOrCreateRoute(opts: {
  providerId: number;
  origin: string;
  destination: string;
  distanceKm?: number;
  estimatedDurationMinutes?: number;
}) {
  const existing = await prisma.busRoute.findFirst({
    where: { providerId: opts.providerId, origin: opts.origin, destination: opts.destination },
  });
  if (existing) return existing;
  return prisma.busRoute.create({
    data: {
      providerId: opts.providerId,
      origin: opts.origin,
      destination: opts.destination,
      distanceKm: opts.distanceKm,
      estimatedDurationMinutes: opts.estimatedDurationMinutes,
      isActive: true,
    },
  });
}

async function findOrCreateTrip(opts: {
  busId: number;
  routeId: number;
  providerId: number;
  departureDate: Date;
  departureTime: string;
  arrivalTime: string;
  pricePerSeat: number;
  availableSeats: number;
  status?: string;
}) {
  const dateStart = new Date(opts.departureDate);
  dateStart.setUTCHours(0, 0, 0, 0);
  const dateEnd = new Date(dateStart);
  dateEnd.setUTCDate(dateEnd.getUTCDate() + 1);

  const existing = await prisma.busTrip.findFirst({
    where: {
      busId: opts.busId,
      routeId: opts.routeId,
      departureTime: opts.departureTime,
      departureDate: { gte: dateStart, lt: dateEnd },
    },
  });
  if (existing) return existing;
  const departureTs = new Date(dateStart);
  const [dH, dM] = opts.departureTime.split(':').map(Number);
  departureTs.setUTCHours(dH, dM, 0, 0);

  const arrivalTs = new Date(dateStart);
  const [aH, aM] = opts.arrivalTime.split(':').map(Number);
  arrivalTs.setUTCHours(aH, aM, 0, 0);
  if (arrivalTs <= departureTs) {
    arrivalTs.setUTCDate(arrivalTs.getUTCDate() + 1);
  }

  return prisma.busTrip.create({
    data: {
      busId: opts.busId,
      routeId: opts.routeId,
      providerId: opts.providerId,
      departureDate: dateStart,
      departureTime: opts.departureTime,
      arrivalTime: opts.arrivalTime,
      departureTimestamp: departureTs,
      arrivalTimestamp: arrivalTs,
      pricePerSeat: opts.pricePerSeat,
      availableSeats: opts.availableSeats,
      status: opts.status ?? 'SCHEDULED',
      bookingCutoffMinutes: 30,
      isActive: true,
    },
  });
}

async function findOrCreateBooking(opts: {
  userId: number;
  providerId: number;
  tripId: number;
  category: string;
  travelDate: Date;
  numberOfPeople: number;
  totalAmount: number;
  discountAmount: number;
  finalAmount: number;
  status: string;
  paymentStatus: string;
  route: string;
  seatNumbers: string;
}): Promise<{ booking: any; created: boolean }> {
  const existing = await prisma.booking.findFirst({
    where: {
      userId: opts.userId,
      providerId: opts.providerId,
      tripId: opts.tripId,
      category: opts.category,
      seatNumbers: opts.seatNumbers,
    },
  });
  if (existing) return { booking: existing, created: false };
  const created = await prisma.booking.create({
    data: {
      bookingCode: `DEMO-BUS-${opts.userId}-${opts.providerId}-${opts.tripId}-${Date.now()}`,
      userId: opts.userId,
      providerId: opts.providerId,
      tripId: opts.tripId,
      category: opts.category,
      bookingDate: new Date(),
      travelDate: opts.travelDate,
      numberOfPeople: opts.numberOfPeople,
      totalAmount: opts.totalAmount,
      discountAmount: opts.discountAmount,
      finalAmount: opts.finalAmount,
      status: opts.status,
      paymentStatus: opts.paymentStatus,
      route: opts.route,
      seatNumbers: opts.seatNumbers,
    },
  });
  return { booking: created, created: true };
}

const startOfDay = (n: number) => {
  const d = new Date(Date.now() + n * 24 * 60 * 60 * 1000);
  d.setUTCHours(0, 0, 0, 0);
  return d;
};

async function main() {
  console.log('ETP Investor Demo Bus seed starting...');

  // ============ 1. DEMO CUSTOMERS ============
  const customer1 = await upsertUser({ phone: '01813000001', email: 'investor1@etp.demo', fullName: `${DEMO_TAG} Investor Demo Customer 1`, role: 'customer', password: DEMO_PASSWORD });
  const customer2 = await upsertUser({ phone: '01813000002', email: 'investor2@etp.demo', fullName: `${DEMO_TAG} Investor Demo Customer 2`, role: 'customer', password: DEMO_PASSWORD });
  const customer3 = await upsertUser({ phone: '01813000003', email: 'investor3@etp.demo', fullName: `${DEMO_TAG} Investor Demo Customer 3`, role: 'customer', password: DEMO_PASSWORD });

  console.log('Demo customers created');

  // ============ 2. VENDOR USERS ============
  const vendors = await Promise.all([
    upsertUser({ phone: '01912000001', email: 'greenline@etp.demo', fullName: `${DEMO_TAG} Green Line Operator`, role: 'vendor', password: DEMO_PASSWORD }),
    upsertUser({ phone: '01912000002', email: 'shohagh@etp.demo', fullName: `${DEMO_TAG} Shohagh Paribahan Operator`, role: 'vendor', password: DEMO_PASSWORD }),
    upsertUser({ phone: '01912000003', email: 'hanif@etp.demo', fullName: `${DEMO_TAG} Hanif Enterprise Operator`, role: 'vendor', password: DEMO_PASSWORD }),
    upsertUser({ phone: '01912000004', email: 'saintmartin@etp.demo', fullName: `${DEMO_TAG} Saintmartin Paribahan Operator`, role: 'vendor', password: DEMO_PASSWORD }),
    upsertUser({ phone: '01912000005', email: 'shyamoli@etp.demo', fullName: `${DEMO_TAG} Shyamoli NR Travels Operator`, role: 'vendor', password: DEMO_PASSWORD }),
    upsertUser({ phone: '01912000006', email: 'desh@etp.demo', fullName: `${DEMO_TAG} Desh Travels Operator`, role: 'vendor', password: DEMO_PASSWORD }),
    upsertUser({ phone: '01912000007', email: 'ena@etp.demo', fullName: `${DEMO_TAG} Ena Transport Operator`, role: 'vendor', password: DEMO_PASSWORD }),
    upsertUser({ phone: '01912000008', email: 'nabil@etp.demo', fullName: `${DEMO_TAG} Nabil Paribahan Operator`, role: 'vendor', password: DEMO_PASSWORD }),
    upsertUser({ phone: '01912000009', email: 'unique@etp.demo', fullName: `${DEMO_TAG} Unique Paribahan Operator`, role: 'vendor', password: DEMO_PASSWORD }),
    upsertUser({ phone: '01912000010', email: 'salam@etp.demo', fullName: `${DEMO_TAG} S Alam Service Operator`, role: 'vendor', password: DEMO_PASSWORD }),
  ]);

  console.log('Vendor users created: 10');

  // ============ 3. SERVICE PROVIDERS ============
  const providers = await Promise.all(vendors.map((vendor, idx) =>
    findOrCreateProvider({
      userId: vendor.id,
      businessName: `${DEMO_TAG} ${['Green Line', 'Shohagh Paribahan', 'Hanif Enterprise', 'Saintmartin Paribahan', 'Shyamoli NR Travels', 'Desh Travels', 'Ena Transport', 'Nabil Paribahan', 'Unique Paribahan', 'S Alam Service'][idx]}`,
      category: 'bus',
      description: `Demo bus operator — ${['Dhaka to Chattogram', 'Dhaka to Coxs Bazar', 'Dhaka to Sylhet', 'Dhaka to Coxs Bazar', 'Dhaka to Rajshahi', 'Dhaka to Khulna', 'Dhaka to Sylhet', 'Dhaka to Rangpur', 'Dhaka to Barishal', 'Dhaka to Chattogram'][idx]}`,
      address: `Bus Terminal, Dhaka`,
      city: 'Dhaka',
      phone: `019120000${idx + 1}`,
      rating: 4.0 + (idx % 5) * 0.2,
      totalReviews: 50 + idx * 37,
    })
  ));

  console.log('Service providers created:', providers.length);

  // ============ 4. BUSES ============
  const busDefs = [
    { reg: 'DHK-GL-001', name: 'Green Line AC Coach', type: 'AC', seats: 40, amenities: 'WiFi,AC,USB,Recliner' },
    { reg: 'DHK-SP-001', name: 'Shohagh Paribahan Deluxe', type: 'AC', seats: 36, amenities: 'WiFi,AC,Recliner,Snacks' },
    { reg: 'DHK-HE-001', name: 'Hanif Enterprise Super', type: 'AC', seats: 40, amenities: 'WiFi,AC,USB,Blanket' },
    { reg: 'DHK-SM-001', name: 'Saintmartin Paribahan Express', type: 'NON_AC', seats: 40, amenities: 'Fan,Window,Charging' },
    { reg: 'DHK-SN-001', name: 'Shyamoli NR Travels AC', type: 'AC', seats: 36, amenities: 'WiFi,AC,Recliner,Snacks' },
    { reg: 'DHK-DT-001', name: 'Desh Travels Economy', type: 'AC', seats: 40, amenities: 'AC,USB,Blanket' },
    { reg: 'DHK-ET-001', name: 'Ena Transport Non-AC', type: 'NON_AC', seats: 44, amenities: 'Fan,Window,Charging' },
    { reg: 'DHK-NP-001', name: 'Nabil Paribahan AC', type: 'AC', seats: 36, amenities: 'WiFi,AC,Recliner,Snacks' },
    { reg: 'DHK-UP-001', name: 'Unique Paribahan AC', type: 'AC', seats: 40, amenities: 'WiFi,AC,USB,Blanket' },
    { reg: 'DHK-SA-001', name: 'S Alam Service Luxury', type: 'AC', seats: 40, amenities: 'WiFi,AC,Recliner,Snacks,Blanket' },
  ];

  const buses = await Promise.all(busDefs.map((def, idx) =>
    findOrCreateBus({
      providerId: providers[idx].id,
      registrationNumber: def.reg,
      busName: def.name,
      busType: def.type,
      totalSeats: def.seats,
      amenities: def.amenities,
    })
  ));

  console.log('Buses created:', buses.length);

  // ============ 5. BUS ROUTES ============
  const routeDefs = [
    { origin: 'Dhaka', destination: 'Chattogram', km: 250, mins: 300 },
    { origin: 'Dhaka', destination: 'Coxs Bazar', km: 390, mins: 480 },
    { origin: 'Dhaka', destination: 'Sylhet', km: 240, mins: 360 },
    { origin: 'Dhaka', destination: 'Coxs Bazar', km: 390, mins: 480 },
    { origin: 'Dhaka', destination: 'Rajshahi', km: 270, mins: 360 },
    { origin: 'Dhaka', destination: 'Khulna', km: 320, mins: 420 },
    { origin: 'Dhaka', destination: 'Sylhet', km: 240, mins: 360 },
    { origin: 'Dhaka', destination: 'Rangpur', km: 370, mins: 450 },
    { origin: 'Dhaka', destination: 'Barishal', km: 220, mins: 300 },
    { origin: 'Dhaka', destination: 'Chattogram', km: 250, mins: 300 },
  ];

  const routes = await Promise.all(routeDefs.map((def, idx) =>
    findOrCreateRoute({
      providerId: providers[idx].id,
      origin: def.origin,
      destination: def.destination,
      distanceKm: def.km,
      estimatedDurationMinutes: def.mins,
    })
  ));

  console.log('Bus routes created:', routes.length);

  // ============ 6. BUS TRIPS ============
  const tripDefs = [
    { departure: '22:00', arrival: '08:00', price: 1200, seats: 40 },
    { departure: '21:00', arrival: '07:00', price: 1800, seats: 36 },
    { departure: '06:30', arrival: '13:00', price: 1100, seats: 40 },
    { departure: '07:00', arrival: '10:30', price: 800, seats: 40 },
    { departure: '21:00', arrival: '05:30', price: 950, seats: 36 },
    { departure: '20:30', arrival: '05:00', price: 1000, seats: 40 },
    { departure: '06:00', arrival: '13:00', price: 900, seats: 44 },
    { departure: '20:00', arrival: '04:30', price: 1100, seats: 36 },
    { departure: '21:30', arrival: '06:30', price: 1050, seats: 40 },
    { departure: '23:00', arrival: '09:00', price: 1300, seats: 40 },
  ];

  const allTrips: Array<{ id: number; availableSeats: number; providerId: number }> = [];

  for (let i = 0; i < 10; i++) {
    const td = tripDefs[i];
    // 3 trips per operator: tomorrow, day after, next week
    const dates = [1, 2, 7];
    for (const d of dates) {
      const trip = await findOrCreateTrip({
        busId: buses[i].id,
        routeId: routes[i].id,
        providerId: providers[i].id,
        departureDate: startOfDay(d),
        departureTime: td.departure,
        arrivalTime: td.arrival,
        pricePerSeat: td.price,
        availableSeats: td.seats,
        status: d <= 2 ? 'SCHEDULED' : 'OPEN',
      });
      allTrips.push({ id: trip.id, availableSeats: td.seats, providerId: providers[i].id });
    }
  }

  console.log('Bus trips created:', allTrips.length);

  // ============ 7. DEMO BOOKINGS ============
  const demoBookings = [
    { tripIdx: 0, dateOffset: 1, customer: customer1, seats: ['A1', 'A2'], amount: 2400 },
    { tripIdx: 0, dateOffset: 1, customer: customer2, seats: ['B1'], amount: 1200 },
    { tripIdx: 2, dateOffset: 1, customer: customer3, seats: ['A3', 'A4'], amount: 2200 },
    { tripIdx: 4, dateOffset: 1, customer: customer1, seats: ['C1'], amount: 950 },
    { tripIdx: 6, dateOffset: 2, customer: customer2, seats: ['A1', 'A2', 'A3'], amount: 2700 },
    { tripIdx: 8, dateOffset: 1, customer: customer3, seats: ['B2'], amount: 1050 },
  ];

  let totalSeatBookings = 0;

  for (const bk of demoBookings) {
    const trip = allTrips.find(t => t.providerId === providers[bk.tripIdx].id);
    if (!trip) continue;

    // Find the specific trip by date offset
    const targetDate = startOfDay(bk.dateOffset);
    const dateEnd = new Date(targetDate);
    dateEnd.setUTCDate(dateEnd.getUTCDate() + 1);
    const targetTrip = await prisma.busTrip.findFirst({
      where: {
        busId: buses[bk.tripIdx].id,
        routeId: routes[bk.tripIdx].id,
        departureDate: { gte: targetDate, lt: dateEnd },
      },
    });

    if (!targetTrip) continue;

    const { booking, created } = await findOrCreateBooking({
      userId: bk.customer.id,
      providerId: providers[bk.tripIdx].id,
      tripId: targetTrip.id,
      category: 'bus',
      travelDate: targetDate,
      numberOfPeople: bk.seats.length,
      totalAmount: bk.amount,
      discountAmount: 0,
      finalAmount: bk.amount,
      status: 'confirmed',
      paymentStatus: 'paid',
      route: `${routeDefs[bk.tripIdx].origin} -> ${routeDefs[bk.tripIdx].destination}`,
      seatNumbers: bk.seats.join(','),
    });

    if (created) {
      totalSeatBookings += bk.seats.length;
      await prisma.busTrip.update({
        where: { id: targetTrip.id },
        data: { availableSeats: { decrement: bk.seats.length } },
      });
    }
  }

  console.log('Demo bookings created with seats:', totalSeatBookings);

  // ============ SUMMARY ============
  const busCount = await prisma.bus.count();
  const providerCount = await prisma.serviceProvider.count({ where: { category: 'bus' } });
  const routeCount = await prisma.busRoute.count();
  const tripCount = await prisma.busTrip.count();
  const bookingCount = await prisma.booking.count({ where: { category: 'bus' } });

  console.log('\n=== INVESTOR DEMO BUS SUMMARY ===');
  console.log(`Bus records:          ${busCount}`);
  console.log(`Bus providers:        ${providerCount}`);
  console.log(`Bus routes:           ${routeCount}`);
  console.log(`Bus trips:            ${tripCount}`);
  console.log(`Bus bookings:         ${bookingCount}`);
  console.log(`Demo seat bookings:   ${totalSeatBookings}`);
  console.log('\nDemo credentials (DEV ONLY):');
  console.log('Vendors: 01912000001..10 / Demo@ETP2026');
  console.log('Customers: 01813000001..03 / Demo@ETP2026');
  console.log('Password for all demo accounts: Demo@ETP2026');
}

main()
  .catch((e) => { console.error('Seed error:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
