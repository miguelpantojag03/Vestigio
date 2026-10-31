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
import i18n from '../i18n/index.js'

const DEMO_USER_ID = 'user_demo_001'
const DEMO_SEEDED_FLAG = 'demo_seeded_v1'

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
    death_cause: relic.deathCause ?? null,
    death_cause_detail: relic.deathCauseDetail ?? null,
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
    deletedAt: row.deleted_at ?? null,
    deathCause: row.death_cause ?? null,
    deathCauseDetail: row.death_cause_detail ?? null,
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
  // Unique per write: covers are always re-encoded to the same format, so a
  // fixed name would keep the same URL and the UI would go on showing the
  // previous image after a change.
  const path = `${dir}/${relicId}_${Date.now()}.${ext}`
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
       linked_file_path,linked_file_mtime,linked_file_copied_path,project_id,death_cause,death_cause_detail)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)`,
    [row.id, row.user_id, row.category, row.title, row.description, row.notes, row.responsible,
     row.project, row.filter, row.thumbnail, coverImagePath, row.tags, row.status, row.revived_at,
     row.created_at, row.discarded_at, row.updated_at,
     row.linked_file_path, row.linked_file_mtime, row.linked_file_copied_path, row.project_id,
     row.death_cause, row.death_cause_detail]
  )
  await recordStatusTransition(db, relic.id, null, 'archived', row.created_at)
}

// Finds or creates the real project a demo relic belongs to. Without one its
// project_id stays NULL and it only ever shows up in the global search.
async function demoProjectId(db, name) {
  const [existing] = await db.select(
    `SELECT id FROM projects WHERE user_id=$1 AND name=$2`, [DEMO_USER_ID, name]
  )
  if (existing) return existing.id
  const id = `proj_demo_${Date.now()}`
  const now = new Date().toISOString()
  await db.execute(
    `INSERT INTO projects (id, user_id, name, created_at, updated_at) VALUES ($1,$2,$3,$4,$5)`,
    [id, DEMO_USER_ID, name, now, now]
  )
  return id
}

async function seedDemoData(db) {
  for (const relic of DEMO_RELICS) {
    const projectId = await demoProjectId(db, relic.project)
    await insertRelicRow(db, DEMO_USER_ID, { ...relic, projectId }, null)
    if (relic.revived) {
      await recordStatusTransition(
        db, relic.id, 'archived', 'revived', relic.revivedAt ?? relic.updatedAt
      )
    }
  }
}

async function seedDemoDataOnce() {
  const db = await getDb()
  const [flag] = await db.select(`SELECT value FROM migration_meta WHERE key=$1`, [DEMO_SEEDED_FLAG])
  if (flag) return
  const [{ n }] = await db.select(`SELECT COUNT(*) AS n FROM relics WHERE user_id=$1`, [DEMO_USER_ID])
  if (n === 0) await seedDemoData(db)
  await db.execute(`INSERT OR REPLACE INTO migration_meta (key,value) VALUES ($1,'true')`, [DEMO_SEEDED_FLAG])
}

let demoSeedPromise = null

/**
 * Seeds the demo account on its first access only, so deleting every demo
 * relic doesn't bring them all back. Memoized because useRelics and
 * useProjects both load at once and would otherwise seed concurrently.
 */
export function ensureDemoData(userId) {
  if (userId !== DEMO_USER_ID) return Promise.resolve()
  if (!demoSeedPromise) {
    demoSeedPromise = seedDemoDataOnce().catch(err => { demoSeedPromise = null; throw err })
  }
  return demoSeedPromise
}

export async function getRelics(userId) {
  await ensureDemoData(userId)
  const db = await getDb()
  const rows = await db.select(
    `SELECT * FROM relics_with_counts WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId]
  )
  return rows.map(fromRow)
}

export async function addRelic(userId, relic) {
  const db = await getDb()
  let coverImagePath = null
  try {
    coverImagePath = await persistCoverImage(relic.id, relic.coverImage)
    await insertRelicRow(db, userId, relic, coverImagePath)
  } catch (err) {
    console.error('[relicStorage] addRelic failed:', err)
    await deleteCoverFileIfExists(coverImagePath)
    throw new Error(i18n.t('relics.errors.saveFailed'), { cause: err })
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
    deathCause: 'death_cause', deathCauseDetail: 'death_cause_detail',
  }
  const sets = []
  const vals = []
  let i = 1
  for (const [key, col] of Object.entries(fieldMap)) {
    if (key in patch) { sets.push(`${col}=$${i++}`); vals.push(patch[key]) }
  }
  if ('tags' in patch) { sets.push(`tags=$${i++}`); vals.push(JSON.stringify(patch.tags)) }
  let newCoverPath = null
  if ('coverImage' in patch) {
    try {
      newCoverPath = await persistCoverImage(id, patch.coverImage)
    } catch (err) {
      console.error('[relicStorage] updateRelic could not write the cover:', err)
      throw new Error(i18n.t('relics.errors.updateFailed'), { cause: err })
    }
    sets.push(`cover_image_path=$${i++}`); vals.push(newCoverPath)
  }

  if (sets.length > 0) {
    try {
      await db.execute(
        `UPDATE relics SET ${sets.join(',')} WHERE id=$${i++} AND user_id=$${i}`,
        [...vals, id, userId]
      )
      if ('status' in patch && patch.status !== existing.status) {
        await recordStatusTransition(
          db, id, existing.status, patch.status, patch.revivedAt ?? new Date().toISOString()
        )
      }
    } catch (err) {
      console.error('[relicStorage] updateRelic failed:', err)
      await deleteCoverFileIfExists(newCoverPath)
      throw new Error(i18n.t('relics.errors.updateFailed'), { cause: err })
    }
    // Replaced files go last, so a failed update never costs the old ones.
    if ('coverImage' in patch) await deleteCoverFileIfExists(existing.cover_image_path)
    if ('linkedFileCopiedPath' in patch && patch.linkedFileCopiedPath !== existing.linked_file_copied_path) {
      await deleteCoverFileIfExists(existing.linked_file_copied_path)
    }
  }
  return getRelics(userId)
}

export async function moveRelicsToProject(userId, ids, project) {
  const db = await getDb()
  const now = new Date().toISOString()
  try {
    for (const id of ids) {
      await db.execute(
        `UPDATE relics SET project_id=$1, project=$2, updated_at=$3 WHERE id=$4 AND user_id=$5`,
        [project.id, project.name, now, id, userId]
      )
    }
  } catch (err) {
    console.error('[relicStorage] moveRelicsToProject failed:', err)
    throw new Error(i18n.t('relics.errors.updateFailed'), { cause: err })
  }
  return getRelics(userId)
}

export const MAX_TAGS = 10 // same limit as TagsInput

export async function addTagToRelics(userId, ids, rawTag) {
  const tag = rawTag.trim().toLowerCase()
  const db = await getDb()
  const now = new Date().toISOString()
  try {
    for (const id of ids) {
      const [row] = await db.select(`SELECT tags FROM relics WHERE id=$1 AND user_id=$2`, [id, userId])
      if (!row) continue
      const tags = JSON.parse(row.tags || '[]')
      if (tags.includes(tag) || tags.length >= MAX_TAGS) continue
      await db.execute(
        `UPDATE relics SET tags=$1, updated_at=$2 WHERE id=$3 AND user_id=$4`,
        [JSON.stringify([...tags, tag]), now, id, userId]
      )
    }
  } catch (err) {
    console.error('[relicStorage] addTagToRelics failed:', err)
    throw new Error(i18n.t('relics.errors.updateFailed'), { cause: err })
  }
  return getRelics(userId)
}

/** Moves relics to the trash. Rows and files stay, so this can be undone. */
export async function trashRelics(userId, ids) {
  return setDeletedAt(userId, ids, new Date().toISOString())
}

export async function restoreRelics(userId, ids) {
  return setDeletedAt(userId, ids, null)
}

async function setDeletedAt(userId, ids, deletedAt) {
  const db = await getDb()
  try {
    for (const id of ids) {
      await db.execute(`UPDATE relics SET deleted_at=$1 WHERE id=$2 AND user_id=$3`, [deletedAt, id, userId])
    }
  } catch (err) {
    console.error('[relicStorage] setDeletedAt failed:', err)
    throw new Error(i18n.t('relics.errors.updateFailed'), { cause: err })
  }
  return getRelics(userId)
}

/** Permanently deletes relics: rows and files. Only the trash calls this. */
export async function deleteRelics(userId, ids) {
  for (const id of ids) await deleteRelicData(userId, id)
  return getRelics(userId)
}

export async function emptyTrash(userId) {
  const db = await getDb()
  const rows = await db.select(`SELECT id FROM relics WHERE user_id=$1 AND deleted_at IS NOT NULL`, [userId])
  return deleteRelics(userId, rows.map(r => r.id))
}

async function deleteRelicData(userId, id) {
  const db = await getDb()
  const [existing] = await db.select(
    `SELECT cover_image_path, linked_file_copied_path FROM relics WHERE id=$1 AND user_id=$2`, [id, userId]
  )
  if (!existing) return
  try {
    // Explicit cascade: attachments deliberately has no foreign key (see
    // migration 0009), and spelling out the rest keeps all of it in one place.
    await db.execute(`DELETE FROM attachments WHERE relic_id=$1`, [id])
    await db.execute(`DELETE FROM drafts WHERE relic_id=$1`, [id])
    await db.execute(`DELETE FROM relic_status_history WHERE relic_id=$1`, [id])
    await db.execute(`DELETE FROM relics WHERE id=$1 AND user_id=$2`, [id, userId])
  } catch (err) {
    console.error('[relicStorage] deleteRelic failed:', err)
    throw new Error(i18n.t('relics.errors.deleteFailed'), { cause: err })
  }
  // Only once the rows are gone — a failed delete must leave the files alone.
  await deleteCoverFileIfExists(existing.cover_image_path)
  await deleteCoverFileIfExists(existing.linked_file_copied_path)
  try {
    await remove(`${await getAttachmentsDir()}/${id}`, { recursive: true })
  } catch { /* best effort — the relic may simply have no attachments folder */ }
}
