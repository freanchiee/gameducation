/**
 * Simulation embed URL utilities.
 * Normalises GeoGebra and PhET viewer URLs into embeddable iframe src values.
 */

/**
 * Converts any GeoGebra URL variant into the canonical embed URL.
 *
 * Input forms handled:
 *   https://www.geogebra.org/m/MATERIAL_ID          (short share link)
 *   https://www.geogebra.org/graphing?id=MATERIAL_ID
 *   https://www.geogebra.org/material/iframe/id/MATERIAL_ID/...  (already iframe)
 *   https://geogebra.org/calculator/...
 *
 * Returns null if the URL is not a valid GeoGebra URL or has no real material ID.
 */
export function normaliseGeoGebraUrl(raw: string): string | null {
  if (!raw) return null

  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return null
  }

  if (!/geogebra\.org/i.test(url.hostname)) return null

  // Already an iframe embed — validate the material ID isn't a JS boolean/placeholder
  if (/\/material\/iframe\/id\/([^/]+)/.test(url.pathname)) {
    const match = url.pathname.match(/\/material\/iframe\/id\/([^/]+)/)
    const id = match?.[1]
    if (!id || id === 'false' || id === 'true' || id === 'null' || id === 'undefined') return null
    // Return cleaned version without extra params that can cause CSP issues
    return `https://www.geogebra.org/material/iframe/id/${id}/width/800/height/600/border/ffffff/sfsb/true/smb/false/stb/false/stbh/false/ai/false/rc/false`
  }

  // Short link: geogebra.org/m/MATERIAL_ID
  const shortMatch = url.pathname.match(/^\/m\/([a-zA-Z0-9]+)/)
  if (shortMatch?.[1]) {
    return `https://www.geogebra.org/material/iframe/id/${shortMatch[1]}/width/800/height/600/border/ffffff/sfsb/true/smb/false/stb/false/stbh/false/ai/false/rc/false`
  }

  // Classic viewer: geogebra.org/graphing, /geometry, etc. with id= param
  const idParam = url.searchParams.get('id') || url.searchParams.get('material')
  if (idParam && idParam !== 'false') {
    return `https://www.geogebra.org/material/iframe/id/${idParam}/width/800/height/600/border/ffffff/sfsb/true/smb/false/stb/false/stbh/false/ai/false/rc/false`
  }

  // Calculator/graphing/geometry app without specific material — embed the tool itself
  if (/\/(graphing|geometry|3d|cas|classic|calculator)/.test(url.pathname)) {
    return `https://www.geogebra.org${url.pathname}`
  }

  return null
}

/**
 * Converts any PhET simulation URL into an embeddable form.
 * PhET allows embedding via their iframe URL pattern.
 */
export function normalisePhETUrl(raw: string): string | null {
  if (!raw) return null
  if (!/phet\.colorado\.edu/i.test(raw)) return null
  // PhET simulations embed directly — just return as-is
  return raw
}

/**
 * Master normaliser — tries GeoGebra then PhET then returns the raw URL if neither matches.
 * Returns null only if the URL is clearly broken (id/false pattern etc.)
 */
export function normaliseSimulationUrl(raw: string | null | undefined): string | null {
  if (!raw) return null

  // Reject known broken placeholders
  if (/\/id\/(false|true|null|undefined)\b/.test(raw)) return null
  if (raw === 'null' || raw === 'false' || raw === 'undefined') return null

  // Try GeoGebra normalisation
  const gg = normaliseGeoGebraUrl(raw)
  if (gg) return gg

  // Try PhET
  const phet = normalisePhETUrl(raw)
  if (phet) return phet

  // Generic — return as-is if it looks like a real URL
  try {
    new URL(raw)
    return raw
  } catch {
    return null
  }
}

/**
 * Given a raw URL, returns the best viewer URL for an <a> open-in-new-tab link.
 * For GeoGebra, returns the human-friendly share URL (geogebra.org/m/ID).
 */
export function simViewerUrl(raw: string | null | undefined): string | null {
  if (!raw) return null
  try {
    const u = new URL(raw)
    if (/geogebra\.org/i.test(u.hostname)) {
      const idMatch = u.pathname.match(/\/material\/iframe\/id\/([^/]+)/)
      if (idMatch?.[1] && idMatch[1] !== 'false') {
        return `https://www.geogebra.org/m/${idMatch[1]}`
      }
      const shortMatch = u.pathname.match(/^\/m\/([a-zA-Z0-9]+)/)
      if (shortMatch?.[1]) return raw
    }
    return raw
  } catch {
    return raw
  }
}
