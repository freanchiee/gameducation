'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, Layers } from 'lucide-react'
import type { EmbedResource } from '@/lib/types'

interface Props {
  resources: EmbedResource[]
}

const PROVIDER_LABELS: Record<string, string> = {
  geogebra: 'GeoGebra',
  phet:     'PhET',
  youtube:  'YouTube',
  embed:    'Resource',
  url:      'Link',
}

function ResourceFrame({ resource }: { resource: EmbedResource }) {
  if (resource.type === 'embed' && resource.embedHtml) {
    return (
      <div
        className="w-full rounded-xl overflow-hidden border border-[#b6c9cf]"
        style={{ minHeight: 340 }}
        dangerouslySetInnerHTML={{ __html: resource.embedHtml }}
      />
    )
  }

  if (resource.embedUrl) {
    return (
      <iframe
        src={resource.embedUrl}
        className="w-full rounded-xl border border-[#b6c9cf]"
        style={{ height: 380 }}
        allow="fullscreen; accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        title={resource.title}
        loading="lazy"
      />
    )
  }

  return null
}

export default function ResourcePanel({ resources }: Props) {
  const [open, setOpen] = useState(true)
  const [activeIndex, setActiveIndex] = useState(0)

  if (!resources || resources.length === 0) return null

  const active = resources[activeIndex]

  return (
    <div className="border-b border-[#b6c9cf] bg-[#d3e3e7]/50">
      {/* Header bar */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-[#d3e3e7]/70 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Layers size={14} className="text-[#44597f]" />
          <span className="text-sm font-medium text-[#223a83]">
            Assessment Resources
          </span>
          <span className="text-xs text-[#44597f] bg-[#ece6bf] px-1.5 py-0.5 rounded-full border border-[#c9be86]">
            {resources.length}
          </span>
        </div>
        {open ? (
          <ChevronUp size={15} className="text-[#44597f]" />
        ) : (
          <ChevronDown size={15} className="text-[#44597f]" />
        )}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {/* Tab selector when multiple resources */}
          {resources.length > 1 && (
            <div className="flex gap-2 flex-wrap">
              {resources.map((r, i) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setActiveIndex(i)}
                  className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                    i === activeIndex
                      ? 'bg-[#223a83] text-white'
                      : 'bg-white border border-[#b6c9cf] text-[#44597f] hover:border-[#223a83]'
                  }`}
                >
                  {PROVIDER_LABELS[r.type]} · {r.title}
                </button>
              ))}
            </div>
          )}

          {/* Active resource */}
          {active && <ResourceFrame resource={active} />}
        </div>
      )}
    </div>
  )
}
