import { openDB, type DBSchema } from 'idb'
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

const dbPromise = openDB<FlashcardsInputDb>('flashcards-pwa-input', 1, {
  upgrade(db) {
    db.createObjectStore('workspace')
    db.createObjectStore('media', { keyPath: 'id' })
  },
})

export async function loadWorkspaceDraft() {
  return (await dbPromise).get('workspace', 'current')
}

export async function saveWorkspaceDraft(draft: WorkspaceDraft) {
  await (await dbPromise).put('workspace', { ...draft, updatedAt: new Date().toISOString() }, 'current')
}

export async function saveMediaBlob(id: string, blob: Blob, name: string, mime: string) {
  await (await dbPromise).put('media', { id, blob, name, mime, updatedAt: new Date().toISOString() })
}

export async function getMediaBlob(id: string) {
  return (await dbPromise).get('media', id)
}

export async function deleteMediaBlob(id: string) {
  await (await dbPromise).delete('media', id)
}
