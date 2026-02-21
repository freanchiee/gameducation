-- ============================================================
-- VoiceIQ – Migration 002: Multimodal Resources + Participant fields
-- Run against your Supabase project after 001_initial_schema.sql
-- ============================================================

-- ─── Add resources column to assessments ─────────────────────
-- Stores an array of EmbedResource objects (GeoGebra, PhET, YouTube, raw embed HTML)
alter table assessments
  add column if not exists resources jsonb not null default '[]'::jsonb;

-- ─── Add participant display fields ──────────────────────────
-- student_name: stored at join time so we don't need a profiles join for display
-- allow_text_input: teacher-controlled flag to allow typing instead of speaking
alter table session_participants
  add column if not exists student_name   text,
  add column if not exists allow_text_input boolean not null default false;

-- ─── Index for faster resource lookups ───────────────────────
-- (optional, only needed if filtering by resource type at scale)
-- create index if not exists idx_assessments_resources on assessments using gin(resources);
