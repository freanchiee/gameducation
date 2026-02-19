-- Part 2 runtime layer: multimodal task orchestration, event logging, and explainable scoring.

begin;

create table if not exists multimodal_tasks (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  task_type text not null,
  criterion text not null check (criterion in ('A', 'B', 'C', 'D')),
  difficulty_level int not null check (difficulty_level between 1 and 8),
  config jsonb not null default '{}'::jsonb,
  estimated_duration_seconds int not null default 300,
  created_at timestamptz not null default now()
);

create table if not exists session_task_runs (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid not null references sessions(id) on delete cascade,
  task_id uuid not null references multimodal_tasks(id) on delete restrict,
  participant_id uuid not null references session_participants(id) on delete cascade,
  student_id uuid references profiles(id) on delete set null,
  criterion text not null check (criterion in ('A', 'B', 'C', 'D')),
  task_sequence int not null,
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'submitted', 'skipped', 'error')),
  task_config jsonb not null default '{}'::jsonb,
  submission_data jsonb,
  started_at timestamptz,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (participant_id, task_sequence)
);

create table if not exists task_events (
  id uuid primary key default uuid_generate_v4(),
  task_run_id uuid not null references session_task_runs(id) on delete cascade,
  session_id uuid not null references sessions(id) on delete cascade,
  participant_id uuid not null references session_participants(id) on delete cascade,
  event_type text not null,
  event_data jsonb not null default '{}'::jsonb,
  timestamp timestamptz not null default now()
);

create table if not exists rubric_evidence (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid not null references sessions(id) on delete cascade,
  participant_id uuid not null references session_participants(id) on delete cascade,
  student_id uuid references profiles(id) on delete set null,
  task_run_id uuid references session_task_runs(id) on delete set null,
  criterion text not null check (criterion in ('A', 'B', 'C', 'D')),
  evidence_type text not null,
  indicated_level int check (indicated_level between 0 and 8),
  weight numeric not null default 1,
  evidence_value jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists scoring_decisions (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid not null references sessions(id) on delete cascade,
  participant_id uuid not null references session_participants(id) on delete cascade,
  student_id uuid references profiles(id) on delete set null,
  criterion text not null check (criterion in ('A', 'B', 'C', 'D')),
  rubric_level int not null check (rubric_level between 0 and 8),
  rubric_level_band text,
  justification text not null,
  evidence_summary jsonb not null default '{}'::jsonb,
  confidence_score float,
  created_at timestamptz not null default now(),
  unique (participant_id, criterion)
);

create index if not exists idx_multimodal_tasks_type_criterion
  on multimodal_tasks(task_type, criterion);

create index if not exists idx_session_task_runs_session
  on session_task_runs(session_id);

create index if not exists idx_session_task_runs_participant
  on session_task_runs(participant_id, task_sequence);

create index if not exists idx_task_events_run
  on task_events(task_run_id, timestamp);

create index if not exists idx_rubric_evidence_session
  on rubric_evidence(session_id, participant_id, criterion);

create index if not exists idx_scoring_decisions_session
  on scoring_decisions(session_id, participant_id, criterion);

alter table multimodal_tasks enable row level security;
alter table session_task_runs enable row level security;
alter table task_events enable row level security;
alter table rubric_evidence enable row level security;
alter table scoring_decisions enable row level security;

-- Service role writes through backend API routes.
drop policy if exists "Service role manage multimodal tasks" on multimodal_tasks;
create policy "Service role manage multimodal tasks"
  on multimodal_tasks
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "Service role manage session task runs" on session_task_runs;
create policy "Service role manage session task runs"
  on session_task_runs
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "Service role manage task events" on task_events;
create policy "Service role manage task events"
  on task_events
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "Service role manage rubric evidence" on rubric_evidence;
create policy "Service role manage rubric evidence"
  on rubric_evidence
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "Service role manage scoring decisions" on scoring_decisions;
create policy "Service role manage scoring decisions"
  on scoring_decisions
  for all
  to service_role
  using (true)
  with check (true);

commit;
