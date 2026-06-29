-- Harden the signup trigger. It runs inside the auth.users insert transaction, so any
-- unexpected error would roll back the whole signup. Wrap it so profile creation can never
-- block auth, and default the display name when the user has no email (some OAuth users).
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, display_name)
  values (
    new.id,
    coalesce(nullif(split_part(coalesce(new.email, ''), '@', 1), ''), 'foodie')
  )
  on conflict (id) do nothing;
  return new;
exception when others then
  -- Never let profile creation abort the signup.
  return new;
end;
$$;
