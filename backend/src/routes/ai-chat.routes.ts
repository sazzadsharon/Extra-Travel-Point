import { Router, Request, Response } from 'express';
import { aiFactory } from '../ai';
import { z } from 'zod';
import { prisma } from '../prisma';
import { logError } from '../utils/logger';

const router = Router();

const chatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1).max(2000),
});

const chatRequestSchema = z.object({
  messages: z.array(chatMessageSchema).min(1).max(50),
  destination: z.string().max(100).optional(),
  maxBudget: z.number().min(0).max(500000).optional(),
});

type ServiceIntent =
  | 'bus'
  | 'hotel'
  | 'restaurant'
  | 'flight'
  | 'car'
  | 'activity'
  | 'boat'
  | 'local_transport'
  | 'student_deal'
  | 'local_guide'
  | 'cng'
  | 'private_car';

const SERVICE_INTENTS: ServiceIntent[] = [
  'bus',
  'hotel',
  'restaurant',
  'flight',
  'car',
  'activity',
  'boat',
  'local_transport',
  'student_deal',
  'local_guide',
  'cng',
  'private_car',
];

const DEFAULT_CORE_INTENTS: ServiceIntent[] = ['bus', 'hotel'];

const SYSTEM_PROMPT = `You are ETP AI, a friendly and honest travel assistant for Extra Travel Point — Bangladesh's Travel Super App.

Your job: understand the customer's conversation and help them plan travel. Only surface a service when the customer actually needs or asks for it. Never show or push a service the customer did not mention.

AVAILABLE SERVICE INTENTS (use exactly these ids):
- "bus" -> intercity bus / transport tickets
- "hotel" -> hotel / resort / guesthouse / where to stay
- "restaurant" -> food / restaurant / eating options
- "flight" -> flight / plane / air travel
- "car" -> car rental / hire car
- "activity" -> sightseeing / tourist spots / things to do
- "boat" -> boat / launch / trawler
- "local_transport" -> auto-rickshaw / rickshaw / bike / general local transport (NOT CNG or private car)
- "student_deal" -> student discount / student offer
- "local_guide" -> local guide / tour guide / someone to show around ("লোকাল গাইড চাই", "একজন গাইড লাগবে")
- "cng" -> CNG auto-rickshaw specifically ("সিএনজি লাগবে", "CNG চাই")
- "private_car" -> private car / hire a full car for group ("প্রাইভেট গাড়ি লাগবে", "প্রাইভেট কার চাই", "একটা গাড়ি ভাড়া নিতে চাই")

DECISION RULES:
1. If the customer only gives trip information (destination, budget, days, travelers, dates) without asking for a specific service, return ONLY ["bus","hotel"] — the core essentials. Do NOT include restaurant, flight, car, activity, boat, local_transport, student_deal, local_guide, cng or private_car unless the customer asked for them.
2. If the customer asks about food / restaurant / eating ("খাবারের option দেখাও"), include "restaurant".
3. If the customer asks about flight ("Flight দিয়ে গেলে কত লাগবে?"), include "flight".
4. If the customer asks about car rental ("গাড়ি ভাড়া চাই"), include "car".
5. If the customer asks about sightseeing / activities ("ঘোরার জায়গা দেখাও"), include "activity".
6. Include "student_deal" only when the customer is a student or asks for student offers.
7. If the customer asks for a local guide ("লোকাল গাইড চাই", "একজন গাইড লাগবে"), include ONLY "local_guide".
8. If the customer asks specifically for CNG ("সিএনজি লাগবে"), include ONLY "cng".
9. If the customer asks for a private car / full car hire ("প্রাইভেট গাড়ি লাগবে", "প্রাইভেট কার চাই"), include ONLY "private_car".
10. When a customer wants to explore a destination generally (e.g. "কক্সবাজারে ৩ দিন থাকব, ঘুরতে চাই"), include ["bus","hotel","local_guide","cng","private_car","activity"] — but ONLY if the context clearly implies exploring.
11. Include ONLY the services the customer asked for or clearly needs. An empty or small list is correct. Do not list every service.

HONESTY RULES — NEVER invent prices, availability, hotels, buses or flight schedules:
- If a price or availability is not confirmed, do NOT state a number. Say something like "লাইভ availability ও price এখনই confirm করা যাচ্ছে না — বুকিংয়ের সময় যাচাই করে নিন।"
- Never create fake hotel names, bus names, prices, seat counts or time schedules.
- If you know a real price/offer from the provided context, you may mention it, otherwise say it must be confirmed.

STYLE:
- Reply in Bengali mixed with English (Banglish), warm and conversational.
- 2-4 short sentences max.
- Ask follow-up questions if key info (destination / budget / duration) is missing.

Your response MUST be valid JSON with EXACTLY this structure (no markdown, no extra text):
{
  "reply": "your reply text",
  "services": ["bus", "hotel"],
  "extractedInfo": {
    "destination": "detected destination or null",
    "budget": detected budget number or null,
    "needs": ["short tags summarizing needs"]
  }
}`;

interface ExtractedInfo {
  destination?: string | null;
  budget?: number | null;
  needs: string[];
}

interface AIParsedResult {
  reply: string;
  services?: string[];
  extractedInfo?: Partial<ExtractedInfo>;
}

interface SubService {
  icon: string;
  label: string;
  labelBn: string;
  description: string;
  link: string;
}

interface LiveDataItem {
  name: string;
  price?: number;
  currency?: string;
  detail?: string;
  availabilityNote?: string;
}

interface ServiceRecommendation {
  intent: ServiceIntent;
  category: string;
  icon: string;
  label: string;
  labelBn: string;
  description: string;
  link: string;
  subServices: SubService[];
  liveData?: LiveDataItem[];
  availabilityNote?: string;
}

interface ChatResponse {
  reply: string;
  services: ServiceRecommendation[];
  extractedInfo: {
    destination?: string | null;
    budget?: number | null;
    needs: string[];
  };
}

const INTENT_KEYWORDS: Record<ServiceIntent, RegExp[]> = {
  bus: [/\bbus\b/i, /\bbuses\b/i, /বাস/i, /যাব\b/, /যাবো\b/, /যাই\b/i, /টিকিট/i, /ticket/i, /সিট/i, /স্লিপার/i, /এসি\s*বাস/i],
  hotel: [/hotel/i, /হোটেল/i, /থাকব\b/, /থাকবো\b/, /থাকার\b/, /থাকি\b/, /রুম/i, /room/i, /রিসোর্ট/i, /রিসর্ত/i, /resort/i, /কটেজ/i, /cottage/i, /রাত\s*কাটাব/i],
  restaurant: [/restaurant/i, /রেস্টুরেন্ট/i, /রেস্তোরাঁ/i, /রেস্তরাঁ/i, /খাবার/i, /খাবারের/i, /খাওয়া/i, /খাওয়ার/i, /ডিনার/i, /লাঞ্চ/i, /ভাত/i, /ফুড/i, /food/i],
  flight: [/flight/i, /ফ্লাইট/i, /plane/i, /প্লেন/i, /বিমান/i, /এয়ার/i, /air/i],
  car: [/car\s*/i, /কার\b/i, /rental/i, /রেন্টাল/i, /ভাড়া\s*চাই/i, /হায়ার/i],
  activity: [/activity/i, /অ্যাক্টিভিটি/i, /ঘোরার/i, /ঘুরার/i, /ঘুরতে/i, /দেখার\s*জায়গা/i, /দেখার\s*জায়গা/i, /জায়গা\s*দেখাও/i, /জায়গা\s*দেখাও/i, /সাফারি/i, /safari/i, /ট্যুর/i, /ভ্রমণকেন্দ্র/i],
  boat: [/boat/i, /নৌকা/i, /বোট/i, /ট্রলার/i, /লঞ্চ/i, /launch/i],
  local_transport: [/রিকশা/i, /rickshaw/i, /অটো/i, /সাইকেল/i, /বাইক/i, /bike/i, /রেন্ট\s*এ\s*বাইক/i],
  student_deal: [/student/i, /স্টুডেন্ট/i, /ছাত্র/i, /শিক্ষার্থী/i, /কলেজ/i, /college/i, /বিশ্ববিদ্যালয়/i, /university/i],
  local_guide: [/লোকাল\s*গাইড/i, /লোকাল\s*guide/i, /গাইড\s*চাই/i, /গাইড\s*লাগবে/i, /guide\s*চাই/i, /guide\s*লাগবে/i, /একজন\s*গাইড/i, /local\s*guide/i, /tour\s*guide/i, /ট্যুর\s*গাইড/i, /ঘোরাতে\s*গাইড/i, /ঘুরাতে\s*গাইড/i, /দেখাও/i],
  cng: [/সিএনজি/i, /সি\.?এন\.?জি/i, /cn\s*g/i, /cng/i],
  private_car: [/প্রাইভেট\s*গাড়ি/i, /প্রাইভেট\s*গাড়ী/i, /প্রাইভেট\s*car/i, /private\s*car/i, /প্রাইভেট\s*কার/i, /একটা?\s*গাড়ি\s*ভাড়া\s*নিতে\s*চাই/i, /একটা?\s*গাড়ী\s*ভাড়া\s*নিতে\s*চাই/i, /ফুল\s*car/i, /full\s*car/i, /গ্রুপের\s*জন্য\s*গাড়ি/i],
};

const INTENT_META: Record<
  ServiceIntent,
  { label: string; labelBn: string; icon: string }
> = {
  bus: { label: 'Bus & Transport', labelBn: 'বাস ও পরিবহন', icon: 'bus' },
  hotel: { label: 'Hotel & Stay', labelBn: 'হোটেল ও থাকা', icon: 'hotel' },
  restaurant: { label: 'Restaurant & Food', labelBn: 'রেস্তোরাঁ ও খাবার', icon: 'utensils' },
  flight: { label: 'Flight', labelBn: 'ফ্লাইট', icon: 'plane' },
  car: { label: 'Car Rental', labelBn: 'গাড়ি ভাড়া', icon: 'car' },
  activity: { label: 'Activities & Tours', labelBn: 'কার্যকলাপ ও ট্যুর', icon: 'sparkles' },
  boat: { label: 'Boat & Launch', labelBn: 'নৌকা ও লঞ্চ', icon: 'ship' },
  local_transport: { label: 'Local Transport', labelBn: 'স্থানীয় পরিবহন', icon: 'bike' },
  student_deal: { label: 'Student Deal', labelBn: 'স্টুডেন্ট ডিল', icon: 'graduation-cap' },
  local_guide: { label: 'Local Guide', labelBn: 'লোকাল গাইড', icon: 'map-pin' },
  cng: { label: 'CNG', labelBn: 'সিএনজি', icon: 'cng' },
  private_car: { label: 'Private Car', labelBn: 'প্রাইভেট গাড়ি', icon: 'car' },
};

const SUB_SERVICE_LINKS: Record<ServiceIntent, SubService[]> = {
  bus: [
    {
      icon: 'bus',
      label: 'Bus',
      labelBn: 'বাস',
      description: 'Book intercity buses',
      link: '/transport/bus',
    },
    {
      icon: 'plane',
      label: 'Flight',
      labelBn: 'ফ্লাইট',
      description: 'Compare with flights',
      link: '/transport',
    },
  ],
  hotel: [
    {
      icon: 'hotel',
      label: 'Hotel',
      labelBn: 'হোটেল',
      description: 'Search hotels & resorts',
      link: '/hotels',
    },
    {
      icon: 'car',
      label: 'Car Rental',
      labelBn: 'গাড়ি ভাড়া',
      description: 'Hire a car for the trip',
      link: '/transport',
    },
  ],
  restaurant: [
    {
      icon: 'utensils',
      label: 'Restaurant',
      labelBn: 'রেস্তোরাঁ',
      description: 'Browse local restaurants',
      link: '/services',
    },
    {
      icon: 'sparkles',
      label: 'Activities',
      labelBn: 'কার্যকলাপ',
      description: 'Explore local activities',
      link: '/services',
    },
  ],
  flight: [
    {
      icon: 'plane',
      label: 'Flight Search',
      labelBn: 'ফ্লাইট খোঁজ',
      description: 'Search available flights',
      link: '/transport',
    },
    {
      icon: 'bus',
      label: 'Bus Alternative',
      labelBn: 'বাস বিকল্প',
      description: 'Compare bus fares',
      link: '/transport/bus',
    },
  ],
  car: [
    {
      icon: 'car',
      label: 'Car Rental',
      labelBn: 'গাড়ি ভাড়া',
      description: 'Hire a car at destination',
      link: '/transport',
    },
    {
      icon: 'bike',
      label: 'Bike / Local',
      labelBn: 'বাইক / স্থানীয়',
      description: 'Local transport options',
      link: '/transport',
    },
  ],
  activity: [
    {
      icon: 'sparkles',
      label: 'Tours & Activities',
      labelBn: 'ট্যুর ও কার্যকলাপ',
      description: 'Local tours & experiences',
      link: '/services',
    },
    {
      icon: 'ship',
      label: 'Boat Tours',
      labelBn: 'নৌকা ট্যুর',
      description: 'Boat & launch trips',
      link: '/services',
    },
  ],
  boat: [
    {
      icon: 'ship',
      label: 'Boat & Launch',
      labelBn: 'নৌকা ও লঞ্চ',
      description: 'Book boat trips',
      link: '/services',
    },
    {
      icon: 'sparkles',
      label: 'Explore Activities',
      labelBn: 'কার্যকলাপ দেখুন',
      description: 'More things to do',
      link: '/services',
    },
  ],
  local_transport: [
    {
      icon: 'bike',
      label: 'CNG / Auto / Bike',
      labelBn: 'সিএনজি / অটো / বাইক',
      description: 'Local rides at destination',
      link: '/transport',
    },
    {
      icon: 'car',
      label: 'Car Rental',
      labelBn: 'গাড়ি ভাড়া',
      description: 'Hire a car for the day',
      link: '/transport',
    },
  ],
  student_deal: [
    {
      icon: 'graduation-cap',
      label: 'Student Offers',
      labelBn: 'স্টুডেন্ট অফার',
      description: 'Student-only discounts',
      link: '/services',
    },
    {
      icon: 'bus',
      label: 'Student Bus Fare',
      labelBn: 'স্টুডেন্ট বাস ভাড়া',
      description: 'Discounted bus tickets',
      link: '/transport/bus',
    },
  ],
  local_guide: [
    {
      icon: 'map-pin',
      label: 'Find a Guide',
      labelBn: 'গাইড খুঁজুন',
      description: 'Find local tour guides',
      link: '/services',
    },
    {
      icon: 'sparkles',
      label: 'Tours & Activities',
      labelBn: 'ট্যুর ও কার্যকলাপ',
      description: 'Explore guided tours',
      link: '/services',
    },
  ],
  cng: [
    {
      icon: 'cng',
      label: 'CNG / Auto-Rickshaw',
      labelBn: 'সিএনজি / অটো-রিকশা',
      description: 'CNG rides at destination',
      link: '/transport',
    },
    {
      icon: 'bike',
      label: 'Bike / Rickshaw',
      labelBn: 'বাইক / রিকশা',
      description: 'Other local transport',
      link: '/transport',
    },
  ],
  private_car: [
    {
      icon: 'car',
      label: 'Private Car Hire',
      labelBn: 'প্রাইভেট গাড়ি ভাড়া',
      description: 'Hire a private car',
      link: '/transport',
    },
    {
      icon: 'bus',
      label: 'Bus Alternative',
      labelBn: 'বাস বিকল্প',
      description: 'Compare with bus fares',
      link: '/transport/bus',
    },
  ],
};

function detectServiceIntents(messages: { role: string; content: string }[]): ServiceIntent[] {
  const userText = messages
    .filter((m) => m.role === 'user')
    .slice(-3)
    .map((m) => m.content)
    .join('\n');

  if (!userText.trim()) return [];

  const found = new Set<ServiceIntent>();
  for (const intent of SERVICE_INTENTS) {
    const patterns = INTENT_KEYWORDS[intent];
    for (const pattern of patterns) {
      if (pattern.test(userText)) {
        found.add(intent);
        break;
      }
    }
  }
  return SERVICE_INTENTS.filter((i) => found.has(i));
}

function hasTripInfo(messages: { role: string; content: string }[], extracted: Partial<ExtractedInfo>): boolean {
  if (extracted.destination || typeof extracted.budget === 'number') return true;
  const userText = messages
    .filter((m) => m.role === 'user')
    .slice(-3)
    .map((m) => m.content)
    .join(' ');
  const tripPatterns = [
    'বাজেট', 'budget', 'দিন', 'days', 'জন', 'people',
    'তারিখ', 'date', 'যাব', 'যাবো', 'থাকব', 'বিল',
  ];
  return tripPatterns.some((pat) => userText.toLowerCase().includes(pat.toLowerCase()));
}

function resolveIntentSelection(
  aiServices: string[],
  detected: ServiceIntent[],
  hasTrip: boolean,
): ServiceIntent[] {
  const nonCore: ServiceIntent[] = [
    'restaurant',
    'flight',
    'car',
    'activity',
    'boat',
    'local_transport',
    'student_deal',
    'local_guide',
    'cng',
    'private_car',
  ];

  const aiSet = new Set<ServiceIntent>(
    (aiServices || []).filter((s): s is ServiceIntent => SERVICE_INTENTS.includes(s as ServiceIntent)),
  );
  const detSet = new Set(detected);

  const detNonCore = SERVICE_INTENTS.filter((i) => nonCore.includes(i) && detSet.has(i));

  // 1. Explicit non-core request (grounded by keywords) wins — show exactly what was asked.
  if (detNonCore.length > 0) {
    return SERVICE_INTENTS.filter((i) => detSet.has(i));
  }

  // 2. AI detected a non-core service from conversation nuance — trust it.
  const aiNonCore = SERVICE_INTENTS.filter((i) => nonCore.includes(i) && aiSet.has(i));
  if (aiNonCore.length > 0) {
    const merged = new Set<ServiceIntent>([...aiNonCore, ...SERVICE_INTENTS.filter((i) => detSet.has(i))]);
    return SERVICE_INTENTS.filter((i) => merged.has(i));
  }

  // 3. Trip information given -> core essentials bus + hotel only.
  if (hasTrip) {
    return [...DEFAULT_CORE_INTENTS];
  }

  // 4. Core-only keyword matches (e.g. "বাস বুক করবো").
  const coreDet = SERVICE_INTENTS.filter((i) => !nonCore.includes(i) && detSet.has(i));
  if (coreDet.length > 0) {
    return coreDet;
  }

  // 5. AI core services only.
  const aiCore = SERVICE_INTENTS.filter((i) => !nonCore.includes(i) && aiSet.has(i));
  return aiCore;
}

function buildServiceLink(intent: ServiceIntent, destination?: string | null): string {
  const destPart = destination ? `?destination=${encodeURIComponent(destination)}` : '';
  switch (intent) {
    case 'bus':
      return `/transport/bus${destPart}`;
    case 'hotel':
      return `/hotels${destPart}`;
    case 'flight':
      return `/transport${destPart}`;
    case 'car':
      return `/transport${destPart}`;
    case 'local_transport':
      return `/transport${destPart}`;
    case 'restaurant':
      return `/services${destPart}`;
    case 'activity':
      return `/services${destPart}`;
    case 'boat':
      return `/services${destPart}`;
    case 'student_deal':
      return `/services${destPart}`;
    case 'local_guide':
      return `/services${destPart}`;
    case 'cng':
      return `/transport${destPart}`;
    case 'private_car':
      return `/transport${destPart}`;
  }
}

async function fetchLiveData(
  intent: ServiceIntent,
  destination?: string | null,
): Promise<{ items: LiveDataItem[]; note?: string }> {
  if (!destination) {
    return { items: [], note: 'গন্তব্য জানা নেই — live data দেখানো সম্ভব হয়নি।' };
  }

  try {
    if (intent === 'bus') {
      const trips: any[] = await (prisma as any).busTrip.findMany({
        where: {
          isActive: true,
          status: { in: ['SCHEDULED', 'OPEN'] },
          route: { destination: { contains: destination } },
          departureDate: { gte: new Date() },
        },
        include: {
          bus: { select: { busName: true, busType: true } },
          route: { select: { origin: true, destination: true } },
        },
        orderBy: { departureDate: 'asc' },
        take: 3,
      });
      const items: LiveDataItem[] = (trips || []).map((t: any) => ({
        name: `${t.bus?.busName || 'Bus'} (${t.bus?.busType || 'N/A'})`,
        price: t.pricePerSeat ?? undefined,
        currency: 'BDT',
        detail: `${t.route?.origin || '?'} → ${t.route?.destination || '?'} · ${t.departureDate ? new Date(t.departureDate).toLocaleDateString('en-GB') : ''} ${t.departureTime || ''}`,
        availabilityNote:
          (t.availableSeats || 0) > 0 ? `${t.availableSeats} seats available` : 'Seats may be limited — confirm at booking.',
      }));
      return items.length
        ? { items }
        : { items: [], note: 'এই রুটে এখন সব Bus লাইভে পাওয়া যাচ্ছে না।' };
    }

    if (intent === 'hotel') {
      const hotels: any[] = await (prisma as any).serviceProvider.findMany({
        where: {
          category: 'hotel',
          isVerified: true,
          OR: [
            { city: { contains: destination } },
            { address: { contains: destination } },
          ],
        },
        include: {
          rooms: {
            where: { isAvailable: true, status: 'ACTIVE' },
            select: { name: true, type: true, price: true, baseCurrency: true, capacity: true },
            take: 2,
          },
        },
        take: 3,
      });
      const items: LiveDataItem[] = (hotels || [])
        .filter((h: any) => h.rooms && h.rooms.length > 0)
        .map((h: any) => {
          const room = h.rooms[0];
          return {
            name: h.businessName,
            price: room?.price ?? undefined,
            currency: room?.baseCurrency ?? 'BDT',
            detail: room ? `${room.name} (${room.type}) · ${room.capacity} guests` : undefined,
            availabilityNote: 'রুম availability booking সময় confirm করতে হবে।',
          };
        });
      return items.length
        ? { items }
        : { items: [], note: 'এই গন্তব্যে এখন লাইভ Hotel পাওয়া যাচ্ছে না।' };
    }

    if (intent === 'flight') {
      const flights = await prisma.flight.findMany({
        where: { isActive: true, destination: { contains: destination }, departureTime: { gte: new Date() } },
        orderBy: { departureTime: 'asc' },
        take: 3,
      });
      const items: LiveDataItem[] = flights.map((f) => ({
        name: f.flightNumber,
        price: f.price,
        currency: f.currency,
        detail: `${f.origin} → ${f.destination} · ${new Date(f.departureTime).toLocaleDateString('en-GB')} ${new Date(f.departureTime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`,
        availabilityNote: f.availableSeats > 0 ? `${f.availableSeats} seats available` : 'Confirm availability at booking.',
      }));
      return items.length
        ? { items }
        : { items: [], note: 'এই রুটে এখন লাইভ Flight পাওয়া যাচ্ছে না।' };
    }

    if (intent === 'local_guide') {
      return {
        items: [],
        note: 'লোকাল গাইড availability ও fare গাইডের সাথে কথা বলে confirm করতে হবে। বুকিংয়ের সময় যাচাই করুন।',
      };
    }

    if (intent === 'cng') {
      return {
        items: [],
        note: 'সিএনজি fare ও availability স্থানীয়ভাবে নির্ভরশীল — বুকিংয়ের সময় confirm করুন।',
      };
    }

    if (intent === 'private_car') {
      return {
        items: [],
        note: 'প্রাইভেট গাড়ি fare ও availability গাড়ি মালিকের সাথে কথা বলে confirm করতে হবে।',
      };
    }

    const serviceTypeMap: Partial<Record<ServiceIntent, string>> = {
      restaurant: 'RESTAURANT',
      activity: 'ACTIVITY',
      boat: 'BOAT',
      local_transport: 'TRANSPORT',
      car: 'CAR',
    };
    const serviceTypeByIntent = serviceTypeMap[intent];
    if (serviceTypeByIntent) {
      const services = await prisma.service.findMany({
        where: {
          serviceType: serviceTypeByIntent,
          isActive: true,
          status: 'ACTIVE',
          OR: [
            { locationCity: { contains: destination } },
            { route: { contains: destination } },
          ],
        },
        take: 3,
      });
      const items: LiveDataItem[] = services.map((s) => ({
        name: s.name,
        price: s.price,
        currency: s.currency,
        detail: s.locationCity || undefined,
        availabilityNote: s.availability || 'Availability confirm করতে হবে।',
      }));
      return items.length
        ? { items }
        : { items: [], note: `${INTENT_META[intent].label} এখন লাইভ listing পাওয়া যায়নি।` };
    }

    return { items: [], note: `${INTENT_META[intent].label} সম্পর্কে লাইভ availability/price এখন confirm করা যাচ্ছে না।` };
  } catch (error) {
    logError('Live data fetch failed', error, { intent, destination });
    return { items: [], note: 'লাইভ availability/price এখন confirm করা যাচ্ছে না।' };
  }
}

function buildServiceCards(
  intents: ServiceIntent[],
  destination?: string | null,
): ServiceRecommendation[] {
  return intents.map((intent) => {
    const meta = INTENT_META[intent];
    const defaults: ServiceRecommendation = {
      intent,
      category: meta.label.toLowerCase().replace(/[^a-z]+/g, '-'),
      icon: meta.icon,
      label: meta.label,
      labelBn: meta.labelBn,
      description: `${meta.label} — ${meta.labelBn}`,
      link: buildServiceLink(intent, destination),
      subServices: SUB_SERVICE_LINKS[intent].map((sub) => ({
        ...sub,
        link: destination ? `${sub.link}${sub.link.includes('?') ? '&' : '?'}destination=${encodeURIComponent(destination)}` : sub.link,
      })),
    };
    return defaults;
  });
}

function parseAIResult(raw: string): AIParsedResult | null {
  try {
    const cleaned = raw.replace(/```/g, '');
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const jsonStr = jsonMatch[0];
    try {
      return JSON.parse(jsonStr) as AIParsedResult;
    } catch {
      const fixed = jsonStr
        .replace(/\{([a-zA-Z_$][\w$]*)\s*:/g, '{"$1":')
        .replace(/,\s*([a-zA-Z_$][\w$]*)\s*:/g, ',"$1":');
      try {
        return JSON.parse(fixed) as AIParsedResult;
      } catch {
        logError('AI response JSON parse failed', new Error('Malformed AI response'), { rawLength: raw.length });
        return null;
      }
    }
  } catch {
    return null;
  }
}

function fallbackReply(intents: ServiceIntent[], destination?: string | null, budget?: number | null): string {
  const parts: string[] = [];
  if (destination) parts.push(destination);
  if (typeof budget === 'number') parts.push(`৳${budget.toLocaleString('en-BD')} বাজেট`);
  const context = parts.length > 0 ? ` (${parts.join(', ')})` : '';

  if (intents.length === 0) {
    return 'আপনার জন্য কোন সেবা নিশ্চিত করতে আরও তথ্য দরকার। কোথায় যেতে চান, কত দিন এবং কত বাজেট — বলুন!';
  }
  const names = intents.map((i) => INTENT_META[i].labelBn);
  return `আপনার প্রয়োজনে ${names.join(', ')} খুঁজে দেওয়ার চেষ্টা করছি${context}। লাইভ availability ও চূড়ান্ত price বুকিংয়ের সময় confirm করা যাবে।`;
}

router.post('/chat', async (req: Request, res: Response) => {
  try {
    const parse = chatRequestSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ error: parse.error.issues });
    }

    const { messages, destination, maxBudget } = parse.data;

    const provider = aiFactory.getDefaultProvider();
    if (!provider) {
      return res.status(503).json({ error: 'AI assistant is temporarily unavailable.' });
    }

    const contextParts: string[] = [];
    if (destination) contextParts.push(`Known destination: ${destination}`);
    if (maxBudget) contextParts.push(`Known budget: BDT ${maxBudget}`);
    const contextHint = contextParts.length > 0 ? `\n\nKnown customer context from previous turns: ${contextParts.join('. ')}` : '';

    const chatMessages = [
      { role: 'system' as const, content: SYSTEM_PROMPT + contextHint },
      ...messages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    ];

    let aiReply = '';
    let aiServices: string[] = [];

    try {
      const response = await provider.chat(chatMessages);
      const parsed = parseAIResult(response.content);
      if (parsed && parsed.reply && typeof parsed.reply === 'string') {
        aiReply = parsed.reply;
        aiServices = Array.isArray(parsed.services) ? parsed.services : [];
      }
    } catch (aiError: any) {
      logError('AI chat failed', aiError, { provider: provider.name });
    }

    const detected = detectServiceIntents(messages);
    const hasTrip = hasTripInfo(messages, { destination: destination ?? undefined, budget: maxBudget });

    // Trust deterministic detection first (local OmniRoute may not emit perfect JSON),
    // fall back to AI-extracted services otherwise.
    let selected: ServiceIntent[] = detectServiceIntents(messages);
    if (selected.length === 0) {
      selected = resolveIntentSelection(aiServices, detected, hasTrip);
    }

    if (selected.length === 0 && aiServices.length > 0) {
      selected = resolveIntentSelection(aiServices, [], hasTrip);
    }

    if (selected.length === 0 && hasTrip) {
      selected = [...DEFAULT_CORE_INTENTS];
    }

    const hasNonCore = (list: ServiceIntent[]) =>
      list.some((i) => ['restaurant', 'flight', 'car', 'activity', 'boat', 'local_transport', 'student_deal', 'local_guide', 'cng', 'private_car'].includes(i));

    // Post-filter: never surface non-core services the customer did not ask about.
    if (aiServices.length > 0 && !hasNonCore(detected) && hasNonCore(selected)) {
      const filtered = selected.filter((i) => {
        if (['restaurant', 'flight', 'car', 'activity', 'boat', 'local_transport', 'student_deal', 'local_guide', 'cng', 'private_car'].includes(i)) {
          return aiServices.includes(i);
        }
        return true;
      });
      if (filtered.length > 0) selected = filtered;
    }

    const dest = destination || (messages.length > 0 ? null : null);

    const serviceCards: ServiceRecommendation[] = [];
    for (const intent of selected) {
      const card = buildServiceCards([intent], undefined)[0];
      const live = await fetchLiveData(intent, destination);
      card.liveData = live.items;
      card.availabilityNote =
        live.note ||
        (live.items.length === 0
          ? 'লাইভ availability/price এখন confirm করা যাচ্ছে না — বুকিংয়ের সময় যাচাই করুন।'
          : undefined);
      serviceCards.push(card);
    }

    const reply = aiReply || fallbackReply(selected, destination, maxBudget);
    const setDest = destination || undefined;
    const setBudget = typeof maxBudget === 'number' ? maxBudget : undefined;

    return res.json({
      reply,
      services: serviceCards,
      extractedInfo: {
        destination: setDest,
        budget: setBudget,
        needs: selected,
      },
    });
  } catch (error: any) {
    logError('Chat endpoint error', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

export default router;