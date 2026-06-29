-- hungr v1 schema. Stores only place_id plus first party data. No Google content here.
-- Google name, lat, lng, rating are fetched live through the proxy and never persisted.

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  suppressed_cuisines text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table cuisines (
  id serial primary key,
  name text unique not null
);

-- places holds ONLY the durable Google place_id. It is a join anchor for first party rows.
create table places (
  place_id text primary key,
  created_at timestamptz not null default now()
);

-- first party cuisine tags, the refinement layer over Google's coarse place type.
create table place_cuisines (
  place_id text references places(place_id) on delete cascade,
  cuisine_id int references cuisines(id) on delete cascade,
  primary key (place_id, cuisine_id)
);

create type place_state as enum ('go', 'been', 'avoid');

create table user_places (
  user_id uuid references auth.users(id) on delete cascade,
  place_id text references places(place_id) on delete cascade,
  state place_state not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, place_id)
);

create table reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  place_id text references places(place_id) on delete cascade,
  body text not null,
  rating int check (rating between 1 and 5),
  cuisine_id int references cuisines(id),
  created_at timestamptz not null default now()
);

create table place_tags (
  id uuid primary key default gen_random_uuid(),
  place_id text references places(place_id) on delete cascade,
  tag text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- per user rate limiting for the Places proxy. Written server side only (security definer).
create table rate_limits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  window_start timestamptz not null default now(),
  count int not null default 0
);

-- Fixed one minute window. Returns true if the call is allowed, false if over the cap.
create or replace function bump_rate_limit(uid uuid, max_per_min int)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  cur rate_limits%rowtype;
begin
  insert into rate_limits (user_id, window_start, count)
  values (uid, now(), 1)
  on conflict (user_id) do update
    set count = case when now() - rate_limits.window_start > interval '1 minute' then 1 else rate_limits.count + 1 end,
        window_start = case when now() - rate_limits.window_start > interval '1 minute' then now() else rate_limits.window_start end
  returning * into cur;
  return cur.count <= max_per_min;
end;
$$;

-- seed the coarse v1 cuisines that map cleanly from Google place types.
insert into cuisines (name) values
  ('Chinese'), ('Korean'), ('Japanese'), ('Thai'), ('Vietnamese'), ('Indian');
