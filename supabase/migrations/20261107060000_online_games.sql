-- Live games between two signed-in players, started from an invite link.
-- Only the two players can read a game. Nobody writes from the browser: every change goes through the
-- `online` Edge Function, which checks the move is legal and keeps the clocks (so the page can't cheat).
create table public.online_games (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users (id) on delete cascade,
  white uuid references auth.users (id) on delete set null,
  black uuid references auth.users (id) on delete set null,
  white_name text not null default '',
  black_name text not null default '',
  status text not null default 'waiting' check (status in ('waiting', 'active', 'over')),
  time_ms int not null default 0 check (time_ms >= 0), -- per side, 0 = no clock
  white_ms int not null default 0,
  black_ms int not null default 0,
  turn_started_at timestamptz, -- when the side to move's clock started (null until the first move)
  fen text not null default 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  moves text[] not null default '{}', -- UCI, e.g. e2e4
  result text check (result in ('w', 'b', 'draw')),
  reason text not null default '',
  draw_offer text check (draw_offer in ('w', 'b')),
  rematch_id uuid references public.online_games (id) on delete set null,
  white_game_id bigint, -- rows in public.games saved at the end (for My games + accuracy)
  black_game_id bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index online_games_white on public.online_games (white);
create index online_games_black on public.online_games (black);

alter table public.online_games enable row level security;
create policy "players read their games" on public.online_games for select to authenticated
  using (auth.uid() in (created_by, white, black));

revoke all on public.online_games from anon, authenticated;
grant select on public.online_games to authenticated;

-- Live updates: both players get each change pushed to them (row level security still applies).
alter publication supabase_realtime add table public.online_games;
alter table public.online_games replica identity full;

-- Online games appear in My games too.
alter table public.games drop constraint games_mode_check;
alter table public.games add constraint games_mode_check check (mode in ('computer', 'friend', 'online'));
