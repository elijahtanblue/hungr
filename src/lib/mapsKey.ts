type MapsKeyEnv = Record<string, string | undefined>;

export function getMapsSdkKey(platform: string, env: MapsKeyEnv = process.env): string {
  if (platform === "web") {
    return env.EXPO_PUBLIC_WEB_MAPS_SDK_KEY || env.EXPO_PUBLIC_MAPS_SDK_KEY || "";
  }

  return env.EXPO_PUBLIC_MAPS_SDK_KEY || "";
}
