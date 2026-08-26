# এক্সট্রাভেল পয়েন্ট — টেকনিকাল প্রোটোকল ও আর্কটেকচার

## ১. সিস্টেম আর্কটেকচার (System Architecture)

```
┌─────────────────────────────────────────────────────────┐
│                      CLIENT LAYER                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   Mobile App │  │  Web App     │  │  Admin Panel │  │
│  │  (Flutter)   │  │  (React.js)  │  │  (Next.js)   │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │
│         │                 │                 │          │
└─────────┼─────────────────┼─────────────────┼──────────┘
          │                 │                 │
          ▼                 ▼                 ▼
┌─────────────────────────────────────────────────────────┐
│                    API GATEWAY                           │
│              (Nginx / AWS API Gateway)                   │
└─────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────┐
│                   BACKEND SERVICES                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ Auth Service │  │ Booking Svc  │  │  QR Service  │  │
│  │  (JWT/OAuth) │  │ (Bus/Flight) │  │ (Discount)   │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ Payment Svc  │  │ Hotel Svc    │  │  Admin Svc   │  │
│  │(bKash/Nagad) │  │ (Inventory)  │  │ (Dashboard)  │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────┐
│                    DATA LAYER                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  PostgreSQL  │  │    Redis     │  │    S3/AWS    │  │
│  │  (Primary)   │  │   (Cache)    │  │   (Storage)  │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────┘
```

---

## ২. প্রযুক্তি স্ট্যাক (Technology Stack)

### ফ্রন্টএন্ড (Mobile App)
| লেয়ার | টেকনোলজি | যুক্তি |
|--------|-----------|--------|
| ফ্রেমওয়ার্ক | Flutter 3.x | Cross-platform, single codebase |
| স্টেট ম্যানেজমেন্ট | Riverpod / Bloc | Scalable, testable |
| লোকাল স্টোরেজ | Hive / SharedPrefs | Offline booking history |
| QR Scanner | mobile_scanner | Real-time QR scanning |
| নেভিগেশন | GoRouter | Type-safe routing |

### ফ্রন্টএন্ড (Web — Admin Panel)
| লেয়ার | টেকনোলজি | যুক্তি |
|--------|-----------|--------|
| ফ্রেমওয়ার্ক | Next.js 14 (App Router) | SSR, SEO, fast |
| UI Library | ShadCN/ui + Tailwind | Modern, customizable |
| চার্ট/ভিজ্যুয়াল | Recharts / Chart.js | Revenue analytics |
| ফর্ম | React Hook Form + Zod | Validation |

### ব্যাকএন্ড
| লেয়ার | টেকনোলজি | যুক্তি |
|--------|-----------|--------|
| রানটাইম | Node.js 20+ | Fast, ecosystem |
| ফ্রেমওয়ার্ক | NestJS | Enterprise-grade, modular |
| ডাটাবেস | PostgreSQL 15 | Relational, complex queries |
| ক্যাশ | Redis 7 | Session, rate-limiting |
| ফাইল স্টোরেজ | AWS S3 / Cloudinary | Images, documents |
| মেসেজিং | BullMQ (Redis) | Queue, notifications |

###インフラ (Infrastructure)
| কম্পোনেন্ট | টেকনোলজি |
|------------|-----------|
| হোস্টিং | AWS EC2 / Vercel (frontend) |
| ডাটাবেস | AWS RDS (PostgreSQL) |
| CDN | Cloudflare |
| SSL | Let's Encrypt / AWS Certificate Manager |
| মনিটরিং | Sentry (error) + Grafana (metrics) |

---

## ৩. ডাটাবেস ডিজাইন (Core Schema)

### টেবিল ১: ইউজার (Users)
```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    phone VARCHAR(15) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE,
    full_name VARCHAR(100),
    password_hash VARCHAR(255),
    role VARCHAR(20) DEFAULT 'customer', -- customer, vendor, admin
    qr_token UUID DEFAULT gen_random_uuid(),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### টেবিল ২: সার্ভিস প্রোভাইডার (Service Providers)
```sql
CREATE TABLE service_providers (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id),
    business_name VARCHAR(255),
    category VARCHAR(50), -- hotel, restaurant, tour_spot, bus, airline
    address TEXT,
    latitude DECIMAL(9,6),
    longitude DECIMAL(9,6),
    commission_rate DECIMAL(5,2) DEFAULT 10.00,
    is_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);
```

### টেবিল ৩: বুকিং (Bookings)
```sql
CREATE TABLE bookings (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id),
    provider_id INT REFERENCES service_providers(id),
    category VARCHAR(50), -- bus, flight, hotel, food, tour
    booking_date DATE,
    travel_date DATE,
    number_of_people INT DEFAULT 1,
    total_amount DECIMAL(10,2),
    discount_amount DECIMAL(10,2) DEFAULT 0.00,
    final_amount DECIMAL(10,2),
    status VARCHAR(20) DEFAULT 'pending', -- pending, confirmed, cancelled, completed
    payment_status VARCHAR(20) DEFAULT 'pending', -- pending, paid, failed, refunded
    qr_code VARCHAR(255), -- generated QR for this booking
    created_at TIMESTAMP DEFAULT NOW()
);
```

### টেবিল ৪: QR কোড লগ (QR Code Logs)
```sql
CREATE TABLE qr_logs (
    id SERIAL PRIMARY KEY,
    booking_id INT REFERENCES bookings(id),
    user_id INT REFERENCES users(id),
    provider_id INT REFERENCES service_providers(id),
    qr_token VARCHAR(255),
    discount_type VARCHAR(50), -- percentage, fixed, combo
    discount_value DECIMAL(10,2),
    scanned_at TIMESTAMP DEFAULT NOW(),
    is_used BOOLEAN DEFAULT FALSE
);
```

### টেবিল ৫: পেেমেন্ট (Payments)
```sql
CREATE TABLE payments (
    id SERIAL PRIMARY KEY,
    booking_id INT REFERENCES bookings(id),
    amount DECIMAL(10,2),
    method VARCHAR(50), -- bkash, nagad, card, bank
    transaction_id VARCHAR(255),
    status VARCHAR(20), -- init, success, failed, refunded
    gateway_response JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);
```

---

## ৪. QR কোড সিস্টেম প্রোটোকল (QR Protocol)

### ৪.১ QR কোড জেনারেশন ফ্লো
```
User → Select Service → Book → Payment Success → Generate QR
                                                         │
QR Payload (JSON):
{
  "booking_id": "BKG-2024-0001",
  "user_id": "USR-12345",
  "provider_id": "PRV-67890",
  "category": "hotel",
  "valid_from": "2024-01-15",
  "valid_until": "2024-01-20",
  "discounts": [
    { "type": "food", "provider": "PRV-99999", "value": 15, "unit": "%" },
    { "type": "tour", "provider": "PRV-88888", "value": 200, "unit": "BDT" }
  ],
  "signature": "HMAC-SHA256(payload, secret_key)"
}
```

### ৪.২ QR স্ক্যানিং ও ভেরিফিকেশন
```
Vendor Scanner → Read QR → Send to Backend
                                    │
Backend: Verify Signature → Check Validity → Return Discount Info
                                    │
Response: { valid: true, discounts: [...], user_name: "..." }
```

### ৪.৩ কম্বো ডিসকাউন্ট লজিক
| শর্ত | ডিসকাউন্ট |
|--------|-----------|
| হোটেল + রেস্তোরাঁ | ১০% রেস্তোরাঁ বিলে |
| ট্যুর প্যাকেজ + হোটেল | ৫% অতিরিক্ত হোটেলে |
| ৩+ সেবা ব্যবহার | ১৫% সর্বোচ্চ ডিসকাউন্ট |

---

## ৫. API এন্ডপয়েন্ট স্পেসিফিকেশন

### অথেন্টিকেশন
| Method | Endpoint | ডেসক্রিপশন |
|--------|----------|-------------|
| POST | /api/v1/auth/register | রেজিস্ট্রেশন (phone + OTP) |
| POST | /api/v1/auth/login | লগইন |
| POST | /api/v1/auth/refresh-token | টোকেন রিফ্রেশ |
| POST | /api/v1/auth/verify-otp | OTP ভেরিফাই |

### বুকিং ও সিট ম্যাপ
| Method | Endpoint | ডেসক্রিপশন |
|--------|----------|-------------|
| GET | /api/v1/bookings | আমার বুকিং গুলো |
| POST | /api/v1/bookings | নতুন বুকিং |
| GET | /api/v1/bookings/seats/map | Bus/Launch/Flight ইন্টারেক্টিভ সিট ম্যাপ |
| POST | /api/v1/bookings/seats/lock | ১০-মিনিট রিয়েলটাইম সিট হোল্ড |
| POST | /api/v1/bookings/seats/release | সিট অটো/ম্যানুয়াল রিলিজ |
| PATCH | /api/v1/bookings/:id/reschedule | ট্রিপ রিসিডিউল |
| GET | /api/v1/bookings/:id/pdf | E-Ticket PDF ডাটা |
| PATCH | /api/v1/bookings/:id/cancel | বুকিং ক্যান্সেল |

### পেমেন্ট ও সেটেলমেন্ট
| Method | Endpoint | ডেসক্রিপশন |
|--------|----------|-------------|
| POST | /api/v1/payments/initiate | পেমেন্ট শুরু (bKash/Nagad/Rocket/SSLCommerz/Card) |
| POST | /api/v1/payments/verify | পেমেন্ট ভেরিফাই |
| POST | /api/v1/payments/retry | পেমেন্ট রিট্রাই |
| GET | /api/v1/payments/reconciliation | পেমেন্ট রিকনসিলিয়েশন |
| POST | /api/v1/payments/settlement | প্রোভাইডার সেটেলমেন্ট ও কমিশন |
| POST | /api/v1/payments/refund | রিফান্ড প্রসেসিং |
| POST | /api/v1/webhooks/:gateway | bKash/Nagad/Rocket/SSLCommerz IPN & HMAC Verified Webhook |

### AI ট্রাভেল এজেন্ট ও সুপার প্যাকেজ
| Method | Endpoint | ডেসক্রিপশন |
|--------|----------|-------------|
| POST | /api/v1/ai/assistant | স্মার্ট বাজেট ব্রেকডাউন, ইটেনারি ও ওয়েদার সাজেশন |
| GET | /api/v1/packages/super-bundles | Couple, Family, Budget, Luxury বান্ডেল প্যাকেজ |
| POST | /api/v1/packages/one-click-booking | ওয়ান-ক্লিক ট্রিপ বুকিং |

### লাইভ ট্র্যাকিং, ইমার্জেন্সি SOS ও ডিসকভারি
| Method | Endpoint | ডেসক্রিপশন |
|--------|----------|-------------|
| GET | /api/v1/tracking/live/:tripId | জিপিএস ট্র্যাকিং, ইটিএ ও ডিলে ডিটেকশন |
| POST | /api/v1/emergency/sos | ইমার্জেন্সি SOS উইথ লাইভ জিপিএস |
| GET | /api/v1/discovery/places | ট্যুরিস্ট স্পট, রেস্তোরাঁ, হাসপাতাল ও আবহাওয়া |
| POST | /api/v1/discovery/route-planner | রুট প্ল্যানার ও ম্যাপ ওয়েপয়েন্ট |
| GET | /api/v1/loyalty/points | ETP পয়েন্ট, রিওয়ার্ডস ও মেম্বারশিপ টায়ার |
| POST | /api/v1/notifications/dispatch | App Push, SMS, Email, WhatsApp ডিসপ্যাচ |
| GET | /api/v1/analytics/overview | বিজনেস অ্যানালিটিক্স ও বিআই ওভারভিউ |

### অ্যাডমিন
| Method | Endpoint | ডেসক্রিপশন |
|--------|----------|-------------|
| GET | /api/v1/admin/bookings | সব বুকিং |
| GET | /api/v1/admin/revenue | আয় রিপোর্ট |
| GET | /api/v1/admin/providers | প্রোভাইডার লিস্ট |
| PATCH | /api/v1/admin/providers/:id/verify | প্রোভাইডার ভেরিফাই |

---

## ৬. সিকিউরিটি প্রোটোকল

| লেয়ার | পদ্ধতি | বিবরণ |
|--------|--------|--------|
| API সিকিউরিটি | JWT (access + refresh) | ২ ঘণ্টা এক্সেস, ৭ দিন রিফ্রেশ |
| ডাটা এনক্রিপশন | AES-256-GCM | PII ফিল্ড এনক্রিপ্ট |
| QR সুরক্ষা | HMAC-SHA256 | QR প'e'e'ল্ড সাইন |
| রেট লিমিট | Redis + Token Bucket | ১০০ রিকোয়েস্ট/মিনিট/ইউজার |
| HTTPS enforced | TLS 1.3 | সব ট্রাফিক এনক্রিপ্ট |
| Input Validation | Zod + class-validator | SQL injection, XSS প্রতিরোধ |

---

## ৭. ডিপ্লয়মেন্ট আর্কটেকচার

```
Production:
  ┌─────────────────────────────────────────┐
  │           Cloudflare (CDN + WAF)        │
  └─────────────────┬───────────────────────┘
                    │
        ┌───────────┴────────────┐
        ▼                        ▼
  ┌─────────────┐         ┌─────────────┐
  │ Vercel      │         │  AWS EC2    │
  │ (Next.js    │         │  (NestJS    │
  │  Admin)     │         │   API)      │
  └─────────────┘         └──────┬──────┘
                                  │
                    ┌─────────────┴─────────────┐
                    ▼                           ▼
              ┌──────────┐                ┌──────────┐
              │   RDS    │                │   Redis  │
              │PostgreSQL│                │  Cluster │
              └──────────┘                └──────────┘
                    │
                    ▼
              ┌──────────┐
              │   S3     │
              │ (Assets) │
              └──────────┘
```

---

## ৮. ফেস্ট-ফোollow এপ্লিকেশন প্ল্যান

| ফেজ | সময় | কাজ |
|------|------|------|
| ফেজ ১ | সপ্তাহ ১-২ | প্রোটোটাইপ (UI + Auth + Booking) |
| ফেজ ২ | সপ্তাহ ৩-৪ | QR সিস্টেম + পেমেন্ট |
| ফেজ ৩ | সপ্তাহ ৫-৬ | অ্যাডমিন প্যানেল + অ্যানালিটিক্স |
| ফেজ ৪ | সপ্তাহ ৭-৮ | টেস্টিং + বাগ ফিক্স |
| ফেজ ৫ | সপ্তাহ ৯ | লঞ্চ (App Store + Play Store) |

---

*প্রোটোকল ডকুমেন্ট Created by Kilo — Extratravel Point Technical Team*
