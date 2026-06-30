// Normalisation for contact matching. This MUST stay identical to the server side in
// supabase/migrations/0017_onboarding_and_contacts.sql, or a contact's hash will never line up
// with the registered user's stored hash and nobody will match.

// Email: lowercase and trim. (We deliberately do not strip dots / plus-tags: the stored hash is
// derived from the raw verified email the same way.)
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

// Phone: digits only. Crude across country-code formats, but symmetric with the server, so two
// numbers stored the same way still match. Numbers shorter than 6 digits are dropped as noise.
export function normalizePhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 6 ? digits : null;
}

// Flatten a device contact into the normalized identifiers we will hash.
export type DeviceContact = { emails?: string[]; phones?: string[] };

export function contactIdentifiers(contacts: DeviceContact[]): string[] {
  const out = new Set<string>();
  for (const c of contacts) {
    for (const e of c.emails ?? []) {
      const n = normalizeEmail(e);
      if (n) out.add(n);
    }
    for (const p of c.phones ?? []) {
      const n = normalizePhone(p);
      if (n) out.add(n);
    }
  }
  return Array.from(out);
}
