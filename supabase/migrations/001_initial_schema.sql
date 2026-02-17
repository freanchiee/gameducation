-- ============================================================
-- VoiceIQ – Initial Database Schema
-- Run against your Supabase project via the SQL editor or CLI
-- ============================================================

-- ─── Extensions ──────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ─── SCHOOLS ─────────────────────────────────────────────────
create table if not exists schools (
  id                uuid primary key default uuid_generate_v4(),
  name              text not null,
  subscription_plan text not null default 'free'
                    check (subscription_plan in ('free','teacher_pro','school','district')),
  max_students      integer,
  created_at        timestamptz not null default now()
);

-- ─── PROFILES (teachers + students) ──────────────────────────
-- Extends Supabase auth.users
create table if not exists profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  full_name   text not null,
  role        text not null default 'teacher'
              check (role in ('teacher','student')),
  school_id   uuid references schools(id),
  created_at  timestamptz not null default now()
);

-- Auto-create profile row when a new user signs up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    coalesce(new.raw_user_meta_data->>'role', 'teacher')
  );
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─── CLASSES ─────────────────────────────────────────────────
create table if not exists classes (
  id          uuid primary key default uuid_generate_v4(),
  teacher_id  uuid not null references profiles(id) on delete cascade,
  name        text not null,
  year_group  text not null,   -- e.g. 'MYP 4', 'DP Year 1'
  programme   text not null    check (programme in ('MYP','DP')),
  subject     text not null,
  created_at  timestamptz not null default now()
);

-- ─── CLASS ENROLMENTS ────────────────────────────────────────
create table if not exists class_enrolments (
  id          uuid primary key default uuid_generate_v4(),
  class_id    uuid not null references classes(id) on delete cascade,
  student_id  uuid not null references profiles(id) on delete cascade,
  enrolled_at timestamptz not null default now(),
  unique(class_id, student_id)
);

-- ─── ASSESSMENTS ─────────────────────────────────────────────
create table if not exists assessments (
  id               uuid primary key default uuid_generate_v4(),
  class_id         uuid not null references classes(id) on delete cascade,
  title            text not null,
  description      text,
  subject          text not null,
  topic            text not null,
  year_group       text not null,
  criteria         jsonb not null default '["A"]',   -- ['A','B','C','D'] subset
  max_questions    integer not null default 6,
  allow_group      boolean not null default false,
  max_group_size   integer not null default 1        check (max_group_size between 1 and 4),
  system_prompt    text,
  topic_context    text,
  status           text not null default 'draft'     check (status in ('draft','active','closed')),
  access_code      text unique,                       -- 6-char uppercase, set on activation
  created_at       timestamptz not null default now()
);

-- ─── SESSIONS ────────────────────────────────────────────────
create table if not exists sessions (
  id             uuid primary key default uuid_generate_v4(),
  assessment_id  uuid not null references assessments(id) on delete cascade,
  mode           text not null check (mode in ('individual','group')),
  status         text not null default 'waiting' check (status in ('waiting','active','completed')),
  started_at     timestamptz,
  completed_at   timestamptz
);

-- ─── SESSION PARTICIPANTS ─────────────────────────────────────
create table if not exists session_participants (
  id          uuid primary key default uuid_generate_v4(),
  session_id  uuid not null references sessions(id) on delete cascade,
  student_id  uuid references profiles(id),    -- null = anonymous student
  joined_at   timestamptz not null default now()
);

-- ─── MESSAGES (transcript) ───────────────────────────────────
create table if not exists messages (
  id             uuid primary key default uuid_generate_v4(),
  session_id     uuid not null references sessions(id) on delete cascade,
  participant_id uuid references session_participants(id),
  role           text not null check (role in ('ai','student')),
  content        text not null,
  audio_url      text,         -- Supabase Storage URL
  timestamp      timestamptz not null default now()
);

-- ─── EVALUATIONS ─────────────────────────────────────────────
create table if not exists evaluations (
  id                    uuid primary key default uuid_generate_v4(),
  session_id            uuid not null references sessions(id) on delete cascade,
  student_id            uuid references profiles(id),
  criterion_a_level     integer check (criterion_a_level between 0 and 8),
  criterion_b_level     integer check (criterion_b_level between 0 and 8),
  criterion_c_level     integer check (criterion_c_level between 0 and 8),
  criterion_d_level     integer check (criterion_d_level between 0 and 8),
  strengths             jsonb not null default '[]',
  areas_for_growth      jsonb not null default '[]',
  evidence_quotes       jsonb not null default '[]',
  feedback_student      text,
  notes_teacher         text,
  full_report           jsonb,
  reviewed_by_teacher   boolean not null default false,
  teacher_override_level integer check (teacher_override_level between 0 and 8),
  created_at            timestamptz not null default now()
);

-- ─── INDEXES ─────────────────────────────────────────────────
create index if not exists idx_classes_teacher_id        on classes(teacher_id);
create index if not exists idx_assessments_class_id      on assessments(class_id);
create index if not exists idx_assessments_access_code   on assessments(access_code);
create index if not exists idx_sessions_assessment_id    on sessions(assessment_id);
create index if not exists idx_messages_session_id       on messages(session_id);
create index if not exists idx_evaluations_session_id    on evaluations(session_id);
create index if not exists idx_evaluations_student_id    on evaluations(student_id);

-- ─── ROW LEVEL SECURITY ───────────────────────────────────────

-- Enable RLS on all tables
alter table schools             enable row level security;
alter table profiles            enable row level security;
alter table classes             enable row level security;
alter table class_enrolments    enable row level security;
alter table assessments         enable row level security;
alter table sessions            enable row level security;
alter table session_participants enable row level security;
alter table messages            enable row level security;
alter table evaluations         enable row level security;

-- profiles: users can read/update their own profile
create policy "Users can view own profile"
  on profiles for select using (auth.uid() = id);

create policy "Users can update own profile"
  on profiles for update using (auth.uid() = id);

-- classes: teachers can only see their own classes
create policy "Teachers manage own classes"
  on classes for all
  using (teacher_id = auth.uid());

-- class_enrolments: teachers see enrolments for their classes
create policy "Teachers view enrolments for own classes"
  on class_enrolments for select
  using (
    class_id in (select id from classes where teacher_id = auth.uid())
  );

-- assessments: teachers manage their own assessments
create policy "Teachers manage own assessments"
  on assessments for all
  using (
    class_id in (select id from classes where teacher_id = auth.uid())
  );

-- assessments: anyone can SELECT an active assessment by access code (for students)
create policy "Students can read active assessments by code"
  on assessments for select
  using (status = 'active');

-- sessions: readable by teacher of the related assessment
create policy "Teachers can view sessions for own assessments"
  on sessions for select
  using (
    assessment_id in (
      select a.id from assessments a
      join classes c on a.class_id = c.id
      where c.teacher_id = auth.uid()
    )
  );

-- sessions: anyone can insert/update (student session creation is code-gated at API level)
create policy "Anyone can create sessions"
  on sessions for insert with check (true);

create policy "Anyone can update session status"
  on sessions for update using (true);

-- session_participants: anyone can insert (validated at API level)
create policy "Anyone can join sessions"
  on session_participants for insert with check (true);

create policy "Teachers can view participants"
  on session_participants for select
  using (
    session_id in (
      select s.id from sessions s
      join assessments a on s.assessment_id = a.id
      join classes c on a.class_id = c.id
      where c.teacher_id = auth.uid()
    )
  );

-- messages: anyone can insert (session token validated at API level)
create policy "Anyone can insert messages"
  on messages for insert with check (true);

create policy "Teachers can view messages for own sessions"
  on messages for select
  using (
    session_id in (
      select s.id from sessions s
      join assessments a on s.assessment_id = a.id
      join classes c on a.class_id = c.id
      where c.teacher_id = auth.uid()
    )
  );

-- evaluations: students can read their own evaluation; teachers read all in their classes
create policy "Students can view own evaluation"
  on evaluations for select
  using (student_id = auth.uid());

create policy "Teachers can view evaluations for own classes"
  on evaluations for select
  using (
    session_id in (
      select s.id from sessions s
      join assessments a on s.assessment_id = a.id
      join classes c on a.class_id = c.id
      where c.teacher_id = auth.uid()
    )
  );

create policy "Service role can insert evaluations"
  on evaluations for insert with check (true);

create policy "Teachers can update evaluations"
  on evaluations for update
  using (
    session_id in (
      select s.id from sessions s
      join assessments a on s.assessment_id = a.id
      join classes c on a.class_id = c.id
      where c.teacher_id = auth.uid()
    )
  );
