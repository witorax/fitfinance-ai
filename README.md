# FitFinance AI

Application web (HTML / CSS / JS vanilla) pour suivre ta progression sportive,
generer des plans alimentaires/sportifs et gerer tes finances - le tout pilote
par un Coach IA (Claude) qui peut lire et modifier tes donnees.

## Stack

- **Frontend** : HTML/CSS/JS simple (pas de build), heberge sur Netlify
- **Base de donnees / Auth** : Supabase (Postgres + Auth + RLS)
- **IA** : Claude (Anthropic), via une fonction serverless Netlify

## 1. Configurer Supabase

1. Cree un projet sur [supabase.com](https://supabase.com).
2. Va dans **SQL Editor** et execute le contenu de [`sql/schema.sql`](sql/schema.sql).
   Cela cree toutes les tables, active la securite (RLS) et cree un trigger
   qui genere automatiquement un profil a l'inscription.
3. Va dans **Project Settings > API** et recupere :
   - `Project URL`
   - `anon public` key
   - `service_role` key (⚠️ secrete, ne jamais l'exposer cote client)
4. Ouvre [`js/config.js`](js/config.js) et remplace `SUPABASE_URL` et
   `SUPABASE_ANON_KEY` par tes valeurs.

## 2. Obtenir une cle Claude (Anthropic)

1. Va sur [console.anthropic.com](https://console.anthropic.com/settings/keys)
   et cree une cle API.
2. Garde-la, elle sera mise dans les variables d'environnement Netlify (jamais
   dans le code).

## 3. Deployer sur Netlify

1. Pousse ce projet sur un depot GitHub.
2. Sur [app.netlify.com](https://app.netlify.com), clique **Add new site >
   Import an existing project** et selectionne le depot.
3. Netlify detectera `netlify.toml` (publish = `.`, functions = `netlify/functions`).
4. Dans **Site settings > Environment variables**, ajoute :
   - `ANTHROPIC_API_KEY` = ta cle Anthropic
   - `SUPABASE_URL` = l'URL de ton projet Supabase
   - `SUPABASE_SERVICE_ROLE_KEY` = la cle service_role Supabase
5. Deploie. Le site est servi statiquement et la fonction IA est disponible
   sur `/.netlify/functions/ai-chat`.

## 4. Tester en local

```bash
npm install
npx netlify dev
```

`netlify dev` lit le fichier `.env` (a creer a partir de `.env.example`) pour
les variables d'environnement de la fonction, et sert les pages HTML.

## Structure du projet

```
index.html          -> Connexion / inscription
dashboard.html       -> Vue d'ensemble + objectif physique
sport.html            -> Mesures corporelles, seances, plans generes
finance.html          -> Transactions, budgets
coach.html            -> Chat avec le Coach IA
js/config.js          -> Configuration Supabase (URL + cle anon)
js/nav.js             -> Navigation + verification d'authentification
netlify/functions/ai-chat.js -> Fonction serverless : appelle Claude avec
                                  acces complet (lecture/ecriture) aux
                                  donnees de l'utilisateur authentifie
sql/schema.sql        -> Schema complet Supabase (tables + RLS)
```

## Securite

- La cle `anon` Supabase est publique par design (les donnees sont protegees
  par les policies RLS : chaque utilisateur ne voit que ses propres lignes).
- La cle `service_role` Supabase et la cle Anthropic restent **uniquement**
  dans les variables d'environnement Netlify, jamais dans le code cote client.
- La fonction `ai-chat` verifie le token de session de l'utilisateur avant de
  faire quoi que ce soit en son nom.
