-- Track anonymous student display names and whether typing fallback is allowed.
alter table if exists session_participants
  add column if not exists student_name text;

alter table if exists session_participants
  add column if not exists allow_text_input boolean not null default false;
