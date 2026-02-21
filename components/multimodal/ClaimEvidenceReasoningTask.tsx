'use client'

import { useState } from 'react'
import type { TaskProps } from './task-types'

type EvidenceItem = { id: string; text: string; selected: boolean; rank: number | null }

export default function ClaimEvidenceReasoningTask({ title, prompt, config, onSubmit, onEvent, disabled }: TaskProps) {
  const claimOptions = Array.isArray((config as any)?.claims)
    ? (config as any).claims as string[]
    : []

  const evidencePool = Array.isArray((config as any)?.evidence_items)
    ? (config as any).evidence_items as string[]
    : []

  const [selectedClaim, setSelectedClaim] = useState<string>('')
  const [customClaim, setCustomClaim] = useState('')
  const [evidenceItems, setEvidenceItems] = useState<EvidenceItem[]>(
    evidencePool.map((text, i) => ({ id: `ev-${i}`, text, selected: false, rank: null }))
  )
  const [reasoning, setReasoning] = useState('')
  const [customEvidence, setCustomEvidence] = useState('')

  const effectiveClaim = selectedClaim || customClaim
  const selectedEvidence = evidenceItems.filter((e) => e.selected).sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99))

  function toggleEvidence(id: string) {
    setEvidenceItems((prev) => {
      const item = prev.find((e) => e.id === id)
      if (!item) return prev
      if (item.selected) {
        // Deselect: clear rank, renumber others
        const updated = prev.map((e) => e.id === id ? { ...e, selected: false, rank: null } : e)
        let rank = 1
        return updated.map((e) => e.selected ? { ...e, rank: rank++ } : e)
      } else {
        const maxRank = prev.filter((e) => e.selected).length + 1
        onEvent?.('evidence_select', { id, rank: maxRank })
        return prev.map((e) => e.id === id ? { ...e, selected: true, rank: maxRank } : e)
      }
    })
  }

  function addCustomEvidence() {
    if (!customEvidence.trim()) return
    const newItem: EvidenceItem = {
      id: `custom-${Date.now()}`,
      text: customEvidence.trim(),
      selected: true,
      rank: evidenceItems.filter((e) => e.selected).length + 1,
    }
    setEvidenceItems((prev) => [...prev, newItem])
    setCustomEvidence('')
    onEvent?.('custom_evidence_added', { text: newItem.text })
  }

  function handleSubmit() {
    const filled = [effectiveClaim, reasoning].filter((s) => s.trim().length > 5).length
    const evidenceCount = selectedEvidence.length + (customEvidence.trim() ? 1 : 0)
    const correctness = Math.min(1, (filled / 2) * 0.6 + Math.min(1, evidenceCount / 2) * 0.4)
    onEvent?.('task_submit', { claim: effectiveClaim, evidence_count: evidenceCount })
    onSubmit({
      claim: effectiveClaim,
      evidence: selectedEvidence.map((e) => ({ text: e.text, rank: e.rank })),
      reasoning,
      correctness,
    })
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold text-gray-900 text-sm">{title}</h3>
        <p className="text-xs text-gray-600 mt-1">{prompt}</p>
      </div>

      {/* Step 1: Claim */}
      <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 space-y-2">
        <p className="text-xs font-semibold text-blue-800">① State your claim</p>
        {claimOptions.length > 0 ? (
          <div className="space-y-1">
            {claimOptions.map((c, i) => (
              <button
                key={i}
                onClick={() => { setSelectedClaim(c); onEvent?.('claim_select', { claim: c }) }}
                disabled={disabled}
                className={`w-full text-left px-3 py-2 rounded-lg border text-sm transition-colors ${
                  selectedClaim === c
                    ? 'border-blue-500 bg-blue-600 text-white font-medium'
                    : 'border-blue-200 bg-white text-gray-800 hover:border-blue-400'
                }`}
              >
                {c}
              </button>
            ))}
            <div className="flex gap-2 mt-2">
              <input
                value={customClaim}
                onChange={(e) => { setCustomClaim(e.target.value); if (e.target.value) setSelectedClaim('') }}
                placeholder="Or write your own claim..."
                className="flex-1 px-3 py-2 text-sm rounded-lg border border-blue-300 bg-white"
                disabled={disabled}
              />
            </div>
          </div>
        ) : (
          <textarea
            value={customClaim}
            onChange={(e) => { setCustomClaim(e.target.value); onEvent?.('claim_draft', { value: e.target.value }) }}
            rows={2}
            placeholder="Write a scientific claim based on the data..."
            className="w-full px-3 py-2 text-sm rounded-lg border border-blue-300 bg-white resize-none"
            disabled={disabled}
          />
        )}
      </div>

      {/* Step 2: Evidence */}
      <div className="rounded-lg bg-green-50 border border-green-200 p-3 space-y-2">
        <p className="text-xs font-semibold text-green-800">② Select supporting evidence (click to add, ranked by importance)</p>
        {evidencePool.length > 0 ? (
          <div className="space-y-1">
            {evidenceItems.map((item) => (
              <button
                key={item.id}
                onClick={() => toggleEvidence(item.id)}
                disabled={disabled}
                className={`w-full text-left px-3 py-2 rounded-lg border text-sm transition-colors flex items-start gap-2 ${
                  item.selected
                    ? 'border-green-500 bg-green-600 text-white'
                    : 'border-green-200 bg-white text-gray-800 hover:border-green-400'
                }`}
              >
                <span className={`flex-shrink-0 w-5 h-5 rounded-full border text-[10px] font-bold flex items-center justify-center mt-0.5 ${
                  item.selected ? 'border-white bg-white text-green-700' : 'border-green-300 text-green-600'
                }`}>
                  {item.selected ? item.rank : '+'}
                </span>
                <span>{item.text}</span>
              </button>
            ))}
          </div>
        ) : null}
        <div className="flex gap-2">
          <input
            value={customEvidence}
            onChange={(e) => setCustomEvidence(e.target.value)}
            placeholder="Add evidence from the data..."
            className="flex-1 px-3 py-2 text-sm rounded-lg border border-green-300 bg-white"
            disabled={disabled}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomEvidence() } }}
          />
          <button
            onClick={addCustomEvidence}
            disabled={disabled || !customEvidence.trim()}
            className="px-3 py-2 rounded-lg bg-green-600 text-white text-sm hover:bg-green-500 disabled:opacity-50"
          >
            Add
          </button>
        </div>
      </div>

      {/* Step 3: Reasoning */}
      <div className="rounded-lg bg-purple-50 border border-purple-200 p-3 space-y-2">
        <p className="text-xs font-semibold text-purple-800">③ Explain your reasoning (link claim ↔ evidence)</p>
        <textarea
          value={reasoning}
          onChange={(e) => { setReasoning(e.target.value); onEvent?.('reasoning_draft', { value: e.target.value }) }}
          rows={3}
          placeholder="This evidence supports my claim because..."
          className="w-full px-3 py-2 text-sm rounded-lg border border-purple-300 bg-white resize-none"
          disabled={disabled}
        />
      </div>

      <button
        onClick={handleSubmit}
        disabled={disabled || !effectiveClaim.trim()}
        className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
      >
        Submit CER argument
      </button>
    </div>
  )
}
