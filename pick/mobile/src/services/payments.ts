import * as WebBrowser from 'expo-web-browser';
import type { PaymentProviderId } from './orders';

export const PICK_PAYMENT_CALLBACK = 'pick://payment/callback';

const CHECKOUT_HOSTS: Record<PaymentProviderId, string[]> = {
  bkash: ['checkout.pay.bka.sh', 'tokenized.pay.bka.sh', 'payment.bkash.com'],
  sslcommerz: ['securepay.sslcommerz.com']
};

export async function openPickPaymentCheckout(
  checkoutUrl: string,
  provider: PaymentProviderId
) {
  let url: URL;
  try {
    url = new URL(checkoutUrl);
  } catch {
    throw new Error('The payment provider returned an invalid checkout link.');
  }
  if (url.protocol !== 'https:' || !CHECKOUT_HOSTS[provider].includes(url.hostname.toLowerCase())) {
    throw new Error('The payment provider returned an untrusted checkout link.');
  }
  return WebBrowser.openAuthSessionAsync(checkoutUrl, PICK_PAYMENT_CALLBACK);
}
