-- ============================================================
-- FitFinance AI - Migration v4 (Liste de courses)
-- A executer dans : Supabase Dashboard > SQL Editor > New query
-- ============================================================

-- Budget hebdomadaire d'epicerie
alter table profiles add column if not exists grocery_budget_weekly numeric default 80;

-- Liste de courses generee par Aiden a partir des repas planifies
create table if not exists shopping_list_items (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  quantity text,
  category text,             -- ex: Fruits/legumes, Proteines, Epicerie, Produits laitiers...
  estimated_price numeric default 0,
  purchased boolean default false,
  created_at timestamptz default now()
);

alter table shopping_list_items enable row level security;

drop policy if exists "own shopping_list_items" on shopping_list_items;
create policy "own shopping_list_items" on shopping_list_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
