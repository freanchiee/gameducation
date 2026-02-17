# VoiceIQ – Systems Architect Blueprint

> Applied using the Senior Platform Architect framework.
>
> **Website Type:** EdTech SaaS (AI Oral Assessment)
> **Stack:** Next.js 14 · Supabase · Anthropic Claude API · Vercel

---

## Context

**Primary Audience (Detailed)**
- **Teachers (MYP/IB):** Educators at international schools (grades 6–12) frustrated with AI-generated essay submissions. Tech-comfortable but not developers. Need fast setup, reliable results, exportable reports for school admin. Primary device: laptop. Sessions: evenings and prep periods.
- **Students (MYP Year 1–5, IB DP):** Ages 11–18 at international schools. Mobile-first, expect instant feedback, used to AI tools. Will test limits of the assessment AI. Primary device: phone or school Chromebook.
- **School Administrators:** Need aggregate data, compliance trails, subscription management. Low frequency users; value PDF/CSV exports and class-level dashboards.

**Core Capabilities Required**
1. Real-time AI Socratic dialogue (Claude API + WebSpeech API for STT/TTS)
2. MYP/IB criterion-referenced automatic evaluation (Criterion A–D scoring)
3. Secure, code-gated student sessions (no student auth required)
4. Teacher dashboard: assessment builder, live monitoring, results review
5. Group mode: multi-student collaborative oral assessment with per-student scoring

**Technical Priorities:** PERFORMANCE · SCALABILITY · RESPONSIVE

---

## 1. Information Architecture – Sitemap

```
voiceiq.app/
├── / (root → redirect based on auth)
│
├── (PUBLIC – student-facing, no auth)
│   ├── /lobby               Entry: access code + name input
│   ├── /session/[id]        Live assessment interface
│   └── /results/[id]        Post-assessment feedback
│
├── (AUTH – unauthenticated only)
│   ├── /login
│   ├── /signup
│   └── /reset-password
│
└── (DASHBOARD – teacher auth required)
    ├── /classes
    │   ├── /classes/new                 Create class form
    │   └── /classes/[id]               Class detail + student list
    │
    ├── /assessments
    │   ├── /assessments/new             Assessment builder
    │   ├── /assessments/[id]            Assessment detail + access code
    │   └── /assessments/[id]/monitor   Live session monitor (real-time)
    │
    └── /reports
        ├── /reports/[assessmentId]      Assessment-level results
        └── /reports/evaluation/[id]    Single student evaluation + transcript
```

**Page Hierarchy Logic:**
- Teacher hierarchy: Classes → Assessments → Reports (top-down ownership)
- Student flow is completely separate (code-gated, stateless entry)
- No nested routing beyond 2 levels for performance

---

## 2. User Journey Mapping

### Journey 1: Teacher Creates & Runs First Assessment
```
Sign Up → Create Class → Build Assessment → Activate (get code) →
Share code with students → Monitor live dashboard →
Review AI evaluations → Export report
```
**Critical drop-off points:**
- Signup friction → mitigated with minimal fields (name, school, email, password)
- Assessment builder complexity → guided step-by-step UI with sensible defaults
- Waiting for students → live dashboard shows join status in real-time

### Journey 2: Student Completes Individual Assessment
```
Receive code → Open /lobby → Enter code + name → Grant mic permission →
Read instructions → Answer 6 AI questions → Submit → View results
```
**Critical drop-off points:**
- Microphone denial → graceful text fallback with teacher note
- WebSpeech not supported → detect on load, recommend Chrome, offer text input
- Student anxiety → warm, encouraging AI tone; progress indicator (Q 1 of 6)

### Journey 3: Group Assessment (2–4 students)
```
Teacher enables group mode → Students enter same code →
System auto-groups → Shared session screen → Turn-based speaking →
AI addresses each student by name → Individual scores generated
```
**Critical drop-off points:**
- Students joining at different times → lobby waiting room with live participant list
- One student dominating → AI detects and redirects to quieter participants
- Disconnect mid-session → 10-min rejoin window, progress persisted in Supabase

---

## 3. Data Architecture

### Entity Relationship Model

```
schools ──< profiles (teachers + students)
schools ──< classes
profiles (teacher) ──< classes
classes ──< assessments
classes ──< class_enrolments >── profiles (students)
assessments ──< sessions
sessions ──< session_participants >── profiles
sessions ──< messages
sessions ──< evaluations
evaluations >── profiles (student)
messages >── session_participants
messages → Supabase Storage (audio_url)
```

### Schema Summary

| Table | Key Fields | Notes |
|-------|-----------|-------|
| `schools` | id, name, subscription_plan | One per institution |
| `profiles` | id, role, school_id, full_name | Role: teacher \| student |
| `classes` | teacher_id, programme, year_group, subject | MYP \| DP |
| `assessments` | class_id, criteria jsonb, access_code, max_questions, allow_group | 6-char code, collision-checked |
| `sessions` | assessment_id, mode, status | individual \| group |
| `session_participants` | session_id, student_id | Links students to sessions |
| `messages` | session_id, participant_id, role, content, audio_url | ai \| student |
| `evaluations` | session_id, student_id, criterion_a–d levels, evidence_quotes jsonb | AI-generated, teacher-overrideable |

**Row Level Security:** Every table has RLS. Teachers see only their own data. Students can only submit to active assessments via valid code. Evaluations readable only by the student and their class teacher.

---

## 4. API Surface Definition

### Internal API Routes (Next.js App Router)

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/api/ai/question` | None (code-gated) | Takes conversation history + assessment config → streams next Claude question |
| POST | `/api/ai/evaluate` | None (code-gated) | Takes full transcript → returns MYP criterion scores as JSON |
| POST | `/api/sessions` | None (code-gated) | Creates or joins session by access code |
| GET | `/api/sessions/[id]` | Session token | Fetches session state |
| POST | `/api/transcripts` | Session token | Stores message to DB + audio to Supabase Storage |
| POST | `/api/auth/signout` | Supabase session | Signs teacher out |

### External Integrations

| Service | Usage | Auth Method |
|---------|-------|-------------|
| Anthropic Claude API | Socratic dialogue + evaluation | `ANTHROPIC_API_KEY` (server-only) |
| Supabase Auth | Teacher login, session cookies | Supabase SSR cookies |
| Supabase Realtime | Live session monitor, group sync | Supabase anon key (scoped by RLS) |
| Supabase Storage | Audio blob storage | Service role key (server-only) |
| Web Speech API | Browser-native STT + TTS | Browser permission (microphone) |
| Whisper API (v1.1) | Server-side STT fallback | `OPENAI_API_KEY` |

**Authentication Logic:**
- Teachers: Supabase email/password auth → JWT cookie → middleware validates on every teacher route
- Students: No auth. Access code validated server-side → short-lived session token stored in sessionStorage → used for subsequent API calls within that session

---

## 5. Component Inventory (30+ UI Components)

### Assessment Session Components
| Component | File | Purpose |
|-----------|------|---------|
| `VoiceInterface` | `components/assessment/VoiceInterface.tsx` | Core mic button, recording state, interim transcript |
| `ConversationFeed` | `components/assessment/ConversationFeed.tsx` | Scrolling message history, AI/student colour-coded |
| `GroupPanel` | `components/assessment/GroupPanel.tsx` | Multi-student layout, active speaker indicator |
| `ResultsCard` | `components/assessment/ResultsCard.tsx` | Level badge, strengths, growth areas, evidence quotes |
| `ProgressBar` | `components/assessment/ProgressBar.tsx` | Question progress (Q 1 of 6) |
| `AIStateIndicator` | `components/assessment/AIStateIndicator.tsx` | idle / listening / processing / speaking states |
| `TranscriptConfirm` | `components/assessment/TranscriptConfirm.tsx` | Student confirms speech-to-text before submission |
| `MicPermissionGate` | `components/assessment/MicPermissionGate.tsx` | Handles permission denied → text fallback |
| `SessionLobby` | `components/assessment/SessionLobby.tsx` | Waiting room, participant list for group mode |
| `AudioVisualizer` | `components/assessment/AudioVisualizer.tsx` | Waveform animation during recording |

### Teacher Dashboard Components
| Component | File | Purpose |
|-----------|------|---------|
| `ClassCard` | `components/teacher/ClassCard.tsx` | Class summary tile |
| `AssessmentBuilder` | `components/teacher/AssessmentBuilder.tsx` | Multi-step form for creating assessments |
| `AccessCodeDisplay` | `components/teacher/AccessCodeDisplay.tsx` | Large, copyable 6-char code with QR code |
| `LiveSessionMonitor` | `components/teacher/LiveSessionMonitor.tsx` | Real-time view of students in active session |
| `EvaluationTable` | `components/teacher/EvaluationTable.tsx` | Sortable table of all student results |
| `EvaluationDetail` | `components/teacher/EvaluationDetail.tsx` | Full transcript + criterion breakdown per student |
| `TeacherOverrideForm` | `components/teacher/TeacherOverrideForm.tsx` | Override AI score with justification |
| `CriterionBadge` | `components/teacher/CriterionBadge.tsx` | Visual level indicator (0–8 with band colour) |
| `ExportButton` | `components/teacher/ExportButton.tsx` | PDF/CSV export trigger |
| `ClassAnalytics` | `components/teacher/ClassAnalytics.tsx` | Average levels per criterion/topic chart |
| `StudentList` | `components/teacher/StudentList.tsx` | Enrolled students with completion status |
| `AssessmentStatusBadge` | `components/teacher/AssessmentStatusBadge.tsx` | draft / active / closed pill |

### Shared UI Components (shadcn/ui base)
| Component | File | Purpose |
|-----------|------|---------|
| `Button` | `components/ui/button.tsx` | Primary, secondary, destructive variants |
| `Input` | `components/ui/input.tsx` | Styled form input |
| `Label` | `components/ui/label.tsx` | Form label |
| `Card` | `components/ui/card.tsx` | Content container |
| `Dialog` | `components/ui/dialog.tsx` | Modal overlay |
| `Select` | `components/ui/select.tsx` | Dropdown selector |
| `Tabs` | `components/ui/tabs.tsx` | Tab navigation |
| `Toast` | `components/ui/toast.tsx` | Success/error notifications |
| `Toaster` | `components/ui/toaster.tsx` | Toast container |
| `Badge` | `components/ui/badge.tsx` | Status pill |
| `Skeleton` | `components/ui/skeleton.tsx` | Loading placeholder |
| `Separator` | `components/ui/separator.tsx` | Visual divider |
| `Avatar` | `components/ui/avatar.tsx` | Student/teacher avatar |
| `Progress` | `components/ui/progress.tsx` | Progress bar primitive |
| `Textarea` | `components/ui/textarea.tsx` | Multi-line input |
| `Switch` | `components/ui/switch.tsx` | Toggle (e.g. allow group mode) |

---

## 6. Page Blueprints

### `/lobby` – Student Entry
```
[VoiceIQ Logo] [Tagline: "Your oral assessment starts here"]
─────────────────────────────────────────────────────────
[Large Input: 6-character access code]          ← auto-uppercase
[Input: Your full name]
[Button: Join Assessment]
─────────────────────────────────────────────────────────
[Small text: "Student? No account needed. Just enter your code."]
```

### `/session/[id]` – Live Assessment
```
[Top bar: Topic | Progress Q3/6 | Timer]
────────────────────────────────────────────────────────
[ConversationFeed]                     [GroupPanel (if group)]
  AI: "Can you explain what happens      Arjun ● Active
       to wave frequency when..."        Priya  ○
  Student: "When frequency increases..." Rohan  ○
  AI: "Good. Now, what about..."
────────────────────────────────────────────────────────
[TranscriptConfirm: "Here's what I heard: ___" [Edit] [Confirm]]
[AIStateIndicator: ● Listening]
[VoiceInterface: Large mic button with pulse animation]
[Text fallback link: "Can't use mic?"]
```

### `/results/[id]` – Student Results
```
[Header: "Assessment Complete – MYP Year 4 Physics: Waves"]
─────────────────────────────────────────────────────────
[CriterionBadge: Criterion A – Level 6/8 – "Substantial"]
─────────────────────────────────────────────────────────
[Strengths panel]          [Areas for Growth panel]
  ✓ Correct use of v=fλ     → Could not explain phase
  ✓ Real-world example        difference in own words
    for resonance
─────────────────────────────────────────────────────────
[Evidence Quotes: "You said: 'frequency and wavelength
 are inversely proportional when speed is constant' –
 this shows solid understanding of the wave equation"]
─────────────────────────────────────────────────────────
[Student Feedback paragraph: encouraging, 3–4 sentences]
```

### `/assessments/new` – Assessment Builder
```
Step 1: Basics          Step 2: AI Config        Step 3: Activate
─────────────────────────────────────────────────────────────────
Title                   MYP Year [Select]        [AccessCodeDisplay]
Topic                   Criteria [A B C D]       Code: XK7P2Q
Subject                 No. of Questions [1-10]  [Copy] [QR Code]
Class [Select]          Allow Group [Switch]
                        Topic Context [Textarea]  [Activate Assessment]
                        Custom Instructions
```

### `/reports/evaluation/[id]` – Teacher Evaluation Review
```
[Student: Priya Sharma | Assessment: Waves | Date: Feb 17]
─────────────────────────────────────────────────────────
[CriterionBadge A: 5/8] [Override: ___ ] [Justification: ___]
─────────────────────────────────────────────────────────
[Full Transcript – scrollable, AI/student colour-coded]
[Audio Player (if recorded)]
─────────────────────────────────────────────────────────
[AI Strengths] [AI Growth Areas] [AI Teacher Notes]
─────────────────────────────────────────────────────────
[ExportButton: Download PDF] [Mark as Reviewed]
```

---

## 7. Technology Stack Recommendation

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Framework | Next.js 14 (App Router) | SSR for dashboard performance, RSC for data fetching, API routes for Claude proxy |
| Language | TypeScript | Type safety for rubric schemas and Claude response parsing |
| Styling | Tailwind CSS + shadcn/ui | Rapid, consistent UI; accessible primitives |
| Database | Supabase (PostgreSQL) | Managed Postgres + Auth + Realtime + Storage in one; RLS for security |
| AI Engine | Anthropic Claude (`claude-sonnet-4-20250514`) | Best-in-class instruction following for Socratic prompts; streaming support |
| STT | Web Speech API (browser) + Whisper API (fallback) | Zero latency for Chrome users; server fallback for Safari/Firefox |
| TTS | Web Speech Synthesis API | Browser-native, zero-cost, works offline |
| Real-time | Supabase Realtime | Group session sync + live teacher monitor; already bundled with Supabase |
| File Storage | Supabase Storage | Audio blobs, transcripts; integrated with existing auth/RLS |
| Deployment | Vercel | Zero-config Next.js; edge functions for low-latency Claude streaming |
| Payments (v2) | Stripe | Industry standard; per-seat and school plan support |

---

## 8. Performance Benchmarks

| Metric | Target | Strategy |
|--------|--------|---------|
| LCP (Largest Contentful Paint) | < 1.5s | RSC + streaming; no client waterfalls |
| FID / INP | < 100ms | Minimal client JS; voice input is native browser API |
| CLS | < 0.1 | Fixed layouts; skeleton loaders prevent layout shift |
| Claude first-token latency | < 800ms | Streaming responses; conversation history trimmed to last 10 turns |
| Session start (student entry to Q1) | < 3s | Pre-generate Q1 server-side when session is activated |
| Audio processing (STT → transcript) | < 1s | WebSpeech is synchronous; Whisper fallback async with optimistic UI |
| DB query p99 | < 50ms | Supabase indexes on `assessment_id`, `session_id`, `student_id`; RLS-optimised queries |
| Vercel cold start | < 500ms | Edge runtime for auth middleware; Node.js runtime for AI routes |

---

## 9. SEO Framework

> Note: Most of VoiceIQ is behind auth (teacher) or code-gated (student). SEO applies primarily to the marketing/landing layer and student-facing entry points.

**URL Conventions:**
```
/                           → Marketing landing page (301 if authed)
/lobby                      → Student entry (noindex – transient)
/session/[id]               → Assessment session (noindex – private)
/results/[id]               → Student results (noindex – private)
/login, /signup             → Auth pages (noindex)
/classes/[id]               → Teacher dashboard (noindex – auth-gated)
```

**Meta Structure:**
```html
<!-- Landing page -->
<title>VoiceIQ – AI Oral Assessment for MYP & IB</title>
<meta name="description" content="Replace written assessments with real-time AI oral exams. Claude-powered Socratic dialogue that makes AI cheating structurally impossible." />
<meta property="og:image" content="/og-image.png" /> <!-- 1200×630 -->

<!-- App pages: prevent indexing -->
<meta name="robots" content="noindex, nofollow" />
```

**Schema Markup (Landing Page):**
```json
{
  "@type": "SoftwareApplication",
  "name": "VoiceIQ",
  "applicationCategory": "EducationalApplication",
  "operatingSystem": "Web",
  "audience": { "@type": "EducationalAudience", "educationalRole": "teacher" },
  "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" }
}
```

**Core Web Vitals SEO Impact:** Good CWV scores benefit the landing page's Google ranking. Server-render the landing page with RSC; no client JS required for above-the-fold content.

---

*Blueprint version 1.0 – Generated for VoiceIQ MVP targeting Oberoi International School beta.*
