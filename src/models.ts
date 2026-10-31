export type EntryMode = 'cards' | 'notes'
export type HighlightColor = 'Yellow' | 'Green' | 'Blue' | 'Red'
export type MediaType = 'image' | 'audio'

export interface TextHighlight {
  start: number
  end: number
  color: HighlightColor
  text: string
  prefix?: string
  suffix?: string
}

// Stale positions/text are retained for review. This checks only the shape
// needed to display/edit a span safely; it never changes imported metadata.
export function isSafeTextHighlight(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const item = value as Record<string, unknown>
  if (!Number.isSafeInteger(item.start) || !Number.isSafeInteger(item.end) || typeof item.color !== 'string' ||
      !['blue', 'red', 'yellow', 'green'].includes(item.color.toLowerCase())) return false
  return ['text', 'prefix', 'suffix'].every((key) => item[key] == null || typeof item[key] === 'string')
}

export interface MediaItem {
  id: string
  type: MediaType
  originalName: string
  fileName: string
  mime: string
  caption: string
  blobRef: string
  size: number
}

export interface CardEntry {
  id: number
  sourceFields?: string[]
  stableKey?: string
  createdAt?: string
  timestampOrigin?: string
  hint2?: string
  hint2Highlights?: TextHighlight[]
  tags?: string[]
  bookmarkFlags?: number
  bookmarkLevel?: number
  cardId?: number
  question: string
  answer: string
  hint: string
  questionHighlights: TextHighlight[]
  answerHighlights: TextHighlight[]
  hintHighlights: TextHighlight[]
  folderPath: string
  isFavorite: boolean
  updatedAt: string
  srsLevel: number
  nextReviewAt: string
  lastReviewedAt: string
  media: MediaItem[]
  bookmarked?: boolean
  example?: boolean
  status?: string
  selected?: boolean
  dueEpochDay?: number
  intervalDays?: number
  lastReview?: string
  audioPath?: string
  imagePath?: string
}

export interface NoteEntry {
  id: number
  sourceFields?: string[]
  stableKey?: string
  createdAt?: string
  updatedAt?: string
  timestampOrigin?: string
  lastReviewedAt?: string
  tags?: string[]
  bookmarkFlags?: number
  bookmarkLevel?: number
  title: string
  body: string
  titleHighlights: TextHighlight[]
  bodyHighlights: TextHighlight[]
  folderPath: string
  media: MediaItem[]
  important?: boolean
  unnecessary?: boolean
  selected?: boolean
  dueEpochDay?: number
  intervalDays?: number
  lastReview?: string
  audioPath?: string
  imagePath?: string
}

export interface FolderNameItem {
  path: string
  displayName: string
  createdAtEpochMillis?: number
  updatedAtEpochMillis?: number
}

export interface WorkspaceUiState {
  activeTab: EntryMode
  selectedFolderPath: string
}

export interface WorkspaceData {
  schemaVersion: 1
  cards: CardEntry[]
  notes: NoteEntry[]
  cardFolders: string[]
  noteFolders: string[]
  cardFolderNames: FolderNameItem[]
  noteFolderNames: FolderNameItem[]
  uiState: WorkspaceUiState
}

export interface WorkspaceDraft extends WorkspaceData {
  updatedAt: string
}

export const emptyWorkspace = (): WorkspaceDraft => ({
  schemaVersion: 1,
  cards: [],
  notes: [],
  cardFolders: [],
  noteFolders: [],
  cardFolderNames: [],
  noteFolderNames: [],
  uiState: { activeTab: 'cards', selectedFolderPath: '' },
  updatedAt: new Date().toISOString(),
})

function nextPositiveId(entries: { id: number }[]) {
  const used = new Set(entries.map((entry) => entry.id).filter((id) => Number.isInteger(id) && id > 0 && id <= 2147483647))
  let largest = 0
  used.forEach((id) => { largest = Math.max(largest, id) })
  if (largest < 2147483647) return largest + 1
  for (let candidate = 1; candidate <= 2147483647; candidate += 1) if (!used.has(candidate)) return candidate
  throw new Error('No unused positive identifier is available')
}

export const nextCardId = (cards: CardEntry[]) => nextPositiveId(cards)
export const nextNoteId = (notes: NoteEntry[]) => nextPositiveId(notes)

export function newRecordIdentity() {
  const now = new Date().toISOString()
  return { stableKey: `pwa-input:${crypto.randomUUID()}`, createdAt: now, updatedAt: now, timestampOrigin: 'native' }
}

export function mergeImportedEntries<T extends { id: number; stableKey?: string; sourceFields?: string[] }>(current: T[], incoming: T[]): T[] {
  const result = [...current]
  for (const entry of incoming) {
    const match = entry.stableKey ? result.findIndex((existing) => existing.stableKey === entry.stableKey) : -1
    if (match >= 0) {
      const updates = { ...entry } as T & Record<string, unknown>
      const fields = entry.sourceFields
      if (fields && !fields.some((field) => ['folderPath', 'folder_path', 'folder'].includes(field))) Reflect.deleteProperty(updates, 'folderPath')
      if (fields && !fields.some((field) => ['media', 'imagePath', 'image_path', 'audioPath', 'audio_path'].includes(field))) Reflect.deleteProperty(updates, 'media')
      const previous = result[match]
      result[match] = { ...previous, ...updates, id: previous.id,
        sourceFields: [...new Set([...(previous.sourceFields ?? Object.keys(previous)), ...(fields ?? Object.keys(entry))])] }
    } else {
      const id = result.some((existing) => existing.id === entry.id) ? nextPositiveId(result) : entry.id
      result.push({ ...entry, id, ...('cardId' in entry ? { cardId: id } : {}) })
    }
  }
  return result
}

export function cleanWorkspaceForExport(draft: WorkspaceDraft): WorkspaceData {
  const normalized = normalizeWorkspaceDraft(draft)
  return {
    schemaVersion: 1,
    cards: normalized.cards,
    notes: normalized.notes,
    cardFolders: normalized.cardFolders,
    noteFolders: normalized.noteFolders,
    cardFolderNames: normalized.cardFolderNames,
    noteFolderNames: normalized.noteFolderNames,
    uiState: normalized.uiState,
  }
}

export function normalizeWorkspaceDraft(draft: WorkspaceDraft): WorkspaceDraft {
  const cardFolders = normalizeFolderPaths([...draft.cardFolders, ...draft.cards.map((card) => card.folderPath)])
  const noteFolders = normalizeFolderPaths([...draft.noteFolders, ...draft.notes.map((note) => note.folderPath)])
  return {
    ...draft,
    cards: draft.cards.map((card) => ({ ...card, folderPath: normalizeItemFolderPath(card.folderPath, cardFolders) })),
    notes: draft.notes.map((note) => ({ ...note, folderPath: normalizeItemFolderPath(note.folderPath, noteFolders) })),
    cardFolders,
    noteFolders,
    cardFolderNames: normalizeFolderNames(draft.cardFolderNames, cardFolders),
    noteFolderNames: normalizeFolderNames(draft.noteFolderNames, noteFolders),
    uiState: {
      ...draft.uiState,
      selectedFolderPath: normalizeItemFolderPath(draft.uiState.selectedFolderPath, draft.uiState.activeTab === 'cards' ? cardFolders : noteFolders),
    },
  }
}

function normalizeFolderPaths(paths: string[]) {
  const result = new Set<string>()
  for (const path of paths) {
    let parent = ''
    for (const segment of (path ?? '').split('/').map((part) => part.trim()).filter(Boolean)) {
      parent = parent ? `${parent}/${segment}` : segment
      result.add(parent)
    }
  }
  return [...result]
}

function normalizeFolderNames(names: FolderNameItem[], folders: string[]) {
  const folderSet = new Set(folders)
  return names.filter((item) => item.path === '' || folderSet.has(item.path))
}

function normalizeItemFolderPath(path: string, folders: string[]) {
  const normalized = (path ?? '').split('/').map((part) => part.trim()).filter(Boolean).join('/')
  return normalized && folders.includes(normalized) ? normalized : ''
}
