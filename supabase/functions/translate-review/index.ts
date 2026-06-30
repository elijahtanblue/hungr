import { guard } from "../_shared/guard.ts";
import { readJsonObject } from "../_shared/request.ts";

const TRANSLATE_KEY = Deno.env.get("GOOGLE_TRANSLATE_KEY") ?? Deno.env.get("GOOGLE_PLACES_KEY") ?? "";

export function isSupportedTargetLanguage(value: unknown): value is string {
  return typeof value === "string" && /^[a-z]{2,3}(-[A-Z]{2})?$/.test(value);
}

export function cleanTranslationText(value: unknown): string {
  return typeof value === "string" ? value.trim().slice(0, 5000) : "";
}

export default async function handler(req: Request): Promise<Response> {
  const blocked = await guard(req, 60);
  if (blocked) return blocked;

  const body = await readJsonObject(req);
  if (!body.ok) return body.response;
  const text = cleanTranslationText(body.value.text);
  const targetLanguage = isSupportedTargetLanguage(body.value.targetLanguage)
    ? body.value.targetLanguage
    : "en";
  if (!text) return new Response("Missing text", { status: 400 });
  if (!TRANSLATE_KEY) return new Response("Missing translate key", { status: 500 });

  const res = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${TRANSLATE_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ q: text, target: targetLanguage, format: "text" }),
  });
  if (!res.ok) return new Response("Translation failed", { status: 502 });
  const data = await res.json();
  const translatedText = data?.data?.translations?.[0]?.translatedText;
  if (typeof translatedText !== "string") return new Response("No translation", { status: 502 });

  return new Response(JSON.stringify({ translatedText, targetLanguage }), {
    headers: { "Content-Type": "application/json" },
  });
}

if (import.meta.main) Deno.serve(handler);
