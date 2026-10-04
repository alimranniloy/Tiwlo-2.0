const fs = require('fs');
const path = require('path');
const screensDir = './Tiwi/src/screens';

const checked = new Set([
  'LivePollsScreen.js',
  'CreatorTiersScreen.js',
  'CustomListsScreen.js',
  'DraftsSchedulerScreen.js',
  'BioLinkBuilderScreen.js',
  'SocialWalletScreen.js',
  'DeviceSessionsScreen.js',
  'BrandMarketplaceScreen.js',
  'CoAuthorScreen.js',
  'CommunityCirclesScreen.js',
  'EventsHubScreen.js',
  'LiveAudioSpaceScreen.js'
]);

const files = fs.readdirSync(screensDir).filter(f => f.endsWith('.js') && !checked.has(f));

console.log('Scanning remaining ' + files.length + ' screens for hardcoded objects/arrays...');

files.forEach(f => {
  const content = fs.readFileSync(path.join(screensDir, f), 'utf8');
  const lines = content.split('\n');
  lines.forEach((l, idx) => {
    if (/id:\s*['"][a-zA-Z0-9_-]+['"]/.test(l)) {
      // ignore simple string constants or non-dummy ids
      if (!l.includes('userId') && !l.includes('authorId') && !l.includes('tiwi_id')) {
        console.log(f + ':' + (idx+1) + ' -> ' + l.trim());
      }
    }
  });
});
