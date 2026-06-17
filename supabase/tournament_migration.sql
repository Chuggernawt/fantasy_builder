-- Tournament mode columns for mp_rooms
alter table public.mp_rooms add column if not exists room_mode text not null default 'friendly'
  check (room_mode in ('friendly', 'tournament'));

alter table public.mp_rooms add column if not exists tournament jsonb;

alter table public.mp_room_members drop constraint if exists mp_room_members_role_check;
alter table public.mp_room_members add constraint mp_room_members_role_check
  check (role in ('host', 'away', 'spectator', 'player'));

alter table public.mp_room_members add column if not exists tournament_slot int;

-- Allow host to update tournament blob on their room
drop policy if exists "rooms update host" on public.mp_rooms;
create policy "rooms update host"
  on public.mp_rooms for update
  to authenticated
  using (auth.uid() = host_user_id)
  with check (auth.uid() = host_user_id);

-- Players may update own row (lobby) — already exists
