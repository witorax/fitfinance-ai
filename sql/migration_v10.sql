-- ============================================================
-- FitFinance AI - Migration v10 (resume hebdomadaire automatique)
-- A executer dans : Supabase Dashboard > SQL Editor > New query
-- ============================================================

-- Date du dernier resume hebdomadaire genere par Aiden (declenche le dimanche)
alter table profiles add column if not exists last_weekly_summary date;
