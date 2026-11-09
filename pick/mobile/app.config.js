const { expo } = require('./app.json');

module.exports = ({ config }) => {
  const androidGoogleMapsApiKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY;
  const iosGoogleMapsApiKey = process.env.GOOGLE_MAPS_IOS_API_KEY;
  const mapsConfigured = Boolean(androidGoogleMapsApiKey && iosGoogleMapsApiKey);

  return {
    ...config,
    plugins: [
      ...(config.plugins || expo.plugins || []),
      [
        'expo-build-properties',
        {
          android: {
            enableMinifyInReleaseBuilds: false,
          },
        },
      ],
      ...(androidGoogleMapsApiKey || iosGoogleMapsApiKey
        ? [
            [
              'react-native-maps',
              {
                ...(androidGoogleMapsApiKey ? { androidGoogleMapsApiKey } : {}),
                ...(iosGoogleMapsApiKey ? { iosGoogleMapsApiKey } : {}),
              },
            ],
          ]
        : []),
    ],
    extra: {
      ...config.extra,
      googleMapsConfigured: mapsConfigured,
    },
  };
};
