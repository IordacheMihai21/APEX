-- The Championship: a monthly board of the named players who came back most. A Grand Prix is a day with a daily game
-- finished (one row per device per day in daily_players, written by submit-lap "played"). Days are now kept 400 days
-- (they were 30), so a month's count and the all-time total within that window can be read; nicknames now stay while
-- their device keeps playing any daily game, not only the Daily Quali.

-- Named players this month, most Grands Prix first, ties broken by the current run of days in a row (a run counts
-- while its last day is today or yesterday). total is every Grand Prix in the retention window.
create or replace function public.championship(p_today date, p_limit integer default 10)
returns table(pos integer, nickname text, gps integer, streak integer, total integer, badge boolean)
language sql
stable
security definer
set search_path = ''
as $$
  with named as (
    select device_id, nickname, badge from public.nicknames
  ),
  days as (
    select p.device_id, p.day from public.daily_players p join named n on n.device_id = p.device_id where p.day <= p_today
  ),
  month as (
    select device_id, count(*)::integer as gps from days
    where day >= date_trunc('month', p_today)::date
    group by device_id
  ),
  tot as (
    select device_id, count(*)::integer as total from days group by device_id
  ),
  runs as (
    select device_id, day, day - (row_number() over (partition by device_id order by day))::integer as grp from days
  ),
  islands as (
    select device_id, max(day) as last_day, count(*)::integer as len from runs group by device_id, grp
  ),
  cur as (
    select device_id, max(len) as streak from islands where last_day >= p_today - 1 group by device_id
  )
  select
    (rank() over (order by m.gps desc, coalesce(c.streak, 0) desc))::integer,
    n.nickname, m.gps, coalesce(c.streak, 0)::integer, t.total, n.badge
  from month m
  join named n on n.device_id = m.device_id
  join tot t on t.device_id = m.device_id
  left join cur c on c.device_id = m.device_id
  order by 1, n.nickname
  limit least(greatest(p_limit, 1), 50);
$$;
revoke all on function public.championship(date, integer) from public;
grant execute on function public.championship(date, integer) to anon, authenticated, service_role;

-- Retention: days 400 days; a nickname goes once its device hasn't played a daily game for 30 days.
create or replace function public.prune_leaderboard()
returns void
language sql
security invoker
set search_path = ''
as $$
  delete from public.daily_laps where day < current_date - 30;
  delete from public.submit_rate where window_start < now() - interval '2 days';
  delete from public.daily_players where day < current_date - 400;
  delete from public.invites where day < current_date - 180;
  delete from public.nicknames n
    where n.updated_at < now() - interval '30 days'
      and not exists (select 1 from public.daily_players p where p.device_id = n.device_id and p.day >= current_date - 30);
$$;
