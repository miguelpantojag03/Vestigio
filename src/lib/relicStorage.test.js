import { describe, it, expect, beforeEach, vi } from 'vitest'
import { DatabaseSync } from 'node:sqlite'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

// Runs against real SQLite with the repo's real migrations and foreign keys
// ON (what sqlx does on every connection), so a schema/query mismatch fails
// here. Only the Tauri filesystem is faked, as a Map of path -> bytes.
const files = new Map()
let sqlite

vi.mock('@tauri-apps/plugin-fs', () => ({
  writeFile: vi.fn(async (path, bytes) => { files.set(path, bytes) }),
  exists: vi.fn(async path => files.has(path)),
  remove: vi.fn(async (path, opts) => {
    if (opts?.recursive) {
      for (const key of [...files.keys()]) if (key.startsWith(`${path}/`)) files.delete(key)
    } else {
      files.delete(path)
    }
  }),
}))
vi.mock('@tauri-apps/api/core', () => ({ convertFileSrc: path => `asset://${path}` }))
vi.mock('./fsPaths.js', () => ({
  getCoversDir: async () => '/data/covers',
  getAttachmentsDir: async () => '/data/attachments',
}))
vi.mock('./db.js', () => ({
  getDb: async () => ({
    select: async (sql, params = []) => sqlite.prepare(sql.replace(/\$(\d+)/g, '?$1')).all(...params),
    execute: async (sql, params = []) => sqlite.prepare(sql.replace(/\$(\d+)/g, '?$1')).run(...params),
  }),
}))

const { addRelic, deleteRelic } = await import('./relicStorage.js')

const USER = 'user_1'

function makeRelic(id, extra = {}) {
  return {
    id, category: 'NOTES', title: `Relic ${id}`, status: 'archived', tags: [],
    createdAt: '2026-01-01T00:00:00.000Z', discardedAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    ...extra,
  }
}

const count = (table, where = '1=1') => sqlite.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE ${where}`).get().n

function addAttachmentRow(relicId, path) {
  sqlite.prepare(
    `INSERT INTO attachments (id,relic_id,user_id,original_name,extension,mime_type,size,file_path,created_at)
     VALUES (?,?,?,'a.pdf','pdf','application/pdf',1,?,'t')`
  ).run(`att_${relicId}`, relicId, USER, path)
  files.set(path, new Uint8Array([1]))
}

beforeEach(() => {
  files.clear()
  sqlite = new DatabaseSync(':memory:')
  sqlite.exec('PRAGMA foreign_keys=ON')
  const dir = join(process.cwd(), 'src-tauri', 'migrations')
  for (const file of readdirSync(dir).sort()) sqlite.exec(readFileSync(join(dir, file), 'utf8'))
})

describe('attachments schema', () => {
  it('accepts an attachment staged before its relic exists', () => {
    expect(() => addAttachmentRow('relic_not_saved_yet', '/data/attachments/x/a.pdf')).not.toThrow()
  })
})

describe('deleteRelic', () => {
  it('removes every row and file belonging to the relic', async () => {
    await addRelic(USER, makeRelic('r1', { linkedFileCopiedPath: '/data/linked_copies/r1.pdf' }))
    files.set('/data/linked_copies/r1.pdf', new Uint8Array([1]))
    addAttachmentRow('r1', '/data/attachments/r1/a.pdf')
    sqlite.prepare(
      `INSERT INTO drafts (id,relic_id,user_id,title,created_at,updated_at) VALUES ('d1','r1',?,'t','t','t')`
    ).run(USER)

    await deleteRelic(USER, 'r1')

    expect(count('relics')).toBe(0)
    expect(count('attachments')).toBe(0)
    expect(count('drafts')).toBe(0)
    expect(count('relic_status_history')).toBe(0)
    expect(files.size).toBe(0)
  })

  it("leaves other relics' files alone", async () => {
    await addRelic(USER, makeRelic('r1'))
    await addRelic(USER, makeRelic('r2'))
    addAttachmentRow('r1', '/data/attachments/r1/a.pdf')
    addAttachmentRow('r2', '/data/attachments/r2/a.pdf')

    const remaining = await deleteRelic(USER, 'r1')

    expect(remaining.map(r => r.id)).toEqual(['r2'])
    expect([...files.keys()]).toEqual(['/data/attachments/r2/a.pdf'])
    expect(count('attachments', "relic_id='r2'")).toBe(1)
  })

  it("does nothing to a relic owned by another user", async () => {
    await addRelic('someone_else', makeRelic('r1'))
    addAttachmentRow('r1', '/data/attachments/r1/a.pdf')

    await deleteRelic(USER, 'r1')

    expect(count('relics')).toBe(1)
    expect(count('attachments')).toBe(1)
    expect(files.has('/data/attachments/r1/a.pdf')).toBe(true)
  })

  it('reports a failed delete instead of pretending it worked, and keeps the files', async () => {
    await addRelic(USER, makeRelic('r1'))
    addAttachmentRow('r1', '/data/attachments/r1/a.pdf')
    sqlite.exec('DROP TABLE drafts')
    vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(deleteRelic(USER, 'r1')).rejects.toThrow()

    expect(files.has('/data/attachments/r1/a.pdf')).toBe(true)
  })
})
