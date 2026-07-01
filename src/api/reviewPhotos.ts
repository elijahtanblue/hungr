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
  width?: number;
  height?: number;
};

export type ModeratedPhotoResult = {
  approved: boolean;
  photoId?: string;
  reason?: string;
};

let uploadNonce = 0;

function contentTypeFor(asset: LocalReviewPhotoAsset, blob: Blob): string | null {
  const mime = normalizedMimeType(asset.mimeType) ?? normalizedMimeType(blob.type);
  if (mime && EXTENSION_BY_MIME[mime]) return mime === "image/jpg" ? "image/jpeg" : mime;

  const ext = extensionFromName(asset.fileName) ?? extensionFromName(asset.uri);
  return ext ? MIME_BY_EXTENSION[ext] ?? null : "image/jpeg";
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

  const formatError = reviewPhotoFormatError(asset);
  if (formatError) return { approved: false, reason: formatError };

  const response = await fetch(asset.uri);
  const blob = await response.blob();
  const contentType = contentTypeFor(asset, blob);
  if (!contentType) return { approved: false, reason: UNSUPPORTED_REVIEW_PHOTO_MESSAGE };

  const path = `${data.user.id}/${reviewId}/${Date.now()}-${nextUploadNonce()}-${safeFileName(asset, contentType)}`;
  const upload = await supabase.storage.from("review-photos").upload(path, blob, {
    contentType,
    upsert: false,
  });
  if (upload.error) throw new Error(upload.error.message || "Photo upload failed.");

  const moderated = await supabase.functions.invoke("review-photo-moderate", {
    body: {
      placeId,
      reviewId,
      path,
      width: asset.width,
      height: asset.height,
    },
  });
  if (moderated.error) throw new Error(moderated.error.message || "Photo moderation failed.");
  return {
    approved: !!moderated.data?.approved,
    ...(typeof moderated.data?.photoId === "string" ? { photoId: moderated.data.photoId } : {}),
    ...(typeof moderated.data?.reason === "string" ? { reason: moderated.data.reason } : {}),
  };
}
