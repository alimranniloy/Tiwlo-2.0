export type SupportedLanguage = 'en' | 'bn';

export interface LanguageMeta {
  code: SupportedLanguage;
  name: string;
  nativeName: string;
}

export const AVAILABLE_LANGUAGES: LanguageMeta[] = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা' },
];

export const translations = {
  en: {
    // Common
    common: {
      appName: 'PICK',
      continue: 'Continue',
      save: 'Save',
      cancel: 'Cancel',
      change: 'Change',
      edit: 'Edit',
      search: 'Search',
      back: 'Back',
      total: 'Total',
      items: 'items',
      item: 'item',
      min: 'mins',
      viewAll: 'View All',
      add: 'Add',
      added: 'Added',
      off: 'OFF',
      rating: 'Rating',
      inStock: 'In Stock',
      deliveryTime: 'Delivery Time',
    },

    // Navigation
    nav: {
      home: 'Home',
      parcel: 'Parcel',
      orders: 'Orders',
      wallet: 'Wallet',
      profile: 'Profile',
    },

    // Splash
    splash: {
      title: 'PICK',
      tagline: 'Fresh Groceries & Express Courier',
    },

    // Auth
    auth: {
      title: 'Sign in or Sign up',
      subtitle: 'Enter your mobile number to get started',
      phonePlaceholder: '1712 345678',
      continueBtn: 'Continue',
      googleBtn: 'Continue with Google',
      termsNotice: 'By continuing, you agree to our Terms of Service & Privacy Policy.',
    },

    // Location
    location: {
      title: 'Enable Location',
      subtitle: 'Allow location access to discover daily fresh groceries and fast courier near you',
      useCurrentLocation: 'Use Current Location',
      confirmedTitle: 'Location Confirmed',
      confirmedSubtitle: 'Your delivery zone is ready for orders',
      confirmLocation: 'Confirm Delivery Location',
      changeLocation: 'Change',
      currentCity: 'Dhanmondi, Dhaka',
    },

    // Home
    home: {
      deliveringTo: 'DELIVERING TO',
      searchPlaceholder: 'Search fresh potatoes, onions, vegetables, fish...',
      all: 'All Items',
      staples: 'Potatoes & Onions',
      veggies: 'Vegetables & Greens',
      dairy: 'Eggs & Milk',
      fishMeat: 'Fish & Meat',
      pantry: 'Oil & Staples',
      popularSection: 'Popular Daily Bazar',
      staplesSection: 'Potatoes & Onions (Wholesale)',
      veggiesSection: 'Farm Fresh Vegetables',
      fishMeatSection: 'Fresh Fish & Meat',
      dealsSection: 'Special Deals of the Day',
      selectWeight: 'Choose weight:',
      addToCart: 'Add to Cart',
      viewCart: 'View Cart',
      itemsInCart: 'items in cart',
    },

    // Product Detail
    product: {
      selectUnit: 'Select Quantity / Weight',
      freshGuarantee: '100% Quality Guarantee',
      origin: 'Source',
      estimatedDelivery: 'Estimated Delivery',
      addQuantity: 'Quantity',
      addToBag: 'Add to Bag',
      description: 'Product Details',
      relatedItems: 'Frequently Bought Together',
    },

    // Checkout
    checkout: {
      title: 'Checkout',
      deliveryAddress: 'Delivery Address',
      deliveryTime: 'Estimated Time',
      timeSlot: '25–35 mins • Express Doorstep Delivery',
      selectedItems: 'Selected Items',
      addMore: '+ Add more items',
      billSummary: 'Bill Summary',
      itemTotal: 'Items Total',
      deliveryFee: 'Delivery Fee',
      freeDelivery: 'Free Delivery',
      totalPayable: 'Total Payable',
      paymentMethod: 'Payment Method',
      bkash: 'bKash Online Payment',
      cod: 'Cash on Delivery',
      placeOrder: 'Confirm & Place Order',
    },

    // Order Tracking
    tracking: {
      title: 'Order Tracking',
      liveTracking: 'Live GPS Route Active',
      statusOnWay: 'Rider is on the way with your groceries',
      estimateTime: 'Arriving in 18–25 mins',
      riderRole: 'Express Delivery Partner',
      callRider: 'Call Rider',
      chatRider: 'Message',
      progressTitle: 'Delivery Progress',
      stepConfirmed: 'Order Confirmed',
      stepPacking: 'Quality Check & Packing Completed',
      stepOnWay: 'Rider Dispatched to your Address',
      stepDelivered: 'Delivered at Doorstep',
    },

    // Orders
    orders: {
      title: 'Orders & Activity',
      activeTab: 'Active Orders',
      pastTab: 'Past Orders',
      trackOrder: 'Track Live Order',
      reorder: 'Reorder',
      noActiveOrders: 'No active orders right now',
      emptyPastOrders: 'No past orders yet',
    },

    // Wallet
    wallet: {
      title: 'Wallet & Payments',
      balanceLabel: 'PICK Cash Balance',
      addFunds: 'Add Funds',
      paymentMethods: 'Saved Payment Methods',
      recentTransactions: 'Recent Transactions',
      recharge: 'Recharge via bKash',
      sendMoney: 'Send Money',
    },

    // Profile
    profile: {
      title: 'My Profile',
      userName: 'Imran Hossain',
      phone: '+880 1712-345678',
      ordersMenu: 'My Orders & Activity',
      walletMenu: 'Wallet & Payments',
      addressesMenu: 'Saved Addresses',
      settingsMenu: 'App Settings',
      languageMenu: 'Language',
      helpMenu: 'Help & 24/7 Support',
      signOut: 'Sign Out',
      preferencesHeader: 'Preferences',
      accountHeader: 'Account',
      selectLanguageModal: 'Select Language',
    },

    // Parcel
    parcel: {
      title: 'Send a Parcel',
      pickupLocation: 'PICKUP LOCATION',
      deliveryLocation: 'DELIVERY DESTINATION',
      parcelOptions: 'Parcel Details',
      packageInfo: 'Package Information',
      recipientInfo: 'Recipient & Sender Details',
      selectVehicle: 'Select Delivery Vehicle',
      continue: 'Continue',
      packageDetailsTitle: 'Package Details',
      categoryLabel: 'Category',
      weightLabel: 'Approx. Weight (kg)',
      valueLabel: 'Approx. Value (৳)',
      fragileLabel: 'Fragile / Handle with Care',
      instructionsLabel: 'Delivery Instructions for Rider',
      save: 'Save Details',
      recipientScreenTitle: 'Sender & Recipient',
      senderHeader: 'Sender (Pickup)',
      recipientHeader: 'Recipient (Dropoff)',
      pinLabel: 'Delivery PIN Verification',
      payerLabel: 'Who Pays Fare?',
      senderPays: 'Sender',
      recipientPays: 'Recipient',
      reviewTitle: 'Review Parcel Order',
      fareDetails: 'Fare Breakdown',
      confirmParcel: 'Confirm Parcel Order',
    },
  },

  bn: {
    // Common
    common: {
      appName: 'PICK',
      continue: 'এগিয়ে যান',
      save: 'সংরক্ষণ করুন',
      cancel: 'বাতিল',
      change: 'পরিবর্তন',
      edit: 'সম্পাদনা',
      search: 'অনুসন্ধান',
      back: 'ফিরে যান',
      total: 'সর্বমোট',
      items: 'টি পণ্য',
      item: 'টি পণ্য',
      min: 'মিনিট',
      viewAll: 'সব দেখুন',
      add: 'যোগ করুন',
      added: 'যোগ হয়েছে',
      off: 'ছাড়',
      rating: 'রেটিং',
      inStock: 'স্টকে আছে',
      deliveryTime: 'ডেলিভারি সময়',
    },

    // Navigation
    nav: {
      home: 'হোম',
      parcel: 'পার্সেল',
      orders: 'অর্ডার',
      wallet: 'ওয়ালেট',
      profile: 'প্রোফাইল',
    },

    // Splash
    splash: {
      title: 'PICK',
      tagline: 'তাজা কাঁচাবাজার ও এক্সপ্রেস পার্সেল',
    },

    // Auth
    auth: {
      title: 'লগইন বা সাইন-আপ',
      subtitle: 'আপনার মোবাইল নম্বর দিয়ে সহজেই শুরু করুন',
      phonePlaceholder: '1712 345678',
      continueBtn: 'এগিয়ে যান',
      googleBtn: 'গুগল দিয়ে প্রবেশ করুন',
      termsNotice: 'এগিয়ে যাওয়ার মাধ্যমে আপনি শর্তাবলী ও গোপনীয়তা নীতিতে সম্মতি দিচ্ছেন।',
    },

    // Location
    location: {
      title: 'লোকেশন চালু করুন',
      subtitle: 'আপনার এলাকার তাজা কাঁচাবাজার ও দ্রুততম পার্সেল দেখতে লোকেশন অনুমোদন দিন',
      useCurrentLocation: 'বর্তমান লোকেশন দিন',
      confirmedTitle: 'লোকেশন নিশ্চিত হয়েছে',
      confirmedSubtitle: 'আপনার ডেলিভারি জোন এখন সম্পূর্ণ সক্রিয়',
      confirmLocation: 'ডেলিভারি লোকেশন নিশ্চিত করুন',
      changeLocation: 'পরিবর্তন',
      currentCity: 'ধানমন্ডি, ঢাকা',
    },

    // Home
    home: {
      deliveringTo: 'ডেলিভারি লোকেশন',
      searchPlaceholder: 'আলু, পেঁয়াজ, শাক-সবজি, মাছ খুঁজুন...',
      all: 'সব পণ্য',
      staples: 'আলু ও পেঁয়াজ',
      veggies: 'সবজি ও শাক',
      dairy: 'ডিম ও দুধ',
      fishMeat: 'মাছ ও মাংস',
      pantry: 'চাল, ডাল, তেল',
      popularSection: 'আজকের জনপ্রিয় তাজা বাজার',
      staplesSection: 'আলু ও পেঁয়াজ (পাইকারি দর)',
      veggiesSection: 'ক্ষেত থেকে তোলা তাজা শাক-সবজি',
      fishMeatSection: 'তাজা মাছ ও মাংস',
      dealsSection: 'আজকের বিশেষ ছাড়',
      selectWeight: 'ওজন বেছে নিন:',
      addToCart: 'ব্যাগে নিন',
      viewCart: 'কার্ট দেখুন',
      itemsInCart: 'টি পণ্য কার্টে',
    },

    // Product Detail
    product: {
      selectUnit: 'পরিমাণ / ওজন বাছাই করুন',
      freshGuarantee: '১০০% তাজা গ্যারান্টি',
      origin: 'উৎস',
      estimatedDelivery: 'আনুমানিক ডেলিভারি',
      addQuantity: 'পরিমাণ',
      addToBag: 'ব্যাগে যোগ করুন',
      description: 'পণ্যের বিবরণ',
      relatedItems: 'একসাথে আরও যা কিনতে পারেন',
    },

    // Checkout
    checkout: {
      title: 'চেকআউট',
      deliveryAddress: 'ডেলিভারি ঠিকানা',
      deliveryTime: 'আনুমানিক সময়',
      timeSlot: '২৫–৩৫ মিনিট • এক্সপ্রেস ডোরস্টেপ ডেলিভারি',
      selectedItems: 'নির্বাচিত পণ্যসমূহ',
      addMore: '+ আরও পণ্য যোগ করুন',
      billSummary: 'বিল বিবরণী',
      itemTotal: 'পণ্যের মূল্য',
      deliveryFee: 'ডেলিভারি চার্জ',
      freeDelivery: 'ফ্রি ডেলিভারি',
      totalPayable: 'সর্বমোট প্রদেয়',
      paymentMethod: 'পেমেন্ট পদ্ধতি',
      bkash: 'বিকাশ অনলাইন পেমেন্ট',
      cod: 'ক্যাশ অন ডেলিভারি',
      placeOrder: 'অর্ডার নিশ্চিত করুন',
    },

    // Order Tracking
    tracking: {
      title: 'অর্ডার ট্র্যাকিং',
      liveTracking: 'লাইভ জিপিএস রুট সক্রিয়',
      statusOnWay: 'রাইডার কাঁচাবাজার নিয়ে রওনা দিয়েছেন',
      estimateTime: 'পৌঁছাবে ১৮–২৫ মিনিটের মধ্যে',
      riderRole: 'এক্সপ্রেস ডেলিভারি পার্টনার',
      callRider: 'রাইডারকে কল করুন',
      chatRider: 'মেসেজ পাঠান',
      progressTitle: 'ডেলিভারি অগ্রগতি',
      stepConfirmed: 'অর্ডার নিশ্চিত করা হয়েছে',
      stepPacking: 'পণ্য বাছাই ও প্যাকিং সম্পন্ন',
      stepOnWay: 'রাইডার আপনার ঠিকানায় রওনা দিয়েছেন',
      stepDelivered: 'দরজায় ডেলিভারি সম্পন্ন',
    },

    // Orders
    orders: {
      title: 'অর্ডার ও অ্যাক্টিভিটি',
      activeTab: 'চলমান অর্ডার',
      pastTab: 'পূর্বের অর্ডার',
      trackOrder: 'লাইভ ট্র্যাকিং দেখুন',
      reorder: 'আবার অর্ডার',
      noActiveOrders: 'বর্তমানে কোনো চলমান অর্ডার নেই',
      emptyPastOrders: 'পূর্বে কোনো অর্ডার করা হয়নি',
    },

    // Wallet
    wallet: {
      title: 'ওয়ালেট ও পেমেন্ট',
      balanceLabel: 'PICK ক্যাশ ব্যালেন্স',
      addFunds: 'টাকা যোগ করুন',
      paymentMethods: 'সংরক্ষিত পেমেন্ট মেথড',
      recentTransactions: 'সাম্প্রতিক লেনদেন',
      recharge: 'বিকাশ থেকে রিচার্জ',
      sendMoney: 'সেন্ড মানি',
    },

    // Profile
    profile: {
      title: 'আমার প্রোফাইল',
      userName: 'ইমরান হোসেন',
      phone: '+880 1712-345678',
      ordersMenu: 'আমার অর্ডারসমূহ',
      walletMenu: 'ওয়ালেট ও পেমেন্ট',
      addressesMenu: 'সংরক্ষিত ঠিকানা',
      settingsMenu: 'অ্যাপ সেটিংস',
      languageMenu: 'ভাষা (Language)',
      helpMenu: 'সহায়তা ও ২৪/৭ সাপোর্ট',
      signOut: 'সাইন আউট',
      preferencesHeader: 'পছন্দ ও সেটিংস',
      accountHeader: 'অ্যাকাউন্ট',
      selectLanguageModal: 'ভাষা নির্বাচন করুন',
    },

    // Parcel
    parcel: {
      title: 'পার্সেল পাঠান',
      pickupLocation: 'পিকআপ লোকেশন',
      deliveryLocation: 'ডেলিভারি লোকেশন',
      parcelOptions: 'পার্সেলের বিবরণ',
      packageInfo: 'প্যাকেজের তথ্য',
      recipientInfo: 'প্রাপক ও প্রেরকের তথ্য',
      selectVehicle: 'বাহন নির্বাচন করুন',
      continue: 'এগিয়ে যান',
      packageDetailsTitle: 'প্যাকেজের তথ্য',
      categoryLabel: 'ধরন',
      weightLabel: 'আনুমানিক ওজন (কেজি)',
      valueLabel: 'আনুমানিক মূল্য (৳)',
      fragileLabel: 'ভঙ্গুর সামগ্রী (সাবধানে হ্যান্ডেল করুন)',
      instructionsLabel: 'রাইডারের জন্য নির্দেশ',
      save: 'সংরক্ষণ করুন',
      recipientScreenTitle: 'প্রেরক ও প্রাপক',
      senderHeader: 'প্রেরক (পিকআপ)',
      recipientHeader: 'প্রাপক (ডেলিভারি)',
      pinLabel: 'ডেলিভারি পিন যাচাইকরণ',
      payerLabel: 'ভাড়া কে পরিশোধ করবে?',
      senderPays: 'প্রেরক',
      recipientPays: 'প্রাপক',
      reviewTitle: 'অর্ডার নিশ্চিতকরণ',
      fareDetails: 'ভাড়ার বিবরণ',
      confirmParcel: 'পার্সেল অর্ডার নিশ্চিত করুন',
    },
  },
};
