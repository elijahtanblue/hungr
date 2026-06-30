import { getMapsSdkKey } from "../../src/lib/mapsKey";

test("web uses the dedicated web maps key when it is set", () => {
  const key = getMapsSdkKey("web", {
    EXPO_PUBLIC_MAPS_SDK_KEY: "ios-key",
    EXPO_PUBLIC_WEB_MAPS_SDK_KEY: "web-key",
  });

  expect(key).toBe("web-key");
});

test("web falls back to the native maps key for simple local setup", () => {
  const key = getMapsSdkKey("web", {
    EXPO_PUBLIC_MAPS_SDK_KEY: "ios-key",
  });

  expect(key).toBe("ios-key");
});

test("native uses the maps SDK key", () => {
  const key = getMapsSdkKey("ios", {
    EXPO_PUBLIC_MAPS_SDK_KEY: "ios-key",
    EXPO_PUBLIC_WEB_MAPS_SDK_KEY: "web-key",
  });

  expect(key).toBe("ios-key");
});
