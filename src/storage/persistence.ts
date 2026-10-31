import type { WorkspaceDraft } from '../models'
import { saveWorkspaceDraft } from './db'
import type { StagedMedia } from './db'

export type SaveState = 'saved' | 'saving' | 'failed' | 'conflict'

// One queue per open editor. IndexedDB's revision comparison also protects
// against other tabs; a completed older request can never mark newer work saved.
export class WorkspacePersistence {
  revision: number
  private queue: Promise<void> = Promise.resolve()
  private paused = false
  private latest = 0
  private lastDraft: WorkspaceDraft | undefined
  private lastRequest: Promise<{ revision: number; updatedAt: string }> | undefined
  private committedMedia = new Set<string>()
  private changed: (state: SaveState, draft?: WorkspaceDraft, savedAt?: string) => void
  private committed: (revision: number) => void

  constructor(revision: number, changed: (state: SaveState, draft?: WorkspaceDraft, savedAt?: string) => void, committed: (revision: number) => void = () => undefined) {
    this.revision = revision
    this.changed = changed
    this.committed = committed
  }

  save(draft: WorkspaceDraft, media: readonly StagedMedia[] = [], expectedRevision?: number, canCommit?: () => boolean) {
    if (draft === this.lastDraft && expectedRevision === undefined && this.lastRequest) return this.lastRequest
    this.lastDraft = draft
    const snapshot = structuredClone(draft)
    const attachments = media.map((item) => ({ ...item }))
    const request = ++this.latest
    this.changed('saving')
    const operation = this.queue.then(async () => {
      if (this.paused || (expectedRevision !== undefined && expectedRevision !== this.revision)) {
        throw Object.assign(new Error('Workspace changed'), { code: 'REVISION_CONFLICT' })
      }
      const receipt = await saveWorkspaceDraft(snapshot, this.revision, attachments.filter((item) => !this.committedMedia.has(item.id)), canCommit)
      attachments.forEach((item) => this.committedMedia.add(item.id))
      this.revision = receipt.revision
      // Notify every receipt, including older saves. Notification failure must
      // not make an already committed import appear to have failed.
      try { this.committed(receipt.revision) } catch { /* Storage already committed. */ }
      if (request === this.latest && !this.paused) this.changed('saved', draft, receipt.updatedAt)
      return receipt
    }).catch((error: unknown) => {
      const conflict = typeof error === 'object' && error !== null && 'code' in error && error.code === 'REVISION_CONFLICT'
      if (conflict) this.paused = true
      if (request === this.latest || conflict) this.changed(conflict ? 'conflict' : 'failed')
      throw error
    })
    this.lastRequest = operation
    this.queue = operation.then(() => undefined, () => undefined)
    return operation
  }

  async settled() { await this.queue }

  pauseForExternalChange() { this.paused = true; this.changed('conflict') }

  retry(draft: WorkspaceDraft, media: readonly StagedMedia[]) {
    this.lastDraft = undefined
    return this.save(draft, media)
  }
}
