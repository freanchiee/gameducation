-- Server-stored drafts for assessment creation forms.

create table if not exists assessment_drafts (
  id uuid primary key default uuid_generate_v4(),
  teacher_id uuid not null default auth.uid(),
  class_id uuid references classes(id) on delete set null,
  title text,
  topic text,
  mode text not null default 'voice'
    check (mode in ('voice', 'multimodal')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_assessment_drafts_teacher
  on assessment_drafts(teacher_id, updated_at desc);

alter table assessment_drafts enable row level security;

drop policy if exists "Teachers manage own assessment drafts" on assessment_drafts;
create policy "Teachers manage own assessment drafts"
  on assessment_drafts
  for all
  using (teacher_id = auth.uid())
  with check (teacher_id = auth.uid());
