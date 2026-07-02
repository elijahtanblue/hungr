import { supabase } from "../lib/supabase";

// Whether the signed-in user has finished the one-time onboarding flow. Fail-open to "onboarded"
// on error so a transient read never traps an existing user behind the wizard.
export async function getOnboardingStatus(): Promise<{ onboarded: boolean }> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return { onboarded: true };
  const { data, error } = await supabase
    .from("profiles")
    .select("onboarded_at")
    .eq("id", u.user.id)
    .single();
  if (error) return { onboarded: true };
  return { onboarded: !!data?.onboarded_at };
}

export async function saveOnboarding(languages: string[], favoriteCuisines: string[]): Promise<void> {
  const { error } = await supabase.rpc("save_onboarding", { langs: languages, cuisines: favoriteCuisines });
  if (error) throw error;
}

// The cuisines the signed-in user picked at onboarding. Powers behavioral, opt-in taste ranking.
// Fails soft to an empty list so a read error never distorts results.
export async function getFavoriteCuisines(): Promise<string[]> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return [];
  const { data, error } = await supabase
    .from("profiles")
    .select("favorite_cuisines")
    .eq("id", u.user.id)
    .single();
  if (error || !data || !Array.isArray(data.favorite_cuisines)) return [];
  return data.favorite_cuisines as string[];
}
