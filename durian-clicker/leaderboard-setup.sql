-- =============================================================================
-- Durian Clicker — leaderboard table
-- =============================================================================
-- Paste this whole file into the Supabase SQL editor and run it once.
-- Then put your project URL and anon key into CONFIG.leaderboard.supabase
-- in js/config.js and set provider to 'supabase'.
--
-- Read the security notes at the bottom before you go public with this.
-- =============================================================================

create table if not exists public.durian_scores (
  -- Private row key. The client keeps this in its save file and sends it on
  -- upsert. It is NEVER granted for select, so nobody can learn someone else's
  -- key and overwrite their score.
  player_id      text primary key,

  -- Public identity. Safe to publish — it only lets a client recognise its own
  -- row in the results.
  public_id      text not null,

  name           text not null,

  -- Scores travel as a pair: log10 for sorting (a double ranks accurately well
  -- past 10^300) and a preformatted string for display.
  total_log      double precision not null,
  total_display  text not null,
  dps_log        double precision not null default 0,
  dps_display    text not null default '0',

  -- Context. Not verification, but enough to eyeball an obviously fake entry.
  play_time      integer not null default 0,
  total_clicks   bigint  not null default 0,
  workers        integer not null default 0,
  achievements   integer not null default 0,

  updated_at     timestamptz not null default now(),

  -- Cheap sanity limits. These stop typos and lazy nonsense, nothing more.
  constraint name_length     check (char_length(name) between 2 and 20),
  constraint sane_total      check (total_log >= 0 and total_log < 1000),
  constraint sane_dps        check (dps_log >= 0 and dps_log < 1000),
  constraint sane_playtime   check (play_time >= 0 and play_time < 31536000)
);

create index if not exists durian_scores_total_idx on public.durian_scores (total_log desc);
create index if not exists durian_scores_dps_idx   on public.durian_scores (dps_log desc);

-- ----------------------------------------------------------------- security --

alter table public.durian_scores enable row level security;

-- Column-level select grant. Note that player_id is deliberately absent:
-- even a hand-written ?select=player_id request is refused.
revoke all on public.durian_scores from anon;
grant select (public_id, name, total_log, total_display, dps_log, dps_display,
              play_time, total_clicks, workers, achievements, updated_at)
  on public.durian_scores to anon;
-- Deliberately NO insert/update grant: writes go through the function below.

drop policy if exists "anyone can read scores" on public.durian_scores;
create policy "anyone can read scores"
  on public.durian_scores for select
  using (true);

-- No insert/update/delete policies. The only way to write a score is the
-- security-definer function below, which runs as its owner. That keeps anon
-- from touching rows directly and sidesteps needing any privilege on the
-- private player_id column.

-- --------------------------------------------------------- the write path --

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

notify pgrst, 'reload schema';

-- ------------------------------------------------------ optional: plausibility

-- A rough brake on obviously impossible scores. It rejects an entry claiming
-- more orders of magnitude than the play time could plausibly produce. Tune the
-- numbers against your own game before enabling — set them too tight and you
-- will reject legitimate long-session players.
--
-- create or replace function public.durian_plausible()
-- returns trigger language plpgsql as $$
-- begin
--   if new.total_log > 6 + (new.play_time / 300.0) then
--     raise exception 'Implausible score for play time';
--   end if;
--   new.updated_at := now();
--   return new;
-- end $$;
--
-- create trigger durian_plausible_check
--   before insert or update on public.durian_scores
--   for each row execute function public.durian_plausible();

-- =============================================================================
-- SECURITY NOTES — please read
-- =============================================================================
-- The anon key ships inside the game's JavaScript. That is normal and intended
-- for Supabase, but it means anyone can read the key and POST whatever they
-- like. The policies above protect the *integrity of other people's rows* --
-- nobody can edit or delete your score. They do not and cannot verify that a
-- score was legitimately earned.
--
-- Concretely: a determined player can open the console and submit any number.
-- The game even ships a debug menu that grants a quadrillion Durians. Treat
-- this board as a vanity scoreboard, not a record sheet.
--
-- If you want something you would actually stand behind, the shape that works
-- is the one you already use for run verification: submissions become claims,
-- and a human approves them. Add an `approved boolean default false` column,
-- filter the public read policy to `using (approved)`, and review new rows
-- yourself. The play_time / total_clicks / workers columns exist to make that
-- review quick — a 10-second play time next to a 10^40 score is not subtle.
-- =============================================================================
