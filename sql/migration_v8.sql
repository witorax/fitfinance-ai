-- ============================================================
-- FitFinance AI - Migration v8 (preferences persistantes pour Aiden)
-- A executer dans : Supabase Dashboard > SQL Editor > New query
-- ============================================================

-- Notes/preferences durables (gouts alimentaires, horaires d'entrainement, contraintes...)
-- Aiden lit et met a jour ce champ pour se "souvenir" de toi sans dependre de l'historique du chat.
alter table profiles add column if not exists preferences text;
