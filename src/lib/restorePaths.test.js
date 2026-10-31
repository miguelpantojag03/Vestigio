import { describe, it, expect } from 'vitest'
import { DatabaseSync } from 'node:sqlite'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { rebasePath, rebaseStoredPaths } from './restorePaths.js'

const NEW_ROOT = 'C:\\Users\\new\\AppData\\Local\\com.archivomuerto.app'

describe('rebasePath', () => {
  it('moves an owned file to the new data folder, keeping its subfolders', () => {
    expect(rebasePath('C:\\Users\\old\\AppData\\Local\\com.archivomuerto.app\\attachments\\relic_1\\a.pdf', NEW_ROOT, '\\'))
      .toBe(`${NEW_ROOT}\\attachments\\relic_1\\a.pdf`)
  })

  it('normalizes the mixed separators the app really stores', () => {
    expect(rebasePath('C:\\Users\\old\\AppData\\Local\\com.archivomuerto.app\\covers/relic_1.jpg', NEW_ROOT, '\\'))
      .toBe(`${NEW_ROOT}\\covers\\relic_1.jpg`)
  })

  it('works across operating systems', () => {
    expect(rebasePath('C:\\Users\\old\\AppData\\Local\\app\\linked_copies\\r.psd', '/home/new/.local/share/app', '/'))
      .toBe('/home/new/.local/share/app/linked_copies/r.psd')
  })

  it('is not fooled by a home folder sharing a name with a data folder', () => {
    expect(rebasePath('C:\\Users\\covers\\AppData\\Local\\app\\attachments\\r\\a.pdf', NEW_ROOT, '\\'))
      .toBe(`${NEW_ROOT}\\attachments\\r\\a.pdf`)
  })

  it('leaves paths outside the data folders alone', () => {
    expect(rebasePath('D:\\Work\\final.psd', NEW_ROOT, '\\')).toBe('D:\\Work\\final.psd')
    expect(rebasePath(null, NEW_ROOT, '\\')).toBeNull()
  })

  it('is idempotent, so an interrupted restore can safely run again', () => {
    const once = rebasePath('C:\\old\\covers\\a.jpg', NEW_ROOT, '\\')
    expect(rebasePath(once, NEW_ROOT, '\\')).toBe(once)
  })
})

describe('rebaseStoredPaths', () => {
  it('rewrites every stored path, and nothing else', async () => {
    const sqlite = new DatabaseSync(':memory:')
    sqlite.exec('PRAGMA foreign_keys=ON')
    const dir = join(process.cwd(), 'src-tauri', 'migrations')
    for (const file of readdirSync(dir).sort()) sqlite.exec(readFileSync(join(dir, file), 'utf8'))
    const db = {
      select: async (sql) => sqlite.prepare(sql).all(),
      execute: async (sql, params) => sqlite.prepare(sql.replace(/\$(\d+)/g, '?$1')).run(...params),
    }
    sqlite.prepare(
      `INSERT INTO relics (id,user_id,category,title,created_at,discarded_at,updated_at,cover_image_path,linked_file_path,linked_file_copied_path)
       VALUES ('r1','u','NOTES','t','t','t','t',?,?,?)`
    ).run('C:\\old\\covers/r1.jpg', 'D:\\Work\\final.psd', 'C:\\old\\linked_copies\\r1.psd')
    sqlite.prepare(`INSERT INTO relics (id,user_id,category,title,created_at,discarded_at,updated_at) VALUES ('r2','u','NOTES','t','t','t','t')`).run()
    sqlite.prepare(
      `INSERT INTO attachments (id,relic_id,user_id,original_name,extension,mime_type,size,file_path,created_at)
       VALUES ('a1','r1','u','a.pdf','pdf','m',1,?,'t')`
    ).run('C:\\old\\attachments\\r1/a1.pdf')

    await rebaseStoredPaths(db, NEW_ROOT, '\\')

    const r1 = sqlite.prepare(`SELECT * FROM relics WHERE id='r1'`).get()
    expect(r1.cover_image_path).toBe(`${NEW_ROOT}\\covers\\r1.jpg`)
    expect(r1.linked_file_copied_path).toBe(`${NEW_ROOT}\\linked_copies\\r1.psd`)
    expect(r1.linked_file_path).toBe('D:\\Work\\final.psd')
    expect(sqlite.prepare(`SELECT cover_image_path AS p FROM relics WHERE id='r2'`).get().p).toBeNull()
    expect(sqlite.prepare(`SELECT file_path AS p FROM attachments`).get().p).toBe(`${NEW_ROOT}\\attachments\\r1\\a1.pdf`)
  })
})
