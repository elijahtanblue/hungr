-- Richer place sentiments. Been -> Liked, Avoid -> Disliked, plus a new Loved. Want to go (go) is
-- unchanged. We swap the enum via a fresh type (rather than ALTER TYPE ... ADD VALUE, which cannot
-- be used in the same transaction it is created in) and migrate existing rows.
create type place_state_new as enum ('go', 'liked', 'loved', 'disliked');

alter table user_places
  alter column state type place_state_new
  using (
    case state::text
      when 'been' then 'liked'
      when 'avoid' then 'disliked'
      else state::text
    end::place_state_new
  );

drop type place_state;
alter type place_state_new rename to place_state;

-- friend_beens now shares Liked + Loved (positive visits). Disliked and Want to go stay private,
-- exactly as Avoid and Want to go always have. Otherwise unchanged.
create or replace function friend_beens()
returns table (place_id text, friend_id uuid, friend_name text, friend_username text, visited_at timestamptz)
language sql security definer set search_path = public as $$
  select up.place_id, up.user_id, p.display_name, p.username, up.updated_at
  from follows f
  join user_places up on up.user_id = f.followee_id and up.state in ('liked', 'loved')
  join profiles p on p.id = up.user_id
  where f.follower_id = auth.uid() and p.shares_activity;
$$;
