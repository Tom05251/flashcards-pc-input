import { useEffect, useMemo, useRef, useState } from 'react'
import type { Dispatch, PointerEvent as ReactPointerEvent, ReactNode, SetStateAction } from 'react'
import { I18nProvider } from './i18n/I18nProvider'
import { useI18n } from './i18n/useI18n'
import { supportedLanguages } from './i18n/languages'
import type { CardEntry, EntryMode, HighlightColor, MediaItem, NoteEntry, TextHighlight, WorkspaceDraft } from './models'
import { emptyWorkspace, nextCardId, nextNoteId, normalizeWorkspaceDraft } from './models'
import { isAllowedMedia, mediaTypeFromMime, safeZipName } from './security/files'
import { deleteMediaBlob, getMediaBlob, loadWorkspaceDraft, saveMediaBlob, saveWorkspaceDraft } from './storage/db'
import { buildAndroidZip, buildCardCsv, buildWorkspaceJson, downloadBlob } from './zip/exporters'
import { importWorkspaceFile } from './zip/importers'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

const highlightColors: HighlightColor[] = ['Blue', 'Red', 'Yellow', 'Green']
const tutorialStepCount = 15
const defaultColumnWidths = { left: 590, right: 220 }
const columnWidthStorageKey = 'flashcards-pwa-column-widths'
const tutorialTargets = [
  ['folder-tree'],
  ['folder-name', 'folder-add', 'folder-sibling-add', 'folder-independent-add'],
  ['folder-rename', 'folder-delete'],
  ['card-editor'],
  ['card-editor', 'highlight-toolbar'],
  ['note-editor'],
  ['note-editor', 'highlight-toolbar'],
  ['destination', 'media', 'media-preview'],
  ['create-actions', 'item-list'],
  ['fast-edit'],
  ['item-list'],
  ['open-file'],
  ['templates'],
  ['zip-export'],
  ['help'],
]

function App() {
  return (
    <I18nProvider>
      <WindowsLikePwa />
    </I18nProvider>
  )
}

function WindowsLikePwa() {
  const { t, language, setLanguage } = useI18n()
  const [workspace, setWorkspace] = useState<WorkspaceDraft>(() => emptyWorkspace())
  const [mode, setMode] = useState<EntryMode>('cards')
  const [theme, setTheme] = useState(() => {
    const requestedTheme = new URLSearchParams(window.location.search).get('theme')
    if (requestedTheme === 'light' || requestedTheme === 'dark') return requestedTheme
    return localStorage.getItem('flashcards-pwa-theme') ?? 'dark'
  })
  const [message, setMessage] = useState<{ text: string; persistent: boolean } | null>(null)
  const [showHelp, setShowHelp] = useState(false)
  const [showTutorial, setShowTutorial] = useState(() => localStorage.getItem('flashcards-pwa-tutorial-completed') !== 'true')
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstalled, setIsInstalled] = useState(() => isStandaloneDisplay())
  const [tutorialStep, setTutorialStep] = useState(0)
  const [fastEdit, setFastEdit] = useState(false)
  const [folderName, setFolderName] = useState('')
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(() => new Set(['']))
  const [search, setSearch] = useState('')
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null)
  const [highlightModal, setHighlightModal] = useState<{ field: HighlightField; title: string; items: TextHighlight[] } | null>(null)
  const [cardForm, setCardForm] = useState<CardForm>(blankCardForm())
  const [noteForm, setNoteForm] = useState<NoteForm>(blankNoteForm())
  const [fieldSelections, setFieldSelections] = useState<Record<HighlightField, TextSelectionState>>(() => blankSelections())
  const [columnWidths, setColumnWidths] = useState(() => loadColumnWidths())
  const gridRef = useRef<HTMLElement | null>(null)
  const dragState = useRef<{ edge: 'left' | 'right'; startX: number; startLeft: number; startRight: number } | null>(null)

  const selectedFolder = workspace.uiState.selectedFolderPath
  const activeFolders = mode === 'cards' ? workspace.cardFolders : workspace.noteFolders
  const activeFolderNames = mode === 'cards' ? workspace.cardFolderNames : workspace.noteFolderNames
  const activeItems = mode === 'cards' ? workspace.cards : workspace.notes
  const formMedia = mode === 'cards' ? cardForm.media : noteForm.media
  const currentFolderLabel = selectedFolder ? resolveFolderName(activeFolderNames, selectedFolder) : t('folder.uncategorized')
  const activeTutorialTargets = showTutorial ? tutorialTargets[tutorialStep] : []

  useEffect(() => {
    loadWorkspaceDraft().then((saved) => {
      if (!saved) return
      setWorkspace(normalizeWorkspaceDraft(saved))
      setMode(saved.uiState.activeTab)
    })
  }, [])

  useEffect(() => {
    document.body.dataset.theme = theme
    localStorage.setItem('flashcards-pwa-theme', theme)
  }, [theme])

  useEffect(() => {
    document.documentElement.lang = language
    document.documentElement.translate = false
    document.documentElement.classList.add('notranslate')
    document.body.translate = false
    document.body.classList.add('notranslate')
  }, [language])

  useEffect(() => {
    saveWorkspaceDraft({ ...workspace, uiState: { ...workspace.uiState, activeTab: mode } }).catch((error) => notify(String(error), true))
  }, [workspace, mode])

  useEffect(() => {
    if (!message || message.persistent) return
    const timer = window.setTimeout(() => setMessage(null), 4200)
    return () => window.clearTimeout(timer)
  }, [message])

  useEffect(() => {
    armPwaBackGuard()
  }, [])

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event as BeforeInstallPromptEvent)
    }
    const onAppInstalled = () => {
      setIsInstalled(true)
      setInstallPrompt(null)
      notify(t('install.installedMessage'))
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    window.addEventListener('appinstalled', onAppInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
      window.removeEventListener('appinstalled', onAppInstalled)
    }
  }, [t])

  useEffect(() => {
    const onPopState = () => {
      armPwaBackGuard()
      if (highlightModal) {
        setHighlightModal(null)
        return
      }
      if (showHelp) {
        setShowHelp(false)
        return
      }
      if (showTutorial) {
        if (tutorialStep > 0) {
          goTutorialStep(tutorialStep - 1)
          return
        }
        notify(t('navigation.backGuard'))
        return
      }
      notify(t('navigation.backGuard'))
    }
    const onHashChange = () => {
      if (!isPwaGuardHash(window.location.hash)) {
        armPwaBackGuard()
        notify(t('navigation.backGuard'))
      }
    }
    const onPageShow = () => armPwaBackGuard()
    const onFocus = () => armPwaBackGuard()
    window.addEventListener('popstate', onPopState)
    window.addEventListener('hashchange', onHashChange)
    window.addEventListener('pageshow', onPageShow)
    window.addEventListener('focus', onFocus)
    return () => {
      window.removeEventListener('popstate', onPopState)
      window.removeEventListener('hashchange', onHashChange)
      window.removeEventListener('pageshow', onPageShow)
      window.removeEventListener('focus', onFocus)
    }
  }, [highlightModal, showHelp, showTutorial, tutorialStep, t])

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [])

  useEffect(() => {
    localStorage.setItem(columnWidthStorageKey, JSON.stringify(columnWidths))
  }, [columnWidths])

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      const drag = dragState.current
      const grid = gridRef.current
      if (!drag || !grid) return
      const bounds = grid.getBoundingClientRect()
      if (drag.edge === 'left') {
        const nextLeft = clamp(event.clientX - bounds.left, 520, 760)
        setColumnWidths((current) => ({ ...current, left: nextLeft }))
      } else {
        const nextRight = clamp(bounds.right - event.clientX, 200, 340)
        setColumnWidths((current) => ({ ...current, right: nextRight }))
      }
    }
    const onPointerUp = () => {
      dragState.current = null
      document.body.classList.remove('resizing-columns')
    }
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }
  }, [])

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase()
    const folderItems = activeItems.filter((item) => isItemInFolder(item, selectedFolder))
    if (!q) return folderItems
    return folderItems.filter((item) => {
      const text = 'question' in item ? `${item.question} ${item.answer} ${item.hint}` : `${item.title} ${item.body}`
      return text.toLowerCase().includes(q)
    })
  }, [activeItems, search, selectedFolder])

  function updateWorkspace(next: WorkspaceDraft) {
    setWorkspace({ ...next, updatedAt: new Date().toISOString() })
  }

  function notify(text: string, persistent = false) {
    setMessage({ text, persistent })
  }

  async function installAppToPc() {
    if (isStandaloneDisplay()) {
      setIsInstalled(true)
      notify(t('install.alreadyInstalled'), true)
      return
    }
    if (!installPrompt) {
      notify(t('install.manualShortcut'), true)
      return
    }
    await installPrompt.prompt()
    const choice = await installPrompt.userChoice
    if (choice.outcome === 'accepted') {
      setIsInstalled(true)
      setInstallPrompt(null)
      notify(t('install.installedMessage'))
    } else {
      notify(t('install.manualShortcut'), true)
    }
  }

  function selectFolder(path: string) {
    updateWorkspace({ ...workspace, uiState: { ...workspace.uiState, selectedFolderPath: path } })
  }

  function startColumnResize(edge: 'left' | 'right', event: ReactPointerEvent<HTMLDivElement>) {
    dragState.current = { edge, startX: event.clientX, startLeft: columnWidths.left, startRight: columnWidths.right }
    document.body.classList.add('resizing-columns')
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function addFolder(kind: 'child' | 'sibling' | 'independent') {
    const name = folderName.trim()
    if (!name) return notify(t('validation.folderRequired'))
    if (/[\\/]/.test(name)) return notify(t('folder.invalidName'))
    if (kind === 'child' && !selectedFolder) return notify(t('folder.noChildForUncategorized'))
    if (kind === 'sibling' && !selectedFolder) return notify(t('folder.noSiblingForUncategorized'))
    const parentPath = kind === 'child' ? selectedFolder : kind === 'sibling' ? parentPathOf(selectedFolder) : ''
    const path = parentPath ? `${parentPath}/${name}` : name
    if (activeFolders.includes(path)) return notify(t('folder.duplicate'))
    const names = [...activeFolderNames, { path, displayName: name }]
    const nextFolders = kind === 'independent'
      ? [path, ...activeFolders.filter((item) => item && item !== path)]
      : [...activeFolders.filter(Boolean), path]
    setExpandedFolders((previous) => new Set([...previous, parentPath, path]))
    updateWorkspace(mode === 'cards'
      ? { ...workspace, cardFolders: nextFolders, cardFolderNames: names, uiState: { ...workspace.uiState, selectedFolderPath: path } }
      : { ...workspace, noteFolders: nextFolders, noteFolderNames: names, uiState: { ...workspace.uiState, selectedFolderPath: path } })
    setFolderName('')
  }

  function renameFolder() {
    const name = folderName.trim()
    if (!selectedFolder || !name) return
    if (/[\\/]/.test(name)) return notify(t('folder.invalidName'))
    const parent = selectedFolder.split('/').slice(0, -1).join('/')
    const nextPath = parent ? `${parent}/${name}` : name
    const replacePath = (path: string) => path === selectedFolder || path.startsWith(`${selectedFolder}/`)
      ? `${nextPath}${path.slice(selectedFolder.length)}`
      : path
    updateWorkspace({
      ...workspace,
      cards: workspace.cards.map((card) => ({ ...card, folderPath: replacePath(card.folderPath) })),
      notes: workspace.notes.map((note) => ({ ...note, folderPath: replacePath(note.folderPath) })),
      cardFolders: workspace.cardFolders.map(replacePath),
      noteFolders: workspace.noteFolders.map(replacePath),
      cardFolderNames: workspace.cardFolderNames.map((item) => ({ path: replacePath(item.path), displayName: item.path === selectedFolder ? name : item.displayName })),
      noteFolderNames: workspace.noteFolderNames.map((item) => ({ path: replacePath(item.path), displayName: item.path === selectedFolder ? name : item.displayName })),
      uiState: { ...workspace.uiState, selectedFolderPath: nextPath },
    })
    setFolderName('')
  }

  function deleteFolder() {
    if (!selectedFolder) return
    const hasItems = [...workspace.cards, ...workspace.notes].some((item) => item.folderPath === selectedFolder || item.folderPath.startsWith(`${selectedFolder}/`))
    if (hasItems) return notify(t('folder.nonempty'))
    const keep = (path: string) => path !== selectedFolder && !path.startsWith(`${selectedFolder}/`)
    updateWorkspace({
      ...workspace,
      cardFolders: workspace.cardFolders.filter(keep),
      noteFolders: workspace.noteFolders.filter(keep),
      cardFolderNames: workspace.cardFolderNames.filter((item) => keep(item.path)),
      noteFolderNames: workspace.noteFolderNames.filter((item) => keep(item.path)),
      uiState: { ...workspace.uiState, selectedFolderPath: '' },
    })
  }

  function setModeAndTab(next: EntryMode) {
    setMode(next)
    setSelectedItemId(null)
    updateWorkspace({ ...workspace, uiState: { ...workspace.uiState, activeTab: next, selectedFolderPath: '' } })
  }

  async function addMedia(files: FileList | null) {
    if (!files) return
    const accepted: MediaItem[] = []
    for (const file of Array.from(files)) {
      if (!isAllowedMedia(file)) {
        notify(t('pwa.file.unsupported'))
        continue
      }
      const id = crypto.randomUUID()
      await saveMediaBlob(id, file, file.name, file.type)
      accepted.push({
        id,
        type: mediaTypeFromMime(file.type),
        originalName: file.name,
        fileName: safeZipName(file.name, file.name),
        mime: file.type,
        caption: '',
        blobRef: id,
        size: file.size,
      })
    }
    if (mode === 'cards') setCardForm({ ...cardForm, media: [...cardForm.media, ...accepted] })
    else setNoteForm({ ...noteForm, media: [...noteForm.media, ...accepted] })
  }

  async function removeMedia(id: string) {
    await deleteMediaBlob(id)
    setCardForm({ ...cardForm, media: cardForm.media.filter((item) => item.id !== id) })
    setNoteForm({ ...noteForm, media: noteForm.media.filter((item) => item.id !== id) })
  }

  function updateMediaCaption(id: string, caption: string) {
    const update = (item: MediaItem) => item.id === id ? { ...item, caption } : item
    if (mode === 'cards') setCardForm({ ...cardForm, media: cardForm.media.map(update) })
    else setNoteForm({ ...noteForm, media: noteForm.media.map(update) })
  }

  function createCurrent(continueEditing = false) {
    if (mode === 'cards') {
      if (!cardForm.question.trim() || !cardForm.answer.trim()) return notify(t('validation.cardRequired'))
      const id = selectedItemId ?? nextCardId(workspace.cards)
      const card: CardEntry = {
        id,
        question: cardForm.question,
        answer: cardForm.answer,
        hint: cardForm.hint,
        questionHighlights: cardForm.questionHighlights,
        answerHighlights: cardForm.answerHighlights,
        hintHighlights: cardForm.hintHighlights,
        folderPath: selectedFolder,
        isFavorite: false,
        updatedAt: new Date().toISOString(),
        srsLevel: 1,
        nextReviewAt: '',
        lastReviewedAt: '',
        media: cardForm.media,
      }
      updateWorkspace({
        ...workspace,
        cards: selectedItemId == null
          ? [...workspace.cards, card]
          : workspace.cards.map((item) => item.id === selectedItemId ? card : item),
      })
      setCardForm(blankCardForm())
    } else {
      if (!noteForm.title.trim() || !noteForm.body.trim()) return notify(t('validation.noteRequired'))
      const id = selectedItemId ?? nextNoteId(workspace.notes)
      const note: NoteEntry = {
        id,
        title: noteForm.title,
        body: noteForm.body,
        titleHighlights: noteForm.titleHighlights,
        bodyHighlights: noteForm.bodyHighlights,
        folderPath: selectedFolder,
        media: noteForm.media,
      }
      updateWorkspace({
        ...workspace,
        notes: selectedItemId == null
          ? [...workspace.notes, note]
          : workspace.notes.map((item) => item.id === selectedItemId ? note : item),
      })
      setNoteForm(blankNoteForm())
    }
    setSelectedItemId(null)
    if (continueEditing || fastEdit) notify(t('status.autosaved'))
  }

  function clearCurrentForm() {
    setSelectedItemId(null)
    if (mode === 'cards') setCardForm(blankCardForm())
    else setNoteForm(blankNoteForm())
  }

  function deleteCurrentItem() {
    if (selectedItemId == null) return
    if (mode === 'cards') {
      updateWorkspace({ ...workspace, cards: workspace.cards.filter((item) => item.id !== selectedItemId) })
      setCardForm(blankCardForm())
    } else {
      updateWorkspace({ ...workspace, notes: workspace.notes.filter((item) => item.id !== selectedItemId) })
      setNoteForm(blankNoteForm())
    }
    setSelectedItemId(null)
  }

  function selectItem(item: CardEntry | NoteEntry) {
    setSelectedItemId(item.id)
    if ('question' in item) {
      setMode('cards')
      selectFolder(item.folderPath)
      setCardForm({
        question: item.question,
        answer: item.answer,
        hint: item.hint,
        questionHighlights: item.questionHighlights,
        answerHighlights: item.answerHighlights,
        hintHighlights: item.hintHighlights,
        media: item.media,
      })
    } else {
      setMode('notes')
      selectFolder(item.folderPath)
      setNoteForm({
        title: item.title,
        body: item.body,
        titleHighlights: item.titleHighlights,
        bodyHighlights: item.bodyHighlights,
        media: item.media,
      })
    }
  }

  function moveSelected(direction: -1 | 1) {
    if (selectedItemId == null) return
    if (mode === 'cards') {
      updateWorkspace({ ...workspace, cards: moveByIdInFolder(workspace.cards, selectedItemId, selectedFolder, direction) })
    } else {
      updateWorkspace({ ...workspace, notes: moveByIdInFolder(workspace.notes, selectedItemId, selectedFolder, direction) })
    }
  }

  function addHighlight(field: HighlightField, color: HighlightColor) {
    const activeElement = document.activeElement
    const activeSelection = activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement
      ? selectionFromElement(field, activeElement)
      : null
    const selection = activeSelection?.text ? activeSelection : fieldSelections[field]
    if (!selection.text) return notify(t('highlight.selectText'))
    const highlight = { start: selection.start, end: selection.end, color, text: selection.text, prefix: '', suffix: '' }
    if (field === 'CardQuestion') setCardForm({ ...cardForm, questionHighlights: applyHighlight(cardForm.question, cardForm.questionHighlights, highlight) })
    if (field === 'CardAnswer') setCardForm({ ...cardForm, answerHighlights: applyHighlight(cardForm.answer, cardForm.answerHighlights, highlight) })
    if (field === 'CardHint') setCardForm({ ...cardForm, hintHighlights: applyHighlight(cardForm.hint, cardForm.hintHighlights, highlight) })
    if (field === 'NoteTitle') setNoteForm({ ...noteForm, titleHighlights: applyHighlight(noteForm.title, noteForm.titleHighlights, highlight) })
    if (field === 'NoteBody') setNoteForm({ ...noteForm, bodyHighlights: applyHighlight(noteForm.body, noteForm.bodyHighlights, highlight) })
  }

  function highlightsFor(field: HighlightField) {
    if (field === 'CardQuestion') return cardForm.questionHighlights
    if (field === 'CardAnswer') return cardForm.answerHighlights
    if (field === 'CardHint') return cardForm.hintHighlights
    if (field === 'NoteTitle') return noteForm.titleHighlights
    return noteForm.bodyHighlights
  }

  function clearHighlights(field: HighlightField) {
    if (field === 'CardQuestion') setCardForm({ ...cardForm, questionHighlights: [] })
    if (field === 'CardAnswer') setCardForm({ ...cardForm, answerHighlights: [] })
    if (field === 'CardHint') setCardForm({ ...cardForm, hintHighlights: [] })
    if (field === 'NoteTitle') setNoteForm({ ...noteForm, titleHighlights: [] })
    if (field === 'NoteBody') setNoteForm({ ...noteForm, bodyHighlights: [] })
  }

  function removeHighlight(field: HighlightField, index: number) {
    const removeAt = (items: TextHighlight[]) => items.filter((_, itemIndex) => itemIndex !== index)
    if (field === 'CardQuestion') setCardForm({ ...cardForm, questionHighlights: removeAt(cardForm.questionHighlights) })
    if (field === 'CardAnswer') setCardForm({ ...cardForm, answerHighlights: removeAt(cardForm.answerHighlights) })
    if (field === 'CardHint') setCardForm({ ...cardForm, hintHighlights: removeAt(cardForm.hintHighlights) })
    if (field === 'NoteTitle') setNoteForm({ ...noteForm, titleHighlights: removeAt(noteForm.titleHighlights) })
    if (field === 'NoteBody') setNoteForm({ ...noteForm, bodyHighlights: removeAt(noteForm.bodyHighlights) })
  }

  function rememberSelection(field: HighlightField, value: string, target: HTMLInputElement | HTMLTextAreaElement) {
    const start = target.selectionStart ?? 0
    const end = target.selectionEnd ?? start
    const text = start === end ? '' : value.slice(start, end)
    setFieldSelections((current) => ({ ...current, [field]: { start, end, text } }))
  }

  function showHighlights(field: HighlightField) {
    setHighlightModal({
      field,
      title: t(`highlight.field.${fieldNameKey(field)}`),
      items: highlightsFor(field),
    })
  }

  async function saveZip() {
    const { blob, missingMedia } = await buildAndroidZip(workspace)
    const warning = missingMedia.length ? `${t('export.missingMedia', missingMedia.join(', '))} ` : ''
    const fileName = 'cards_sync.zip'
    const savedByPicker = await saveBlobWithPicker(blob, fileName)
    notify(`${warning}${savedByPicker === 'picked' ? t('save.success', fileName) : savedByPicker === 'cancelled' ? t('save.cancelled') : t('save.downloadFallback', fileName)}`, Boolean(warning))
  }

  async function downloadZipTemplate() {
    const { blob } = await buildAndroidZip(emptyWorkspace())
    downloadBlob(blob, 'cards_sync_template.zip')
    notify(t('export.ready', 'cards_sync_template.zip'))
  }

  async function openFile(file: File | undefined, replace: boolean) {
    if (!file) return
    const preview = await importWorkspaceFile(file)
    if (replace) {
      updateWorkspace(preview.workspace)
    } else {
      updateWorkspace({
        ...workspace,
        cards: [...workspace.cards, ...preview.workspace.cards],
        notes: [...workspace.notes, ...preview.workspace.notes],
        cardFolders: Array.from(new Set([...workspace.cardFolders, ...preview.workspace.cardFolders])),
        noteFolders: Array.from(new Set([...workspace.noteFolders, ...preview.workspace.noteFolders])),
        cardFolderNames: mergeFolderNames(workspace.cardFolderNames, preview.workspace.cardFolderNames),
        noteFolderNames: mergeFolderNames(workspace.noteFolderNames, preview.workspace.noteFolderNames),
      })
    }
    notify(`${t('import.completed')} ${preview.warnings.join(' ')}`)
  }

  const tutorialSteps = useMemo(() => Array.from({ length: tutorialStepCount }, (_, index) => ({
    title: t(`tutorial.step.${index + 1}.title`),
    body: t(`tutorial.step.${index + 1}.body`),
  })), [t])

  function closeTutorial() {
    localStorage.setItem('flashcards-pwa-tutorial-completed', 'true')
    setShowTutorial(false)
    setTutorialStep(0)
  }

  function goTutorialStep(nextStep: number) {
    if (nextStep < 0 || nextStep >= tutorialStepCount) return
    const nextTarget = tutorialTargets[nextStep]
    if (nextTarget.includes('card-editor')) setMode('cards')
    if (nextTarget.includes('note-editor')) setMode('notes')
    setTutorialStep(nextStep)
  }

  return (
    <div className="desktop-shell notranslate" translate="no">
      <header className="windows-top panel">
        <div className="brand">
          <h1>{t('app.title')}</h1>
          <p>{t('app.subtitle')}</p>
        </div>
        <div className="toolbar" aria-label="main actions">
          <select value={language} onChange={(event) => setLanguage(event.target.value)} aria-label={t('button.language')}>
            {supportedLanguages.map((item) => <option value={item.code} key={item.code}>{languageNameForUi(item.code, language, item.displayName)}{item.beta ? ` (${t('language.beta')})` : ''}</option>)}
          </select>
          <button className="primary" onClick={installAppToPc}>{isInstalled ? t('install.installed') : t('install.addToPc')}</button>
          <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? t('button.light') : t('button.dark')}</button>
          <button className={withTutorialFocus('', activeTutorialTargets, 'help')} onClick={() => setShowHelp(true)}>{t('button.help')}</button>
          <label className={withTutorialFocus('file-button', activeTutorialTargets, 'open-file')}>{t('button.open')}<input type="file" accept=".zip,.json,.csv" onChange={(event) => openFile(event.target.files?.[0], false)} /></label>
          <button className={withTutorialFocus('', activeTutorialTargets, 'templates')} onClick={() => downloadBlob(buildCardCsv(workspace.cards), 'cards_template.csv')}>{t('button.csvTemplate')}</button>
          <button className={withTutorialFocus('', activeTutorialTargets, 'templates')} onClick={() => downloadBlob(buildWorkspaceJson(workspace), 'workspace.json')}>{t('button.jsonTemplate')}</button>
          <button className={withTutorialFocus('', activeTutorialTargets, 'templates')} onClick={downloadZipTemplate}>{t('button.zipTemplate')}</button>
          <button onClick={saveZip} className={withTutorialFocus('primary', activeTutorialTargets, 'zip-export')}>{t('button.saveZip')}</button>
        </div>
        <div className="install-guidance">
          <strong>{t('install.guidanceTitle')}</strong>
          <span>{t('install.guidanceBody')}</span>
        </div>
      </header>

      {message && <div className="status-line panel"><span>{message.text}</span><button onClick={() => setMessage(null)}>{t('button.close')}</button></div>}

      <main
        className="windows-grid"
        ref={gridRef}
        style={{ gridTemplateColumns: `${columnWidths.left}px 6px minmax(420px, 1fr) 6px ${columnWidths.right}px` }}
      >
        <section className="panel folder-pane" data-tutorial-target="folder">
          <h2>{t('section.folder')}</h2>
          <div className={withTutorialFocus('tree', activeTutorialTargets, 'folder-tree')}>
            <div className="tree-row tree-row-root tree-row-uncategorized" key="uncategorized">
              <button className="tree-toggle" disabled aria-label={t('folder.uncategorized')} />
              <button className={selectedFolder === '' ? 'selected tree-name' : 'tree-name'} onClick={() => selectFolder('')}>
                {t('folder.uncategorized')}
              </button>
            </div>
            {buildFolderRows(activeFolders, expandedFolders).map((row) => (
              <div className={row.depth === 0 ? 'tree-row tree-row-root' : 'tree-row'} key={row.path || 'root'} style={{ paddingInlineStart: `${row.depth * 14}px` }}>
                <button className="tree-toggle" onClick={() => toggleExpanded(row.path, setExpandedFolders)} disabled={!row.hasChildren} aria-label={row.expanded ? t('folder.collapse') : t('folder.expand')}>
                  {row.hasChildren ? row.expanded ? '▾' : '▸' : ''}
                </button>
                <button className={row.path === selectedFolder ? 'selected tree-name' : 'tree-name'} onClick={() => selectFolder(row.path)}>
                  {row.path ? resolveFolderName(activeFolderNames, row.path) : t('folder.uncategorized')}
                </button>
              </div>
            ))}
          </div>
          <input className={withTutorialFocus('', activeTutorialTargets, 'folder-name')} value={folderName} onChange={(event) => setFolderName(event.target.value)} placeholder={t('folder.prompt')} />
          <div className="button-row">
            <button className={withTutorialFocus('', activeTutorialTargets, 'folder-add')} onClick={() => addFolder('child')} disabled={!selectedFolder}>{t('folder.addChild')}</button>
            <button className={withTutorialFocus('', activeTutorialTargets, 'folder-sibling-add')} onClick={() => addFolder('sibling')} disabled={!selectedFolder}>{t('folder.addSibling')}</button>
            <button className={withTutorialFocus('', activeTutorialTargets, 'folder-independent-add')} onClick={() => addFolder('independent')}>{t('folder.addIndependent')}</button>
            <button className={withTutorialFocus('', activeTutorialTargets, 'folder-rename')} onClick={renameFolder} disabled={!selectedFolder}>{t('button.rename')}</button>
            <button className={withTutorialFocus('danger', activeTutorialTargets, 'folder-delete')} onClick={deleteFolder} disabled={!selectedFolder}>{t('button.delete')}</button>
          </div>
        </section>

        <div className="column-resizer" onPointerDown={(event) => startColumnResize('left', event)} aria-label={t('layout.resizeLeft')} role="separator" />

        <section className="panel editor-pane">
          <div className="tabbar">
            <button className={mode === 'cards' ? 'selected' : ''} onClick={() => setModeAndTab('cards')}>{t('tab.card')}</button>
            <button className={mode === 'notes' ? 'selected' : ''} onClick={() => setModeAndTab('notes')}>{t('tab.note')}</button>
          </div>
          {mode === 'cards'
            ? <CardEditor form={cardForm} setForm={setCardForm} t={t} onHighlight={addHighlight} onClearHighlights={clearHighlights} onListHighlights={showHighlights} activeTutorialTargets={activeTutorialTargets} selections={fieldSelections} onSelection={rememberSelection} />
            : <NoteEditor form={noteForm} setForm={setNoteForm} t={t} onHighlight={addHighlight} onClearHighlights={clearHighlights} onListHighlights={showHighlights} activeTutorialTargets={activeTutorialTargets} selections={fieldSelections} onSelection={rememberSelection} />}

          <div className={withTutorialFocus('destination', activeTutorialTargets, 'destination')}>
            <strong>{t('label.saveFolder')}</strong>
            <span>{currentFolderLabel}</span>
            <button onClick={() => selectFolder('')}>{t('button.clearFolder')}</button>
          </div>

          <section className={withTutorialFocus('media-panel', activeTutorialTargets, 'media')} data-tutorial-target="media">
            <div className="media-layout">
              <div className="media-add-row">
                <label className="file-button media-add-button">{t('button.addMedia')}<input type="file" multiple accept="image/png,image/jpeg,image/webp,image/gif,audio/mpeg,audio/mp4,audio/wav,audio/ogg,audio/webm" onChange={(event) => addMedia(event.target.files)} /></label>
                {formMedia.length > 0 && <span className="media-count">{t('media.count', formMedia.length)}</span>}
                <MediaList media={formMedia} onRemove={removeMedia} onCaption={updateMediaCaption} />
              </div>
                <MediaPreview media={formMedia[0]} activeTutorialTargets={activeTutorialTargets} />
            </div>
          </section>

          <footer className={withTutorialFocus('editor-actions', activeTutorialTargets, 'create-actions')}>
            <div>
              <button onClick={() => createCurrent(false)} className="primary">{selectedItemId == null ? t('button.create') : t('button.save')}</button>
              <button onClick={clearCurrentForm}>{t('button.new')}</button>
              <button onClick={deleteCurrentItem} disabled={selectedItemId == null} className="danger">{t('button.delete')}</button>
            </div>
            <label className={withTutorialFocus('fast-edit', activeTutorialTargets, 'fast-edit')}>
              <input type="checkbox" checked={fastEdit} onChange={(event) => setFastEdit(event.target.checked)} />
              {t('checkbox.fastEdit')}
              <span>{fastEdit ? t('hint.fastEdit.on') : t('hint.fastEdit.off')}</span>
            </label>
          </footer>
        </section>

        <div className="column-resizer" onPointerDown={(event) => startColumnResize('right', event)} aria-label={t('layout.resizeRight')} role="separator" />

        <section className={withTutorialFocus('panel list-pane', activeTutorialTargets, 'item-list')}>
          <h2>{t('section.list')}</h2>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('label.search')} />
          <div className="item-list">
            {!filteredItems.length && <p className="empty">{selectedFolder ? t('list.emptyFolder') : t('list.emptyUncategorized')}</p>}
            {filteredItems.map((item) => (
              <article key={item.id} className={selectedItemId === item.id ? 'selected-item' : ''} onClick={() => selectItem(item)}>
                <strong>{'question' in item ? item.question : item.title}</strong>
                <span>{'question' in item ? item.answer : item.body}</span>
                <small>{item.folderPath || t('folder.uncategorized')}</small>
              </article>
            ))}
          </div>
          <div className="button-row">
            <button onClick={() => moveSelected(-1)} disabled={selectedItemId == null}>{t('button.up')}</button>
            <button onClick={() => moveSelected(1)} disabled={selectedItemId == null}>{t('button.down')}</button>
          </div>
        </section>
      </main>

      <footer className="windows-bottom panel">
        <span>{workspace.cards.length || workspace.notes.length ? t('status.count', workspace.cards.length, workspace.notes.length) : t('status.count.initial')}</span>
        <span>{workspace.updatedAt ? t('status.lastSaved', new Date(workspace.updatedAt).toLocaleString()) : t('status.lastSaved.never')}</span>
      </footer>

      {showHelp && <Modal title={t('help.title')} onClose={() => setShowHelp(false)}>
        <button onClick={() => { setTutorialStep(0); setShowTutorial(true); setShowHelp(false) }}>{t('help.tutorialButton')}</button>
        {t('help.document').split('\n').map((line, index) => <p key={index}>{line}</p>)}
        <h3>{t('help.glossary.title')}</h3>
        <dl className="glossary-list">
          {['uncategorized', 'addChild', 'addSibling', 'addIndependent', 'folderItems', 'fastEdit', 'media', 'highlight'].map((key) => (
            <div key={key}>
              <dt>{t(`help.term.${key}.title`)}</dt>
              <dd>{t(`help.term.${key}.body`)}</dd>
            </div>
          ))}
        </dl>
      </Modal>}

      {showTutorial && <Modal title={t('tutorial.title')} onClose={closeTutorial} className={`tutorial-modal tutorial-${activeTutorialTargets[0] || 'default'}`}>
        <p className="step-counter">[{tutorialStep + 1}/{tutorialStepCount}] {tutorialSteps[tutorialStep].title}</p>
        <p>{tutorialStep === 0 ? `${t('tutorial.start.body')}\n\n${tutorialSteps[tutorialStep].body}` : tutorialSteps[tutorialStep].body}</p>
        <div className="button-row">
          <button onClick={() => goTutorialStep(tutorialStep - 1)} disabled={tutorialStep === 0}>{t('tutorial.button.back')}</button>
          {tutorialStep < tutorialStepCount - 1
            ? <button className="primary" onClick={() => goTutorialStep(tutorialStep + 1)}>{t('tutorial.button.next')}</button>
            : <button className="primary" onClick={closeTutorial}>{t('tutorial.button.finish')}</button>}
          {tutorialStep < tutorialStepCount - 1 && <button onClick={closeTutorial}>{t('tutorial.button.cancel')}</button>}
        </div>
      </Modal>}

      {highlightModal && <Modal title={t('highlight.list.title', highlightModal.title)} onClose={() => setHighlightModal(null)}>
        {highlightModal.items.length
          ? <div className="highlight-list">{highlightModal.items.map((item, index) => (
            <article key={`${highlightModal.field}-${index}`}>
              <strong>{t(`color.${item.color.toLowerCase()}`)}</strong>
              <span>{item.text}</span>
              <button className="danger" onClick={() => {
                removeHighlight(highlightModal.field, index)
                setHighlightModal({ ...highlightModal, items: highlightModal.items.filter((_, itemIndex) => itemIndex !== index) })
              }}>{t('highlight.deleteOne')}</button>
            </article>
          ))}</div>
          : <p>{t('highlight.list.empty')}</p>}
      </Modal>}
    </div>
  )
}

function CardEditor({ form, setForm, t, onHighlight, onClearHighlights, onListHighlights, activeTutorialTargets, selections, onSelection }: CardEditorProps) {
  return <div className={withTutorialFocus('editor-scroll card-editor-grid', activeTutorialTargets, 'card-editor')}>
    <HighlightInputBlock label={t('label.question')} value={form.question} onChange={(question, questionHighlights) => setForm({ ...form, question, questionHighlights })} field="CardQuestion" t={t} onHighlight={onHighlight} onClearHighlights={onClearHighlights} onListHighlights={onListHighlights} highlights={form.questionHighlights} selection={selections.CardQuestion} onSelection={onSelection} activeTutorialTargets={activeTutorialTargets} />
    <HighlightInputBlock label={t('label.answer')} value={form.answer} onChange={(answer, answerHighlights) => setForm({ ...form, answer, answerHighlights })} field="CardAnswer" t={t} onHighlight={onHighlight} onClearHighlights={onClearHighlights} onListHighlights={onListHighlights} highlights={form.answerHighlights} selection={selections.CardAnswer} onSelection={onSelection} activeTutorialTargets={activeTutorialTargets} />
    <HighlightInputBlock label={t('label.hint')} value={form.hint} onChange={(hint, hintHighlights) => setForm({ ...form, hint, hintHighlights })} field="CardHint" t={t} onHighlight={onHighlight} onClearHighlights={onClearHighlights} onListHighlights={onListHighlights} highlights={form.hintHighlights} selection={selections.CardHint} onSelection={onSelection} activeTutorialTargets={activeTutorialTargets} />
  </div>
}

function NoteEditor({ form, setForm, t, onHighlight, onClearHighlights, onListHighlights, activeTutorialTargets, selections, onSelection }: NoteEditorProps) {
  return <div className={withTutorialFocus('editor-scroll note-editor-grid', activeTutorialTargets, 'note-editor')}>
    <HighlightInputBlock label={t('label.title')} value={form.title} onChange={(title, titleHighlights) => setForm({ ...form, title, titleHighlights })} field="NoteTitle" t={t} onHighlight={onHighlight} onClearHighlights={onClearHighlights} onListHighlights={onListHighlights} highlights={form.titleHighlights} selection={selections.NoteTitle} onSelection={onSelection} activeTutorialTargets={activeTutorialTargets} singleLine />
    <HighlightInputBlock label={t('label.body')} value={form.body} onChange={(body, bodyHighlights) => setForm({ ...form, body, bodyHighlights })} field="NoteBody" t={t} onHighlight={onHighlight} onClearHighlights={onClearHighlights} onListHighlights={onListHighlights} highlights={form.bodyHighlights} selection={selections.NoteBody} onSelection={onSelection} activeTutorialTargets={activeTutorialTargets} large />
  </div>
}

function HighlightInputBlock({ label, value, onChange, field, t, onHighlight, onClearHighlights, onListHighlights, highlights, selection, onSelection, activeTutorialTargets, large, singleLine }: FieldBlockProps & { value: string; onChange: (value: string, highlights: TextHighlight[]) => void; large?: boolean; singleLine?: boolean }) {
  const textareaClass = [large ? 'large' : '', singleLine ? 'single-line' : ''].filter(Boolean).join(' ')
  const handleChange = (next: string) => onChange(next, adjustHighlightsForEdit(value, next, highlights))
  return <section className="field-block">
    <label><span>{label}</span>
      <div className="highlight-input-shell">
        <div className="highlight-input-overlay" aria-hidden="true">{renderHighlightedText(value || ' ', highlights, t)}</div>
        <textarea data-highlight-field={field} className={textareaClass} value={value} onChange={(event) => handleChange(event.target.value)} onSelect={(event) => onSelection(field, value, event.currentTarget)} onKeyUp={(event) => onSelection(field, value, event.currentTarget)} spellCheck={false} />
      </div>
    </label>
    <HighlightToolbar field={field} t={t} onHighlight={onHighlight} onClearHighlights={onClearHighlights} onListHighlights={onListHighlights} highlights={highlights.length} activeTutorialTargets={activeTutorialTargets} />
    <SelectionSummary t={t} selection={selection} highlights={highlights.length} />
  </section>
}

function HighlightToolbar({ field, t, onHighlight, onClearHighlights, onListHighlights, highlights, activeTutorialTargets }: Pick<FieldBlockProps, 'field' | 't' | 'onHighlight' | 'onClearHighlights' | 'onListHighlights' | 'activeTutorialTargets'> & { highlights: number }) {
  return <div className={withTutorialFocus('highlight-toolbar', activeTutorialTargets, 'highlight-toolbar')}>
    {highlightColors.map((color) => <button className={`swatch ${color.toLowerCase()}`} key={color} onMouseDown={(event) => event.preventDefault()} onClick={() => onHighlight(field, color)}>{t(`color.${color.toLowerCase()}`)}</button>)}
    <button onMouseDown={(event) => event.preventDefault()} onClick={() => onListHighlights(field)}>{t('button.list')} ({highlights})</button>
    <button className="danger" onMouseDown={(event) => event.preventDefault()} onClick={() => onClearHighlights(field)} disabled={!highlights}>{t('button.clearAll')}</button>
  </div>
}

function SelectionSummary({ t, selection, highlights }: { t: T; selection: TextSelectionState; highlights: number }) {
  return <div className="selection-hint">{t('highlight.selectionSummary', selection.text.length, highlights)}</div>
}

function MediaPreview({ media, activeTutorialTargets }: { media?: MediaItem; activeTutorialTargets: string[] }) {
  const { t } = useI18n()
  const [preview, setPreview] = useState<{ mediaId: string; url: string } | null>(null)

  useEffect(() => {
    let alive = true
    let objectUrl = ''
    if (!media) return
    getMediaBlob(media.blobRef).then((stored) => {
      if (!alive) return
      if (!stored) {
        setPreview(null)
        return
      }
      objectUrl = URL.createObjectURL(stored.blob)
      setPreview({ mediaId: media.id, url: objectUrl })
    })
    return () => {
      alive = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [media])

  const url = preview && preview.mediaId === media?.id ? preview.url : ''

  if (!media) return null

  return <div className={withTutorialFocus('preview-box', activeTutorialTargets, 'media-preview')}>
    <strong>{t('section.preview')}</strong>
    {media && <p>{media.originalName}</p>}
    {media && url && media.type === 'image' && <img src={url} alt={media.originalName} />}
    {media && url && media.type === 'audio' && <audio src={url} controls />}
    {media && !url && <span>{media.type === 'image' ? t('preview.imageMissing') : t('preview.audioMissing')}</span>}
    {media && <span>{media.type} / {Math.round(media.size / 1024)} KB</span>}
  </div>
}

function MediaList({ media, onRemove, onCaption }: { media: MediaItem[]; onRemove: (id: string) => void; onCaption: (id: string, caption: string) => void }) {
  const { t } = useI18n()
  if (!media.length) return null
  return <div className="media-list">
    {media.map((item) => <article key={item.id}>
      <div><strong>{item.type}</strong><span>{item.originalName}</span></div>
      <input value={item.caption} onChange={(event) => onCaption(item.id, event.target.value)} placeholder={t('label.mediaCaption')} />
      <button className="danger" onClick={() => onRemove(item.id)}>{t('button.delete')}</button>
    </article>)}
  </div>
}

function Modal({ title, children, onClose, className = '' }: { title: string; children: React.ReactNode; onClose: () => void; className?: string }) {
  const { t } = useI18n()
  return <div className={`modal-backdrop ${className}`}><section className="modal"><header><h2>{title}</h2><button onClick={onClose}>{t('button.close')}</button></header>{children}</section></div>
}

type HighlightField = 'CardQuestion' | 'CardAnswer' | 'CardHint' | 'NoteTitle' | 'NoteBody'
type T = (key: string, ...args: Array<string | number>) => string
type CardForm = Pick<CardEntry, 'question' | 'answer' | 'hint' | 'questionHighlights' | 'answerHighlights' | 'hintHighlights' | 'media'>
type NoteForm = Pick<NoteEntry, 'title' | 'body' | 'titleHighlights' | 'bodyHighlights' | 'media'>
interface TextSelectionState { start: number; end: number; text: string }
interface FieldBlockProps {
  label?: string
  field: HighlightField
  t: T
  onHighlight: (field: HighlightField, color: HighlightColor) => void
  onClearHighlights: (field: HighlightField) => void
  onListHighlights: (field: HighlightField) => void
  highlights: TextHighlight[]
  selection: TextSelectionState
  onSelection: (field: HighlightField, value: string, target: HTMLInputElement | HTMLTextAreaElement) => void
  activeTutorialTargets: string[]
}
interface CardEditorProps {
  form: CardForm
  setForm: (form: CardForm) => void
  t: T
  onHighlight: (field: HighlightField, color: HighlightColor) => void
  onClearHighlights: (field: HighlightField) => void
  onListHighlights: (field: HighlightField) => void
  activeTutorialTargets: string[]
  selections: Record<HighlightField, TextSelectionState>
  onSelection: (field: HighlightField, value: string, target: HTMLInputElement | HTMLTextAreaElement) => void
}
interface NoteEditorProps {
  form: NoteForm
  setForm: (form: NoteForm) => void
  t: T
  onHighlight: (field: HighlightField, color: HighlightColor) => void
  onClearHighlights: (field: HighlightField) => void
  onListHighlights: (field: HighlightField) => void
  activeTutorialTargets: string[]
  selections: Record<HighlightField, TextSelectionState>
  onSelection: (field: HighlightField, value: string, target: HTMLInputElement | HTMLTextAreaElement) => void
}

function blankCardForm(): CardForm {
  return { question: '', answer: '', hint: '', questionHighlights: [], answerHighlights: [], hintHighlights: [], media: [] }
}

function blankNoteForm(): NoteForm {
  return { title: '', body: '', titleHighlights: [], bodyHighlights: [], media: [] }
}

function blankSelections(): Record<HighlightField, TextSelectionState> {
  return {
    CardQuestion: { start: 0, end: 0, text: '' },
    CardAnswer: { start: 0, end: 0, text: '' },
    CardHint: { start: 0, end: 0, text: '' },
    NoteTitle: { start: 0, end: 0, text: '' },
    NoteBody: { start: 0, end: 0, text: '' },
  }
}

function selectionFromElement(field: HighlightField, target: HTMLInputElement | HTMLTextAreaElement): TextSelectionState | null {
  if (target.dataset.highlightField !== field) return null
  const start = target.selectionStart ?? 0
  const end = target.selectionEnd ?? start
  return { start, end, text: start === end ? '' : target.value.slice(start, end) }
}

function resolveFolderName(names: { path: string; displayName: string }[], path: string) {
  return names.find((item) => item.path === path)?.displayName || path.split('/').at(-1) || path
}

function mergeFolderNames<T extends { path: string; displayName: string }>(left: T[], right: T[]): T[] {
  const map = new Map(left.filter((item) => item.path).map((item) => [item.path, item]))
  right.filter((item) => item.path).forEach((item) => map.set(item.path, item))
  return Array.from(map.values())
}

function buildFolderRows(paths: string[], expanded: Set<string>) {
  const normalized = paths.filter(Boolean)
  const children = new Map<string, string[]>()
  normalized.forEach((path) => {
    const parent = parentPathOf(path)
    children.set(parent, [...(children.get(parent) ?? []), path])
  })
  const rows: Array<{ path: string; depth: number; hasChildren: boolean; expanded: boolean }> = []
  const visit = (path: string, depth: number) => {
    const childPaths = children.get(path) ?? []
    rows.push({ path, depth, hasChildren: childPaths.length > 0, expanded: expanded.has(path) })
    if (!expanded.has(path)) return
    childPaths.forEach((child) => visit(child, depth + 1))
  }
  ;(children.get('') ?? []).forEach((path) => visit(path, 0))
  return rows
}

function parentPathOf(path: string) {
  return path.split('/').slice(0, -1).join('/')
}

function toggleExpanded(path: string, setExpanded: Dispatch<SetStateAction<Set<string>>>) {
  setExpanded((current) => {
    const next = new Set(current)
    if (next.has(path)) next.delete(path)
    else next.add(path)
    return next
  })
}

function fieldNameKey(field: HighlightField) {
  if (field === 'CardQuestion') return 'cardQuestion'
  if (field === 'CardAnswer') return 'cardAnswer'
  if (field === 'CardHint') return 'cardHint'
  if (field === 'NoteTitle') return 'noteTitle'
  return 'noteBody'
}

function languageNameForUi(code: string, uiLanguage: string, fallback: string) {
  if (uiLanguage !== 'en') return fallback
  return englishLanguageNames[code] ?? fallback
}

function withTutorialFocus(baseClass: string, activeTargets: string[], target: string) {
  return `${baseClass}${activeTargets.includes(target) ? ' tutorial-focus' : ''}`.trim()
}

function armPwaBackGuard() {
  const baseUrl = `${window.location.pathname}${window.location.search}`
  if (window.location.hash !== '#flashcards-pwa') {
    window.history.replaceState({ flashcardsPwaGuard: true, slot: 0 }, '', `${baseUrl}#flashcards-pwa`)
  }
  window.history.pushState({ flashcardsPwaGuard: true, slot: 1 }, '', `${baseUrl}#flashcards-pwa-guard`)
}

function isPwaGuardHash(hash: string) {
  return hash === '#flashcards-pwa-guard'
}

function isStandaloneDisplay() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

function isHighlightAligned(value: string, highlight: TextHighlight) {
  return value.slice(highlight.start, highlight.end) === highlight.text
}

function renderHighlightedText(value: string, highlights: TextHighlight[], t: T) {
  const valid = highlights
    .map((item, index) => ({ ...item, index }))
    .filter((item) => item.start >= 0 && item.end > item.start && item.end <= value.length)
    .sort((a, b) => a.start - b.start)
  const parts: ReactNode[] = []
  let cursor = 0
  valid.forEach((item) => {
    if (item.start < cursor) return
    if (item.start > cursor) parts.push(<span key={`plain-${cursor}`}>{value.slice(cursor, item.start)}</span>)
    parts.push(<mark className={`mark-${item.color.toLowerCase()}${isHighlightAligned(value, item) ? '' : ' mark-stale'}`} key={`mark-${item.index}`} title={isHighlightAligned(value, item) ? undefined : t('highlight.needsReview')}>{value.slice(item.start, item.end)}</mark>)
    cursor = item.end
  })
  if (cursor < value.length) parts.push(<span key={`plain-${cursor}`}>{value.slice(cursor)}</span>)
  return parts.length ? parts : value
}

function applyHighlight(value: string, highlights: TextHighlight[], next: TextHighlight) {
  const pieces: TextHighlight[] = []
  highlights.forEach((item) => {
    if (item.end <= next.start || item.start >= next.end) {
      pieces.push(item)
      return
    }
    if (item.start < next.start) {
      pieces.push({ ...item, end: next.start, text: value.slice(item.start, next.start) })
    }
    if (item.end > next.end) {
      pieces.push({ ...item, start: next.end, text: value.slice(next.end, item.end) })
    }
  })
  pieces.push({ ...next, text: value.slice(next.start, next.end) })
  return normalizeHighlights(value, pieces)
}

function adjustHighlightsForEdit(previous: string, next: string, highlights: TextHighlight[]) {
  if (previous === next) return highlights
  let prefix = 0
  const maxPrefix = Math.min(previous.length, next.length)
  while (prefix < maxPrefix && previous[prefix] === next[prefix]) prefix += 1
  let previousSuffix = previous.length
  let nextSuffix = next.length
  while (previousSuffix > prefix && nextSuffix > prefix && previous[previousSuffix - 1] === next[nextSuffix - 1]) {
    previousSuffix -= 1
    nextSuffix -= 1
  }
  const removed = previousSuffix - prefix
  const inserted = nextSuffix - prefix
  const delta = inserted - removed
  const changedEnd = previousSuffix
  const adjusted = highlights.map((item) => {
    if (item.end <= prefix) return item
    if (item.start >= changedEnd) {
      return { ...item, start: item.start + delta, end: item.end + delta }
    }
    const start = Math.min(item.start, prefix)
    const end = Math.max(start, item.end + delta)
    return { ...item, start, end }
  })
  return normalizeHighlights(next, adjusted)
}

function normalizeHighlights(value: string, highlights: TextHighlight[]) {
  const normalized = highlights
    .map((item) => ({
      ...item,
      start: clamp(Math.min(item.start, item.end), 0, value.length),
      end: clamp(Math.max(item.start, item.end), 0, value.length),
    }))
    .filter((item) => item.end > item.start)
    .map((item) => ({ ...item, text: value.slice(item.start, item.end) }))
    .sort((a, b) => a.start - b.start || a.end - b.end)
  const merged: TextHighlight[] = []
  normalized.forEach((item) => {
    const previous = merged.at(-1)
    if (previous && previous.color === item.color && previous.end === item.start) {
      previous.end = item.end
      previous.text = value.slice(previous.start, previous.end)
      return
    }
    merged.push(item)
  })
  return merged
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function loadColumnWidths() {
  try {
    const raw = JSON.parse(localStorage.getItem(columnWidthStorageKey) || '{}') as Partial<typeof defaultColumnWidths>
    return {
      left: clamp(Number(raw.left) || defaultColumnWidths.left, 520, 760),
      right: clamp(Number(raw.right) || defaultColumnWidths.right, 200, 340),
    }
  } catch {
    return defaultColumnWidths
  }
}

async function saveBlobWithPicker(blob: Blob, fileName: string): Promise<'picked' | 'fallback' | 'cancelled'> {
  const picker = window.showSaveFilePicker
  if (!picker) {
    downloadBlob(blob, fileName)
    return 'fallback'
  }
  try {
    const handle = await picker({
      suggestedName: fileName,
      types: [{ description: 'ZIP archive', accept: { 'application/zip': ['.zip'] } }],
    })
    const writable = await handle.createWritable()
    await writable.write(blob)
    await writable.close()
    return 'picked'
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled'
    downloadBlob(blob, fileName)
    return 'fallback'
  }
}

declare global {
  interface Window {
    showSaveFilePicker?: (options?: {
      suggestedName?: string
      types?: Array<{ description?: string; accept: Record<string, string[]> }>
    }) => Promise<{ createWritable: () => Promise<{ write: (data: Blob) => Promise<void>; close: () => Promise<void> }> }>
  }
}

const englishLanguageNames: Record<string, string> = {
  en: 'English',
  ja: 'Japanese',
  hi: 'Hindi',
  bn: 'Bengali',
  ta: 'Tamil',
  id: 'Indonesian',
  fr: 'French',
  de: 'German',
  es: 'Spanish',
  ko: 'Korean',
  th: 'Thai',
  vi: 'Vietnamese',
  'zh-Hans': 'Simplified Chinese',
  ar: 'Arabic',
  pt: 'Portuguese',
  ru: 'Russian',
  'zh-Hant': 'Traditional Chinese',
  it: 'Italian',
  tr: 'Turkish',
  ur: 'Urdu',
  fa: 'Persian',
  nl: 'Dutch',
  pl: 'Polish',
  uk: 'Ukrainian',
  ro: 'Romanian',
  cs: 'Czech',
  sv: 'Swedish',
  el: 'Greek',
  hu: 'Hungarian',
  da: 'Danish',
  fi: 'Finnish',
  no: 'Norwegian',
  bg: 'Bulgarian',
  hr: 'Croatian',
  sk: 'Slovak',
  sl: 'Slovenian',
  lt: 'Lithuanian',
  lv: 'Latvian',
  et: 'Estonian',
}

function moveByIdInFolder<T extends { id: number; folderPath: string }>(items: T[], id: number, folderPath: string, direction: -1 | 1): T[] {
  const visible = items.filter((item) => isItemInFolder(item, folderPath))
  const visibleIndex = visible.findIndex((item) => item.id === id)
  const swapWith = visible[visibleIndex + direction]
  if (!swapWith) return items
  const index = items.findIndex((item) => item.id === id)
  const nextIndex = items.findIndex((item) => item.id === swapWith.id)
  if (index < 0 || nextIndex < 0) return items
  const copy = [...items]
  const [item] = copy.splice(index, 1)
  copy.splice(nextIndex, 0, item)
  return copy
}

function isItemInFolder(item: { folderPath: string }, folderPath: string) {
  return folderPath ? item.folderPath === folderPath || item.folderPath.startsWith(`${folderPath}/`) : !item.folderPath
}

export default App
