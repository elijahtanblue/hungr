import * as ImageManipulator from "expo-image-manipulator";
import { supabase } from "../lib/supabase";

export type LocalAvatarAsset = { uri: string };

// React Native blobs from fetch() upload as 0 bytes to Supabase Storage, so we decode base64 to
// bytes and upload those (same approach as review photos). We always run the picked image through
// ImageManipulator to a square-ish resized JPEG, which both shrinks it and normalizes HEIC/PNG.
function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// Upload a new avatar for the signed-in user and return its public URL. Throws on failure.
export async function uploadAvatar(asset: LocalAvatarAsset): Promise<string> {
  const { data: u, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!u.user) throw new Error("Sign in to change your photo.");

  const processed = await ImageManipulator.manipulateAsync(
    asset.uri,
    [{ resize: { width: 512 } }],
    { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG, base64: true },
  );
  if (!processed.base64) throw new Error("Could not read that photo. Choose it again.");

  const path = `${u.user.id}/${Date.now()}.jpg`;
  const upload = await supabase.storage.from("avatars").upload(path, base64ToBytes(processed.base64), {
    contentType: "image/jpeg",
    upsert: true,
  });
  if (upload.error) throw new Error(upload.error.message || "Photo upload failed.");

  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  return data.publicUrl;
}
