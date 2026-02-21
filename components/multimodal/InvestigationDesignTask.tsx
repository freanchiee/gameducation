'use client'

import { useState } from 'react'
import type { TaskProps } from './task-types'

type Step = { id: string; text: string; rationale: string }

const DEFAULT_STEPS: Step[] = [
  { id: 'step-0', text: '', rationale: '' },
  { id: 'step-1', text: '', rationale: '' },
  { id: 'step-2', text: '', rationale: '' },
  { id: 'step-3', text: '', rationale: '' },
]

export default function InvestigationDesignTask({ title, prompt, config, onSubmit, onEvent, disabled }: TaskProps) {
  const configSteps = Array.isArray((config as any)?.steps)
    ? (config as any).steps as string[]
    : []

  const initialSteps: Step[] = configSteps.length > 0
    ? configSteps.map((text, i) => ({ id: `step-${i}`, text, rationale: '' }))
    : DEFAULT_STEPS

  const [steps, setSteps] = useState<Step[]>(initialSteps)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [overIndex, setOverIndex] = useState<number | null>(null)
  const [hypothesis, setHypothesis] = useState('')
  const [safetyConsiderations, setSafetyConsiderations] = useState('')

  const hasConfigSteps = configSteps.length > 0

  function updateStep(id: string, field: 'text' | 'rationale', value: string) {
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)))
    onEvent?.('step_update', { id, field, value })
  }

  function handleDragStart(i: number) { setDragIndex(i) }
  function handleDragOver(e: React.DragEvent, i: number) { e.preventDefault(); setOverIndex(i) }

  function handleDrop(targetIndex: number) {
    if (dragIndex === null || dragIndex === targetIndex) { setDragIndex(null); setOverIndex(null); return }
    setSteps((prev) => {
      const next = [...prev]
      const [moved] = next.splice(dragIndex, 1)
      next.splice(targetIndex, 0, moved)
      onEvent?.('step_reorder', { from: dragIndex, to: targetIndex })
      return next
    })
    setDragIndex(null)
    setOverIndex(null)
  }

  function addStep() {
    setSteps((prev) => [...prev, { id: `step-${Date.now()}`, text: '', rationale: '' }])
  }

  function removeStep(id: string) {
    if (steps.length <= 2) return
    setSteps((prev) => prev.filter((s) => s.id !== id))
  }

  function handleSubmit() {
    const filledSteps = steps.filter((s) => s.text.trim().length > 0)
    const correctness = Math.min(1, filledSteps.length / Math.max(steps.length, 1))
    onEvent?.('task_submit', { step_count: filledSteps.length })
    onSubmit({
      hypothesis,
      steps: steps.map((s, i) => ({ order: i + 1, text: s.text, rationale: s.rationale })),
      safety_considerations: safetyConsiderations,
      correctness,
    })
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold text-gray-900 text-sm">{title}</h3>
        <p className="text-xs text-gray-600 mt-1">{prompt}</p>
      </div>

      {/* Hypothesis */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Hypothesis (If… then… because…)</label>
        <textarea
          value={hypothesis}
          onChange={(e) => { setHypothesis(e.target.value); onEvent?.('hypothesis_draft', { value: e.target.value }) }}
          rows={2}
          placeholder="If I change the IV, then the DV will... because..."
          className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 bg-white resize-none"
          disabled={disabled}
        />
      </div>

      {/* Step ordering */}
      <div>
        <p className="text-xs font-semibold text-gray-700 mb-2">
          {hasConfigSteps ? 'Drag steps into the correct order and justify each:' : 'Write and order your experimental steps:'}
        </p>
        <div className="space-y-2">
          {steps.map((step, i) => (
            <div
              key={step.id}
              draggable={hasConfigSteps}
              onDragStart={() => handleDragStart(i)}
              onDragOver={(e) => handleDragOver(e, i)}
              onDrop={() => handleDrop(i)}
              onDragEnd={() => { setDragIndex(null); setOverIndex(null) }}
              className={`rounded-lg border p-3 bg-white transition-all ${
                dragIndex === i ? 'opacity-50 border-dashed border-blue-400' :
                overIndex === i && dragIndex !== null ? 'border-blue-400 border-2 bg-blue-50' :
                'border-gray-300'
              } ${hasConfigSteps ? 'cursor-grab' : ''}`}
            >
              <div className="flex items-start gap-2">
                <div className="flex-shrink-0 flex items-center gap-1.5">
                  {hasConfigSteps && (
                    <span className="text-gray-300 text-xs select-none">⠿</span>
                  )}
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold">
                    {i + 1}
                  </span>
                </div>
                <div className="flex-1 space-y-1.5">
                  {hasConfigSteps ? (
                    <p className="text-sm text-gray-800">{step.text}</p>
                  ) : (
                    <input
                      value={step.text}
                      onChange={(e) => updateStep(step.id, 'text', e.target.value)}
                      placeholder={`Step ${i + 1}...`}
                      className="w-full px-2 py-1.5 text-sm rounded border border-gray-300 bg-gray-50"
                      disabled={disabled}
                    />
                  )}
                  <input
                    value={step.rationale}
                    onChange={(e) => updateStep(step.id, 'rationale', e.target.value)}
                    placeholder="Why is this step important? (justification)"
                    className="w-full px-2 py-1.5 text-xs rounded border border-gray-200 bg-gray-50 text-gray-600"
                    disabled={disabled}
                  />
                </div>
                {!hasConfigSteps && (
                  <button
                    onClick={() => removeStep(step.id)}
                    disabled={disabled || steps.length <= 2}
                    className="text-gray-300 hover:text-red-500 text-sm flex-shrink-0 disabled:opacity-20"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
        {!hasConfigSteps && (
          <button onClick={addStep} disabled={disabled} className="mt-2 text-xs text-blue-600 hover:underline disabled:opacity-50">
            + Add step
          </button>
        )}
      </div>

      {/* Safety */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Safety considerations</label>
        <input
          value={safetyConsiderations}
          onChange={(e) => setSafetyConsiderations(e.target.value)}
          placeholder="List any safety precautions needed..."
          className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 bg-white"
          disabled={disabled}
        />
      </div>

      <button
        onClick={handleSubmit}
        disabled={disabled || steps.every((s) => !s.text.trim())}
        className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
      >
        Submit investigation design
      </button>
    </div>
  )
}
