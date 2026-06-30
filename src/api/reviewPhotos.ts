import { supabase } from "../lib/supabase";

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

function safeFileName(asset: LocalReviewPhotoAsset): string {
  const raw = asset.fileName?.trim() || `photo.${asset.mimeType === "image/png" ? "png" : "jpg"}`;
  const cleaned = raw.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return cleaned || "photo.jpg";
}

export async function moderateAndAttachReviewPhoto(
  placeId: string,
  reviewId: string,
  asset: LocalReviewPhotoAsset,
): Promise<ModeratedPhotoResult> {
  const { data, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!data.user) return { approved: false, reason: "Sign in to add photos." };

  const response = await fetch(asset.uri);
  const blob = await response.blob();
  const path = `${data.user.id}/${reviewId}/${Date.now()}-${safeFileName(asset)}`;
  const contentType = asset.mimeType || blob.type || "image/jpeg";
  const upload = await supabase.storage.from("review-photos").upload(path, blob, {
    contentType,
    upsert: false,
  });
  if (upload.error) throw upload.error;

  const moderated = await supabase.functions.invoke("review-photo-moderate", {
    body: {
      placeId,
      reviewId,
      path,
      width: asset.width,
      height: asset.height,
    },
  });
  if (moderated.error) throw moderated.error;
  return {
    approved: !!moderated.data?.approved,
    ...(typeof moderated.data?.photoId === "string" ? { photoId: moderated.data.photoId } : {}),
    ...(typeof moderated.data?.reason === "string" ? { reason: moderated.data.reason } : {}),
  };
}
