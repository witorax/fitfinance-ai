// ============================================================
// Fonction Netlify : Coach IA (Claude) avec acces complet
// aux donnees Sport / Finance de l'utilisateur authentifie.
//
// Variables d'environnement requises (Netlify > Site settings > Environment):
//   ANTHROPIC_API_KEY        -> cle API Anthropic
//   SUPABASE_URL             -> URL du projet Supabase
//   SUPABASE_SERVICE_ROLE_KEY-> cle "service_role" (secrete, jamais cote client)
// ============================================================

const { createClient } = require("@supabase/supabase-js");
const Anthropic = require("@anthropic-ai/sdk");

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `Tu es le Coach IA integre a l'application FitFinance AI.
Tu as acces complet (lecture et ecriture) aux donnees sport et finance de l'utilisateur via des outils.
Tu peux :
- consulter et enregistrer son profil/objectif, ses mesures corporelles et seances de sport
- generer et sauvegarder des plans alimentaires et des plans d'entrainement personnalises selon son objectif
- consulter, ajouter des transactions financieres et gerer des budgets

Sois proactif : si l'utilisateur demande un plan, genere-le avec save_meal_plan ou save_workout_plan
pour qu'il apparaisse dans son espace. Si l'utilisateur demande d'enregistrer quelque chose
(seance, mesure, transaction, budget), utilise les outils pour le faire reellement, ne te contente pas de le decrire.
Reponds toujours en francais, de maniere concise et actionnable.`;

const tools = [
  {
    name: "get_profile",
    description: "Recupere le profil et l'objectif physique de l'utilisateur.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_recent_data",
    description: "Recupere un resume recent : dernieres mesures corporelles, dernieres seances, dernieres transactions et budgets.",
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
      },
      required: ["date", "name"],
    },
  },
  {
    name: "save_meal_plan",
    description: "Sauvegarde un plan alimentaire genere pour l'utilisateur.",
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
    name: "save_workout_plan",
    description: "Sauvegarde un plan d'entrainement genere pour l'utilisateur.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        goal: { type: "string" },
        content: { type: "string", description: "Le plan d'entrainement complet, en texte/markdown." },
      },
      required: ["title", "content"],
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
];

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Methode non autorisee" }) };
  }

  const authHeader = event.headers.authorization || event.headers.Authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return { statusCode: 401, body: JSON.stringify({ error: "Non authentifie" }) };
  }
  const accessToken = authHeader.replace("Bearer ", "");

  // Client "utilisateur" : valide le token et respecte les RLS
  const supabaseUser = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });

  const { data: userData, error: userError } = await supabaseUser.auth.getUser(accessToken);
  if (userError || !userData?.user) {
    return { statusCode: 401, body: JSON.stringify({ error: "Session invalide" }) };
  }
  const userId = userData.user.id;

  // Client "service" : acces complet, on filtre nous-memes par user_id
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "JSON invalide" }) };
  }

  const incomingMessages = Array.isArray(body.messages) ? body.messages : [];
  if (incomingMessages.length === 0) {
    return { statusCode: 400, body: JSON.stringify({ error: "Aucun message fourni" }) };
  }

  const lastUserMessage = [...incomingMessages].reverse().find(m => m.role === "user");

  // Ne garder que role/content (texte) pour l'historique envoye a Claude
  const messages = incomingMessages
    .filter(m => m.role === "user" || m.role === "assistant")
    .map(m => ({ role: m.role, content: m.content }));

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

        const [{ data: metrics }, { data: workouts }, { data: transactions }, { data: budgets }] = await Promise.all([
          supabase.from("body_metrics").select("*").eq("user_id", userId).order("date", { ascending: false }).limit(5),
          supabase.from("workouts").select("*").eq("user_id", userId).order("date", { ascending: false }).limit(5),
          supabase.from("finance_transactions").select("*").eq("user_id", userId).gte("date", startStr).order("date", { ascending: false }),
          supabase.from("finance_budgets").select("*").eq("user_id", userId),
        ]);
        return { metrics, workouts, transactions, budgets };
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
      case "save_workout_plan": {
        const { error } = await supabase.from("workout_plans").insert({
          user_id: userId,
          title: input.title,
          goal: input.goal ?? null,
          content: input.content,
        });
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

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reply: finalText }),
    };
  } catch (err) {
    console.error(err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Erreur lors de l'appel a l'IA: " + err.message }),
    };
  }
};
