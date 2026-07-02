import type { LocalReviewPhotoAsset } from "../api/reviewPhotos";

export const UNSUPPORTED_REVIEW_PHOTO_MESSAGE = "Choose a JPG, PNG, WebP, or HEIC photo.";

export const EXTENSION_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
  "image/heic-sequence": "heics",
  "image/heif-sequence": "heifs",
};

export const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
  heicf: "image/heic",
  heics: "image/heic-sequence",
  heifs: "image/heif-sequence",
  hif: "image/heif",
};

export function normalizedMimeType(value?: string | null): string | null {
  const mime = value?.trim().toLowerCase();
  if (!mime) return null;
  return mime === "image/jpg" ? "image/jpeg" : mime;
}

export function extensionFromName(value?: string | null): string | null {
  const match = value?.toLowerCase().match(/\.([a-z0-9]+)(?:\?.*)?$/);
  return match?.[1] ?? null;
}

export function reviewPhotoFormatError(asset: LocalReviewPhotoAsset): string | null {
  const mime = normalizedMimeType(asset.mimeType);
  if (mime && !EXTENSION_BY_MIME[mime]) return UNSUPPORTED_REVIEW_PHOTO_MESSAGE;

  const ext = extensionFromName(asset.fileName) ?? extensionFromName(asset.uri);
  if (!mime && ext && !MIME_BY_EXTENSION[ext]) return UNSUPPORTED_REVIEW_PHOTO_MESSAGE;

  return null;
}
