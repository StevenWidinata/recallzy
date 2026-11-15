# Recallzy

Upload your study material — PDF, photos of notes, Word, PowerPoint or pasted text — and Recallzy's AI turns it into a quiz that **explains every answer**, whether you got it right or wrong.

## Features

- **Any material:** PDF, images (photos/screenshots), `.docx`, `.pptx`, or pasted notes — up to 5 files per quiz.
- **Four question types:** multiple choice, true/false, short answer (typo-tolerant grading) and flashcards.
- **Learn from mistakes:** see why your answer was wrong *and* why the right one is right, plus where it's from in your material.
- **Progress:** results by topic, "Retry mistakes", weak-topic tracking and quiz history on the dashboard.
- **Any language:** questions come out in the same language as your material.
- **Free to run:** Google Gemini free tier, Supabase free plan, Vercel free hosting. Each user gets a daily quiz limit, and can add their own free Gemini key for unlimited use.

## Tech stack

Next.js (App Router, TypeScript) · Tailwind CSS · Supabase (auth, Postgres, storage) · Google Gemini (`@google/genai`)

## Run it on your computer

1. **Install [Node.js](https://nodejs.org) (LTS).**
2. **Create a free Supabase project** at [supabase.com](https://supabase.com).
   - Open **SQL Editor → New query**, paste everything from [`supabase/migrations/001_init.sql`](supabase/migrations/001_init.sql), and click **Run**.
   - Go to **Authentication → Sign In / Providers → Email** and turn **Confirm email** off (Supabase's free email sender only sends a few emails per hour).
3. **Get a free Gemini API key** at [aistudio.google.com/apikey](https://aistudio.google.com/apikey).
4. **Add your keys:** copy `.env.local.example` to `.env.local` and fill it in:

   | Variable | Where to find it |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → Data API |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase → Project Settings → API Keys (publishable) |
   | `SUPABASE_SECRET_KEY` | Supabase → Project Settings → API Keys (secret) — keep private! |
   | `GEMINI_API_KEY` | Google AI Studio |
   | `GEMINI_MODEL` | `gemini-3.5-flash` |
   | `DAILY_QUIZ_LIMIT` | New quizzes per user per day with the shared key (default `5`) |

5. **Start it:**

   ```bash
   npm install
   npm run dev
   ```

   Open <http://localhost:3000>, create an account and make your first quiz.

## Put it online (Vercel, free)

1. Sign up at [vercel.com](https://vercel.com) with your GitHub account.
2. Click **Add New → Project**, pick the `recallzy` repository, and click **Import**.
3. Under **Environment Variables**, add the same six variables from your `.env.local`.
4. Click **Deploy**. Every push to `main` deploys automatically after that.
5. In Supabase → **Authentication → URL Configuration**, set **Site URL** to your new Vercel address.

## How it works

1. The browser uploads files straight to a private Supabase Storage folder for that user.
2. `POST /api/generate` checks the daily limit, reads the files (PDFs and images go to Gemini directly; Word/PowerPoint text is extracted first) and asks Gemini for a quiz in a strict JSON format.
3. The AI is called **once per quiz** — taking it, retrying and flashcards cost nothing.
4. Row Level Security in Postgres makes sure every user only ever sees their own materials, quizzes and answers.

## Project structure

```
app/
  page.tsx                 landing page
  login/                   sign in / create account
  new/                     upload + quiz settings
  quiz/[id]/               quiz player and results
  flashcards/[id]/         flashcard study mode
  dashboard/               stats, weak topics, quiz list
  settings/                own Gemini key, daily usage
  api/generate/            files → Gemini → saved quiz
  api/attempts/            saves finished quiz attempts
lib/
  gemini.ts                prompt, JSON schema, Gemini call
  extract.ts               Word / PowerPoint text extraction
  grading.ts               typo-tolerant short-answer grading
  limits.ts                daily usage limit
  supabase/                Supabase clients + session proxy
supabase/migrations/       database schema
```
