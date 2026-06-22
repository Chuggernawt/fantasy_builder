-- Tournament fixture child rooms + safe lobby patches (run after tournament_player_update_migration.sql)

-- Room host can add members (needed to set up human vs human fixture rooms).
drop policy if exists "members insert room host" on public.mp_room_members;
create policy "members insert room host"
  on public.mp_room_members for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.mp_rooms r
      where r.id = room_id
        and r.host_user_id = auth.uid()
    )
  );

drop policy if exists "members update room host" on public.mp_room_members;
create policy "members update room host"
  on public.mp_room_members for update
  to authenticated
  using (
    exists (
      select 1
      from public.mp_rooms r
      where r.id = room_id
        and r.host_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.mp_rooms r
      where r.id = room_id
        and r.host_user_id = auth.uid()
    )
  );

-- Patch a single entrant lobby without overwriting other tournament fields (CPUs, draw, etc.).
create or replace function public.patch_tournament_entrant_lobby(
  p_room_id uuid,
  p_entrant_id text,
  p_lobby jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  t jsonb;
  entrants jsonb;
  updated_entrants jsonb := '[]'::jsonb;
  e jsonb;
  i int;
  found boolean := false;
begin
  select tournament into t
  from public.mp_rooms
  where id = p_room_id
  for update;

  if t is null then
    raise exception 'No tournament in this room';
  end if;

  entrants := t->'entrants';

  for i in 0 .. jsonb_array_length(entrants) - 1 loop
    e := entrants->i;
    if e->>'id' = p_entrant_id then
      if coalesce(e->>'userId', '') <> auth.uid()::text then
        raise exception 'Cannot update this entrant';
      end if;
      e := jsonb_set(e, '{lobby}', p_lobby);
      if p_lobby ? 'universeId' and p_lobby->>'universeId' is not null then
        e := jsonb_set(e, '{universeId}', to_jsonb(p_lobby->>'universeId'));
      end if;
      found := true;
    end if;
    updated_entrants := updated_entrants || jsonb_build_array(e);
  end loop;

  if not found then
    raise exception 'Entrant not found';
  end if;

  t := jsonb_set(t, '{entrants}', updated_entrants);
  update public.mp_rooms set tournament = t where id = p_room_id;
  return t;
end;
$$;

grant execute on function public.patch_tournament_entrant_lobby(uuid, text, jsonb) to authenticated;
