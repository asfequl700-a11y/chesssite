-- Google sign-ins have no username: build one from the email (e.g. fahim.alam@gmail.com -> fahim_alam),
-- adding part of the user id if that name is taken. Email sign-ups still use the name they typed.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  wanted text := new.raw_user_meta_data ->> 'username';
  base text := left(regexp_replace(split_part(coalesce(new.email, ''), '@', 1), '[^A-Za-z0-9_]', '_', 'g'), 15);
  name text;
begin
  if wanted ~ '^[A-Za-z0-9_]{3,20}$' and not exists (select 1 from public.profiles p where lower(p.username) = lower(wanted)) then
    name := wanted;
  elsif length(base) >= 3 and not exists (select 1 from public.profiles p where lower(p.username) = lower(base)) then
    name := base;
  elsif length(base) >= 3 then
    name := base || '_' || left(replace(new.id::text, '-', ''), 4);
  else
    name := 'user_' || left(replace(new.id::text, '-', ''), 8);
  end if;
  insert into public.profiles (id, username) values (new.id, name);
  return new;
end;
$$;
