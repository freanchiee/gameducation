import { NextResponse } from 'next/server'

function decodeDuckDuckGoHref(href: string) {
  const match = href.match(/[?&]uddg=([^&]+)/)
  if (match?.[1]) {
    try {
      return decodeURIComponent(match[1])
    } catch {
      return ''
    }
  }
  return ''
}

function extractLinksFromDuckHtml(html: string) {
  const out: string[] = []
  const re = /href="([^"]+)"/g
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    const candidate = m[1]
    if (!candidate) continue
    const decoded = decodeDuckDuckGoHref(candidate)
    if (!decoded.startsWith('http')) continue
    if (!out.includes(decoded)) out.push(decoded)
    if (out.length >= 40) break
  }
  return out
}

async function searchDuckLinks(query: string) {
  const url = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 VoiceIQ Resource Bot',
      Accept: 'text/html',
    },
    cache: 'no-store',
  })
  if (!res.ok) {
    throw new Error(`search failed with ${res.status}`)
  }
  const html = await res.text()
  return extractLinksFromDuckHtml(html)
}

function fallbackResources(topic: string, subject: string, yearGroup: string) {
  const q = `${subject} ${topic} ${yearGroup}`
  return {
    youtube_url: `https://www.youtube.com/results?search_query=${encodeURIComponent(`${q} lesson`)}`,
    website_url: `https://www.khanacademy.org/search?page_search_query=${encodeURIComponent(`${subject} ${topic}`)}`,
    raw_text_title: `${topic} starter notes`,
    raw_text: [
      `Topic: ${topic}`,
      `Level: ${yearGroup}`,
      '',
      'Key ideas to assess:',
      '- Core definition and concept language',
      '- One worked example with interpretation',
      '- One real-world application and limitations',
      '',
      'Prompt style:',
      '- Start concrete, then increase abstraction',
      '- Ask for evidence-based reasoning',
      '- Request comparisons between cases',
    ].join('\n'),
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const topic = String(body.topic ?? '').trim()
    const subject = String(body.subject ?? '').trim()
    const yearGroup = String(body.year_group ?? '').trim()

    if (!topic || !subject || !yearGroup) {
      return NextResponse.json({ error: 'topic, subject and year_group are required' }, { status: 400 })
    }

    const queryBase = `${subject} ${topic} ${yearGroup}`
    const [videoLinks, websiteLinks] = await Promise.allSettled([
      searchDuckLinks(`${queryBase} lesson site:youtube.com/watch`),
      searchDuckLinks(`${queryBase} explained site:khanacademy.org OR site:bbc.co.uk/bitesize OR site:ck12.org`),
    ])

    const videoCandidates = videoLinks.status === 'fulfilled' ? videoLinks.value : []
    const websiteCandidates = websiteLinks.status === 'fulfilled' ? websiteLinks.value : []

    const youtubeUrl =
      videoCandidates.find((u) => /youtube\.com\/watch|youtu\.be\//i.test(u)) ??
      websiteCandidates.find((u) => /youtube\.com\/watch|youtu\.be\//i.test(u))

    const websiteUrl =
      websiteCandidates.find((u) => !/youtube\.com|youtu\.be/i.test(u)) ??
      videoCandidates.find((u) => !/youtube\.com|youtu\.be/i.test(u))

    const fallback = fallbackResources(topic, subject, yearGroup)

    return NextResponse.json({
      youtube_url: youtubeUrl ?? fallback.youtube_url,
      website_url: websiteUrl ?? fallback.website_url,
      raw_text_title: `${topic} class summary (${yearGroup})`,
      raw_text: [
        `${subject} - ${topic} (${yearGroup})`,
        '',
        'Use this as starter context for the multimodal agent:',
        '- Ask one concept check question first.',
        '- Then ask interpretation/application questions tied to a visual or data source.',
        '- End with reasoning + justification, not recall only.',
      ].join('\n'),
    })
  } catch (error) {
    console.error('[/api/resources/suggest] error', error)
    return NextResponse.json({ error: 'Failed to suggest resources' }, { status: 500 })
  }
}
