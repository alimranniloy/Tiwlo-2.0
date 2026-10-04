const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '..', 'node_modules', 'expo-linear-gradient', 'expo-module.config.json');

if (fs.existsSync(configPath)) {
  try {
    const raw = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(raw);
    let modified = false;

    if (!config.android || !config.android.modules || !config.android.modules.includes('expo.modules.lineargradient.LinearGradientModule')) {
      config.android = config.android || {};
      config.android.modules = ['expo.modules.lineargradient.LinearGradientModule'];
      config.android.modulesClassNames = ['expo.modules.lineargradient.LinearGradientModule'];
      modified = true;
    }

    if (!config.apple || !config.apple.modules) {
      config.apple = { modules: ['LinearGradientModule'] };
      modified = true;
    }

    if (modified) {
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
      console.log('[patch-linear-gradient] Successfully patched expo-linear-gradient config for autolinking.');
    }
  } catch (err) {
    console.warn('[patch-linear-gradient] Warning:', err.message);
  }
}
