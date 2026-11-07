-- One profile per account. Created automatically on sign-up (username from the sign-up form).
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique check (username ~ '^[A-Za-z0-9_]{3,20}$'),
  created_at timestamptz not null default now(),
  puzzle_rating int not null default 1500,
  beaten_bots text[] not null default '{}',
  rush_best_3 int not null default 0,
  rush_best_5 int not null default 0
);

alter table public.profiles enable row level security;

-- Users see and edit only their own profile. Rows are created by the trigger below, never by the client.
create policy "own profile: read" on public.profiles for select to authenticated using (id = auth.uid());
create policy "own profile: update" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

grant select, update (puzzle_rating, beaten_bots, rush_best_3, rush_best_5) on public.profiles to authenticated;

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    -- Fallback keeps sign-up working if the name is missing or taken: user_ + first 8 chars of the id.
    coalesce(
      (select u from (select new.raw_user_meta_data ->> 'username' as u) s
        where u ~ '^[A-Za-z0-9_]{3,20}$' and not exists (select 1 from public.profiles p where lower(p.username) = lower(u))),
      'user_' || left(replace(new.id::text, '-', ''), 8)
    )
  );
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Sign-up form checks a name is free before submitting (true = taken). Reveals only yes/no.
create function public.username_taken(name text) returns boolean
language sql security definer set search_path = '' stable as $$
  select exists (select 1 from public.profiles where lower(username) = lower(name));
$$;
grant execute on function public.username_taken(text) to anon, authenticated;
