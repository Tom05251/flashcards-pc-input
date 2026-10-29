import JSZip from 'jszip'
import type { CardEntry, MediaItem, NoteEntry, WorkspaceData, WorkspaceDraft } from '../models'
import { emptyWorkspace, mergeImportedEntries, normalizeWorkspaceDraft } from '../models'
import { safeZipPath } from '../security/files'
import { deleteMediaBlob, saveMediaBlob } from '../storage/db'

export interface ImportPreview {
  workspace: WorkspaceDraft
  warnings: string[]
}

const decodeUtf8 = (bytes: ArrayBuffer | Uint8Array) => new TextDecoder('utf-8', { fatal: true }).decode(bytes)

export async function importWorkspaceFile(file: File): Promise<ImportPreview> {
  const ext = file.name.split('.').pop()?.toLowerCase()
  if (ext === 'zip') return importZip(file)
  if (ext === 'json' || ext === 'csv') {
    if (file.size > (ext === 'json' ? 64 : 128) * 1024 * 1024) throw new Error('Input file is too large')
    const text = decodeUtf8(await file.arrayBuffer())
    return ext === 'json' ? importJson(text) : importCsv(text)
  }
  throw new Error('Unsupported file type')
}

async function importZip(file: File): Promise<ImportPreview> {
  if (file.size > 200 * 1024 * 1024) throw new Error('ZIP file is too large')
  const zip = await JSZip.loadAsync(file, { checkCRC32: true })
  const content = zip.file('content.json')
  if (!content) throw new Error('content.json was not found')
  if (content.unsafeOriginalName && content.unsafeOriginalName !== 'content.json') throw new Error('Unsafe content.json path')
  const contentBytes = await content.async('uint8array')
  if (contentBytes.byteLength > 64 * 1024 * 1024) throw new Error('content.json is too large')
  const workspace = normalizeWorkspace(JSON.parse(decodeUtf8(contentBytes)))
  const referenced = new Set([...workspace.cards, ...workspace.notes].flatMap((item) => item.media.map((media) => media.fileName)))
  const assets: { path: string; blob: Blob }[] = []
  const paths = new Set<string>(['content.json'])
  let totalSize = contentBytes.byteLength
  let count = 0
  for (const [path, entry] of Object.entries(zip.files)) {
    if (entry.dir || path === 'content.json') continue
    const original = entry.unsafeOriginalName ?? path
    const safe = safeZipPath(original)
    if (!safe || safe !== path || paths.has(safe.toLowerCase())) throw new Error('Unsafe or duplicate ZIP entry')
    paths.add(safe.toLowerCase())
    if (++count > 5000) throw new Error('ZIP has too many files')
    const blob = await entry.async('blob')
    totalSize += blob.size
    if (totalSize > 500 * 1024 * 1024) throw new Error('ZIP expanded size is too large')
    if (referenced.has(safe)) assets.push({ path: safe, blob })
  }
  // Validate the whole archive first. Namespacing prevents a later import from
  // overwriting a blob referenced by a previous workspace or by a shared item.
  const namespace = `import:${crypto.randomUUID()}:`
  const written: string[] = []
  try {
    for (const { path, blob } of assets) {
      const reference = namespace + path
      await saveMediaBlob(reference, blob, path.split('/').pop() ?? path, blob.type)
      written.push(reference)
      attachBlobRef(workspace, path, reference, blob.size)
    }
  } catch (error) {
    await Promise.all(written.map(deleteMediaBlob))
    throw error
  }
  const warnings = [...referenced].filter((path) => !assets.some((asset) => asset.path === path)).map((path) => `Missing media: ${path}`)
  return { workspace, warnings }
}

export function importJson(text: string): ImportPreview {
  return { workspace: normalizeWorkspace(JSON.parse(text.replace(/^\uFEFF/, ''))), warnings: [] }
}

export function importCsv(text: string): ImportPreview {
  const rows = parseCsv(text)
  const header = (rows.shift() ?? []).map((cell) => cell.trim().toLowerCase())
  if (new Set(header).size !== header.length) throw new Error('Duplicate CSV column')
  const has = (...keys: string[]) => keys.some((key) => header.includes(key))
  const hasCards = has('front_text', 'question') && has('back_text', 'answer')
  const hasNotes = has('note_title', 'title') && has('body_text', 'body')
  if (!hasCards && !hasNotes) throw new Error('Missing required CSV columns')
  const raw: { cards: Record<string, unknown>[]; notes: Record<string, unknown>[] } = { cards: [], notes: [] }
  rows.forEach((row) => {
    if (row.every((cell) => cell === '')) return
    if (row.length !== header.length) throw new Error('CSV row has the wrong number of fields')
    const presenceCell = row[header.indexOf('present_fields')]
    const present: unknown = presenceCell ? JSON.parse(presenceCell) : undefined
    if (present !== undefined && (!Array.isArray(present) || present.some((name) => typeof name !== 'string' || !header.includes(name)))) throw new Error('Invalid CSV presence fields')
    const value = (...keys: string[]) => {
      const key = keys.find((name) => header.includes(name))
      return key === undefined || (Array.isArray(present) && !present.includes(key)) ? undefined : row[header.indexOf(key)]
    }
    const cardText = Boolean(value('front_text', 'question') || value('back_text', 'answer'))
    const noteText = Boolean(value('note_title', 'title') || value('body_text', 'body'))
    if (hasCards && hasNotes && cardText === noteText) throw new Error('Ambiguous mixed CSV row')
    const card = hasCards && (!hasNotes || cardText)
    const record: Record<string, unknown> = card
      ? { question: value('front_text', 'question'), answer: value('back_text', 'answer') }
      : { title: value('note_title', 'title'), body: value('body_text', 'body') }
    for (const [key, ...aliases] of [
      ['folderPath', 'folder_path', 'folder'], ['hint', 'hint_text', 'hint'], ['hint2', 'hint2_text', 'hint2'], ['stableKey', 'stable_key'],
      ['imagePath', 'image_path', 'image'], ['audioPath', 'audio_path', 'audio'], ['status', 'status'], ['lastReview', 'last_review'],
      ['createdAt', 'created_at'], ['updatedAt', 'updated_at'], ['lastReviewedAt', 'last_reviewed_at'], ['timestampOrigin', 'timestamp_origin'],
    ]) {
      const cell = value(...aliases)
      if (cell !== undefined) record[key] = cell
    }
    for (const [key, ...aliases] of [
      ['id', 'id', 'card_id', 'note_id', 'id_external'], ['bookmarkLevel', 'bookmark_level'], ['bookmarkFlags', 'bookmark_flags'],
      ['dueEpochDay', 'due_epoch_day'], ['intervalDays', 'interval_days'],
    ]) {
      const cell = value(...aliases)
      if (cell !== undefined && cell !== '') {
        const number = Number(cell)
        if (!Number.isSafeInteger(number)) throw new Error(`Invalid CSV ${key}`)
        record[key] = number
      }
    }
    for (const key of ['bookmarked', 'example', 'selected', 'important', 'unnecessary']) {
      const cell = value(key)
      if (cell !== undefined && cell !== '') {
        if (!['true', 'false', '1', '0'].includes(cell.toLowerCase())) throw new Error(`Invalid CSV ${key}`)
        record[key] = cell.toLowerCase() === 'true' || cell === '1'
      }
    }
    const tags = value('tags', 'tag')
    if (tags !== undefined) record.tags = tags.split('|').filter(Boolean)
    for (const [key, column] of [
      ['questionHighlights', 'question_highlights'], ['answerHighlights', 'answer_highlights'], ['hintHighlights', 'hint_highlights'],
      ['hint2Highlights', 'hint2_highlights'], ['titleHighlights', 'title_highlights'], ['bodyHighlights', 'body_highlights'], ['media', 'media_json'],
    ]) {
      const cell = value(column)
      if (cell !== undefined) record[key] = cell === '' ? [] : JSON.parse(cell)
    }
    raw[card ? 'cards' : 'notes'].push(record)
  })
  return { workspace: normalizeWorkspace(raw), warnings: [] }
}

export function normalizeWorkspace(input: unknown): WorkspaceDraft {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid workspace')
  const raw = input as Partial<WorkspaceData>
  if (raw.schemaVersion !== undefined && raw.schemaVersion !== 1) throw new Error('Unsupported schema version')
  if (raw.cards !== undefined && !Array.isArray(raw.cards)) throw new Error('Invalid cards')
  if (raw.notes !== undefined && !Array.isArray(raw.notes)) throw new Error('Invalid notes')
  if (raw.cards === undefined && raw.notes === undefined) throw new Error('Missing content arrays')
  const prepare = (item: CardEntry | NoteEntry, index: number, card: boolean) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('Invalid content item')
    const value = item as unknown as Record<string, unknown>
    for (const key of card ? ['question', 'answer'] : ['title', 'body']) if (typeof value[key] !== 'string') throw new Error(`Invalid ${key}`)
    const id = value.id === undefined ? index + 1 : Number(value.id)
    if (!Number.isInteger(id) || id <= 0 || id > 2147483647) throw new Error('Invalid content identifier')
    const result = { ...item, id, sourceFields: Object.keys(value), folderPath: typeof item.folderPath === 'string' ? item.folderPath : '', media: normalizeMedia(value) }
    for (const key of card ? ['questionHighlights', 'answerHighlights', 'hintHighlights', 'hint2Highlights'] : ['titleHighlights', 'bodyHighlights']) {
      if (value[key] !== undefined && !Array.isArray(value[key])) throw new Error('Invalid highlights')
    }
    return result
  }
  const cards = (raw.cards ?? []).map((item, index) => prepare(item, index, true)) as CardEntry[]
  const notes = (raw.notes ?? []).map((item, index) => prepare(item, index, false)) as NoteEntry[]
  for (const entries of [cards, notes]) {
    const keys = entries.map((item) => item.stableKey).filter(Boolean)
    if (new Set(keys).size !== keys.length) throw new Error('Duplicate source identifier')
  }
  const draft = emptyWorkspace()
  return normalizeWorkspaceDraft({
    ...draft,
    cards: mergeImportedEntries([], cards), notes: mergeImportedEntries([], notes),
    cardFolders: Array.isArray(raw.cardFolders) ? raw.cardFolders : [],
    noteFolders: Array.isArray(raw.noteFolders) ? raw.noteFolders : [],
    cardFolderNames: Array.isArray(raw.cardFolderNames) ? raw.cardFolderNames : [],
    noteFolderNames: Array.isArray(raw.noteFolderNames) ? raw.noteFolderNames : [],
    uiState: raw.uiState ?? draft.uiState,
  })
}

function normalizeMedia(record: Record<string, unknown>): MediaItem[] {
  if (record.media !== undefined && !Array.isArray(record.media)) throw new Error('Invalid attachments')
  const legacy = [
    ...String(record.imagePath ?? record.image_path ?? '').split(/\r?\n/).filter(Boolean).map((fileName) => ({ type: 'image', fileName })),
    ...String(record.audioPath ?? record.audio_path ?? '').split(/\r?\n/).filter(Boolean).map((fileName) => ({ type: 'audio', fileName })),
  ]
  const items = Array.isArray(record.media) ? record.media : legacy
  return items.map((item) => {
    if (!item || typeof item !== 'object' || !['image', 'audio'].includes(item.type)) throw new Error('Invalid attachment type')
    const fileName = item.fileName ?? item.path
    if (typeof fileName !== 'string') throw new Error('Invalid attachment path')
    return {
      ...item, fileName, id: item.id ?? crypto.randomUUID(), originalName: item.originalName ?? fileName.split('/').at(-1) ?? '',
      mime: item.mime ?? '', caption: item.caption ?? '', blobRef: item.blobRef ?? '', size: item.size ?? 0,
    }
  })
}

function attachBlobRef(workspace: WorkspaceDraft, path: string, reference: string, size: number) {
  for (const item of [...workspace.cards, ...workspace.notes]) for (const media of item.media) if (media.fileName === path) {
    media.blobRef = reference
    media.size = size
  }
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = [], cell = ''
  let state: 'start' | 'text' | 'quoted' | 'closed' = 'start'
  const finishCell = () => { row.push(cell); cell = ''; state = 'start' }
  for (let index = text.charCodeAt(0) === 0xFEFF ? 1 : 0; index < text.length; index += 1) {
    const char = text[index]
    if (state === 'quoted') {
      if (char === '"') state = 'closed'
      else cell += char
    } else if (state === 'closed' && char === '"') {
      cell += '"'; state = 'quoted'
    } else if (char === ',') finishCell()
    else if (char === '\r' || char === '\n') {
      finishCell(); rows.push(row); row = []
      if (char === '\r' && text[index + 1] === '\n') index += 1
    } else if (state === 'closed') throw new Error('Unexpected character after CSV quote')
    else if (char === '"') {
      if (state !== 'start') throw new Error('Unexpected CSV quote')
      state = 'quoted'
    } else { cell += char; state = 'text' }
  }
  if (state === 'quoted') throw new Error('Unclosed CSV quote')
  if (cell || row.length || state !== 'start') { finishCell(); rows.push(row) }
  return rows
}
