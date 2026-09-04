-- Is prestige actually reaching the board?
--
-- 1. Does the column exist at all?
select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'durian_scores'
  and column_name = 'golden_shines';
-- No row back = leaderboard-guard.sql has not been applied.

-- 2. Does the submit function declare the parameter?
select p.oid::regprocedure as signature
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'submit_durian_score';
-- Expect ONE row, ending in ", integer)" twelve types long. Two rows means the
-- old function was not dropped and calls may still hit it.

-- 3. What is actually stored, newest writes first?
select name, golden_shines, total_display, updated_at
from public.durian_scores
order by updated_at desc
limit 15;
-- If your row shows golden_shines = 0 but you have prestiged, the row simply
-- has not been rewritten since the change. Play for a minute, or claim a
-- Shine, and it will resubmit.
