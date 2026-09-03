export const topDeals = [
  {
    id: 1,
    route: "Dhaka → Cox's Bazar",
    category: 'Bus',
    price: 1200,
    originalPrice: 1500,
    discount: 20,
    href: '/transport/bus?from=Dhaka&to=Cox%27s+Bazar',
    image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600&h=400&fit=crop',
  },
  {
    id: 2,
    route: 'Hotel Ocean Paradise',
    category: 'Hotel',
    price: 5200,
    originalPrice: 6500,
    discount: 20,
    href: '/destinations',
    image: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=600&h=400&fit=crop',
  },
  {
    id: 3,
    route: 'Dhaka → Sylhet',
    category: 'Bus',
    price: 850,
    originalPrice: 1000,
    discount: 15,
    href: '/transport/bus?from=Dhaka&to=Sylhet',
    image: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=600&h=400&fit=crop',
  },
  {
    id: 4,
    route: 'Saint Martin 3-Day Package',
    category: 'Tour',
    price: 14500,
    originalPrice: 18000,
    discount: 19,
    href: '/plan-trip',
    image: 'https://images.unsplash.com/photo-1506929562872-bb421503ef21?w=600&h=400&fit=crop',
  },
];

export const popularDestinations = [
  {
    id: 1,
    name: "Cox's Bazar",
    country: 'Bangladesh',
    image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600&h=400&fit=crop',
    rating: 4.8,
    priceFrom: 1200,
  },
  {
    id: 2,
    name: 'Sajek Valley',
    country: 'Bangladesh',
    image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&h=400&fit=crop',
    rating: 4.7,
    priceFrom: 2400,
  },
  {
    id: 3,
    name: "Saint Martin's Island",
    country: 'Bangladesh',
    image: 'https://images.unsplash.com/photo-1514282401047-d79a71a590e8?w=600&h=400&fit=crop',
    rating: 4.9,
    priceFrom: 14500,
  },
  {
    id: 4,
    name: 'Sundarbans',
    country: 'Bangladesh',
    image: 'https://images.unsplash.com/photo-1507876466758-bc54f384809c?w=600&h=400&fit=crop',
    rating: 4.6,
    priceFrom: 3200,
  },
  {
    id: 5,
    name: 'Sylhet',
    country: 'Bangladesh',
    image: 'https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?w=600&h=400&fit=crop',
    rating: 4.8,
    priceFrom: 1450,
  },
  {
    id: 6,
    name: 'Bandarban',
    country: 'Bangladesh',
    image: 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=600&h=400&fit=crop',
    rating: 4.7,
    priceFrom: 1800,
  },
];

export const categories = [
  { id: 'hotels', name: 'Hotels', icon: 'Hotel', href: '/destinations', comingSoon: false },
  { id: 'buses', name: 'Buses', icon: 'Bus', href: '/transport/bus', comingSoon: false },
  { id: 'flights', name: 'Flights', icon: 'Plane', href: null, comingSoon: true },
  { id: 'tours', name: 'Tours', icon: 'Palmtree', href: '/plan-trip', comingSoon: false },
  { id: 'trains', name: 'Trains', icon: 'Train', href: null, comingSoon: true },
  { id: 'cars', name: 'Car Rentals', icon: 'Car', href: null, comingSoon: true },
  { id: 'activities', name: 'Activities', icon: 'Compass', href: null, comingSoon: true },
  { id: 'restaurants', name: 'Restaurants', icon: 'UtensilsCrossed', href: null, comingSoon: true },
];

export const trustBadges = [
  { id: 1, title: 'Best Price Guarantee', description: 'Pay less on every journey', icon: 'ShieldCheck' },
  { id: 2, title: 'Secure Booking', description: '256-bit SSL encrypted', icon: 'Lock' },
  { id: 3, title: '24/7 Bangla Support', description: 'Helpdesk in your language', icon: 'Headphones' },
  { id: 4, title: 'Earn ETP Points', description: 'Rewards on every booking', icon: 'Gift' },
];

export const homeStats = [
  { id: 1, value: '120+', label: 'Bus Partners' },
  { id: 2, value: '50K+', label: 'Happy Travellers' },
  { id: 3, value: '4.7★', label: 'Average Rating' },
  { id: 4, value: '24/7', label: 'Bangla Support' },
];

export const benefits = [
  {
    id: 1,
    title: 'Best Price Guarantee',
    description: 'Find the lowest fares on buses, hotels and tour packages across Bangladesh.',
    icon: 'ShieldCheck',
    color: 'blue',
  },
  {
    id: 2,
    title: 'Secure & Easy Booking',
    description: 'Book with confidence using our safe, encrypted checkout in under a minute.',
    icon: 'Lock',
    color: 'green',
  },
  {
    id: 3,
    title: '24/7 Bangla Support',
    description: 'Our Dhaka-based support team is here any time, in Bangla or English.',
    icon: 'Headphones',
    color: 'purple',
  },
  {
    id: 4,
    title: 'Earn & Redeem ETP Points',
    description: 'Collect points on every booking and unlock exclusive rewards and discounts.',
    icon: 'Gift',
    color: 'amber',
  },
];

export const popularRoutes = [
  "Dhaka to Cox's Bazar",
  'Dhaka to Sylhet',
  'Dhaka to Chattogram',
  'Dhaka to Rajshahi',
  'Dhaka to Khulna',
];