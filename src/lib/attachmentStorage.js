// ─── AttachmentStorage — SQLite metadata + files on disk ──────────
// Metadata lives in the `attachments` table; the actual bytes live as
// a file under the app's local-data dir, referenced by file_path.
// Same exported names/signatures as the old IndexedDB version — the
// `blob` field is gone, replaced by `filePath`.
//
// Schema (app-facing shape, after fromRow()):
//   id            string    'att_<timestamp>_<random4>'
//   relicId       string    FK → relic.id
//   userId        string    FK → user.id
//   originalName  string    'contrato.pdf'
//   extension     string    'pdf'
//   mimeType      string    'application/pdf'
//   size          number    bytes
//   createdAt     string    ISO 8601
//   filePath      string    absolute path on disk

import { getDb } from './db.js'
import { getAttachmentsDir } from './fsPaths.js'
import { writeFile, readFile, remove, mkdir, copyFile } from '@tauri-apps/plugin-fs'
import { save } from '@tauri-apps/plugin-dialog'
import { openPath } from '@tauri-apps/plugin-opener'
import { convertFileSrc } from '@tauri-apps/api/core'
import { emitRelicDataChanged } from './relicDataEvents.js'
import { isAndroid } from './platform.js'
import { saveBytesAs } from './androidFiles.js'

function makeId() {
  return `att_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
}

function fromRow(row) {
  return {
    id: row.id,
    relicId: row.relic_id,
    userId: row.user_id,
    originalName: row.original_name,
    extension: row.extension,
    mimeType: row.mime_type,
    size: row.size,
    createdAt: row.created_at,
    filePath: row.file_path,
  }
}

/**
 * Store a new attachment.
 * @param {string} relicId
 * @param {string} userId
 * @param {File}   file      — native browser File object
 * @returns {Promise<Attachment>}
 */
export async function addAttachment(relicId, userId, file) {
  const db  = await getDb()
  const id  = makeId()
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  const dir = `${await getAttachmentsDir()}/${relicId}`
  await mkdir(dir, { recursive: true })
  const path = `${dir}/${id}.${ext}`

  const bytes = new Uint8Array(await file.arrayBuffer())
  await writeFile(path, bytes)

  const createdAt = new Date().toISOString()
  const mimeType  = file.type || `application/${ext}`
  await db.execute(
    `INSERT INTO attachments (id,relic_id,user_id,original_name,extension,mime_type,size,file_path,created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [id, relicId, userId, file.name, ext, mimeType, file.size, path, createdAt]
  )
  emitRelicDataChanged(relicId)
  return { id, relicId, userId, originalName: file.name, extension: ext, mimeType, size: file.size, createdAt, filePath: path }
}

/**
 * Get all attachments for a relic.
 * @returns {Promise<Attachment[]>}
 */
export async function getAttachments(relicId) {
  const db = await getDb()
  const rows = await db.select(`SELECT * FROM attachments WHERE relic_id=$1 ORDER BY created_at ASC`, [relicId])
  return rows.map(fromRow)
}

/**
 * Get a single attachment by id.
 * @returns {Promise<Attachment|undefined>}
 */
export async function getAttachment(id) {
  const db = await getDb()
  const [row] = await db.select(`SELECT * FROM attachments WHERE id=$1`, [id])
  return row ? fromRow(row) : undefined
}

/**
 * Delete a single attachment.
 */
export async function deleteAttachment(id) {
  const db = await getDb()
  const [row] = await db.select(`SELECT file_path, relic_id FROM attachments WHERE id=$1`, [id])
  await db.execute(`DELETE FROM attachments WHERE id=$1`, [id])
  if (row) {
    try { await remove(row.file_path) } catch { /* best effort */ }
    emitRelicDataChanged(row.relic_id)
  }
}

/**
 * Delete all attachments staged for a relic that never got saved.
 */
export async function deleteAttachmentsForRelic(relicId) {
  const db = await getDb()
  const rows = await db.select(`SELECT file_path FROM attachments WHERE relic_id=$1`, [relicId])
  await db.execute(`DELETE FROM attachments WHERE relic_id=$1`, [relicId])
  await Promise.all(rows.map(r => remove(r.file_path).catch(() => {})))
}

/**
 * Count attachments for a relic (lightweight — no file I/O).
 * @returns {Promise<number>}
 */
export async function countAttachments(relicId) {
  const db = await getDb()
  const [row] = await db.select(`SELECT COUNT(*) as n FROM attachments WHERE relic_id=$1`, [relicId])
  return row?.n ?? 0
}

/**
 * Get counts for multiple relicIds at once.
 * Returns Record<relicId, number>.
 * @returns {Promise<Record<string,number>>}
 */
export async function getAttachmentCounts(relicIds) {
  const entries = await Promise.all(relicIds.map(async id => [id, await countAttachments(id)]))
  return Object.fromEntries(entries)
}

/**
 * Build a loadable URL for preview. Sync — just a string transform,
 * no file I/O, so callers that don't await this keep working.
 * @returns {string}
 */
export function createPreviewURL(attachment) {
  return convertFileSrc(attachment.filePath)
}

/**
 * "Save As…" through the native dialog. A plain <a download> can't do this:
 * the browser ignores `download` on the cross-origin asset URL.
 * @returns {Promise<boolean>} false if the user cancelled
 */
export async function downloadAttachment(attachment) {
  if (isAndroid) return saveBytesAs(attachment.originalName, await readFile(attachment.filePath))
  const dest = await save({ defaultPath: attachment.originalName })
  if (!dest) return false
  await copyFile(attachment.filePath, dest)
  return true
}

/** Opens the attachment with the system's default app for its type. */
export function openAttachment(attachment) {
  return openPath(attachment.filePath)
}
