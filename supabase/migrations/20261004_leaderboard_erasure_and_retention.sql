-- Right to erasure: remove every leaderboard row for one device id.
create function public.forget_device(p_device uuid)
returns integer
language sql
security invoker
set search_path = ''
as $$
  with gone as (delete from public.daily_laps where device_id = p_device returning 1)
  select count(*)::integer from gone;
$$;

-- Storage limitation: results are kept 30 days, rate counters 2 days.
create function public.prune_leaderboard()
returns void
language sql
security invoker
set search_path = ''
as $$
  delete from public.daily_laps where day < current_date - 30;
  delete from public.submit_rate where window_start < now() - interval '2 days';
$$;

revoke all on function public.forget_device(uuid) from public, anon, authenticated;
revoke all on function public.prune_leaderboard() from public, anon, authenticated;
grant execute on function public.forget_device(uuid) to service_role;
grant execute on function public.prune_leaderboard() to service_role;
