-- ============================================================
-- FitFinance AI - Migration v7 (quantites des aliments dans les repas du jour)
-- A executer dans : Supabase Dashboard > SQL Editor > New query
-- ============================================================

alter table meal_plan_items add column if not exists quantity text;
