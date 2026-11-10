import test from 'node:test';
import assert from 'node:assert/strict';
import {
  comparePickAppVersions,
  getPickAppUpdateTarget,
  normalizePickAppUpdateSettings,
  validatePickPlayStoreUrl
} from './appUpdates.js';

test('compares app version segments without requesting updates for the same version', () => {
  assert.equal(comparePickAppVersions('1.2.0', '1.2'), 0);
  assert.equal(comparePickAppVersions('1.2.0', '1.2.1'), -1);
  assert.equal(comparePickAppVersions('1.3', '1.2.9'), 1);
  assert.equal(comparePickAppVersions('invalid', '1.0'), null);
});

test('only exposes update targets for the two published Android apps', () => {
  assert.equal(getPickAppUpdateTarget('pick').packageName, 'com.pick.tiwlo');
  assert.equal(getPickAppUpdateTarget('delivery').packageName, 'com.pick.delivery');
  assert.equal(getPickAppUpdateTarget('merchant'), null);
});

test('accepts only HTTPS Play Store URLs for the matching app package', () => {
  assert.equal(
    validatePickPlayStoreUrl(
      'https://play.google.com/store/apps/details?id=com.pick.tiwlo',
      'pick'
    ),
    'https://play.google.com/store/apps/details?id=com.pick.tiwlo'
  );
  assert.equal(
    validatePickPlayStoreUrl(
      'https://play.google.com/store/apps/details?id=com.pick.delivery',
      'pick'
    ),
    null
  );
  assert.equal(
    validatePickPlayStoreUrl('https://example.com/store?id=com.pick.tiwlo', 'pick'),
    null
  );
});

test('normalizes empty app-update settings and rejects malformed persisted data', () => {
  assert.deepEqual(normalizePickAppUpdateSettings(null), {
    version: '',
    playStoreEnabled: false,
    playStoreUrl: '',
    apkPath: null
  });
  assert.throws(() => normalizePickAppUpdateSettings('{bad json'), SyntaxError);
  assert.throws(() => normalizePickAppUpdateSettings({
    version: 'one',
    playStoreEnabled: false,
    playStoreUrl: '',
    apkPath: null
  }), /settings are invalid/);
});
