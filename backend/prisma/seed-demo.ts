// Tiny cross-platform wrapper to seed with DEMO_MODE=true (used by db:seed:demo).
process.env.DEMO_MODE = 'true';
process.env.NODE_ENV = process.env.NODE_ENV || 'development';
require('ts-node/register');
require('./seed');