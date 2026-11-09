import { PICK_API_URL } from '../config/api';
import { getPickAccessToken } from './auth';

export interface CartEntry {
  productId: string;
  unitIndex: number;
  quantity: number;
}

export type PaymentProviderId = 'bkash' | 'sslcommerz';
export type PaymentMethod = 'cod' | PaymentProviderId;

export interface PaymentProvider {
  id: PaymentProviderId;
  name: string;
  currency: 'BDT';
}

export interface OrderSubmission extends PickOrder {
  checkoutUrl?: string;
  expiresAt?: string;
}

export interface PickOrderItem {
  id: string;
  productId: string | null;
  nameEn: string;
  nameBn: string;
  unitEn: string;
  unitBn: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface PickOrder {
  id: string;
  orderType: 'grocery' | 'parcel';
  status: string;
  deliveryAddress: string;
  subtotal: number;
  deliveryFee: number;
  total: number;
  paymentMethod: string;
  paymentStatus: string;
  paymentProvider: string | null;
  paymentExpiresAt?: string | null;
  createdAt: string;
  items: PickOrderItem[];
  parcelDetails?: {
    sender?: { name?: string; phone?: string; address?: string; floor?: string };
    recipient?: { name?: string; phone?: string; address?: string; floor?: string };
    package?: { categoryName?: string; weight?: number; declaredValue?: number };
    vehicle?: { id?: string; nameEn?: string; nameBn?: string };
  };
}

async function authenticatedRequest(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await getPickAccessToken();
  if (!token) throw new Error('Sign in with Tiwlo to continue.');
  return fetch(`${PICK_API_URL}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      Authorization: `Bearer ${token}`,
      ...init.headers
    }
  });
}

async function readResponse(response: Response): Promise<Record<string, unknown>> {
  const value: unknown = await response.json().catch(() => null);
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('The PICK server returned an invalid response.');
  }
  const result = value as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(typeof result.error === 'string' ? result.error : 'The PICK request failed.');
  }
  return result;
}

function numberValue(value: unknown, field: string): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`The PICK order is missing a valid ${field}.`);
  return parsed;
}

function parseOrder(value: unknown): PickOrder {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('The PICK order response contains an invalid order.');
  }
  const order = value as Record<string, unknown>;
  if (typeof order.id !== 'string' ||
      typeof order.status !== 'string' ||
      typeof order.deliveryAddress !== 'string' ||
      typeof order.createdAt !== 'string' ||
      (order.orderType !== 'grocery' && order.orderType !== 'parcel') ||
      (order.items !== undefined && !Array.isArray(order.items))) {
    throw new Error('The PICK order response is missing required order fields.');
  }
  const items = (Array.isArray(order.items) ? order.items : []).map((value): PickOrderItem => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error('The PICK order contains an invalid item.');
    }
    const item = value as Record<string, unknown>;
    if (typeof item.nameEn !== 'string' || typeof item.nameBn !== 'string' ||
        typeof item.unitEn !== 'string' || typeof item.unitBn !== 'string') {
      throw new Error('The PICK order item is missing its product details.');
    }
    return {
      id: typeof item.id === 'string' ? item.id : '',
      productId: typeof item.productId === 'string' ? item.productId : null,
      nameEn: item.nameEn,
      nameBn: item.nameBn,
      unitEn: item.unitEn,
      unitBn: item.unitBn,
      quantity: numberValue(item.quantity, 'item quantity'),
      unitPrice: numberValue(item.unitPrice, 'item price'),
      lineTotal: numberValue(item.lineTotal, 'item total')
    };
  });
  return {
    id: order.id,
    orderType: order.orderType,
    status: order.status,
    deliveryAddress: order.deliveryAddress,
    subtotal: numberValue(order.subtotal, 'subtotal'),
    deliveryFee: numberValue(order.deliveryFee, 'delivery fee'),
    total: numberValue(order.total, 'total'),
    paymentMethod: typeof order.paymentMethod === 'string' ? order.paymentMethod : '',
    paymentStatus: typeof order.paymentStatus === 'string' ? order.paymentStatus : 'unpaid',
    paymentProvider: typeof order.paymentProvider === 'string' ? order.paymentProvider : null,
    paymentExpiresAt: typeof order.paymentExpiresAt === 'string' ? order.paymentExpiresAt : null,
    createdAt: order.createdAt,
    items,
    ...(order.parcelDetails && typeof order.parcelDetails === 'object'
      ? { parcelDetails: order.parcelDetails as PickOrder['parcelDetails'] }
      : {})
  };
}

export async function getOrders(): Promise<PickOrder[]> {
  const result = await readResponse(await authenticatedRequest('/orders'));
  if (!Array.isArray(result.orders)) throw new Error('The PICK order response is invalid.');
  return result.orders.map(parseOrder);
}

export async function getGroceryDeliveryFee(): Promise<number> {
  const result = await readResponse(await authenticatedRequest('/checkout/config'));
  if (typeof result.deliveryFee !== 'number' || !Number.isFinite(result.deliveryFee)) {
    throw new Error('The PICK server returned an invalid delivery fee.');
  }
  return result.deliveryFee;
}

export async function getPaymentProviders(): Promise<PaymentProvider[]> {
  const result = await readResponse(await authenticatedRequest('/payments/providers'));
  if (!Array.isArray(result.providers)) throw new Error('The payment provider response is invalid.');
  return result.providers.map((value): PaymentProvider => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error('The payment provider response contains an invalid entry.');
    }
    const provider = value as Record<string, unknown>;
    if ((provider.id !== 'bkash' && provider.id !== 'sslcommerz') ||
        typeof provider.name !== 'string' || provider.currency !== 'BDT') {
      throw new Error('The payment provider response is missing required details.');
    }
    return { id: provider.id, name: provider.name, currency: 'BDT' };
  });
}

export async function createGroceryOrder(
  items: CartEntry[],
  paymentMethod: PaymentMethod
): Promise<OrderSubmission> {
  const result = await readResponse(await authenticatedRequest('/orders', {
    method: 'POST',
    body: JSON.stringify({ items, paymentMethod })
  }));
  if (!result.order || typeof result.order !== 'object') {
    throw new Error('The PICK server did not confirm the order.');
  }
  return {
    ...parseOrder(result.order),
    ...(typeof result.checkoutUrl === 'string' ? { checkoutUrl: result.checkoutUrl } : {}),
    ...(typeof result.expiresAt === 'string' ? { expiresAt: result.expiresAt } : {})
  };
}
