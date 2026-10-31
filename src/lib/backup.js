// ─── backup ───────────────────────────────────────────────────────
// Full backup/restore of the local archive: SQLite snapshot (via the
// live connection's own VACUUM INTO, never a raw file copy — avoids
// grabbing a half-written db) plus the attachments/ and covers/
// folders, zipped together by the Rust side (see src-tauri/src/backup.rs).
//
// Restore writes `*.pending` siblings and relaunches the app — the
// swap into the live files happens in Rust's .setup(), before this
// module (or the sql plugin's connection) ever runs again. The app then
// finishes up with finishPendingRestore(), so that a backup also works on
// another machine: accounts come back and file paths follow the new folder.

import { save, open } from '@tauri-apps/plugin-dialog'
import { relaunch } from '@tauri-apps/plugin-process'
import { invoke } from '@tauri-apps/api/core'
import { appLocalDataDir, join, sep } from '@tauri-apps/api/path'
import { getDb } from './db.js'
import { rebaseStoredPaths } from './restorePaths.js'
import MockAuthService from '../auth/MockAuthService.js'

const BACKUP_FILTERS = [{ name: 'Vestigio Backup', extensions: ['zip'] }]

/**
 * Exports a full backup (db + attachments + covers) as a .zip the user
 * picks the destination for.
 * @returns {Promise<string|null>} the written path, or null if cancelled
 */
export async function exportBackup() {
  const destPath = await save({
    defaultPath: `vestigio-backup-${new Date().toISOString().slice(0, 10)}.zip`,
    filters: BACKUP_FILTERS,
  })
  if (!destPath) return null

  const stagingPath = await join(await appLocalDataDir(), `_export_staging_${Date.now()}.db`)
  const db = await getDb()
  // Not parameter-bound: VACUUM INTO's filename grammar is inconsistent
  // across SQLite versions for bound params. Safe here regardless —
  // stagingPath is built from a fixed app-dir path, never user input.
  await db.execute(`VACUUM INTO '${stagingPath.replace(/'/g, "''")}'`)
  const accountsJson = JSON.stringify(await MockAuthService.exportUsers())
  await invoke('export_backup', { stagingDbPath: stagingPath, accountsJson, destZipPath: destPath })
  return destPath
}

/**
 * Restores a backup .zip the user picks. Relaunches the app on success
 * so the restored files take effect from a clean start.
 * @returns {Promise<boolean>} false if the user cancelled the picker
 */
export async function importBackup() {
  const srcPath = await open({ multiple: false, filters: BACKUP_FILTERS })
  if (!srcPath) return false
  await invoke('import_backup', { srcZipPath: srcPath })
  await relaunch()
  return true
}

/**
 * Runs before the first render on every start; a no-op unless a restore was
 * just applied. Safe to repeat if interrupted — it only clears the pending
 * state after everything has succeeded.
 */
export async function finishPendingRestore() {
  const accountsJson = await invoke('read_restore_result')
  if (accountsJson === null) return
  if (accountsJson) await MockAuthService.importUsers(JSON.parse(accountsJson))
  await rebaseStoredPaths(await getDb(), await appLocalDataDir(), sep())
  await invoke('clear_restore_result')
}
