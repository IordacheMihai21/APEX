-- Restore a device's progress from its restore link (lapdle.com/?restore=<device id>): the nickname and the days it
-- played, so a player whose browser forgot the site (Instagram's in-app browser, cleared history, a new phone) gets
-- their name, Championship and streak back. The device id is a random UUID only its owner has (shown in the menu as
-- the restore link), so it works as the key; nothing else about the device is returned.
create or replace function public.restore_device(p_device uuid)
returns table(nickname text, badge boolean, days date[])
language sql
stable
security definer
set search_path = ''
as $$
  with d as (
    select day from public.daily_players where device_id = p_device
    union
    select day from public.daily_laps where device_id = p_device
  )
  select n.nickname, coalesce(n.badge, false), coalesce((select array_agg(day order by day) from d), '{}')
  from (select 1) one
  left join public.nicknames n on n.device_id = p_device
  where n.device_id is not null or exists (select 1 from d);
$$;
revoke all on function public.restore_device(uuid) from public;
grant execute on function public.restore_device(uuid) to anon, authenticated, service_role;
