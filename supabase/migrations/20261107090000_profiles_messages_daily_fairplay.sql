-- Public profiles + avatars, messages between friends, daily chess, reports + basic fair play.

-- ── Profiles: photo, short bio, ban switch (set by Fahim in the Table Editor) ─────────────────────
alter table public.profiles
  add column avatar_url text check (avatar_url is null or avatar_url like 'https://itwoygrmonrcrlhlfnxl.supabase.co/storage/v1/object/public/avatars/%'),
  add column bio text not null default '' check (length(bio) <= 160),
  add column banned boolean not null default false;
grant update (avatar_url, bio) on public.profiles to authenticated;

-- Photos: public to look at, each user may only write inside their own folder (avatars/<user id>/...).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 524288, array['image/webp', 'image/png', 'image/jpeg'])
on conflict (id) do nothing;
create policy "avatars: upload own" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars: replace own" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars: delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

/** Everything a public profile page shows (anyone can look, like chess.com/member/name). */
create function public.public_profile(name text) returns json
language sql security definer set search_path = '' stable as $$
  select json_build_object(
    'id', p.id, 'username', p.username, 'avatar_url', p.avatar_url, 'bio', p.bio, 'joined', p.created_at,
    'level', p.skill, 'puzzle_rating', p.puzzle_rating, 'puzzles_solved', p.puzzles_solved,
    'bots_beaten', cardinality(p.beaten_bots), 'rush_best', greatest(p.rush_best_3, p.rush_best_5),
    'online', (select json_build_object('games', count(*), 'won', count(*) filter (where g.result = 'win'),
                 'lost', count(*) filter (where g.result = 'loss'), 'drawn', count(*) filter (where g.result = 'draw'))
               from public.games g where g.user_id = p.id and g.mode = 'online'),
    'recent', (select coalesce(json_agg(r), '[]') from (
                 select g.bot as opponent, g.result, g.reason, g.time_control, g.played_at
                 from public.games g where g.user_id = p.id and g.mode = 'online' order by g.played_at desc limit 10) r),
    'friend', (select case when f.status = 'accepted' then 'friend' when f.to_user = auth.uid() then 'incoming' else 'outgoing' end
               from public.friend_requests f
               where least(f.from_user, f.to_user) = least(p.id, auth.uid()) and greatest(f.from_user, f.to_user) = greatest(p.id, auth.uid())),
    'request_id', (select f.id from public.friend_requests f
               where least(f.from_user, f.to_user) = least(p.id, auth.uid()) and greatest(f.from_user, f.to_user) = greatest(p.id, auth.uid()))
  )
  from public.profiles p where lower(p.username) = lower(name);
$$;
grant execute on function public.public_profile to anon, authenticated;

-- Friends lists and search now include the photo.
drop function public.find_players(text);
create function public.find_players(q text) returns table (id uuid, username text, avatar_url text)
language sql security definer set search_path = '' stable as $$
  select p.id, p.username, p.avatar_url from public.profiles p
  where length(q) >= 2 and lower(p.username) like lower(replace(replace(q, '%', ''), '_', '\_')) || '%' and p.id <> auth.uid()
  order by length(p.username), p.username limit 10;
$$;
drop function public.my_friends();
create function public.my_friends() returns table (request_id bigint, id uuid, username text, avatar_url text, dir text, since timestamptz)
language sql security definer set search_path = '' stable as $$
  select r.id, o.id, o.username, o.avatar_url,
         case when r.status = 'accepted' then 'friend' when r.to_user = auth.uid() then 'incoming' else 'outgoing' end,
         r.created_at
  from public.friend_requests r
  join public.profiles o on o.id = case when r.from_user = auth.uid() then r.to_user else r.from_user end
  where auth.uid() in (r.from_user, r.to_user)
  order by o.username;
$$;
revoke execute on function public.find_players, public.my_friends from public, anon;
grant execute on function public.find_players, public.my_friends to authenticated;

-- ── Messages: only between friends (stops strangers spamming) ────────────────────────────────────
create function public.are_friends(a uuid, b uuid) returns boolean
language sql security definer set search_path = '' stable as $$
  select exists (select 1 from public.friend_requests f where f.status = 'accepted'
    and least(f.from_user, f.to_user) = least(a, b) and greatest(f.from_user, f.to_user) = greatest(a, b));
$$;
revoke execute on function public.are_friends from public, anon;
grant execute on function public.are_friends to authenticated;

create table public.messages (
  id bigint generated always as identity primary key,
  from_user uuid not null default auth.uid() references auth.users (id) on delete cascade,
  to_user uuid not null references auth.users (id) on delete cascade,
  body text not null check (length(trim(body)) between 1 and 1000),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  check (from_user <> to_user)
);
create index messages_pair on public.messages (least(from_user, to_user), greatest(from_user, to_user), created_at desc);
create index messages_unread on public.messages (to_user) where read_at is null;

alter table public.messages enable row level security;
create policy "messages: read own" on public.messages for select to authenticated using (auth.uid() in (from_user, to_user));
create policy "messages: send to friends" on public.messages for insert to authenticated
  with check (from_user = auth.uid() and public.are_friends(from_user, to_user)
    and not exists (select 1 from public.profiles where id = auth.uid() and banned));
create policy "messages: mark read" on public.messages for update to authenticated using (to_user = auth.uid()) with check (to_user = auth.uid());
revoke all on public.messages from anon, authenticated;
grant select on public.messages to authenticated;
grant insert (to_user, body) on public.messages to authenticated;
grant update (read_at) on public.messages to authenticated;
alter publication supabase_realtime add table public.messages;
alter table public.messages replica identity full;

/** Your conversations: the other player, the last message and how many you haven't read. */
create function public.conversations() returns table (id uuid, username text, avatar_url text, last_body text, last_at timestamptz, last_from_me boolean, unread bigint)
language sql security definer set search_path = '' stable as $$
  with mine as (
    select m.*, case when m.from_user = auth.uid() then m.to_user else m.from_user end as other
    from public.messages m where auth.uid() in (m.from_user, m.to_user)
  ), last as (
    select distinct on (other) other, body, created_at, from_user = auth.uid() as from_me from mine order by other, created_at desc
  )
  select p.id, p.username, p.avatar_url, l.body, l.created_at, l.from_me,
         (select count(*) from mine u where u.other = l.other and u.to_user = auth.uid() and u.read_at is null)
  from last l join public.profiles p on p.id = l.other
  order by l.created_at desc;
$$;
revoke execute on function public.conversations from public, anon;
grant execute on function public.conversations to authenticated;

-- ── Daily chess: days per move instead of minutes; the server also records move times ────────────
alter table public.online_games
  add column daily_days smallint not null default 0 check (daily_days in (0, 1, 2, 3, 5, 7)),
  add column move_times int[] not null default '{}';
create index online_games_active on public.online_games (status) where status = 'active';

-- ── Reports + fair play ─────────────────────────────────────────────────────────────────────────
create table public.reports (
  id bigint generated always as identity primary key,
  reporter uuid not null default auth.uid() references auth.users (id) on delete cascade,
  reported uuid not null references auth.users (id) on delete cascade,
  game_id uuid references public.online_games (id) on delete set null,
  reason text not null check (reason in ('cheating', 'abuse', 'other')),
  details text not null default '' check (length(details) <= 500),
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now(),
  check (reporter <> reported)
);
alter table public.reports enable row level security;
create policy "reports: send" on public.reports for insert to authenticated with check (reporter = auth.uid());
create policy "reports: see own" on public.reports for select to authenticated using (reporter = auth.uid());
revoke all on public.reports from anon, authenticated;
grant select on public.reports to authenticated;
grant insert (reported, game_id, reason, details) on public.reports to authenticated;

-- Each finished online game, the OPPONENT's browser reviews it and sends the player's accuracy
-- (a cheater can't fake their victim's browser). Only the server function writes here.
create table public.fair_play (
  game_id uuid not null references public.online_games (id) on delete cascade,
  player uuid not null references auth.users (id) on delete cascade,
  accuracy real not null check (accuracy between 0 and 100),
  avg_move_ms int,
  moves int not null,
  created_at timestamptz not null default now(),
  primary key (game_id, player)
);
alter table public.fair_play enable row level security;
revoke all on public.fair_play from anon, authenticated;

-- For Fahim (SQL editor / Table Editor only, no app access): players to look at.
create view public.fair_play_watch with (security_invoker = true) as
  select p.username, p.id, p.banned,
         count(f.*) as games, round(avg(f.accuracy)::numeric, 1) as avg_accuracy,
         count(*) filter (where f.accuracy >= 95 and f.moves >= 20) as near_perfect_games,
         round(avg(f.avg_move_ms) / 1000.0, 1) as avg_move_seconds,
         (select count(*) from public.reports r where r.reported = p.id and r.reason = 'cheating' and r.status = 'open') as cheat_reports
  from public.profiles p
  left join public.fair_play f on f.player = p.id
  group by p.id
  having count(f.*) >= 5 and avg(f.accuracy) >= 90
      or (select count(*) from public.reports r where r.reported = p.id and r.status = 'open') >= 1;
revoke all on public.fair_play_watch from anon, authenticated;
