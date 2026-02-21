'use client'

import { useState } from 'react'
import { PlusCircle, Trash2, Link2, Code2, ExternalLink, Monitor } from 'lucide-react'
import { parseEmbedUrl, detectProvider, PROVIDER_LABELS } from '@/lib/embed-url'
import type { EmbedResource } from '@/lib/types'

interface Props {
  resources: EmbedResource[]
  onChange: (resources: EmbedResource[]) => void
}

const PROVIDER_BADGES: Record<string, { label: string; color: string }> = {
  geogebra: { label: 'GeoGebra', color: 'bg-blue-100 text-blue-700' },
  phet:     { label: 'PhET',     color: 'bg-green-100 text-green-700' },
  youtube:  { label: 'YouTube',  color: 'bg-red-100 text-red-700' },
  embed:    { label: 'Embed',    color: 'bg-purple-100 text-purple-700' },
  url:      { label: 'URL',      color: 'bg-gray-100 text-gray-700' },
}

export default function ResourceBuilder({ resources, onChange }: Props) {
  const [mode, setMode] = useState<'url' | 'embed'>('url')
  const [urlInput, setUrlInput] = useState('')
  const [embedInput, setEmbedInput] = useState('')
  const [titleInput, setTitleInput] = useState('')
  const [previewResource, setPreviewResource] = useState<Omit<EmbedResource, 'id'> | null>(null)
  const [urlError, setUrlError] = useState<string | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)

  // Detect provider live as user types
  const detectedProvider = detectProvider(urlInput)

  function handleUrlChange(value: string) {
    setUrlInput(value)
    setUrlError(null)
    setPreviewResource(null)

    if (!value.trim()) return

    const parsed = parseEmbedUrl(value)
    if (parsed) {
      setPreviewResource(parsed)
    }
  }

  function addUrlResource() {
    const parsed = parseEmbedUrl(urlInput)
    if (!parsed) {
      setUrlError('Could not recognise this URL. Supported: GeoGebra, PhET, YouTube. For other content use "Paste embed code".')
      return
    }
    const resource: EmbedResource = {
      id: crypto.randomUUID(),
      ...parsed,
      title: titleInput.trim() || parsed.title,
    }
    onChange([...resources, resource])
    setUrlInput('')
    setTitleInput('')
    setPreviewResource(null)
    setUrlError(null)
  }

  function addEmbedResource() {
    const html = embedInput.trim()
    if (!html) return

    // Basic sanity: must contain an iframe tag or a script tag
    if (!html.includes('<iframe') && !html.includes('<script')) {
      setUrlError('Embed code must contain an <iframe> or <script> tag.')
      return
    }

    const resource: EmbedResource = {
      id: crypto.randomUUID(),
      type: 'embed',
      title: titleInput.trim() || 'Custom Embed',
      embedHtml: html,
    }
    onChange([...resources, resource])
    setEmbedInput('')
    setTitleInput('')
    setUrlError(null)
  }

  function removeResource(id: string) {
    onChange(resources.filter(r => r.id !== id))
  }

  function handleAdd() {
    setUrlError(null)
    if (mode === 'url') addUrlResource()
    else addEmbedResource()
  }

  return (
    <div className="space-y-4">
      {/* Mode toggle */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => { setMode('url'); setUrlError(null) }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            mode === 'url'
              ? 'bg-gray-900 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          <Link2 size={13} />
          Paste URL
        </button>
        <button
          type="button"
          onClick={() => { setMode('embed'); setUrlError(null) }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            mode === 'embed'
              ? 'bg-gray-900 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          <Code2 size={13} />
          Paste embed code
        </button>
      </div>

      {/* Inputs */}
      <div className="space-y-3">
        {mode === 'url' ? (
          <div className="relative">
            <input
              type="url"
              value={urlInput}
              onChange={e => handleUrlChange(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAdd())}
              placeholder="https://www.geogebra.org/m/… or phet.colorado.edu/… or youtube.com/watch?v=…"
              className="w-full px-3 py-2 pr-28 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {detectedProvider && (
              <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium px-2 py-0.5 rounded-full ${PROVIDER_BADGES[detectedProvider].color}`}>
                {PROVIDER_LABELS[detectedProvider]}
              </span>
            )}
          </div>
        ) : (
          <textarea
            value={embedInput}
            onChange={e => { setEmbedInput(e.target.value); setUrlError(null) }}
            placeholder={`<iframe src="https://..." width="800" height="500" ...></iframe>`}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        )}

        <div className="flex gap-2">
          <input
            type="text"
            value={titleInput}
            onChange={e => setTitleInput(e.target.value)}
            placeholder="Label for students (optional)"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="button"
            onClick={handleAdd}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            <PlusCircle size={15} />
            Add
          </button>
        </div>
      </div>

      {urlError && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{urlError}</p>
      )}

      {/* Live preview for URL mode */}
      {previewResource?.embedUrl && (
        <div className="border border-blue-200 rounded-xl overflow-hidden bg-blue-50/40">
          <div className="flex items-center justify-between px-3 py-2 border-b border-blue-100">
            <span className="text-xs font-medium text-blue-700">Preview detected embed</span>
            <button
              type="button"
              onClick={() => setPreviewOpen(p => !p)}
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
            >
              <Monitor size={12} />
              {previewOpen ? 'Hide' : 'Show'} preview
            </button>
          </div>
          {previewOpen && (
            <div className="p-2">
              <iframe
                src={previewResource.embedUrl}
                className="w-full rounded-lg border border-blue-100"
                style={{ height: 320 }}
                allow="fullscreen"
                title="Preview"
              />
            </div>
          )}
        </div>
      )}

      {/* Resources list */}
      {resources.length > 0 && (
        <div className="space-y-2">
          {resources.map((r) => {
            const badge = PROVIDER_BADGES[r.type]
            return (
              <div
                key={r.id}
                className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-xl"
              >
                <span className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${badge.color}`}>
                  {badge.label}
                </span>
                <span className="flex-1 text-sm text-gray-800 truncate font-medium">{r.title}</span>
                {r.originalUrl && (
                  <a
                    href={r.originalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 text-gray-400 hover:text-gray-600"
                  >
                    <ExternalLink size={13} />
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => removeResource(r.id)}
                  className="shrink-0 text-gray-300 hover:text-red-500 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {resources.length === 0 && (
        <p className="text-xs text-gray-400">
          No resources added. Students will see these alongside the conversation.
        </p>
      )}
    </div>
  )
}
