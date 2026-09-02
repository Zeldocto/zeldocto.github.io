-- leaderboard-guard.sql
--
-- OPTIONAL. Everything in the game is client-side, so the checks that ship in
-- js/save.js and js/game.js can be worked around by anyone comfortable in the
-- console. This is the only layer that cannot: it runs on Supabase, where the
-- player has no reach.
--
-- It does not try to detect cheating cleverly. It rejects scores that are
-- physically impossible for the play time claimed, which is enough to keep the
-- top of the board honest.
--
-- Run it in the Supabase SQL editor after leaderboard-setup.sql.

-- 1. Record how long the run took, so the ceiling has something to work from.
alter table public.durian_scores
  add column if not exists play_seconds double precision default 0;

-- 2. The ceiling.
--
-- Production is bounded by what the catalogue can reach. Set CEILING_LOG10 to
-- a little above the highest log10(dps) an honest maxed player can hold — check
-- it with `node balance.js` after any big content update and raise it then.
-- A submission above the ceiling, or one claiming a rate it has not had time to
-- reach, is rejected outright.
create or replace function public.submit_durian_score(
  p_player_id   uuid,
  p_public_id   uuid,
  p_name        text,
  p_total_log10 double precision,
  p_dps_log10   double precision,
  p_total_display text,
  p_dps_display   text,
  p_play_seconds  double precision default 0
)
returns void
language plpgsql
security definer
as $$
declare
  ceiling_log10 constant double precision := 80;   -- review after content updates
  -- Nobody reaches a given rate faster than this. Generous on purpose: it is
  -- here to catch 1e300, not to second-guess a good player.
  max_log10_per_hour constant double precision := 6;
  allowed double precision;
begin
  if p_name is null or length(trim(p_name)) < 2 then
    raise exception 'name too short';
  end if;

  if p_total_log10 is null or p_dps_log10 is null then
    raise exception 'missing score';
  end if;

  if p_total_log10 > ceiling_log10 or p_dps_log10 > ceiling_log10 then
    raise exception 'score above the possible ceiling';
  end if;

  -- You cannot bank more than you produce, give or take a long idle stretch.
  if p_total_log10 > p_dps_log10 + 9 then
    raise exception 'total is impossible for that production rate';
  end if;

  if coalesce(p_play_seconds, 0) > 0 then
    allowed := 6 + max_log10_per_hour * (p_play_seconds / 3600.0);
    if p_dps_log10 > allowed then
      raise exception 'production too high for the time played';
    end if;
  end if;

  insert into public.durian_scores as d
    (player_id, public_id, name, total_log10, dps_log10,
     total_display, dps_display, play_seconds, updated_at)
  values
    (p_player_id, p_public_id, trim(p_name), p_total_log10, p_dps_log10,
     p_total_display, p_dps_display, coalesce(p_play_seconds, 0), now())
  on conflict (player_id) do update
    set name          = excluded.name,
        public_id     = excluded.public_id,
        total_log10   = excluded.total_log10,
        dps_log10     = excluded.dps_log10,
        total_display = excluded.total_display,
        dps_display   = excluded.dps_display,
        play_seconds  = excluded.play_seconds,
        updated_at    = now()
    -- and never let a row go backwards, which stops a rejected client from
    -- overwriting a good score with a bad one
    where excluded.total_log10 >= d.total_log10;
end;
$$;

-- 3. Housekeeping: find rows that look wrong, so you can remove them by hand.
--
--   select public_id, name, total_log10, dps_log10, play_seconds
--   from public.durian_scores
--   where total_log10 > 80
--      or total_log10 > dps_log10 + 9
--      or (play_seconds > 0 and dps_log10 > 6 + 6 * (play_seconds / 3600.0))
--   order by total_log10 desc;
