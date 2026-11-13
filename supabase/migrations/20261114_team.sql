-- The team grid (/team): every device that played a daily game on a day is a car on that day's grid, in the order they
-- joined it. Named drivers show their name, in their car colour; a colour other than Papaya needs three friends who
-- played from the driver's invite link (checked here against the invites); drivers without a name are grey cars.

alter table public.nicknames add column if not exists colour text not null default 'papaya';
alter table public.daily_players add column if not exists created_at timestamptz default now();

-- Set the car colour of a named device. Returns 'ok', 'noname', 'locked' (fewer than three friends) or 'invalid'.
create or replace function public.set_colour(p_device uuid, p_code text, p_colour text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_colour not in ('papaya','red','blue','sky','green','lime','yellow','white','silver','purple','magenta','cyan','gold') then
    return 'invalid';
  end if;
  if not exists (select 1 from public.nicknames where device_id = p_device) then
    return 'noname';
  end if;
  if p_colour <> 'papaya' and (p_code is null or (select count(*) from public.invites where invite_code = p_code) < 3) then
    return 'locked';
  end if;
  update public.nicknames set colour = p_colour where device_id = p_device;
  return 'ok';
end;
$$;
revoke all on function public.set_colour(uuid, text, text) from public;
grant execute on function public.set_colour(uuid, text, text) to anon, authenticated, service_role;

-- A day's grid: one car per device that played, in the order they joined (the oldest rows, before the time was kept,
-- first), with the name, colour and gold star of named drivers.
create or replace function public.team_grid(p_day date, p_limit integer default 1000)
returns table(pos integer, nickname text, colour text, badge boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select (row_number() over (order by p.created_at nulls first, p.device_id))::integer,
         n.nickname, case when n.nickname is null then 'grey' else n.colour end, coalesce(n.badge, false)
  from public.daily_players p
  left join public.nicknames n on n.device_id = p.device_id
  where p.day = p_day
  order by 1
  limit least(greatest(p_limit, 1), 1000);
$$;
revoke all on function public.team_grid(date, integer) from public;
grant execute on function public.team_grid(date, integer) to anon, authenticated, service_role;

-- The cars on each day of the challenge, from its first day.
create or replace function public.team_days(p_from date)
returns table(day date, cars integer)
language sql
stable
security definer
set search_path = ''
as $$
  select d::date, (select count(*)::integer from public.daily_players p where p.day = d::date)
  from generate_series(p_from, current_date + 1, interval '1 day') d
  order by 1;
$$;
revoke all on function public.team_days(date) from public;
grant execute on function public.team_days(date) to anon, authenticated, service_role;
