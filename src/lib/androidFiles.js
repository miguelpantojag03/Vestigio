// ─── androidFiles ─────────────────────────────────────────────────
// On Android the file pickers return content:// URIs, not paths. Rust's std::fs
// can't open those and browser downloads don't exist in the WebView, so moving
// a file across that boundary goes through the fs plugin, as bytes.

import { save, open } from '@tauri-apps/plugin-dialog'
import { readFile, writeFile } from '@tauri-apps/plugin-fs'

/** @returns {Promise<boolean>} false if the user cancelled */
export async function saveBytesAs(filename, bytes) {
  const dest = await save({ defaultPath: filename })
  if (!dest) return false
  await writeFile(dest, bytes)
  return true
}

/** @returns {Promise<boolean>} false if the user cancelled */
export function saveTextAs(filename, text) {
  return saveBytesAs(filename, new TextEncoder().encode(text))
}

/** @returns {Promise<Uint8Array|null>} null if the user cancelled */
export async function pickBytes() {
  const source = await open({ multiple: false })
  return source ? readFile(source) : null
}
