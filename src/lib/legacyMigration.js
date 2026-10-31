// ─── legacyMigration ──────────────────────────────────────────────
// One-time move of pre-SQLite data (localStorage relics + IndexedDB
// attachments) into the new database + filesystem. Runs once, gated
// by a flag in migration_meta. Old localStorage/IndexedDB data is left
// untouched as a backup — deleting it is a deliberate future step,
// not part of this migration.

import { openDB } from 'idb'
import { join } from '@tauri-apps/api/path'
import { writeFile, mkdir } from '@tauri-apps/plugin-fs'
import { getDb } from './db.js'
import { getAttachmentsDir, getCoversDir } from './fsPaths.js'
import { IDB_NAME, IDB_VERSION, IDB_STORE, RELICS_KEY } from '../constants/storageKeys.js'

// RELICS_KEY('') == 'am_relics_' — derive the prefix instead of hardcoding
// it a second time, so this can't silently drift from the real key format.
const RELICS_KEY_PREFIX = RELICS_KEY('')
const MIGRATION_FLAG = 'legacy_migrated_v1'

async function alreadyMigrated(db) {
  const [row] = await db.select(
    `SELECT value FROM migration_meta WHERE key=$1`, [MIGRATION_FLAG]
  )
  return row?.value === 'true'
}

async function migrateRelicsFromLocalStorage(db) {
  const relicKeys = Object.keys(localStorage).filter(k => k.startsWith(RELICS_KEY_PREFIX))

  for (const key of relicKeys) {
    const userId = key.slice(RELICS_KEY_PREFIX.length)
    let relics
    try { relics = JSON.parse(localStorage.getItem(key)) || [] } catch { continue }

    for (const r of relics) {
      const createdAt = r.createdAt ?? r.created ?? new Date().toISOString()
      const discardedAt = r.discardedAt ?? r.discarded ?? createdAt
      const updatedAt = r.updatedAt ?? discardedAt

      let coverPath = null
      if (typeof r.coverImage === 'string' && r.coverImage.startsWith('data:image/')) {
        const match = /^data:image\/(\w+);base64,(.+)$/.exec(r.coverImage)
        if (match) {
          const [, subtype, b64] = match
          const ext = subtype === 'jpeg' ? 'jpg' : subtype
          const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0))
          coverPath = await join(await getCoversDir(), `${r.id}.${ext}`)
          await writeFile(coverPath, bytes)
        }
      }

      await db.execute(
        `INSERT OR IGNORE INTO relics (id,user_id,category,title,description,notes,responsible,
           project,filter,thumbnail,cover_image_path,tags,status,revived_at,created_at,discarded_at,updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
        [r.id, userId, r.category, r.title, r.description ?? '', r.notes ?? '', r.responsible ?? '',
         r.project ?? '', r.filter ?? null, r.thumbnail ?? null, coverPath,
         JSON.stringify(r.tags ?? []), r.revived ? 'revived' : 'archived', r.revivedAt ?? null,
         createdAt, discardedAt, updatedAt]
      )

      await db.execute(
        `INSERT INTO relic_status_history (relic_id,from_status,to_status,changed_at)
         VALUES ($1,NULL,'archived',$2)`,
        [r.id, createdAt]
      )
      if (r.revived) {
        await db.execute(
          `INSERT INTO relic_status_history (relic_id,from_status,to_status,changed_at)
           VALUES ($1,'archived','revived',$2)`,
          [r.id, r.revivedAt ?? updatedAt]
        )
      }
    }
  }
}

async function migrateAttachmentsFromIndexedDb(db) {
  let idb
  try {
    idb = await openDB(IDB_NAME, IDB_VERSION)
  } catch (err) {
    console.error('[legacyMigration] could not open legacy IndexedDB:', err)
    return
  }

  // A fresh install has no legacy data: openDB just created an empty database.
  if (!idb.objectStoreNames.contains(IDB_STORE)) return

  const attachments = await idb.getAll(IDB_STORE)
  for (const a of attachments) {
    try {
      const dir = await join(await getAttachmentsDir(), a.relicId)
      await mkdir(dir, { recursive: true })
      const path = await join(dir, `${a.id}.${a.extension}`)
      const bytes = new Uint8Array(await a.blob.arrayBuffer())
      await writeFile(path, bytes)
      await db.execute(
        `INSERT OR IGNORE INTO attachments (id,relic_id,user_id,original_name,extension,mime_type,size,file_path,created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [a.id, a.relicId, a.userId, a.originalName, a.extension, a.mimeType, a.size, path, a.createdAt]
      )
    } catch (err) {
      console.error('[legacyMigration] failed to migrate attachment', a.id, err)
      // Keep going — one bad attachment shouldn't block the rest.
    }
  }
}

export async function migrateLegacyData() {
  const db = await getDb()
  if (await alreadyMigrated(db)) return

  await migrateRelicsFromLocalStorage(db)

  try {
    await migrateAttachmentsFromIndexedDb(db)
  } catch (err) {
    console.error('[legacyMigration] IndexedDB migration step failed:', err)
    // Relics already migrated matter more than attachments — don't block on this.
  }

  await db.execute(
    `INSERT OR REPLACE INTO migration_meta (key,value) VALUES ($1,'true')`, [MIGRATION_FLAG]
  )
}
