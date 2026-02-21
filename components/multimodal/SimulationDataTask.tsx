'use client'

import { useState } from 'react'
import type { TaskProps } from './task-types'

type DataRow = { iv: string; dv: string; notes: string }

function buildLinePath(points: Array<{ x: number; y: number }>) {
  if (points.length === 0) return ''
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
}

export default function SimulationDataTask({ title, prompt, config, onSubmit, onEvent, disabled }: TaskProps) {
  const simulationUrl = (config as any)?.simulation_url as string | null ?? null
  const ivLabel = (config as any)?.iv_label as string ?? 'Independent Variable'
  const dvLabel = (config as any)?.dv_label as string ?? 'Dependent Variable'
  const minRows = Number((config as any)?.min_rows ?? 5)

  const [rows, setRows] = useState<DataRow[]>([
    { iv: '', dv: '', notes: '' },
    { iv: '', dv: '', notes: '' },
    { iv: '', dv: '', notes: '' },
    { iv: '', dv: '', notes: '' },
    { iv: '', dv: '', notes: '' },
  ])
  const [trend, setTrend] = useState('')
  const [conclusion, setConclusion] = useState('')

  function updateRow(index: number, field: keyof DataRow, value: string) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)))
    onEvent?.('data_entry', { row: index, field, value })
  }

  function addRow() {
    setRows((prev) => [...prev, { iv: '', dv: '', notes: '' }])
    onEvent?.('row_added', { total: rows.length + 1 })
  }

  function removeRow(index: number) {
    if (rows.length <= 2) return
    setRows((prev) => prev.filter((_, i) => i !== index))
    onEvent?.('row_removed', { index })
  }

  function getGraphPoints() {
    return rows
      .map((r) => ({ x: Number(r.iv), y: Number(r.dv) }))
      .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y))
      .sort((a, b) => a.x - b.x)
  }

  function handleSubmit() {
    const filledRows = rows.filter((r) => r.iv.trim() || r.dv.trim())
    const correctness = Math.min(1, filledRows.length / minRows)
    onEvent?.('task_submit', { row_count: filledRows.length })
    onSubmit({
      data_rows: rows,
      filled_count: filledRows.length,
      trend,
      conclusion,
      correctness,
    })
  }

  const graphPoints = getGraphPoints()
  const xVals = graphPoints.map((p) => p.x)
  const yVals = graphPoints.map((p) => p.y)
  const xMin = Math.min(...xVals, 0)
  const xMax = Math.max(...xVals, 1)
  const yMin = Math.min(...yVals, 0)
  const yMax = Math.max(...yVals, 1)
  const W = 260; const H = 130; const PAD = 22
  const toSvg = (x: number, y: number) => ({
    x: PAD + ((x - xMin) / Math.max(xMax - xMin, 1)) * (W - PAD * 2),
    y: H - PAD - ((y - yMin) / Math.max(yMax - yMin, 1)) * (H - PAD * 2),
  })
  const svgPoints = graphPoints.map((p) => toSvg(p.x, p.y))

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold text-gray-900 text-sm">{title}</h3>
        <p className="text-xs text-gray-600 mt-1">{prompt}</p>
      </div>

      {simulationUrl && (
        <div className="rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
          <div className="aspect-video">
            <iframe src={simulationUrl} title="PhET Simulation" className="w-full h-full" />
          </div>
          <div className="p-2 flex justify-between items-center">
            <p className="text-[11px] text-gray-500">Manipulate the simulation above and record your results below.</p>
            <a href={simulationUrl} target="_blank" rel="noreferrer" className="text-[11px] text-blue-600 hover:underline">Open in new tab</a>
          </div>
        </div>
      )}

      {/* Data table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-100">
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 border border-gray-300">{ivLabel}</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 border border-gray-300">{dvLabel}</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 border border-gray-300">Observations</th>
              <th className="w-8 border border-gray-300" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border border-gray-300">
                <td className="p-1 border border-gray-300">
                  <input
                    value={row.iv}
                    onChange={(e) => updateRow(i, 'iv', e.target.value)}
                    placeholder="e.g. 10"
                    className="w-full px-2 py-1 text-xs rounded border-0 bg-transparent focus:bg-white focus:border focus:border-blue-300 focus:outline-none"
                    disabled={disabled}
                  />
                </td>
                <td className="p-1 border border-gray-300">
                  <input
                    value={row.dv}
                    onChange={(e) => updateRow(i, 'dv', e.target.value)}
                    placeholder="e.g. 25"
                    className="w-full px-2 py-1 text-xs rounded border-0 bg-transparent focus:bg-white focus:border focus:border-blue-300 focus:outline-none"
                    disabled={disabled}
                  />
                </td>
                <td className="p-1 border border-gray-300">
                  <input
                    value={row.notes}
                    onChange={(e) => updateRow(i, 'notes', e.target.value)}
                    placeholder="Optional notes"
                    className="w-full px-2 py-1 text-xs rounded border-0 bg-transparent focus:bg-white focus:border focus:border-blue-300 focus:outline-none"
                    disabled={disabled}
                  />
                </td>
                <td className="p-1 text-center border border-gray-300">
                  <button
                    onClick={() => removeRow(i)}
                    disabled={disabled || rows.length <= 2}
                    className="text-gray-400 hover:text-red-500 text-xs disabled:opacity-30"
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        onClick={addRow}
        disabled={disabled}
        className="text-xs text-blue-600 hover:underline disabled:opacity-50"
      >
        + Add row
      </button>

      {/* Auto graph */}
      {graphPoints.length >= 2 && (
        <div>
          <p className="text-[11px] font-medium text-gray-600 mb-1">Data preview</p>
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-2">
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[130px]">
              <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="#9ca3af" strokeWidth="1" />
              <line x1={PAD} y1={PAD} x2={PAD} y2={H - PAD} stroke="#9ca3af" strokeWidth="1" />
              <path d={buildLinePath(svgPoints)} fill="none" stroke="#3b82f6" strokeWidth="2" />
              {svgPoints.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="3" fill="#1d4ed8" />)}
              <text x={PAD + 2} y={H - 4} className="text-[8px]" fill="#9ca3af" fontSize="8">{ivLabel.slice(0, 12)}</text>
            </svg>
          </div>
        </div>
      )}

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Observed trend</label>
        <input
          value={trend}
          onChange={(e) => {
            setTrend(e.target.value)
            onEvent?.('trend_draft', { value: e.target.value })
          }}
          placeholder="As the IV increases, the DV..."
          className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 bg-white"
          disabled={disabled}
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Scientific conclusion</label>
        <textarea
          value={conclusion}
          onChange={(e) => {
            setConclusion(e.target.value)
            onEvent?.('conclusion_draft', { value: e.target.value })
          }}
          rows={2}
          placeholder="Based on my data, I can conclude that..."
          className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 bg-white resize-none"
          disabled={disabled}
        />
      </div>

      <button
        onClick={handleSubmit}
        disabled={disabled || rows.filter((r) => r.iv.trim()).length < 2}
        className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
      >
        Submit data table
      </button>
    </div>
  )
}
