'use client'

import { useState } from 'react'
import type { TaskProps } from './task-types'

const DEFAULT_PROMPTS = [
  { label: 'Reliability', hint: 'How reliable was your data? Did you repeat measurements?', placeholder: 'My results were reliable / unreliable because...' },
  { label: 'Limitations', hint: 'What were the main limitations of the method or equipment?', placeholder: 'The main limitations were...' },
  { label: 'Improvement', hint: 'Suggest one specific improvement and explain how it would improve your data.', placeholder: 'I would improve the investigation by...' },
]

export default function ReflectionEvaluationTask({ title, prompt, config, onSubmit, onEvent, disabled }: TaskProps) {
  const configPrompts = Array.isArray((config as any)?.prompts)
    ? (config as any).prompts as Array<{ label: string; hint: string; placeholder: string }>
    : DEFAULT_PROMPTS

  const [responses, setResponses] = useState<string[]>(configPrompts.map(() => ''))
  const [overallRating, setOverallRating] = useState<number | null>(null)

  function updateResponse(i: number, value: string) {
    setResponses((prev) => prev.map((r, idx) => (idx === i ? value : r)))
    onEvent?.('response_draft', { prompt_index: i, value })
  }

  function handleSubmit() {
    const filled = responses.filter((r) => r.trim().length > 5).length
    onEvent?.('task_submit', { filled_count: filled, rating: overallRating })
    onSubmit({
      reflections: configPrompts.map((p, i) => ({ label: p.label, response: responses[i] })),
      overall_rating: overallRating,
      correctness: filled / Math.max(configPrompts.length, 1),
    })
  }

  const wordCount = responses.join(' ').trim().split(/\s+/).filter(Boolean).length

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold text-gray-900 text-sm">{title}</h3>
        <p className="text-xs text-gray-600 mt-1">{prompt}</p>
      </div>

      <div className="space-y-4">
        {configPrompts.map((p, i) => (
          <div key={i} className="rounded-lg bg-gray-50 border border-gray-200 p-3 space-y-2">
            <div className="flex items-start gap-2">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-[11px] font-bold flex-shrink-0 mt-0.5">
                {i + 1}
              </span>
              <div>
                <p className="text-xs font-semibold text-gray-800">{p.label}</p>
                <p className="text-[11px] text-gray-500 mt-0.5">{p.hint}</p>
              </div>
            </div>
            <textarea
              value={responses[i]}
              onChange={(e) => updateResponse(i, e.target.value)}
              rows={3}
              placeholder={p.placeholder}
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 bg-white resize-none"
              disabled={disabled}
            />
          </div>
        ))}
      </div>

      {/* Self-rating */}
      <div>
        <p className="text-xs font-medium text-gray-700 mb-2">How confident do you feel about your investigation? (1 = not confident, 5 = very confident)</p>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              onClick={() => {
                setOverallRating(n)
                onEvent?.('confidence_rating', { rating: n })
              }}
              disabled={disabled}
              className={`w-10 h-10 rounded-full border-2 text-sm font-bold transition-colors ${
                overallRating === n
                  ? 'border-indigo-500 bg-indigo-600 text-white'
                  : 'border-gray-300 bg-white text-gray-600 hover:border-indigo-300'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-[11px] text-gray-400">{wordCount} words</span>
        <button
          onClick={handleSubmit}
          disabled={disabled || responses.every((r) => !r.trim())}
          className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
        >
          Submit reflection
        </button>
      </div>
    </div>
  )
}
