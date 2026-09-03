-- 1. Exactly one submit_durian_score should exist. Two rows here means the
--    guard was added as an overload instead of replacing the old function,
--    and the unguarded one may still be the one getting called.
select p.oid::regprocedure as signature
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'submit_durian_score';

-- 2. Confirm the limits are actually in the deployed body.
select position('ceiling_log' in pg_get_functiondef(p.oid)) > 0 as guard_is_live
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'submit_durian_score';

-- 3. Rows already on the board that the new rules would reject.
--    Nothing is deleted; review before removing anything.
select public_id, name, total_display, dps_display, play_time, total_clicks,
       case
         when total_log > 300 then 'above ceiling'
         when total_log > dps_log + 12 then 'bank runs too far ahead of production'
         when play_time > 0 and dps_log > 20 + 10 * (play_time / 3600.0)
              then 'production too high for time played'
         when play_time > 0 and total_clicks > play_time * 200 then 'impossible click count'
         else 'ok'
       end as verdict
from public.durian_scores
where total_log > 300
   or total_log > dps_log + 12
   or (play_time > 0 and dps_log > 20 + 10 * (play_time / 3600.0))
   or (play_time > 0 and total_clicks > play_time * 200)
order by total_log desc;
