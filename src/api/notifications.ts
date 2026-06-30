import { supabase } from "../lib/supabase";

// In-app notifications (e.g. someone followed you). Created server-side by a trigger; the client
// only reads its own and marks them read.
export type AppNotification = {
  id: string;
  type: string;
  read: boolean;
  createdAt: string;
  actorUsername: string | null;
  actorName: string | null;
};

export async function getNotifications(): Promise<AppNotification[]> {
  const { data, error } = await supabase.rpc("get_notifications");
  if (error || !Array.isArray(data)) return [];
  return data.map((r: any) => ({
    id: r.id,
    type: r.type,
    read: !!r.read,
    createdAt: r.created_at,
    actorUsername: r.actor_username ?? null,
    actorName: r.actor_name ?? null,
  }));
}

export async function markNotificationsRead(): Promise<void> {
  await supabase.rpc("mark_notifications_read");
}
