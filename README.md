# MyStudy AI

Application personnelle de cours, QCM, examens blancs, TD/TP, flashcards et planning. Interface française, Next.js App Router, TypeScript strict, Supabase et Gemini.

## Utilisation quotidienne

1. Connectez votre Google Drive dans Paramètres.
2. Cliquez sur **Synchroniser Google Drive** pour découvrir les nouveaux cours.
3. Les documents sont **indexés automatiquement sur Vercel**. Aucun terminal et aucun bouton par fichier ne sont nécessaires.
4. Le bandeau indique la progression. Les documents déjà indexés sont utilisables immédiatement dans QCM.

Les lots continuent côté serveur même si vous fermez la page. Le site relance aussi les tâches interrompues quand vous revenez, et deux tâches Vercel quotidiennes servent de reprise. Les limites d’exécution et quotas de Vercel/Gemini restent applicables.

**Révision AI a été retirée à la demande de l’utilisateur.** Son ancien lien redirige vers QCM. Les QCM, examens, flashcards et exercices restent disponibles.

## Quotas et indexation

`AI_DAILY_REQUEST_LIMIT` plafonne les appels AI logiques par utilisateur et par jour UTC (50 par défaut). L’indexation conserve une petite réserve pour la génération des QCM : 5 appels au maximum, adaptée aux petits plafonds. Elle ne relève jamais ce plafond et n’active pas de facturation.

Quand le budget d’indexation est atteint, les documents restent en attente, sans être marqués en échec. Les embeddings déjà calculés sont conservés. La reprise quotidienne ou la prochaine visite relance la file lorsque le quota est disponible. Les quotas du fournisseur s’appliquent en plus.

Les appels sont protégés par un bail par utilisateur en base et des prises de tâches conditionnelles pour empêcher un double traitement. Un lot est borné à environ 230 secondes et 20 documents ; un appel serveur authentifié en programme la suite uniquement si des tâches sont exécutables. Les checkpoints conservent les embeddings entre lots. Une interruption d’hébergement est récupérée après expiration du bail ; une tâche interrompue peut être reprise après dix minutes.

Les échecs temporaires sont retentés de façon limitée. Un PDF scanné nécessitant un OCR, un format non pris en charge ou un PDF protégé demande une correction du document. La synchronisation globale permet de relancer les échecs temporaires après correction de la configuration.

## Installation locale

Node.js 22 recommandé.

```powershell
npm ci --userconfig=NUL
Copy-Item .env.example .env.local
npm run dev
```

`--userconfig=NUL` contourne un paramètre npm global incompatible sur la machine Windows de développement ; ailleurs, `npm ci` normal convient. Les anciennes commandes `npm run worker` et `node scripts/worker.mjs` affichent seulement un message : elles ne sont plus nécessaires.

Sans configuration Supabase, le site présente un état de configuration vide, sans fausses statistiques. Avec Supabase, les pages personnelles sont protégées par connexion.

## Configuration Supabase

- Définir `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
- Appliquer les migrations de `supabase/migrations/` dans l’ordre. Si les 25 tables existent déjà, aucune nouvelle migration n’est nécessaire pour l’indexation automatique.
- Activer email/password Auth, Site URL et redirection `/auth/callback` sur le domaine réel.
- La clé serveur ne doit jamais être publiée sur GitHub ou préfixée `NEXT_PUBLIC_`.

Les tables utilisent RLS, les jetons Google sont chiffrés, et les fonctions de scoring/quota sont réservées au serveur. Les tentatives et réponses restent persistantes.

## Google Drive

Activer Drive API dans Google Cloud et créer un client OAuth **Web application**. Configurer l’audience et ajouter son compte Google comme utilisateur test si nécessaire. Autoriser la redirection exacte :

```text
https://VOTRE_DOMAINE/api/drive/callback
```

Variables : `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_DRIVE_ROOT_ID`, `TOKEN_ENCRYPTION_KEY`. Le dossier racine de ce projet est `1rqYB2_0rdDhoWJbqzPNOhFtNedQZgERn`.

L’autorisation est `https://www.googleapis.com/auth/drive.readonly`, nécessaire pour découvrir les dossiers préexistants. Les originaux ne sont jamais modifiés. OAuth utilise state lié au compte, PKCE, cookie HttpOnly et chiffrement AES-256-GCM. La connexion Google de ChatGPT ne remplace pas celle de cette application. Les règles Google de test et vérification s’appliquent.

## Gemini et Vercel

Variables serveur : `GEMINI_API_KEY`, `GEMINI_MODEL` (défaut `gemini-2.5-flash`), `GEMINI_EMBEDDING_MODEL` (défaut `gemini-embedding-001`), `AI_DAILY_REQUEST_LIMIT`.

Les embeddings ont 768 dimensions. Un changement de modèle d’embedding demande de reconstruire l’index sans mélanger les espaces vectoriels.

Pour Vercel, définir `NEXT_PUBLIC_APP_URL` avec l’origine HTTPS exacte, ainsi que `CRON_SECRET` et `TOKEN_ENCRYPTION_KEY`. Ces deux derniers doivent être des secrets aléatoires distincts ; conserver la clé de chiffrement après connexion Google.

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Déployer avec Node.js 22 et `npm run build`. Redéployer après toute modification des variables. `CRON_SECRET` authentifie les tâches quotidiennes et les continuations internes ; il n’est jamais transmis au navigateur. Les continuations utilisent l’URL de production ; une protection d’accès Vercel supplémentaire peut les bloquer et doit être configurée pour les appels internes.

Aucun hébergeur/ordonnanceur payant supplémentaire n’est nécessaire. Les fonctions automatiques restent soumises au budget et aux limites du plan Vercel. `vercel.json` conserve les tâches quotidiennes compatibles avec le plan Hobby.

## Formats et limites

PDF avec texte et pages ; DOCX sans pagination originale ; PPTX avec numéros de diapositives ; TXT/Markdown UTF-8 ; Google Docs export texte ; Google Slides export PPTX. Maximum 20 MiB et 150 chunks par document, archives Office bornées. Le moteur PDF et ses composants natifs sont explicitement inclus dans les fonctions d’indexation Vercel.

OCR et interprétation multimodale ne sont pas implémentés. Les schémas, tableaux et formules ne sont pas intégralement représentés par l’extraction de texte. Fournir une version OCR pour les scans.

## Vérification

```powershell
npm run typecheck
npm run lint
npm test
npm run test:e2e
npm run build
node scripts/check-pdf-bundle.mjs
```

Les tests couvrent extraction PDF/PPTX, validation des questions, citations, déduplication, scores, SM-2, synchronisation Drive, PostgreSQL/pgvector, isolation RLS, scoring durable, quotas, baux d’indexation, pauses et continuations. Les tests navigateur utilisent l’état sans configuration externe et vérifient la navigation, la suppression de Révision AI et l’absence de boutons d’indexation par fichier. Ils ne remplacent pas un test avec les comptes Google/Supabase réels.

## Fonctions et limites actuelles

QCM à réponse unique/multiple et vrai-faux, examens chronométrés et corrections enregistrées, export par impression après correction, exercices avec Monaco et solutions proposées, flashcards SM-2, planning manuel et statistiques sur l’activité réelle. L’AI vérifie les citations et effectue un second contrôle de support, sans garantir l’absence d’erreur : consulter les sources.

Restent hors périmètre actuel : questions ouvertes et correction par grille, OCR/multimodal, génération PDF avant examen, planning hebdomadaire entièrement automatique, feedback AI sur les solutions soumises, mot de passe oublié et gestion complète de suppression/export de compte.

## Structure

`src/app/(dashboard)` : écrans ; `src/app/api` : handlers autorisés ; `src/lib/document-processing` : file automatique, lots et checkpoints ; `src/lib/google-drive` : OAuth/sync ; `src/lib/ai` : génération et validation ; `supabase/migrations` : schéma/RLS ; `tests` : tests unitaires, base et navigateur.
