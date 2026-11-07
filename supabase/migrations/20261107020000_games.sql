-- Finished games of signed-in players. Result and accuracy are from the account holder's side.
create table public.games (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  pgn text not null check (length(pgn) <= 20000),
  result text not null check (result in ('win', 'loss', 'draw')),
  reason text not null default '' check (length(reason) <= 60),
  my_color text not null check (my_color in ('w', 'b')),
  mode text not null check (mode in ('computer', 'friend')),
  bot text check (length(bot) <= 40),
  time_control text not null default 'none' check (length(time_control) <= 20),
  accuracy real check (accuracy between 0 and 100),
  opening text check (length(opening) <= 120),
  played_at timestamptz not null default now()
);
create index games_user_played on public.games (user_id, played_at desc);

alter table public.games enable row level security;

create policy "own games: read" on public.games for select to authenticated using (user_id = auth.uid());
create policy "own games: add" on public.games for insert to authenticated with check (user_id = auth.uid());
create policy "own games: set accuracy" on public.games for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own games: delete" on public.games for delete to authenticated using (user_id = auth.uid());

revoke all on public.games from anon, authenticated;
grant select, delete on public.games to authenticated;
grant insert (pgn, result, reason, my_color, mode, bot, time_control, opening) on public.games to authenticated;
grant update (accuracy) on public.games to authenticated;
