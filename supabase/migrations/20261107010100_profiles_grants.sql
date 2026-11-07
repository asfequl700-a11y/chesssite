-- Supabase's default grants give anon/authenticated every privilege; keep only what the app needs.
revoke all on public.profiles from anon, authenticated;
grant select, update (puzzle_rating, beaten_bots, rush_best_3, rush_best_5) on public.profiles to authenticated;
