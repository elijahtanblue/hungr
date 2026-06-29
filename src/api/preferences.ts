import { supabase } from "../lib/supabase";

// The avoid list (suppressed cuisines) is first party data, persisted on the user's profile.
// Prioritised cuisines stay a session-only filter and are not persisted.

export async function loadSuppressedCuisines(): Promise<string[]> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return [];
  const { data } = await supabase
    .from("profiles")
    .select("suppressed_cuisines")
    .eq("id", u.user.id)
    .single();
  return data?.suppressed_cuisines ?? [];
}

export async function saveSuppressedCuisines(suppressed: string[]): Promise<void> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return;
  await supabase.from("profiles").update({ suppressed_cuisines: suppressed }).eq("id", u.user.id);
}
