-- The standings page: one place for each driver, no ties.
-- 1. Which daily games a device finished each day (daily_players.games), written by record_game from the app after the
--    day's "played" row exists. Used only to split ties in the Championship.
-- 2. The Championship: most Grands Prix this month, then the longer current run, then more daily games finished this
--    month, then whoever started earlier, then the name: every driver gets their own place (row_number).
-- 3. The day's board: every driver who set a lap (named or not), one place each: the faster lap, then whoever set it
--    first. daily_board (the names-only board under the result) gets the same single places.

alter table public.daily_players add column if not exists games text[] not null default '{}';

-- A daily game finished today: added to the device's row for the day (it never creates one).
create or replace function public.record_game(p_day date, p_device uuid, p_game text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.daily_players
     set games = case when p_game = any(games) then games else array_append(games, p_game) end
   where day = p_day and device_id = p_device
     and p_game ~ '^[a-z-]{2,24}$'
     and abs(p_day - current_date) <= 1
     and coalesce(array_length(games, 1), 0) < 16;
$$;
revoke all on function public.record_game(date, uuid, text) from public;
grant execute on function public.record_game(date, uuid, text) to anon, authenticated, service_role;

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
    select p.device_id, p.day, coalesce(array_length(p.games, 1), 0) as games from public.daily_players p join named n on n.device_id = p.device_id where p.day <= p_today
  ),
  month as (
    select device_id, count(*)::integer as gps, sum(games)::integer as games from days
    where day >= date_trunc('month', p_today)::date
    group by device_id
  ),
  tot as (
    select device_id, count(*)::integer as total, min(day) as first_day from days group by device_id
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
    (row_number() over (order by m.gps desc, coalesce(c.streak, 0) desc, m.games desc, t.first_day, n.nickname))::integer,
    n.nickname, m.gps, coalesce(c.streak, 0)::integer, t.total, n.badge
  from month m
  join named n on n.device_id = m.device_id
  join tot t on t.device_id = m.device_id
  left join cur c on c.device_id = m.device_id
  order by 1
  limit least(greatest(p_limit, 1), 500);
$$;

-- The day's full board for the standings page: every lap, named or not, one place each.
create or replace function public.day_board(p_day date, p_track text, p_condition text, p_limit integer default 200)
returns table(pos integer, nickname text, lap_ms integer, badge boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select (row_number() over (order by l.lap_ms, l.updated_at))::integer, n.nickname, l.lap_ms, coalesce(n.badge, false)
  from public.daily_laps l
  left join public.nicknames n on n.device_id = l.device_id
  where l.day = p_day and l.track_id = p_track and l.condition = p_condition
  order by 1
  limit least(greatest(p_limit, 1), 500);
$$;
revoke all on function public.day_board(date, text, text, integer) from public;
grant execute on function public.day_board(date, text, text, integer) to anon, authenticated, service_role;

create or replace function public.daily_board(p_day date, p_track text, p_condition text, p_limit integer default 10)
returns table(pos integer, nickname text, lap_ms integer, badge boolean)
language sql
stable
security definer
set search_path = ''
as $$
  with ranked as (
    select l.device_id, l.lap_ms, (row_number() over (order by l.lap_ms, l.updated_at))::integer as pos
    from public.daily_laps l
    where l.day = p_day and l.track_id = p_track and l.condition = p_condition
  )
  select r.pos, n.nickname, r.lap_ms, n.badge
  from ranked r join public.nicknames n on n.device_id = r.device_id
  order by r.pos
  limit least(greatest(p_limit, 1), 50);
$$;
