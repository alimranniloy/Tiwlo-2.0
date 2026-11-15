const { expo } = require('./app.json');

module.exports = ({ config }) => {
  return {
    ...config,
    plugins: [
      ...(config.plugins || expo.plugins || []),
      '@maplibre/maplibre-react-native',
      [
        'expo-build-properties',
        {
          android: {
            enableMinifyInReleaseBuilds: false,
          },
        },
      ],
    ],
  };
};
