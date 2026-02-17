import { CheckCircle, TrendingUp } from 'lucide-react'

interface ResultsCardProps {
  level: number
  strengths: string[]
  areasForGrowth: string[]
  evidenceQuotes: string[]
  studentFeedback: string
}

const LEVEL_BANDS = [
  { min: 0, max: 0, label: 'Not Assessed', color: 'bg-gray-100 text-gray-600', border: 'border-gray-200' },
  { min: 1, max: 2, label: 'Limited', color: 'bg-red-50 text-red-700', border: 'border-red-200' },
  { min: 3, max: 4, label: 'Adequate', color: 'bg-yellow-50 text-yellow-700', border: 'border-yellow-200' },
  { min: 5, max: 6, label: 'Substantial', color: 'bg-blue-50 text-blue-700', border: 'border-blue-200' },
  { min: 7, max: 8, label: 'Excellent', color: 'bg-green-50 text-green-700', border: 'border-green-200' },
]

function getLevelBand(level: number) {
  return LEVEL_BANDS.find((b) => level >= b.min && level <= b.max) ?? LEVEL_BANDS[0]
}

export default function ResultsCard({
  level,
  strengths,
  areasForGrowth,
  evidenceQuotes,
  studentFeedback,
}: ResultsCardProps) {
  const band = getLevelBand(level)

  return (
    <div className="space-y-4">
      <div className={`p-5 rounded-xl border-2 ${band.border} ${band.color} text-center`}>
        <p className="text-xs uppercase tracking-wider opacity-70 mb-1">Criterion A</p>
        <div className="text-4xl font-bold">{level}<span className="text-xl">/8</span></div>
        <p className="font-semibold mt-1">{band.label}</p>
      </div>

      {strengths.length > 0 && (
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle size={16} className="text-green-500" />
            <h3 className="font-semibold text-sm">Strengths</h3>
          </div>
          <ul className="space-y-1.5">
            {strengths.map((s, i) => (
              <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0" />
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      {areasForGrowth.length > 0 && (
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={16} className="text-blue-500" />
            <h3 className="font-semibold text-sm">Areas for Growth</h3>
          </div>
          <ul className="space-y-1.5">
            {areasForGrowth.map((a, i) => (
              <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                {a}
              </li>
            ))}
          </ul>
        </div>
      )}

      {evidenceQuotes.length > 0 && (
        <div className="bg-white rounded-xl border p-4">
          <h3 className="font-semibold text-sm mb-3">Evidence</h3>
          <div className="space-y-2">
            {evidenceQuotes.map((q, i) => (
              <blockquote key={i} className="border-l-4 border-purple-200 pl-3 text-sm text-gray-700 italic">
                &ldquo;{q}&rdquo;
              </blockquote>
            ))}
          </div>
        </div>
      )}

      {studentFeedback && (
        <div className="bg-blue-600 rounded-xl p-4 text-white">
          <h3 className="font-semibold text-sm mb-2">Your Feedback</h3>
          <p className="text-blue-100 text-sm leading-relaxed">{studentFeedback}</p>
        </div>
      )}
    </div>
  )
}
