import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractSessionClientMetadata,
  hashSessionIdentifier,
  summarizeSessionDevice
} from './sessionMetadata.js';

test('summarizeSessionDevice identifies PICK mobile devices, standard mobile browsers, and desktop browsers', () => {
  const pickAndroid = summarizeSessionDevice(
    'PICK/1.0.2 (Android 14; Samsung SM-S918B) Mobile',
    'Samsung SM-S918B',
    'PICK App'
  );
  assert.equal(pickAndroid.platform, 'mobile');
  assert.equal(pickAndroid.appName, 'PICK App');
  assert.match(pickAndroid.device, /Samsung SM-S918B/);
  assert.equal(pickAndroid.os, 'Android 14');

  const mobileWeb = summarizeSessionDevice(
    'Mozilla/5.0 (Linux; Android 13; SM-A536E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36'
  );
  assert.equal(mobileWeb.platform, 'mobile');
  assert.equal(mobileWeb.browser, 'Chrome');
  assert.equal(mobileWeb.os, 'Android 13');
  assert.match(mobileWeb.device, /SM-A536E/);

  const desktopWeb = summarizeSessionDevice(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
  );
  assert.equal(desktopWeb.platform, 'desktop');
  assert.equal(desktopWeb.appName, 'Tiwlo Web');
  assert.equal(desktopWeb.device, 'Chrome on Windows 10/11');
});

test('extractSessionClientMetadata reads forwarded IP and mobile headers cleanly', () => {
  const meta = extractSessionClientMetadata({
    ip: '103.145.12.88',
    headers: {
      'user-agent': 'PICK/1.0.2 (Android 14; Xiaomi 23049PCD8G) Mobile',
      'x-device-name': 'Xiaomi 23049PCD8G',
      'x-app-name': 'PICK App'
    }
  });
  assert.equal(meta.ip, '103.145.12.88');
  assert.equal(meta.deviceName, 'Xiaomi 23049PCD8G');
  assert.equal(meta.appName, 'PICK App');
  assert.equal(hashSessionIdentifier('abc').length, 24);
});
