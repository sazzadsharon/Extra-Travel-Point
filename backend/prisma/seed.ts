import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const DEMO_TAG = '[DEMO]';

if (process.env.NODE_ENV === 'production' && process.env.DEMO_MODE !== 'true') {
  console.error('Refusing to run demo seed in production without DEMO_MODE=true');
  process.exit(1);
}

const DEMO_PASSWORD = 'Demo@ETP2026';
const ADMIN_PASSWORD = 'Admin@ETP2026';

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
  status?: string;
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
      status: opts.status ?? 'APPROVED',
      isVerified: (opts.status ?? 'APPROVED') === 'APPROVED',
      isActive: true,
      verifiedAt: new Date(),
      rating: opts.rating ?? 4.3,
      totalReviews: opts.totalReviews ?? 0,
    },
  });
}

async function findOrCreateService(opts: {
  providerId: number;
  name: string;
  category: string;
  description?: string;
  route?: string;
  price: number;
  capacity?: number;
  availability?: string;
}) {
  const existing = await prisma.service.findFirst({
    where: { providerId: opts.providerId, name: opts.name, category: opts.category },
  });
  if (existing) return existing;
  return prisma.service.create({
    data: {
      providerId: opts.providerId,
      name: opts.name,
      category: opts.category,
      description: opts.description,
      route: opts.route,
      price: opts.price,
      currency: 'BDT',
      capacity: opts.capacity,
      availability: opts.availability,
      status: 'ACTIVE',
      isActive: true,
    },
  });
}

async function findOrCreateRoom(opts: {
  providerId: number;
  name: string;
  type: string;
  description: string;
  price: number;
  capacity: number;
  totalRooms: number;
  amenities: string;
}) {
  const existing = await prisma.room.findFirst({
    where: { providerId: opts.providerId, name: opts.name },
  });
  if (existing) return existing;
  return prisma.room.create({
    data: {
      providerId: opts.providerId,
      name: opts.name,
      type: opts.type,
      description: opts.description,
      price: opts.price,
      capacity: opts.capacity,
      totalRooms: opts.totalRooms,
      amenities: opts.amenities,
      isAvailable: true,
    },
  });
}

async function findOrCreateBooking(opts: {
  userId: number;
  providerId: number;
  serviceId?: number | null;
  roomId?: number | null;
  category: string;
  travelDate: Date;
  numberOfPeople: number;
  totalAmount: number;
  discountAmount: number;
  finalAmount: number;
  status: string;
  paymentStatus: string;
  route?: string;
  seatNumbers?: string;
}) {
  const existing = await prisma.booking.findFirst({
    where: {
      userId: opts.userId,
      providerId: opts.providerId,
      serviceId: opts.serviceId ?? null,
      roomId: opts.roomId ?? null,
      category: opts.category,
    },
  });
  if (existing) return existing;
  return prisma.booking.create({
    data: {
      bookingCode: `DEMO-${opts.userId}-${opts.providerId}-${opts.category}-${Date.now()}`,
      userId: opts.userId,
      providerId: opts.providerId,
      serviceId: opts.serviceId ?? null,
      roomId: opts.roomId ?? null,
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
}

async function main() {
  console.log('ETP demo seed starting...');
  console.log(`   NODE_ENV=${process.env.NODE_ENV ?? 'unset'}  DEMO_MODE=${process.env.DEMO_MODE ?? 'unset'}`);

  // Defensive: fix any legacy accounts whose stored passwordHash is the literal string
  // "hash" (an early bug). Update to a real bcrypt hash so logins work.
  const legacy = await prisma.user.findMany({ where: { passwordHash: 'hash' } });
  for (const u of legacy) {
    const newHash = await hash(DEMO_PASSWORD);
    await prisma.user.update({ where: { id: u.id }, data: { passwordHash: newHash, isActive: true } });
  }
  if (legacy.length > 0) console.log(`Repaired ${legacy.length} legacy user(s) with bad passwordHash`);

  // ============ 1. ADMINS ============
  await upsertUser({ phone: '01710000001', email: 'superadmin@etp.demo', fullName: `${DEMO_TAG} Super Admin`, role: 'admin', password: ADMIN_PASSWORD });
  await upsertUser({ phone: '01710000002', email: 'opsadmin@etp.demo', fullName: `${DEMO_TAG} Operations Admin`, role: 'admin', password: ADMIN_PASSWORD });
  await upsertUser({ phone: '01710000003', email: 'support@etp.demo', fullName: `${DEMO_TAG} Support Admin`, role: 'admin', password: ADMIN_PASSWORD });

  // ============ 2. TRAVEL USERS ============
  const tourist = await upsertUser({ phone: '01811000001', email: 'tourist@etp.demo', fullName: `${DEMO_TAG} Rahim Ahmed (Regular Tourist)`, role: 'customer', password: DEMO_PASSWORD });
  const family = await upsertUser({ phone: '01811000002', email: 'family@etp.demo', fullName: `${DEMO_TAG} Salma Begum (Family Traveler)`, role: 'customer', password: DEMO_PASSWORD });
  const student = await upsertUser({ phone: '01811000003', email: 'student@etp.demo', fullName: `${DEMO_TAG} Tanvir Hasan (Student Traveler)`, role: 'customer', password: DEMO_PASSWORD });
  const international = await upsertUser({ phone: '01811000004', email: 'international@etp.demo', fullName: `${DEMO_TAG} John Doe (International Tourist)`, role: 'customer', password: DEMO_PASSWORD });
  const bizUser = await upsertUser({ phone: '01811000005', email: 'business@etp.demo', fullName: `${DEMO_TAG} Nazmul Karim (Business Traveler)`, role: 'customer', password: DEMO_PASSWORD });

  // ============ 3. PROVIDER USERS ============
  const hotelOwner = await upsertUser({ phone: '01911000001', email: 'hotel@etp.demo', fullName: `${DEMO_TAG} Abdul Malek (Hotel Owner)`, role: 'vendor', password: DEMO_PASSWORD });
  const hotelManager = await upsertUser({ phone: '01911000002', email: 'hotel.manager@etp.demo', fullName: `${DEMO_TAG} Rashida Khanam (Hotel Manager)`, role: 'vendor', password: DEMO_PASSWORD });
  const restaurantOwner = await upsertUser({ phone: '01911000003', email: 'restaurant@etp.demo', fullName: `${DEMO_TAG} Md. Sohel (Restaurant Owner)`, role: 'vendor', password: DEMO_PASSWORD });
  const restaurantManager = await upsertUser({ phone: '01911000004', email: 'restaurant.manager@etp.demo', fullName: `${DEMO_TAG} Farzana Akter (Restaurant Manager)`, role: 'vendor', password: DEMO_PASSWORD });
  const cngDriver = await upsertUser({ phone: '01911000005', email: 'cng@etp.demo', fullName: `${DEMO_TAG} Kabir Hossain (CNG Driver)`, role: 'vendor', password: DEMO_PASSWORD });
  const cngOwner = await upsertUser({ phone: '01911000006', email: 'cng.owner@etp.demo', fullName: `${DEMO_TAG} Rafiqul Islam (CNG Owner)`, role: 'vendor', password: DEMO_PASSWORD });
  const guideUser = await upsertUser({ phone: '01911000007', email: 'guide@etp.demo', fullName: `${DEMO_TAG} Imran Hossain (Tourist Guide)`, role: 'vendor', password: DEMO_PASSWORD });
  const busOperator = await upsertUser({ phone: '01911000008', email: 'bus@etp.demo', fullName: `${DEMO_TAG} Hanif Enterprise (Bus Operator)`, role: 'vendor', password: DEMO_PASSWORD });
  const busSupervisor = await upsertUser({ phone: '01911000009', email: 'bus.supervisor@etp.demo', fullName: `${DEMO_TAG} Jahangir Alam (Bus Supervisor)`, role: 'vendor', password: DEMO_PASSWORD });
  const carRental = await upsertUser({ phone: '01911000010', email: 'rental@etp.demo', fullName: `${DEMO_TAG} Liton Mia (Car Rental Provider)`, role: 'vendor', password: DEMO_PASSWORD });
  const boatRental = await upsertUser({ phone: '01911000011', email: 'boat@etp.demo', fullName: `${DEMO_TAG} Salam Patwari (Boat Rental Provider)`, role: 'vendor', password: DEMO_PASSWORD });
  const tourOperator = await upsertUser({ phone: '01911000012', email: 'tour.operator@etp.demo', fullName: `${DEMO_TAG} Sufia Khatun (Tour Operator)`, role: 'vendor', password: DEMO_PASSWORD });
  const activityProvider = await upsertUser({ phone: '01911000013', email: 'activity@etp.demo', fullName: `${DEMO_TAG} Selim Reza (Activity Provider)`, role: 'vendor', password: DEMO_PASSWORD });
  const agencyUser = await upsertUser({ phone: '01911000014', email: 'agency@etp.demo', fullName: `${DEMO_TAG} Nipa Travels (Travel Agency)`, role: 'vendor', password: DEMO_PASSWORD });
  const localBusiness = await upsertUser({ phone: '01911000015', email: 'local@etp.demo', fullName: `${DEMO_TAG} Rashed Miah (Local Business)`, role: 'vendor', password: DEMO_PASSWORD });
  const vendorUser = await upsertUser({ phone: '01911000016', email: 'vendor@etp.demo', fullName: `${DEMO_TAG} General Vendor Account`, role: 'vendor', password: DEMO_PASSWORD });

  console.log('Users seeded: 3 admin + 5 travelers + 16 provider accounts');

  // ============ 4. HOTELS ============
  const hotelSeeds: Array<{
    userId: number; businessName: string; city: string; address: string; description: string; rating: number; reviews: number;
    rooms: Array<{ name: string; type: string; description: string; price: number; capacity: number; totalRooms: number; amenities: string }>;
  }> = [
    { userId: hotelOwner.id, businessName: `${DEMO_TAG} Grand Sultanate Resort & Spa`, city: 'Dhaka', address: 'Baridhara, Dhaka', description: 'Luxury 5-star resort in diplomatic zone with rooftop pool and spa.', rating: 4.7, reviews: 312, rooms: [
      { name: 'Deluxe King', type: 'Deluxe', description: 'King bed, city view', price: 12500, capacity: 2, totalRooms: 20, amenities: 'WiFi,AC,TV,Breakfast' },
      { name: 'Executive Suite', type: 'Suite', description: 'Living + bedroom', price: 22000, capacity: 4, totalRooms: 8, amenities: 'WiFi,AC,TV,Breakfast,Lounge' },
    ]},
    { userId: hotelManager.id, businessName: `${DEMO_TAG} Cox Bazar Beach Palace`, city: 'Coxs Bazar', address: 'Kolatoli Beach Road', description: 'Premium beachfront resort with private beach access.', rating: 4.6, reviews: 421, rooms: [
      { name: 'Ocean View Room', type: 'Premium', description: 'Sea-facing balcony', price: 9800, capacity: 2, totalRooms: 30, amenities: 'WiFi,AC,SeaView,Breakfast' },
      { name: 'Family Suite', type: 'Family', description: 'Two bedrooms + sea view', price: 17500, capacity: 4, totalRooms: 10, amenities: 'WiFi,AC,SeaView,Breakfast,LivingRoom' },
    ]},
    { userId: hotelOwner.id, businessName: `${DEMO_TAG} Jaflong View Resort`, city: 'Sylhet', address: 'Jaflong, Sylhet', description: 'Eco-friendly resort at the foot of the Khasi hills.', rating: 4.5, reviews: 158, rooms: [
      { name: 'Hill View Cottage', type: 'Cottage', description: 'Wooden cottage, river view', price: 6500, capacity: 2, totalRooms: 12, amenities: 'WiFi,AC,Breakfast,RiverView' },
    ]},
    { userId: hotelOwner.id, businessName: `${DEMO_TAG} Tea Garden Lodge Sreemangal`, city: 'Sreemangal', address: 'Sreemangal, Moulvibazar', description: 'Boutique tea-garden lodge with Lawachara walks.', rating: 4.4, reviews: 96, rooms: [
      { name: 'Tea Garden Bungalow', type: 'Bungalow', description: 'Heritage bungalow', price: 7200, capacity: 2, totalRooms: 6, amenities: 'WiFi,Breakfast,TeaTour' },
    ]},
    { userId: hotelOwner.id, businessName: `${DEMO_TAG} Chattogram Bay Tower`, city: 'Chattogram', address: 'Khulshi, Chattogram', description: '4-star business hotel with rooftop restaurant.', rating: 4.3, reviews: 184, rooms: [
      { name: 'Business Deluxe', type: 'Business', description: 'Work desk, fast WiFi', price: 7800, capacity: 2, totalRooms: 22, amenities: 'WiFi,AC,Breakfast,Desk' },
    ]},
    { userId: hotelOwner.id, businessName: `${DEMO_TAG} Nilgiri Hills Resort`, city: 'Bandarban', address: 'Nilgiri, Bandarban', description: 'Hilltop resort 3,500ft above sea level.', rating: 4.6, reviews: 132, rooms: [
      { name: 'Hilltop Suite', type: 'Suite', description: 'Panoramic hill view', price: 8400, capacity: 2, totalRooms: 14, amenities: 'WiFi,Heater,Breakfast,View' },
    ]},
    { userId: hotelOwner.id, businessName: `${DEMO_TAG} Kaptai Lake Resort`, city: 'Rangamati', address: 'Kaptai, Rangamati', description: 'Lakeside resort with private boat jetty.', rating: 4.4, reviews: 88, rooms: [
      { name: 'Lake View Cottage', type: 'Cottage', description: 'Overlooks Kaptai Lake', price: 6800, capacity: 2, totalRooms: 10, amenities: 'WiFi,AC,Breakfast,LakeView' },
    ]},
    { userId: hotelOwner.id, businessName: `${DEMO_TAG} Kuakata Sea Sunset Resort`, city: 'Kuakata', address: 'Kuakata, Patuakhali', description: 'Beachfront resort for sunrise & sunset views.', rating: 4.3, reviews: 71, rooms: [
      { name: 'Sunset View Room', type: 'Deluxe', description: 'Sea-facing balcony', price: 5500, capacity: 2, totalRooms: 16, amenities: 'WiFi,AC,SeaView,Breakfast' },
    ]},
    { userId: hotelOwner.id, businessName: `${DEMO_TAG} Padma Riverside Hotel`, city: 'Rajshahi', address: 'Padma Riverside, Rajshahi', description: 'Mid-range business hotel on the bank of Padma.', rating: 4.1, reviews: 64, rooms: [
      { name: 'Standard Double', type: 'Standard', description: 'City view', price: 4200, capacity: 2, totalRooms: 18, amenities: 'WiFi,AC,TV,Breakfast' },
    ]},
    { userId: hotelOwner.id, businessName: `${DEMO_TAG} Sundarbans Eco Lodge`, city: 'Khulna', address: 'Khulna Sundarbans gateway', description: 'Eco lodge base camp for Sundarbans.', rating: 4.2, reviews: 47, rooms: [
      { name: 'Eco Cabin', type: 'Eco', description: 'Solar-powered cabin', price: 3800, capacity: 2, totalRooms: 12, amenities: 'Fan,Breakfast,BoatTour' },
    ]},
    { userId: hotelOwner.id, businessName: `${DEMO_TAG} Barishal River Front Inn`, city: 'Barishal', address: 'Riverport, Barishal', description: 'Modest inn overlooking Kirtonkhola river.', rating: 3.9, reviews: 33, rooms: [
      { name: 'Standard AC', type: 'Standard', description: 'River view', price: 3200, capacity: 2, totalRooms: 14, amenities: 'WiFi,AC,TV' },
    ]},
    { userId: hotelOwner.id, businessName: `${DEMO_TAG} Student Stay Dhaka`, city: 'Dhaka', address: 'Mirpur-10, Dhaka', description: 'Budget hostel near universities.', rating: 4.0, reviews: 119, rooms: [
      { name: 'Shared Dorm (8-bed)', type: 'Dorm', description: 'Single bunk in 8-bed dorm', price: 950, capacity: 1, totalRooms: 8, amenities: 'WiFi,AC,Locker,Breakfast' },
    ]},
  ];

  const hotelProviders: Array<{ id: number; city: string; name: string }> = [];
  for (const h of hotelSeeds) {
    const p = await findOrCreateProvider({
      userId: h.userId, businessName: h.businessName, category: 'hotel',
      description: h.description, address: h.address, city: h.city,
      phone: '01911000001', rating: h.rating, totalReviews: h.reviews,
    });
    hotelProviders.push({ id: p.id, city: h.city, name: h.businessName });
    for (const r of h.rooms) {
      await findOrCreateRoom({
        providerId: p.id, name: r.name, type: r.type, description: r.description,
        price: r.price, capacity: r.capacity, totalRooms: r.totalRooms, amenities: r.amenities,
      });
    }
  }
  console.log(`Hotels seeded: ${hotelSeeds.length}`);

  // ============ 5. RESTAURANTS ============
  const restaurantSeeds: Array<{
    userId: number; businessName: string; city: string; address: string; description: string; rating: number; reviews: number;
    menu: Array<{ name: string; price: number; category: string }>;
  }> = [
    { userId: restaurantOwner.id, businessName: `${DEMO_TAG} Hilsa Biryani House`, city: 'Dhaka', address: 'Dhanmondi-27, Dhaka', description: 'Bengali cuisine specialising in Padma hilsa and traditional biryani.', rating: 4.5, reviews: 220, menu: [
      { name: 'Hilsa Bhapa', price: 850, category: 'Main Course' },
      { name: 'Kacchi Biryani', price: 450, category: 'Main Course' },
      { name: 'Borhani', price: 80, category: 'Beverage' },
    ]},
    { userId: restaurantManager.id, businessName: `${DEMO_TAG} Sundarbans Seafood Court`, city: 'Coxs Bazar', address: 'Laboni Point', description: 'Fresh seafood — grilled lobster, jumbo prawns and fish curry.', rating: 4.4, reviews: 178, menu: [
      { name: 'Grilled Lobster', price: 1800, category: 'Seafood' },
      { name: 'Tiger Prawn Curry', price: 950, category: 'Seafood' },
      { name: 'Sea Fish Platter', price: 1300, category: 'Seafood' },
    ]},
    { userId: restaurantOwner.id, businessName: `${DEMO_TAG} Chakhana Sylhet`, city: 'Sylhet', address: 'Zindabazar, Sylhet', description: 'Sylheti authentic Shatkora beef and doi ilish.', rating: 4.3, reviews: 132, menu: [
      { name: 'Shatkora Beef', price: 380, category: 'Main Course' },
      { name: 'Doi Ilish', price: 720, category: 'Main Course' },
      { name: '7-Layer Tea', price: 120, category: 'Beverage' },
    ]},
    { userId: restaurantOwner.id, businessName: `${DEMO_TAG} Wok & Wok Chinese`, city: 'Chattogram', address: 'GEC Circle, Chattogram', description: 'Modern Indo-Chinese and Thai fusion.', rating: 4.2, reviews: 96, menu: [
      { name: 'Chili Chicken', price: 380, category: 'Starter' },
      { name: 'Thai Soup', price: 220, category: 'Soup' },
      { name: 'Thai Fried Rice', price: 320, category: 'Main Course' },
    ]},
    { userId: restaurantOwner.id, businessName: `${DEMO_TAG} Mughal Darbar`, city: 'Rajshahi', address: 'Shaheb Bazar, Rajshahi', description: 'Premium Mughlai restaurant.', rating: 4.4, reviews: 144, menu: [
      { name: 'Mutton Biryani', price: 420, category: 'Main Course' },
      { name: 'Reshmi Kebab', price: 340, category: 'Starter' },
    ]},
    { userId: restaurantOwner.id, businessName: `${DEMO_TAG} Puran Dhaka Street Kitchen`, city: 'Dhaka', address: 'Old Dhaka, Chawkbazar', description: 'Old Dhaka street food — fuchka, chotpoti and bakarkhani.', rating: 4.6, reviews: 410, menu: [
      { name: 'Fuchka (6 pcs)', price: 80, category: 'Street Food' },
      { name: 'Chotpoti', price: 60, category: 'Street Food' },
      { name: 'Bakarkhani', price: 30, category: 'Bakery' },
    ]},
    { userId: restaurantOwner.id, businessName: `${DEMO_TAG} Cafe Rhythm`, city: 'Dhaka', address: 'Gulshan-2, Dhaka', description: 'Coffee shop and continental cafe.', rating: 4.2, reviews: 188, menu: [
      { name: 'Cappuccino', price: 280, category: 'Beverage' },
      { name: 'Club Sandwich', price: 380, category: 'Snack' },
    ]},
    { userId: restaurantOwner.id, businessName: `${DEMO_TAG} Barishal Riverside`, city: 'Barishal', address: 'Launch Ghat, Barishal', description: 'Family restaurant with river fish recipes.', rating: 4.0, reviews: 72, menu: [
      { name: 'Boal Fish Curry', price: 320, category: 'Main Course' },
      { name: 'Shutki Bharta', price: 220, category: 'Side' },
    ]},
  ];
  for (const r of restaurantSeeds) {
    const p = await findOrCreateProvider({
      userId: r.userId, businessName: r.businessName, category: 'restaurant',
      description: r.description, address: r.address, city: r.city,
      phone: '01911000003', rating: r.rating, totalReviews: r.reviews,
    });
    for (const item of r.menu) {
      await findOrCreateService({
        providerId: p.id, name: item.name, category: 'restaurant_menu',
        description: `${item.category} demo menu item`, price: item.price,
        availability: '11:00 - 23:00',
      });
    }
  }
  console.log(`Restaurants seeded: ${restaurantSeeds.length}`);

  // ============ 6. CNG DRIVERS ============
  const cngSeeds: Array<{ userId: number; businessName: string; city: string; description: string; phone: string; rating: number; reviews: number; rate: number }> = [
    { userId: cngDriver.id, businessName: `${DEMO_TAG} Kabir CNG Service`, city: 'Dhaka', description: 'Verified CNG driver Old Dhaka & Ramna', phone: '01911000005', rating: 4.5, reviews: 87, rate: 60 },
    { userId: cngOwner.id, businessName: `${DEMO_TAG} Rajdhani CNG Fleet`, city: 'Dhaka', description: 'Fleet of 8 verified CNGs covering Gulshan-Banani', phone: '01911000006', rating: 4.3, reviews: 122, rate: 70 },
    { userId: cngDriver.id, businessName: `${DEMO_TAG} Sylhet CNG Express`, city: 'Sylhet', description: 'Sylhet city CNG driver local & tourist routes', phone: '01911000005', rating: 4.4, reviews: 54, rate: 80 },
    { userId: cngOwner.id, businessName: `${DEMO_TAG} Chattogram Hill CNG`, city: 'Chattogram', description: 'CNG service for hilly routes around Patenga', phone: '01911000006', rating: 4.2, reviews: 41, rate: 90 },
    { userId: cngDriver.id, businessName: `${DEMO_TAG} Cox Bazar Beach CNG`, city: 'Coxs Bazar', description: 'Beachfront CNG tours', phone: '01911000005', rating: 4.4, reviews: 76, rate: 100 },
    { userId: cngDriver.id, businessName: `${DEMO_TAG} Sreemangal Tea Tour CNG`, city: 'Sreemangal', description: 'Tea garden & Lawachara CNG tour', phone: '01911000005', rating: 4.5, reviews: 32, rate: 120 },
    { userId: cngDriver.id, businessName: `${DEMO_TAG} Kuakata Beach CNG`, city: 'Kuakata', description: 'Sunrise & sunset CNG tours', phone: '01911000005', rating: 4.3, reviews: 21, rate: 90 },
    { userId: cngDriver.id, businessName: `${DEMO_TAG} Rangamati Lake CNG`, city: 'Rangamati', description: 'CNG service around Kaptai Lake viewpoints', phone: '01911000005', rating: 4.1, reviews: 18, rate: 110 },
  ];
  for (const c of cngSeeds) {
    const p = await findOrCreateProvider({
      userId: c.userId, businessName: c.businessName, category: 'cng',
      description: `${c.description}. DEMO rate BDT ${c.rate}/km starting`,
      address: `Central stand, ${c.city}`, city: c.city, phone: c.phone,
      rating: c.rating, totalReviews: c.reviews,
    });
    await findOrCreateService({
      providerId: p.id, name: `${c.city} CNG Trip`, category: 'cng_trip',
      description: `${c.description}. DEMO rate BDT ${c.rate}/km`,
      price: c.rate, capacity: 3, availability: '6:00 - 23:00',
    });
  }
  console.log(`CNG drivers seeded: ${cngSeeds.length}`);

  // ============ 7. TOUR GUIDES ============
  const guideSeeds: Array<{ userId: number; businessName: string; city: string; description: string; rating: number; reviews: number; dailyRate: number; languages: string }> = [
    { userId: guideUser.id, businessName: `${DEMO_TAG} Cox Bazar Specialist Guide`, city: 'Coxs Bazar', description: 'English-speaking guide 8 yrs experience. Beach & Himchari specialist.', rating: 4.7, reviews: 142, dailyRate: 3500, languages: 'English,Bangla,Hindi' },
    { userId: guideUser.id, businessName: `${DEMO_TAG} Sundarbans Forest Expert`, city: 'Khulna', description: 'Sundarbans licensed guide. Wildlife & boat tours.', rating: 4.8, reviews: 96, dailyRate: 5000, languages: 'English,Bangla' },
    { userId: guideUser.id, businessName: `${DEMO_TAG} Sylhet Tea & Hill Guide`, city: 'Sylhet', description: 'Sylhet, Jaflong, Ratargul & tea garden tours.', rating: 4.5, reviews: 78, dailyRate: 3200, languages: 'English,Bangla' },
    { userId: guideUser.id, businessName: `${DEMO_TAG} Bandarban Hill Trekking Guide`, city: 'Bandarban', description: 'Nilgiri, Nilachal & tribal village treks.', rating: 4.6, reviews: 64, dailyRate: 4000, languages: 'English,Bangla,Marma' },
    { userId: guideUser.id, businessName: `${DEMO_TAG} Rangamati Kaptai Lake Guide`, city: 'Rangamati', description: 'Kaptai Lake boat & tribal cultural tours.', rating: 4.4, reviews: 48, dailyRate: 3500, languages: 'English,Bangla,Chakma' },
    { userId: guideUser.id, businessName: `${DEMO_TAG} Dhaka City Heritage Guide`, city: 'Dhaka', description: 'Old Dhaka, Lalbagh Fort, Ahsan Manzil tours.', rating: 4.5, reviews: 110, dailyRate: 2800, languages: 'English,Bangla,Arabic' },
    { userId: guideUser.id, businessName: `${DEMO_TAG} Old Dhaka Food Walk Guide`, city: 'Dhaka', description: 'Old Dhaka street food specialist.', rating: 4.7, reviews: 88, dailyRate: 2500, languages: 'English,Bangla' },
    { userId: guideUser.id, businessName: `${DEMO_TAG} Chattogram City Guide`, city: 'Chattogram', description: 'Chattogram city, Patenga & ethnic zone tours.', rating: 4.4, reviews: 56, dailyRate: 3000, languages: 'English,Bangla' },
    { userId: guideUser.id, businessName: `${DEMO_TAG} Kuakata Sunrise Guide`, city: 'Kuakata', description: 'Kuakata beach sunrise/sunset specialist.', rating: 4.5, reviews: 41, dailyRate: 2500, languages: 'English,Bangla' },
    { userId: guideUser.id, businessName: `${DEMO_TAG} Sreemangal Tea Garden Guide`, city: 'Sreemangal', description: 'Tea garden & Lawachara swamp forest specialist.', rating: 4.6, reviews: 52, dailyRate: 3000, languages: 'English,Bangla' },
  ];
  for (const g of guideSeeds) {
    const p = await findOrCreateProvider({
      userId: g.userId, businessName: g.businessName, category: 'guide',
      description: `${g.description} Languages: ${g.languages}. Daily rate BDT ${g.dailyRate}.`,
      address: `Central, ${g.city}`, city: g.city, phone: '01911000007',
      rating: g.rating, totalReviews: g.reviews,
    });
    await findOrCreateService({
      providerId: p.id, name: `${g.city} Tour Guide Daily`, category: 'guide_day',
      description: `Languages: ${g.languages}. ${g.description}`,
      price: g.dailyRate, capacity: 6, availability: 'Daily 8:00 - 18:00',
    });
  }
  console.log(`Tour guides seeded: ${guideSeeds.length}`);

  // ============ 8. BUS / TRANSPORT ============
  const busSeeds: Array<{ operator: string; route: string; departure: string; arrival: string; price: number; seats: number; category: string; rating: number; reviews: number }> = [
    { operator: `${DEMO_TAG} Green Line Paribahan`, route: 'Dhaka -> Coxs Bazar', departure: '22:00', arrival: '08:00', price: 1800, seats: 36, category: 'bus_ac', rating: 4.5, reviews: 320 },
    { operator: `${DEMO_TAG} Hanif Enterprise`, route: 'Dhaka -> Chattogram', departure: '06:30', arrival: '13:00', price: 950, seats: 40, category: 'bus_ac', rating: 4.4, reviews: 412 },
    { operator: `${DEMO_TAG} Shyamoli Paribahan`, route: 'Dhaka -> Sylhet', departure: '21:30', arrival: '05:30', price: 1100, seats: 36, category: 'bus_ac', rating: 4.3, reviews: 256 },
    { operator: `${DEMO_TAG} Nabil Paribahan`, route: 'Dhaka -> Rajshahi', departure: '20:00', arrival: '04:30', price: 900, seats: 40, category: 'bus_ac', rating: 4.2, reviews: 198 },
    { operator: `${DEMO_TAG} Eagle Paribahan`, route: 'Dhaka -> Khulna', departure: '20:30', arrival: '05:00', price: 1000, seats: 40, category: 'bus_ac', rating: 4.2, reviews: 167 },
    { operator: `${DEMO_TAG} Sakura Line`, route: 'Dhaka -> Barishal', departure: '21:00', arrival: '05:30', price: 950, seats: 36, category: 'bus_ac', rating: 4.1, reviews: 132 },
    { operator: `${DEMO_TAG} BRTC Double Decker`, route: 'Dhaka -> Rangpur', departure: '19:30', arrival: '06:30', price: 850, seats: 44, category: 'bus_non_ac', rating: 4.0, reviews: 89 },
    { operator: `${DEMO_TAG} Saintmartin Paribahan`, route: 'Dhaka -> Cumilla', departure: '07:00', arrival: '10:30', price: 400, seats: 40, category: 'bus_non_ac', rating: 4.0, reviews: 102 },
    { operator: `${DEMO_TAG} Chattogram Express`, route: 'Chattogram -> Coxs Bazar', departure: '08:00', arrival: '12:30', price: 650, seats: 40, category: 'bus_ac', rating: 4.3, reviews: 154 },
    { operator: `${DEMO_TAG} Sreemangal Link`, route: 'Sylhet -> Sreemangal', departure: '09:00', arrival: '10:30', price: 180, seats: 32, category: 'bus_non_ac', rating: 4.1, reviews: 64 },
  ];
  for (const b of busSeeds) {
    const city = b.route.split('->')[0].trim();
    const p = await findOrCreateProvider({
      userId: busOperator.id, businessName: b.operator, category: 'bus',
      description: `${b.route} service by ${b.operator}`,
      address: `Bus terminal, ${city}`, city, phone: '01911000008',
      rating: b.rating, totalReviews: b.reviews,
    });
    await findOrCreateService({
      providerId: p.id, name: b.route, category: b.category, route: b.route,
      description: `${b.operator} depart ${b.departure} arrive ${b.arrival}`,
      price: b.price, capacity: b.seats, availability: `${b.departure}-${b.arrival}`,
    });
  }
  console.log(`Bus services seeded: ${busSeeds.length}`);

  // ============ 9. BOAT / LAUNCH ============
  const boatSeeds: Array<{ businessName: string; city: string; description: string; route: string; price: number; capacity: number; rating: number; reviews: number }> = [
    { businessName: `${DEMO_TAG} Padma River Cruise`, city: 'Barishal', description: 'Padma river luxury cruise boat 50 pax.', route: 'Barishal -> Bhola', price: 1200, capacity: 50, rating: 4.4, reviews: 76 },
    { businessName: `${DEMO_TAG} Bhola Launch Service`, city: 'Bhola', description: 'Inter-district launch 80 pax.', route: 'Barishal -> Bhola Launch', price: 600, capacity: 80, rating: 4.0, reviews: 58 },
    { businessName: `${DEMO_TAG} Kuakata Sunset Boat`, city: 'Kuakata', description: 'Sunset boat trip 12 pax.', route: 'Kuakata Sea Sunset Point', price: 1500, capacity: 12, rating: 4.5, reviews: 41 },
    { businessName: `${DEMO_TAG} Sundarbans Forest Cruise`, city: 'Khulna', description: 'Multi-day Sundarbans cruise 24 pax.', route: 'Khulna -> Sundarbans', price: 9500, capacity: 24, rating: 4.7, reviews: 88 },
    { businessName: `${DEMO_TAG} Rangamati Kaptai Boat`, city: 'Rangamati', description: 'Kaptai Lake boat tour 20 pax.', route: 'Rangamati -> Kaptai Lake', price: 1800, capacity: 20, rating: 4.4, reviews: 33 },
    { businessName: `${DEMO_TAG} Sylhet Ratargul Boat`, city: 'Sylhet', description: 'Ratargul swamp forest boat 10 pax.', route: 'Sylhet -> Ratargul', price: 1300, capacity: 10, rating: 4.3, reviews: 27 },
  ];
  for (const b of boatSeeds) {
    const p = await findOrCreateProvider({
      userId: boatRental.id, businessName: b.businessName, category: 'boat',
      description: b.description, address: `Launch ghat, ${b.city}`,
      city: b.city, phone: '01911000011', rating: b.rating, totalReviews: b.reviews,
    });
    await findOrCreateService({
      providerId: p.id, name: b.route, category: 'boat', route: b.route,
      description: b.description, price: b.price, capacity: b.capacity, availability: '7:00 - 18:00',
    });
  }
  console.log(`Boat providers seeded: ${boatSeeds.length}`);

  // ============ 10. CAR RENTAL ============
  const carSeeds: Array<{ businessName: string; city: string; vehicleName: string; vehicleType: string; pricePerDay: number; capacity: number; driverIncluded: boolean; rating: number; reviews: number }> = [
    { businessName: `${DEMO_TAG} Dhaka Sedan Rental`, city: 'Dhaka', vehicleName: 'Toyota Corolla Sedan', vehicleType: 'Sedan', pricePerDay: 4500, capacity: 4, driverIncluded: true, rating: 4.4, reviews: 132 },
    { businessName: `${DEMO_TAG} Dhaka SUV Rental`, city: 'Dhaka', vehicleName: 'Toyota Premio SUV', vehicleType: 'SUV', pricePerDay: 7500, capacity: 6, driverIncluded: true, rating: 4.5, reviews: 98 },
    { businessName: `${DEMO_TAG} Dhaka Microbus Rental`, city: 'Dhaka', vehicleName: 'Toyota HiAce Microbus', vehicleType: 'Microbus', pricePerDay: 9000, capacity: 12, driverIncluded: true, rating: 4.3, reviews: 76 },
    { businessName: `${DEMO_TAG} Dhaka Noah Family Van`, city: 'Dhaka', vehicleName: 'Toyota Noah', vehicleType: 'Family Van', pricePerDay: 6500, capacity: 7, driverIncluded: true, rating: 4.4, reviews: 110 },
    { businessName: `${DEMO_TAG} Cox Bazar Tourist SUV`, city: 'Coxs Bazar', vehicleName: 'Mitsubishi Pajero', vehicleType: 'Tourist Vehicle', pricePerDay: 8500, capacity: 6, driverIncluded: true, rating: 4.5, reviews: 64 },
    { businessName: `${DEMO_TAG} Sylhet Hill Sedan`, city: 'Sylhet', vehicleName: 'Honda Accord', vehicleType: 'Sedan', pricePerDay: 5200, capacity: 4, driverIncluded: true, rating: 4.2, reviews: 47 },
  ];
  for (const c of carSeeds) {
    const p = await findOrCreateProvider({
      userId: carRental.id, businessName: c.businessName, category: 'car_rental',
      description: `${c.vehicleName} rental. Driver included: ${c.driverIncluded}.`,
      address: `Garage, ${c.city}`, city: c.city, phone: '01911000010',
      rating: c.rating, totalReviews: c.reviews,
    });
    await findOrCreateService({
      providerId: p.id, name: c.vehicleName, category: 'car_rental',
      description: `${c.vehicleType} driver ${c.driverIncluded ? 'included' : 'optional'}`,
      price: c.pricePerDay, capacity: c.capacity, availability: 'Daily 24h',
    });
  }
  console.log(`Car rental providers seeded: ${carSeeds.length}`);

  // ============ 11. TOURIST ACTIVITIES ============
  const activitySeeds: Array<{ businessName: string; city: string; name: string; route: string; price: number; capacity: number; description: string; rating: number; reviews: number; userId: number }> = [
    { businessName: `${DEMO_TAG} Cox Bazar Beach Tour`, city: 'Coxs Bazar', name: 'Cox Bazar Beach Tour', route: 'Coxs Bazar', price: 1500, capacity: 20, description: 'Full-day Coxs Bazar beach tour including Laboni and Inani points.', rating: 4.5, reviews: 87, userId: activityProvider.id },
    { businessName: `${DEMO_TAG} Himchari Sunset Trip`, city: 'Coxs Bazar', name: 'Himchari Sunset Trip', route: 'Himchari', price: 1800, capacity: 15, description: 'Himchari hill + sunset trip.', rating: 4.6, reviews: 64, userId: activityProvider.id },
    { businessName: `${DEMO_TAG} Inani Beach Trip`, city: 'Coxs Bazar', name: 'Inani Beach Trip', route: 'Inani', price: 2200, capacity: 12, description: 'Inani coral beach day trip.', rating: 4.5, reviews: 41, userId: activityProvider.id },
    { businessName: `${DEMO_TAG} Jaflong Tour`, city: 'Sylhet', name: 'Jaflong Tour', route: 'Jaflong', price: 2500, capacity: 15, description: 'Jaflong zero-point stone collection tour.', rating: 4.4, reviews: 58, userId: activityProvider.id },
    { businessName: `${DEMO_TAG} Ratargul Trip`, city: 'Sylhet', name: 'Ratargul Trip', route: 'Ratargul', price: 2800, capacity: 10, description: 'Ratargul swamp forest boat tour.', rating: 4.5, reviews: 47, userId: activityProvider.id },
    { businessName: `${DEMO_TAG} Lalakhal Boat Trip`, city: 'Sylhet', name: 'Lalakhal Boat Trip', route: 'Lalakhal', price: 3200, capacity: 12, description: 'Lalakhal blue-water river boat trip.', rating: 4.5, reviews: 38, userId: activityProvider.id },
    { businessName: `${DEMO_TAG} Tea Garden Tour`, city: 'Sreemangal', name: 'Tea Garden Tour', route: 'Sreemangal', price: 1500, capacity: 20, description: 'Sreemangal tea garden + 7-layer tea tour.', rating: 4.4, reviews: 62, userId: activityProvider.id },
    { businessName: `${DEMO_TAG} Bandarban Hill Tour`, city: 'Bandarban', name: 'Bandarban Hill Tour', route: 'Bandarban', price: 3500, capacity: 12, description: 'Bandarban hill tour.', rating: 4.5, reviews: 41, userId: activityProvider.id },
    { businessName: `${DEMO_TAG} Nilgiri Tour`, city: 'Bandarban', name: 'Nilgiri Tour', route: 'Nilgiri', price: 4200, capacity: 10, description: 'Nilgiri clouds tour.', rating: 4.7, reviews: 38, userId: activityProvider.id },
    { businessName: `${DEMO_TAG} Nilachal Tour`, city: 'Bandarban', name: 'Nilachal Tour', route: 'Nilachal', price: 3800, capacity: 10, description: 'Nilachal golden temple tour.', rating: 4.6, reviews: 27, userId: activityProvider.id },
    { businessName: `${DEMO_TAG} Kaptai Lake Boat Tour`, city: 'Rangamati', name: 'Kaptai Lake Boat Tour', route: 'Kaptai Lake', price: 2500, capacity: 20, description: 'Kaptai Lake half-day boat tour.', rating: 4.5, reviews: 33, userId: activityProvider.id },
    { businessName: `${DEMO_TAG} Rangamati City Tour`, city: 'Rangamati', name: 'Rangamati City Tour', route: 'Rangamati', price: 2200, capacity: 15, description: 'Rangamati city and tribal cultural tour.', rating: 4.3, reviews: 21, userId: activityProvider.id },
    { businessName: `${DEMO_TAG} Sundarbans Forest Cruise`, city: 'Khulna', name: 'Sundarbans Forest Cruise', route: 'Sundarbans', price: 8500, capacity: 24, description: '3-day Sundarbans forest cruise.', rating: 4.7, reviews: 96, userId: activityProvider.id },
    { businessName: `${DEMO_TAG} Sundarbans Wildlife Tour`, city: 'Khulna', name: 'Sundarbans Wildlife Tour', route: 'Sundarbans', price: 9500, capacity: 24, description: 'Sundarbans wildlife + Royal Bengal Tiger tour.', rating: 4.8, reviews: 58, userId: activityProvider.id },
    { businessName: `${DEMO_TAG} Old Dhaka Heritage Tour`, city: 'Dhaka', name: 'Old Dhaka Heritage Tour', route: 'Old Dhaka', price: 1800, capacity: 12, description: 'Old Dhaka Lalbagh Fort and Ahsan Manzil heritage walk.', rating: 4.6, reviews: 142, userId: activityProvider.id },
    { businessName: `${DEMO_TAG} Lalbagh Fort Tour`, city: 'Dhaka', name: 'Lalbagh Fort Tour', route: 'Lalbagh Fort', price: 1200, capacity: 15, description: 'Lalbagh Fort half-day tour.', rating: 4.4, reviews: 87, userId: activityProvider.id },
    { businessName: `${DEMO_TAG} Dhaka River Cruise`, city: 'Dhaka', name: 'Dhaka River Cruise', route: 'Buriganga', price: 2200, capacity: 30, description: 'Buriganga river evening cruise.', rating: 4.3, reviews: 41, userId: activityProvider.id },
    { businessName: `${DEMO_TAG} Nipa Travels Tour Package`, city: 'Dhaka', name: 'Nipa Travels Cox Bazar 3D2N', route: 'Dhaka -> Coxs Bazar', price: 12500, capacity: 30, description: 'Full 3 day 2 night Coxs Bazar tour package from agency.', rating: 4.5, reviews: 64, userId: agencyUser.id },
    { businessName: `${DEMO_TAG} Sylhet Tea Tour Package`, city: 'Sylhet', name: 'Sylhet Tea Tour Package', route: 'Sylhet', price: 8500, capacity: 20, description: 'Sylhet and Sreemangal 2 day package.', rating: 4.4, reviews: 38, userId: agencyUser.id },
  ];
  for (const a of activitySeeds) {
    const p = await findOrCreateProvider({
      userId: a.userId, businessName: a.businessName, category: 'activity',
      description: a.description, address: `Activity base, ${a.city}`,
      city: a.city, phone: '01911000013', rating: a.rating, totalReviews: a.reviews,
    });
    await findOrCreateService({
      providerId: p.id, name: a.name, category: 'activity', route: a.route,
      description: a.description, price: a.price, capacity: a.capacity,
      availability: 'Daily 8:00 - 18:00',
    });
  }
  console.log(`Activities seeded: ${activitySeeds.length}`);

  // ============ 12. STUDENT DEALS ============
  const studentDealSeeds: Array<{ providerId: number; serviceId?: number; roomId?: number; discountPct: number; category: string; businessName: string; userId: number; city: string; description: string }> = [
    { providerId: 0, category: 'bus', discountPct: 20, businessName: `${DEMO_TAG} Student Bus Discount`, userId: busOperator.id, city: 'Dhaka', description: '20% off on all bus tickets for verified students' },
    { providerId: 0, category: 'hotel', discountPct: 15, businessName: `${DEMO_TAG} Student Hotel Discount`, userId: hotelOwner.id, city: 'Dhaka', description: '15% off on dorm stays and budget rooms for students' },
    { providerId: 0, category: 'restaurant', discountPct: 25, businessName: `${DEMO_TAG} Student Restaurant Deal`, userId: restaurantOwner.id, city: 'Dhaka', description: '25% off on set menu items for student ID holders' },
    { providerId: 0, category: 'activity', discountPct: 30, businessName: `${DEMO_TAG} Student Tour Package`, userId: activityProvider.id, city: 'Dhaka', description: '30% off on Nipa Travels tour packages for students' },
  ];
  for (const s of studentDealSeeds) {
    const p = await findOrCreateProvider({
      userId: s.userId, businessName: s.businessName, category: 'student_deal',
      description: s.description, address: `Central, ${s.city}`,
      city: s.city, phone: '01911000012', rating: 4.5, totalReviews: 24,
    });
    await findOrCreateService({
      providerId: p.id, name: s.businessName, category: 'student_deal',
      description: s.description, price: s.discountPct, availability: 'All year',
    });
  }
  console.log(`Student deals seeded: ${studentDealSeeds.length}`);

  // ============ 13. QR TRAVEL PASS + REWARDS via BOOKINGS ============
  // We encode demo ETP points as completed paid bookings so admin revenue + qr_logs surface them.
  const inDays = (n: number) => new Date(Date.now() + n * 24 * 60 * 60 * 1000);
  const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

  // helper: find provider by businessName+category
  const findProvider = async (businessName: string, category: string) => {
    return prisma.serviceProvider.findFirst({ where: { businessName, category } });
  };
  const findService = async (providerId: number, name: string, category: string) => {
    return prisma.service.findFirst({ where: { providerId, name, category } });
  };

  // 13a. Tourist -> Cox's Bazar hotel + bus
  const beachPalaceHotel = await findProvider(`${DEMO_TAG} Cox Bazar Beach Palace`, 'hotel');
  const beachPalaceRoom = beachPalaceHotel ? await prisma.room.findFirst({ where: { providerId: beachPalaceHotel.id, name: 'Ocean View Room' } }) : null;
  const greenLineService = await findService((await findProvider(`${DEMO_TAG} Green Line Paribahan`, 'bus'))!.id, 'Dhaka -> Coxs Bazar', 'bus_ac');
  if (beachPalaceHotel && beachPalaceRoom && greenLineService) {
    const b1 = await findOrCreateBooking({
      userId: tourist.id, providerId: beachPalaceHotel.id, roomId: beachPalaceRoom.id,
      category: 'hotel', travelDate: inDays(14), numberOfPeople: 2,
      totalAmount: 19600, discountAmount: 0, finalAmount: 19600,
      status: 'confirmed', paymentStatus: 'paid', route: 'Coxs Bazar Beach Palace',
    });
    await findOrCreateBooking({
      userId: tourist.id, providerId: (await findProvider(`${DEMO_TAG} Green Line Paribahan`, 'bus'))!.id, serviceId: greenLineService.id,
      category: 'bus', travelDate: inDays(14), numberOfPeople: 2,
      totalAmount: 3600, discountAmount: 0, finalAmount: 3600,
      status: 'confirmed', paymentStatus: 'paid', route: 'Dhaka -> Coxs Bazar',
      seatNumbers: 'A1,A2',
    });
    const exists = await prisma.qrLog.findFirst({ where: { bookingId: b1.id, userId: tourist.id } });
    if (!exists) {
      await prisma.qrLog.create({ data: { bookingId: b1.id, userId: tourist.id, providerId: beachPalaceHotel.id, qrToken: `DEMO-QR-TOURIST-${b1.id}`, discountType: 'etp_points', discountValue: 1250, isUsed: true } });
    }
  }

  // 13b. Family -> Sylhet
  const jaflongHotel = await findProvider(`${DEMO_TAG} Jaflong View Resort`, 'hotel');
  const jaflongRoom = jaflongHotel ? await prisma.room.findFirst({ where: { providerId: jaflongHotel.id, name: 'Hill View Cottage' } }) : null;
  if (jaflongHotel && jaflongRoom) {
    const b = await findOrCreateBooking({
      userId: family.id, providerId: jaflongHotel.id, roomId: jaflongRoom.id,
      category: 'hotel', travelDate: inDays(21), numberOfPeople: 4,
      totalAmount: 26000, discountAmount: 2000, finalAmount: 24000,
      status: 'confirmed', paymentStatus: 'paid', route: 'Jaflong View Resort',
    });
    await prisma.qrLog.create({ data: { bookingId: b.id, userId: family.id, providerId: jaflongHotel.id, qrToken: `DEMO-QR-FAMILY-${b.id}`, discountType: 'etp_points', discountValue: 2400, isUsed: true } });
  }

  // 13c. Student -> hostel + tour
  const studentHostel = await findProvider(`${DEMO_TAG} Student Stay Dhaka`, 'hotel');
  const studentRoom = studentHostel ? await prisma.room.findFirst({ where: { providerId: studentHostel.id, name: 'Shared Dorm (8-bed)' } }) : null;
  const nipaPkg = await findService((await findProvider(`${DEMO_TAG} Nipa Travels Tour Package`, 'activity'))!.id, 'Nipa Travels Cox Bazar 3D2N', 'activity');
  if (studentHostel && studentRoom && nipaPkg) {
    const b1 = await findOrCreateBooking({
      userId: student.id, providerId: studentHostel.id, roomId: studentRoom.id,
      category: 'hotel', travelDate: daysAgo(7), numberOfPeople: 1,
      totalAmount: 950, discountAmount: 200, finalAmount: 750,
      status: 'completed', paymentStatus: 'paid', route: 'Student Stay Dhaka',
    });
    await findOrCreateBooking({
      userId: student.id, providerId: nipaPkg.providerId, serviceId: nipaPkg.id,
      category: 'activity', travelDate: inDays(30), numberOfPeople: 1,
      totalAmount: 12500, discountAmount: 3750, finalAmount: 8750,
      status: 'confirmed', paymentStatus: 'paid', route: 'Coxs Bazar Student Tour',
    });
    await prisma.qrLog.create({ data: { bookingId: b1.id, userId: student.id, providerId: studentHostel.id, qrToken: `DEMO-QR-STUDENT-${b1.id}`, discountType: 'student_discount', discountValue: 850, isUsed: true } });
  }

  // 13d. Business -> Chattogram Bay Tower + Car rental
  const ctgHotel = await findProvider(`${DEMO_TAG} Chattogram Bay Tower`, 'hotel');
  const ctgRoom = ctgHotel ? await prisma.room.findFirst({ where: { providerId: ctgHotel.id, name: 'Business Deluxe' } }) : null;
  const ctgCar = await findService((await findProvider(`${DEMO_TAG} Dhaka Sedan Rental`, 'car_rental'))!.id, 'Toyota Corolla Sedan', 'car_rental');
  if (ctgHotel && ctgRoom && ctgCar) {
    const b1 = await findOrCreateBooking({
      userId: bizUser.id, providerId: ctgHotel.id, roomId: ctgRoom.id,
      category: 'hotel', travelDate: inDays(7), numberOfPeople: 1,
      totalAmount: 7800, discountAmount: 0, finalAmount: 7800,
      status: 'confirmed', paymentStatus: 'paid', route: 'Chattogram Bay Tower',
    });
    const sedan = await findOrCreateBooking({
      userId: bizUser.id, providerId: ctgCar.providerId, serviceId: ctgCar.id,
      category: 'car_rental', travelDate: inDays(7), numberOfPeople: 1,
      totalAmount: 13500, discountAmount: 0, finalAmount: 13500,
      status: 'confirmed', paymentStatus: 'paid', route: 'Dhaka Sedan Rental',
    });
    await prisma.qrLog.create({ data: { bookingId: b1.id, userId: bizUser.id, providerId: ctgHotel.id, qrToken: `DEMO-QR-BIZ-${b1.id}`, discountType: 'etp_points', discountValue: 4800, isUsed: true } });
    await prisma.qrLog.create({ data: { bookingId: sedan.id, userId: bizUser.id, providerId: ctgCar.providerId, qrToken: `DEMO-QR-BIZ-${sedan.id}`, discountType: 'business_travel', discountValue: 0, isUsed: false } });
  }

  // 13e. International -> Sundarbans cruise
  const sundarbansCruise = await findService((await findProvider(`${DEMO_TAG} Sundarbans Forest Cruise`, 'activity'))!.id, 'Sundarbans Forest Cruise', 'activity');
  if (sundarbansCruise) {
    const b = await findOrCreateBooking({
      userId: international.id, providerId: sundarbansCruise.providerId, serviceId: sundarbansCruise.id,
      category: 'activity', travelDate: inDays(45), numberOfPeople: 2,
      totalAmount: 17000, discountAmount: 0, finalAmount: 17000,
      status: 'confirmed', paymentStatus: 'paid', route: 'Sundarbans Forest Cruise',
    });
    await prisma.qrLog.create({ data: { bookingId: b.id, userId: international.id, providerId: sundarbansCruise.providerId, qrToken: `DEMO-QR-INTL-${b.id}`, discountType: 'etp_points', discountValue: 6500, isUsed: false } });
  }

  // 13f. Restaurant booking
  const hilsaRest = await findProvider(`${DEMO_TAG} Hilsa Biryani House`, 'restaurant');
  const hilsaMenu = hilsaRest ? await prisma.service.findFirst({ where: { providerId: hilsaRest.id, name: 'Kacchi Biryani' } }) : null;
  if (hilsaRest && hilsaMenu) {
    await findOrCreateBooking({
      userId: tourist.id, providerId: hilsaRest.id, serviceId: hilsaMenu.id,
      category: 'restaurant', travelDate: daysAgo(2), numberOfPeople: 2,
      totalAmount: 900, discountAmount: 0, finalAmount: 900,
      status: 'completed', paymentStatus: 'paid', route: 'Hilsa Biryani House',
    });
  }

  // 13g. CNG booking + Guide booking
  const cngSvc = await findService((await findProvider(`${DEMO_TAG} Cox Bazar Beach CNG`, 'cng'))!.id, 'Coxs Bazar CNG Trip', 'cng_trip');
  if (cngSvc) {
    await findOrCreateBooking({
      userId: international.id, providerId: cngSvc.providerId, serviceId: cngSvc.id,
      category: 'cng', travelDate: daysAgo(5), numberOfPeople: 2,
      totalAmount: 600, discountAmount: 0, finalAmount: 600,
      status: 'completed', paymentStatus: 'paid', route: 'Coxs Bazar CNG Tour',
    });
  }
  const guideSvc = await findService((await findProvider(`${DEMO_TAG} Cox Bazar Specialist Guide`, 'guide'))!.id, 'Coxs Bazar Tour Guide Daily', 'guide_day');
  if (guideSvc) {
    await findOrCreateBooking({
      userId: tourist.id, providerId: guideSvc.providerId, serviceId: guideSvc.id,
      category: 'guide', travelDate: inDays(14), numberOfPeople: 1,
      totalAmount: 3500, discountAmount: 0, finalAmount: 3500,
      status: 'confirmed', paymentStatus: 'paid', route: 'Coxs Bazar Specialist Guide',
    });
  }

  // 13h. Boat booking
  const boatSvc = await findService((await findProvider(`${DEMO_TAG} Sundarbans Forest Cruise`, 'boat'))!.id, 'Khulna -> Sundarbans', 'boat');
  if (boatSvc) {
    await findOrCreateBooking({
      userId: family.id, providerId: boatSvc.providerId, serviceId: boatSvc.id,
      category: 'boat', travelDate: inDays(60), numberOfPeople: 6,
      totalAmount: 57000, discountAmount: 3000, finalAmount: 54000,
      status: 'confirmed', paymentStatus: 'paid', route: 'Sundarbans Cruise',
    });
  }

  console.log('Demo bookings + QR travel pass logs seeded');
  console.log('\n=== ETP DEMO CREDENTIALS (DEV ONLY) ===');
  console.log('Admins: 01710000001..3 / Admin@ETP2026  (superadmin/opsadmin/support @etp.demo)');
  console.log('All other demo accounts: password Demo@ETP2026');
  console.log('See seed.ts for full phone -> email mapping.');
}

main()
  .catch((e) => { console.error('Seed error:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });