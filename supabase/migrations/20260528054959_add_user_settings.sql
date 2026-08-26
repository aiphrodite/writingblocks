create table public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_settings enable row level security;

grant select, insert, update, delete on public.user_settings to authenticated;

create policy "Users can read their own settings"
on public.user_settings
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can create their own settings"
on public.user_settings
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update their own settings"
on public.user_settings
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete their own settings"
on public.user_settings
for delete
to authenticated
using ((select auth.uid()) = user_id);
