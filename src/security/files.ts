const dangerousExtensions = new Set([
  'html',
  'htm',
  'js',
  'mjs',
  'svg',
  'exe',
  'bat',
  'cmd',
  'ps1',
  'vbs',
  'msi',
])

export const allowedMediaTypes = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'audio/mpeg',
  'audio/mp4',
  'audio/wav',
  'audio/ogg',
  'audio/webm',
])

export function isAllowedMedia(file: File): boolean {
  const ext = extensionOf(file.name)
  return allowedMediaTypes.has(file.type) && !dangerousExtensions.has(ext)
}

export function mediaTypeFromMime(mime: string): 'image' | 'audio' {
  return mime.startsWith('audio/') ? 'audio' : 'image'
}

export function safeZipName(name: string, fallback: string): string {
  const leaf = name.split(/[\\/]/).pop()?.trim() || fallback
  const normalized = leaf
    .replace(/\0/g, '')
    .replace(/[<>:"|?*]/g, '_')
    .replace(/\s+/g, ' ')
    .slice(0, 160)
  const cleaned = normalized.replace(/^\.+/, '').trim()
  return cleaned || fallback
}

export function safeZipPath(path: string): string | null {
  const normalized = path.replace(/\\/g, '/').trim()
  if (!normalized || normalized.startsWith('/') || normalized.includes('../') || /^[a-zA-Z]:/.test(normalized)) {
    return null
  }
  const parts = normalized.split('/').filter(Boolean)
  if (parts.some((part) => part === '.' || part === '..' || part.length > 200)) {
    return null
  }
  const ext = extensionOf(parts.at(-1) ?? '')
  if (dangerousExtensions.has(ext)) {
    return null
  }
  return parts.join('/')
}

export function assetPathFor(fileName: string, mime: string, used: Set<string>): string {
  const folder = mime.startsWith('audio/') ? 'assets/audio' : 'assets/images'
  const safeName = safeZipName(fileName, mime.startsWith('audio/') ? 'audio.bin' : 'image.bin')
  const dot = safeName.lastIndexOf('.')
  const base = dot > 0 ? safeName.slice(0, dot) : safeName
  const ext = dot > 0 ? safeName.slice(dot) : ''
  let candidate = `${folder}/${safeName}`
  let index = 2
  while (used.has(candidate.toLowerCase())) {
    candidate = `${folder}/${base}_${index}${ext}`
    index += 1
  }
  used.add(candidate.toLowerCase())
  return candidate
}

function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : ''
}
