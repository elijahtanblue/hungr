-- V2 first-party feedback captured by the Been / Avoid prompts. This is hungr's own UGC (the
-- moat), kept on the user's own user_places row and protected by the existing own-row RLS. None
-- of it is exposed cross-user: friend_beens returns only place_id + visited_at, never rating,
-- note, or avoid_reason. avoid_reason is a small fixed vocabulary today, kept as text so future
-- personalization work can aggregate it without a schema change.
alter table user_places add column if not exists rating int check (rating between 1 and 5);
alter table user_places add column if not exists note text;
alter table user_places add column if not exists avoid_reason text;
