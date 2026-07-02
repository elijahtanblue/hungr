-- Security fix: report_review_photo (0019) flipped a photo's status to 'reported' on a single
-- authenticated report. Because public reads only show 'approved' photos, any user could hide any
-- other user's photo simply by reporting it (a censorship / griefing vector).
--
-- A report is now an INSERT only. It records the complaint for a moderator; it never changes photo
-- visibility. Hiding a photo is a moderation action performed out of band by the service role (e.g.
-- an admin tool or an automated policy that weighs distinct reports), never by one user's say-so.

create or replace function report_review_photo(target_photo_id uuid, reason text) returns void
language sql security definer set search_path = public as $$
  insert into review_photo_reports (photo_id, reporter_id, reason)
  values (target_photo_id, auth.uid(), reason);
$$;

grant execute on function report_review_photo(uuid, text) to authenticated;
