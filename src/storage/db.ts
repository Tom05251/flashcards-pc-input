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
  meta: {
    key: 'workspaceRevision'
    value: number
  }
}

export interface StagedMedia {
  id: string
  blob: Blob
  name: string
  mime: string
}

export interface WorkspaceSnapshot {
  workspace: WorkspaceDraft | undefined
  revision: number
}

export type WorkspaceStorageErrorCode = 'REVISION_CONFLICT' | 'STORAGE_OPEN_BLOCKED' |
  'STORAGE_OPEN_TIMEOUT' | 'STORAGE_INVALID_REVISION' | 'STORAGE_INVALID_MEDIA' | 'STORAGE_SCHEMA_INVALID' | 'PREVIEW_STALE'

export class WorkspaceStorageError extends Error {
  readonly code: WorkspaceStorageErrorCode

  constructor(code: WorkspaceStorageErrorCode) {
    super(code)
    this.name = 'WorkspaceStorageError'
    this.code = code
  }
}

export class WorkspaceConflictError extends WorkspaceStorageError {
  readonly expectedRevision: number
  readonly actualRevision: number

  constructor(expectedRevision: number, actualRevision: number) {
    super('REVISION_CONFLICT')
    this.name = 'WorkspaceConflictError'
    this.expectedRevision = expectedRevision
    this.actualRevision = actualRevision
  }
}

const openTimeoutMillis = 10_000
let dbPromise: Promise<IDBPDatabase<FlashcardsInputDb>> | undefined
function database() {
  if (dbPromise) return dbPromise
  // Never delete/reset the database to resolve a blocked upgrade or denial.
  // A request cannot be cancelled, so close any connection that arrives after
  // this caller has already received the timeout/blocked failure.
  const attempt = new Promise<IDBPDatabase<FlashcardsInputDb>>((resolve, reject) => {
    let settled = false
    let connection: IDBPDatabase<FlashcardsInputDb> | undefined
    const fail = (error: unknown) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      reject(error)
    }
    const timer = setTimeout(() => fail(new WorkspaceStorageError('STORAGE_OPEN_TIMEOUT')), openTimeoutMillis)
    try {
      void openDB<FlashcardsInputDb>('flashcards-pwa-input', 2, {
        upgrade(db, oldVersion, _newVersion, transaction) {
          if (oldVersion === 0) {
            db.createObjectStore('workspace')
            db.createObjectStore('media', { keyPath: 'id' })
          } else if (!db.objectStoreNames.contains('workspace') || !db.objectStoreNames.contains('media')) {
            throw new WorkspaceStorageError('STORAGE_SCHEMA_INVALID')
          }
          if (oldVersion < 2) {
            db.createObjectStore('meta')
            // Only revision metadata is added; legacy workspace/blob bytes and
            // their keys remain untouched by this migration.
            void transaction.objectStore('meta').put(0, 'workspaceRevision').catch(() => undefined)
          }
        },
        blocked() { fail(new WorkspaceStorageError('STORAGE_OPEN_BLOCKED')) },
        blocking() {
          connection?.close()
          dbPromise = undefined
        },
        terminated() { dbPromise = undefined },
      }).then((db) => {
        if (settled) { db.close(); return }
        settled = true
        clearTimeout(timer)
        connection = db
        resolve(db)
      }, fail)
    } catch (error) { fail(error) }
  })
  dbPromise = attempt
  void attempt.catch(() => { if (dbPromise === attempt) dbPromise = undefined })
  return attempt
}

function checkedRevision(value: unknown) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new WorkspaceStorageError('STORAGE_INVALID_REVISION')
  }
  return value
}

export async function loadWorkspaceSnapshot(): Promise<WorkspaceSnapshot> {
  const transaction = (await database()).transaction(['workspace', 'meta'], 'readonly')
  const [workspace, revision] = await Promise.all([
    transaction.objectStore('workspace').get('current'),
    transaction.objectStore('meta').get('workspaceRevision'),
  ])
  await transaction.done
  return { workspace, revision: checkedRevision(revision) }
}

export async function loadWorkspaceDraft() {
  return (await loadWorkspaceSnapshot()).workspace
}

export async function saveWorkspaceDraft(draft: WorkspaceDraft, expectedRevision: number, stagedMedia: readonly StagedMedia[] = [], canCommit?: () => boolean) {
  checkedRevision(expectedRevision)
  const identifiers = new Set<string>()
  const media = stagedMedia.map((item) => {
    if (!item || typeof item.id !== 'string' || !item.id || identifiers.has(item.id) ||
        !(item.blob instanceof Blob) || typeof item.name !== 'string' || typeof item.mime !== 'string') {
      throw new WorkspaceStorageError('STORAGE_INVALID_MEDIA')
    }
    identifiers.add(item.id)
    return { id: item.id, blob: item.blob, name: item.name, mime: item.mime }
  })
  // Capture the caller's exact state before the first await; later form/state
  // mutation cannot change a queued save. Blob contents are immutable.
  const updatedAt = new Date().toISOString()
  const snapshot = structuredClone({ ...draft, updatedAt })
  const transaction = (await database()).transaction(['workspace', 'media', 'meta'], 'readwrite')
  const writes: Promise<unknown>[] = []
  try {
    const actualRevision = checkedRevision(await transaction.objectStore('meta').get('workspaceRevision'))
    if (actualRevision !== expectedRevision) throw new WorkspaceConflictError(expectedRevision, actualRevision)
    if (canCommit && !canCommit()) throw new WorkspaceStorageError('PREVIEW_STALE')
    if (actualRevision === Number.MAX_SAFE_INTEGER) throw new WorkspaceStorageError('STORAGE_INVALID_REVISION')
    const revision = actualRevision + 1
    for (const item of media) writes.push(transaction.objectStore('media').add({ ...item, updatedAt }))
    writes.push(transaction.objectStore('workspace').put(snapshot, 'current'))
    writes.push(transaction.objectStore('meta').put(revision, 'workspaceRevision'))
    await Promise.all([...writes, transaction.done])
    return { revision, updatedAt }
  } catch (error) {
    // A quota/clone/constraint/CAS failure must not leave either side of the
    // workspace/media change committed. Await abort completion before return.
    try { transaction.abort() } catch { /* It may already have aborted. */ }
    await Promise.allSettled([...writes, transaction.done])
    throw error
  }
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
