-- Onboarding answers and privacy-safe contact matching.
--
-- We replaced the originally-proposed "ethnicity" question (special-category data) with
-- "languages you speak", which is a far lighter proxy for food heritage and not a protected
-- category. Favourite cuisines seed the user's taste. onboarded_at gates the one-time flow.
--
-- Contact matching follows the Signal / WhatsApp model: we never store other people's raw
-- numbers. Each user's OWN verified email and phone are hashed (sha256) and stored on their
-- profile. To find friends, the client hashes the addresses in its address book and asks the
-- server which hashes belong to a registered user. Only first-party identity (id, handle) is
-- returned, never the contact data itself.

create extension if not exists pgcrypto;

alter table profiles add column if not exists languages text[] not null default '{}';
alter table profiles add column if not exists favorite_cuisines text[] not null default '{}';
alter table profiles add column if not exists onboarded_at timestamptz;
alter table profiles add column if not exists email_hash text;
alter table profiles add column if not exists phone_hash text;

-- Bounded so a malformed client cannot stuff the arrays.
alter table profiles drop constraint if exists profiles_languages_safe;
alter table profiles add constraint profiles_languages_safe
  check (array_length(languages, 1) is null or array_length(languages, 1) <= 20) not valid;
alter table profiles drop constraint if exists profiles_favorite_cuisines_safe;
alter table profiles add constraint profiles_favorite_cuisines_safe
  check (array_length(favorite_cuisines, 1) is null or array_length(favorite_cuisines, 1) <= 30) not valid;

create index if not exists profiles_email_hash_idx on profiles (email_hash) where email_hash is not null;
create index if not exists profiles_phone_hash_idx on profiles (phone_hash) where phone_hash is not null;

-- Persist the onboarding answers and mark the flow complete, for the caller only.
create or replace function save_onboarding(langs text[], cuisines text[])
returns void
language sql
security definer
set search_path = public
as $$
  update profiles
     set languages = coalesce(langs, '{}'),
         favorite_cuisines = coalesce(cuisines, '{}'),
         onboarded_at = now()
   where id = auth.uid();
$$;

-- Hash the caller's own verified email + phone so other users' address books can find them.
-- Normalisation here MUST match the client (see src/domain/contactKeys.ts):
--   email -> lower(trim(email))
--   phone -> digits only
create or replace function register_contact_identity()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_phone text;
begin
  select lower(trim(u.email)), regexp_replace(coalesce(u.phone, ''), '\D', '', 'g')
    into v_email, v_phone
    from auth.users u
   where u.id = auth.uid();

  update profiles
     set email_hash = case when v_email <> '' then encode(digest(v_email, 'sha256'), 'hex') else email_hash end,
         phone_hash = case when v_phone <> '' then encode(digest(v_phone, 'sha256'), 'hex') else phone_hash end
   where id = auth.uid();
end;
$$;

-- Given hashes of the caller's address book, return the registered users they match. Returns
-- only public identity, never the contact payload, and never the caller themselves.
create or replace function match_contacts(hashes text[])
returns table (id uuid, username text, display_name text)
language sql
security definer
set search_path = public
as $$
  select p.id, p.username, p.display_name
    from profiles p
   where p.id <> auth.uid()
     and (
       (p.email_hash is not null and p.email_hash = any(hashes)) or
       (p.phone_hash is not null and p.phone_hash = any(hashes))
     )
   order by p.username nulls last
   limit 100;
$$;

grant execute on function save_onboarding(text[], text[]) to authenticated;
grant execute on function register_contact_identity() to authenticated;
grant execute on function match_contacts(text[]) to authenticated;
