import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { WorkspaceDraft } from '../models'

interface FlashcardsInputDb extends DBSchema {
  workspace: {
    key: 'current'
    value: WorkspaceDraft
  }
  media: {
    key: string
    value: {
      id: string
      blob: Blob
      name: string
      mime: string
      updatedAt: string
    }
  }
}

let dbPromise: Promise<IDBPDatabase<FlashcardsInputDb>> | undefined
function database() {
  // Storage may be disabled before openDB can even return a promise. Open only
  // inside the caller's async operation so the startup gate can show recovery.
  dbPromise ??= openDB<FlashcardsInputDb>('flashcards-pwa-input', 1, {
    upgrade(db) {
      db.createObjectStore('workspace')
      db.createObjectStore('media', { keyPath: 'id' })
    },
  })
  return dbPromise
}

export async function loadWorkspaceDraft() {
  return (await database()).get('workspace', 'current')
}

export async function saveWorkspaceDraft(draft: WorkspaceDraft) {
  await (await database()).put('workspace', { ...draft, updatedAt: new Date().toISOString() }, 'current')
}

export async function saveMediaBlob(id: string, blob: Blob, name: string, mime: string) {
  await (await database()).put('media', { id, blob, name, mime, updatedAt: new Date().toISOString() })
}

export async function getMediaBlob(id: string) {
  return (await database()).get('media', id)
}

export async function deleteMediaBlob(id: string) {
  await (await database()).delete('media', id)
}
