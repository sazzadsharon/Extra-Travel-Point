import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const PASSWORD = 'sharon';

async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

async function upsertUser(options: {
  phone: string;
  email: string;
  fullName: string;
  role: string;
}) {
  const passwordHash = await hashPassword(PASSWORD);

  return prisma.user.upsert({
    where: {
      phone: options.phone,
    },
    update: {
      email: options.email,
      fullName: options.fullName,
      role: options.role,
      passwordHash,
      isActive: true,
    },
    create: {
      phone: options.phone,
      email: options.email,
      fullName: options.fullName,
      role: options.role,
      passwordHash,
      isActive: true,
    },
  });
}

async function main() {
  console.log('\n========================================');
  console.log(' ETP DEMO ACCOUNTS SEED');
  console.log('========================================');

  // CUSTOMER
  const customer = await upsertUser({
    phone: '01700000001',
    email: 'barisalsharon1@gmail.com',
    fullName: 'Sharon Customer',
    role: 'customer',
  });

  console.log('\nCUSTOMER');
  console.log(`ID:    ${customer.id}`);
  console.log(`Phone: ${customer.phone}`);
  console.log(`Role:  ${customer.role}`);

  // VENDOR USER
  const vendor = await upsertUser({
    phone: '01700000002',
    email: 'barisalsharon2@gmail.com',
    fullName: 'Sharon Vendor',
    role: 'vendor',
  });

  console.log('\nVENDOR');
  console.log(`ID:    ${vendor.id}`);
  console.log(`Phone: ${vendor.phone}`);
  console.log(`Role:  ${vendor.role}`);

  // VENDOR SERVICE PROVIDER
  const existingProvider = await prisma.serviceProvider.findFirst({
    where: {
      userId: vendor.id,
    },
  });

  let provider;

  if (existingProvider) {
    provider = await prisma.serviceProvider.update({
      where: {
        id: existingProvider.id,
      },
      data: {
        businessName: 'Sharon Travel & Transport',
        category: 'BUS',
        description: 'ETP Investor Demo Bus Vendor',
        address: 'Dhaka, Bangladesh',
        city: 'Dhaka',
        phone: vendor.phone,
        status: 'APPROVED',
        isVerified: true,
        isActive: true,
        kycStatus: 'APPROVED',
        lifecycleStatus: 'ACTIVE',
        isPublished: true,
        publishedAt: new Date(),
      },
    });

    console.log('\nVENDOR SERVICE PROVIDER UPDATED');
  } else {
    provider = await prisma.serviceProvider.create({
      data: {
        userId: vendor.id,
        businessName: 'Sharon Travel & Transport',
        category: 'BUS',
        description: 'ETP Investor Demo Bus Vendor',
        address: 'Dhaka, Bangladesh',
        city: 'Dhaka',
        phone: vendor.phone,
        commissionRate: 10,
        status: 'APPROVED',
        isVerified: true,
        isActive: true,
        verifiedAt: new Date(),
        kycStatus: 'APPROVED',
        lifecycleStatus: 'ACTIVE',
        isPublished: true,
        publishedAt: new Date(),
      },
    });

    console.log('\nVENDOR SERVICE PROVIDER CREATED');
  }

  console.log(`Provider ID: ${provider.id}`);
  console.log(`Business:    ${provider.businessName}`);

  // ADMIN
  const admin = await upsertUser({
    phone: '01700000003',
    email: 'barisalsharon3@gmail.com',
    fullName: 'Sharon Admin',
    role: 'admin',
  });

  console.log('\nADMIN');
  console.log(`ID:    ${admin.id}`);
  console.log(`Phone: ${admin.phone}`);
  console.log(`Role:  ${admin.role}`);

  console.log('\n========================================');
  console.log(' DEMO ACCOUNTS READY');
  console.log('========================================');

  console.log('\nCUSTOMER');
  console.log('Login Phone: 01700000001');

  console.log('\nVENDOR');
  console.log('Login Phone: 01700000002');

  console.log('\nADMIN');
  console.log('Login Phone: 01700000003');

  console.log('\nPassword: sharon');

  console.log('\n========================================');
}

main()
  .catch((error) => {
    console.error('\nSeed failed:');
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });