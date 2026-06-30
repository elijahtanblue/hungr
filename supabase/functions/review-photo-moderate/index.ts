import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { guard } from "../_shared/guard.ts";
import { readJsonObject } from "../_shared/request.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("HUNGR_SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("HUNGR_SUPABASE_ANON_KEY")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("HUNGR_SUPABASE_SERVICE_ROLE")!;
const VISION_KEY = Deno.env.get("GOOGLE_VISION_KEY") ?? Deno.env.get("GOOGLE_PLACES_KEY") ?? "";

const BLOCKED_LEVELS = new Set(["POSSIBLE", "LIKELY", "VERY_LIKELY"]);

export function isSafeStoragePath(value: unknown): value is string {
  return typeof value === "string"
    && /^[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\/[A-Za-z0-9._-]+\.(jpe?g|png|webp)$/i.test(value)
    && !value.includes("..");
}

export function normalizeDimension(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isInteger(value)) return null;
  return value >= 1 && value <= 12000 ? value : null;
}

export function isApprovedSafeSearch(annotation: Record<string, unknown> | null | undefined): boolean {
  if (!annotation) return false;
  return !BLOCKED_LEVELS.has(String(annotation.adult ?? ""))
    && !BLOCKED_LEVELS.has(String(annotation.racy ?? ""))
    && !BLOCKED_LEVELS.has(String(annotation.violence ?? ""));
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

async function safeSearch(imageBytes: Uint8Array): Promise<Record<string, unknown> | null> {
  if (!VISION_KEY) throw new Error("Missing GOOGLE_VISION_KEY");
  const res = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${VISION_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requests: [{
        image: { content: bytesToBase64(imageBytes) },
        features: [{ type: "SAFE_SEARCH_DETECTION" }],
      }],
    }),
  });
  if (!res.ok) throw new Error("Vision SafeSearch failed");
  const data = await res.json();
  return data?.responses?.[0]?.safeSearchAnnotation ?? null;
}

export default async function handler(req: Request): Promise<Response> {
  const blocked = await guard(req, 30);
  if (blocked) return blocked;

  const body = await readJsonObject(req);
  if (!body.ok) return body.response;
  const { placeId, reviewId, path } = body.value;
  if (typeof placeId !== "string" || typeof reviewId !== "string" || !isSafeStoragePath(path)) {
    return new Response("Invalid photo request", { status: 400 });
  }

  const jwt = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
  const anon = createClient(SUPABASE_URL, ANON);
  const { data: userData } = await anon.auth.getUser(jwt);
  const userId = userData.user?.id;
  if (!userId || !path.startsWith(`${userId}/`)) return new Response("Forbidden", { status: 403 });

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const { data: review } = await admin
    .from("reviews")
    .select("id")
    .eq("id", reviewId)
    .eq("place_id", placeId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!review) return new Response("Review not found", { status: 404 });

  const downloaded = await admin.storage.from("review-photos").download(path);
  if (downloaded.error || !downloaded.data) return new Response("Photo not found", { status: 404 });
  const bytes = new Uint8Array(await downloaded.data.arrayBuffer());
  const annotation = await safeSearch(bytes);
  const approved = isApprovedSafeSearch(annotation);
  if (!approved) {
    await admin.storage.from("review-photos").remove([path]);
    return new Response(JSON.stringify({ approved: false, reason: "Photo did not pass moderation." }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const inserted = await admin.from("review_photos").insert({
    review_id: reviewId,
    user_id: userId,
    place_id: placeId,
    storage_path: path,
    width: normalizeDimension(body.value.width),
    height: normalizeDimension(body.value.height),
    status: "approved",
    moderation: annotation ?? {},
  }).select("id").single();
  if (inserted.error) return new Response("Could not attach photo", { status: 500 });

  return new Response(JSON.stringify({ approved: true, photoId: inserted.data.id }), {
    headers: { "Content-Type": "application/json" },
  });
}

if (import.meta.main) Deno.serve(handler);
