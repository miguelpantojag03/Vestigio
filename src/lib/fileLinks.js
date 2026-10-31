// ─── fileLinks ────────────────────────────────────────────────────
// Links a relic to a real external file on disk (not copied into the
// app), with an optional internal backup copy ("Asegurar copia").
//
// Broken-link detection is existence-based (exists()), not a content
// hash — hashing a large .psd/.pdf on every check would be wasteful.
// Modification detection uses mtime instead, same reasoning.

import { open as openDialog } from '@tauri-apps/plugin-dialog'
import { openPath } from '@tauri-apps/plugin-opener'
import { exists, stat, copyFile } from '@tauri-apps/plugin-fs'
import { join } from '@tauri-apps/api/path'
import { getLinkedCopiesDir } from './fsPaths.js'
import i18n from '../i18n/index.js'

/**
 * Opens the native "choose a file" dialog and returns its path + mtime,
 * or null if the user cancelled.
 * @returns {Promise<{path: string, mtime: string}|null>}
 */
export async function pickFileToLink() {
  const path = await openDialog({ multiple: false })
  if (!path) return null
  const info = await stat(path)
  return { path, mtime: info.mtime ? info.mtime.toISOString() : null }
}

/**
 * Current status of a relic's linked file.
 * @returns {Promise<'none'|'ok'|'modified'|'broken'>}
 */
export async function getLinkStatus(relic) {
  if (!relic?.linkedFilePath) return 'none'
  const isThere = await exists(relic.linkedFilePath)
  if (!isThere) return 'broken'
  if (relic.linkedFileMtime) {
    const info = await stat(relic.linkedFilePath)
    const currentMtime = info.mtime ? info.mtime.toISOString() : null
    if (currentMtime && currentMtime !== relic.linkedFileMtime) return 'modified'
  }
  return 'ok'
}

function fileLinkError(message, code) {
  return Object.assign(new Error(message), { code })
}

/** Opens the linked file with the system's default app for its type. */
export async function openLinkedFile(relic) {
  if (!relic?.linkedFilePath) throw fileLinkError(i18n.t('fileLinks.errors.noLink'), 'none')
  if (!(await exists(relic.linkedFilePath))) throw fileLinkError(i18n.t('fileLinks.errors.missing'), 'broken')
  await openPath(relic.linkedFilePath)
}

/** Opens the internal backup copy instead (e.g. when the original link is broken). */
export async function openCopiedFile(relic) {
  if (!relic?.linkedFileCopiedPath) throw fileLinkError(i18n.t('fileLinks.errors.noCopy'), 'none')
  await openPath(relic.linkedFileCopiedPath)
}

/**
 * Copies the externally-linked file into app storage as a backup.
 * @returns {Promise<string>} the new internal copy's absolute path
 */
export async function secureCopy(relic) {
  if (!relic?.linkedFilePath) throw fileLinkError(i18n.t('fileLinks.errors.noLink'), 'none')
  if (!(await exists(relic.linkedFilePath))) throw fileLinkError(i18n.t('fileLinks.errors.missing'), 'broken')
  const ext = relic.linkedFilePath.split('.').pop()?.toLowerCase() ?? ''
  const dir = await getLinkedCopiesDir()
  const dest = await join(dir, ext ? `${relic.id}.${ext}` : relic.id)
  try {
    await copyFile(relic.linkedFilePath, dest)
  } catch (err) {
    console.error('[fileLinks] secureCopy failed:', err)
    throw fileLinkError(i18n.t('relicDetails.linkedFile.copyError'), 'copy')
  }
  return dest
}

/** Basename for display — works for both '/' and '\' separators. */
export function basename(path) {
  if (!path) return ''
  return path.split(/[\\/]/).pop()
}
