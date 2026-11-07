-- Ad slots that advertisers book directly. Swap rows by hand (Table Editor) or with n8n.
create table public.ads (
  id bigint generated always as identity primary key,
  slot text not null check (slot in ('sidebar', 'under-board', 'review-loading')),
  image_url text not null,
  link_url text not null check (link_url ~ '^https?://'),
  alt_text text not null default '',
  advertiser text not null default '',
  starts_on date not null default current_date,
  ends_on date not null,
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on)
);

alter table public.ads enable row level security;

-- Visitors can only read ads that are running today. Nobody can write without the secret key.
create policy "running ads are public"
  on public.ads for select
  to anon, authenticated
  using (current_date between starts_on and ends_on);

grant select on public.ads to anon, authenticated;
