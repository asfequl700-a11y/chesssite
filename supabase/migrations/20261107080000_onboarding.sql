-- Welcome screen after sign-up: pick a username and rate yourself 1-100 (like chess.com's level question).
alter table public.profiles
  add column skill smallint check (skill between 1 and 100),
  add column onboarded boolean not null default false;

-- Usernames are unique ignoring capitals (Bob and bob can't both exist).
create unique index profiles_username_lower on public.profiles (lower(username));

/** Finish the welcome screen: set your username (checked here, not in the browser) and your level. */
create function public.finish_onboarding(name text, level int) returns text
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then return 'Please log in.'; end if;
  if name !~ '^[A-Za-z0-9_]{3,20}$' then return 'Username: 3 to 20 letters, numbers or _.'; end if;
  if level < 1 or level > 100 then return 'Pick a level from 1 to 100.'; end if;
  if exists (select 1 from public.profiles where lower(username) = lower(name) and id <> auth.uid()) then
    return 'That username is taken. Try another.';
  end if;
  update public.profiles set
    username = name,
    skill = level,
    onboarded = true,
    -- First puzzles near your level (400 for 1, 2000 for 100) if you haven't solved any yet.
    puzzle_rating = case when puzzles_solved = 0 then 400 + round((level - 1) * 1600 / 99.0)::int else puzzle_rating end
  where id = auth.uid();
  return 'ok';
exception when unique_violation then
  return 'That username is taken. Try another.';
end;
$$;
revoke execute on function public.finish_onboarding from public, anon;
grant execute on function public.finish_onboarding to authenticated;
