export const PARCEL_CATEGORIES = [
  { id: 'docs', en: 'Documents & files', bn: 'কাগজপত্র ও ফাইল' },
  { id: 'gadgets', en: 'Electronics', bn: 'ইলেকট্রনিক্স' },
  { id: 'clothes', en: 'Clothes & gifts', bn: 'পোশাক ও উপহার' },
  { id: 'fragile', en: 'Fragile items', bn: 'ভঙ্গুর সামগ্রী' },
  { id: 'box', en: 'Box or carton', bn: 'কার্টন ও বক্স' },
];

export const getParcelCategoryName = (categoryId: string, language: 'en' | 'bn') => {
  const category = PARCEL_CATEGORIES.find((item) => item.id === categoryId);
  return category ? (language === 'en' ? category.en : category.bn) : '';
};
