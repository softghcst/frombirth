-- Cloud saves for Pathways. Paste all of this into Supabase's SQL Editor and press Run.
-- It makes one table, `saves`, with one row per player, and rules so that each
-- signed-in player can only ever see or change their own row.

create table if not exists public.saves (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       text not null,
  version    integer not null default 1,
  device     text,
  updated_at timestamptz not null default now()
);

alter table public.saves enable row level security;

drop policy if exists "Players read their own saves" on public.saves;
drop policy if exists "Players add their own saves" on public.saves;
drop policy if exists "Players update their own saves" on public.saves;
drop policy if exists "Players delete their own saves" on public.saves;

create policy "Players read their own saves" on public.saves
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Players add their own saves" on public.saves
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Players update their own saves" on public.saves
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Players delete their own saves" on public.saves
  for delete to authenticated using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.saves to authenticated;
revoke all on public.saves from anon;

create or replace function public.saves_touch() returns trigger
  language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists saves_touch on public.saves;
create trigger saves_touch before update on public.saves
  for each row execute function public.saves_touch();
