function normalizeCountryCodes(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value
    .map(countryCode => String(countryCode || '').trim().toUpperCase())
    .filter(countryCode => /^[A-Z]{2}$/.test(countryCode)))];
}

function matchesCustomer(sale, customer = {}) {
  const email = String(customer.email || '').trim().toLowerCase();
  const phone = String(customer.phone || '').replace(/\D/g, '');
  if (!email && !phone) return false;
  const saleEmail = String(sale.customerEmail || '').trim().toLowerCase();
  const salePhone = String(sale.customerPhone || '').replace(/\D/g, '');
  return Boolean((email && saleEmail === email) || (phone && salePhone === phone));
}

export function getPromotionUsage(sales = [], code, customer = {}) {
  const normalizedCode = String(code || '').trim().toUpperCase();
  const redemptions = (Array.isArray(sales) ? sales : []).filter(sale =>
    String(sale?.promoCode || '').trim().toUpperCase() === normalizedCode
  );
  return {
    total: redemptions.length,
    customer: redemptions.filter(sale => matchesCustomer(sale, customer)).length
  };
}

export function calculatePromotionDiscount(settings = {}, code, subtotal, context = {}) {
  const enteredCode = String(code || '').trim().toUpperCase();
  const configuredCode = String(settings.promoCode || '').trim().toUpperCase();
  const amount = Number(subtotal);
  const discountType = settings.promoDiscountType === 'fixed' ? 'fixed' : 'percent';
  const configuredDiscount = Number(settings.promoDiscountPercent);
  const countryCode = String(context.countryCode || '').trim().toUpperCase();
  const allowedCountries = normalizeCountryCodes(settings.promoAllowedCountries);
  const usageLimit = Number(settings.promoUsageLimit) || 0;
  const perCustomerLimit = Number(settings.promoPerCustomerLimit) || 0;
  const minimumSubtotal = Number(settings.promoMinimumSubtotal) || 0;
  const maximumDiscount = Number(settings.promoMaximumDiscount) || 0;
  const now = Number.isFinite(context.now) ? context.now : Date.now();

  const invalid = (error) => ({ valid: false, discountAmount: 0, error });
  if (!settings.promoActive || !enteredCode || enteredCode !== configuredCode) {
    return invalid('This promotion code is invalid or no longer active.');
  }
  if (!Number.isFinite(amount) || amount < 0 || !Number.isFinite(configuredDiscount) || configuredDiscount <= 0 ||
      (discountType === 'percent' && configuredDiscount > 100)) {
    return invalid('This promotion is not configured correctly.');
  }
  if (Number.isFinite(minimumSubtotal) && amount < minimumSubtotal) {
    return invalid(`This code requires a minimum order of ${minimumSubtotal}.`);
  }
  if (allowedCountries.length && !countryCode) {
    return invalid('Select your delivery country to check this code.');
  }
  if (allowedCountries.length && !allowedCountries.includes(countryCode)) {
    return invalid('This code is not available in your delivery country.');
  }
  const validFrom = settings.promoStartsAt ? Date.parse(settings.promoStartsAt) : NaN;
  const validUntil = settings.promoEndsAt ? Date.parse(settings.promoEndsAt) : NaN;
  if (Number.isFinite(validFrom) && now < validFrom) {
    return invalid('This promotion is not active yet.');
  }
  if (Number.isFinite(validUntil) && now > validUntil) {
    return invalid('This promotion has expired.');
  }
  if (usageLimit > 0 && Number(context.totalRedemptions || 0) >= usageLimit) {
    return invalid('This promotion has reached its redemption limit.');
  }
  if (perCustomerLimit > 0 &&
      Number(context.customerRedemptions || 0) >= perCustomerLimit) {
    return invalid('You have already used this promotion the maximum number of times.');
  }

  const discountAmount = discountType === 'fixed'
    ? configuredDiscount
    : amount * (configuredDiscount / 100);
  const cappedDiscount = Math.min(
    amount,
    maximumDiscount > 0 ? maximumDiscount : Number.POSITIVE_INFINITY,
    discountAmount
  );
  const result = {
    valid: true,
    code: configuredCode,
    discountAmount: Number(cappedDiscount.toFixed(2))
  };
  if (discountType === 'percent') {
    result.discountPercent = configuredDiscount;
  } else {
    result.discountType = discountType;
    result.discountValue = configuredDiscount;
  }
  if (maximumDiscount > 0 && discountAmount > maximumDiscount) result.maximumDiscount = maximumDiscount;
  return result;
}

export function validatePromotionSettings(settings = {}) {
  const errors = [];
  const type = settings.promoDiscountType === undefined ? 'percent' : settings.promoDiscountType;
  if (!['percent', 'fixed'].includes(type)) errors.push('Promotion discount type must be percent or fixed.');
  const discount = Number(settings.promoDiscountPercent);
  if (settings.promoDiscountPercent !== undefined && settings.promoDiscountPercent !== '' &&
      (!Number.isFinite(discount) || discount < 0 || (type === 'percent' && discount > 100))) {
    errors.push(type === 'percent'
      ? 'Promotion discount must be between 0 and 100%.'
      : 'Fixed promotion discount must be a non-negative amount.');
  }
  for (const key of ['promoMinimumSubtotal', 'promoMaximumDiscount']) {
    const value = settings[key];
    if (value !== undefined && value !== '' && (!Number.isFinite(Number(value)) || Number(value) < 0)) {
      errors.push(`${key} must be a valid non-negative amount.`);
    }
  }
  for (const key of ['promoUsageLimit', 'promoPerCustomerLimit']) {
    const value = settings[key];
    if (value !== undefined && value !== '' &&
        (!Number.isInteger(Number(value)) || Number(value) < 0 || Number(value) > 1000000)) {
      errors.push(`${key} must be a whole number from 0 to 1,000,000.`);
    }
  }
  for (const key of ['promoStartsAt', 'promoEndsAt']) {
    const value = settings[key];
    if (value !== undefined && value !== '' && !Number.isFinite(Date.parse(value))) {
      errors.push(`${key} must be a valid date and time.`);
    }
  }
  if (settings.promoStartsAt && settings.promoEndsAt &&
      Date.parse(settings.promoStartsAt) > Date.parse(settings.promoEndsAt)) {
    errors.push('Promotion end time must be after its start time.');
  }
  if (settings.promoAllowedCountries !== undefined && !Array.isArray(settings.promoAllowedCountries)) {
    errors.push('Promotion country restrictions must be a list of ISO country codes.');
  }
  if (Array.isArray(settings.promoAllowedCountries) &&
      settings.promoAllowedCountries.some(countryCode => !/^[A-Z]{2}$/i.test(String(countryCode)))) {
    errors.push('Promotion country restrictions must use valid two-letter ISO country codes.');
  }
  return errors;
}
