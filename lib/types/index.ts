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

// ─── Multimodal Resources ─────────────────────────────────────────────────────
export type ResourceType = 'geogebra' | 'phet' | 'youtube' | 'embed' | 'url'

export interface EmbedResource {
  id: string            // client-side UUID for list management
  type: ResourceType
  title: string
  originalUrl?: string  // URL the teacher typed (GeoGebra/PhET/YouTube)
  embedUrl?: string     // normalized iframe src
  embedHtml?: string    // raw HTML for 'embed' type (teacher-pasted code)
}

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
  resources: EmbedResource[]             // multimodal resources shown to student
  status: AssessmentStatus
  access_code: string                    // 6-char uppercase
  created_at: string
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
  questionNumber: number
  maxQuestions: number
  customInstructions?: string
}

export interface EvaluationPromptParams {
  yearGroup: string
  topic: string
  transcript: string
}
