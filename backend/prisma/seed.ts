import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create admin user
  const adminPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { phone: '01712345678' },
    update: {},
    create: {
      phone: '01712345678',
      email: 'admin@extratravelpoint.com',
      fullName: 'System Admin',
      passwordHash: adminPassword,
      role: 'admin'
    }
  });
  console.log('✅ Admin user created:', admin.phone);

  // Create demo customer
  const customerPassword = await bcrypt.hash('customer123', 10);
  const customer = await prisma.user.upsert({
    where: { phone: '01812345678' },
    update: {},
    create: {
      phone: '01812345678',
      email: 'customer@example.com',
      fullName: 'Demo Customer',
      passwordHash: customerPassword,
      role: 'customer'
    }
  });
  console.log('✅ Customer user created:', customer.phone);

  // Create demo vendor/vendor
  const vendorPassword = await bcrypt.hash('vendor123', 10);
  const vendorUser = await prisma.user.upsert({
    where: { phone: '01912345678' },
    update: {},
    create: {
      phone: '01912345678',
      email: 'vendor@example.com',
      fullName: 'Demo Vendor',
      passwordHash: vendorPassword,
      role: 'vendor'
    }
  });
  console.log('✅ Vendor user created:', vendorUser.phone);

  // Create service providers
  const hotelProvider = await prisma.serviceProvider.upsert({
    where: { id: 1 },
    update: {},
    create: {
      userId: vendorUser.id,
      businessName: 'Hotel Sea View Cox\'s Bazar',
      category: 'hotel',
      description: 'Luxury beachfront hotel with ocean views',
      address: 'Road No 1, Cox\'s Bazar',
      city: 'Cox\'s Bazar',
      latitude: 21.4272,
      longitude: 92.0058,
      phone: '01912345678',
      isVerified: true,
      rating: 4.5,
      totalReviews: 128
    }
  });
  console.log('✅ Hotel provider created:', hotelProvider.businessName);

  const busProvider = await prisma.serviceProvider.upsert({
    where: { id: 2 },
    update: {},
    create: {
      userId: vendorUser.id,
      businessName: 'Green Line Paribahan',
      category: 'bus',
      description: 'Premium bus service Dhaka to Cox\'s Bazar',
      address: 'Kalabagan, Dhaka',
      city: 'Dhaka',
      phone: '01912345679',
      isVerified: true,
      rating: 4.2,
      totalReviews: 256
    }
  });
  console.log('✅ Bus provider created:', busProvider.businessName);

  const restaurantProvider = await prisma.serviceProvider.upsert({
    where: { id: 3 },
    update: {},
    create: {
      userId: vendorUser.id,
      businessName: 'Kolatoli Restaurant',
      category: 'restaurant',
      description: 'Fresh seafood restaurant near beach',
      address: 'Kolatoli, Cox\'s Bazar',
      city: 'Cox\'s Bazar',
      phone: '01912345680',
      isVerified: true,
      rating: 4.7,
      totalReviews: 89
    }
  });
  console.log('✅ Restaurant provider created:', restaurantProvider.businessName);

  console.log('\n🎉 Seed completed!');
  console.log('\n📋 Demo Credentials:');
  console.log('   Admin:    01712345678 / admin123');
  console.log('   Customer: 01812345678 / customer123');
  console.log('   Vendor:   01912345678 / vendor123');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
