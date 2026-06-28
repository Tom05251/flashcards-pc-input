import JSZip from 'jszip'
import type { WorkspaceData, WorkspaceDraft } from '../models'
import { emptyWorkspace, normalizeWorkspaceDraft } from '../models'
import { safeZipPath } from '../security/files'
import { saveMediaBlob } from '../storage/db'

export interface ImportPreview {
  workspace: WorkspaceDraft
  warnings: string[]
}

export async function importWorkspaceFile(file: File): Promise<ImportPreview> {
  const ext = file.name.split('.').pop()?.toLowerCase()
  if (ext === 'zip') return importZip(file)
  if (ext === 'json') return importJson(await file.text())
  if (ext === 'csv') return importCsv(await file.text())
  throw new Error('Unsupported file type')
}

async function importZip(file: File): Promise<ImportPreview> {
  if (file.size > 200 * 1024 * 1024) throw new Error('ZIP file is too large')
  const zip = await JSZip.loadAsync(file)
  const content = zip.file('content.json')
  if (!content) throw new Error('content.json was not found')
  const workspace = normalizeWorkspace(JSON.parse(await content.async('string')))
  const warnings: string[] = []
  let totalSize = 0
  let count = 0
  for (const [path, entry] of Object.entries(zip.files)) {
    if (entry.dir || path === 'content.json') continue
    const safe = safeZipPath(path)
    if (!safe) {
      warnings.push(`Skipped unsafe ZIP entry: ${path}`)
      continue
    }
    count += 1
    if (count > 5000) throw new Error('ZIP has too many files')
    const blob = await entry.async('blob')
    totalSize += blob.size
    if (totalSize > 500 * 1024 * 1024) throw new Error('ZIP expanded size is too large')
    await saveMediaBlob(safe, blob, safe.split('/').pop() ?? safe, blob.type)
    attachBlobRef(workspace, safe)
  }
  return { workspace, warnings }
}

function importJson(text: string): ImportPreview {
  return { workspace: normalizeWorkspace(JSON.parse(text)), warnings: [] }
}

function importCsv(text: string): ImportPreview {
  const draft = emptyWorkspace()
  const rows = parseCsv(text)
  const [header = []] = rows
  const lower = header.map((cell) => cell.trim().toLowerCase())
  const isNote = lower.includes('note_title') || lower.includes('body_text')
  rows.slice(1).forEach((row, index) => {
    if (row.every((cell) => !cell.trim())) return
    const value = (key: string) => row[lower.indexOf(key)] ?? ''
    if (isNote) {
      draft.notes.push({
        id: index + 1,
        title: value('note_title') || value('title'),
        body: value('body_text') || value('body'),
        titleHighlights: [],
        bodyHighlights: [],
        folderPath: value('folder_path'),
        media: [],
      })
    } else {
      draft.cards.push({
        id: index + 1,
        question: value('front_text') || value('question'),
        answer: value('back_text') || value('answer'),
        hint: value('hint_text') || value('hint'),
        questionHighlights: [],
        answerHighlights: [],
        hintHighlights: [],
        folderPath: value('folder_path'),
        isFavorite: value('bookmarked') === 'true',
        updatedAt: '',
        srsLevel: Number(value('interval_days')) || 1,
        nextReviewAt: '',
        lastReviewedAt: value('last_review'),
        media: [],
      })
    }
  })
  return { workspace: draft, warnings: [] }
}

function normalizeWorkspace(raw: Partial<WorkspaceData>): WorkspaceDraft {
  const draft = emptyWorkspace()
  return normalizeWorkspaceDraft({
    ...draft,
    schemaVersion: 1,
    cards: Array.isArray(raw.cards) ? raw.cards.map((card, index) => ({ ...card, id: Number(card.id) || index + 1, media: card.media ?? [] })) as WorkspaceDraft['cards'] : [],
    notes: Array.isArray(raw.notes) ? raw.notes.map((note, index) => ({ ...note, id: Number(note.id) || index + 1, media: note.media ?? [] })) as WorkspaceDraft['notes'] : [],
    cardFolders: Array.isArray(raw.cardFolders) ? raw.cardFolders.filter(Boolean) : [],
    noteFolders: Array.isArray(raw.noteFolders) ? raw.noteFolders.filter(Boolean) : [],
    cardFolderNames: Array.isArray(raw.cardFolderNames) ? raw.cardFolderNames.filter((item) => item.path) : [],
    noteFolderNames: Array.isArray(raw.noteFolderNames) ? raw.noteFolderNames.filter((item) => item.path) : [],
    uiState: raw.uiState ?? { activeTab: 'cards', selectedFolderPath: '' },
  })
}

function attachBlobRef(workspace: WorkspaceDraft, path: string) {
  for (const item of [...workspace.cards, ...workspace.notes]) {
    for (const media of item.media) {
      if (media.fileName === path) {
        media.blobRef = path
      }
    }
  }
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]
    const next = text[i + 1]
    if (quoted) {
      if (char === '"' && next === '"') {
        cell += '"'
        i += 1
      } else if (char === '"') {
        quoted = false
      } else {
        cell += char
      }
    } else if (char === '"') {
      quoted = true
    } else if (char === ',') {
      row.push(cell)
      cell = ''
    } else if (char === '\n') {
      row.push(cell.replace(/\r$/, ''))
      rows.push(row)
      row = []
      cell = ''
    } else {
      cell += char
    }
  }
  row.push(cell.replace(/\r$/, ''))
  rows.push(row)
  return rows
}
