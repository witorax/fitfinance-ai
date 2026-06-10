-- ============================================================
-- FitFinance AI - Migration v2 (Aiden)
-- A executer dans : Supabase Dashboard > SQL Editor > New query
-- Ne touche pas aux tables/donnees existantes, ajoute seulement le nouveau.
-- ============================================================

-- Nouvelles colonnes sur profiles
alter table profiles add column if not exists weekly_workout_target int default 4;
alter table profiles add column if not exists calorie_target numeric default 2400;
alter table profiles add column if not exists protein_target numeric default 160;
alter table profiles add column if not exists carbs_target numeric default 250;
alter table profiles add column if not exists fat_target numeric default 70;
alter table profiles add column if not exists water_target_ml numeric default 2500;

-- Programmes d'entrainement structures generes par Aiden (plusieurs semaines)
create table if not exists training_programs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  title text,
  goal text,
  duration_weeks int not null default 8,
  start_date date not null default current_date,
  days jsonb not null,
  active boolean default true,
  created_at timestamptz default now()
);

-- Poids/reps utilises a la salle pour chaque exercice (suivi en direct)
create table if not exists exercise_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  exercise_name text not null,
  date date not null default current_date,
  weight_kg numeric,
  reps int,
  sets int,
  created_at timestamptz default now()
);

-- Repas planifies pour la journee (avec confirmation "mange")
create table if not exists meal_plan_items (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  meal_type text,
  name text not null,
  calories numeric default 0,
  protein numeric default 0,
  carbs numeric default 0,
  fat numeric default 0,
  date date not null default current_date,
  eaten boolean default false,
  created_at timestamptz default now()
);

-- Hydratation (ml par entree)
create table if not exists hydration_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  date date not null default current_date,
  amount_ml numeric not null,
  created_at timestamptz default now()
);

-- Objectifs d'epargne (modifiable)
create table if not exists finance_goals (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  title text not null default 'Epargne',
  target_amount numeric not null default 0,
  current_amount numeric not null default 0,
  created_at timestamptz default now()
);

-- ============================================================
-- Row Level Security
-- ============================================================
alter table training_programs enable row level security;
alter table exercise_logs enable row level security;
alter table meal_plan_items enable row level security;
alter table hydration_logs enable row level security;
alter table finance_goals enable row level security;

drop policy if exists "own training_programs" on training_programs;
create policy "own training_programs" on training_programs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own exercise_logs" on exercise_logs;
create policy "own exercise_logs" on exercise_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own meal_plan_items" on meal_plan_items;
create policy "own meal_plan_items" on meal_plan_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own hydration_logs" on hydration_logs;
create policy "own hydration_logs" on hydration_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own finance_goals" on finance_goals;
create policy "own finance_goals" on finance_goals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
