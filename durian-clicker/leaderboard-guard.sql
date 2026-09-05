-- =============================================================================
-- leaderboard-guard.sql — server-side score checks, and Golden Shines on the board.
-- -----------------------------------------------------------------------------
-- Run this AFTER leaderboard-setup.sql and leaderboard-fix.sql, in the Supabase
-- SQL editor. Safe to re-run at any time.
--
-- Everything in js/ runs on the player's machine and can be edited by anyone
-- who opens devtools. This is the one layer they cannot reach.
--
-- It rejects ONLY what the game physically cannot produce: a total beyond the
-- content's reach, and a bank that has run impossibly far ahead of the rate
-- producing it. Rules based on how people PLAY — clicks per second, production
-- against time played — were tried and removed. Both rejected honest players:
-- autoclickers are allowed at any speed, and someone returning from weeks
-- offline legitimately has a huge rate on a small play time. A rule that blocks
-- a real player is worse than one that lets an absurd score through.
--
-- This version also adds the golden_shines column and parameter, so prestige
-- shows on the board.
-- =============================================================================

-- 1. Prestige needs somewhere to live.
alter table public.durian_scores
  add column if not exists golden_shines integer not null default 0;

alter table public.durian_scores
  drop constraint if exists sane_shines;
alter table public.durian_scores
  add constraint sane_shines check (golden_shines between 0 and 6);

-- 1b. Let readers actually SEE the new column.
--
-- The select grant in leaderboard-setup.sql is COLUMN-LEVEL, and it lists the
-- columns one by one. Adding golden_shines to the table therefore did not make
-- it readable: PostgREST refused the request, the client fell back to the old
-- column list, and every row arrived without prestige. player_id stays absent
-- on purpose so a hand-written ?select=player_id is still refused.
grant select (public_id, name, total_log, total_display, dps_log, dps_display,
              play_time, total_clicks, workers, achievements, golden_shines,
              updated_at)
  on public.durian_scores to anon;

-- 2. The submit function, with limits and the new parameter.
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
  p_achievements  integer,
  p_golden_shines integer default 0
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  -- Highest log10(total) an honest save can hold. Set deliberately far above
  -- anything reachable: the measured maximum with every upgrade and 5,000 of
  -- every crew is about 1e90. A ceiling that blocks a real player is worse
  -- than one that lets an absurd score through, so this only rejects obvious
  -- nonsense like 1e999. Recheck with `node balance.js` after a big content
  -- tier.
  ceiling_log     constant double precision := 300;

  -- How far a bank may run ahead of production. Offline caps at 49 days
  -- (~6.6 in log10) and event windfalls add more, so 12 leaves real room while
  -- still catching a huge total attached to a small rate.
  max_bank_lead   constant double precision := 12;
begin
  if p_player_id is null or char_length(p_player_id) < 8 then
    raise exception 'Bad player id';
  end if;
  if p_name is null or char_length(btrim(p_name)) < 2 or char_length(p_name) > 20 then
    raise exception 'Name must be 2 to 20 characters';
  end if;

  if coalesce(p_total_log, 0) > ceiling_log or coalesce(p_dps_log, 0) > ceiling_log then
    raise exception 'Score above the possible ceiling';
  end if;

  if coalesce(p_total_log, 0) > coalesce(p_dps_log, 0) + max_bank_lead then
    raise exception 'Total is impossible for that production rate';
  end if;

  -- Loose sanity only: real crews already run past 20,000.
  if coalesce(p_workers, 0) > 10000000 or coalesce(p_achievements, 0) > 100000 then
    raise exception 'Crew or achievement count out of range';
  end if;

  -- Six is the cap in the game, so anything above it did not come from playing.
  if coalesce(p_golden_shines, 0) < 0 or coalesce(p_golden_shines, 0) > 6 then
    raise exception 'Golden Shine count out of range';
  end if;

  insert into public.durian_scores (
    player_id, public_id, name,
    total_log, total_display, dps_log, dps_display,
    play_time, total_clicks, workers, achievements, golden_shines, updated_at
  ) values (
    p_player_id, p_public_id, btrim(p_name),
    greatest(coalesce(p_total_log, 0), 0), coalesce(p_total_display, '0'),
    greatest(coalesce(p_dps_log, 0), 0), coalesce(p_dps_display, '0'),
    greatest(coalesce(p_play_time, 0), 0), greatest(coalesce(p_total_clicks, 0), 0),
    greatest(coalesce(p_workers, 0), 0), greatest(coalesce(p_achievements, 0), 0),
    least(greatest(coalesce(p_golden_shines, 0), 0), 6),
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
    golden_shines = excluded.golden_shines,
    updated_at    = now();
end;
$$;

-- 3. The previous eleven-argument version must go, or PostgREST has two
--    candidates and an older client could still reach the unguarded one.
drop function if exists public.submit_durian_score(
  text, text, text, double precision, text, double precision, text,
  integer, bigint, integer, integer);

revoke all on function public.submit_durian_score(
  text, text, text, double precision, text, double precision, text,
  integer, bigint, integer, integer, integer) from public;

grant execute on function public.submit_durian_score(
  text, text, text, double precision, text, double precision, text,
  integer, bigint, integer, integer, integer) to anon;

notify pgrst, 'reload schema';

-- =============================================================================
-- Afterwards: rows the new rules would reject. Nothing is deleted; review
-- before removing anything.
--
--   select public_id, name, total_display, dps_display, golden_shines
--   from public.durian_scores
--   where total_log > 300
--      or total_log > dps_log + 12
--      or golden_shines not between 0 and 6
--   order by total_log desc;
--
--   delete from public.durian_scores where public_id in ('...', '...');
-- =============================================================================
