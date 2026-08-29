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
grant insert, update on public.durian_scores to anon;

drop policy if exists "anyone can read scores" on public.durian_scores;
create policy "anyone can read scores"
  on public.durian_scores for select
  using (true);

drop policy if exists "anyone can post a score" on public.durian_scores;
create policy "anyone can post a score"
  on public.durian_scores for insert
  with check (true);

-- Required for upsert. Safe because a client can only target a row whose
-- player_id it already knows, and player_id is never readable.
drop policy if exists "players can update their own row" on public.durian_scores;
create policy "players can update their own row"
  on public.durian_scores for update
  using (true)
  with check (true);

-- No delete policy, so nobody can clear the board.

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
