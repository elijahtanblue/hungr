import { moderateAndAttachReviewPhoto } from "../../src/api/reviewPhotos";
import { supabase } from "../../src/lib/supabase";

jest.mock("../../src/lib/supabase", () => ({
  supabase: {
    auth: { getUser: jest.fn() },
    storage: { from: jest.fn() },
    functions: { invoke: jest.fn() },
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn().mockResolvedValue({
    blob: jest.fn().mockResolvedValue(new Blob(["jpeg"], { type: "image/jpeg" })),
  }) as any;
});

test("moderateAndAttachReviewPhoto uploads to private storage then asks the edge function to moderate and attach", async () => {
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
    width: 800,
    height: 600,
  })).resolves.toEqual({ approved: true, photoId: "ph1" });

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
    moderateAndAttachReviewPhoto("p1", "r1", { uri: "file:///tmp/food-a.jpg", fileName: "food.jpg" }),
    moderateAndAttachReviewPhoto("p1", "r1", { uri: "file:///tmp/food-b.jpg", fileName: "food.jpg" }),
  ]);

  const paths = upload.mock.calls.map((call) => call[0]);
  expect(new Set(paths).size).toBe(2);
  expect(paths[0]).toMatch(/^u1\/r1\/1782777600000-[a-z0-9]+-food\.jpg$/);
  expect(paths[1]).toMatch(/^u1\/r1\/1782777600000-[a-z0-9]+-food\.jpg$/);
  jest.restoreAllMocks();
});

test("moderateAndAttachReviewPhoto rejects unsupported iOS HEIC assets before upload", async () => {
  (supabase.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: { id: "u1" } }, error: null });

  await expect(moderateAndAttachReviewPhoto("p1", "r1", {
    uri: "file:///tmp/IMG_0001.HEIC",
    fileName: "IMG_0001.HEIC",
    mimeType: "image/heic",
  })).resolves.toEqual({
    approved: false,
    reason: "Choose a JPG, PNG, or WebP photo.",
  });

  expect(global.fetch).not.toHaveBeenCalled();
  expect(supabase.storage.from).not.toHaveBeenCalled();
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
  });

  expect(upload.mock.calls[0][0]).toMatch(/^u1\/r1\/1782777600000-[a-z0-9]+-img_0001\.jpg$/);
  jest.restoreAllMocks();
});

test("moderateAndAttachReviewPhoto rejects when the caller is signed out", async () => {
  (supabase.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: null }, error: null });

  await expect(moderateAndAttachReviewPhoto("p1", "r1", { uri: "file:///tmp/food.jpg" })).resolves.toEqual({
    approved: false,
    reason: "Sign in to add photos.",
  });
  expect(supabase.storage.from).not.toHaveBeenCalled();
});
