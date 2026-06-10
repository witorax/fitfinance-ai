// ============================================================
// Fonction Vercel (serverless) : Aiden (Claude) avec acces complet
// aux donnees Sport / Nutrition / Finance de l'utilisateur authentifie.
//
// Variables d'environnement requises (Vercel > Project > Settings > Environment Variables):
//   ANTHROPIC_API_KEY        -> cle API Anthropic
//   SUPABASE_URL             -> URL du projet Supabase
//   SUPABASE_SERVICE_ROLE_KEY-> cle "service_role" (secrete, jamais cote client)
// ============================================================

const { createClient } = require("@supabase/supabase-js");
const Anthropic = require("@anthropic-ai/sdk");

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `Tu es Aiden, le coach IA integre a l'application FitFinance AI.
Tu as acces complet (lecture et ecriture) aux donnees sport, nutrition et finance de l'utilisateur via des outils.
Tu peux :
- consulter et enregistrer son profil/objectif, ses mesures corporelles et seances de sport
- generer et sauvegarder des programmes d'entrainement structures sur plusieurs semaines (save_training_program)
- generer des plans alimentaires complets (save_meal_plan) et planifier les repas du jour (save_today_meals)
- ajuster les objectifs nutritionnels (set_nutrition_targets) et l'objectif d'epargne (set_savings_goal)
- consulter, ajouter des transactions financieres et gerer des budgets

PROGRAMMES D'ENTRAINEMENT (save_training_program) :
Tu decides toi-meme, en tant que coach sportif expert, de la duree du programme (en semaines, ex: 6, 8 ou 12)
selon l'objectif de l'utilisateur. Cree un programme structure avec un jour par entree (7 jours), chacun avec
une liste d'exercices precisant sets, reps, repos, notes ET un "youtube_query" (terme de recherche YouTube
precis pour un tutoriel de l'exercice, ex: "bench press technique tutorial"). Ne redemande PAS de modifier
le programme avant la fin de la duree choisie (utilise get_recent_data pour verifier depuis combien de temps
le programme actif tourne). A la fin de la periode, propose proactivement une mise a jour du programme.

NUTRITION ET HYDRATATION :
Sport et Nutrition sont deux sections distinctes mais liees : la depense energetique (calories_burned
des seances, disponible via get_recent_data) doit influencer les plans alimentaires et objectifs caloriques
que tu generes (plus l'utilisateur est actif, plus ses apports caloriques peuvent etre ajustes a la hausse).
Quand tu generes un plan alimentaire ou les repas du jour, appelle get_recent_data pour prendre en compte
cette depense energetique recente et mentionne brievement comment tu en as tenu compte. L'hydratation est
geree par l'utilisateur directement dans l'app (boutons +250ml/+500ml/+1L) ; tu peux toutefois ajuster
l'objectif d'hydratation via set_nutrition_targets si pertinent.

RELATIONS :
Tu as aussi acces a la liste des contacts importants de l'utilisateur (famille, amis, partenaire,
collegues), avec leur frequence de contact souhaitee, la date du dernier contact et leur anniversaire.
get_recent_data te donne la liste des contacts "a recontacter" (en retard par rapport a leur frequence)
et les anniversaires dans les 30 prochains jours. Si l'utilisateur le demande, signale-lui ces elements
et propose des actions concretes (ex: "Appelle Marie cette semaine, ca fait 20 jours"). Utilise add_contact
pour ajouter un nouveau contact si l'utilisateur t'en parle, et log_contact_interaction pour enregistrer
qu'il a contacte quelqu'un aujourd'hui.

DEPENSES RECURRENTES :
L'utilisateur peut avoir des depenses/revenus recurrents (loyer, abonnements, salaire) geres via
set_recurring_transaction. Prends-les en compte (disponibles dans get_recent_data) quand tu analyses
ses finances ou proposes un budget/objectif d'epargne.

Sois proactif : si l'utilisateur demande un programme/plan, genere-le avec les outils dedies pour qu'il
apparaisse dans son espace (programmes sportifs sur la page Sport, plans/repas alimentaires sur la page
Nutrition). Si l'utilisateur demande d'enregistrer quelque chose (seance, mesure, transaction, budget,
objectif d'epargne, contact, depense recurrente), utilise les outils pour le faire reellement, ne te
contente pas de le decrire.

Formate tes reponses en Markdown clair (titres avec #, listes, **gras**, tableaux si utile) pour un bon
rendu visuel. Les montants sont en dollars canadiens ($ CAD). Reponds toujours en francais, de maniere
concise et actionnable.`;

const tools = [
  {
    name: "get_profile",
    description: "Recupere le profil et l'objectif physique de l'utilisateur.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_recent_data",
    description: "Recupere un resume recent : mesures, seances, depense energetique, programme actif, hydratation, repas du jour, transactions, budgets et objectif d'epargne.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "add_body_metric",
    description: "Ajoute une mesure corporelle (poids, masse grasse) a une date donnee.",
    input_schema: {
      type: "object",
      properties: {
        date: { type: "string", description: "Date au format YYYY-MM-DD" },
        weight_kg: { type: "number" },
        body_fat_pct: { type: "number" },
      },
      required: ["date"],
    },
  },
  {
    name: "add_workout",
    description: "Ajoute une seance de sport.",
    input_schema: {
      type: "object",
      properties: {
        date: { type: "string", description: "Date au format YYYY-MM-DD" },
        name: { type: "string", description: "Nom de la seance, ex: Push day" },
        notes: { type: "string", description: "Details des exercices (sets/reps/poids)" },
        calories_burned: { type: "number", description: "Estimation des calories brulees pendant la seance" },
      },
      required: ["date", "name"],
    },
  },
  {
    name: "save_training_program",
    description: "Cree/remplace le programme d'entrainement structure actif de l'utilisateur, sur une duree (en semaines) que tu choisis selon son objectif.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        goal: { type: "string" },
        duration_weeks: { type: "number", description: "Duree du programme en semaines, choisie par toi (ex: 6, 8, 12)" },
        days: {
          type: "array",
          description: "7 entrees, une par jour de la semaine (Lundi a Dimanche)",
          items: {
            type: "object",
            properties: {
              day_name: { type: "string" },
              focus: { type: "string" },
              rest: { type: "boolean" },
              exercises: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    sets: { type: "number" },
                    reps: { type: "string" },
                    rest_time: { type: "string" },
                    notes: { type: "string" },
                    youtube_query: { type: "string", description: "Terme de recherche YouTube pour un tutoriel de cet exercice" },
                  },
                  required: ["name"],
                },
              },
            },
            required: ["day_name"],
          },
        },
      },
      required: ["title", "duration_weeks", "days"],
    },
  },
  {
    name: "save_meal_plan",
    description: "Sauvegarde un plan alimentaire complet (texte/markdown) pour l'utilisateur.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        goal: { type: "string" },
        content: { type: "string", description: "Le plan alimentaire complet, en texte/markdown." },
      },
      required: ["title", "content"],
    },
  },
  {
    name: "save_today_meals",
    description: "Planifie les repas du jour (avec macros) pour que l'utilisateur puisse confirmer chaque repas mange depuis la page Nutrition.",
    input_schema: {
      type: "object",
      properties: {
        meals: {
          type: "array",
          items: {
            type: "object",
            properties: {
              meal_type: { type: "string", description: "petit-dejeuner, diner, souper ou collation" },
              name: { type: "string" },
              calories: { type: "number" },
              protein: { type: "number" },
              carbs: { type: "number" },
              fat: { type: "number" },
            },
            required: ["meal_type", "name", "calories"],
          },
        },
      },
      required: ["meals"],
    },
  },
  {
    name: "set_nutrition_targets",
    description: "Met a jour les objectifs nutritionnels quotidiens de l'utilisateur (calories, macros, hydratation).",
    input_schema: {
      type: "object",
      properties: {
        calorie_target: { type: "number" },
        protein_target: { type: "number" },
        carbs_target: { type: "number" },
        fat_target: { type: "number" },
        water_target_ml: { type: "number" },
      },
    },
  },
  {
    name: "add_transaction",
    description: "Ajoute une transaction financiere. Montant negatif = depense, positif = revenu.",
    input_schema: {
      type: "object",
      properties: {
        date: { type: "string", description: "Date au format YYYY-MM-DD" },
        category: { type: "string" },
        description: { type: "string" },
        amount: { type: "number" },
      },
      required: ["date", "category", "amount"],
    },
  },
  {
    name: "set_budget",
    description: "Cree ou met a jour un budget mensuel pour une categorie.",
    input_schema: {
      type: "object",
      properties: {
        category: { type: "string" },
        monthly_limit: { type: "number" },
      },
      required: ["category", "monthly_limit"],
    },
  },
  {
    name: "set_savings_goal",
    description: "Cree ou met a jour l'objectif d'epargne de l'utilisateur.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        target_amount: { type: "number" },
        current_amount: { type: "number" },
      },
      required: ["target_amount"],
    },
  },
  {
    name: "add_contact",
    description: "Ajoute un contact (personne importante) au suivi relationnel de l'utilisateur.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string" },
        relationship_type: { type: "string", description: "famille, ami, partenaire, collegue ou autre" },
        contact_frequency_days: { type: "number", description: "Frequence de contact souhaitee en jours, ex: 14" },
        birthday: { type: "string", description: "Date de naissance au format YYYY-MM-DD (optionnel)" },
        notes: { type: "string" },
      },
      required: ["name"],
    },
  },
  {
    name: "log_contact_interaction",
    description: "Enregistre que l'utilisateur a contacte une personne aujourd'hui (met a jour la date du dernier contact).",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Nom du contact (recherche approximative)" },
        date: { type: "string", description: "Date au format YYYY-MM-DD, par defaut aujourd'hui" },
      },
      required: ["name"],
    },
  },
  {
    name: "set_recurring_transaction",
    description: "Cree, met a jour ou supprime une depense/revenu recurrent (loyer, abonnement, salaire...).",
    input_schema: {
      type: "object",
      properties: {
        label: { type: "string" },
        category: { type: "string" },
        amount: { type: "number", description: "Negatif = depense, positif = revenu" },
        day_of_month: { type: "number", description: "Jour du mois ou la transaction se produit (1-31)" },
        delete: { type: "boolean", description: "Si true, supprime la transaction recurrente correspondant a label" },
      },
      required: ["label"],
    },
  },
];

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Methode non autorisee" });
  }

  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Non authentifie" });
  }
  const accessToken = authHeader.replace("Bearer ", "");

  // Client "utilisateur" : valide le token
  const supabaseUser = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });

  const { data: userData, error: userError } = await supabaseUser.auth.getUser(accessToken);
  if (userError || !userData?.user) {
    return res.status(401).json({ error: "Session invalide" });
  }
  const userId = userData.user.id;

  // Client "service" : acces complet, on filtre nous-memes par user_id
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
  const incomingMessages = Array.isArray(body.messages) ? body.messages : [];
  if (incomingMessages.length === 0) {
    return res.status(400).json({ error: "Aucun message fourni" });
  }

  const lastUserMessage = [...incomingMessages].reverse().find(m => m.role === "user");

  // Ne garder que role/content (texte) pour l'historique envoye a Claude
  const messages = incomingMessages
    .filter(m => m.role === "user" || m.role === "assistant")
    .map(m => ({ role: m.role, content: m.content }));

  function startOfWeekStr() {
    const d = new Date();
    const day = (d.getDay() + 6) % 7; // lundi = 0
    d.setDate(d.getDate() - day);
    return d.toISOString().slice(0, 10);
  }

  async function executeTool(name, input) {
    switch (name) {
      case "get_profile": {
        const { data } = await supabase.from("profiles").select("*").eq("id", userId).single();
        return data || {};
      }
      case "get_recent_data": {
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        const startStr = startOfMonth.toISOString().slice(0, 10);
        const weekStr = startOfWeekStr();
        const today = new Date().toISOString().slice(0, 10);

        const [
          { data: metrics },
          { data: workouts },
          { data: weekWorkouts },
          { data: transactions },
          { data: budgets },
          { data: program },
          { data: todayMeals },
          { data: hydration },
          { data: savingsGoal },
          { data: contacts },
          { data: recurring },
        ] = await Promise.all([
          supabase.from("body_metrics").select("*").eq("user_id", userId).order("date", { ascending: false }).limit(5),
          supabase.from("workouts").select("*").eq("user_id", userId).order("date", { ascending: false }).limit(5),
          supabase.from("workouts").select("date, calories_burned").eq("user_id", userId).gte("date", weekStr),
          supabase.from("finance_transactions").select("*").eq("user_id", userId).gte("date", startStr).order("date", { ascending: false }),
          supabase.from("finance_budgets").select("*").eq("user_id", userId),
          supabase.from("training_programs").select("*").eq("user_id", userId).eq("active", true).order("created_at", { ascending: false }).limit(1).maybeSingle(),
          supabase.from("meal_plan_items").select("*").eq("user_id", userId).eq("date", today),
          supabase.from("hydration_logs").select("amount_ml").eq("user_id", userId).eq("date", today),
          supabase.from("finance_goals").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
          supabase.from("contacts").select("*").eq("user_id", userId),
          supabase.from("finance_recurring").select("*").eq("user_id", userId),
        ]);

        const calories_burned_this_week = (weekWorkouts || []).reduce((s, w) => s + (Number(w.calories_burned) || 0), 0);
        const distinct_workout_days_this_week = new Set((weekWorkouts || []).map(w => w.date)).size;
        const hydration_today_ml = (hydration || []).reduce((s, h) => s + (Number(h.amount_ml) || 0), 0);

        let programInfo = null;
        if (program) {
          const start = new Date(program.start_date);
          const now = new Date();
          const weeksElapsed = Math.floor((now - start) / (7 * 86400000));
          programInfo = {
            title: program.title,
            goal: program.goal,
            duration_weeks: program.duration_weeks,
            start_date: program.start_date,
            weeks_elapsed: weeksElapsed,
            program_completed: weeksElapsed >= program.duration_weeks,
          };
        }

        const now = new Date();
        const contactsOverdue = (contacts || [])
          .filter(c => {
            const freq = c.contact_frequency_days || 14;
            if (!c.last_contact_date) return true;
            const days = Math.floor((now - new Date(c.last_contact_date)) / 86400000);
            return days >= freq;
          })
          .map(c => ({
            name: c.name,
            relationship_type: c.relationship_type,
            days_since_contact: c.last_contact_date ? Math.floor((now - new Date(c.last_contact_date)) / 86400000) : null,
            contact_frequency_days: c.contact_frequency_days,
          }));

        const upcomingBirthdays = (contacts || [])
          .map(c => {
            if (!c.birthday) return null;
            const b = new Date(c.birthday);
            let next = new Date(now.getFullYear(), b.getMonth(), b.getDate());
            const todayMid = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            if (next < todayMid) next = new Date(now.getFullYear() + 1, b.getMonth(), b.getDate());
            const daysUntil = Math.round((next - todayMid) / 86400000);
            return daysUntil <= 30 ? { name: c.name, date: next.toISOString().slice(0, 10), days_until: daysUntil } : null;
          })
          .filter(Boolean);

        const recurring_monthly_total = (recurring || []).reduce((s, r) => s + Number(r.amount), 0);

        return {
          metrics,
          workouts,
          calories_burned_this_week,
          distinct_workout_days_this_week,
          transactions,
          budgets,
          active_program: programInfo,
          today_meals: todayMeals,
          hydration_today_ml,
          savings_goal: savingsGoal,
          contacts_to_recontact: contactsOverdue,
          upcoming_birthdays: upcomingBirthdays,
          recurring_transactions: recurring,
          recurring_monthly_total,
        };
      }
      case "add_body_metric": {
        const { error } = await supabase.from("body_metrics").insert({
          user_id: userId,
          date: input.date,
          weight_kg: input.weight_kg ?? null,
          body_fat_pct: input.body_fat_pct ?? null,
        });
        return error ? { error: error.message } : { success: true };
      }
      case "add_workout": {
        const { error } = await supabase.from("workouts").insert({
          user_id: userId,
          date: input.date,
          name: input.name,
          notes: input.notes ?? null,
          calories_burned: input.calories_burned ?? null,
        });
        return error ? { error: error.message } : { success: true };
      }
      case "save_training_program": {
        await supabase.from("training_programs").update({ active: false }).eq("user_id", userId).eq("active", true);
        const { error } = await supabase.from("training_programs").insert({
          user_id: userId,
          title: input.title,
          goal: input.goal ?? null,
          duration_weeks: input.duration_weeks,
          start_date: new Date().toISOString().slice(0, 10),
          days: input.days,
          active: true,
        });
        return error ? { error: error.message } : { success: true };
      }
      case "save_meal_plan": {
        const { error } = await supabase.from("meal_plans").insert({
          user_id: userId,
          title: input.title,
          goal: input.goal ?? null,
          content: input.content,
        });
        return error ? { error: error.message } : { success: true };
      }
      case "save_today_meals": {
        const today = new Date().toISOString().slice(0, 10);
        await supabase.from("meal_plan_items").delete().eq("user_id", userId).eq("date", today).eq("eaten", false);
        const rows = (input.meals || []).map(m => ({
          user_id: userId,
          meal_type: m.meal_type,
          name: m.name,
          calories: m.calories ?? 0,
          protein: m.protein ?? 0,
          carbs: m.carbs ?? 0,
          fat: m.fat ?? 0,
          date: today,
          eaten: false,
        }));
        if (rows.length === 0) return { success: true, inserted: 0 };
        const { error } = await supabase.from("meal_plan_items").insert(rows);
        return error ? { error: error.message } : { success: true, inserted: rows.length };
      }
      case "set_nutrition_targets": {
        const update = {};
        ["calorie_target", "protein_target", "carbs_target", "fat_target", "water_target_ml"].forEach(k => {
          if (input[k] !== undefined) update[k] = input[k];
        });
        if (Object.keys(update).length === 0) return { success: true, updated: false };
        const { error } = await supabase.from("profiles").update(update).eq("id", userId);
        return error ? { error: error.message } : { success: true };
      }
      case "add_transaction": {
        const { error } = await supabase.from("finance_transactions").insert({
          user_id: userId,
          date: input.date,
          category: input.category,
          description: input.description ?? null,
          amount: input.amount,
        });
        return error ? { error: error.message } : { success: true };
      }
      case "set_budget": {
        const { data: existing } = await supabase
          .from("finance_budgets")
          .select("id")
          .eq("user_id", userId)
          .eq("category", input.category)
          .maybeSingle();

        if (existing) {
          const { error } = await supabase
            .from("finance_budgets")
            .update({ monthly_limit: input.monthly_limit })
            .eq("id", existing.id);
          return error ? { error: error.message } : { success: true, updated: true };
        } else {
          const { error } = await supabase.from("finance_budgets").insert({
            user_id: userId,
            category: input.category,
            monthly_limit: input.monthly_limit,
          });
          return error ? { error: error.message } : { success: true, created: true };
        }
      }
      case "set_savings_goal": {
        const { data: existing } = await supabase
          .from("finance_goals")
          .select("id")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const update = {};
        if (input.title !== undefined) update.title = input.title;
        if (input.target_amount !== undefined) update.target_amount = input.target_amount;
        if (input.current_amount !== undefined) update.current_amount = input.current_amount;

        if (existing) {
          const { error } = await supabase.from("finance_goals").update(update).eq("id", existing.id);
          return error ? { error: error.message } : { success: true, updated: true };
        } else {
          const { error } = await supabase.from("finance_goals").insert({
            user_id: userId,
            title: input.title || "Epargne",
            target_amount: input.target_amount ?? 0,
            current_amount: input.current_amount ?? 0,
          });
          return error ? { error: error.message } : { success: true, created: true };
        }
      }
      case "add_contact": {
        const { error } = await supabase.from("contacts").insert({
          user_id: userId,
          name: input.name,
          relationship_type: input.relationship_type ?? null,
          contact_frequency_days: input.contact_frequency_days ?? 14,
          birthday: input.birthday ?? null,
          notes: input.notes ?? null,
          last_contact_date: new Date().toISOString().slice(0, 10),
        });
        return error ? { error: error.message } : { success: true };
      }
      case "log_contact_interaction": {
        const { data: match } = await supabase
          .from("contacts")
          .select("id, name")
          .eq("user_id", userId)
          .ilike("name", `%${input.name}%`)
          .limit(1)
          .maybeSingle();
        if (!match) return { error: `Aucun contact trouve pour "${input.name}"` };
        const { error } = await supabase
          .from("contacts")
          .update({ last_contact_date: input.date || new Date().toISOString().slice(0, 10) })
          .eq("id", match.id);
        return error ? { error: error.message } : { success: true, contact: match.name };
      }
      case "set_recurring_transaction": {
        const { data: existing } = await supabase
          .from("finance_recurring")
          .select("id")
          .eq("user_id", userId)
          .ilike("label", input.label)
          .maybeSingle();

        if (input.delete) {
          if (!existing) return { success: true, deleted: false };
          const { error } = await supabase.from("finance_recurring").delete().eq("id", existing.id);
          return error ? { error: error.message } : { success: true, deleted: true };
        }

        const payload = {
          label: input.label,
          category: input.category ?? null,
          amount: input.amount ?? 0,
          day_of_month: input.day_of_month ?? 1,
        };

        if (existing) {
          const { error } = await supabase.from("finance_recurring").update(payload).eq("id", existing.id);
          return error ? { error: error.message } : { success: true, updated: true };
        } else {
          const { error } = await supabase.from("finance_recurring").insert({ user_id: userId, ...payload });
          return error ? { error: error.message } : { success: true, created: true };
        }
      }
      default:
        return { error: `Outil inconnu: ${name}` };
    }
  }

  try {
    let finalText = "";

    // Boucle d'utilisation d'outils (max 6 allers-retours)
    for (let i = 0; i < 6; i++) {
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-5",
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        tools,
        messages,
      });

      const toolUses = response.content.filter(b => b.type === "tool_use");
      const textBlocks = response.content.filter(b => b.type === "text");
      finalText = textBlocks.map(b => b.text).join("\n").trim();

      if (response.stop_reason !== "tool_use" || toolUses.length === 0) {
        break;
      }

      messages.push({ role: "assistant", content: response.content });

      const toolResults = [];
      for (const toolUse of toolUses) {
        const result = await executeTool(toolUse.name, toolUse.input || {});
        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: JSON.stringify(result),
        });
      }
      messages.push({ role: "user", content: toolResults });
    }

    if (!finalText) {
      finalText = "Desole, je n'ai pas pu generer de reponse. Peux-tu reformuler ta demande ?";
    }

    // Sauvegarde de l'historique de conversation
    if (lastUserMessage) {
      await supabase.from("ai_messages").insert([
        { user_id: userId, role: "user", content: lastUserMessage.content },
        { user_id: userId, role: "assistant", content: finalText },
      ]);
    }

    return res.status(200).json({ reply: finalText });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erreur lors de l'appel a l'IA: " + err.message });
  }
};
