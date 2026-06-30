const { withPodfileProperties } = require("expo/config-plugins");

function withHungrIosBuildSettings(config) {
  return withPodfileProperties(config, (conf) => {
    conf.modResults["ios.buildReactNativeFromSource"] = "true";
    return conf;
  });
}

module.exports = ({ config }) => {
  const plugins = (config.plugins || []).filter((plugin) => {
    const name = Array.isArray(plugin) ? plugin[0] : plugin;
    return name !== "react-native-maps";
  });

  return withHungrIosBuildSettings({
    ...config,
    plugins: [
      ...plugins,
      [
        "react-native-maps",
        {
          iosGoogleMapsApiKey: process.env.EXPO_PUBLIC_MAPS_SDK_KEY,
        },
      ],
    ],
  });
};
