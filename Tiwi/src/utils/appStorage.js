import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * 100% Fail-Safe Persistent Storage for Tiwi
 * Backed by @react-native-async-storage/async-storage with an in-memory fallback.
 * Guaranteed never to crash the app or throw unhandled native/JS exceptions.
 */

const memoryFallback = new Map();
let isNativeStorageFunctional = true;

export const AppStorage = {
  async getItem(key) {
    if (!key) return null;
    if (isNativeStorageFunctional && AsyncStorage && typeof AsyncStorage.getItem === 'function') {
      try {
        const val = await AsyncStorage.getItem(key);
        if (val !== null && val !== undefined) return val;
      } catch (err) {
        console.warn('[AppStorage.getItem native error, falling back to memory]:', err);
        isNativeStorageFunctional = false;
      }
    }
    return memoryFallback.has(key) ? memoryFallback.get(key) : null;
  },

  async setItem(key, value) {
    if (!key) return;
    const strVal = String(value);
    memoryFallback.set(key, strVal);
    if (isNativeStorageFunctional && AsyncStorage && typeof AsyncStorage.setItem === 'function') {
      try {
        await AsyncStorage.setItem(key, strVal);
      } catch (err) {
        console.warn('[AppStorage.setItem native error, continuing with memory]:', err);
        isNativeStorageFunctional = false;
      }
    }
  },

  async removeItem(key) {
    if (!key) return;
    memoryFallback.delete(key);
    if (isNativeStorageFunctional && AsyncStorage && typeof AsyncStorage.removeItem === 'function') {
      try {
        await AsyncStorage.removeItem(key);
      } catch (err) {
        console.warn('[AppStorage.removeItem native error]:', err);
        isNativeStorageFunctional = false;
      }
    }
  },

  async clear() {
    memoryFallback.clear();
    if (isNativeStorageFunctional && AsyncStorage && typeof AsyncStorage.clear === 'function') {
      try {
        await AsyncStorage.clear();
      } catch (err) {
        console.warn('[AppStorage.clear native error]:', err);
        isNativeStorageFunctional = false;
      }
    }
  },
};

export default AppStorage;
