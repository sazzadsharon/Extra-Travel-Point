# Extra Travel Point - Travel Super App

এক্সট্রাভেল পয়েন্ট হলো একটি স্মার্ট ট্রাভেল ও রিওয়ার্ডস সুপার অ্যাপ্লিকেশন যা হোটেল, বাস টিকিট, ফ্লাইট এবং রেস্তোরাঁর বুকিংয়ের মাধ্যমে সিকিউরড QR কোড ও কম্বো ডিসকাউন্ট অফার করে।

---

## 🏗️ Project Structure

```
extra-travel-point/
├── backend/              # Node.js + Express + Prisma API
├── etp-rn-app/           # React Native Mobile App
├── flutter-mobile-app/   # Flutter Mobile App
├── admin-panel/          # Next.js Admin Dashboard
├── mobile-app/           # Legacy Mobile App
├── docker-compose.yml    # Development Docker Compose
├── docker-compose.prod.yml # Production Docker Compose
├── EXTRA_TRAVEL_POINT_PROTOCOL.md
└── README.md
```

---

## 🚀 Quick Start

### Backend (Development)

```bash
cd backend
npm install
npm run prisma:generate
npm run db:push
npm run prisma:seed
npm run dev
```

### Production Deployment

```bash
# Using Docker Compose
docker-compose -f docker-compose.prod.yml up -d
```

---

## 📦 Components

### Backend API
- **Tech**: Node.js, Express, TypeScript, Prisma
- **Database**: PostgreSQL (production) / SQLite (development)
- **Auth**: JWT with refresh tokens
- **Features**: Booking, Payments, QR Codes, Loyalty, Tracking
- **Port**: 5000

### React Native App
- **Tech**: Expo, React Native
- **Features**: QR Scanner, Booking, Payments
- **Build**: EAS Build

### Admin Panel
- **Tech**: Next.js 14, Tailwind CSS
- **Features**: Analytics, Provider Management
- **Port**: 3000

---

## 🌐 Free Deployment Guide

| Service | Free Tier | Link |
|---------|-----------|------|
| Backend | Render (750 hrs/month) | render.com |
| Database | Supabase (500MB) | supabase.com |
| Frontend | Vercel (Unlimited) | vercel.com |
| Redis | Upstash (10K cmds/day) | upstash.com |
| Mobile Build | EAS (30 builds/month) | expo.dev |
| SSL | Let's Encrypt | certbot.eff.org |

---

## 📄 API Documentation

See `backend/README.md` for complete API endpoint documentation.

---

## 📋 Demo Credentials

| Role | Phone | Password |
|------|-------|----------|
| Admin | 01712345678 | admin123 |
| Customer | 01812345678 | customer123 |
| Vendor | 01912345678 | vendor123 |

---

## 📱 Device Compatibility

### Tested on Redmi Devices
- Redmi Note 12 (Android 13)
- Redmi 11 Prime (Android 12)
- Redmi Note 10 Pro (Android 11)

### Known Issues / Notes
- Ensure **MIUI Optimization** is disabled for smooth QR scanner performance.
- Grant **Camera** and **Location** permissions explicitly for mobile apps.
- Use **Expo Go** for React Native testing on Redmi devices.

---

## 📄 License

Created by Kilo — Extra Travel Point Technical Team
