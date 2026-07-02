import { supabase } from "../lib/supabase";

// Lightweight, private check-ins. The count is the user's own memory aid and a personalization
// signal (first time vs regular); it is protected by own-row RLS and never shown to anyone else.

export type VisitStatus = { count: number; checkedInRecently: boolean };
export type CheckInResult = VisitStatus & { checkedIn: boolean };

function isRecent(iso?: string): boolean {
  if (!iso) return false;
  const time = new Date(iso).getTime();
  if (!Number.isFinite(time)) return false;
  return Date.now() - time < 2 * 60 * 60 * 1000;
}

function firstRow(data: unknown): any | null {
  if (Array.isArray(data)) return data[0] ?? null;
  if (data && typeof data === "object") return data;
  return null;
}

// The distinct places the signed-in user has ever checked into (own-row RLS). Used as a behavioral
// taste signal on the map. Fails soft to an empty list.
export async function getCheckedInPlaceIds(): Promise<string[]> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return [];
  const res = await supabase.from("check_ins").select("place_id").eq("user_id", u.user.id);
  if (res.error || !res.data) return [];
  return Array.from(
    new Set(res.data.map((r: any) => r.place_id).filter((p: any): p is string => typeof p === "string")),
  );
}

// How many times the signed-in user has checked in across the last `days` (default a week). Used as
// a taste signal ("eats out a lot"). Own-row RLS; fails soft to 0.
export async function getRecentCheckInCount(days = 7): Promise<number> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return 0;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const res = await supabase
    .from("check_ins")
    .select("id", { count: "exact", head: true })
    .eq("user_id", u.user.id)
    .gte("created_at", since);
  return res.error ? 0 : res.count ?? 0;
}

// Record one visit through the server-side throttle. Returns the user's visit status for the
// place, or null if not signed in.
export async function checkIn(placeId: string): Promise<CheckInResult | null> {
  const { data, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!data.user) return null;

  const { data: rpcData, error } = await supabase.rpc("check_in_place", { target_place_id: placeId });
  if (error) throw error;
  const row = firstRow(rpcData);
  return {
    count: Number(row?.visit_count ?? 0),
    checkedIn: row?.checked_in === true,
    checkedInRecently: row?.checked_in_recently === true,
  };
}

// Count and recent state for the signed-in user. Recent means the last check-in is within the
// internal two-hour throttle window.
export async function getVisitStatus(placeId: string): Promise<VisitStatus> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { count: 0, checkedInRecently: false };

  const countRes = await supabase
    .from("check_ins")
    .select("id", { count: "exact", head: true })
    .eq("user_id", data.user.id)
    .eq("place_id", placeId);
  if (countRes.error) return { count: 0, checkedInRecently: false };

  const latestRes = await supabase
    .from("check_ins")
    .select("created_at")
    .eq("user_id", data.user.id)
    .eq("place_id", placeId)
    .order("created_at", { ascending: false })
    .limit(1);

  const latest = Array.isArray(latestRes.data) ? latestRes.data[0]?.created_at : undefined;
  return { count: countRes.count ?? 0, checkedInRecently: !latestRes.error && isRecent(latest) };
}

// How many times the signed-in user has checked in here. Zero when signed out or never visited.
export async function getVisitCount(placeId: string): Promise<number> {
  return (await getVisitStatus(placeId)).count;
}
