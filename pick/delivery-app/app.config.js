const appJson = require('./app.json');

module.exports = ({ config }) => {
  const extra = { ...appJson.expo.extra };
  if (process.env.EXPO_PUBLIC_EAS_PROJECT_ID) {
    extra.eas = { projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID };
  }
  return {
    ...config,
    ...appJson.expo,
    extra
  };
};
