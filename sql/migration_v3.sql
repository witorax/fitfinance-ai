-- ============================================================
-- FitFinance AI - Migration v3 (Relations + depenses recurrentes)
-- A executer dans : Supabase Dashboard > SQL Editor > New query
-- ============================================================

-- Contacts importants (famille, amis, partenaire, collegues...)
create table if not exists contacts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  relationship_type text,        -- famille, ami, partenaire, collegue, autre
  contact_frequency_days int default 14,
  last_contact_date date,
  birthday date,                 -- jour/mois (l'annee n'est pas utilisee)
  notes text,
  created_at timestamptz default now()
);

-- Depenses/revenus recurrents (loyer, abonnements, salaire...)
create table if not exists finance_recurring (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  label text not null,
  category text,
  amount numeric not null,       -- negatif = depense, positif = revenu
  day_of_month int default 1,
  created_at timestamptz default now()
);

-- ============================================================
-- Row Level Security
-- ============================================================
alter table contacts enable row level security;
alter table finance_recurring enable row level security;

drop policy if exists "own contacts" on contacts;
create policy "own contacts" on contacts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own finance_recurring" on finance_recurring;
create policy "own finance_recurring" on finance_recurring
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
