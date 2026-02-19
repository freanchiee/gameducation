-- Phase 5 step: multimodal engine configurability (auto/advanced + task type matrix)

alter table if exists assessments
  add column if not exists multimodal_engine_mode text not null default 'auto'
  check (multimodal_engine_mode in ('auto', 'advanced'));

alter table if exists assessments
  add column if not exists multimodal_task_types jsonb not null default '[]'::jsonb;

-- Backfill sensible defaults for existing multimodal assessments
update assessments
set multimodal_task_types = '["simulation_probe","graph_analysis","table_completion","iv_dv_cv_sort","matching","short_answer"]'::jsonb
where assessment_mode = 'multimodal'
  and (multimodal_task_types is null or jsonb_typeof(multimodal_task_types) <> 'array' or jsonb_array_length(multimodal_task_types) = 0);
