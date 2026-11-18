-- Publish the two paint colours a named driver selected in the 3D Garage.
-- Existing names begin with the default car until they next open Garage or update their name.
alter table public.nicknames add column if not exists garage_paint text not null default '#ff6a13';
alter table public.nicknames add column if not exists garage_paint2 text not null default '#141518';

create or replace function public.set_garage_look(p_device uuid, p_code text, p_paint text, p_paint2 text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  friends integer;
begin
  if not exists (select 1 from public.nicknames where device_id = p_device) then return 'noname'; end if;
  friends := (select count(*) from public.invites where invite_code = p_code);
  if p_paint = '#6945ff' or p_paint2 = '#b8ff3b' then
    if friends < 1 and not exists (select 1 from public.nicknames where device_id = p_device and (garage_paint = '#6945ff' or garage_paint2 = '#b8ff3b')) then return 'locked'; end if;
  end if;
  if p_paint = '#ff2d95' or p_paint2 = '#19e3d6' then
    if friends < 3 and not exists (select 1 from public.nicknames where device_id = p_device and (garage_paint = '#ff2d95' or garage_paint2 = '#19e3d6')) then return 'locked'; end if;
  end if;
  if p_paint not in ('#6945ff','#ff2d95','#ff6a13','#e10600','#1e5bc6','#00a19c','#2fa84f','#ffd400','#ff2d8a','#7a3cff','#f2f2ee','#141518') then
    return 'invalid';
  end if;
  if p_paint2 not in ('#141518','#f2f2ee','#3b4048','#c9a227','#0d2a5c','#b8ff3b','#19e3d6') then return 'invalid'; end if;
  update public.nicknames set garage_paint = p_paint, garage_paint2 = p_paint2 where device_id = p_device;
  return 'ok';
end;
$$;
revoke all on function public.set_garage_look(uuid, text, text, text) from public;
grant execute on function public.set_garage_look(uuid, text, text, text) to anon, authenticated, service_role;

-- Only colours for names already visible on a public standings board are returned.
create or replace function public.standings_looks(p_names text[])
returns table(nickname text, paint text, paint2 text)
language sql
stable
security definer
set search_path = ''
as $$
  select n.nickname, n.garage_paint, n.garage_paint2
  from public.nicknames n
  where n.nickname = any(p_names)
  limit 500;
$$;
revoke all on function public.standings_looks(text[]) from public;
grant execute on function public.standings_looks(text[]) to anon, authenticated, service_role;
