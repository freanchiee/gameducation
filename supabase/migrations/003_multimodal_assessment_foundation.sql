-- Phase 5 foundation: multimodal assessment mode + learning materials.

alter table if exists assessments
  add column if not exists assessment_mode text not null default 'voice'
  check (assessment_mode in ('voice', 'multimodal'));

alter table if exists assessments
  add column if not exists tab_lock_enabled boolean not null default false;

alter table if exists assessments
  add column if not exists proctoring_enabled boolean not null default false;

create table if not exists learning_materials (
  id uuid primary key default uuid_generate_v4(),
  assessment_id uuid not null references assessments(id) on delete cascade,
  title text not null,
  type text not null,
  original_filename text,
  storage_path text,
  file_size_bytes bigint,
  extracted_text text,
  material_data jsonb not null default '{}'::jsonb,
  media_urls jsonb not null default '[]'::jsonb,
  processing_status text not null default 'pending'
    check (processing_status in ('pending', 'processing', 'ready', 'error')),
  processing_error text,
  display_order int not null default 0,
  show_during_assessment boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists material_references (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid not null references sessions(id) on delete cascade,
  material_id uuid not null references learning_materials(id) on delete cascade,
  message_id uuid references messages(id) on delete set null,
  reference_type text not null,
  reference_context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_learning_materials_assessment_id
  on learning_materials(assessment_id);

create index if not exists idx_learning_materials_processing_status
  on learning_materials(processing_status);

create index if not exists idx_material_references_session_id
  on material_references(session_id);

alter table learning_materials enable row level security;
alter table material_references enable row level security;

drop policy if exists "Teachers manage materials for own assessments" on learning_materials;
create policy "Teachers manage materials for own assessments"
  on learning_materials
  for all
  using (
    assessment_id in (
      select a.id
      from assessments a
      join classes c on a.class_id = c.id
      where c.teacher_id = auth.uid()
    )
  )
  with check (
    assessment_id in (
      select a.id
      from assessments a
      join classes c on a.class_id = c.id
      where c.teacher_id = auth.uid()
    )
  );

drop policy if exists "Teachers view material references for own assessments" on material_references;
create policy "Teachers view material references for own assessments"
  on material_references
  for select
  using (
    session_id in (
      select s.id
      from sessions s
      join assessments a on s.assessment_id = a.id
      join classes c on a.class_id = c.id
      where c.teacher_id = auth.uid()
    )
  );

drop policy if exists "Service role insert material references" on material_references;
create policy "Service role insert material references"
  on material_references
  for insert
  with check (true);

insert into storage.buckets (id, name, public)
values ('learning-materials', 'learning-materials', false)
on conflict (id) do nothing;

drop policy if exists "Authenticated read learning-materials objects" on storage.objects;
create policy "Authenticated read learning-materials objects"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'learning-materials');

drop policy if exists "Authenticated upload learning-materials objects" on storage.objects;
create policy "Authenticated upload learning-materials objects"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'learning-materials');

drop policy if exists "Authenticated update learning-materials objects" on storage.objects;
create policy "Authenticated update learning-materials objects"
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'learning-materials')
  with check (bucket_id = 'learning-materials');

drop policy if exists "Authenticated delete learning-materials objects" on storage.objects;
create policy "Authenticated delete learning-materials objects"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'learning-materials');
