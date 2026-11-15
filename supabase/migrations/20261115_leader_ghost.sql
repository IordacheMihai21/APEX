-- The leader's ghost in the 3D lap: the day's fastest lap on a board (its line, its time, its driver's board name if
-- they have one), so a driver can watch their own lap against it in 3D. Only for a device that has already put a lap
-- on that board, and the game only asks once the driver's laps for the day are done, so nobody can copy the leader's
-- line while they still have laps to drive.
create or replace function public.daily_leader(p_day date, p_track text, p_condition text, p_device uuid)
returns table(nickname text, lap_ms integer, knots jsonb, physics_version text)
language sql
stable
security definer
set search_path = ''
as $$
  select n.nickname, l.lap_ms, l.knots, l.physics_version
  from public.daily_laps l
  left join public.nicknames n on n.device_id = l.device_id
  where l.day = p_day and l.track_id = p_track and l.condition = p_condition
    and exists (
      select 1 from public.daily_laps me
      where me.day = p_day and me.track_id = p_track and me.condition = p_condition and me.device_id = p_device
    )
  order by l.lap_ms, l.updated_at
  limit 1;
$$;
revoke all on function public.daily_leader(date, text, text, uuid) from public;
grant execute on function public.daily_leader(date, text, text, uuid) to anon, authenticated, service_role;
