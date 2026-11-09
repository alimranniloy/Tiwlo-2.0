const configuredOrigin = process.env.EXPO_PUBLIC_API_ORIGIN || 'https://tiwlo.com';

export const API_ORIGIN = configuredOrigin.replace(/\/+$/, '');
export const PICK_API_URL = `${API_ORIGIN}/api/pick`;
export const PICK_AUTH_CALLBACK = 'pick://auth/callback';
export const PICK_DELIVERY_AUTH_CALLBACK = 'pickdelivery://auth/callback';
