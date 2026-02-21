'use client'

import { useEffect, useRef, useState } from 'react'
import { normaliseSimulationUrl, simViewerUrl } from '@/lib/sim-embed'

interface SimulationEmbedProps {
  /** Raw URL as stored in the DB — will be normalised automatically */
  rawUrl: string | null | undefined
  title?: string
  className?: string
}

type EmbedState = 'loading' | 'loaded' | 'error' | 'blocked'

export default function SimulationEmbed({ rawUrl, title = 'Simulation', className = '' }: SimulationEmbedProps) {
  const embedUrl = normaliseSimulationUrl(rawUrl)
  const viewerUrl = simViewerUrl(rawUrl)

  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [state, setState] = useState<EmbedState>('loading')
  const [useObject, setUseObject] = useState(false)
  const loadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!embedUrl) { setState('error'); return }

    setState('loading')
    setUseObject(false)

    // If iframe doesn't fire onLoad within 8 s, switch to <object> fallback
    loadTimeoutRef.current = setTimeout(() => {
      setState((s) => {
        if (s === 'loading') {
          setUseObject(true)
          return 'loading'
        }
        return s
      })
    }, 8000)

    return () => {
      if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current)
    }
  }, [embedUrl])

  function handleIframeLoad() {
    if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current)
    // Try to detect a blank/blocked iframe — if contentDocument is null the browser blocked it
    try {
      const doc = iframeRef.current?.contentDocument
      // If we can access the document and it has no body children → probably CSP block page
      if (doc && doc.body && doc.body.children.length === 0 && doc.body.innerHTML.trim() === '') {
        setUseObject(true)
        setState('loading')
        return
      }
    } catch {
      // Cross-origin — can't inspect. Assume it loaded fine.
    }
    setState('loaded')
  }

  function handleIframeError() {
    if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current)
    setUseObject(true)
    setState('loading')
  }

  function handleObjectLoad() {
    setState('loaded')
  }

  // No valid URL
  if (!embedUrl) {
    return (
      <div className={`flex flex-col items-center justify-center h-full bg-gray-900 text-gray-400 gap-3 ${className}`}>
        <span className="text-4xl">🔬</span>
        <p className="text-sm font-medium text-gray-300">Simulation not configured</p>
        <p className="text-xs text-gray-500 max-w-xs text-center">
          No valid simulation URL was found. Ask your teacher to check the assessment setup.
        </p>
        {viewerUrl && (
          <a href={viewerUrl} target="_blank" rel="noreferrer"
            className="mt-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-500 transition">
            Try opening directly ↗
          </a>
        )}
      </div>
    )
  }

  return (
    <div className={`relative w-full h-full bg-gray-950 ${className}`}>
      {/* Loading overlay */}
      {state === 'loading' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-950 z-10 gap-3">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-400">Loading simulation…</p>
          {viewerUrl && (
            <a href={viewerUrl} target="_blank" rel="noreferrer"
              className="text-xs text-blue-400 hover:text-blue-300 underline">
              Not loading? Open in new tab ↗
            </a>
          )}
        </div>
      )}

      {/* Error state */}
      {state === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-950 z-10 gap-4 px-8">
          <span className="text-4xl">⚠️</span>
          <p className="text-sm text-gray-300 font-medium text-center">Could not embed the simulation</p>
          <p className="text-xs text-gray-500 text-center">
            The simulation may block embedding. Use the link below to open it in a separate tab,
            then switch back here to record your observations.
          </p>
          {viewerUrl && (
            <a href={viewerUrl} target="_blank" rel="noreferrer"
              className="px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 transition">
              Open simulation in new tab ↗
            </a>
          )}
        </div>
      )}

      {/* Blocked state */}
      {state === 'blocked' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-950 z-10 gap-4 px-8">
          <span className="text-4xl">🔒</span>
          <p className="text-sm text-gray-300 font-medium text-center">Simulation blocked by browser policy</p>
          <p className="text-xs text-gray-500 text-center max-w-xs">
            This simulation's website prevents embedding. Open it in a new tab, interact with it there,
            then come back here to record your results.
          </p>
          {viewerUrl && (
            <a href={viewerUrl} target="_blank" rel="noreferrer"
              className="px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 transition">
              Open simulation ↗
            </a>
          )}
        </div>
      )}

      {/* Embed — try <iframe> first, fall back to <object> */}
      {!useObject ? (
        <iframe
          ref={iframeRef}
          src={embedUrl}
          title={title}
          onLoad={handleIframeLoad}
          onError={handleIframeError}
          className={`w-full h-full border-0 transition-opacity duration-300 ${state === 'loaded' ? 'opacity-100' : 'opacity-0'}`}
          allow="fullscreen; accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          // Do NOT set sandbox — it blocks JS which breaks GeoGebra/PhET
        />
      ) : (
        <object
          data={embedUrl}
          type="text/html"
          title={title}
          onLoad={handleObjectLoad}
          className={`w-full h-full border-0 transition-opacity duration-300 ${state === 'loaded' ? 'opacity-100' : 'opacity-0'}`}
        >
          {/* Final fallback content inside <object> */}
          <div className="flex flex-col items-center justify-center h-full gap-4 bg-gray-950 px-8">
            <span className="text-4xl">🔗</span>
            <p className="text-sm text-gray-300 text-center">Your browser could not embed this simulation.</p>
            {viewerUrl && (
              <a href={viewerUrl} target="_blank" rel="noreferrer"
                className="px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 transition">
                Open in new tab ↗
              </a>
            )}
          </div>
        </object>
      )}
    </div>
  )
}
