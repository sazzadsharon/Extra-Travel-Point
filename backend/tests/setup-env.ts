import dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

const envTestPath = path.resolve(__dirname, '..', '.env.test');
if (fs.existsSync(envTestPath)) {
  dotenv.config({ path: envTestPath });
}

process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'file:./test.db';
process.env.USE_MOCK_PAYMENT = process.env.USE_MOCK_PAYMENT ?? 'true';
