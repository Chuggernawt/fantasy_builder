-- Allow tournament players (not just host) to persist entrant claims and lobby data.
-- Without this, mergeTournamentOnJoin / saveTournamentLobby silently fail for non-hosts.

drop policy if exists "rooms update tournament players" on public.mp_rooms;
create policy "rooms update tournament players"
  on public.mp_rooms for update
  to authenticated
  using (
    room_mode = 'tournament'
    and exists (
      select 1
      from public.mp_room_members m
      where m.room_id = mp_rooms.id
        and m.user_id = auth.uid()
        and m.role in ('host', 'player')
    )
  )
  with check (
    room_mode = 'tournament'
    and exists (
      select 1
      from public.mp_room_members m
      where m.room_id = mp_rooms.id
        and m.user_id = auth.uid()
        and m.role in ('host', 'player')
    )
  );
