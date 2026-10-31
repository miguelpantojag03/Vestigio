// ─── projectStorage ───────────────────────────────────────────────
// SQLite-backed project CRUD. A project groups relics (relics.project_id);
// deleting one never deletes its ideas — they're orphaned back into
// "sin proyecto" (project_id = NULL) instead, visible in global search.

import { getDb } from './db.js'
import { ensureDemoData } from './relicStorage.js'

function makeId() {
  return `proj_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
}

function fromRow(row) {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/** @returns {Promise<Project[]>} ordered by most recently updated first */
export async function getProjects(userId) {
  await ensureDemoData(userId) // the demo account's projects come from its seed
  const db = await getDb()
  const rows = await db.select(
    `SELECT * FROM projects WHERE user_id = $1 ORDER BY updated_at DESC`,
    [userId]
  )
  return rows.map(fromRow)
}

/** @returns {Promise<Project>} */
export async function createProject(userId, name) {
  const db = await getDb()
  const id = makeId()
  const now = new Date().toISOString()
  await db.execute(
    `INSERT INTO projects (id, user_id, name, created_at, updated_at) VALUES ($1,$2,$3,$4,$5)`,
    [id, userId, name.trim(), now, now]
  )
  return { id, name: name.trim(), createdAt: now, updatedAt: now }
}

export async function renameProject(id, name) {
  const db = await getDb()
  await db.execute(
    `UPDATE projects SET name = $1, updated_at = $2 WHERE id = $3`,
    [name.trim(), new Date().toISOString(), id]
  )
  // relics.project is a denormalized copy of the name (the CSV/JSON exports read it).
  await db.execute(`UPDATE relics SET project = $1 WHERE project_id = $2`, [name.trim(), id])
}

/** Deletes the project. Its relics are kept, orphaned to project_id = NULL. */
export async function deleteProject(id) {
  const db = await getDb()
  await db.execute(`UPDATE relics SET project_id = NULL, project = '' WHERE project_id = $1`, [id])
  await db.execute(`DELETE FROM projects WHERE id = $1`, [id])
}
