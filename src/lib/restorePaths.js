// ─── restorePaths ─────────────────────────────────────────────────
// The database stores absolute paths to the files it owns, so a backup made
// on another machine (or Windows user) points at folders that don't exist
// here. After a restore, this rewrites them to the current data folder.

const OWNED_PATH = /^.*[\\/](attachments|covers|linked_copies)[\\/](.+)$/

/**
 * Greedy on purpose: the last matching folder is the real one, even if the
 * old home folder happened to be called "covers". Anything else, such as a
 * linked file outside the app, isn't ours and comes back unchanged.
 */
export function rebasePath(stored, localDataDir, sep) {
  const match = OWNED_PATH.exec(stored ?? '')
  if (!match) return stored
  const [, folder, rest] = match
  return [localDataDir, folder, ...rest.split(/[\\/]/)].join(sep)
}

async function rebaseColumn(db, table, column, localDataDir, sep) {
  const rows = await db.select(`SELECT id, ${column} AS path FROM ${table} WHERE ${column} IS NOT NULL`)
  for (const { id, path } of rows) {
    const rebased = rebasePath(path, localDataDir, sep)
    if (rebased !== path) {
      await db.execute(`UPDATE ${table} SET ${column}=$1 WHERE id=$2`, [rebased, id])
    }
  }
}

export async function rebaseStoredPaths(db, localDataDir, sep) {
  await rebaseColumn(db, 'attachments', 'file_path', localDataDir, sep)
  await rebaseColumn(db, 'relics', 'cover_image_path', localDataDir, sep)
  await rebaseColumn(db, 'relics', 'linked_file_copied_path', localDataDir, sep)
}
