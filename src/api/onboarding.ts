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
