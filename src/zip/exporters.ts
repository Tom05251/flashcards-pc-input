import JSZip from 'jszip'
import type { CardEntry, MediaItem, NoteEntry, WorkspaceData, WorkspaceDraft } from '../models'
import { cleanWorkspaceForExport } from '../models'
import { getMediaBlob } from '../storage/db'
import { assetPathFor } from '../security/files'

interface ExportResult {
  blob: Blob
  missingMedia: string[]
}

export async function buildAndroidZip(draft: WorkspaceDraft): Promise<ExportResult> {
  const zip = new JSZip()
  const used = new Set<string>()
  const missingMedia: string[] = []
  const workspace = cleanWorkspaceForExport(draft)

  const content: WorkspaceData = {
    ...workspace,
    cards: await Promise.all(workspace.cards.map((card) => prepareCard(card, zip, used, missingMedia))),
    notes: await Promise.all(workspace.notes.map((note) => prepareNote(note, zip, used, missingMedia))),
  }

  zip.file('content.json', JSON.stringify(content, exchangeReplacer, 2))
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
  return { blob, missingMedia }
}

export function buildWorkspaceJson(draft: WorkspaceDraft): Blob {
  const workspace = cleanWorkspaceForExport(draft)
  return new Blob([JSON.stringify({
    ...workspace,
    cards: workspace.cards.map(withMediaPaths),
    notes: workspace.notes.map(withMediaPaths),
  }, exchangeReplacer, 2)], { type: 'application/json;charset=utf-8' })
}

export function buildCardCsv(cards: CardEntry[]): Blob {
  return buildExchangeCsv(cards, [
    ['folder_path', 'folderPath'], ['front_text', 'question'], ['back_text', 'answer'], ['hint_text', 'hint'], ['hint2_text', 'hint2'],
    ['id', 'id'], ['stable_key', 'stableKey'], ['bookmarked', 'bookmarked'], ['example', 'example'], ['status', 'status'],
    ['selected', 'selected'], ['due_epoch_day', 'dueEpochDay'], ['interval_days', 'intervalDays'], ['last_review', 'lastReview'],
    ['bookmark_flags', 'bookmarkFlags'], ['bookmark_level', 'bookmarkLevel'], ['created_at', 'createdAt'], ['updated_at', 'updatedAt'],
    ['last_reviewed_at', 'lastReviewedAt'], ['timestamp_origin', 'timestampOrigin'], ['tags', 'tags'],
    ['question_highlights', 'questionHighlights'], ['answer_highlights', 'answerHighlights'], ['hint_highlights', 'hintHighlights'],
    ['hint2_highlights', 'hint2Highlights'], ['media_json', 'media'], ['image_path', 'imagePath'], ['audio_path', 'audioPath'],
  ])
}

export function buildNoteCsv(notes: NoteEntry[]): Blob {
  return buildExchangeCsv(notes, [
    ['folder_path', 'folderPath'], ['note_title', 'title'], ['body_text', 'body'], ['id', 'id'], ['stable_key', 'stableKey'],
    ['important', 'important'], ['unnecessary', 'unnecessary'], ['selected', 'selected'], ['due_epoch_day', 'dueEpochDay'],
    ['interval_days', 'intervalDays'], ['last_review', 'lastReview'], ['bookmark_flags', 'bookmarkFlags'], ['bookmark_level', 'bookmarkLevel'],
    ['created_at', 'createdAt'], ['updated_at', 'updatedAt'], ['last_reviewed_at', 'lastReviewedAt'], ['timestamp_origin', 'timestampOrigin'],
    ['tags', 'tags'], ['title_highlights', 'titleHighlights'], ['body_highlights', 'bodyHighlights'], ['media_json', 'media'],
    ['image_path', 'imagePath'], ['audio_path', 'audioPath'],
  ])
}

function buildExchangeCsv(entries: (CardEntry | NoteEntry)[], columns: [string, string][]): Blob {
  const rows = entries.map((entry) => {
    const record = withMediaPaths(entry) as unknown as Record<string, unknown>
    const present: string[] = []
    const cells = columns.map(([column, key]) => {
      let value = record[key]
      if (column === 'bookmarked' && value === undefined) value = record.isFavorite
      value = exchangeReplacer.call(record, key, value)
      if (value === undefined) return ''
      present.push(column)
      if (key === 'tags') return JSON.stringify(value)
      return Array.isArray(value) ? JSON.stringify(value, exchangeReplacer) : String(value)
    })
    // Empty cells alone cannot distinguish omitted metadata from an explicit reset.
    return [...cells, JSON.stringify(present)].map(csvCell).join(',')
  })
  return new Blob([[...columns.map(([column]) => column), 'present_fields'].join(',') + '\r\n' + rows.join('\r\n') + '\r\n'], { type: 'text/csv;charset=utf-8' })
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.rel = 'noopener'
  anchor.click()
  URL.revokeObjectURL(url)
}

async function prepareCard(card: CardEntry, zip: JSZip, used: Set<string>, missingMedia: string[]): Promise<CardEntry> {
  const media = await prepareMedia(card.media, zip, used, missingMedia, `Card ${card.id}`)
  return {
    ...card,
    cardId: card.id,
    media,
    audioPath: firstMedia(media, 'audio'),
    imagePath: allMediaPaths(media, 'image'),
  }
}

async function prepareNote(note: NoteEntry, zip: JSZip, used: Set<string>, missingMedia: string[]): Promise<NoteEntry> {
  const media = await prepareMedia(note.media, zip, used, missingMedia, `Note ${note.id}`)
  return { ...note, media, audioPath: firstMedia(media, 'audio'), imagePath: allMediaPaths(media, 'image') }
}

async function prepareMedia(media: MediaItem[], zip: JSZip, used: Set<string>, missingMedia: string[], owner: string): Promise<MediaItem[]> {
  const out: MediaItem[] = []
  for (const item of media) {
    const stored = item.blobRef ? await getMediaBlob(item.blobRef) : undefined
    if (!stored) {
      missingMedia.push(`${owner} ${item.type}: ${item.originalName || item.fileName}`)
      out.push({ ...item })
      continue
    }
    const zipPath = assetPathFor(item.fileName || item.originalName, `${item.type}/`, used)
    zip.file(zipPath, stored.blob)
    out.push({ ...item, fileName: zipPath })
  }
  return out
}

function firstMedia(media: MediaItem[], type: 'image' | 'audio') {
  return media.find((item) => item.type === type)?.fileName ?? ''
}

function csvCell(value: string) {
  const escaped = (value ?? '').replaceAll('"', '""')
  return /[",\n\r]/.test(escaped) ? `"${escaped}"` : escaped
}

function allMediaPaths(media: MediaItem[], type: 'image' | 'audio') {
  return media.filter((item) => item.type === type).map((item) => item.fileName).join('\n')
}

function withMediaPaths<T extends CardEntry | NoteEntry>(entry: T): T {
  return { ...entry, imagePath: allMediaPaths(entry.media, 'image'), audioPath: firstMedia(entry.media, 'audio') }
}

function exchangeReplacer(this: Record<string, unknown>, key: string, value: unknown) {
  if (['sourceFields', 'blobRef', 'size'].includes(key)) return undefined
  const fields = this.sourceFields
  if (Array.isArray(fields) && key === 'folderPath' && value === '' &&
    !fields.some((field) => ['folderPath', 'folder_path', 'folder'].includes(String(field)))) return undefined
  if (Array.isArray(fields) && ['media', 'imagePath', 'audioPath'].includes(key) && !fields.includes(key) &&
    (value === '' || (Array.isArray(value) && value.length === 0)) &&
    !fields.some((field) => ['media', 'imagePath', 'image_path', 'audioPath', 'audio_path'].includes(String(field)))) return undefined
  return value
}
