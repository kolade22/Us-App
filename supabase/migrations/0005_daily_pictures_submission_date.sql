-- 0005_daily_pictures_submission_date.sql
-- Server-authoritative submission dates: a modified client must not be able
-- to backdate a "daily" picture or submit several per day by sending a
-- chosen submission_date. The trigger overwrites whatever the client passed
-- with the calendar date in the couple's configured timezone, so the
-- unique(couple_id, user_id, submission_date) constraint is enforced against
-- the server's clock, not the client's.

create or replace function public.set_daily_picture_submission_date()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_timezone text;
begin
  select timezone into v_timezone
  from public.couple_settings
  where couple_id = new.couple_id;

  -- Equivalent to:
  --   (now() AT TIME ZONE (SELECT timezone FROM couple_settings
  --                         WHERE couple_id = NEW.couple_id))::date
  -- with UTC fallbacks for a missing settings row or an invalid tz string.
  begin
    new.submission_date := (now() at time zone coalesce(v_timezone, 'UTC'))::date;
  exception
    when invalid_parameter_value or datetime_field_overflow then
      new.submission_date := (now() at time zone 'UTC')::date;
  end;

  return new;
end;
$$;

revoke execute on function public.set_daily_picture_submission_date()
  from public, anon, authenticated;

create trigger set_daily_picture_submission_date
  before insert on public.daily_pictures
  for each row
  execute function public.set_daily_picture_submission_date();
