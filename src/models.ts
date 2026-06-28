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

export const nextCardId = (cards: CardEntry[]) => Math.max(0, ...cards.map((card) => card.id)) + 1
export const nextNoteId = (notes: NoteEntry[]) => Math.max(0, ...notes.map((note) => note.id)) + 1

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
  const cardFolders = normalizeFolderPaths(draft.cardFolders)
  const noteFolders = normalizeFolderPaths(draft.noteFolders)
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
  return Array.from(new Set(paths.filter((path) => path && !isPseudoUncategorizedPath(path))))
}

function normalizeFolderNames(names: FolderNameItem[], folders: string[]) {
  const folderSet = new Set(folders)
  return names.filter((item) => folderSet.has(item.path) && !isPseudoUncategorizedPath(item.path))
}

function normalizeItemFolderPath(path: string, folders: string[]) {
  if (!path || isPseudoUncategorizedPath(path)) return ''
  const hasFolder = folders.some((folder) => path === folder || path.startsWith(`${folder}/`))
  return hasFolder ? path : ''
}

function isPseudoUncategorizedPath(path: string) {
  return path === '未分類' || path === 'Uncategorized'
}
