# Extra Travel Point - Backend API

Production-ready backend for the Extra Travel Point travel platform. Built with Node.js, Express, TypeScript, Prisma ORM, and PostgreSQL.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime | Node.js 20+ |
| Framework | Express.js |
| Language | TypeScript |
| ORM | Prisma |
| Database | PostgreSQL (prod) / SQLite (dev) |
| Auth | JWT (Access + Refresh tokens) |
| Validation | Zod |
| Security | Helmet, CORS, Rate Limiting |

---

## Prerequisites

- Node.js 20+
- npm or yarn
- PostgreSQL 15+ (for production)
- Redis 7+ (optional, for caching)

---

## Quick Start

### 1. Clone and Install

```bash
cd backend
npm install
```

### 2. Environment Setup

```bash
# Copy environment file
cp .env.example .env

# Edit .env with your configuration
nano .env
```

### 3. Database Setup (SQLite for development)

```bash
# Generate Prisma client
npm run prisma:generate

# Push schema to database
npm run db:push

# Seed demo data
npm run prisma:seed
```

### 4. Start Development Server

```bash
npm run dev
```

The API will be available at `http://localhost:5000`

---

## Production Deployment

### Option 1: Docker Compose

```bash
# Copy production environment
cp backend/.env.production .env

# Start all services
docker-compose -f docker-compose.prod.yml up -d
```

### Option 2: Manual Setup

```bash
# Set environment
export NODE_ENV=production

# Install dependencies
npm install --production

# Generate Prisma client
npm run prisma:generate

# Run migrations
npm run prisma:deploy

# Build
npm run build

# Start
npm start
```

### Option 3: Render.com (Free Tier)

1. Push code to GitHub
2. Create New Web Service on Render
3. Connect your GitHub repo
4. Set environment variables
5. Deploy

---

## API Endpoints

### Health
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Basic health check |
| GET | `/health/depth` | Health check with DB status |

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/auth/register` | User registration |
| POST | `/api/v1/auth/login` | User login |
| POST | `/api/v1/auth/refresh-token` | Refresh access token |
| POST | `/api/v1/auth/verify-otp` | Verify OTP |

### Bookings
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/bookings` | Get user bookings |
| POST | `/api/v1/bookings` | Create new booking |
| GET | `/api/v1/bookings/:id` | Get booking details |
| PATCH | `/api/v1/bookings/:id/cancel` | Cancel booking |
| PATCH | `/api/v1/bookings/:id/reschedule` | Reschedule trip |
| GET | `/api/v1/bookings/:id/pdf` | Get e-ticket data |
| GET | `/api/v1/bookings/seats/map` | Get seat map |
| POST | `/api/v1/bookings/seats/lock` | Lock seats |
| POST | `/api/v1/bookings/seats/release` | Release seats |

### Payments
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/payments/initiate` | Initiate payment |
| POST | `/api/v1/payments/verify` | Verify payment |
| POST | `/api/v1/payments/retry` | Retry failed payment |
| POST | `/api/v1/payments/refund` | Process refund |
| POST | `/api/v1/payments/settlement` | Provider settlement |
| GET | `/api/v1/payments/reconciliation` | Payment reconciliation |

### Other Routes
- `/api/v1/providers` - Service providers
- `/api/v1/qr` - QR code operations
- `/api/v1/hotels` - Hotel management
- `/api/v1/transport` - Transport services
- `/api/v1/admin` - Admin operations
- `/api/v1/loyalty` - Loyalty points
- `/api/v1/tracking` - Live tracking
- `/api/v1/emergency` - Emergency SOS
- `/api/v1/discovery` - Travel discovery
- `/api/v1/packages` - Super bundles
- `/api/v1/ai` - AI travel assistant
- `/api/v1/analytics` - Business analytics
- `/api/v1/notifications` - Notifications
- `/api/v1/reviews` - Reviews
- `/api/v1/security` - Security (2FA)
- `/api/v1/webhooks` - Payment webhooks
- `/api/v1/upload` - File uploads

---

## Demo Credentials

| Role | Phone | Password |
|------|-------|----------|
| Admin | 01712345678 | admin123 |
| Customer | 01812345678 | customer123 |
| Vendor | 01912345678 | vendor123 |

---

## Environment Variables

See `.env.example` for all available configuration options.

| Variable | Description | Default |
|----------|-------------|---------|
| NODE_ENV | Environment | development |
| PORT | Server port | 5000 |
| DATABASE_URL | Database connection string | file:./dev.db |
| JWT_SECRET | JWT signing secret | required |
| JWT_REFRESH_SECRET | Refresh token secret | required |
| CORS_ORIGIN | Allowed CORS origins | * |

---

## Project Structure

```
backend/
├── prisma/
│   ├── schema.prisma    # Database schema
│   └── seed.ts          # Seed data
├── src/
│   ├── index.ts         # Entry point
│   ├── prisma.ts        # Prisma client
│   ├── middleware/
│   │   └── auth.ts      # JWT auth middleware
│   └── routes/          # API route handlers
├── .env                 # Environment config
├── .env.example         # Example environment
├── .env.production      # Production template
├── Dockerfile           # Docker build
├── docker-compose.prod.yml
└── package.json
```

---

## License

Extra Travel Point Technical Team
