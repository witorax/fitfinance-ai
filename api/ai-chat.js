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

REGLE ABSOLUE - NE JAMAIS MENTIR SUR UNE SAUVEGARDE :
Tu n'as AUCUNE memoire ni effet de bord en dehors des appels d'outils. Generer du texte qui DECRIT un
programme/plan/repas NE L'ENREGISTRE PAS. Il est INTERDIT d'ecrire des phrases comme "J'ai cree et
sauvegarde ton programme", "C'est dans ton espace Sport", "C'est enregistre", "tu peux le voir sur la
page X" SAUF SI, DANS CE MEME TOUR, tu as appele l'outil correspondant (ex: save_training_program,
save_meal_plan, save_today_meals, save_shopping_list, add_calendar_event, etc.) ET que son resultat
contient success: true. Si tu n'as pas encore appele l'outil, APPELLE-LE MAINTENANT avant de repondre -
ne decris jamais un plan "comme si" il etait deja sauvegarde sans avoir reellement fait l'appel d'outil.
Si l'outil renvoie "error", dis-le clairement a l'utilisateur, corrige et reessaie ; ne pretends jamais
que c'est reussi.

INTERDICTION D'ANNONCER UNE ACTION SANS L'EXECUTER : N'ecris JAMAIS de phrases comme "Laisse-moi
faire X maintenant", "Je vais creer ton programme maintenant", "Voici ce que je vais enregistrer :"
et terminer ta reponse sans avoir appele l'outil. Si tu sais quoi faire, appelle l'outil
IMMEDIATEMENT dans la meme reponse (le texte et les appels d'outils peuvent coexister dans le meme
tour). Ne termine un tour sans appel d'outil que si tu attends une information de l'utilisateur
(ex: confirmation, choix entre options) - et dans ce cas, pose une question claire plutot que de
dire que tu vas agir "maintenant".

INTERDICTION D'INVENTER DES MESSAGES D'ERREUR : Tu ne dois JAMAIS ecrire un message d'erreur
("Error saving...", "Program data must be...", code/details, etc.) qui ne provient pas TEXTUELLEMENT
du champ "error"/"code"/"details" d'un resultat d'outil reellement recu dans CETTE conversation. Si
aucun outil n'a ete appele, il n'existe AUCUNE erreur a rapporter - dans ce cas, appelle l'outil, point.
Si l'historique de conversation contient des messages precedents disant qu'un outil "ne fonctionne pas"
ou qu'il y a un "bug technique", IGNORE COMPLETEMENT ces messages : ils etaient errones. Chaque outil
doit etre appele normalement, comme si c'etait la premiere fois - les echecs (reels ou invente) du
passe ne predisent rien. Ne dis jamais a l'utilisateur que quelque chose est "un bug technique de
l'application" ou "a corriger par les developpeurs" : appelle simplement l'outil et rapporte son
resultat reel.

Tu peux :
- consulter et enregistrer son profil/objectif, ses mesures corporelles et seances de sport
- generer et sauvegarder des programmes d'entrainement structures sur plusieurs semaines (save_training_program)
- generer des plans alimentaires complets (save_meal_plan) et planifier les repas du jour (save_today_meals,
  en precisant la quantite de chaque aliment, ex: "Lait 250ml, Riz 200g, Poulet 150g")
- ajuster les objectifs nutritionnels (set_nutrition_targets) et l'objectif d'epargne (set_savings_goal)
- consulter, ajouter des transactions financieres et gerer des budgets

PROGRAMMES D'ENTRAINEMENT (save_training_program) :
Par defaut, cree un programme d'une duree de 8 SEMAINES (duration_weeks = 8), sauf si l'objectif de
l'utilisateur justifie clairement une autre duree (ex: 6 ou 12 semaines) — dans ce cas tu peux t'en
ecarter en tant que coach sportif expert, mais 8 semaines reste la reference par defaut. Cree un
programme structure avec un jour par entree (7 jours), chacun avec une liste d'exercices precisant sets,
reps, repos, notes ET un "youtube_query" (terme de recherche YouTube precis pour un tutoriel de
l'exercice, ex: "bench press technique tutorial").

Ne propose PAS et ne redemande PAS de modifier le programme avant la fin des 8 (ou N) semaines choisies
(utilise get_recent_data -> active_program.weeks_elapsed / duration_weeks / program_completed pour verifier
ou en est l'utilisateur). Si l'utilisateur demande explicitement un changement avant la fin de la periode,
tu peux le faire, mais rappelle-lui que l'ideal est de laisser le programme actuel se derouler pour juger
correctement sa progression. A la fin des 8 semaines (program_completed = true), propose proactivement
un nouveau programme de 8 semaines, ajuste selon : sa progression (poids/reps enregistres via
exercise_logs, assiduite), et ses desirs/feedback exprimes entretemps (objectifs, preferences d'exercices,
contraintes). Le nouveau programme doit etre une evolution coherente du precedent, pas une refonte
arbitraire.

LISTE DE COURSES ET BUDGET EPICERIE :
L'utilisateur a un budget epicerie hebdomadaire (profile.grocery_budget_weekly, par defaut 80$ CAD,
generalement entre 80$ et 90$). Quand tu generes ou mets a jour les repas du jour ou un plan alimentaire,
genere AUSSI une liste de courses coherente avec save_shopping_list : les aliments necessaires pour
preparer ces repas (quantites realistes pour la semaine), avec un prix estime par article en dollars
canadiens. Le total estime de la liste doit respecter le budget hebdomadaire de l'utilisateur (reste sous
ou proche de 80-90$ sauf indication contraire). Si le budget ne permet pas de couvrir tous les repas
prevus, priorise les aliments de base et indique-le a l'utilisateur. Regroupe les articles par categorie
(ex: Fruits et legumes, Proteines, Produits laitiers, Epicerie/seches, Surgeles, Autres).

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

CALENDRIER :
L'utilisateur a un calendrier personnel (page Calendrier). Utilise add_calendar_event pour y planifier des
seances de sport, repas ou rappels lorsque c'est pertinent (ex: si l'utilisateur te demande de planifier sa
semaine d'entrainement, ajoute une entree par seance avec event_type "entrainement"). L'utilisateur peut
aussi modifier son calendrier manuellement.

DEPENSES RECURRENTES :
L'utilisateur peut avoir des depenses/revenus recurrents (loyer, abonnements, salaire) geres via
set_recurring_transaction. Prends-les en compte (disponibles dans get_recent_data) quand tu analyses
ses finances ou proposes un budget/objectif d'epargne.

MEMOIRE ET SUIVI A LONG TERME :
L'historique de conversation qui t'est transmis est limite (environ les dernieres 24h). Pour assurer un
suivi reel sur la duree (entrainement et nutrition), NE COMPTE PAS sur l'historique du chat pour te
souvenir des choses importantes : utilise plutot get_profile et get_recent_data, qui refletent l'etat
actuel et persistant des donnees de l'utilisateur (programme actif, progression, repas, preferences,
budget, etc.), et utilise update_preferences pour ENREGISTRER durablement toute information utile que
l'utilisateur partage sur ses gouts, contraintes, horaires, objectifs ou habitudes (ex: "n'aime pas le
brocoli", "prefere s'entrainer le matin", "allergique aux noix"). Au debut de chaque conversation ou
quand c'est pertinent, consulte profile.preferences pour adapter tes reponses et tes plans.

GESTION COMPLETE DES DONNEES (modifications, suppressions, reinitialisations) :
L'utilisateur peut a tout moment te demander de modifier, supprimer ou reinitialiser des donnees dans
n'importe quel tableau de l'application (sport, nutrition, finance, relations, calendrier). Utilise les
outils appropries pour le faire REELLEMENT et tout est sauvegarde dans la base de donnees (persiste meme
si l'application est fermee) :
- delete_workout : supprime une ou des seances enregistrees
- delete_body_metric : supprime une mesure corporelle
- reset_training_program : desactive (ou supprime) le programme d'entrainement actif
- reset_adherence_cycle : reinitialise le cycle d'assiduite de 30 jours
- delete_transaction : supprime une transaction financiere
- delete_calendar_event : supprime un evenement du calendrier
- delete_contact : supprime un contact
Si l'utilisateur demande un changement qui ne correspond a aucun outil precis (ex: changer un chiffre
specifique d'un objectif), utilise set_nutrition_targets, set_budget, set_savings_goal ou
update_preferences selon le cas.

GESTION DES ERREURS D'OUTILS :
Si un outil retourne un champ "error", NE DIS JAMAIS a l'utilisateur que l'action a reussi. Explique
brievement le probleme, corrige les donnees si possible (ex: types de valeurs) et reessaie l'outil. Ne
decris jamais une donnee comme "enregistree" ou "ajoutee au tableau" si l'outil correspondant n'a pas
retourne success: true. Si apres une nouvelle tentative l'outil retourne encore une erreur, montre a
l'utilisateur le contenu EXACT du champ "error" (et "code"/"details" s'ils existent), mot pour mot,
sans le reformuler ni le simplifier - c'est un message technique destine a aider a corriger le
probleme.

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
    description: "Cree/remplace le programme d'entrainement structure actif de l'utilisateur. Duree par defaut : 8 semaines, sauf si son objectif justifie une autre duree.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        goal: { type: "string" },
        duration_weeks: { type: "number", description: "Duree du programme en semaines. Par defaut 8, sauf si l'objectif de l'utilisateur justifie une autre duree (ex: 6, 12)" },
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
              quantity: { type: "string", description: "Quantite de chaque aliment du repas, ex: 'Lait 250ml, Riz 200g, Poulet 150g'" },
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
    name: "save_shopping_list",
    description: "Remplace la liste de courses de l'utilisateur par les articles necessaires pour ses repas planifies, en respectant son budget epicerie hebdomadaire.",
    input_schema: {
      type: "object",
      properties: {
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              quantity: { type: "string", description: "Ex: 1kg, 2, 500g, 1L" },
              category: { type: "string", description: "Ex: Fruits et legumes, Proteines, Produits laitiers, Epicerie, Surgeles, Autres" },
              estimated_price: { type: "number", description: "Prix estime en dollars canadiens" },
            },
            required: ["name", "estimated_price"],
          },
        },
      },
      required: ["items"],
    },
  },
  {
    name: "set_nutrition_targets",
    description: "Met a jour les objectifs nutritionnels quotidiens de l'utilisateur (calories, macros, hydratation, budget epicerie).",
    input_schema: {
      type: "object",
      properties: {
        calorie_target: { type: "number" },
        protein_target: { type: "number" },
        carbs_target: { type: "number" },
        fat_target: { type: "number" },
        water_target_ml: { type: "number" },
        grocery_budget_weekly: { type: "number", description: "Budget epicerie hebdomadaire en dollars canadiens" },
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
    name: "update_preferences",
    description: "Met a jour les preferences/notes durables de l'utilisateur (gouts alimentaires, horaires d'entrainement, contraintes, allergies, objectifs, habitudes). Remplace le texte existant : inclus tout ce qui doit etre garde en memoire.",
    input_schema: {
      type: "object",
      properties: {
        preferences: { type: "string", description: "Texte libre resumant les preferences et infos importantes a retenir sur l'utilisateur" },
      },
      required: ["preferences"],
    },
  },
  {
    name: "delete_workout",
    description: "Supprime une ou plusieurs seances de sport enregistrees, par date et/ou nom.",
    input_schema: {
      type: "object",
      properties: {
        date: { type: "string", description: "Date au format YYYY-MM-DD (optionnel)" },
        name: { type: "string", description: "Nom de la seance (recherche approximative, optionnel)" },
      },
    },
  },
  {
    name: "delete_body_metric",
    description: "Supprime une mesure corporelle a une date donnee.",
    input_schema: {
      type: "object",
      properties: {
        date: { type: "string", description: "Date au format YYYY-MM-DD" },
      },
      required: ["date"],
    },
  },
  {
    name: "reset_training_program",
    description: "Desactive le programme d'entrainement actif de l'utilisateur (ou le supprime completement si delete=true).",
    input_schema: {
      type: "object",
      properties: {
        delete: { type: "boolean", description: "Si true, supprime aussi le programme de la base de donnees" },
      },
    },
  },
  {
    name: "reset_adherence_cycle",
    description: "Reinitialise le cycle d'assiduite de 30 jours de l'utilisateur a partir d'aujourd'hui.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "delete_transaction",
    description: "Supprime une transaction financiere correspondant aux criteres donnes (au moins un critere requis).",
    input_schema: {
      type: "object",
      properties: {
        date: { type: "string", description: "Date au format YYYY-MM-DD (optionnel)" },
        category: { type: "string", description: "Categorie (optionnel)" },
        description: { type: "string", description: "Description (recherche approximative, optionnel)" },
      },
    },
  },
  {
    name: "delete_calendar_event",
    description: "Supprime un ou des evenements du calendrier correspondant aux criteres donnes (au moins un critere requis).",
    input_schema: {
      type: "object",
      properties: {
        date: { type: "string", description: "Date au format YYYY-MM-DD (optionnel)" },
        title: { type: "string", description: "Titre (recherche approximative, optionnel)" },
      },
    },
  },
  {
    name: "delete_contact",
    description: "Supprime un contact du suivi relationnel par son nom.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Nom du contact (recherche approximative)" },
      },
      required: ["name"],
    },
  },
  {
    name: "add_calendar_event",
    description: "Ajoute un evenement au calendrier de l'utilisateur (ex: planifier une seance de sport, un repas, un rappel).",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        date: { type: "string", description: "Date au format YYYY-MM-DD" },
        event_type: { type: "string", description: "entrainement, repas, finance, relation ou autre" },
        notes: { type: "string" },
      },
      required: ["title", "date"],
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

  // Ne garder que role/content (texte) pour l'historique envoye a Claude, et limiter sa taille
  // (les donnees persistantes - programmes, repas, finances, preferences... - sont
  // recuperees via les outils get_profile/get_recent_data, pas via l'historique du chat).
  const MAX_HISTORY_MESSAGES = 20;
  const messages = incomingMessages
    .filter(m => m.role === "user" || m.role === "assistant")
    .map(m => ({ role: m.role, content: m.content }))
    .slice(-MAX_HISTORY_MESSAGES);

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
          { data: shoppingList },
          { data: profileData },
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
          supabase.from("shopping_list_items").select("*").eq("user_id", userId).order("category"),
          supabase.from("profiles").select("grocery_budget_weekly, preferences, adherence_cycle_start").eq("id", userId).maybeSingle(),
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

        const shopping_list_total = (shoppingList || []).reduce((s, i) => s + Number(i.estimated_price), 0);

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
          shopping_list: shoppingList,
          shopping_list_total,
          grocery_budget_weekly: profileData?.grocery_budget_weekly ?? 80,
          preferences: profileData?.preferences ?? null,
          adherence_cycle_start: profileData?.adherence_cycle_start ?? null,
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
        const durationWeeks = parseInt(input.duration_weeks, 10) || 8;
        if (!Array.isArray(input.days) || input.days.length === 0) {
          return { error: "Le champ 'days' doit etre un tableau non vide de jours d'entrainement." };
        }
        await supabase.from("training_programs").update({ active: false }).eq("user_id", userId).eq("active", true);
        const { data, error } = await supabase.from("training_programs").insert({
          user_id: userId,
          title: input.title,
          goal: input.goal ?? null,
          duration_weeks: durationWeeks,
          start_date: new Date().toISOString().slice(0, 10),
          days: input.days,
          active: true,
        }).select();
        if (error) return { error: error.message, code: error.code, details: error.details };
        if (!data || data.length === 0) return { error: "L'enregistrement n'a renvoye aucune ligne (verifie la table training_programs et les policies RLS)." };
        return { success: true, title: input.title, duration_weeks: durationWeeks, id: data[0].id };
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
          quantity: m.quantity ?? null,
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
        ["calorie_target", "protein_target", "carbs_target", "fat_target", "water_target_ml", "grocery_budget_weekly"].forEach(k => {
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
      case "save_shopping_list": {
        await supabase.from("shopping_list_items").delete().eq("user_id", userId);
        const rows = (input.items || []).map(i => ({
          user_id: userId,
          name: i.name,
          quantity: i.quantity ?? null,
          category: i.category ?? "Autres",
          estimated_price: i.estimated_price ?? 0,
          purchased: false,
        }));
        if (rows.length === 0) return { success: true, inserted: 0 };
        const { data, error } = await supabase.from("shopping_list_items").insert(rows).select();
        const total = rows.reduce((s, r) => s + Number(r.estimated_price), 0);
        if (error) return { error: error.message, code: error.code, details: error.details };
        if (!data || data.length === 0) return { error: "L'enregistrement n'a renvoye aucune ligne (verifie la table shopping_list_items et les policies RLS)." };
        return { success: true, inserted: data.length, estimated_total: total };
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
      case "add_calendar_event": {
        const { error } = await supabase.from("calendar_events").insert({
          user_id: userId,
          title: input.title,
          date: input.date,
          event_type: input.event_type ?? "autre",
          notes: input.notes ?? null,
        });
        return error ? { error: error.message } : { success: true };
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
      case "update_preferences": {
        const { error } = await supabase.from("profiles").update({ preferences: input.preferences }).eq("id", userId);
        return error ? { error: error.message } : { success: true };
      }
      case "delete_workout": {
        if (!input.date && !input.name) return { error: "Precise au moins une date ou un nom de seance." };
        let query = supabase.from("workouts").delete().eq("user_id", userId);
        if (input.date) query = query.eq("date", input.date);
        if (input.name) query = query.ilike("name", `%${input.name}%`);
        const { error, count } = await query.select("id", { count: "exact" });
        return error ? { error: error.message } : { success: true, deleted: count ?? 0 };
      }
      case "delete_body_metric": {
        const { error, count } = await supabase
          .from("body_metrics")
          .delete()
          .eq("user_id", userId)
          .eq("date", input.date)
          .select("id", { count: "exact" });
        return error ? { error: error.message } : { success: true, deleted: count ?? 0 };
      }
      case "reset_training_program": {
        if (input.delete) {
          const { error, count } = await supabase
            .from("training_programs")
            .delete()
            .eq("user_id", userId)
            .eq("active", true)
            .select("id", { count: "exact" });
          return error ? { error: error.message } : { success: true, deleted: count ?? 0 };
        }
        const { error, count } = await supabase
          .from("training_programs")
          .update({ active: false })
          .eq("user_id", userId)
          .eq("active", true)
          .select("id", { count: "exact" });
        return error ? { error: error.message } : { success: true, deactivated: count ?? 0 };
      }
      case "reset_adherence_cycle": {
        const { error } = await supabase
          .from("profiles")
          .update({ adherence_cycle_start: new Date().toISOString().slice(0, 10) })
          .eq("id", userId);
        return error ? { error: error.message } : { success: true };
      }
      case "delete_transaction": {
        if (!input.date && !input.category && !input.description) {
          return { error: "Precise au moins une date, une categorie ou une description." };
        }
        let query = supabase.from("finance_transactions").delete().eq("user_id", userId);
        if (input.date) query = query.eq("date", input.date);
        if (input.category) query = query.eq("category", input.category);
        if (input.description) query = query.ilike("description", `%${input.description}%`);
        const { error, count } = await query.select("id", { count: "exact" });
        return error ? { error: error.message } : { success: true, deleted: count ?? 0 };
      }
      case "delete_calendar_event": {
        if (!input.date && !input.title) return { error: "Precise au moins une date ou un titre." };
        let query = supabase.from("calendar_events").delete().eq("user_id", userId);
        if (input.date) query = query.eq("date", input.date);
        if (input.title) query = query.ilike("title", `%${input.title}%`);
        const { error, count } = await query.select("id", { count: "exact" });
        return error ? { error: error.message } : { success: true, deleted: count ?? 0 };
      }
      case "delete_contact": {
        const { error, count } = await supabase
          .from("contacts")
          .delete()
          .eq("user_id", userId)
          .ilike("name", `%${input.name}%`)
          .select("id", { count: "exact" });
        return error ? { error: error.message } : { success: true, deleted: count ?? 0 };
      }
      default:
        return { error: `Outil inconnu: ${name}` };
    }
  }

  function notificationMessage(name, input, result) {
    if (result?.error) return null;
    switch (name) {
      case "add_body_metric": return "Aiden a enregistre une nouvelle mesure corporelle.";
      case "add_workout": return `Aiden a ajoute une seance "${input.name}" au ${input.date}.`;
      case "save_training_program": return `Aiden a cree un nouveau programme d'entrainement : "${input.title}".`;
      case "save_meal_plan": return `Aiden a sauvegarde un nouveau plan alimentaire : "${input.title}".`;
      case "save_today_meals": return "Aiden a planifie les repas du jour.";
      case "save_shopping_list": return "Aiden a mis a jour la liste de courses.";
      case "set_nutrition_targets": return "Aiden a ajuste tes objectifs nutritionnels.";
      case "add_transaction": return `Aiden a ajoute une transaction : ${input.description || input.category} (${input.amount}$).`;
      case "set_budget": return `Aiden a mis a jour le budget "${input.category}".`;
      case "set_savings_goal": return "Aiden a mis a jour ton objectif d'epargne.";
      case "add_contact": return `Aiden a ajoute "${input.name}" a tes contacts.`;
      case "log_contact_interaction": return `Aiden a enregistre un contact avec ${result?.contact || input.name}.`;
      case "set_recurring_transaction": return input.delete
        ? `Aiden a supprime la depense recurrente "${input.label}".`
        : `Aiden a mis a jour la depense recurrente "${input.label}".`;
      case "add_calendar_event": return `Aiden a ajoute "${input.title}" a ton calendrier le ${input.date}.`;
      case "update_preferences": return "Aiden a mis a jour tes preferences.";
      case "delete_workout": return result?.deleted ? `Aiden a supprime ${result.deleted} seance(s).` : null;
      case "delete_body_metric": return result?.deleted ? "Aiden a supprime une mesure corporelle." : null;
      case "reset_training_program": return input.delete
        ? "Aiden a supprime ton programme d'entrainement actif."
        : "Aiden a desactive ton programme d'entrainement actif.";
      case "reset_adherence_cycle": return "Aiden a reinitialise ton cycle d'assiduite de 30 jours.";
      case "delete_transaction": return result?.deleted ? `Aiden a supprime ${result.deleted} transaction(s).` : null;
      case "delete_calendar_event": return result?.deleted ? `Aiden a supprime ${result.deleted} evenement(s) du calendrier.` : null;
      case "delete_contact": return result?.deleted ? `Aiden a supprime ${result.deleted} contact(s).` : null;
      default: return null;
    }
  }

  // Tous les outils qui ecrivent en base : suivis pour le debug et la detection
  // de fausses confirmations (tout sauf get_profile / get_recent_data).
  const READ_ONLY_TOOLS = ["get_profile", "get_recent_data"];
  const debugLog = [];

  try {
    let finalText = "";
    let forcedContinuations = 0;

    // Boucle d'utilisation d'outils (max 12 allers-retours)
    for (let i = 0; i < 12; i++) {
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-5",
        // 8192 : un appel save_training_program complet (7 jours x 5-6 exercices en JSON)
        // depasse largement 2048 tokens ; une limite trop basse coupe l'appel d'outil
        // en plein milieu et la sauvegarde n'a jamais lieu.
        max_tokens: 8192,
        system: SYSTEM_PROMPT,
        tools,
        messages,
      });

      const toolUses = response.content.filter(b => b.type === "tool_use");
      const textBlocks = response.content.filter(b => b.type === "text");
      finalText = textBlocks.map(b => b.text).join("\n").trim();

      if (toolUses.length === 0) {
        // Cas 1 : reponse qui se termine par ":" ou "..." -> action annoncee mais pas executee.
        const looksUnfinished = /[:…]\s*$/.test(finalText);
        // Cas 2 : reponse qui PRETEND avoir sauvegarde/cree quelque chose alors qu'aucun
        // outil de sauvegarde n'a ete appele pendant ce tour -> mensonge, on rejette.
        const claimsSave = /(sauvegard|enregistr|cr[eé][eé]|ajout[eé]|c'est dans ton|page sport|espace sport|maintenant actif|maintenant visible)/i.test(finalText);
        const liedAboutSave = claimsSave && debugLog.length === 0;
        if ((looksUnfinished || liedAboutSave) && forcedContinuations < 4 && i < 11) {
          forcedContinuations++;
          messages.push({ role: "assistant", content: response.content });
          messages.push({
            role: "user",
            content: liedAboutSave
              ? "STOP. Ta reponse pretend avoir cree/sauvegarde quelque chose, mais le serveur confirme " +
                "qu'AUCUN outil de sauvegarde n'a ete appele pendant ce tour : rien n'a ete enregistre. " +
                "N'ecris PAS de texte de confirmation. Appelle MAINTENANT l'outil de sauvegarde approprie " +
                "(save_training_program, save_shopping_list, save_meal_plan, save_today_meals...) avec les " +
                "donnees completes, puis seulement apres confirme avec son resultat reel."
              : "Tu n'as pas termine : tu as annonce une action sans appeler l'outil correspondant. " +
                "Appelle MAINTENANT l'outil approprie pour l'executer reellement, sans repeter ton annonce.",
          });
          continue;
        }
        break;
      }

      if (response.stop_reason !== "tool_use") {
        break;
      }

      messages.push({ role: "assistant", content: response.content });

      const toolResults = [];
      const notifMessages = [];
      for (const toolUse of toolUses) {
        const result = await executeTool(toolUse.name, toolUse.input || {});
        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: JSON.stringify(result),
        });
        if (!READ_ONLY_TOOLS.includes(toolUse.name)) {
          debugLog.push({ tool: toolUse.name, result });
        }
        const notifMsg = notificationMessage(toolUse.name, toolUse.input || {}, result);
        if (notifMsg) notifMessages.push(notifMsg);
      }
      messages.push({ role: "user", content: toolResults });

      if (notifMessages.length > 0) {
        await supabase.from("notifications").insert(
          notifMessages.map(message => ({ user_id: userId, message }))
        );
      }
    }

    // Si on a epuise les allers-retours sans texte final, on force une reponse texte
    // (sans outils) en se basant sur ce qui a deja ete fait.
    if (!finalText) {
      messages.push({ role: "user", content: "Resume en francais, pour l'utilisateur, ce que tu viens de faire." });
      const wrapUp = await anthropic.messages.create({
        model: "claude-sonnet-4-5",
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages,
      });
      finalText = wrapUp.content.filter(b => b.type === "text").map(b => b.text).join("\n").trim();
    }

    if (!finalText) {
      finalText = "Desole, je n'ai pas pu generer de reponse. Peux-tu reformuler ta demande ?";
    }

    // Bloc de debug temporaire (toujours affiche) : resultats bruts des outils de
    // sauvegarde + verification directe en base, independamment de ce que dit le modele.
    {
      const { count: progCount } = await supabase
        .from("training_programs").select("id", { count: "exact", head: true })
        .eq("user_id", userId).eq("active", true);
      const { count: shopCount } = await supabase
        .from("shopping_list_items").select("id", { count: "exact", head: true })
        .eq("user_id", userId);
      finalText += "\n\n---\n🔧 **Debug serveur (v2026-06-10b)**\n```json\n" +
        JSON.stringify({
          outils_sauvegarde_appeles_ce_tour: debugLog,
          verification_base: {
            programmes_actifs: progCount ?? 0,
            articles_liste_courses: shopCount ?? 0,
          },
        }, null, 2) + "\n```";
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
