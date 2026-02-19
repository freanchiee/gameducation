export type WallpaperBlob = {
  size: number
  top: number
  left: number
  opacity: number
  duration: number
  delay: number
}

function hashString(seed: string) {
  let h = 2166136261
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function mulberry32(a: number) {
  return function rand() {
    let t = (a += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function createWallpaper(seed: string) {
  const rand = mulberry32(hashString(seed))
  const hueA = Math.floor(210 + rand() * 45)
  const hueB = Math.floor(250 + rand() * 40)
  const hueC = Math.floor(20 + rand() * 50)

  const gradient = `linear-gradient(120deg, hsl(${hueA} 65% 56%) 0%, hsl(${hueB} 62% 52%) 50%, hsl(${hueC} 70% 82%) 100%)`

  const blobs: WallpaperBlob[] = Array.from({ length: 6 }, () => ({
    size: 80 + Math.floor(rand() * 240),
    top: Math.floor(rand() * 90),
    left: Math.floor(rand() * 95),
    opacity: Number((0.1 + rand() * 0.22).toFixed(2)),
    duration: Number((8 + rand() * 8).toFixed(2)),
    delay: Number((rand() * 5).toFixed(2)),
  }))

  return { gradient, blobs }
}

export function createCardAccent(seed: string) {
  const rand = mulberry32(hashString(`card:${seed}`))
  const hue = Math.floor(210 + rand() * 90)
  const hue2 = Math.floor((hue + 60 + rand() * 80) % 360)
  const angle = Math.floor(rand() * 180)
  const gradient = `linear-gradient(${angle}deg, hsla(${hue} 78% 56% / 0.22), hsla(${hue2} 80% 72% / 0.3))`
  const delay = Number((rand() * 3).toFixed(2))
  const duration = Number((5 + rand() * 4).toFixed(2))
  return { gradient, delay, duration }
}
