export function calculatePromotionDiscount(settings = {}, code, subtotal) {
  const enteredCode = String(code || '').trim().toUpperCase();
  const configuredCode = String(settings.promoCode || '').trim().toUpperCase();
  const amount = Number(subtotal);
  const percent = Number(settings.promoDiscountPercent);

  if (!settings.promoActive || !enteredCode || enteredCode !== configuredCode) {
    return { valid: false, discountAmount: 0 };
  }
  if (!Number.isFinite(amount) || amount < 0 || !Number.isFinite(percent) || percent <= 0 || percent > 100) {
    return { valid: false, discountAmount: 0 };
  }

  return {
    valid: true,
    code: configuredCode,
    discountPercent: percent,
    discountAmount: Number((amount * (percent / 100)).toFixed(2))
  };
}
