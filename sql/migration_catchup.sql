-- ============================================================
-- FitFinance AI - Rattrapage (migrations v4 a v8)
-- A executer en UNE FOIS dans : Supabase Dashboard > SQL Editor > New query
-- Sans danger a relancer plusieurs fois (tout est "if not exists").
-- ============================================================

-- ── v4 : Liste de courses ──
alter table profiles add column if not exists grocery_budget_weekly numeric default 80;

create table if not exists shopping_list_items (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  quantity text,
  category text,
  estimated_price numeric default 0,
  purchased boolean default false,
  created_at timestamptz default now()
);

alter table shopping_list_items enable row level security;

drop policy if exists "own shopping_list_items" on shopping_list_items;
create policy "own shopping_list_items" on shopping_list_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── v5 : Cycle d'assiduite 30 jours ──
alter table profiles add column if not exists adherence_cycle_start date default current_date;

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

-- ── v6 : Calendrier, notifications, profil/avatar ──
alter table profiles add column if not exists avatar_url text;

create table if not exists calendar_events (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  title text not null,
  date date not null,
  event_type text default 'autre',
  notes text,
  created_at timestamptz default now()
);

create table if not exists notifications (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  message text not null,
  read boolean default false,
  created_at timestamptz default now()
);

alter table calendar_events enable row level security;
alter table notifications enable row level security;

drop policy if exists "own calendar_events" on calendar_events;
create policy "own calendar_events" on calendar_events
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own notifications" on notifications;
create policy "own notifications" on notifications
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "Avatar images are publicly accessible" on storage.objects;
create policy "Avatar images are publicly accessible" on storage.objects
  for select using (bucket_id = 'avatars');

drop policy if exists "Users can upload their own avatar" on storage.objects;
create policy "Users can upload their own avatar" on storage.objects
  for insert with check (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "Users can update their own avatar" on storage.objects;
create policy "Users can update their own avatar" on storage.objects
  for update using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "Users can delete their own avatar" on storage.objects;
create policy "Users can delete their own avatar" on storage.objects
  for delete using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

-- ── v7 : Quantites des aliments dans les repas du jour ──
alter table meal_plan_items add column if not exists quantity text;

-- ── v8 : Preferences persistantes pour Aiden ──
alter table profiles add column if not exists preferences text;
