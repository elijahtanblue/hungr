import { supabase } from "../lib/supabase";

// Files a bug report (own-row RLS). The founder triages these in the Supabase dashboard.
export async function submitBugReport(message: string): Promise<boolean> {
  const text = message.trim().slice(0, 2000);
  if (!text) return false;

  const { data, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!data.user) return false;

  const res = await supabase.from("bug_reports").insert({ user_id: data.user.id, message: text });
  return !res.error;
}
