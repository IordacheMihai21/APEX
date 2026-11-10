-- Three things on top of the Daily Quali board, all anonymous:
--   1. nicknames: a player may give their device a nickname, and then their best lap shows by name on the day's board;
--   2. daily_players: one row per device per day a daily game was finished, for the public "road to 1,000" counter;
--   3. invites: who came in on a friend's invite link and went on to play, so the friend's rewards unlock.
-- Every write goes through the submit-lap edge function (service role). The read functions below are public and only
-- ever return nicknames, positions, times and totals: never a device id or an invite code's owner.

-- 1. Nicknames -----------------------------------------------------------------------------------------------------
create table if not exists public.nicknames (
  device_id uuid primary key,
  nickname text not null check (nickname ~ '^[A-Za-z0-9 _.-]{3,16}$'),
  badge boolean not null default false,
  updated_at timestamptz not null default now()
);
create unique index if not exists nicknames_lower on public.nicknames (lower(nickname));
alter table public.nicknames enable row level security;

-- The day's board by name: every named player's position among all of the day's players, fastest first.
create or replace function public.daily_board(p_day date, p_track text, p_condition text, p_limit integer default 10)
returns table(pos integer, nickname text, lap_ms integer, badge boolean)
language sql
stable
security definer
set search_path = ''
as $$
  with ranked as (
    select l.device_id, l.lap_ms, (rank() over (order by l.lap_ms))::integer as pos
    from public.daily_laps l
    where l.day = p_day and l.track_id = p_track and l.condition = p_condition
  )
  select r.pos, n.nickname, r.lap_ms, n.badge
  from ranked r join public.nicknames n on n.device_id = r.device_id
  order by r.pos, n.nickname
  limit least(greatest(p_limit, 1), 50);
$$;
revoke all on function public.daily_board(date, text, text, integer) from public;
grant execute on function public.daily_board(date, text, text, integer) to anon, authenticated, service_role;

-- 2. Players per day -------------------------------------------------------------------------------------------------
create table if not exists public.daily_players (
  day date not null,
  device_id uuid not null,
  primary key (day, device_id)
);
alter table public.daily_players enable row level security;

-- Today's count (by the players' own calendar day) and the best day so far.
create or replace function public.road_count(p_day date)
returns table(today integer, best integer)
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select count(*)::integer from public.daily_players where day = p_day),
    coalesce((select max(c)::integer from (select count(*) as c from public.daily_players group by day) t), 0);
$$;
revoke all on function public.road_count(date) from public;
grant execute on function public.road_count(date) to anon, authenticated, service_role;

-- 3. Invites ---------------------------------------------------------------------------------------------------------
-- An invite code is a random string made on the inviter's device (not its device id). A friend counts once, on the
-- day they first finish a daily game, and only if their device had never played before.
create table if not exists public.invites (
  friend_device uuid primary key,
  invite_code text not null check (invite_code ~ '^[a-z0-9]{10}$'),
  day date not null default current_date
);
create index if not exists invites_code on public.invites (invite_code);
alter table public.invites enable row level security;

create or replace function public.invite_count(p_code text)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer from public.invites where invite_code = p_code;
$$;
revoke all on function public.invite_count(text) from public;
grant execute on function public.invite_count(text) to anon, authenticated, service_role;

-- A device finished a daily game: count it for the day, and credit its invite if this is its first day ever.
-- Returns true when the invite was credited.
create or replace function public.record_played(p_day date, p_device uuid, p_invite text)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  first_day boolean;
  credited boolean := false;
begin
  first_day := not exists (select 1 from public.daily_players where device_id = p_device and day <> p_day);
  insert into public.daily_players (day, device_id) values (p_day, p_device) on conflict do nothing;
  if p_invite is not null and first_day then
    insert into public.invites (friend_device, invite_code, day) values (p_device, p_invite, p_day) on conflict do nothing;
    credited := found;
  end if;
  return credited;
end;
$$;
revoke all on function public.record_played(date, uuid, text) from public, anon, authenticated;
grant execute on function public.record_played(date, uuid, text) to service_role;

-- Set, change or clear (null) a device's nickname. Returns 'ok', or 'taken' when another device has it.
create or replace function public.set_nickname(p_device uuid, p_nickname text)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_nickname is null then
    delete from public.nicknames where device_id = p_device;
    return 'ok';
  end if;
  if exists (select 1 from public.nicknames where lower(nickname) = lower(p_nickname) and device_id <> p_device) then
    return 'taken';
  end if;
  insert into public.nicknames (device_id, nickname) values (p_device, p_nickname)
  on conflict (device_id) do update set nickname = excluded.nickname, updated_at = now();
  return 'ok';
end;
$$;
revoke all on function public.set_nickname(uuid, text) from public, anon, authenticated;
grant execute on function public.set_nickname(uuid, text) to service_role;

-- The gold star on the board: a device whose own invite code brought ten friends who played.
create or replace function public.claim_badge(p_device uuid, p_code text)
returns boolean
language sql
security invoker
set search_path = ''
as $$
  update public.nicknames set badge = true
  where device_id = p_device and (select count(*) from public.invites where invite_code = p_code) >= 10
  returning true;
$$;
revoke all on function public.claim_badge(uuid, text) from public, anon, authenticated;
grant execute on function public.claim_badge(uuid, text) to service_role;

-- Right to erasure and retention cover the new tables too ---------------------------------------------------------
create or replace function public.forget_device(p_device uuid)
returns integer
language sql
security invoker
set search_path = ''
as $$
  delete from public.nicknames where device_id = p_device;
  delete from public.daily_players where device_id = p_device;
  delete from public.invites where friend_device = p_device;
  with gone as (delete from public.daily_laps where device_id = p_device returning 1)
  select count(*)::integer from gone;
$$;

-- Laps 30 days, players per day 30 days (the best day is kept as a number in the counter only while it's in range),
-- invites 180 days, a nickname once its device hasn't put a lap on the board for 30 days.
create or replace function public.prune_leaderboard()
returns void
language sql
security invoker
set search_path = ''
as $$
  delete from public.daily_laps where day < current_date - 30;
  delete from public.submit_rate where window_start < now() - interval '2 days';
  delete from public.daily_players where day < current_date - 30;
  delete from public.invites where day < current_date - 180;
  delete from public.nicknames n
    where n.updated_at < now() - interval '30 days'
      and not exists (select 1 from public.daily_laps l where l.device_id = n.device_id);
$$;
