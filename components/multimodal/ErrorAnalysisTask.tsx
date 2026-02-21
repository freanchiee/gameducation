'use client'

import { useState } from 'react'
import type { TaskProps } from './task-types'

type DataRow = Record<string, string>
type ErrorFlag = { rowIndex: number; column: string; errorType: 'random' | 'systematic' | 'methodological' | ''; correction: string }

export default function ErrorAnalysisTask({ title, prompt, config, onSubmit, onEvent, disabled }: TaskProps) {
  const tableHeaders = Array.isArray((config as any)?.headers)
    ? (config as any).headers as string[]
    : ['Trial', 'IV Value', 'DV Value', 'Notes']

  const tableData = Array.isArray((config as any)?.data)
    ? (config as any).data as DataRow[]
    : [
        { Trial: '1', 'IV Value': '10', 'DV Value': '25.3', Notes: '' },
        { Trial: '2', 'IV Value': '20', 'DV Value': '48.9', Notes: '' },
        { Trial: '3', 'IV Value': '30', 'DV Value': '31.2', Notes: 'Anomaly?' },
        { Trial: '4', 'IV Value': '40', 'DV Value': '75.1', Notes: '' },
        { Trial: '5', 'IV Value': '50', 'DV Value': '98.4', Notes: '' },
      ]

  const methodSteps = Array.isArray((config as any)?.method_steps)
    ? (config as any).method_steps as string[]
    : []

  const [flaggedRows, setFlaggedRows] = useState<Set<number>>(new Set())
  const [errorFlags, setErrorFlags] = useState<ErrorFlag[]>([])
  const [flaggedMethodSteps, setFlaggedMethodSteps] = useState<Set<number>>(new Set())
  const [methodErrors, setMethodErrors] = useState<Record<number, string>>({})
  const [generalNotes, setGeneralNotes] = useState('')

  function toggleRowFlag(rowIndex: number) {
    setFlaggedRows((prev) => {
      const next = new Set(prev)
      if (next.has(rowIndex)) {
        next.delete(rowIndex)
        setErrorFlags((flags) => flags.filter((f) => f.rowIndex !== rowIndex))
      } else {
        next.add(rowIndex)
        setErrorFlags((flags) => [...flags, { rowIndex, column: '', errorType: '', correction: '' }])
      }
      onEvent?.('row_flagged', { rowIndex, flagged: !prev.has(rowIndex) })
      return next
    })
  }

  function updateFlag(rowIndex: number, field: keyof ErrorFlag, value: string) {
    setErrorFlags((prev) =>
      prev.map((f) => (f.rowIndex === rowIndex ? { ...f, [field]: value } : f))
    )
  }

  function toggleMethodFlag(stepIndex: number) {
    setFlaggedMethodSteps((prev) => {
      const next = new Set(prev)
      if (next.has(stepIndex)) { next.delete(stepIndex) } else { next.add(stepIndex) }
      onEvent?.('method_step_flagged', { stepIndex, flagged: !prev.has(stepIndex) })
      return next
    })
  }

  function handleSubmit() {
    const dataErrors = errorFlags.filter((f) => flaggedRows.has(f.rowIndex))
    const methodErrorsList = Array.from(flaggedMethodSteps).map((i) => ({ stepIndex: i, note: methodErrors[i] ?? '' }))
    const totalErrors = dataErrors.length + methodErrorsList.length
    onEvent?.('task_submit', { error_count: totalErrors })
    onSubmit({
      flagged_data_rows: dataErrors,
      flagged_method_steps: methodErrorsList,
      general_notes: generalNotes,
      error_count: totalErrors,
      correctness: Math.min(1, totalErrors > 0 ? 0.5 + totalErrors * 0.15 : 0.2),
    })
  }

  const flagForRow = (i: number) => errorFlags.find((f) => f.rowIndex === i)

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold text-gray-900 text-sm">{title}</h3>
        <p className="text-xs text-gray-600 mt-1">{prompt}</p>
      </div>

      {/* Data table */}
      <div>
        <p className="text-xs font-semibold text-gray-700 mb-1">Click rows to flag errors in the data:</p>
        <div className="overflow-x-auto rounded-lg border border-gray-300">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="px-2 py-2 text-[11px] font-medium text-gray-500 border-b border-gray-300 w-8">⚑</th>
                {tableHeaders.map((h) => (
                  <th key={h} className="px-3 py-2 text-left text-[11px] font-medium text-gray-600 border-b border-gray-300">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableData.map((row, i) => (
                <>
                  <tr
                    key={i}
                    onClick={() => !disabled && toggleRowFlag(i)}
                    className={`cursor-pointer border-b border-gray-200 transition-colors ${
                      flaggedRows.has(i) ? 'bg-red-50 border-red-200' : 'hover:bg-gray-50'
                    }`}
                  >
                    <td className="px-2 py-2 text-center">
                      <span className={`text-sm ${flaggedRows.has(i) ? 'text-red-500' : 'text-gray-300'}`}>⚑</span>
                    </td>
                    {tableHeaders.map((h) => (
                      <td key={h} className={`px-3 py-2 text-sm ${flaggedRows.has(i) ? 'text-red-700' : 'text-gray-800'}`}>
                        {row[h] ?? '–'}
                      </td>
                    ))}
                  </tr>
                  {flaggedRows.has(i) && (
                    <tr key={`flag-${i}`} className="bg-red-50 border-b border-red-200">
                      <td colSpan={tableHeaders.length + 1} className="px-3 py-2">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[11px] text-red-700 font-medium">Error type</label>
                            <select
                              value={flagForRow(i)?.errorType ?? ''}
                              onChange={(e) => updateFlag(i, 'errorType', e.target.value)}
                              className="mt-1 w-full px-2 py-1 text-xs rounded border border-red-300 bg-white"
                              disabled={disabled}
                            >
                              <option value="">Select type...</option>
                              <option value="random">Random error</option>
                              <option value="systematic">Systematic error</option>
                              <option value="methodological">Methodological error</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-[11px] text-red-700 font-medium">Correction / explanation</label>
                            <input
                              value={flagForRow(i)?.correction ?? ''}
                              onChange={(e) => updateFlag(i, 'correction', e.target.value)}
                              placeholder="How would you fix this?"
                              className="mt-1 w-full px-2 py-1 text-xs rounded border border-red-300 bg-white"
                              disabled={disabled}
                            />
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Method steps */}
      {methodSteps.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-700 mb-1">Flag errors in the method steps:</p>
          <ol className="space-y-1">
            {methodSteps.map((step, i) => (
              <li key={i} className="flex items-start gap-2">
                <button
                  onClick={() => !disabled && toggleMethodFlag(i)}
                  className={`flex-shrink-0 mt-0.5 w-5 h-5 rounded border text-[10px] font-bold transition-colors ${
                    flaggedMethodSteps.has(i)
                      ? 'bg-red-500 border-red-500 text-white'
                      : 'border-gray-300 text-gray-400 hover:border-red-400'
                  }`}
                >
                  {i + 1}
                </button>
                <span className={`text-sm ${flaggedMethodSteps.has(i) ? 'text-red-700 line-through' : 'text-gray-800'}`}>{step}</span>
                {flaggedMethodSteps.has(i) && (
                  <input
                    value={methodErrors[i] ?? ''}
                    onChange={(e) => setMethodErrors((prev) => ({ ...prev, [i]: e.target.value }))}
                    placeholder="What's wrong?"
                    className="flex-1 px-2 py-1 text-xs rounded border border-red-300 bg-white"
                    disabled={disabled}
                  />
                )}
              </li>
            ))}
          </ol>
        </div>
      )}

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">General evaluation notes</label>
        <textarea
          value={generalNotes}
          onChange={(e) => { setGeneralNotes(e.target.value); onEvent?.('notes_draft', { value: e.target.value }) }}
          rows={2}
          placeholder="Describe the overall impact of these errors on the results..."
          className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 bg-white resize-none"
          disabled={disabled}
        />
      </div>

      <button
        onClick={handleSubmit}
        disabled={disabled}
        className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
      >
        Submit error analysis
      </button>
    </div>
  )
}
