-- =============================================================================
-- leaderboard-guard.sql — server-side score checks.
-- -----------------------------------------------------------------------------
-- Run this AFTER leaderboard-setup.sql and leaderboard-fix.sql, in the Supabase
-- SQL editor. It replaces submit_durian_score with the same signature plus
-- limits, so the client needs no changes and nothing else has to be touched.
--
-- Why this exists: everything in js/ runs on the player's machine and can be
-- edited by anyone who opens devtools. This is the one layer they cannot reach.
-- It does not try to detect cheating cleverly — it rejects scores that are
-- impossible for the play time claimed, which is enough to keep the board
-- honest.
--
-- Rejected submissions raise an exception. The game reports it as a failed
-- submission and carries on; nobody loses their save.
-- =============================================================================

create or replace function public.submit_durian_score(
  p_player_id     text,
  p_public_id     text,
  p_name          text,
  p_total_log     double precision,
  p_total_display text,
  p_dps_log       double precision,
  p_dps_display   text,
  p_play_time     integer,
  p_total_clicks  bigint,
  p_workers       integer,
  p_achievements  integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  -- Highest log10(total) an honest save can hold. Check with `node balance.js`
  -- after a big content update and raise it then. Generous on purpose.
  ceiling_log         constant double precision := 90;
  -- How fast production can climb, in log10 per hour played, plus a starting
  -- allowance. Checked against a real endgame save: this binds for roughly the
  -- first day and a half, which is where an invented score shows up, and never
  -- troubles an honest player after that.
  --
  -- These are deliberately loose. The ceiling and bank-lead rules below are
  -- principled — they follow from what the content can actually reach — but
  -- "how fast can production legitimately grow" is guesswork, and a wrong
  -- guess silently blocks real players. This is set to catch 1e80 after ten
  -- minutes, nothing subtler.
  start_allowance     constant double precision := 20;
  max_log_per_hour    constant double precision := 10;
  -- How far a bank may run ahead of production. Offline caps at 49 days (~6.6
  -- in log10) and event windfalls add more, so 12 leaves real room while still
  -- catching a huge total attached to a small rate.
  max_bank_lead       constant double precision := 12;
  -- The click limiter caps paid clicks at 30/sec; 200 leaves room for the
  -- overflow and for clock jitter, while still catching invented numbers.
  max_clicks_per_sec  constant double precision := 200;
  allowed_dps         double precision;
begin
  if p_player_id is null or char_length(p_player_id) < 8 then
    raise exception 'Bad player id';
  end if;
  if p_name is null or char_length(btrim(p_name)) < 2 or char_length(p_name) > 20 then
    raise exception 'Name must be 2 to 20 characters';
  end if;

  -- ---------------------------------------------------------------- limits --
  if coalesce(p_total_log, 0) > ceiling_log or coalesce(p_dps_log, 0) > ceiling_log then
    raise exception 'Score above the possible ceiling';
  end if;

  if coalesce(p_total_log, 0) > coalesce(p_dps_log, 0) + max_bank_lead then
    raise exception 'Total is impossible for that production rate';
  end if;

  if coalesce(p_play_time, 0) > 0 then
    allowed_dps := start_allowance + max_log_per_hour * (p_play_time / 3600.0);
    if coalesce(p_dps_log, 0) > allowed_dps then
      raise exception 'Production too high for the time played';
    end if;

    if coalesce(p_total_clicks, 0) > p_play_time::double precision * max_clicks_per_sec then
      raise exception 'More clicks than the time played allows';
    end if;
  elsif coalesce(p_dps_log, 0) > start_allowance then
    -- No play time recorded but a large rate claimed.
    raise exception 'Production too high for the time played';
  end if;

  if coalesce(p_workers, 0) > 200000 or coalesce(p_achievements, 0) > 1000 then
    raise exception 'Crew or achievement count out of range';
  end if;

  -- ----------------------------------------------------------------- write --
  insert into public.durian_scores (
    player_id, public_id, name,
    total_log, total_display, dps_log, dps_display,
    play_time, total_clicks, workers, achievements, updated_at
  ) values (
    p_player_id, p_public_id, btrim(p_name),
    greatest(coalesce(p_total_log, 0), 0), coalesce(p_total_display, '0'),
    greatest(coalesce(p_dps_log, 0), 0), coalesce(p_dps_display, '0'),
    greatest(coalesce(p_play_time, 0), 0), greatest(coalesce(p_total_clicks, 0), 0),
    greatest(coalesce(p_workers, 0), 0), greatest(coalesce(p_achievements, 0), 0),
    now()
  )
  on conflict (player_id) do update set
    public_id     = excluded.public_id,
    name          = excluded.name,
    total_log     = excluded.total_log,
    total_display = excluded.total_display,
    dps_log       = excluded.dps_log,
    dps_display   = excluded.dps_display,
    play_time     = excluded.play_time,
    total_clicks  = excluded.total_clicks,
    workers       = excluded.workers,
    achievements  = excluded.achievements,
    updated_at    = now();
end;
$$;

revoke all on function public.submit_durian_score(
  text, text, text, double precision, text, double precision, text,
  integer, bigint, integer, integer) from public;

grant execute on function public.submit_durian_score(
  text, text, text, double precision, text, double precision, text,
  integer, bigint, integer, integer) to anon;

notify pgrst, 'reload schema';

-- =============================================================================
-- Afterwards: find rows already on the board that the new rules would reject.
-- Review them by hand; this does not delete anything.
--
--   select public_id, name, total_log, dps_log, play_time, total_clicks
--   from public.durian_scores
--   where total_log > 90
--      or total_log > dps_log + 12
--      or (play_time > 0 and dps_log > 12 + 2.5 * (play_time / 3600.0))
--      or (play_time > 0 and total_clicks > play_time * 200)
--   order by total_log desc;
--
-- Then remove the ones you want gone, by id:
--
--   delete from public.durian_scores where public_id in ('...', '...');
-- =============================================================================
