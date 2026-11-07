-- Friends + direct challenges (like chess.com's Play a Friend by username).

-- Friend requests: one row per pair. pending until the other player accepts.
create table public.friend_requests (
  id bigint generated always as identity primary key,
  from_user uuid not null references auth.users (id) on delete cascade,
  to_user uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  check (from_user <> to_user)
);
-- One row per pair, whichever direction it was sent.
create unique index friend_pair on public.friend_requests (least(from_user, to_user), greatest(from_user, to_user));

alter table public.friend_requests enable row level security;
create policy "own friend rows: read" on public.friend_requests for select to authenticated using (auth.uid() in (from_user, to_user));
revoke all on public.friend_requests from anon, authenticated;
grant select on public.friend_requests to authenticated;
-- All writes go through the functions below.

alter publication supabase_realtime add table public.friend_requests;
alter table public.friend_requests replica identity full;

/** Players whose username starts with `q` (for "add friend" and "challenge"). Shows only id + username. */
create function public.find_players(q text) returns table (id uuid, username text)
language sql security definer set search_path = '' stable as $$
  select p.id, p.username from public.profiles p
  where length(q) >= 2 and lower(p.username) like lower(replace(replace(q, '%', ''), '_', '\_')) || '%' and p.id <> auth.uid()
  order by length(p.username), p.username limit 10;
$$;

/** Your friends and requests, with usernames. dir: 'friend', 'incoming' (they asked you) or 'outgoing'. */
create function public.my_friends() returns table (request_id bigint, id uuid, username text, dir text, since timestamptz)
language sql security definer set search_path = '' stable as $$
  select r.id, o.id, o.username,
         case when r.status = 'accepted' then 'friend' when r.to_user = auth.uid() then 'incoming' else 'outgoing' end,
         r.created_at
  from public.friend_requests r
  join public.profiles o on o.id = case when r.from_user = auth.uid() then r.to_user else r.from_user end
  where auth.uid() in (r.from_user, r.to_user)
  order by o.username;
$$;

/** Ask someone to be your friend. If they already asked you, you become friends. */
create function public.add_friend(friend uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare existing public.friend_requests;
begin
  if auth.uid() is null then raise exception 'Please log in.'; end if;
  if friend = auth.uid() then raise exception 'That''s you!'; end if;
  if not exists (select 1 from public.profiles where id = friend) then raise exception 'Player not found.'; end if;
  select * into existing from public.friend_requests
    where least(from_user, to_user) = least(auth.uid(), friend) and greatest(from_user, to_user) = greatest(auth.uid(), friend);
  if existing.id is null then
    insert into public.friend_requests (from_user, to_user) values (auth.uid(), friend);
    return 'sent';
  elsif existing.status = 'pending' and existing.to_user = auth.uid() then
    update public.friend_requests set status = 'accepted' where id = existing.id;
    return 'friends';
  end if;
  return existing.status;
end;
$$;

/** Accept a request sent to you. */
create function public.accept_friend(request bigint) returns void
language sql security definer set search_path = '' as $$
  update public.friend_requests set status = 'accepted' where id = request and to_user = auth.uid() and status = 'pending';
$$;

/** Decline, cancel or unfriend: removes the row for either player. */
create function public.remove_friend(request bigint) returns void
language sql security definer set search_path = '' as $$
  delete from public.friend_requests where id = request and auth.uid() in (from_user, to_user);
$$;

revoke execute on function public.find_players, public.my_friends, public.add_friend, public.accept_friend, public.remove_friend from public, anon;
grant execute on function public.find_players, public.my_friends, public.add_friend, public.accept_friend, public.remove_friend to authenticated;

-- Direct challenges: an online game "waiting" for one invited player (not anyone with the link).
alter table public.online_games
  add column invited uuid references auth.users (id) on delete cascade,
  add column invited_name text not null default '';
create index online_games_invited on public.online_games (invited) where status = 'waiting';

drop policy "players read their games" on public.online_games;
create policy "players read their games" on public.online_games for select to authenticated
  using (auth.uid() in (created_by, white, black, invited));
