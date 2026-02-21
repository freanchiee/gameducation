'use client'

import { useState, useRef } from 'react'
import type { TaskProps } from './task-types'

type VarRole = 'IV' | 'DV' | 'CV' | ''

type VarItem = {
  id: string
  name: string
  role: VarRole
}

const ZONES: { role: VarRole; label: string; description: string; color: string }[] = [
  { role: 'IV', label: 'Independent Variable', description: 'The variable you deliberately change', color: 'bg-blue-50 border-blue-300' },
  { role: 'DV', label: 'Dependent Variable', description: 'The variable you measure', color: 'bg-green-50 border-green-300' },
  { role: 'CV', label: 'Controlled Variables', description: 'Variables you keep the same', color: 'bg-amber-50 border-amber-300' },
]

export default function VariableSorterTask({ title, prompt, config, onSubmit, onEvent, disabled }: TaskProps) {
  const configVars = Array.isArray((config as any)?.variables) ? (config as any).variables as string[] : []
  const defaultVars: VarItem[] = configVars.length > 0
    ? configVars.map((name: string, i: number) => ({ id: `var-${i}`, name, role: '' as VarRole }))
    : [
        { id: 'var-0', name: '', role: '' },
        { id: 'var-1', name: '', role: '' },
        { id: 'var-2', name: '', role: '' },
      ]

  const [vars, setVars] = useState<VarItem[]>(defaultVars)
  const [dragId, setDragId] = useState<string | null>(null)
  const [justification, setJustification] = useState('')

  const hasConfigVars = configVars.length > 0

  function updateRole(id: string, role: VarRole) {
    setVars((prev) => prev.map((v) => (v.id === id ? { ...v, role } : v)))
    onEvent?.('variable_role_set', { var_id: id, role })
  }

  function updateName(id: string, name: string) {
    setVars((prev) => prev.map((v) => (v.id === id ? { ...v, name } : v)))
  }

  function handleDragStart(id: string) {
    setDragId(id)
  }

  function handleDropOnZone(role: VarRole) {
    if (!dragId) return
    updateRole(dragId, role)
    setDragId(null)
  }

  function handleSubmit() {
    const sorted: Record<VarRole, string[]> = { IV: [], DV: [], CV: [], '': [] }
    for (const v of vars) {
      if (v.name.trim()) sorted[v.role].push(v.name.trim())
    }
    onEvent?.('task_submit', { vars })
    onSubmit({
      variables: vars,
      sorted_roles: { IV: sorted.IV, DV: sorted.DV, CV: sorted.CV },
      justification,
      correctness: computeCorrectness(),
    })
  }

  function computeCorrectness() {
    const filled = vars.filter((v) => v.name.trim() && v.role !== '')
    return filled.length / Math.max(vars.length, 1)
  }

  const zoneVars = (role: VarRole) => vars.filter((v) => v.role === role)
  const unsortedVars = vars.filter((v) => v.role === '')

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold text-gray-900 text-sm">{title}</h3>
        <p className="text-xs text-gray-600 mt-1">{prompt}</p>
      </div>

      {!hasConfigVars && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-700">Enter the variables from your experiment:</p>
          {vars.map((v, i) => (
            <input
              key={v.id}
              value={v.name}
              onChange={(e) => updateName(v.id, e.target.value)}
              placeholder={`Variable ${i + 1}`}
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 bg-white"
              disabled={disabled}
            />
          ))}
          <button
            onClick={() => setVars((prev) => [...prev, { id: `var-${prev.length}`, name: '', role: '' }])}
            className="text-xs text-blue-600 hover:underline"
            disabled={disabled}
          >
            + Add variable
          </button>
        </div>
      )}

      {/* Unsorted pool */}
      {hasConfigVars && unsortedVars.length > 0 && (
        <div className="rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-3">
          <p className="text-[11px] font-medium text-gray-500 mb-2 uppercase tracking-wide">Variables to sort</p>
          <div className="flex flex-wrap gap-2">
            {unsortedVars.map((v) => (
              <div
                key={v.id}
                draggable
                onDragStart={() => handleDragStart(v.id)}
                className="px-3 py-1.5 rounded-full border border-gray-300 bg-white text-sm text-gray-800 cursor-grab shadow-sm"
              >
                {v.name}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Drop zones */}
      <div className="grid grid-cols-1 gap-3">
        {ZONES.map(({ role, label, description, color }) => (
          <div
            key={role}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDropOnZone(role)}
            className={`rounded-lg border-2 p-3 min-h-[72px] transition-colors ${color} ${dragId ? 'border-dashed opacity-90' : ''}`}
          >
            <p className="text-xs font-semibold text-gray-700">{label}</p>
            <p className="text-[11px] text-gray-500 mb-2">{description}</p>
            {hasConfigVars ? (
              <div className="flex flex-wrap gap-2">
                {zoneVars(role).map((v) => (
                  <div
                    key={v.id}
                    draggable
                    onDragStart={() => handleDragStart(v.id)}
                    className="px-3 py-1 rounded-full bg-white border border-gray-300 text-sm text-gray-800 cursor-grab shadow-sm"
                  >
                    {v.name}
                    <button
                      className="ml-2 text-gray-400 hover:text-red-500"
                      onClick={() => updateRole(v.id, '')}
                      disabled={disabled}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <select
                value={vars.find((v) => v.role === role)?.id ?? ''}
                onChange={(e) => {
                  const prev = vars.find((v) => v.role === role)
                  if (prev) updateRole(prev.id, '')
                  if (e.target.value) updateRole(e.target.value, role)
                }}
                className="text-xs rounded border border-gray-300 bg-white px-2 py-1"
                disabled={disabled}
              >
                <option value="">-- Select variable --</option>
                {vars.filter((v) => v.role === '' || v.role === role).map((v) => (
                  <option key={v.id} value={v.id}>{v.name || `Variable ${vars.indexOf(v) + 1}`}</option>
                ))}
              </select>
            )}
          </div>
        ))}
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Justify your classifications</label>
        <textarea
          value={justification}
          onChange={(e) => {
            setJustification(e.target.value)
            onEvent?.('justification_draft', { value: e.target.value })
          }}
          rows={2}
          placeholder="Explain why you classified each variable this way..."
          className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 bg-white resize-none"
          disabled={disabled}
        />
      </div>

      <button
        onClick={handleSubmit}
        disabled={disabled || vars.every((v) => v.role === '' && !v.name.trim())}
        className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Submit variable sort
      </button>
    </div>
  )
}
