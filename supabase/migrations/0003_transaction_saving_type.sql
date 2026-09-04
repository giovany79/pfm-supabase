alter table public.transactions
  drop constraint if exists transactions_type_check;

-- Preserve historical amounts while separating savings that were previously
-- stored as expenses under the saving/savings category.
update public.transactions
set type = 'saving'
where type = 'expensive'
  and lower(btrim(category)) in ('saving', 'savings');

alter table public.transactions
  add constraint transactions_type_check
  check (type in ('income', 'expensive', 'saving'));
