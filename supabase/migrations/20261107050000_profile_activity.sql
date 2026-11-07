-- Dashboard: puzzles solved and the days you were active (for the streak). Kept to the last 60 days by the app.
alter table public.profiles
  add column puzzles_solved int not null default 0 check (puzzles_solved >= 0),
  add column active_days date[] not null default '{}' check (cardinality(active_days) <= 400);

grant update (puzzles_solved, active_days) on public.profiles to authenticated;
