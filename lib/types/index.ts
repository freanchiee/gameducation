// ─── Database Table Interfaces ───────────────────────────────────────────────

export interface School {
  id: string
  name: string
  subscription_plan: 'free' | 'teacher_pro' | 'school' | 'district'
  max_students: number | null
  created_at: string
}

export interface Profile {
  id: string
  email: string
  full_name: string
  role: 'teacher' | 'student'
  school_id: string | null
  created_at: string
}

export interface Class {
  id: string
  teacher_id: string
  name: string
  year_group: string       // e.g. "MYP 4", "DP Year 1"
  programme: 'MYP' | 'DP'
  subject: string          // e.g. "Physics", "Chemistry"
  created_at: string
}

export interface ClassEnrolment {
  id: string
  class_id: string
  student_id: string
  enrolled_at: string
}

export type AssessmentCriterion = 'A' | 'B' | 'C' | 'D'
export type AssessmentStatus = 'draft' | 'active' | 'closed'
export type AssessmentMode = 'voice' | 'multimodal'
export type MultimodalEngineMode = 'auto' | 'advanced'
export type MultimodalTaskType =
  | 'simulation_probe'
  | 'graph_analysis'
  | 'table_completion'
  | 'iv_dv_cv_sort'
  | 'matching'
  | 'fill_blank'
  | 'short_answer'
  | 'extended_response'

export type CanonicalMultimodalTaskType =
  | 'variable_sorter'
  | 'variable_matching'
  | 'simulation_data_collection'
  | 'graph_interpretation'
  | 'claim_evidence_reasoning'
  | 'error_analysis'
  | 'investigation_design'
  | 'reflection_evaluation'

export interface Assessment {
  id: string
  class_id: string
  title: string
  description: string | null
  subject: string
  topic: string
  year_group: string
  criteria: AssessmentCriterion[]       // e.g. ['A', 'B']
  max_questions: number                  // default 6
  allow_group: boolean
  max_group_size: number                 // 1–4
  system_prompt: string | null           // custom teacher instructions
  topic_context: string | null           // what was taught before this assessment
  status: AssessmentStatus
  assessment_mode: AssessmentMode
  multimodal_engine_mode: MultimodalEngineMode
  multimodal_task_types: MultimodalTaskType[]
  tab_lock_enabled: boolean
  proctoring_enabled: boolean
  access_code: string                    // 6-char uppercase
  created_at: string
}

export type LearningMaterialType =
  | 'pdf'
  | 'docx'
  | 'pptx'
  | 'youtube'
  | 'image'
  | 'video'
  | 'website'
  | 'text'

export interface LearningMaterial {
  id: string
  assessment_id: string
  title: string
  type: LearningMaterialType
  original_filename: string | null
  storage_path: string | null
  file_size_bytes: number | null
  extracted_text: string | null
  material_data: Record<string, unknown>
  media_urls: string[]
  processing_status: 'pending' | 'processing' | 'ready' | 'error'
  processing_error: string | null
  display_order: number
  show_during_assessment: boolean
  created_at: string
  updated_at: string
}

export type SessionMode = 'individual' | 'group'
export type SessionStatus = 'waiting' | 'active' | 'completed'

export interface Session {
  id: string
  assessment_id: string
  mode: SessionMode
  status: SessionStatus
  started_at: string | null
  completed_at: string | null
}

export interface SessionParticipant {
  id: string
  session_id: string
  student_id: string | null
  student_name: string | null
  allow_text_input: boolean
  joined_at: string
}

export interface MultimodalTaskTemplate {
  id: string
  title: string
  task_type: CanonicalMultimodalTaskType
  criterion: AssessmentCriterion
  difficulty_level: number
  config: Record<string, unknown>
  estimated_duration_seconds: number
  created_at: string
}

export interface SessionTaskRun {
  id: string
  session_id: string
  task_id: string
  participant_id: string
  student_id: string | null
  criterion: AssessmentCriterion
  task_sequence: number
  status: 'pending' | 'in_progress' | 'submitted' | 'skipped' | 'error'
  task_config: Record<string, unknown>
  submission_data: Record<string, unknown> | null
  started_at: string | null
  submitted_at: string | null
  created_at: string
}

export interface TaskEvent {
  id: string
  task_run_id: string
  session_id: string
  participant_id: string
  event_type: string
  event_data: Record<string, unknown>
  timestamp: string
}

export interface RubricEvidence {
  id: string
  session_id: string
  participant_id: string
  student_id: string | null
  task_run_id: string | null
  criterion: AssessmentCriterion
  evidence_type: string
  indicated_level: number | null
  weight: number
  evidence_value: Record<string, unknown>
  created_at: string
}

export interface ScoringDecision {
  id: string
  session_id: string
  participant_id: string
  student_id: string | null
  criterion: AssessmentCriterion
  rubric_level: number
  rubric_level_band: string | null
  justification: string
  evidence_summary: Record<string, unknown>
  confidence_score: number | null
  created_at: string
}

export type MessageRole = 'ai' | 'student'

export interface Message {
  id: string
  session_id: string
  participant_id: string | null
  role: MessageRole
  content: string
  audio_url: string | null
  timestamp: string
}

export interface Evaluation {
  id: string
  session_id: string
  student_id: string | null
  criterion_a_level: number | null       // 0–8
  criterion_b_level: number | null
  criterion_c_level: number | null
  criterion_d_level: number | null
  strengths: string[]
  areas_for_growth: string[]
  evidence_quotes: string[]
  feedback_student: string | null
  notes_teacher: string | null
  full_report: EvaluationReport | null
  reviewed_by_teacher: boolean
  teacher_override_level: number | null
  created_at: string
}

// ─── AI Response Types ────────────────────────────────────────────────────────

export interface EvaluationReport {
  level: number
  levelBand: string
  justification: string
  strengths: string[]
  areasForGrowth: string[]
  evidenceQuotes: string[]
  studentFeedback: string
  teacherNotes: string
}

// ─── Prompt Parameter Types ───────────────────────────────────────────────────

export interface AssessorPromptParams {
  studentName: string
  topic: string
  yearGroup: string
  teacherContext: string
  assessmentCriteria?: AssessmentCriterion[]
  questionNumber: number
  maxQuestions: number
  multimodalSummary?: string
  multimodalMode?: boolean
  multimodalEngineMode?: MultimodalEngineMode
  multimodalTaskTypes?: MultimodalTaskType[]
  customInstructions?: string
}

export interface EvaluationPromptParams {
  yearGroup: string
  topic: string
  transcript: string
}
