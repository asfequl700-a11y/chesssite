-- Courses: public read-only content (seeded by scripts/build-courses.ts), plus per-user progress.
create table public.courses (
  slug text primary key check (slug ~ '^[a-z0-9-]+$'),
  title text not null,
  summary text not null default '',
  position int not null default 0
);

create table public.course_chapters (
  id bigint generated always as identity primary key,
  course_slug text not null references public.courses (slug) on delete cascade,
  position int not null,
  title text not null,
  steps jsonb not null, -- [{ fen, text, answers: [san] }], same shape as lib/lessons.ts
  unique (course_slug, position)
);

create table public.course_progress (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  course_slug text not null references public.courses (slug) on delete cascade,
  chapter int not null,
  done_at timestamptz not null default now(),
  primary key (user_id, course_slug, chapter)
);

alter table public.courses enable row level security;
alter table public.course_chapters enable row level security;
alter table public.course_progress enable row level security;

create policy "courses are public" on public.courses for select to anon, authenticated using (true);
create policy "chapters are public" on public.course_chapters for select to anon, authenticated using (true);
create policy "own progress: read" on public.course_progress for select to authenticated using (user_id = auth.uid());
create policy "own progress: add" on public.course_progress for insert to authenticated with check (user_id = auth.uid());
create policy "own progress: reset" on public.course_progress for delete to authenticated using (user_id = auth.uid());

revoke all on public.courses, public.course_chapters, public.course_progress from anon, authenticated;
grant select on public.courses, public.course_chapters to anon, authenticated;
grant select, delete on public.course_progress to authenticated;
grant insert (course_slug, chapter) on public.course_progress to authenticated;
