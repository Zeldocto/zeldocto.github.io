-- =============================================================================
-- Durian Clicker — leaderboard fix-up
-- =============================================================================
-- Run this if you already created the durian_scores table and submits are
-- failing with "permission denied for table durian_scores".
--
-- What changes: writes stop going straight at the table and go through a
-- security-definer function instead. The function runs as its owner, so the
-- anon role needs nothing but EXECUTE. That removes the whole class of
-- privilege problems, and is stricter than before — anon can no longer insert
-- or update arbitrary rows at all.
--
-- Safe to run more than once.
-- =============================================================================

-- 1. Anon no longer writes to the table directly.
revoke insert, update, delete on public.durian_scores from anon;

-- 2. Reads stay as they were: every public column, but never player_id.
grant select (public_id, name, total_log, total_display, dps_log, dps_display,
              play_time, total_clicks, workers, achievements, updated_at)
  on public.durian_scores to anon;

alter table public.durian_scores enable row level security;

drop policy if exists "anyone can read scores" on public.durian_scores;
create policy "anyone can read scores"
  on public.durian_scores for select using (true);

-- The old write policies are no longer used by anything. Dropping them keeps
-- the intent clear: nothing writes to this table except the function below.
drop policy if exists "anyone can post a score" on public.durian_scores;
drop policy if exists "players can update their own row" on public.durian_scores;

-- 3. The one supported way to write a score.
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
begin
  if p_player_id is null or char_length(p_player_id) < 8 then
    raise exception 'Bad player id';
  end if;
  if p_name is null or char_length(btrim(p_name)) < 2 or char_length(p_name) > 20 then
    raise exception 'Name must be 2 to 20 characters';
  end if;

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

-- 4. Tell PostgREST about the new function.
notify pgrst, 'reload schema';

-- =============================================================================
-- Check it worked. This should insert a row and return it.
--
--   select public.submit_durian_score(
--     'test-player-0001', 'test-public-0001', 'SQL Test',
--     6.0, '1.00M', 3.0, '1.00K', 120, 500, 10, 3);
--
--   select name, total_display, dps_display from public.durian_scores;
--
-- Then clean up:
--
--   delete from public.durian_scores where player_id = 'test-player-0001';
-- =============================================================================
