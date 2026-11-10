-- The daily reminder (Web Push). One row per browser that turned it on: the push service address and keys the
-- browser handed out, the hour the player picked and their time zone, the language, and the last day a reminder
-- went out and the last day they played (so a player who already played isn't reminded). No account, device id or
-- IP address. RLS on with no policies: only the push edge function (service role) reads or writes it.
create table if not exists public.push_subscriptions (
  endpoint text primary key check (endpoint ~ '^https://' and length(endpoint) <= 1024),
  p256dh text not null check (length(p256dh) <= 200),
  auth text not null check (length(auth) <= 200),
  tz text not null check (length(tz) <= 64),
  hour smallint not null check (hour between 0 and 23),
  lang text not null default 'en' check (lang in ('en', 'es')),
  last_sent date,
  last_played date,
  created_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;

-- The VAPID key pair and the cron secret live in Supabase Vault, set once outside version control:
--   select vault.create_secret('<public key>', 'push_vapid_public');
--   select vault.create_secret('<private key>', 'push_vapid_private');
--   select vault.create_secret('<random secret>', 'push_cron_secret');
-- The push function reads them through this, which only the service role may call.
create or replace function public.push_config()
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'vapid_public', (select decrypted_secret from vault.decrypted_secrets where name = 'push_vapid_public'),
    'vapid_private', (select decrypted_secret from vault.decrypted_secrets where name = 'push_vapid_private'),
    'cron_secret', (select decrypted_secret from vault.decrypted_secrets where name = 'push_cron_secret')
  );
$$;
revoke all on function public.push_config() from public, anon, authenticated;
grant execute on function public.push_config() to service_role;

-- Every hour, a minute past: call the push function, which sends the reminders due in that hour.
create extension if not exists pg_net;
select cron.schedule(
  'daily-reminder',
  '1 * * * *',
  $$
  select net.http_post(
    url := 'https://acglshyvgeikyrvjfjue.supabase.co/functions/v1/push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'push_cron_secret')
    ),
    body := '{"action":"send"}'::jsonb
  );
  $$
);
