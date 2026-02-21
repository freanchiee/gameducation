/**
 * Native URL-to-embed converter for GeoGebra, PhET, and YouTube.
 *
 * Works the same way iframely does internally — detect the URL pattern,
 * extract the ID/slug, construct the canonical embed URL — but with no
 * external API call or API key required.
 */

import type { EmbedResource, ResourceType } from '@/lib/types'

interface ParsedEmbed {
  type: ResourceType
  title: string
  embedUrl: string
}

// ─── GeoGebra ────────────────────────────────────────────────────────────────
// Supported URL patterns:
//   https://www.geogebra.org/m/{id}
//   https://www.geogebra.org/material/iframe/id/{id}/width/...  (already-embedded, round-trip safe)
//   https://www.geogebra.org/graphing/{id}
//   https://www.geogebra.org/calculator/{id}
//   https://www.geogebra.org/geometry/{id}
//   https://www.geogebra.org/3d/{id}
//   https://www.geogebra.org/classic/{id}
//   https://www.geogebra.org/graphing?id={id}   (query-param variant)
function parseGeoGebra(url: string): ParsedEmbed | null {
  const EMBED_BASE = `https://www.geogebra.org/material/iframe/id`
  const EMBED_PARAMS = `/width/800/height/500/border/888888/sfsb/true/smb/false/stb/false/stbh/false/ai/false/asb/false/sri/false/rc/false/ld/false/sdz/true/ctl/false`

  // ── Already a fully-formed embed URL ──────────────────────────────────────
  // e.g. https://www.geogebra.org/material/iframe/id/{id}/width/960/...
  // Must anchor to /width/\d to avoid capturing the "false" in rc/false etc.
  const embedMatch = url.match(/geogebra\.org\/material\/iframe\/id\/([A-Za-z0-9_-]+)\/width\/\d/)
  if (embedMatch) {
    return {
      type: 'geogebra',
      title: 'GeoGebra',
      embedUrl: `${EMBED_BASE}/${embedMatch[1]}${EMBED_PARAMS}`,
    }
  }

  // ── Path-segment variant: /m/{id} or /calculator/{id} etc. ───────────────
  // Intentionally excludes material/iframe/id — handled above to avoid
  // the bug where /rc/false causes "false" to be captured as the material ID.
  const pathMatch = url.match(
    /geogebra\.org\/(?:m|graphing|calculator|geometry|3d|classic)\/([A-Za-z0-9_-]+)/
  )
  if (pathMatch) {
    return {
      type: 'geogebra',
      title: 'GeoGebra',
      embedUrl: `${EMBED_BASE}/${pathMatch[1]}${EMBED_PARAMS}`,
    }
  }

  // ── Query-param variant: /graphing?id={id} ────────────────────────────────
  try {
    const parsed = new URL(url)
    const id = parsed.searchParams.get('id')
    if (id && parsed.hostname.includes('geogebra.org')) {
      return {
        type: 'geogebra',
        title: 'GeoGebra',
        embedUrl: `${EMBED_BASE}/${id}${EMBED_PARAMS}`,
      }
    }
  } catch {
    // Invalid URL — skip
  }

  return null
}

// ─── PhET ─────────────────────────────────────────────────────────────────────
// Supported URL patterns:
//   https://phet.colorado.edu/en/simulations/{slug}
//   https://phet.colorado.edu/en/simulation/{slug}
//   https://phet.colorado.edu/sims/html/{slug}/latest/{slug}_en.html  (already embed)
function parsePhet(url: string): ParsedEmbed | null {
  // Already an embed URL
  const embedMatch = url.match(/phet\.colorado\.edu\/sims\/html\/([a-z0-9-]+)\/latest\//)
  if (embedMatch) {
    const slug = embedMatch[1]
    return {
      type: 'phet',
      title: 'PhET Simulation',
      embedUrl: `https://phet.colorado.edu/sims/html/${slug}/latest/${slug}_en.html`,
    }
  }

  // Share URL
  const shareMatch = url.match(/phet\.colorado\.edu\/en\/simulation(?:s)?\/([a-z0-9-]+)/)
  if (shareMatch) {
    const slug = shareMatch[1]
    return {
      type: 'phet',
      title: 'PhET Simulation',
      embedUrl: `https://phet.colorado.edu/sims/html/${slug}/latest/${slug}_en.html`,
    }
  }

  return null
}

// ─── YouTube ──────────────────────────────────────────────────────────────────
// Supported URL patterns:
//   https://www.youtube.com/watch?v={id}
//   https://youtu.be/{id}
//   https://www.youtube.com/embed/{id}   (already embed)
//   https://youtube.com/shorts/{id}
function parseYouTube(url: string): ParsedEmbed | null {
  const watchMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{11})/)
  if (watchMatch) {
    return {
      type: 'youtube',
      title: 'YouTube Video',
      embedUrl: `https://www.youtube.com/embed/${watchMatch[1]}?rel=0&modestbranding=1`,
    }
  }

  const embedMatch = url.match(/youtube\.com\/embed\/([A-Za-z0-9_-]{11})/)
  if (embedMatch) {
    return {
      type: 'youtube',
      title: 'YouTube Video',
      embedUrl: `https://www.youtube.com/embed/${embedMatch[1]}?rel=0&modestbranding=1`,
    }
  }

  const shortsMatch = url.match(/youtube\.com\/shorts\/([A-Za-z0-9_-]{11})/)
  if (shortsMatch) {
    return {
      type: 'youtube',
      title: 'YouTube Video',
      embedUrl: `https://www.youtube.com/embed/${shortsMatch[1]}?rel=0&modestbranding=1`,
    }
  }

  return null
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Try to parse a URL into a known embed type.
 * Returns null if the URL is not a recognized provider.
 */
export function parseEmbedUrl(url: string): Omit<EmbedResource, 'id'> | null {
  const trimmed = url.trim()
  if (!trimmed) return null

  const gg = parseGeoGebra(trimmed)
  if (gg) return { ...gg, originalUrl: trimmed }

  const phet = parsePhet(trimmed)
  if (phet) return { ...phet, originalUrl: trimmed }

  const yt = parseYouTube(trimmed)
  if (yt) return { ...yt, originalUrl: trimmed }

  return null
}

/**
 * Detect which provider a URL belongs to without building the full embed.
 * Useful for showing a live "detected as GeoGebra" indicator.
 */
export function detectProvider(url: string): ResourceType | null {
  if (!url.trim()) return null
  if (url.includes('geogebra.org')) return 'geogebra'
  if (url.includes('phet.colorado.edu')) return 'phet'
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube'
  return null
}

/** Human-readable label for each resource type */
export const PROVIDER_LABELS: Record<ResourceType, string> = {
  geogebra: 'GeoGebra',
  phet: 'PhET Simulation',
  youtube: 'YouTube',
  embed: 'Custom Embed',
  url: 'URL',
}
