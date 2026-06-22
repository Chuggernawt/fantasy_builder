-- Account-scoped progress on profiles (career stats + revealed player stats).

alter table public.profiles
  add column if not exists career_stats jsonb;

alter table public.profiles
  add column if not exists revealed_stats jsonb;

comment on column public.profiles.career_stats is
  'Cumulative player career stats: W/L, universe usage, scorers, online/offline tournament wins.';

comment on column public.profiles.revealed_stats is
  'Per-player revealed stat keys earned by this account across all universes.';
