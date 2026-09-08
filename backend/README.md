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
| HOST | Bind address | 0.0.0.0 |
| DATABASE_URL | Database connection string | file:./dev.db |
| JWT_SECRET | JWT signing secret (min 32 chars) | required |
| JWT_REFRESH_SECRET | Refresh token secret | required |
| CORS_ORIGIN | Allowed CORS origins (comma-separated) | empty (dev only) |
| RATE_LIMIT_WINDOW_MS | Rate limit window | 900000 |
| RATE_LIMIT_MAX | Max requests per window | 100 |
| LOG_LEVEL | Logging verbosity | info |

## Security

### Authentication & Authorization
- JWT access tokens (2h) + HttpOnly refresh tokens (7d)
- Role-based access: `customer`, `vendor`, `admin`, `master_admin`
- All protected routes validate JWT and role before processing

### Hotel Booking Security
- Server-authoritative pricing: client-submitted `totalAmount`/`finalAmount` are ignored
- Rate plan validation: dates, min/max stay, capacity enforced server-side
- Inventory race protection: atomic availability checks within database transactions
- Booking state machine: validated transitions via `canTransitionHotelBooking`
- Payment idempotency: duplicate verification requests return success without side effects

### Rate Limiting
- Global API limiter: 100 requests per 15 minutes
- Auth endpoints: 20 requests per 15 minutes
- Payment endpoints: 10 requests per 15 minutes
- Booking endpoints: 20 requests per 15 minutes

### Request Size Limits
- JSON body limit: 1MB
- URL-encoded body limit: 1MB

## Hotel Module Architecture

### Roles
| Role | Access |
|------|--------|
| Public | Search hotels, view approved hotel details, view rooms |
| Customer | Create bookings, view own bookings, make payments, cancel own bookings |
| Vendor | Manage owned hotels, rooms, rate plans, view own bookings, check-in/out |
| Admin | Full platform access, vendor approval, settlement management |

### Booking Lifecycle
```
PENDING → CONFIRMED (on payment verification) → CHECKED_IN → COMPLETED
   ↓           ↓
   └──→ CANCELLED (by customer/vendor/admin)
   └──→ EXPIRED (if payment window lapses)
```

Valid transitions:
- `pending` → `confirmed`, `cancelled`, `expired`
- `confirmed` → `completed`, `cancelled`
- `paid` → `confirmed`, `cancelled`
- `completed`, `cancelled`, `expired` → terminal states

### Pricing Authority
- All prices are calculated server-side from trusted `Room.price` or `RatePlan.price`
- Promotions are validated server-side against `HotelPromotion` records
- Discounts cannot exceed promotion limits or usage counts
- Final amount is persisted in `Booking.finalAmount` with a JSON `priceSnapshot`

### Payment Boundary
- Payment initiation uses `Booking.finalAmount` (server-authoritative)
- Payment verification updates `Booking.status` and `Booking.paymentStatus` atomically
- Refunds validate booking state before processing
- Settlement creation is idempotent via unique `Settlement.bookingId`

## Health & Readiness

| Endpoint | Description |
|----------|-------------|
| `GET /health` | Liveness check |
| `GET /health/depth` | Readiness check (includes DB connectivity) |

## Logging

- Structured logging with request correlation IDs (`x-request-id`)
- Sensitive fields (passwords, secrets, tokens) are redacted in logs
- Important events: booking creation, payment verification, check-in/out, admin actions
- Log level configurable via `LOG_LEVEL` environment variable

## Backup & Recovery

### Database Backup
- PostgreSQL: Use `pg_dump` or automated cloud backups
- Retention: Minimum 7 days, recommended 30 days
- Test restores quarterly

### Migration Safety
- Prisma migrations stored in `prisma/migrations/`
- Run `npm run prisma:deploy` for production migrations
- Never run `prisma migrate dev` in production

### Rollback Procedure
1. Identify last known good migration
2. Run `prisma migrate resolve --rolled-back <migration_name>`
3. Restore database backup if data corruption occurred
4. Redeploy previous application version

## CORS & HTTP Security

- CORS origins are explicitly configured via `CORS_ORIGIN`
- Production defaults to no wildcards
- Helmet security headers enabled (CSP disabled for API flexibility)
- Cookies use `httpOnly`, `secure` (production), `sameSite: strict`

## Project Structure

```
backend/
├── prisma/
│   ├── schema.prisma    # Database schema
│   └── seed.ts          # Seed data
├── src/
│   ├── index.ts         # Entry point, middleware, route mounting
│   ├── prisma.ts        # Prisma client
│   ├── middleware/
│   │   └── auth.ts      # JWT auth middleware
│   ├── routes/          # API route handlers
│   └── utils/           # Pricing, logging, QR, commission utilities
├── tests/               # Jest test suites
├── .env                 # Environment config (gitignored)
├── .env.example         # Example environment
├── .env.production      # Production template
├── Dockerfile           # Docker build
├── docker-compose.prod.yml
└── package.json
```

---

## License

Extra Travel Point Technical Team
