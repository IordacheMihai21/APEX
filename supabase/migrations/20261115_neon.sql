-- Vice City week (14 to 23 Nov 2026): the Neon car (hot pink fading to turquoise, public/cars/neon.webp) for three
-- friends who played, pickable until 23 Nov; drivers who picked it keep it afterwards. Same rules otherwise as
-- 20261114_team.sql.
create or replace function public.set_colour(p_device uuid, p_code text, p_colour text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_colour not in ('papaya','red','blue','sky','green','lime','yellow','white','silver','purple','magenta','cyan','gold','neon') then
    return 'invalid';
  end if;
  if p_colour = 'neon' and current_date > date '2026-11-23'
     and not exists (select 1 from public.nicknames where device_id = p_device and colour = 'neon') then
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
