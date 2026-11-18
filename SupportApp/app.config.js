const appJson = require('./app.json');
const siteConfig = require('./config.json');

module.exports = ({ config }) => {
  const extra = {
    ...(appJson.expo.extra || {}),
    siteConfig
  };
  if (process.env.EXPO_PUBLIC_EAS_PROJECT_ID) {
    extra.eas = { projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID };
  }
  return {
    ...config,
    ...appJson.expo,
    name: siteConfig.appName || appJson.expo.name,
    scheme: siteConfig.appScheme || appJson.expo.scheme,
    extra
  };
};
