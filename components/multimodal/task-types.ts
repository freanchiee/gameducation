export type TaskSubmission = Record<string, unknown>

export interface TaskProps {
  title: string
  prompt: string
  config?: Record<string, unknown>
  onSubmit: (submission: TaskSubmission) => void
  onEvent?: (eventType: string, eventData: Record<string, unknown>) => void
  disabled?: boolean
}
