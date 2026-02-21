'use client'

import { useState } from 'react'
import type { TaskProps } from './task-types'

export default function GraphInterpretationTask({ title, prompt, config, onSubmit, onEvent, disabled }: TaskProps) {
  const graphUrl = (config as any)?.graph_url as string | null ?? null
  const graphAlt = (config as any)?.graph_alt as string ?? 'Assessment graph'
  const questions = Array.isArray((config as any)?.questions)
    ? (config as any).questions as string[]
    : [
        'Describe the overall trend shown in the graph.',
        'Identify any anomalies or unexpected data points.',
        'State one scientific conclusion supported by the data.',
      ]

  const [answers, setAnswers] = useState<string[]>(questions.map(() => ''))
  const [zoomed, setZoomed] = useState(false)

  function updateAnswer(i: number, value: string) {
    setAnswers((prev) => prev.map((a, idx) => (idx === i ? value : a)))
    onEvent?.('answer_draft', { question_index: i, value })
  }

  function handleSubmit() {
    const filled = answers.filter((a) => a.trim().length > 0).length
    onEvent?.('task_submit', { filled_count: filled })
    onSubmit({
      answers: questions.map((q, i) => ({ question: q, answer: answers[i] })),
      correctness: filled / Math.max(questions.length, 1),
    })
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold text-gray-900 text-sm">{title}</h3>
        <p className="text-xs text-gray-600 mt-1">{prompt}</p>
      </div>

      {/* Graph display */}
      {graphUrl ? (
        <div className="space-y-1">
          <div
            className={`relative rounded-xl overflow-hidden border border-gray-200 cursor-zoom-in ${zoomed ? 'fixed inset-4 z-50 bg-white flex items-center justify-center cursor-zoom-out' : ''}`}
            onClick={() => setZoomed((z) => !z)}
          >
            <img
              src={graphUrl}
              alt={graphAlt}
              className={`w-full object-contain ${zoomed ? 'max-h-[90vh]' : 'max-h-[220px]'}`}
            />
            {zoomed && (
              <button
                onClick={(e) => { e.stopPropagation(); setZoomed(false) }}
                className="absolute top-3 right-3 bg-black/60 text-white rounded-full px-3 py-1 text-xs"
              >
                Close ×
              </button>
            )}
          </div>
          <p className="text-[11px] text-gray-400 text-center">Click to zoom</p>
        </div>
      ) : (
        <div className="rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 p-6 text-center">
          <p className="text-sm text-gray-500">Graph will be displayed here during the assessment.</p>
          <p className="text-xs text-gray-400 mt-1">Your teacher has configured a graph for this task.</p>
        </div>
      )}

      {/* Answer questions */}
      <div className="space-y-3">
        {questions.map((question, i) => (
          <div key={i}>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold mr-1.5">{i + 1}</span>
              {question}
            </label>
            <textarea
              value={answers[i]}
              onChange={(e) => updateAnswer(i, e.target.value)}
              rows={2}
              placeholder="Your answer..."
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 bg-white resize-none"
              disabled={disabled}
            />
          </div>
        ))}
      </div>

      <button
        onClick={handleSubmit}
        disabled={disabled || answers.every((a) => !a.trim())}
        className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
      >
        Submit graph analysis
      </button>
    </div>
  )
}
