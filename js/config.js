// ============================================================
// Configuration Supabase
// Remplace ces valeurs par celles de ton projet Supabase :
// Dashboard > Project Settings > API
// La cle "anon public" est faite pour etre utilisee cote client.
// ============================================================
const SUPABASE_URL = "https://qgrrsmnkajgogokqylch.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_CglKNw9OuEmMcw4Fv9H_BQ_WjfzZ0Ma";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
