-- Run the 30-day retention every night at 03:17 UTC (off the hour, away from the
-- midnight rush of new daily boards).
create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;

select cron.schedule('prune-leaderboard', '17 3 * * *', $$select public.prune_leaderboard()$$);
