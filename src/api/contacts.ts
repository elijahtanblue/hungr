import { supabase } from "../lib/supabase";
import { sha256Hex } from "../lib/sha256";
import { contactIdentifiers, type DeviceContact } from "../domain/contactKeys";
import type { UserSummary } from "./social";

// Register the caller's own email/phone hashes so other people's address books can find them.
// Idempotent and fail-soft: a failure here just means this user is not yet discoverable.
export async function registerContactIdentity(): Promise<void> {
  await supabase.rpc("register_contact_identity");
}

// Hash the normalized identifiers from the device address book and ask the server which ones
// belong to a registered user. Raw contact data never leaves the device; only hashes are sent.
export async function matchContacts(contacts: DeviceContact[]): Promise<UserSummary[]> {
  const identifiers = contactIdentifiers(contacts);
  if (identifiers.length === 0) return [];
  const hashes = await Promise.all(identifiers.map(sha256Hex));
  const { data, error } = await supabase.rpc("match_contacts", { hashes });
  if (error) throw error;
  return ((data as any[]) ?? []).map((row) => ({
    id: row.id,
    username: row.username ?? null,
    displayName: row.display_name ?? null,
  }));
}
