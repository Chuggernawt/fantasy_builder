-- Season saves and other account progress (cross-device sync on sign-in).

alter table public.profiles
  add column if not exists account_progress jsonb;

comment on column public.profiles.account_progress is
  'Season save slots, active campaign, honours, form, and tournament state for cross-device sync.';
