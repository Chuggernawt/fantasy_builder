-- Persistent username + password accounts (case-sensitive usernames).
-- Run in Supabase SQL editor after multiplayer_schema.sql.
--
-- Supabase dashboard (required):
--   Auth > Providers > Email: ON
--   Auth > Providers > Email > Enable sign ups: ON
--   Auth > Providers > Email > Confirm email: OFF
--   Auth > Providers > Anonymous: OFF (optional)
--
-- Players only enter username + password in the app.

create or replace function public.normalize_username(raw text)
returns text
language sql
immutable
as $$
  select trim(raw);
$$;

create or replace function public.is_username_available(
  check_name text,
  except_user_id uuid default null
)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select not exists (
    select 1
    from public.profiles p
    where p.username = trim(check_name)
      and (except_user_id is null or p.user_id <> except_user_id)
  );
$$;

grant execute on function public.is_username_available(text, uuid) to anon, authenticated;
grant execute on function public.normalize_username(text) to anon, authenticated;

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  desired text;
  fallback text;
begin
  desired := trim(coalesce(new.raw_user_meta_data->>'username', ''));
  if desired = '' or length(desired) < 3 then
    desired := 'user_' || substr(replace(new.id::text, '-', ''), 1, 12);
  end if;

  if public.is_username_available(desired, new.id) then
    insert into public.profiles (user_id, username)
    values (new.id, desired)
    on conflict (user_id) do update
      set username = excluded.username
      where public.is_username_available(excluded.username, excluded.user_id);
  else
    fallback := 'user_' || substr(replace(new.id::text, '-', ''), 1, 12);
    insert into public.profiles (user_id, username)
    values (new.id, fallback)
    on conflict (user_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute procedure public.handle_new_user_profile();
