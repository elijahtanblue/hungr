import { readAsStringAsync } from "expo-file-system/legacy";
import * as ImageManipulator from "expo-image-manipulator";
import { supabase } from "../lib/supabase";
import {
  EXTENSION_BY_MIME,
  MIME_BY_EXTENSION,
  UNSUPPORTED_REVIEW_PHOTO_MESSAGE,
  extensionFromName,
  normalizedMimeType,
  reviewPhotoFormatError,
} from "../domain/reviewPhotoFormats";

export type LocalReviewPhotoAsset = {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
  base64?: string | null;
  width?: number;
  height?: number;
};

export type ModeratedPhotoResult = {
  approved: boolean;
  photoId?: string;
  reason?: string;
};

let uploadNonce = 0;

function isHeicFamily(asset: LocalReviewPhotoAsset): boolean {
  const mime = normalizedMimeType(asset.mimeType);
  if (mime === "image/heic" || mime === "image/heif" || mime === "image/heic-sequence" || mime === "image/heif-sequence") {
    return true;
  }
  const ext = extensionFromName(asset.fileName) ?? extensionFromName(asset.uri);
  return ext === "heic" || ext === "heif" || ext === "heicf" || ext === "heics" || ext === "heifs" || ext === "hif";
}

function jpegNameFor(asset: LocalReviewPhotoAsset): string {
  const raw = asset.fileName?.trim() || "photo.heic";
  return raw.replace(/\.[^.]+$/, "") + ".jpg";
}

async function convertHeicFamilyToJpeg(asset: LocalReviewPhotoAsset): Promise<LocalReviewPhotoAsset> {
  const converted = await ImageManipulator.manipulateAsync(asset.uri, [], {
    compress: 0.86,
    format: ImageManipulator.SaveFormat.JPEG,
    base64: true,
  });
  return {
    ...asset,
    uri: converted.uri,
    fileName: jpegNameFor(asset),
    mimeType: "image/jpeg",
    base64: converted.base64 ?? null,
    width: converted.width,
    height: converted.height,
  };
}

async function prepareForUpload(asset: LocalReviewPhotoAsset): Promise<LocalReviewPhotoAsset | null> {
  if (!isHeicFamily(asset)) return asset;
  try {
    return await convertHeicFamilyToJpeg(asset);
  } catch {
    return null;
  }
}

function contentTypeFor(asset: LocalReviewPhotoAsset): string | null {
  const mime = normalizedMimeType(asset.mimeType);
  if (mime && EXTENSION_BY_MIME[mime]) return mime;

  const ext = extensionFromName(asset.fileName) ?? extensionFromName(asset.uri);
  return ext ? MIME_BY_EXTENSION[ext] ?? null : "image/jpeg";
}

// React Native Blobs from fetch(localUri) do not serialize for Supabase Storage uploads (they
// upload as 0 bytes, and ph:// asset URIs make fetch itself throw). We read the picked bytes as
// base64 instead and upload the decoded bytes directly. Prefer the picker's inline base64 when it
// is present; fall back to reading the file from disk, which is reliable on iOS multi-select where
// the inline base64 can come back empty. atob is present in Hermes (SDK 56) and Node.
async function readPhotoBase64(asset: LocalReviewPhotoAsset): Promise<string | null> {
  const inline = asset.base64?.trim();
  if (inline) return inline;
  try {
    const fromDisk = (await readAsStringAsync(asset.uri, { encoding: "base64" })).trim();
    return fromDisk || null;
  } catch {
    return null;
  }
}

// Pull the real error text out of a supabase-js FunctionsHttpError. Its `context` is the raw
// Response, whose body carries the function's own message.
async function invokeErrorDetail(error: unknown): Promise<string | null> {
  const ctx = (error as { context?: { text?: () => Promise<string> } })?.context;
  if (!ctx || typeof ctx.text !== "function") return null;
  try {
    const body = (await ctx.text()).trim();
    return body ? body.slice(0, 200) : null;
  } catch {
    return null;
  }
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function safeFileName(asset: LocalReviewPhotoAsset, contentType: string): string {
  const ext = EXTENSION_BY_MIME[contentType] ?? "jpg";
  const raw = asset.fileName?.trim() || `photo.${ext}`;
  const withoutExt = raw.replace(/\.[^.]+$/, "");
  const cleaned = withoutExt.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return `${cleaned || "photo"}.${ext}`;
}

function nextUploadNonce(): string {
  uploadNonce = (uploadNonce + 1) % 1000000;
  return uploadNonce.toString(36);
}

export async function moderateAndAttachReviewPhoto(
  placeId: string,
  reviewId: string,
  asset: LocalReviewPhotoAsset,
): Promise<ModeratedPhotoResult> {
  const { data, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!data.user) return { approved: false, reason: "Sign in to add photos." };

  const prepared = await prepareForUpload(asset);
  if (!prepared) return { approved: false, reason: "Could not prepare that photo. Choose it again." };

  const formatError = reviewPhotoFormatError(prepared);
  if (formatError) return { approved: false, reason: formatError };

  const base64 = await readPhotoBase64(prepared);
  if (!base64) return { approved: false, reason: "Could not read that photo. Choose it again." };
  const contentType = contentTypeFor(prepared);
  if (!contentType) return { approved: false, reason: UNSUPPORTED_REVIEW_PHOTO_MESSAGE };

  const bytes = base64ToBytes(base64);
  const path = `${data.user.id}/${reviewId}/${Date.now()}-${nextUploadNonce()}-${safeFileName(prepared, contentType)}`;
  const upload = await supabase.storage.from("review-photos").upload(path, bytes, {
    contentType,
    upsert: false,
  });
  if (upload.error) throw new Error(upload.error.message || "Photo upload failed.");

  const moderated = await supabase.functions.invoke("review-photo-moderate", {
    body: {
      placeId,
      reviewId,
      path,
      width: prepared.width,
      height: prepared.height,
    },
  });
  if (moderated.error) {
    // supabase-js collapses any non-2xx into "Edge Function returned a non-2xx status code". The
    // function's real reason (e.g. "Review not found", "Rate limited") is in the response body on
    // error.context, so surface that instead of the opaque wrapper.
    const detail = await invokeErrorDetail(moderated.error);
    throw new Error(detail || moderated.error.message || "Photo moderation failed.");
  }
  return {
    approved: !!moderated.data?.approved,
    ...(typeof moderated.data?.photoId === "string" ? { photoId: moderated.data.photoId } : {}),
    ...(typeof moderated.data?.reason === "string" ? { reason: moderated.data.reason } : {}),
  };
}
