import { queryPg } from '../server/db/postgres.js';

export function parseGroceryDeliveryFee(rawFee) {
  if (rawFee === null || rawFee === undefined || !/^\d+(\.\d{1,2})?$/.test(String(rawFee))) {
    return null;
  }
  const fee = Number(rawFee);
  return Number.isFinite(fee) && fee <= 1000000 ? fee : null;
}

export async function getPickGroceryDeliveryFee() {
  const { rows } = await queryPg(
    'SELECT value FROM pick.settings WHERE key = $1 LIMIT 1',
    ['grocery_delivery_fee']
  );
  return parseGroceryDeliveryFee(
    rows[0]?.value ?? process.env.PICK_GROCERY_DELIVERY_FEE
  );
}
