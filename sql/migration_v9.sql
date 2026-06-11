-- ============================================================
-- FitFinance AI - Migration v9 (streak et verification des seances manquees)
-- A executer dans : Supabase Dashboard > SQL Editor > New query
-- ============================================================

-- Derniere date pour laquelle l'app a deja demande "oubli ou seance manquee ?"
-- (evite de reposer la question chaque jour pour la meme seance)
alter table profiles add column if not exists missed_checked_until date;
