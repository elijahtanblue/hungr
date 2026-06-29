// Injects the restricted iOS Google Maps SDK key into native config at build time.
// Without ios.config.googleMapsApiKey, react-native-maps with PROVIDER_GOOGLE renders blank.
module.exports = ({ config }) => ({
  ...config,
  ios: {
    ...config.ios,
    config: {
      ...(config.ios && config.ios.config),
      googleMapsApiKey: process.env.EXPO_PUBLIC_MAPS_SDK_KEY,
    },
  },
});
