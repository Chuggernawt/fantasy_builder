-- Allow fixture child-room sim host (home bracket player) to push match snapshots.
-- Run after tournament_fixture_rooms_migration.sql

drop policy if exists "rooms update fixture sim host" on public.mp_rooms;
create policy "rooms update fixture sim host"
  on public.mp_rooms for update
  to authenticated
  using (
    host_user_id = auth.uid()
    or exists (
      select 1
      from public.mp_room_members m
      where m.room_id = mp_rooms.id
        and m.user_id = auth.uid()
        and m.role = 'host'
    )
  )
  with check (
    host_user_id = auth.uid()
    or exists (
      select 1
      from public.mp_room_members m
      where m.room_id = mp_rooms.id
        and m.user_id = auth.uid()
        and m.role = 'host'
    )