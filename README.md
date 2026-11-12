# MyStudy AI

French personal study application built with Next.js App Router, strict TypeScript, React, Tailwind, Radix/shadcn-style components, Supabase and Gemini. The parent workspace and its existing files are preserved.

## Run locally

Node.js 22.23.2 and npm 12 were detected on this machine. Dependencies are installed.

```powershell
cd "C:\Users\hp\OneDrive\Musique\MyStudy AI\mystudy-ai"
Copy-Item .env.example .env.local
npm run dev
```

Open http://localhost:3000. Without Supabase configuration, the app displays a labeled setup state with empty data, never simulated activity. Once Supabase is configured, dashboard routes require sign-in. Restart after environment changes.

For a clean install on this Windows machine, use `npm ci --userconfig=NUL`: the global npm configuration has an incompatible `allow-scripts` setting. No global settings were changed. On other systems use normal `npm ci`, or `--userconfig=/dev/null` if needed.

## Supabase setup

1. Create your own Supabase project.
2. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` from Project Settings → API in `.env.local`.
3. Set `SUPABASE_SERVICE_ROLE_KEY` server-side. Never prefix it with `NEXT_PUBLIC_` or put it in client code.
4. Run **all files in `supabase/migrations/` in filename order** using the SQL editor. Alternatively: `supabase link --project-ref YOUR_REF` then `supabase db push` with the Supabase CLI.
5. Enable email/password Auth. Set Site URL to `http://localhost:3000` and allow redirect `http://localhost:3000/auth/callback`. Configure equivalent HTTPS production URLs when deploying.
6. Create an account at `/login`, confirm its email and sign in. Production email may require your own SMTP provider; Supabase email quotas apply.

Migrations create ownership RLS, pgvector, jobs, caches, quotas and transactional scoring. Browser clients can read their own learning data; learning writes use authorized server routes. OAuth credentials and privileged RPCs are inaccessible to authenticated browser clients.

## Independent Google Drive OAuth

ChatGPT's Google Drive connection does not authorize this app.

1. Enable Google Drive API in your own Google Cloud project.
2. Configure the consent screen and a **Web application** OAuth client. Add your own account as a test user while testing.
3. Register `http://localhost:3000/api/drive/callback` as a redirect URI. Add `https://YOUR_DOMAIN/api/drive/callback` for production.
4. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` locally.
5. Generate a 32-byte encryption key:

   ```powershell
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```

   Save as `TOKEN_ENCRYPTION_KEY`. Back it up securely; changing it requires Google reconnection.

6. Keep `GOOGLE_DRIVE_ROOT_ID=1rqYB2_0rdDhoWJbqzPNOhFtNedQZgERn` unless intentionally choosing another folder.
7. In Paramètres, connect your Google account and click **Synchroniser Google Drive**.

Scope: `https://www.googleapis.com/auth/drive.readonly`. Broad read access is needed to discover the pre-existing folder; `drive.file` would not cover it automatically. Code restricts traversal to the configured root and never writes/deletes Drive files. The Google account must have access to that root. This is a restricted scope; verification, security assessment and test-mode refresh-token expiry rules may apply. See [Google scope guidance](https://developers.google.com/workspace/drive/api/guides/api-specific-auth) and [restricted-scope requirements](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification).

OAuth uses user-bound state, PKCE, HttpOnly SameSite cookies and AES-256-GCM encrypted credentials. No service account is used. Keep passwords and API secrets on your machine, never in chat.

## Gemini and document worker

1. Create a Gemini API key in your own AI Studio account and set `GEMINI_API_KEY`. Check your account's quotas, availability, data handling and billing settings. No billing is enabled by this app.
2. Defaults: `GEMINI_MODEL=gemini-2.5-flash`, `GEMINI_EMBEDDING_MODEL=gemini-embedding-001`, normalized 768-dimensional vectors. Changing embedding models requires a rebuilt index; do not mix embedding spaces.
3. Set `AI_DAILY_REQUEST_LIMIT` (default 50). Embeddings, generation and evidence review consume quota. Failed logical calls remain counted. Retries can make several provider attempts per reservation, so this limit is not a billing guarantee.
4. Generate another random secret with the Node command above and set `CRON_SECRET`. Set `NEXT_PUBLIC_APP_URL=http://localhost:3000`.
5. With `npm run dev` running, open another terminal and run:

   ```powershell
   cd "C:\Users\hp\OneDrive\Musique\MyStudy AI\mystudy-ai"
   npm run worker
   ```

Synchronization automatically queues changed documents. The Documents **Indexer** button queues a retry; the worker performs extraction/indexing. Refresh Documents to inspect status. Intermediate embeddings are cached so a later retry can resume after quota failure. Stop the worker with Ctrl+C.

`vercel.json` declares daily sync and one daily worker invocation. Each invocation processes **one document**. Use the local worker or deliberately configure another protected sequential scheduler for a backlog. No paid/high-frequency scheduler has been provisioned. Verify current Vercel execution-time and cron limits for your plan.

### Supported files and limits

PDF text with page references; DOCX text without original pagination; PPTX text with slide references; UTF-8 TXT/Markdown; Google Docs text export and Google Slides PPTX export. Input limit 20 MiB, bounded Office archive sizes, maximum 150 chunks/document. Split larger courses by chapter.

**Built-in OCR and multimodal interpretation are not implemented.** Scanned/no-text PDFs report OCR required. Produce an OCR PDF externally, upload it yourself and synchronize. Text extraction does not fully represent diagrams, formulas, tables or screenshots. This app never changes original Drive files.

## Live acceptance walkthrough

After configuring services:

1. Sign in, connect your own Google account and synchronize.
2. Confirm the actual root folders appear as modules. No module count or names are seeded.
3. Start the worker and wait for a real course PDF to become **Indexé**.
4. Select it in QCM, request 10 questions and generate. Fewer are returned if evidence is insufficient.
5. Answer the quiz, inspect explanations/source links, then reload QCM and reopen the saved correction.
6. Add or modify a Drive course yourself and synchronize; verify discovery without duplicates or lost attempts.
7. Try a course-grounded tutor question in French, Darija, Arabic and English. General knowledge is opt-in and labeled separately.
8. Generate an exam, save responses, reload/resume and confirm its original deadline remains.

**This live walkthrough has not been executed:** no Supabase project credentials, Google OAuth credentials or Gemini key were provided. Automated local tests do not replace it.

## Implemented

- Responsive French shell, eleven study screens, mobile navigation, document-name search, light/dark themes, accessible controls and loading/error/empty states.
- Supabase sign-up/sign-in/sign-out, email callback, cookie refresh and protected routes.
- Read-only Drive OAuth, encrypted tokens, paginated recursive module/category discovery, Changes API cursor checks, conservative full-tree reconciliation after changes, version tracking, soft retirement and sync logs/locking.
- Background extraction, deterministic chunks, embedding caching, pgvector retrieval with keyword ranking, processing errors/retries.
- Gemini provider abstraction, JSON/Zod validation, exact citation quotes, second AI evidence review, cached grounded responses, opt-in general explanations, rate limits and quotas. AI evidence review reduces errors but does not prove correctness.
- Single-answer, multiple-answer and true/false quizzes; configurable sources/chapter/count/difficulty/language; saved answers, atomic scoring, detailed saved corrections and history.
- Timed QCM exams with server-held deadlines, resume, late-autosave rejection, automatic submission while open, saved-answer grading after expiry, and scores out of 20. Closed-browser expiry finalizes on resume/submission, not through a separate service.
- Print/save-to-PDF for completed exam questions/corrections.
- TD/TP exercise extraction, hints/proposed AI solutions, locally served Monaco editor, saved attempts and completion. No student code execution.
- Flashcards with SM-2 review scheduling and daily queues.
- Editable planning with objectives, modules, durations and exam dates; suggestions never silently change schedules.
- Recharts results, topic accuracy, recorded session duration and completed exercises from actual activity.

The schema shares `quizzes.kind` and `questions` between quizzes/exams; `exam_attempts` contains resumable sessions and `quiz_attempts` contains completed scores.

## Remaining scope

This is an initial implementation, not the entire production roadmap:

- Short/open/fill-in-the-blank questions, explicit grading rubrics, estimated AI grading and mixed practical exams.
- OCR and multimodal provider paths.
- Pre-exam downloadable PDF and dedicated PDF generation (current export uses browser print after completion).
- Automated weekly revision planning using all exam/availability/difficulty signals, streaks and full module-mastery estimates.
- AI exercise-submission feedback (current practice supports hints, saving and side-by-side self-comparison).
- Hosted long-running worker, automatic finalization of abandoned exams, resumable large-tree sync and operational monitoring.
- Generated Supabase schema types, additional database JSON constraints, production CSP tuned for Monaco/Next.js, password reset, account deletion/export and OAuth disconnect UI.
- Real-service integration tests, authenticated browser journeys and deployment to your accounts.

## Tests and build

Local verification on 12 November 2026: 29 unit/database tests passed; 8 desktop/mobile browser tests passed; TypeScript, lint and the production build passed. Dependency installation reported zero known vulnerabilities. External-service acceptance remains pending configuration.

```powershell
npm run typecheck
npm run lint
npm test
npx playwright install chromium
npm run test:e2e
npm run build
npm audit --userconfig=NUL
```

Tests cover extraction from an actual PDF buffer and PPTX archives, AI schemas/citations/deduplication, grading, Drive reconciliation, chunks and SM-2. Database tests apply actual migrations to embedded PostgreSQL with pgvector and exercise RLS roles, cross-account access, token secrecy, privileged RPCs, quotas, durable/idempotent grading and expired exams. The harness simulates Supabase's auth schema/roles; hosted Auth/OAuth services are not tested.

Playwright tests the unconfigured setup state on desktop/mobile, navigation, themes, all screens and worker authorization. Run those setup-state tests without configured Supabase credentials. Screenshots go into ignored `artifacts/`.

## Deploy to Vercel

1. Import this **mystudy-ai directory** as a Next.js project, Node.js 22, build `npm run build`.
2. Add `.env.example` values through Vercel environment settings. Keep `.env.local` out of Git. Set `NEXT_PUBLIC_APP_URL` to the exact HTTPS origin. Public Supabase configuration must exist at build time.
3. Apply all database migrations and add production Supabase/Google redirect URLs.
4. Set `CRON_SECRET` in Vercel. Vercel cron sends it as a Bearer credential. Protect separate worker requests similarly; never put credentials in URLs.
5. Run the live acceptance walkthrough, including a second account isolation check.

No external deployment, paid service, Drive mutation or external database change was performed during implementation.

## Source layout

`src/app/(dashboard)` screens; `src/app/api` authorized handlers; `src/components` interfaces; `src/lib/google-drive` OAuth/sync; `src/lib/document-processing` extraction/worker; `src/lib/ai` and `src/lib/rag` providers/evidence/retrieval; `supabase/migrations` schema/RLS/transactions; `scripts` local worker/assets; `tests` unit/database/browser coverage.

References: [Next.js](https://nextjs.org/docs/app/getting-started/installation), [Supabase SSR](https://supabase.com/docs/guides/auth/server-side), [Drive Changes](https://developers.google.com/workspace/drive/api/guides/manage-changes), [Gemini embeddings](https://ai.google.dev/gemini-api/docs/embeddings).
