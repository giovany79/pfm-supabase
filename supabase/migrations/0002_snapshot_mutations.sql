create table snapshot_mutations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id),
  channel text not null check (channel in ('mcp', 'action')),
  tool_name text not null default 'confirm_snapshot_change',
  operation text not null check (operation in ('create', 'edit')),
  item_id uuid,
  actor text not null default 'gio',
  outcome text not null check (outcome in ('success', 'failure')),
  created_at timestamptz not null default now()
);

create index idx_snapshot_mutations_owner_created
  on snapshot_mutations (owner_id, created_at desc);

alter table snapshot_mutations enable row level security;

create policy "owner snapshot mutations" on snapshot_mutations
  for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());
