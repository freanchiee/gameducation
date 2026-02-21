'use client'

import type { TaskSubmission } from './task-types'
import VariableSorterTask from './VariableSorterTask'
import VariableMatchingTask from './VariableMatchingTask'
import SimulationDataTask from './SimulationDataTask'
import GraphInterpretationTask from './GraphInterpretationTask'
import ClaimEvidenceReasoningTask from './ClaimEvidenceReasoningTask'
import ErrorAnalysisTask from './ErrorAnalysisTask'
import InvestigationDesignTask from './InvestigationDesignTask'
import ReflectionEvaluationTask from './ReflectionEvaluationTask'

export type CanonicalTaskType =
  | 'variable_sorter'
  | 'variable_matching'
  | 'simulation_data_collection'
  | 'graph_interpretation'
  | 'claim_evidence_reasoning'
  | 'error_analysis'
  | 'investigation_design'
  | 'reflection_evaluation'
  // legacy UI aliases from existing session page
  | 'iv_dv_cv_sort'
  | 'matching'
  | 'table_completion'
  | 'simulation_probe'
  | 'graph_analysis'
  | 'fill_blank'
  | 'short_answer'
  | 'extended_response'

export interface TaskPlayerProps {
  taskType: CanonicalTaskType | string
  title: string
  prompt: string
  config?: Record<string, unknown>
  onSubmit: (submission: TaskSubmission) => void
  onEvent?: (eventType: string, eventData: Record<string, unknown>) => void
  disabled?: boolean
  /** Loading skeleton while next task is being fetched */
  loading?: boolean
}

function resolveTaskType(taskType: string): CanonicalTaskType {
  const map: Record<string, CanonicalTaskType> = {
    iv_dv_cv_sort: 'variable_sorter',
    matching: 'variable_matching',
    table_completion: 'simulation_data_collection',
    simulation_probe: 'simulation_data_collection',
    graph_analysis: 'graph_interpretation',
    fill_blank: 'error_analysis',
    short_answer: 'claim_evidence_reasoning',
    extended_response: 'investigation_design',
  }
  return (map[taskType] ?? taskType) as CanonicalTaskType
}

export default function TaskPlayer({
  taskType,
  title,
  prompt,
  config,
  onSubmit,
  onEvent,
  disabled,
  loading,
}: TaskPlayerProps) {
  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-5 bg-gray-200 rounded w-3/4" />
        <div className="h-3 bg-gray-200 rounded w-full" />
        <div className="h-3 bg-gray-200 rounded w-5/6" />
        <div className="h-28 bg-gray-100 rounded-xl" />
        <div className="h-10 bg-gray-200 rounded-lg" />
      </div>
    )
  }

  const canonical = resolveTaskType(taskType)
  const sharedProps = { title, prompt, config, onSubmit, onEvent, disabled }

  switch (canonical) {
    case 'variable_sorter':
      return <VariableSorterTask {...sharedProps} />

    case 'variable_matching':
      return <VariableMatchingTask {...sharedProps} />

    case 'simulation_data_collection':
      return <SimulationDataTask {...sharedProps} />

    case 'graph_interpretation':
      return <GraphInterpretationTask {...sharedProps} />

    case 'claim_evidence_reasoning':
      return <ClaimEvidenceReasoningTask {...sharedProps} />

    case 'error_analysis':
      return <ErrorAnalysisTask {...sharedProps} />

    case 'investigation_design':
      return <InvestigationDesignTask {...sharedProps} />

    case 'reflection_evaluation':
      return <ReflectionEvaluationTask {...sharedProps} />

    default:
      // Fallback: generic short-answer
      return (
        <div className="space-y-3">
          <div>
            <h3 className="font-semibold text-gray-900 text-sm">{title}</h3>
            <p className="text-xs text-gray-600 mt-1">{prompt}</p>
          </div>
          <textarea
            rows={4}
            placeholder="Type your response here..."
            className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 bg-white resize-none"
            disabled={disabled}
            onChange={(e) => onEvent?.('response_draft', { value: e.target.value })}
            onBlur={(e) => {
              if (e.target.value.trim()) {
                onSubmit({ response: e.target.value.trim(), correctness: 0.5 })
              }
            }}
          />
          <button
            onClick={(e) => {
              const ta = (e.currentTarget.previousSibling as HTMLTextAreaElement)
              if (ta?.value?.trim()) onSubmit({ response: ta.value.trim(), correctness: 0.5 })
            }}
            disabled={disabled}
            className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
          >
            Submit response
          </button>
        </div>
      )
  }
}
