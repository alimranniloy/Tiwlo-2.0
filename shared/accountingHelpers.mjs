export function amountToCents(value) {
  if (value === null || value === undefined || (typeof value === 'string' && !value.trim())) return null;
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) return null;
  const text = String(value).trim();
  if (text.length > 64) return null;
  const match = text.match(/^\+?(\d+)(?:\.(\d*))?(?:e([+-]?\d+))?$/i);
  if (!match) return null;

  const whole = match[1];
  const fraction = match[2] || '';
  const exponent = Number(match[3] || 0);
  if (!Number.isSafeInteger(exponent) || Math.abs(exponent) > 400) return null;
  const digits = BigInt(`${whole}${fraction}`);
  const decimalPlaces = fraction.length - exponent;
  let cents;
  if (decimalPlaces <= 2) {
    cents = digits * (10n ** BigInt(2 - decimalPlaces));
  } else {
    const divisor = 10n ** BigInt(decimalPlaces - 2);
    const quotient = digits / divisor;
    const remainder = digits % divisor;
    cents = quotient + (remainder * 2n >= divisor ? 1n : 0n);
  }
  const safeCents = Number(cents);
  return Number.isSafeInteger(safeCents) ? safeCents : null;
}

export function sumPaymentCents(payments) {
  if (payments === undefined || payments === null) return 0;
  if (!Array.isArray(payments)) return null;
  let total = 0;
  for (const payment of payments) {
    const amount = amountToCents(payment?.amount);
    if (amount === null || !Number.isSafeInteger(total + amount)) return null;
    total += amount;
  }
  return total;
}

export function calculatePercentageCents(amountCents, percentage) {
  if (!Number.isSafeInteger(amountCents) || amountCents < 0) return null;
  const rate = Number(percentage);
  if (!Number.isFinite(rate) || rate < 0) return null;
  const match = String(percentage).trim().match(/^(\d+)(?:\.(\d*))?(?:e([+-]?\d+))?$/i);
  if (!match) return null;
  const decimalPlaces = (match[2] || '').length - Number(match[3] || 0);
  if (!Number.isSafeInteger(decimalPlaces) || Math.abs(decimalPlaces) > 400) return null;
  const numerator = BigInt(`${match[1]}${match[2] || ''}`);
  const denominator = 100n * (decimalPlaces > 0 ? 10n ** BigInt(decimalPlaces) : 1n);
  const scaledNumerator = decimalPlaces < 0
    ? numerator * 10n ** BigInt(-decimalPlaces)
    : numerator;
  const centsNumerator = BigInt(amountCents) * scaledNumerator;
  const rounded = (centsNumerator * 2n + denominator) / (2n * denominator);
  const safeCents = Number(rounded);
  return Number.isSafeInteger(safeCents) ? safeCents : null;
}

export function calculateAccountBalance(totalCents, paidCents, creditCents = 0) {
  if (![totalCents, paidCents, creditCents].every(value => Number.isSafeInteger(value) && value >= 0)) {
    return null;
  }
  const dueCents = Math.max(0, totalCents - paidCents - creditCents);
  const creditBalanceCents = Math.max(0, creditCents - Math.max(0, totalCents - paidCents));
  const paymentStatus = paidCents >= totalCents
    ? 'Paid'
    : creditCents > 0 && dueCents === 0
      ? 'Credited'
      : paidCents + creditCents > 0
        ? 'Partial'
        : 'Unpaid';
  return { dueCents, creditBalanceCents, paymentStatus };
}

export function calculateInventoryValuation(products) {
  if (!Array.isArray(products)) return null;
  let totalUnits = 0;
  let retailValueCents = 0;
  let costValueCents = 0;
  let unvaluedProductCount = 0;

  for (const product of products) {
    const stock = Number(product?.stock ?? 0);
    const retailUnitCents = amountToCents(product?.price ?? 0);
    if (!Number.isSafeInteger(stock) || stock < 0 || retailUnitCents === null ||
        !Number.isSafeInteger(totalUnits + stock)) return null;
    const retailLineCents = stock * retailUnitCents;
    if (!Number.isSafeInteger(retailLineCents) ||
        !Number.isSafeInteger(retailValueCents + retailLineCents)) return null;
    totalUnits += stock;
    retailValueCents += retailLineCents;

    const costUnitCents = amountToCents(product?.costPrice);
    if (costUnitCents === null) {
      if (stock > 0) unvaluedProductCount += 1;
      continue;
    }
    const costLineCents = stock * costUnitCents;
    if (!Number.isSafeInteger(costLineCents) ||
        !Number.isSafeInteger(costValueCents + costLineCents)) return null;
    costValueCents += costLineCents;
  }

  const isCostValuationComplete = unvaluedProductCount === 0;
  const potentialProfitCents = isCostValuationComplete
    ? retailValueCents - costValueCents
    : null;
  if (potentialProfitCents !== null && !Number.isSafeInteger(potentialProfitCents)) return null;
  return {
    totalUnits,
    retailValueCents,
    costValueCents: isCostValuationComplete ? costValueCents : null,
    potentialProfitCents,
    marginPercent: isCostValuationComplete && retailValueCents > 0
      ? Math.round((potentialProfitCents / retailValueCents) * 10000) / 100
      : null,
    unvaluedProductCount,
    isCostValuationComplete
  };
}

export function reverseOrderInventory(products, items) {
  if (!Array.isArray(products) || !Array.isArray(items) || items.length === 0) return null;
  const nextProducts = products.map(product => ({ ...product }));
  const changedProductIds = new Set();

  for (const item of items) {
    const product = nextProducts.find(entry => entry.id === item?.productId);
    const quantity = Number(item?.quantity);
    const stock = Number(product?.stock ?? 0);
    const sold = Number(product?.sold ?? 0);
    const revenueCents = amountToCents(product?.revenue ?? 0);
    const unitPriceCents = amountToCents(item?.unitPrice);
    const itemTotalCents = item?.total === null || item?.total === undefined
      ? (unitPriceCents === null ? null : unitPriceCents * quantity)
      : amountToCents(item.total);

    if (!product || !Number.isSafeInteger(quantity) || quantity <= 0 ||
        !Number.isSafeInteger(stock) || stock < 0 ||
        !Number.isSafeInteger(sold) || sold < 0 ||
        revenueCents === null || itemTotalCents === null ||
        !Number.isSafeInteger(itemTotalCents) || itemTotalCents < 0 ||
        !Number.isSafeInteger(stock + quantity)) {
      return null;
    }

    product.stock = stock + quantity;
    product.sold = Math.max(0, sold - quantity);
    product.revenue = Math.max(0, revenueCents - itemTotalCents) / 100;
    changedProductIds.add(product.id);
  }

  return { products: nextProducts, changedProductIds: [...changedProductIds] };
}
