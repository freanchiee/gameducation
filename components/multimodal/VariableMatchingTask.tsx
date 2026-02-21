'use client'

import { useState } from 'react'
import type { TaskProps } from './task-types'

type MatchPair = { left: string; right: string }

export default function VariableMatchingTask({ title, prompt, config, onSubmit, onEvent, disabled }: TaskProps) {
  const configPairs = Array.isArray((config as any)?.pairs) ? (config as any).pairs as MatchPair[] : []
  const defaultPairs: MatchPair[] = configPairs.length > 0
    ? configPairs
    : [
        { left: '', right: '' },
        { left: '', right: '' },
        { left: '', right: '' },
      ]

  const [pairs, setPairs] = useState<MatchPair[]>(defaultPairs)
  const [selections, setSelections] = useState<Record<number, number | null>>({})
  const [justification, setJustification] = useState('')

  const hasConfigPairs = configPairs.length > 0

  function updatePair(index: number, side: 'left' | 'right', value: string) {
    setPairs((prev) => prev.map((p, i) => (i === index ? { ...p, [side]: value } : p)))
  }

  function toggleSelection(leftIdx: number, rightIdx: number) {
    setSelections((prev) => {
      const current = prev[leftIdx]
      const next = current === rightIdx ? null : rightIdx
      onEvent?.('match_select', { left_idx: leftIdx, right_idx: next })
      return { ...prev, [leftIdx]: next }
    })
  }

  function handleSubmit() {
    const matchResult = pairs.map((p, i) => ({
      left: p.left,
      right: selections[i] !== null && selections[i] !== undefined ? pairs[selections[i] as number]?.right ?? '' : '',
      matched_index: selections[i] ?? null,
    }))
    const matched = matchResult.filter((m) => m.matched_index !== null).length
    onEvent?.('task_submit', { selections })
    onSubmit({
      pairs,
      selections,
      match_result: matchResult,
      justification,
      correctness: hasConfigPairs ? matched / Math.max(pairs.length, 1) : 0.5,
    })
  }

  if (!hasConfigPairs) {
    return (
      <div className="space-y-4">
        <div>
          <h3 className="font-semibold text-gray-900 text-sm">{title}</h3>
          <p className="text-xs text-gray-600 mt-1">{prompt}</p>
        </div>
        <div className="space-y-2">
          {pairs.map((pair, i) => (
            <div key={i} className="grid grid-cols-2 gap-2">
              <input
                value={pair.left}
                onChange={(e) => updatePair(i, 'left', e.target.value)}
                placeholder={`Left item ${i + 1}`}
                className="px-3 py-2 text-sm rounded-lg border border-gray-300 bg-white"
                disabled={disabled}
              />
              <input
                value={pair.right}
                onChange={(e) => updatePair(i, 'right', e.target.value)}
                placeholder={`Match for ${i + 1}`}
                className="px-3 py-2 text-sm rounded-lg border border-gray-300 bg-white"
                disabled={disabled}
              />
            </div>
          ))}
          <button
            onClick={() => setPairs((prev) => [...prev, { left: '', right: '' }])}
            className="text-xs text-blue-600 hover:underline"
            disabled={disabled}
          >
            + Add pair
          </button>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Explain your matches</label>
          <textarea
            value={justification}
            onChange={(e) => setJustification(e.target.value)}
            rows={2}
            placeholder="Why did you match these items together?"
            className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 bg-white resize-none"
            disabled={disabled}
          />
        </div>
        <button
          onClick={handleSubmit}
          disabled={disabled || pairs.every((p) => !p.left.trim())}
          className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
        >
          Submit matches
        </button>
      </div>
    )
  }

  // Interactive matching UI when config provides items
  const leftItems = pairs.map((p, i) => ({ id: i, label: p.left }))
  const rightItems = pairs.map((p, i) => ({ id: i, label: p.right }))

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold text-gray-900 text-sm">{title}</h3>
        <p className="text-xs text-gray-600 mt-1">{prompt}</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Statements</p>
          {leftItems.map((item) => (
            <div
              key={item.id}
              className={`rounded-lg border p-3 text-sm cursor-pointer transition-colors ${
                selections[item.id] !== undefined && selections[item.id] !== null
                  ? 'border-blue-400 bg-blue-50 text-blue-800'
                  : 'border-gray-300 bg-white text-gray-800 hover:border-blue-300'
              }`}
            >
              {item.label}
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Variable Roles</p>
          {rightItems.map((item) => (
            <div key={item.id} className="space-y-1">
              {leftItems.map((leftItem) => (
                <button
                  key={leftItem.id}
                  onClick={() => toggleSelection(leftItem.id, item.id)}
                  disabled={disabled}
                  className={`w-full rounded-lg border p-3 text-sm text-left transition-colors ${
                    selections[leftItem.id] === item.id
                      ? 'border-green-400 bg-green-50 text-green-800 font-medium'
                      : 'border-gray-300 bg-white text-gray-700 hover:border-blue-300'
                  }`}
                >
                  {selections[leftItem.id] === item.id ? `✓ ${item.label}` : item.label}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Explain your reasoning</label>
        <textarea
          value={justification}
          onChange={(e) => {
            setJustification(e.target.value)
            onEvent?.('justification_draft', { value: e.target.value })
          }}
          rows={2}
          placeholder="Why did you match items this way?"
          className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 bg-white resize-none"
          disabled={disabled}
        />
      </div>

      <button
        onClick={handleSubmit}
        disabled={disabled}
        className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
      >
        Submit matches
      </button>
    </div>
  )
}
