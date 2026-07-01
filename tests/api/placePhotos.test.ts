import AsyncStorage from "@react-native-async-storage/async-storage";
import { clearPhotoUriCacheForTests, getPhotoUri } from "../../src/api/placePhotos";
import { supabase } from "../../src/lib/supabase";

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));
jest.mock("../../src/lib/supabase", () => ({
  supabase: { functions: { invoke: jest.fn() } },
}));

beforeEach(() => {
  jest.clearAllMocks();
  clearPhotoUriCacheForTests();
});

test("getPhotoUri resolves a name and serves repeats from cache", async () => {
  (supabase.functions.invoke as jest.Mock).mockResolvedValue({ data: { uri: "https://lh3/x.jpg" }, error: null });

  expect(await getPhotoUri("places/p1/photos/ref-a")).toBe("https://lh3/x.jpg");
  // Second call for the same name must not hit the network again.
  expect(await getPhotoUri("places/p1/photos/ref-a")).toBe("https://lh3/x.jpg");
  expect(supabase.functions.invoke).toHaveBeenCalledTimes(1);
});

test("getPhotoUri shares a concurrent lookup for the same photo", async () => {
  (supabase.functions.invoke as jest.Mock).mockResolvedValue({ data: { uri: "https://lh3/shared.jpg" }, error: null });

  await expect(Promise.all([
    getPhotoUri("places/p1/photos/ref-shared"),
    getPhotoUri("places/p1/photos/ref-shared"),
  ])).resolves.toEqual(["https://lh3/shared.jpg", "https://lh3/shared.jpg"]);
  expect(supabase.functions.invoke).toHaveBeenCalledTimes(1);
});

test("getPhotoUri serves a fresh 24 hour persisted cache entry", async () => {
  jest.spyOn(Date, "now").mockReturnValue(new Date("2026-06-30T00:00:00Z").getTime());
  (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify({
    uri: "https://cached/photo.jpg",
    expiresAt: new Date("2026-06-30T23:59:00Z").getTime(),
  }));

  await expect(getPhotoUri("places/p2/photos/ref-b")).resolves.toBe("https://cached/photo.jpg");
  expect(supabase.functions.invoke).not.toHaveBeenCalled();
  jest.restoreAllMocks();
});

test("getPhotoUri refreshes expired persisted cache entries and stores the new 24 hour expiry", async () => {
  jest.spyOn(Date, "now").mockReturnValue(new Date("2026-06-30T00:00:00Z").getTime());
  (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify({
    uri: "https://old/photo.jpg",
    expiresAt: new Date("2026-06-29T23:59:00Z").getTime(),
  }));
  (supabase.functions.invoke as jest.Mock).mockResolvedValue({ data: { uri: "https://new/photo.jpg" }, error: null });

  await expect(getPhotoUri("places/p3/photos/ref-c")).resolves.toBe("https://new/photo.jpg");
  expect(AsyncStorage.setItem).toHaveBeenCalledWith(
    "hungr:google-photo:places%2Fp3%2Fphotos%2Fref-c:600",
    JSON.stringify({ uri: "https://new/photo.jpg", expiresAt: new Date("2026-07-01T00:00:00Z").getTime() }),
  );
  jest.restoreAllMocks();
});

test("getPhotoUri returns null on error", async () => {
  (supabase.functions.invoke as jest.Mock).mockResolvedValue({ data: null, error: new Error("down") });
  expect(await getPhotoUri("places/p9/photos/ref-z")).toBeNull();
});
