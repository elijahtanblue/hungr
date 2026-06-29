import { supabase } from "../lib/supabase";

// The grounded answer plus the Google source links that MUST be shown with it. This is the
// only sanctioned AI-over-Google-Maps path. Output renders in its own block, never mixed
// with community content.
export type Grounded = { text: string; sources: string[] };

export async function getGrounded(placeQuery: string): Promise<Grounded> {
  const { data, error } = await supabase.functions.invoke("grounding", { body: { placeQuery } });
  if (error) throw error;
  return data as Grounded;
}
