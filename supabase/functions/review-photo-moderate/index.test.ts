import { moderationUnavailableReason, isApprovedSafeSearch, isSafeStoragePath, normalizeDimension } from "./index.ts";

Deno.test("isSafeStoragePath accepts user scoped image paths and rejects traversal", () => {
  if (!isSafeStoragePath("user-id/review-id/1782777600000-food.jpg")) throw new Error("valid path rejected");
  if (isSafeStoragePath("../secret.jpg")) throw new Error("traversal accepted");
  if (isSafeStoragePath("user/review/file.svg")) throw new Error("unsupported extension accepted");
  if (isSafeStoragePath("user//file.jpg")) throw new Error("empty path segment accepted");
});

Deno.test("normalizeDimension keeps optional dimensions within sane bounds", () => {
  if (normalizeDimension(800) !== 800) throw new Error("valid dimension rejected");
  if (normalizeDimension(99999) !== null) throw new Error("oversized dimension accepted");
  if (normalizeDimension("800") !== null) throw new Error("string dimension accepted");
});

Deno.test("isApprovedSafeSearch rejects adult, racy, and violent photos at possible or worse", () => {
  if (!isApprovedSafeSearch({ adult: "VERY_UNLIKELY", racy: "UNLIKELY", violence: "VERY_UNLIKELY" })) {
    throw new Error("safe labels rejected");
  }
  if (isApprovedSafeSearch({ adult: "POSSIBLE", racy: "VERY_UNLIKELY", violence: "VERY_UNLIKELY" })) {
    throw new Error("adult possible accepted");
  }
  if (isApprovedSafeSearch({ adult: "VERY_UNLIKELY", racy: "LIKELY", violence: "VERY_UNLIKELY" })) {
    throw new Error("racy likely accepted");
  }
  if (isApprovedSafeSearch({ adult: "VERY_UNLIKELY", racy: "VERY_UNLIKELY", violence: "POSSIBLE" })) {
    throw new Error("violence possible accepted");
  }
});

Deno.test("isApprovedSafeSearch rejects missing annotations without throwing", () => {
  if (isApprovedSafeSearch(null)) throw new Error("missing annotation accepted");
});

Deno.test("moderationUnavailableReason points to Vision key setup", () => {
  if (!moderationUnavailableReason().includes("GOOGLE_VISION_KEY")) {
    throw new Error("moderation setup reason should mention GOOGLE_VISION_KEY");
  }
});
