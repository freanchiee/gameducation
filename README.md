# VoiceIQ – AI Oral Assessment Platform for MYP & IB

> Making AI work **for** learning, not against it.

VoiceIQ uses Claude AI to conduct real-time Socratic oral assessments for MYP and IB students. It makes AI-assisted cheating structurally impossible — you can't paste into ChatGPT to answer a live follow-up question.

Built by educators, for educators. Starting with Oberoi International School's MYP Physics classes.

---

## Features

- **AI-Powered Socratic Dialogue** — Claude asks adaptive follow-up questions based on student responses
- **MYP Criterion A–D Scoring** — Automatic rubric-referenced evaluation on the 0–8 scale
- **No Student Account Required** — Students join via a 6-character access code
- **Voice-First Interface** — WebSpeech API for mic input; text fallback for unsupported browsers
- **Teacher Dashboard** — Build assessments, share codes, monitor live sessions, review results
- **Group Mode (v1.1)** — 2–4 students in a shared session, individual scores generated per student
- **MYP Physics Topics** — Waves, Electricity, Forces & Motion (more subjects in v1.1)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS |
| Backend | Next.js API Routes |
| Database | Supabase (PostgreSQL + Auth + Realtime + Storage) |
| AI Engine | Anthropic Claude (`claude-sonnet-4-20250514`) |
| Speech-to-Text | Web Speech API (browser) + Whisper API (fallback) |
| Text-to-Speech | Web Speech Synthesis API |
| Deployment | Vercel |

---

## Local Setup

### Prerequisites
- Node.js 18+
- A [Supabase](https://supabase.com) project
- An [Anthropic API](https://console.anthropic.com) key

### Steps

```bash
# 1. Clone the repo
git clone <repo-url>
cd voiceiq

# 2. Install dependencies
npm install

# 3. Configure environment variables
cp .env.example .env.local
# Edit .env.local and fill in:
#   NEXT_PUBLIC_SUPABASE_URL
#   NEXT_PUBLIC_SUPABASE_ANON_KEY
#   SUPABASE_SERVICE_ROLE_KEY
#   ANTHROPIC_API_KEY

# 4. Run the database migration
# Go to your Supabase project → SQL editor
# Copy and run: supabase/migrations/001_initial_schema.sql

# 5. Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Project Structure

```
app/
  (auth)/          Login, signup, reset-password pages
  (dashboard)/     Teacher dashboard (auth required)
  (student)/       Student session pages (code-gated)
  api/             AI, session, transcript API routes
components/
  assessment/      VoiceInterface, ConversationFeed, ResultsCard
  teacher/         Dashboard UI components
  ui/              shadcn/ui base components
lib/
  claude.ts        Anthropic SDK wrapper
  prompts/         AI system prompts (server-side only)
  supabase/        Supabase client helpers
  types/           TypeScript interfaces
supabase/
  migrations/      SQL schema and RLS policies
```

---

## Teacher Workflow

1. Sign up → Create a class (year group, subject, programme)
2. Create an assessment → topic, criteria, number of questions
3. Activate assessment → get 6-character access code
4. Share code with students (on board, LMS, WhatsApp)
5. Monitor live sessions → review AI evaluations → export results

## Student Workflow

1. Open VoiceIQ in Chrome (any device, no install)
2. Enter access code + full name
3. Grant microphone permission
4. Answer 6 AI questions verbally (~10–15 minutes)
5. View results instantly

---

## Roadmap

- [x] Phase 0: Project scaffold, DB schema, AI prompts
- [ ] Phase 1: Auth & teacher profiles
- [ ] Phase 2: Teacher dashboard (classes, assessments, codes)
- [ ] Phase 3: Core assessment session (individual, voice)
- [ ] Phase 4: Group assessment mode
- [ ] Phase 5: Reports, export, analytics

---

## Contributing

This project is in active development for beta testing at Oberoi International School. Issues and PRs welcome.

---

*VoiceIQ — Making Understanding Visible*
