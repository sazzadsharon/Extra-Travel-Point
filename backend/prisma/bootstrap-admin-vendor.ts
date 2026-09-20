import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const ALLOWED_ENVS = ['production', 'staging', 'development'];

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    console.error(`FATAL: Missing required environment variable ${name}`);
    process.exit(1);
  }
  return value.trim();
}

function requireEnvOrExit(name: string, fallback?: string): string {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    if (fallback !== undefined) return fallback;
    console.error(`FATAL: Missing required environment variable ${name}`);
    process.exit(1);
  }
  return value.trim();
}

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

async function upsertUser(tx: PrismaClient, opts: {
  phone: string;
  email: string;
  fullName: string;
  role: 'admin' | 'vendor';
  passwordHash: string;
}) {
  return tx.user.upsert({
    where: { phone: opts.phone },
    update: {
      email: opts.email,
      fullName: opts.fullName,
      isActive: true,
    },
    create: {
      phone: opts.phone,
      email: opts.email,
      fullName: opts.fullName,
      role: opts.role,
      passwordHash: opts.passwordHash,
      isActive: true,
    },
  });
}

async function main() {
  console.log('=== ETP Admin/Vendor Bootstrap ===');
  console.log(`NODE_ENV: ${process.env.NODE_ENV || 'unset'}`);
  console.log(`DATABASE_URL: ${process.env.DATABASE_URL ? 'set (hidden)' : 'NOT SET'}`);

  if (!process.env.DATABASE_URL || process.env.DATABASE_URL.trim() === '') {
    console.error('FATAL: DATABASE_URL is required');
    process.exit(1);
  }

  const nodeEnv = process.env.NODE_ENV || 'development';
  if (!ALLOWED_ENVS.includes(nodeEnv)) {
    console.error(`FATAL: NODE_ENV="${nodeEnv}" not in allowed list: ${ALLOWED_ENVS.join(', ')}`);
    process.exit(1);
  }

  if (nodeEnv === 'production' || nodeEnv === 'staging') {
    const confirm = requireEnvOrExit('CONFIRM_PRODUCTION_BOOTSTRAP', 'false');
    if (confirm !== 'true') {
      console.error('FATAL: Production/staging bootstrap requires CONFIRM_PRODUCTION_BOOTSTRAP=true');
      process.exit(1);
    }
    console.warn('WARNING: Running bootstrap against production/staging database');
  }

  if (process.env.DEMO_MODE === 'true') {
    console.error('FATAL: DEMO_MODE must not be enabled for this script');
    process.exit(1);
  }

  const adminPhone = requireEnv('BOOTSTRAP_ADMIN_PHONE');
  const adminEmail = requireEnv('BOOTSTRAP_ADMIN_EMAIL');
  const adminName = requireEnv('BOOTSTRAP_ADMIN_NAME');
  const adminPassword = requireEnv('BOOTSTRAP_ADMIN_PASSWORD');

  const vendorPhone = requireEnv('BOOTSTRAP_VENDOR_PHONE');
  const vendorEmail = requireEnv('BOOTSTRAP_VENDOR_EMAIL');
  const vendorName = requireEnv('BOOTSTRAP_VENDOR_NAME');
  const vendorPassword = requireEnv('BOOTSTRAP_VENDOR_PASSWORD');

  if (adminPassword.length < 12) {
    console.error('FATAL: BOOTSTRAP_ADMIN_PASSWORD must be at least 12 characters');
    process.exit(1);
  }
  if (vendorPassword.length < 12) {
    console.error('FATAL: BOOTSTRAP_VENDOR_PASSWORD must be at least 12 characters');
    process.exit(1);
  }

  const BOOTSTRAP_COMPLETED_KEY = 'bootstrap:admin-vendor:completed';

  const existing = await prisma.systemSetting.findUnique({
    where: { key: BOOTSTRAP_COMPLETED_KEY },
  });
  if (existing) {
    console.log(`\nBootstrap already completed at ${existing.value}. Exiting.`);
    return;
  }

  console.log('\nCreating/updating admin user...');
  const adminHash = await hashPassword(adminPassword);

  console.log('\nCreating/updating vendor user...');
  const vendorHash = await hashPassword(vendorPassword);

  const [admin, vendor] = await prisma.$transaction(async (tx) => {
    const adminUser = await upsertUser(tx, {
      phone: adminPhone,
      email: adminEmail,
      fullName: adminName,
      role: 'admin',
      passwordHash: adminHash,
    });
    const vendorUser = await upsertUser(tx, {
      phone: vendorPhone,
      email: vendorEmail,
      fullName: vendorName,
      role: 'vendor',
      passwordHash: vendorHash,
    });
    await tx.systemSetting.create({
      data: {
        key: BOOTSTRAP_COMPLETED_KEY,
        value: new Date().toISOString(),
      },
    });
    return [adminUser, vendorUser];
  });

  console.log(`Admin ready: id=${admin.id}, phone=${admin.phone}, email=${admin.email}, role=${admin.role}`);
  console.log(`Vendor ready: id=${vendor.id}, phone=${vendor.phone}, email=${vendor.email}, role=${vendor.role}`);

  console.log('\n=== Bootstrap complete ===');
  console.log('Use POST /api/v1/auth/login with the credentials to obtain JWT tokens.');
}

main()
  .catch((err) => {
    console.error('Bootstrap failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });