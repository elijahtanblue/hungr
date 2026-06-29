import { supabase } from "../lib/supabase";

// The avoid list (suppressed cuisines) is first party data, persisted on the user's profile.
// Prioritised cuisines stay a session-only filter and are not persisted.

export async function loadSuppressedCuisines(): Promise<string[]> {
  const { data: u, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!u.user) return [];
  const { data, error } = await supabase
    .from("profiles")
    .select("suppressed_cuisines")
    .eq("id", u.user.id)
    .single();
  if (error) throw error;
  return data?.suppressed_cuisines ?? [];
}

export async function saveSuppressedCuisines(suppressed: string[]): Promise<void> {
  const { data: u, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!u.user) return;
  const { error } = await supabase.from("profiles").update({ suppressed_cuisines: suppressed }).eq("id", u.user.id);
  if (error) throw error;
}
