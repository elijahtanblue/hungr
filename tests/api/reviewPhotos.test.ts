import { moderateAndAttachReviewPhoto } from "../../src/api/reviewPhotos";
import { supabase } from "../../src/lib/supabase";
import { readAsStringAsync } from "expo-file-system/legacy";

jest.mock("expo-file-system/legacy", () => ({ readAsStringAsync: jest.fn() }));
jest.mock("expo-image-manipulator", () => ({
  SaveFormat: { JPEG: "jpeg" },
  manipulateAsync: jest.fn(),
}), { virtual: true });

jest.mock("../../src/lib/supabase", () => ({
  supabase: {
    auth: { getUser: jest.fn() },
    storage: { from: jest.fn() },
    functions: { invoke: jest.fn() },
  },
}));

const { manipulateAsync } = require("expo-image-manipulator");
const b64 = (text: string) => Buffer.from(text).toString("base64");
const bytesToText = (bytes: Uint8Array) => Buffer.from(bytes).toString("utf8");

beforeEach(() => {
  jest.clearAllMocks();
});

test("moderateAndAttachReviewPhoto uploads the decoded photo bytes then asks the edge function to moderate and attach", async () => {
  jest.spyOn(Date, "now").mockReturnValue(new Date("2026-06-30T00:00:00Z").getTime());
  (supabase.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
  const upload = jest.fn().mockResolvedValue({ data: { path: "u1/r1/1782777600000-food.jpg" }, error: null });
  (supabase.storage.from as jest.Mock).mockReturnValue({ upload });
  (supabase.functions.invoke as jest.Mock).mockResolvedValue({
    data: { approved: true, photoId: "ph1" },
    error: null,
  });

  await expect(moderateAndAttachReviewPhoto("p1", "r1", {
    uri: "file:///tmp/food.jpg",
    fileName: "food.jpg",
    mimeType: "image/jpeg",
    base64: b64("real-jpeg-bytes"),
    width: 800,
    height: 600,
  })).resolves.toEqual({ approved: true, photoId: "ph1" });

  // Uploads raw bytes (not a React Native Blob, which uploads as 0 bytes).
  const uploadedBody = upload.mock.calls[0][1];
  expect(uploadedBody).toBeInstanceOf(Uint8Array);
  expect(bytesToText(uploadedBody)).toBe("real-jpeg-bytes");
  expect(upload.mock.calls[0][0]).toMatch(/^u1\/r1\/1782777600000-[a-z0-9]+-food\.jpg$/);
  expect(upload.mock.calls[0][2]).toEqual({ contentType: "image/jpeg", upsert: false });
  expect(supabase.functions.invoke).toHaveBeenCalledWith("review-photo-moderate", {
    body: {
      placeId: "p1",
      reviewId: "r1",
      path: upload.mock.calls[0][0],
      width: 800,
      height: 600,
    },
  });
  jest.restoreAllMocks();
});

test("moderateAndAttachReviewPhoto generates unique storage paths for repeated filenames", async () => {
  jest.spyOn(Date, "now").mockReturnValue(new Date("2026-06-30T00:00:00Z").getTime());
  (supabase.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
  const upload = jest.fn().mockResolvedValue({ data: {}, error: null });
  (supabase.storage.from as jest.Mock).mockReturnValue({ upload });
  (supabase.functions.invoke as jest.Mock).mockResolvedValue({ data: { approved: true }, error: null });

  await Promise.all([
    moderateAndAttachReviewPhoto("p1", "r1", { uri: "file:///tmp/food-a.jpg", fileName: "food.jpg", base64: b64("a") }),
    moderateAndAttachReviewPhoto("p1", "r1", { uri: "file:///tmp/food-b.jpg", fileName: "food.jpg", base64: b64("b") }),
  ]);

  const paths = upload.mock.calls.map((call) => call[0]);
  expect(new Set(paths).size).toBe(2);
  expect(paths[0]).toMatch(/^u1\/r1\/1782777600000-[a-z0-9]+-food\.jpg$/);
  expect(paths[1]).toMatch(/^u1\/r1\/1782777600000-[a-z0-9]+-food\.jpg$/);
  jest.restoreAllMocks();
});

test("moderateAndAttachReviewPhoto converts iOS HEIC assets to JPEG before upload", async () => {
  jest.spyOn(Date, "now").mockReturnValue(new Date("2026-06-30T00:00:00Z").getTime());
  (supabase.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
  (manipulateAsync as jest.Mock).mockResolvedValue({
    uri: "file:///cache/converted.jpg",
    fileName: "converted.jpg",
    mimeType: "image/jpeg",
    base64: b64("jpeg-from-heic"),
    width: 1600,
    height: 1200,
  });
  const upload = jest.fn().mockResolvedValue({ data: {}, error: null });
  (supabase.storage.from as jest.Mock).mockReturnValue({ upload });
  (supabase.functions.invoke as jest.Mock).mockResolvedValue({ data: { approved: true }, error: null });

  await expect(moderateAndAttachReviewPhoto("p1", "r1", {
    uri: "file:///tmp/IMG_0001.HEIC",
    fileName: "IMG_0001.HEIC",
    mimeType: "image/heic",
    base64: b64("heic"),
  })).resolves.toEqual({ approved: true });

  expect(manipulateAsync).toHaveBeenCalledWith("file:///tmp/IMG_0001.HEIC", [], {
    compress: 0.86,
    format: "jpeg",
    base64: true,
  });
  expect(upload.mock.calls[0][0]).toMatch(/^u1\/r1\/1782777600000-[a-z0-9]+-img_0001\.jpg$/);
  expect(bytesToText(upload.mock.calls[0][1])).toBe("jpeg-from-heic");
  expect(upload.mock.calls[0][2]).toEqual({ contentType: "image/jpeg", upsert: false });
  expect(supabase.functions.invoke).toHaveBeenCalledWith("review-photo-moderate", {
    body: {
      placeId: "p1",
      reviewId: "r1",
      path: upload.mock.calls[0][0],
      width: 1600,
      height: 1200,
    },
  });
  jest.restoreAllMocks();
});

test("moderateAndAttachReviewPhoto treats HEICF filenames as iOS HEIC-family assets", async () => {
  (supabase.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
  (manipulateAsync as jest.Mock).mockResolvedValue({
    uri: "file:///cache/converted.jpg",
    base64: b64("converted-heicf"),
    width: 800,
    height: 600,
  });
  const upload = jest.fn().mockResolvedValue({ data: {}, error: null });
  (supabase.storage.from as jest.Mock).mockReturnValue({ upload });
  (supabase.functions.invoke as jest.Mock).mockResolvedValue({ data: { approved: true }, error: null });

  await moderateAndAttachReviewPhoto("p1", "r1", {
    uri: "file:///tmp/IMG_0002.HEICF",
    fileName: "IMG_0002.HEICF",
    base64: b64("heicf"),
  });

  expect(manipulateAsync).toHaveBeenCalled();
  expect(upload.mock.calls[0][2]).toEqual({ contentType: "image/jpeg", upsert: false });
});

test("moderateAndAttachReviewPhoto normalizes converted JPEG assets with HEIC filenames", async () => {
  jest.spyOn(Date, "now").mockReturnValue(new Date("2026-06-30T00:00:00Z").getTime());
  (supabase.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
  const upload = jest.fn().mockResolvedValue({ data: {}, error: null });
  (supabase.storage.from as jest.Mock).mockReturnValue({ upload });
  (supabase.functions.invoke as jest.Mock).mockResolvedValue({ data: { approved: true }, error: null });

  await moderateAndAttachReviewPhoto("p1", "r1", {
    uri: "file:///tmp/IMG_0001.HEIC",
    fileName: "IMG_0001.HEIC",
    mimeType: "image/jpeg",
    base64: b64("converted"),
  });

  expect(upload.mock.calls[0][0]).toMatch(/^u1\/r1\/1782777600000-[a-z0-9]+-img_0001\.jpg$/);
  jest.restoreAllMocks();
});

test("moderateAndAttachReviewPhoto falls back to reading the file from disk when the picker omits base64", async () => {
  jest.spyOn(Date, "now").mockReturnValue(new Date("2026-06-30T00:00:00Z").getTime());
  (supabase.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
  (readAsStringAsync as jest.Mock).mockResolvedValue(b64("disk-jpeg-bytes"));
  const upload = jest.fn().mockResolvedValue({ data: {}, error: null });
  (supabase.storage.from as jest.Mock).mockReturnValue({ upload });
  (supabase.functions.invoke as jest.Mock).mockResolvedValue({ data: { approved: true }, error: null });

  await moderateAndAttachReviewPhoto("p1", "r1", {
    uri: "file:///tmp/food.jpg",
    fileName: "food.jpg",
    mimeType: "image/jpeg",
    base64: null,
  });

  expect(readAsStringAsync).toHaveBeenCalledWith("file:///tmp/food.jpg", { encoding: "base64" });
  expect(bytesToText(upload.mock.calls[0][1])).toBe("disk-jpeg-bytes");
  jest.restoreAllMocks();
});

test("moderateAndAttachReviewPhoto rejects when neither the picker nor disk yields bytes", async () => {
  (supabase.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
  (readAsStringAsync as jest.Mock).mockRejectedValue(new Error("file missing"));

  await expect(moderateAndAttachReviewPhoto("p1", "r1", {
    uri: "file:///tmp/food.jpg",
    fileName: "food.jpg",
    mimeType: "image/jpeg",
    base64: null,
  })).resolves.toEqual({
    approved: false,
    reason: "Could not read that photo. Choose it again.",
  });

  expect(supabase.storage.from).not.toHaveBeenCalled();
});

test("moderateAndAttachReviewPhoto surfaces the edge function's real reason on a non-2xx response", async () => {
  (supabase.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
  (supabase.storage.from as jest.Mock).mockReturnValue({ upload: jest.fn().mockResolvedValue({ data: {}, error: null }) });
  (supabase.functions.invoke as jest.Mock).mockResolvedValue({
    data: null,
    error: { message: "Edge Function returned a non-2xx status code", context: { text: async () => "Review not found" } },
  });

  await expect(moderateAndAttachReviewPhoto("p1", "r1", {
    uri: "file:///tmp/food.jpg", fileName: "food.jpg", mimeType: "image/jpeg", base64: b64("x"),
  })).rejects.toThrow("Review not found");
});

test("moderateAndAttachReviewPhoto rejects when the caller is signed out", async () => {
  (supabase.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: null }, error: null });

  await expect(moderateAndAttachReviewPhoto("p1", "r1", { uri: "file:///tmp/food.jpg", base64: b64("x") })).resolves.toEqual({
    approved: false,
    reason: "Sign in to add photos.",
  });
  expect(supabase.storage.from).not.toHaveBeenCalled();
});
