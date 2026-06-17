-- Run this in Supabase SQL editor before using multiplayer.
-- It creates auth-linked profiles, friends, rooms, room members, chat, invites.
--
-- The app uses anonymous auth + username (no email/password fields in-game).
-- In Supabase dashboard, enable:
-- Authentication > Providers > Anonymous > Enable anonymous sign-ins.

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  friend_user_id uuid not null references public.profiles(user_id) on delete cascade,
  status text not null check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  unique (user_id, friend_user_id)
);

create table if not exists public.mp_rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  host_user_id uuid not null references public.profiles(user_id) on delete cascade,
  visibility text not null check (visibility in ('public', 'private')),
  status text not null check (status in ('waiting', 'draft', 'live', 'finished')) default 'waiting',
  state jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.mp_room_members (
  room_id uuid not null references public.mp_rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  role text not null check (role in ('host', 'away', 'spectator')),
  lobby jsonb,
  mp_action jsonb,
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

alter table public.mp_room_members add column if not exists lobby jsonb;
alter table public.mp_room_members add column if not exists mp_action jsonb;

create table if not exists public.mp_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.mp_rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  text text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.mp_invites (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.mp_rooms(id) on delete cascade,
  from_user_id uuid not null references public.profiles(user_id) on delete cascade,
  to_user_id uuid not null references public.profiles(user_id) on delete cascade,
  status text not null check (status in ('pending', 'accepted', 'declined')) default 'pending',
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.friendships enable row level security;
alter table public.mp_rooms enable row level security;
alter table public.mp_room_members enable row level security;
alter table public.mp_messages enable row level security;
alter table public.mp_invites enable row level security;

drop policy if exists "profiles read all" on public.profiles;
create policy "profiles read all"
  on public.profiles for select
  to authenticated
  using (true);

drop policy if exists "profiles upsert own" on public.profiles;
create policy "profiles upsert own"
  on public.profiles for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "friendships own read" on public.friendships;
create policy "friendships own read"
  on public.friendships for select
  to authenticated
  using (auth.uid() = user_id or auth.uid() = friend_user_id);

drop policy if exists "friendships own write" on public.friendships;
create policy "friendships own write"
  on public.friendships for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "friendships participant update" on public.friendships;
create policy "friendships participant update"
  on public.friendships for update
  to authenticated
  using (auth.uid() = user_id or auth.uid() = friend_user_id)
  with check (auth.uid() = user_id or auth.uid() = friend_user_id);

drop policy if exists "rooms read all auth" on public.mp_rooms;
create policy "rooms read all auth"
  on public.mp_rooms for select
  to authenticated
  using (true);

drop policy if exists "rooms create host" on public.mp_rooms;
create policy "rooms create host"
  on public.mp_rooms for insert
  to authenticated
  with check (auth.uid() = host_user_id);

drop policy if exists "rooms update host" on public.mp_rooms;
create policy "rooms update host"
  on public.mp_rooms for update
  to authenticated
  using (auth.uid() = host_user_id)
  with check (auth.uid() = host_user_id);

drop policy if exists "members read all auth" on public.mp_room_members;
create policy "members read all auth"
  on public.mp_room_members for select
  to authenticated
  using (true);

drop policy if exists "members insert self" on public.mp_room_members;
create policy "members insert self"
  on public.mp_room_members for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "members delete self" on public.mp_room_members;
create policy "members delete self"
  on public.mp_room_members for delete
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "members update own lobby" on public.mp_room_members;
create policy "members update own lobby"
  on public.mp_room_members for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "messages read all auth" on public.mp_messages;
create policy "messages read all auth"
  on public.mp_messages for select
  to authenticated
  using (true);

drop policy if exists "messages insert self" on public.mp_messages;
create policy "messages insert self"
  on public.mp_messages for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "invites read receiver" on public.mp_invites;
create policy "invites read receiver"
  on public.mp_invites for select
  to authenticated
  using (auth.uid() = to_user_id or auth.uid() = from_user_id);

drop policy if exists "invites create sender" on public.mp_invites;
create policy "invites create sender"
  on public.mp_invites for insert
  to authenticated
  with check (auth.uid() = from_user_id);

drop policy if exists "invites update receiver" on public.mp_invites;
create policy "invites update receiver"
  on public.mp_invites for update
  to authenticated
  using (auth.uid() = to_user_id)
  with check (auth.uid() = to_user_id);

-- Auto-create profile from auth signup metadata if username provided.
create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, username)
  values (new.id, coalesce(new.raw_user_meta_data->>'username', 'user_' || substr(new.id::text, 1, 8)))
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute procedure public.handle_new_user_profile();

-- Realtime: enable in Supabase SQL editor if join/chat updates are delayed.
-- Dashboard alternative: Database > Replication > supabase_realtime > enable mp_rooms, mp_room_members, mp_messages
-- alter publication supabase_realtime add table public.mp_rooms;
-- alter publication supabase_realtime add table public.mp_room_members;
-- alter publication supabase_realtime add table public.mp_messages;
