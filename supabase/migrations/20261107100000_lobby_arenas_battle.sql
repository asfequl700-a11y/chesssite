-- Online lobby + ratings, arenas (tournaments), Puzzle Battle, and the background sweep job.
-- Everything that changes games, ratings or scores is written by the Edge Functions (service role);
-- browsers can only read what they're allowed to see.

-- ── Ratings: one per player per speed (bullet 1 min, blitz 3-5, rapid 10, daily) ─────────────────
create table public.ratings (
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('bullet', 'blitz', 'rapid', 'daily')),
  rating int not null default 1200,
  games int not null default 0,
  primary key (user_id, kind)
);
alter table public.ratings enable row level security;
create policy "ratings are public" on public.ratings for select to anon, authenticated using (true);
revoke all on public.ratings from anon, authenticated;
grant select on public.ratings to anon, authenticated;

alter table public.online_games
  add column rated boolean not null default false,
  add column kind text check (kind in ('bullet', 'blitz', 'rapid', 'daily')),
  add column white_rating int,
  add column black_rating int,
  add column white_change int,
  add column black_change int,
  add column tournament_id uuid;

-- ── Matchmaking queue (one search per player; games and Puzzle Battles) ─────────────────────────
create table public.seeks (
  user_id uuid primary key references auth.users (id) on delete cascade,
  username text not null,
  kind text not null check (kind in ('bullet', 'blitz', 'rapid', 'daily', 'battle')),
  minutes int not null default 0,
  days int not null default 0,
  rating int not null,
  status text not null default 'open' check (status in ('open', 'matched')),
  game_id uuid,
  created_at timestamptz not null default now(),
  last_seen timestamptz not null default now()
);
alter table public.seeks enable row level security;
-- The lobby shows open searches (name, rating, time) like chess.com's open challenges.
create policy "open seeks are visible" on public.seeks for select to authenticated using (status = 'open');
revoke all on public.seeks from anon, authenticated;
grant select (user_id, username, kind, minutes, days, rating, status, created_at, last_seen) on public.seeks to authenticated;

-- ── Arenas: pair whoever is free, score win 2 / draw 1 / loss 0 ─────────────────────────────────
create table public.tournaments (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 3 and 60),
  minutes int not null check (minutes in (1, 3, 5, 10)),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index tournaments_time on public.tournaments (ends_at desc);
create table public.tournament_players (
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  username text not null,
  rating int not null default 1200,
  score int not null default 0,
  games int not null default 0,
  wins int not null default 0,
  active boolean not null default true, -- in the arena (false after Leave)
  waiting boolean not null default false, -- free to be paired
  last_opponent uuid,
  last_seen timestamptz not null default now(),
  joined_at timestamptz not null default now(),
  primary key (tournament_id, user_id)
);
alter table public.tournaments enable row level security;
alter table public.tournament_players enable row level security;
create policy "arenas are public" on public.tournaments for select to anon, authenticated using (true);
create policy "standings are public" on public.tournament_players for select to anon, authenticated using (true);
revoke all on public.tournaments, public.tournament_players from anon, authenticated;
grant select on public.tournaments, public.tournament_players to anon, authenticated;
alter publication supabase_realtime add table public.tournament_players;

-- ── Puzzle Battle: same puzzles for both, 3 minutes, answers checked on the server ─────────────
create table public.battles (
  id uuid primary key default gen_random_uuid(),
  white uuid not null references auth.users (id) on delete cascade,
  black uuid not null references auth.users (id) on delete cascade,
  white_name text not null,
  black_name text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  white_score int not null default 0,
  black_score int not null default 0,
  white_strikes int not null default 0,
  black_strikes int not null default 0,
  white_idx int not null default 0,
  black_idx int not null default 0,
  white_step int not null default 0,
  black_step int not null default 0,
  status text not null default 'active' check (status in ('active', 'over')),
  result text check (result in ('w', 'b', 'draw')),
  created_at timestamptz not null default now()
);
alter table public.battles enable row level security;
create policy "battle players read" on public.battles for select to authenticated using (auth.uid() in (white, black));
revoke all on public.battles from anon, authenticated;
grant select on public.battles to authenticated;
alter publication supabase_realtime add table public.battles;
alter table public.battles replica identity full;

-- The puzzles and their solutions: never readable from the browser (that would let players cheat).
create table public.battle_puzzles (
  battle_id uuid not null references public.battles (id) on delete cascade,
  idx int not null,
  fen text not null,
  solution text[] not null,
  rating int not null,
  primary key (battle_id, idx)
);
alter table public.battle_puzzles enable row level security;
revoke all on public.battle_puzzles from anon, authenticated;

-- ── Public profile shows online ratings too ──────────────────────────────────────────────────────
create or replace function public.player_ratings(uid uuid) returns json
language sql security definer set search_path = '' stable as $$
  select coalesce(json_object_agg(r.kind, json_build_object('rating', r.rating, 'games', r.games)), '{}') from public.ratings r where r.user_id = uid;
$$;
grant execute on function public.player_ratings to anon, authenticated;

-- ── Background sweep every 5 minutes (daily time-outs, abandoned games, old searches, hourly arenas)
-- Calls the `sweep` Edge Function with a secret kept in Vault (set outside this file: no secrets in git).
create extension if not exists pg_cron;
create extension if not exists pg_net;
