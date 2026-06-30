import { supabase } from "../lib/supabase";

export async function translateGoogleReview(text: string, targetLanguage = "en"): Promise<string | null> {
  const clean = text.trim();
  if (!clean) return null;
  const { data, error } = await supabase.functions.invoke("translate-review", {
    body: { text: clean, targetLanguage },
  });
  if (error || typeof data?.translatedText !== "string") return null;
  return data.translatedText;
}
