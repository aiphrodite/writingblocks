create table public.ideas (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('block', 'build')),
  title text not null default '',
  context text not null default '',
  tweet text not null default '',
  linkedin text not null default '',
  substack_title text not null default '',
  substack_body text not null default '',
  shorts text not null default '',
  vod text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table public.build_inputs (
  user_id uuid not null references auth.users(id) on delete cascade,
  build_id text not null,
  block_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, build_id, block_id),
  foreign key (user_id, build_id) references public.ideas(user_id, id) on delete cascade,
  foreign key (user_id, block_id) references public.ideas(user_id, id) on delete cascade,
  check (build_id <> block_id)
);

create index ideas_user_id_updated_at_idx on public.ideas(user_id, updated_at desc);
create index ideas_user_id_type_idx on public.ideas(user_id, type);
create index build_inputs_user_id_build_id_idx on public.build_inputs(user_id, build_id);
create index build_inputs_user_id_block_id_idx on public.build_inputs(user_id, block_id);

alter table public.ideas enable row level security;
alter table public.build_inputs enable row level security;

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.ideas to authenticated;
grant select, insert, update, delete on public.build_inputs to authenticated;

create policy "Users can read their own ideas"
on public.ideas
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can create their own ideas"
on public.ideas
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update their own ideas"
on public.ideas
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete their own ideas"
on public.ideas
for delete
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can read their own build inputs"
on public.build_inputs
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can create their own build inputs"
on public.build_inputs
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update their own build inputs"
on public.build_inputs
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete their own build inputs"
on public.build_inputs
for delete
to authenticated
using ((select auth.uid()) = user_id);
