-- ============================================================
-- FitFinance AI - Migration v5 (Cycle d'assiduite 30 jours)
-- A executer dans : Supabase Dashboard > SQL Editor > New query
-- ============================================================

-- Date de debut du cycle d'assiduite courant (30 jours glissants)
alter table profiles add column if not exists adherence_cycle_start date default current_date;

-- Historique des cycles de 30 jours completes
create table if not exists adherence_cycle_history (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  start_date date not null,
  end_date date not null,
  days_completed int not null default 0,
  days_target int not null default 0,
  success boolean not null default false,
  created_at timestamptz default now()
);

alter table adherence_cycle_history enable row level security;

drop policy if exists "own adherence_cycle_history" on adherence_cycle_history;
create policy "own adherence_cycle_history" on adherence_cycle_history
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
