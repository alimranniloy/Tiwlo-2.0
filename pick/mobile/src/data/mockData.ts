export interface BazarProduct {
  id: string;
  categoryId?: string | null;
  name: string;
  nameEn: string;
  category: string;
  categoryEn: string;
  price: number;
  oldPrice?: number;
  unit: string;
  unitEn: string;
  units: string[];
  unitsEn: string[];
  unitPrices?: number[];
  rating: number;
  reviews?: string;
  origin?: string;
  deliveryTime: string;
  image: string;
  description: string;
  descriptionEn: string;
  badge?: string;
  inStock: boolean;
}

export interface BazarCategory {
  id: string;
  titleEn: string;
  titleBn: string;
}

export interface ParcelOption {
  id: string;
  title: string;
  subtitle: string;
  iconName: string;
}

export interface TrackingStep {
  id: string;
  title: string;
  subtitle?: string;
  time?: string;
  status: 'completed' | 'active' | 'pending';
}

export interface TrackingData {
  orderId: string;
  orderStatus: string;
  orderStatusEn: string;
  estimateTime: string;
  estimateTimeEn: string;
  rider: {
    name: string;
    role: string;
    rating: number;
    phone: string;
    avatar: string;
    vehiclePlate: string;
  };
  timeline: TrackingStep[];
}

export const MockData = {
  app: {
    name: 'PICK',
    subtitle: 'Grocery • Parcel',
    subtitleBn: 'কাঁচাবাজার • গ্রোসারি • পার্সেল',
    tagline: 'Fresh daily bazar & express parcel delivery',
  },
  location: {
    address: 'Dhanmondi, Dhaka',
    addressBn: 'ধানমন্ডি, ঢাকা',
    country: 'Bangladesh',
    countryBn: 'বাংলাদেশ',
  },
  home: {
    categories: [
      { id: 'all', titleEn: 'All', titleBn: 'সব' },
      { id: 'staples', titleEn: 'Potatoes & Onions', titleBn: 'আলু ও পেঁয়াজ' },
      { id: 'veggies', titleEn: 'Vegetables & Greens', titleBn: 'সবজি ও শাক' },
      { id: 'dairy', titleEn: 'Eggs & Milk', titleBn: 'ডিম ও দুধ' },
      { id: 'meat_fish', titleEn: 'Fish & Meat', titleBn: 'মাছ ও মাংস' },
      { id: 'pantry', titleEn: 'Oil, Rice & Lentils', titleBn: 'চাল, ডাল, তেল' },
    ],
  },

  // Real Bazar Products (Alu, Peyaj, Shak-Sobji, etc.)
  products: [
    {
      id: 'p1',
      name: 'দেশি নতুন গোল আলু',
      nameEn: 'Fresh Deshi Potatoes',
      category: 'আলু ও পেঁয়াজ',
      categoryEn: 'Potatoes & Onions',
      price: 40,
      oldPrice: 48,
      unit: '১ কেজি',
      unitEn: '1 kg',
      units: ['৫০০ গ্রাম', '১ কেজি', '২ কেজি', '৫ কেজি'],
      unitsEn: ['500g', '1 kg', '2 kg', '5 kg'],
      rating: 4.9,
      reviews: '1.4k',
      origin: 'Bogra & Munshiganj',
      deliveryTime: '25–35 min',
      image: 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=500&q=80',
      description: 'মাটি ছাড়া পরিষ্কার, নিখুঁত ও মিষ্টি দেশি নতুন গোল আলু। তরকারি বা ভাজির জন্য সেরা।',
      descriptionEn: 'Farm-fresh, clean and sweet local new potatoes. Perfect for daily cooking and fries.',
      badge: 'Bestseller',
      inStock: true,
    },
    {
      id: 'p2',
      name: 'দেশি লাল পেঁয়াজ',
      nameEn: 'Fresh Red Onions',
      category: 'আলু ও পেঁয়াজ',
      categoryEn: 'Potatoes & Onions',
      price: 65,
      oldPrice: 75,
      unit: '১ কেজি',
      unitEn: '1 kg',
      units: ['৫০০ গ্রাম', '১ কেজি', '২ কেজি', '৫ কেজি'],
      unitsEn: ['500g', '1 kg', '2 kg', '5 kg'],
      rating: 4.8,
      reviews: '2.1k',
      origin: 'Faridpur',
      deliveryTime: '25–35 min',
      image: 'https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?w=500&q=80',
      description: 'তীক্ষ্ণ ঝাঁঝ ও দারুণ স্বাদের দেশি লাল পেঁয়াজ। শুকনো ও বাছাইকৃত মান।',
      descriptionEn: 'Aromatic, crisp deshi red onions. Hand-sorted dry quality.',
      badge: 'Fresh Stock',
      inStock: true,
    },
    {
      id: 'p3',
      name: 'তাজা লাল শাক',
      nameEn: 'Fresh Red Spinach (Lal Shak)',
      category: 'সবজি ও শাক',
      categoryEn: 'Vegetables & Greens',
      price: 25,
      oldPrice: 30,
      unit: '২ আঁটি',
      unitEn: '2 Bunches',
      units: ['১ আঁটি', '২ আঁটি', '৪ আঁটি'],
      unitsEn: ['1 Bunch', '2 Bunches', '4 Bunches'],
      rating: 4.9,
      reviews: '850',
      origin: 'Savar Farms',
      deliveryTime: '20–30 min',
      image: 'https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=500&q=80',
      description: 'আজ সকালে তোলা নরম ও তরতাজা দেশি লাল শাক। পুষ্টিগুণে ভরপুর।',
      descriptionEn: 'Harvested fresh this morning. Soft, nutrient-dense deshi red spinach.',
      badge: 'Fresh Pick',
      inStock: true,
    },
    {
      id: 'p4',
      name: 'তাজা কাঁচা মরিচ ও ধনেপাতা',
      nameEn: 'Green Chili & Fresh Coriander',
      category: 'সবজি ও শাক',
      categoryEn: 'Vegetables & Greens',
      price: 35,
      oldPrice: 45,
      unit: '২৫০ গ্রাম',
      unitEn: '250g',
      units: ['১০০ গ্রাম', '২৫০ গ্রাম', '৫০০ গ্রাম'],
      unitsEn: ['100g', '250g', '500g'],
      rating: 4.7,
      reviews: '920',
      origin: 'Narsingdi',
      deliveryTime: '20–30 min',
      image: 'https://images.unsplash.com/photo-1563729784474-d77dbb933a9e?w=500&q=80',
      description: 'তাজা সুগন্ধি ধনেপাতা এবং ঝাল তাজা কাঁচা মরিচের কম্বো প্যাক।',
      descriptionEn: 'Fragrant fresh green coriander and spicy deshi green chilies combo pack.',
      badge: 'Daily Need',
      inStock: true,
    },
    {
      id: 'p5',
      name: 'গোল কালো বেগুন',
      nameEn: 'Fresh Purple Eggplant (Brinjal)',
      category: 'সবজি ও শাক',
      categoryEn: 'Vegetables & Greens',
      price: 50,
      oldPrice: 60,
      unit: '৫০০ গ্রাম',
      unitEn: '500g',
      units: ['৫০০ গ্রাম', '১ কেজি', '২ কেজি'],
      unitsEn: ['500g', '1 kg', '2 kg'],
      rating: 4.8,
      reviews: '640',
      origin: 'Jashore',
      deliveryTime: '25–35 min',
      image: 'https://images.unsplash.com/photo-1528825871115-3581a5387919?w=500&q=80',
      description: 'বীজমুক্ত, নরম ও চমৎকার তাজা বেগুন। ভাজি বা ভর্তার জন্য আদর্শ।',
      descriptionEn: 'Seedless, tender round purple brinjal. Ideal for bhaji and roasting.',
      inStock: true,
    },
    {
      id: 'p6',
      name: 'ফার্মের তাজা লাল ডিম',
      nameEn: 'Farm Fresh Brown Eggs',
      category: 'ডিম ও দুধ',
      categoryEn: 'Eggs & Milk',
      price: 140,
      oldPrice: 155,
      unit: '১ ডজন (১২টি)',
      unitEn: '1 Dozen (12 pcs)',
      units: ['৪টি (১ হালি)', '১২টি (১ ডজন)', '৩০টি (১ কেস)'],
      unitsEn: ['4 pcs', '12 pcs (1 Dozen)', '30 pcs (1 Tray)'],
      rating: 4.9,
      reviews: '3.4k',
      origin: 'Gazipur Poultry Farm',
      deliveryTime: '20–30 min',
      image: 'https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?w=500&q=80',
      description: 'সম্পূর্ণ তাজা ও পরিষ্কার গ্রেড-এ ফার্মের লাল ডিম। নিরাপদ ও প্রোটিনসমৃদ্ধ।',
      descriptionEn: 'Farm fresh Grade-A cleaned brown eggs. Safe, tested and rich in protein.',
      badge: 'Popular',
      inStock: true,
    },
    {
      id: 'p7',
      name: 'তাজা রুই মাছের পেটি ও চাকা',
      nameEn: 'Fresh Rui Fish Cut & Cleaned',
      category: 'মাছ ও মাংস',
      categoryEn: 'Fish & Meat',
      price: 380,
      oldPrice: 420,
      unit: '১ কেজি',
      unitEn: '1 kg',
      units: ['৫০০ গ্রাম', '১ কেজি', '২ কেজি'],
      unitsEn: ['500g', '1 kg', '2 kg'],
      rating: 4.8,
      reviews: '1.1k',
      origin: 'Meghna River',
      deliveryTime: '30–40 min',
      image: 'https://images.unsplash.com/photo-1534948216015-843149f72be3?w=500&q=80',
      description: 'আজকের জীবন্ত রুই মাছ, আইশ ফেলে রেডি-টু-কুক সাইজে কেটে ডেলিভারি।',
      descriptionEn: 'Fresh river Rui fish, descaled and cut into ready-to-cook pieces.',
      badge: 'Formalin Free',
      inStock: true,
    },
    {
      id: 'p8',
      name: 'তীর খাঁটি সয়াবিন তেল',
      nameEn: 'Teer Pure Soybean Oil',
      category: 'চাল, ডাল, তেল',
      categoryEn: 'Oil, Rice & Lentils',
      price: 175,
      oldPrice: 185,
      unit: '১ লিটার বোতল',
      unitEn: '1 Litre Bottle',
      units: ['১ লিটার', '২ লিটার', '৫ লিটার'],
      unitsEn: ['1 Litre', '2 Litres', '5 Litres'],
      rating: 4.9,
      reviews: '2.8k',
      origin: 'City Group',
      deliveryTime: '20–30 min',
      image: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=500&q=80',
      description: 'ভিটামিন এ ও ই সমৃদ্ধ ১০০% খাঁটি রিফাইন্ড সয়াবিন তেল।',
      descriptionEn: '100% pure refined soybean oil enriched with Vitamin A & E.',
      inStock: true,
    },
  ] as BazarProduct[],

  parcelOptions: [
    {
      id: 'bike',
      title: 'বাইক ডেলিভারি (ছোট পার্সেল)',
      subtitle: 'ডকুমেন্টস, ছোট বক্স (৫ কেজি পর্যন্ত)',
      iconName: 'scooter',
    },
    {
      id: 'car',
      title: 'কার / মাইক্রো ডেলিভারি',
      subtitle: 'ভঙ্গুর মালামাল ও বড় আইটেম (২০ কেজি পর্যন্ত)',
      iconName: 'car',
    },
    {
      id: 'cng',
      title: 'সিএনজি কার্গো',
      subtitle: 'মাঝারি কার্টুন ও মালামাল (৪৫ কেজি পর্যন্ত)',
      iconName: 'pickup',
    },
    {
      id: 'truck',
      title: 'পিকআপ ট্রাক',
      subtitle: 'ভারী ফার্নিচার ও বাসা শিফটিং (৫০০ কেজি পর্যন্ত)',
      iconName: 'truck',
    },
  ] as ParcelOption[],

  tracking: {
    orderId: '#PK-884920',
    orderStatus: 'রাইডার কাঁচাবাজার নিয়ে রওনা দিয়েছেন',
    orderStatusEn: 'Rider is on the way with your groceries',
    estimateTime: 'পৌঁছাবে ১৮–২৫ মিনিটের মধ্যে',
    estimateTimeEn: 'Arriving in 18–25 mins',
    rider: {
      name: 'Md. Rafiqul Islam',
      role: 'Express Delivery Partner',
      rating: 4.9,
      phone: '+8801712345678',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&q=80',
      vehiclePlate: 'Dhaka Metro HA-58-4192',
    },
    timeline: [
      {
        id: '1',
        title: 'Order Confirmed',
        subtitle: 'Bazar order received',
        time: '03:15 PM',
        status: 'completed',
      },
      {
        id: '2',
        title: 'Packing & Quality Check',
        subtitle: 'Hand-picked fresh items weighed and sorted',
        time: '03:25 PM',
        status: 'completed',
      },
      {
        id: '3',
        title: 'Rider on the Way',
        subtitle: 'Rider heading towards your address',
        time: '03:35 PM',
        status: 'active',
      },
      {
        id: '4',
        title: 'Delivered at Doorstep',
        subtitle: 'Pay via cash or bKash at delivery',
        time: '03:55 PM',
        status: 'pending',
      },
    ],
  } as TrackingData,
};
