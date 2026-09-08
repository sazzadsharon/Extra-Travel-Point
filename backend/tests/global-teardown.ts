import * as fs from 'fs';
import * as path from 'path';

export default async () => {
  const testDbPath = path.resolve(__dirname, '..', 'prisma', 'test.db');
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }
};
