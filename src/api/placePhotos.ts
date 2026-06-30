import { supabase } from "../lib/supabase";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Resolves a Google photo resource name to a live, key-less image URL via the place-photo function.
// Cached for 24 hours as a display URL only. We never store the image bytes, consistent with
// displaying Google content live.
const TTL_MS = 24 * 60 * 60 * 1000;
const cache = new Map<string, { uri: string; expiresAt: number }>();

function cacheKey(name: string, maxWidth: number): string {
  return `hungr:google-photo:${encodeURIComponent(name)}:${maxWidth}`;
}

export function clearPhotoUriCacheForTests() {
  cache.clear();
}

async function readPersisted(key: string): Promise<{ uri: string; expiresAt: number } | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.uri !== "string" || typeof parsed?.expiresAt !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function getPhotoUri(name: string, maxWidth = 600): Promise<string | null> {
  const key = cacheKey(name, maxWidth);
  const now = Date.now();
  const cached = cache.get(key);
  if (cached && cached.expiresAt > now) return cached.uri;

  const persisted = await readPersisted(key);
  if (persisted && persisted.expiresAt > now) {
    cache.set(key, persisted);
    return persisted.uri;
  }

  const { data, error } = await supabase.functions.invoke("place-photo", { body: { name, maxWidth } });
  const uri = data?.uri;
  if (error || typeof uri !== "string") return null;
  const entry = { uri, expiresAt: now + TTL_MS };
  cache.set(key, entry);
  try {
    await AsyncStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // Memory cache is enough when storage is unavailable.
  }
  return uri;
}
