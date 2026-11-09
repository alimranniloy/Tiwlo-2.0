import { PICK_API_URL } from '../config/api';
import type { BazarCategory, BazarProduct } from '../data/mockData';

export interface CatalogData {
  categories: BazarCategory[];
  products: BazarProduct[];
}

const ALL_CATEGORY: BazarCategory = {
  id: 'all',
  titleEn: 'All',
  titleBn: 'সব'
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requiredString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== 'string') {
    throw new Error(`The catalog response is missing a valid ${key}.`);
  }
  return value;
}

function requiredNumber(record: Record<string, unknown>, key: string): number {
  const value = record[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`The catalog response is missing a valid ${key}.`);
  }
  return value;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function parseCategory(value: unknown): BazarCategory {
  if (!isRecord(value)) throw new Error('The catalog contains an invalid category.');
  return {
    id: requiredString(value, 'id'),
    titleEn: requiredString(value, 'titleEn'),
    titleBn: requiredString(value, 'titleBn')
  };
}

function parseProduct(value: unknown): BazarProduct {
  if (!isRecord(value)) throw new Error('The catalog contains an invalid product.');
  const unit = requiredString(value, 'unit');
  const unitEn = requiredString(value, 'unitEn');
  const rawUnits = value.units;
  const rawUnitsEn = value.unitsEn;
  const units = Array.isArray(rawUnits) && rawUnits.every((item) => typeof item === 'string')
    ? rawUnits
    : [];
  const unitsEn = Array.isArray(rawUnitsEn) && rawUnitsEn.every((item) => typeof item === 'string')
    ? rawUnitsEn
    : [];
  const productUnits = units.length ? units : [unit];
  const productUnitsEn = unitsEn.length ? unitsEn : [unitEn];
  const rawPrices = value.unitPrices;
  const unitPrices = Array.isArray(rawPrices) &&
      rawPrices.every(isFiniteNumber)
    ? rawPrices
    : [];
  const price = requiredNumber(value, 'price');
  const prices = unitPrices.length
    ? unitPrices
    : productUnits.length === 1 && productUnitsEn.length === 1
      ? [price]
      : [];

  if (productUnits.length !== productUnitsEn.length ||
      prices.length !== productUnits.length ||
      prices.some((unitPrice) => unitPrice < 0)) {
    throw new Error('A product has incomplete unit and pricing information.');
  }

  const categoryId = value.categoryId;
  if (categoryId !== null && typeof categoryId !== 'string') {
    throw new Error('The catalog contains a product with an invalid category.');
  }
  const oldPrice = value.oldPrice;
  if (oldPrice !== null && oldPrice !== undefined &&
      (typeof oldPrice !== 'number' || !Number.isFinite(oldPrice))) {
    throw new Error('The catalog contains an invalid previous product price.');
  }

  return {
    id: requiredString(value, 'id'),
    categoryId,
    name: requiredString(value, 'name'),
    nameEn: requiredString(value, 'nameEn'),
    category: typeof value.category === 'string' ? value.category : '',
    categoryEn: typeof value.categoryEn === 'string' ? value.categoryEn : '',
    price,
    oldPrice: oldPrice ?? undefined,
    unit,
    unitEn,
    units: productUnits,
    unitsEn: productUnitsEn,
    unitPrices: prices,
    rating: requiredNumber(value, 'rating'),
    reviews: typeof value.reviews === 'string' ? value.reviews : '',
    origin: typeof value.origin === 'string' ? value.origin : '',
    deliveryTime: typeof value.deliveryTime === 'string' ? value.deliveryTime : '',
    image: requiredString(value, 'image'),
    description: requiredString(value, 'description'),
    descriptionEn: requiredString(value, 'descriptionEn'),
    badge: typeof value.badge === 'string' ? value.badge : undefined,
    inStock: value.inStock === true
  };
}

async function getCatalogResponse(path: string): Promise<unknown> {
  const response = await fetch(`${PICK_API_URL}${path}`);
  const result: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = isRecord(result) && typeof result.error === 'string'
      ? result.error
      : 'Could not load the PICK catalog.';
    throw new Error(message);
  }
  return result;
}

export async function getCatalog(): Promise<CatalogData> {
  const [categoryResponse, productResponse] = await Promise.all([
    getCatalogResponse('/catalog/categories'),
    getCatalogResponse('/catalog/products')
  ]);
  if (!isRecord(categoryResponse) || !Array.isArray(categoryResponse.categories) ||
      !isRecord(productResponse) || !Array.isArray(productResponse.products)) {
    throw new Error('The PICK catalog response has an invalid format.');
  }

  return {
    categories: [
      ALL_CATEGORY,
      ...categoryResponse.categories.map(parseCategory)
    ],
    products: productResponse.products.map(parseProduct)
  };
}
