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

  zip.file('content.json', JSON.stringify(content, null, 2))
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
  return { blob, missingMedia }
}

export function buildWorkspaceJson(draft: WorkspaceDraft): Blob {
  return new Blob([JSON.stringify(cleanWorkspaceForExport(draft), null, 2)], { type: 'application/json;charset=utf-8' })
}

export function buildCardCsv(cards: CardEntry[]): Blob {
  const header = 'folder_path,front_text,back_text,hint_text,image_path,audio_path,tags,importance,audio_mode,extra_note,id_external,bookmarked,example,status,selected,due_epoch_day,interval_days,last_review'
  const lines = cards.map((card) =>
    [
      card.folderPath,
      card.question,
      card.answer,
      card.hint,
      firstMedia(card.media, 'image'),
      firstMedia(card.media, 'audio'),
      '',
      '1',
      'tts',
      '',
      String(card.id),
      String(card.isFavorite),
      'false',
      'Unset',
      'true',
      '0',
      String(card.srsLevel || 1),
      card.lastReviewedAt || '',
    ].map(csvCell).join(','),
  )
  return new Blob([[header, ...lines, ''].join('\n')], { type: 'text/csv;charset=utf-8' })
}

export function buildNoteCsv(notes: NoteEntry[]): Blob {
  const header = 'folder_path,note_title,body_text,image_path,audio_path,tags,importance,audio_mode,extra_note,id_external,important,unnecessary,selected,due_epoch_day,interval_days,last_review'
  const lines = notes.map((note) =>
    [
      note.folderPath,
      note.title,
      note.body,
      firstMedia(note.media, 'image'),
      firstMedia(note.media, 'audio'),
      '',
      '1',
      'tts',
      '',
      String(note.id),
      'false',
      'false',
      'true',
      '0',
      '1',
      '',
    ].map(csvCell).join(','),
  )
  return new Blob([[header, ...lines, ''].join('\n')], { type: 'text/csv;charset=utf-8' })
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
  const srsLevel = Math.max(1, card.srsLevel || 1)
  return {
    ...card,
    cardId: card.id,
    media,
    updatedAt: card.updatedAt || new Date().toISOString(),
    srsLevel,
    nextReviewAt: card.nextReviewAt || new Date().toISOString(),
    lastReviewedAt: card.lastReviewedAt || '',
    bookmarked: card.isFavorite,
    example: false,
    status: 'Unset',
    selected: true,
    dueEpochDay: todayEpochDay(),
    intervalDays: srsLevel,
    lastReview: 'Unset',
    audioPath: firstMedia(media, 'audio'),
    imagePath: firstMedia(media, 'image'),
  }
}

async function prepareNote(note: NoteEntry, zip: JSZip, used: Set<string>, missingMedia: string[]): Promise<NoteEntry> {
  const media = await prepareMedia(note.media, zip, used, missingMedia, `Note ${note.id}`)
  return {
    ...note,
    media,
    important: false,
    unnecessary: false,
    selected: true,
    dueEpochDay: todayEpochDay(),
    intervalDays: 1,
    lastReview: 'Unset',
    audioPath: firstMedia(media, 'audio'),
    imagePath: firstMedia(media, 'image'),
  }
}

async function prepareMedia(media: MediaItem[], zip: JSZip, used: Set<string>, missingMedia: string[], owner: string): Promise<MediaItem[]> {
  const out: MediaItem[] = []
  for (const item of media) {
    const stored = await getMediaBlob(item.blobRef)
    if (!stored) {
      missingMedia.push(`${owner} ${item.type}: ${item.originalName}`)
      continue
    }
    const zipPath = assetPathFor(item.fileName || item.originalName, item.mime, used)
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

function todayEpochDay() {
  return Math.floor(Date.now() / 86_400_000)
}
