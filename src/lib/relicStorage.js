// ─── relicStorage ─────────────────────────────────────────────────
// SQLite-backed relic CRUD. Same exported names/signatures as the old
// localStorage version, now all async. camelCase<->snake_case mapping
// lives entirely in this file (toRow/fromRow) — callers only ever see
// camelCase relic objects, same shape as before.

import { getDb } from './db.js'
import { getAttachmentsDir, getCoversDir } from './fsPaths.js'
import { writeFile, remove, exists } from '@tauri-apps/plugin-fs'
import { convertFileSrc } from '@tauri-apps/api/core'
import { DEMO_RELICS } from '../data/mockRelics.js'

const DEMO_USER_ID = 'user_demo_001'

function toRow(relic) {
  return {
    id: relic.id,
    user_id: relic.userId,
    category: relic.category,
    title: relic.title,
    description: relic.description ?? '',
    notes: relic.notes ?? '',
    responsible: relic.responsible ?? '',
    project: relic.project ?? '',
    filter: relic.filter ?? null,
    thumbnail: relic.thumbnail ?? null,
    tags: JSON.stringify(relic.tags ?? []),
    status: relic.status ?? 'archived',
    revived_at: relic.revivedAt ?? null,
    created_at: relic.createdAt,
    discarded_at: relic.discardedAt,
    updated_at: relic.updatedAt,
    linked_file_path: relic.linkedFilePath ?? null,
    linked_file_mtime: relic.linkedFileMtime ?? null,
    linked_file_copied_path: relic.linkedFileCopiedPath ?? null,
    project_id: relic.projectId ?? null,
  }
}

function fromRow(row) {
  return {
    id: row.id,
    category: row.category,
    title: row.title,
    description: row.description,
    notes: row.notes,
    responsible: row.responsible,
    project: row.project,
    filter: row.filter,
    thumbnail: row.thumbnail,
    coverImage: row.cover_image_path ? convertFileSrc(row.cover_image_path) : null,
    tags: JSON.parse(row.tags || '[]'),
    status: row.status,
    revived: row.status === 'revived',
    revivedAt: row.revived_at,
    createdAt: row.created_at,
    discardedAt: row.discarded_at,
    updatedAt: row.updated_at,
    revivalCount: row.revival_count ?? 0,
    linkedFilePath: row.linked_file_path ?? null,
    linkedFileMtime: row.linked_file_mtime ?? null,
    linkedFileCopiedPath: row.linked_file_copied_path ?? null,
    projectId: row.project_id ?? null,
  }
}

async function recordStatusTransition(db, relicId, fromStatus, toStatus, changedAt) {
  await db.execute(
    `INSERT INTO relic_status_history (relic_id, from_status, to_status, changed_at)
     VALUES ($1, $2, $3, $4)`,
    [relicId, fromStatus, toStatus, changedAt]
  )
}

// data:image/...;base64,... -> write file, return absolute path (or null)
async function persistCoverImage(relicId, dataUri) {
  if (!dataUri) return null
  const match = /^data:image\/(\w+);base64,(.+)$/.exec(dataUri)
  if (!match) return null
  const [, subtype, b64] = match
  const ext = subtype === 'jpeg' ? 'jpg' : subtype
  const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0))
  const dir = await getCoversDir()
  const path = `${dir}/${relicId}.${ext}`
  await writeFile(path, bytes)
  return path
}

async function deleteCoverFileIfExists(path) {
  if (!path) return
  try { if (await exists(path)) await remove(path) } catch { /* best effort */ }
}

async function insertRelicRow(db, userId, relic, coverImagePath) {
  const row = toRow({ ...relic, userId })
  await db.execute(
    `INSERT INTO relics (id,user_id,category,title,description,notes,responsible,project,
       filter,thumbnail,cover_image_path,tags,status,revived_at,created_at,discarded_at,updated_at,
       linked_file_path,linked_file_mtime,linked_file_copied_path,project_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)`,
    [row.id, row.user_id, row.category, row.title, row.description, row.notes, row.responsible,
     row.project, row.filter, row.thumbnail, coverImagePath, row.tags, row.status, row.revived_at,
     row.created_at, row.discarded_at, row.updated_at,
     row.linked_file_path, row.linked_file_mtime, row.linked_file_copied_path, row.project_id]
  )
  await recordStatusTransition(db, relic.id, null, 'archived', row.created_at)
}

async function seedDemoData(db) {
  for (const relic of DEMO_RELICS) {
    await insertRelicRow(db, DEMO_USER_ID, relic, null)
    if (relic.revived) {
      await recordStatusTransition(
        db, relic.id, 'archived', 'revived', relic.revivedAt ?? relic.updatedAt
      )
    }
  }
}

export async function getRelics(userId) {
  const db = await getDb()
  const rows = await db.select(
    `SELECT * FROM relics_with_counts WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId]
  )
  if (rows.length === 0 && userId === DEMO_USER_ID) {
    await seedDemoData(db)
    return getRelics(userId)
  }
  return rows.map(fromRow)
}

export async function addRelic(userId, relic) {
  const db = await getDb()
  const coverImagePath = await persistCoverImage(relic.id, relic.coverImage)
  try {
    await insertRelicRow(db, userId, relic, coverImagePath)
  } catch (err) {
    console.error('[relicStorage] addRelic failed:', err)
    throw new Error('Could not save relic. Please try again.', { cause: err })
  }
  return getRelics(userId)
}

export async function updateRelic(userId, id, patch) {
  const db = await getDb()
  const [existing] = await db.select(`SELECT * FROM relics WHERE id=$1 AND user_id=$2`, [id, userId])
  if (!existing) return getRelics(userId)

  const fieldMap = {
    title: 'title', category: 'category', description: 'description', notes: 'notes',
    responsible: 'responsible', project: 'project', filter: 'filter', thumbnail: 'thumbnail',
    status: 'status', revivedAt: 'revived_at', updatedAt: 'updated_at',
    linkedFilePath: 'linked_file_path', linkedFileMtime: 'linked_file_mtime',
    linkedFileCopiedPath: 'linked_file_copied_path',
    projectId: 'project_id',
  }
  const sets = []
  const vals = []
  let i = 1
  for (const [key, col] of Object.entries(fieldMap)) {
    if (key in patch) { sets.push(`${col}=$${i++}`); vals.push(patch[key]) }
  }
  if ('tags' in patch) { sets.push(`tags=$${i++}`); vals.push(JSON.stringify(patch.tags)) }
  if ('coverImage' in patch) {
    await deleteCoverFileIfExists(existing.cover_image_path)
    const newPath = await persistCoverImage(id, patch.coverImage)
    sets.push(`cover_image_path=$${i++}`); vals.push(newPath)
  }

  if (sets.length > 0) {
    try {
      await db.execute(
        `UPDATE relics SET ${sets.join(',')} WHERE id=$${i++} AND user_id=$${i}`,
        [...vals, id, userId]
      )
      if (existing.status === 'archived' && patch.status === 'revived') {
        await recordStatusTransition(
          db, id, 'archived', 'revived', patch.revivedAt ?? new Date().toISOString()
        )
      }
    } catch (err) {
      console.error('[relicStorage] updateRelic failed:', err)
      throw new Error('Could not update relic. Please try again.', { cause: err })
    }
  }
  return getRelics(userId)
}

export async function deleteRelic(userId, id) {
  const db = await getDb()
  const [existing] = await db.select(
    `SELECT cover_image_path, linked_file_copied_path FROM relics WHERE id=$1 AND user_id=$2`, [id, userId]
  )
  if (!existing) return getRelics(userId)
  try {
    // Explicit cascade: attachments deliberately has no foreign key (see
    // migration 0009), and spelling out the rest keeps all of it in one place.
    await db.execute(`DELETE FROM attachments WHERE relic_id=$1`, [id])
    await db.execute(`DELETE FROM drafts WHERE relic_id=$1`, [id])
    await db.execute(`DELETE FROM relic_status_history WHERE relic_id=$1`, [id])
    await db.execute(`DELETE FROM relics WHERE id=$1 AND user_id=$2`, [id, userId])
  } catch (err) {
    console.error('[relicStorage] deleteRelic failed:', err)
    throw new Error('Could not delete relic. Please try again.', { cause: err })
  }
  // Only once the rows are gone — a failed delete must leave the files alone.
  await deleteCoverFileIfExists(existing.cover_image_path)
  await deleteCoverFileIfExists(existing.linked_file_copied_path)
  try {
    await remove(`${await getAttachmentsDir()}/${id}`, { recursive: true })
  } catch { /* best effort — the relic may simply have no attachments folder */ }
  return getRelics(userId)
}
