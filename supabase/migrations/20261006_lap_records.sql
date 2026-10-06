-- Lap records for /records: the fastest Daily Quali lap ever timed on each
-- circuit and condition, per physics version (a new physics version starts new
-- records). Anonymous by construction: a time and a date, no device id, so the
-- 30-day retention of daily_laps and the right to erasure don't need to reach
-- it. Kept by a trigger on daily_laps; read through lap_records() only.
create table public.lap_records (
  track_id text not null check (track_id ~ '^[a-z0-9-]{2,32}$'),
  condition text not null check (condition in ('dry', 'wet', 'lowdf')),
  physics_version text not null,
  lap_ms integer not null check (lap_ms between 10000 and 600000),
  day date not null,
  set_at timestamptz not null default now(),
  primary key (track_id, condition, physics_version)
);
alter table public.lap_records enable row level security;
-- no policies: the browser reads through the function below

create function public.keep_lap_record()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.lap_records (track_id, condition, physics_version, lap_ms, day)
  values (new.track_id, new.condition, new.physics_version, new.lap_ms, new.day)
  on conflict (track_id, condition, physics_version) do update
    set lap_ms = excluded.lap_ms, day = excluded.day, set_at = now()
    where excluded.lap_ms < public.lap_records.lap_ms;
  return null;
end;
$$;
revoke all on function public.keep_lap_record() from public, anon, authenticated;

create trigger daily_laps_keep_record
after insert or update of lap_ms on public.daily_laps
for each row execute function public.keep_lap_record();

-- the laps already on the board
insert into public.lap_records (track_id, condition, physics_version, lap_ms, day)
select distinct on (track_id, condition, physics_version) track_id, condition, physics_version, lap_ms, day
from public.daily_laps
order by track_id, condition, physics_version, lap_ms, day
on conflict do nothing;

-- every record for one physics version
create function public.lap_records(p_physics text)
returns table (track_id text, condition text, lap_ms integer, day date)
language sql
stable
security definer
set search_path = ''
as $$
  select r.track_id, r.condition, r.lap_ms, r.day
  from public.lap_records r
  where r.physics_version = p_physics;
$$;

-- each daily board of the last p_days days (at most 30): totals only, never a device or a line
create function public.recent_boards(p_days integer default 30)
returns table (day date, track_id text, condition text, players integer, best_ms integer, median_ms integer)
language sql
stable
security definer
set search_path = ''
as $$
  select l.day, l.track_id, l.condition, count(*)::integer, min(l.lap_ms),
         (percentile_disc(0.5) within group (order by l.lap_ms))::integer
  from public.daily_laps l
  where l.day >= current_date - least(greatest(p_days, 1), 30)
  group by l.day, l.track_id, l.condition
  order by l.day desc;
$$;

revoke all on function public.lap_records(text) from public;
revoke all on function public.recent_boards(integer) from public;
grant execute on function public.lap_records(text) to anon, authenticated;
grant execute on function public.recent_boards(integer) to anon, authenticated;
