-- ============================================================
-- FitFinance AI - Schema Supabase
-- A executer dans : Supabase Dashboard > SQL Editor > New query
-- ============================================================

-- Profil utilisateur (objectifs, infos physiques)
create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text,
  age int,
  height_cm numeric,
  goal text,                  -- ex: "perte de poids", "prise de masse", "maintien"
  activity_level text,        -- ex: "sedentaire", "modere", "actif", "tres actif"
  created_at timestamptz default now()
);

-- Mesures corporelles (suivi de progression)
create table if not exists body_metrics (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  date date not null default current_date,
  weight_kg numeric,
  body_fat_pct numeric,
  notes text,
  created_at timestamptz default now()
);

-- Seances d'entrainement
create table if not exists workouts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  date date not null default current_date,
  name text,
  notes text,
  calories_burned numeric,
  created_at timestamptz default now()
);

-- Exercices d'une seance
create table if not exists workout_exercises (
  id uuid default gen_random_uuid() primary key,
  workout_id uuid references workouts on delete cascade not null,
  exercise_name text not null,
  sets int,
  reps int,
  weight_kg numeric,
  order_index int default 0
);

-- Plans alimentaires generes par l'IA
create table if not exists meal_plans (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  title text,
  goal text,
  content jsonb not null,
  created_at timestamptz default now()
);

-- Plans d'entrainement generes par l'IA
create table if not exists workout_plans (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  title text,
  goal text,
  content jsonb not null,
  created_at timestamptz default now()
);

-- Categories de budget
create table if not exists finance_budgets (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  category text not null,
  monthly_limit numeric not null,
  created_at timestamptz default now()
);

-- Transactions financieres
create table if not exists finance_transactions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  date date not null default current_date,
  category text not null,
  description text,
  amount numeric not null,    -- positif = revenu, negatif = depense
  created_at timestamptz default now()
);

-- Historique des conversations avec l'IA (memoire du coach)
create table if not exists ai_messages (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  role text not null,         -- 'user' ou 'assistant'
  content text not null,
  created_at timestamptz default now()
);

-- ============================================================
-- Row Level Security : chaque utilisateur ne voit que ses donnees
-- ============================================================
alter table profiles enable row level security;
alter table body_metrics enable row level security;
alter table workouts enable row level security;
alter table workout_exercises enable row level security;
alter table meal_plans enable row level security;
alter table workout_plans enable row level security;
alter table finance_budgets enable row level security;
alter table finance_transactions enable row level security;
alter table ai_messages enable row level security;

create policy "own profile" on profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "own body_metrics" on body_metrics
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own workouts" on workouts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own workout_exercises" on workout_exercises
  for all using (
    exists (select 1 from workouts w where w.id = workout_exercises.workout_id and w.user_id = auth.uid())
  ) with check (
    exists (select 1 from workouts w where w.id = workout_exercises.workout_id and w.user_id = auth.uid())
  );

create policy "own meal_plans" on meal_plans
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own workout_plans" on workout_plans
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own finance_budgets" on finance_budgets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own finance_transactions" on finance_transactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own ai_messages" on ai_messages
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Creation automatique d'un profil a l'inscription
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
