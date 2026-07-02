-- Editable profiles: a short bio and an avatar photo, plus a public "avatars" storage bucket.
-- Profiles already have own-row RLS (0002), so bio/avatar_url are written through the existing
-- "own profile update" policy. Avatars are public (like a display picture) so friends can see them;
-- writes are still restricted to the owner's own folder.

alter table profiles add column if not exists bio text;
alter table profiles add column if not exists avatar_url text;

do $$ begin
  alter table profiles add constraint profiles_bio_len check (bio is null or char_length(bio) <= 300);
exception when duplicate_object then null; end $$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Anyone can read avatars (public bucket / public display picture).
drop policy if exists "read avatars" on storage.objects;
create policy "read avatars" on storage.objects
  for select
  using (bucket_id = 'avatars');

-- Only the owner may write into their own folder ({uid}/...).
drop policy if exists "upload own avatar" on storage.objects;
create policy "upload own avatar" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "update own avatar" on storage.objects;
create policy "update own avatar" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "delete own avatar" on storage.objects;
create policy "delete own avatar" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

notify pgrst, 'reload schema';
