// ─── backup ───────────────────────────────────────────────────────
// Full backup/restore: zips the SQLite snapshot (already VACUUM INTO'd
// by the caller, since that must run through the live sql plugin
// connection) together with the attachments/, covers/ and linked_copies/
// folders.
//
// Restore never touches the live db file while the app is running —
// Windows keeps it locked and a mid-write swap can corrupt it. Instead
// it writes everything to `*.pending` siblings, then a marker file once
// all of it is safely on disk; apply_pending_restore() swaps them in
// during .setup(), before any frontend JS (and therefore before the sql
// plugin's lazy connection) has run. No marker means an unfinished
// restore: the leftovers are thrown away and the live data is untouched.
//
// Accounts live in the frontend's localStorage, out of reach of a clean
// start, so they travel as a plain accounts.json the frontend writes on
// export and picks up after a restore (see read_restore_result).

use std::fs::{self, File};
use std::io::{self, Read, Write};
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};
use zip::write::SimpleFileOptions;
use zip::{CompressionMethod, ZipArchive, ZipWriter};

const DB_FILENAME: &str = "archivo_muerto.db";
const DATA_DIRS: [&str; 3] = ["attachments", "covers", "linked_copies"];
const ACCOUNTS_FILENAME: &str = "accounts.json";
const RESTORE_MARKER: &str = "restore.ready";
const RESTORE_RESULT: &str = "restore.applied";
const SQLITE_HEADER: &[u8; 16] = b"SQLite format 3\0";
// Rollback journal files. A stale one would be replayed into the restored db.
const DB_SIDECARS: [&str; 3] = ["-journal", "-wal", "-shm"];

fn zip_options(size: u64) -> SimpleFileOptions {
  SimpleFileOptions::default()
    .compression_method(CompressionMethod::Deflated)
    .large_file(size >= u64::from(u32::MAX))
}

fn add_file_to_zip(zip: &mut ZipWriter<File>, path: &Path, name: String) -> Result<(), String> {
  let mut src = File::open(path).map_err(|e| e.to_string())?;
  let size = src.metadata().map_err(|e| e.to_string())?.len();
  zip
    .start_file(name, zip_options(size))
    .map_err(|e| e.to_string())?;
  io::copy(&mut src, zip).map_err(|e| e.to_string())?;
  Ok(())
}

// The directory entry is written even for an empty or missing folder: it's
// how a restore tells "this backup has no covers" (replace with nothing)
// from a backup made before the folder was included (leave the live one be).
fn add_dir_to_zip(zip: &mut ZipWriter<File>, dir: &Path, prefix: &str) -> Result<(), String> {
  zip
    .add_directory(format!("{prefix}/"), SimpleFileOptions::default())
    .map_err(|e| e.to_string())?;
  if !dir.exists() {
    return Ok(());
  }
  for entry in walkdir::WalkDir::new(dir) {
    let entry = entry.map_err(|e| e.to_string())?;
    let path = entry.path();
    if !path.is_file() {
      continue;
    }
    let rel = path.strip_prefix(dir).map_err(|e| e.to_string())?;
    let name = format!("{}/{}", prefix, rel.to_string_lossy().replace('\\', "/"));
    add_file_to_zip(zip, path, name)?;
  }
  Ok(())
}

fn write_backup_zip(
  local_dir: &Path,
  staging_db: &Path,
  accounts_json: &str,
  zip_path: &Path,
) -> Result<(), String> {
  let file = File::create(zip_path).map_err(|e| e.to_string())?;
  let mut zip = ZipWriter::new(file);
  add_file_to_zip(&mut zip, staging_db, DB_FILENAME.to_string())?;
  zip
    .start_file(ACCOUNTS_FILENAME, zip_options(accounts_json.len() as u64))
    .map_err(|e| e.to_string())?;
  zip
    .write_all(accounts_json.as_bytes())
    .map_err(|e| e.to_string())?;
  for name in DATA_DIRS {
    add_dir_to_zip(&mut zip, &local_dir.join(name), name)?;
  }
  zip.finish().map_err(|e| e.to_string())?;
  Ok(())
}

fn export_to(
  local_dir: &Path,
  staging_db: &Path,
  accounts_json: &str,
  dest_zip: &Path,
) -> Result<(), String> {
  // Written beside the destination first, so a failure can't leave a
  // truncated zip that looks like a backup, or destroy an older backup
  // the user chose to overwrite.
  let mut partial = dest_zip.as_os_str().to_owned();
  partial.push(".partial");
  let partial = PathBuf::from(partial);

  let result = write_backup_zip(local_dir, staging_db, accounts_json, &partial)
    .and_then(|()| fs::rename(&partial, dest_zip).map_err(|e| e.to_string()));
  if result.is_err() {
    let _ = fs::remove_file(&partial);
  }
  let _ = fs::remove_file(staging_db);
  result
}

/// Zips a staging db snapshot (already produced via `VACUUM INTO` by the
/// caller) plus the data folders into `dest_zip_path`.
#[tauri::command]
pub async fn export_backup(
  app: AppHandle,
  staging_db_path: String,
  accounts_json: String,
  dest_zip_path: String,
) -> Result<(), String> {
  let local_dir = app.path().app_local_data_dir().map_err(|e| e.to_string())?;
  export_to(
    &local_dir,
    Path::new(&staging_db_path),
    &accounts_json,
    Path::new(&dest_zip_path),
  )
}

fn pending_name(name: &str) -> String {
  format!("{name}.pending")
}

fn remove_pending(config_dir: &Path, local_dir: &Path) {
  let _ = fs::remove_file(config_dir.join(RESTORE_MARKER));
  let _ = fs::remove_file(config_dir.join(pending_name(DB_FILENAME)));
  let _ = fs::remove_file(config_dir.join(pending_name(ACCOUNTS_FILENAME)));
  for name in DATA_DIRS {
    let _ = fs::remove_dir_all(local_dir.join(pending_name(name)));
  }
}

fn validate_backup(archive: &mut ZipArchive<File>) -> Result<(), String> {
  let mut db = archive
    .by_name(DB_FILENAME)
    .map_err(|_| "invalid_backup".to_string())?;
  let mut header = [0u8; 16];
  db.read_exact(&mut header)
    .map_err(|_| "invalid_backup".to_string())?;
  if &header != SQLITE_HEADER {
    return Err("invalid_backup".into());
  }
  Ok(())
}

// Where a zip entry goes, or None for anything this app doesn't own.
fn pending_dest(name: &str, config_dir: &Path, local_dir: &Path) -> Option<PathBuf> {
  if name == DB_FILENAME || name == ACCOUNTS_FILENAME {
    return Some(config_dir.join(pending_name(name)));
  }
  for dir in DATA_DIRS {
    if name == dir {
      return Some(local_dir.join(pending_name(dir)));
    }
    if let Some(rel) = name.strip_prefix(dir).and_then(|r| r.strip_prefix('/')) {
      return Some(local_dir.join(pending_name(dir)).join(rel));
    }
  }
  None
}

fn extract_to_pending(
  archive: &mut ZipArchive<File>,
  config_dir: &Path,
  local_dir: &Path,
) -> Result<(), String> {
  for i in 0..archive.len() {
    let mut entry = archive.by_index(i).map_err(|e| e.to_string())?;
    let Some(enclosed) = entry.enclosed_name() else { continue };
    let name = enclosed.to_string_lossy().replace('\\', "/");
    let Some(dest) = pending_dest(&name, config_dir, local_dir) else { continue };

    if entry.is_dir() {
      fs::create_dir_all(&dest).map_err(|e| e.to_string())?;
      continue;
    }
    if let Some(parent) = dest.parent() {
      fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let mut out = File::create(&dest).map_err(|e| e.to_string())?;
    io::copy(&mut entry, &mut out).map_err(|e| e.to_string())?;
  }
  // Last on purpose: this is what makes the pending files count as complete.
  fs::write(config_dir.join(RESTORE_MARKER), b"").map_err(|e| e.to_string())
}

fn prepare_restore(src_zip: &Path, config_dir: &Path, local_dir: &Path) -> Result<(), String> {
  let file = File::open(src_zip).map_err(|e| e.to_string())?;
  let mut archive = ZipArchive::new(file).map_err(|_| "invalid_backup".to_string())?;
  validate_backup(&mut archive)?;

  remove_pending(config_dir, local_dir);
  let result = extract_to_pending(&mut archive, config_dir, local_dir);
  if result.is_err() {
    remove_pending(config_dir, local_dir);
  }
  result
}

/// Unpacks `src_zip_path` into `*.pending` siblings of the live db file
/// and data folders. Does not touch the live files — call `relaunch()`
/// from the frontend afterwards so `apply_pending_restore` can swap them
/// in on the next clean start.
#[tauri::command]
pub async fn import_backup(app: AppHandle, src_zip_path: String) -> Result<(), String> {
  let config_dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
  let local_dir = app.path().app_local_data_dir().map_err(|e| e.to_string())?;
  prepare_restore(Path::new(&src_zip_path), &config_dir, &local_dir)
}

fn remove_path(path: &Path) {
  if path.is_dir() {
    let _ = fs::remove_dir_all(path);
  } else {
    let _ = fs::remove_file(path);
  }
}

// The live data is moved aside rather than deleted, and put back if the
// pending one can't take its place.
fn swap_in(pending: &Path, live: &Path) -> io::Result<()> {
  if !pending.exists() {
    return Ok(());
  }
  let mut old = live.as_os_str().to_owned();
  old.push(".old");
  let old = PathBuf::from(old);
  remove_path(&old);

  let had_live = live.exists();
  if had_live {
    fs::rename(live, &old)?;
  }
  if let Err(err) = fs::rename(pending, live) {
    if had_live {
      let _ = fs::rename(&old, live);
    }
    return Err(err);
  }
  remove_path(&old);
  Ok(())
}

fn apply_restore(config_dir: &Path, local_dir: &Path) {
  if !config_dir.join(RESTORE_MARKER).exists() {
    remove_pending(config_dir, local_dir);
    return;
  }

  let live_db = config_dir.join(DB_FILENAME);
  let db_pending = config_dir.join(pending_name(DB_FILENAME));
  if db_pending.exists() {
    for suffix in DB_SIDECARS {
      let _ = fs::remove_file(config_dir.join(format!("{DB_FILENAME}{suffix}")));
    }
  }
  if let Err(err) = swap_in(&db_pending, &live_db) {
    // Keep the current db and drop the rest, so the folders can't end up
    // restored around a database they don't belong to.
    eprintln!("[backup] could not restore the database: {err}");
    remove_pending(config_dir, local_dir);
    return;
  }
  for name in DATA_DIRS {
    if let Err(err) = swap_in(&local_dir.join(pending_name(name)), &local_dir.join(name)) {
      eprintln!("[backup] could not restore {name}: {err}");
    }
  }
  // Tells the frontend, once it starts, that it has a restore to finish.
  let accounts = fs::read_to_string(config_dir.join(pending_name(ACCOUNTS_FILENAME))).unwrap_or_default();
  if let Err(err) = fs::write(config_dir.join(RESTORE_RESULT), accounts) {
    eprintln!("[backup] could not record the restore: {err}");
  }
  remove_pending(config_dir, local_dir);
}

/// Runs on every startup, before the frontend loads. A no-op unless a
/// restore is pending.
pub fn apply_pending_restore(app: &AppHandle) {
  let Ok(config_dir) = app.path().app_config_dir() else { return };
  let Ok(local_dir) = app.path().app_local_data_dir() else { return };
  apply_restore(&config_dir, &local_dir);
}

fn read_result(config_dir: &Path) -> Option<String> {
  fs::read_to_string(config_dir.join(RESTORE_RESULT)).ok()
}

/// The accounts.json of a restore applied on this startup ("" if the backup
/// predates them), or null if there's nothing to finish.
#[tauri::command]
pub fn read_restore_result(app: AppHandle) -> Result<Option<String>, String> {
  let config_dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
  Ok(read_result(&config_dir))
}

/// Separate from reading it: if the frontend dies midway through finishing
/// the restore, it gets to try again on the next start.
#[tauri::command]
pub fn clear_restore_result(app: AppHandle) -> Result<(), String> {
  let config_dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
  fs::remove_file(config_dir.join(RESTORE_RESULT)).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
  use super::*;
  use std::sync::atomic::{AtomicU32, Ordering};

  static NEXT: AtomicU32 = AtomicU32::new(0);
  const ACCOUNTS: &str = r#"{"a@b.c":{"id":"u1","email":"a@b.c"}}"#;

  struct Sandbox {
    root: PathBuf,
    config: PathBuf,
    local: PathBuf,
  }

  impl Sandbox {
    fn new() -> Self {
      let id = NEXT.fetch_add(1, Ordering::SeqCst);
      let root = std::env::temp_dir().join(format!("vestigio_backup_test_{}_{id}", std::process::id()));
      let _ = fs::remove_dir_all(&root);
      let (config, local) = (root.join("config"), root.join("local"));
      fs::create_dir_all(&config).unwrap();
      fs::create_dir_all(&local).unwrap();
      Self { root, config, local }
    }

    fn write_live(&self, rel: &str, contents: &[u8]) {
      let path = self.local.join(rel);
      fs::create_dir_all(path.parent().unwrap()).unwrap();
      fs::write(path, contents).unwrap();
    }

    fn snapshot(&self, name: &str, contents: &[u8]) -> PathBuf {
      let path = self.root.join(name);
      let mut bytes = SQLITE_HEADER.to_vec();
      bytes.extend_from_slice(contents);
      fs::write(&path, bytes).unwrap();
      path
    }

    fn live_db(&self) -> Vec<u8> {
      fs::read(self.config.join(DB_FILENAME)).unwrap()
    }
  }

  impl Drop for Sandbox {
    fn drop(&mut self) {
      let _ = fs::remove_dir_all(&self.root);
    }
  }

  fn db_bytes(contents: &[u8]) -> Vec<u8> {
    let mut bytes = SQLITE_HEADER.to_vec();
    bytes.extend_from_slice(contents);
    bytes
  }

  #[test]
  fn round_trip_restores_every_folder_and_the_db() {
    let s = Sandbox::new();
    s.write_live("attachments/r1/a.pdf", b"attachment");
    s.write_live("covers/r1.jpg", b"cover");
    s.write_live("linked_copies/r1.psd", b"secured copy");
    let staging = s.snapshot("staging.db", b"backed up");
    let zip = s.root.join("backup.zip");
    export_to(&s.local, &staging, ACCOUNTS, &zip).unwrap();
    assert!(!staging.exists(), "staging snapshot is cleaned up");

    // Everything changes after the backup was taken.
    fs::write(s.config.join(DB_FILENAME), db_bytes(b"newer")).unwrap();
    fs::write(s.config.join(format!("{DB_FILENAME}-journal")), b"stale").unwrap();
    fs::remove_dir_all(s.local.join("linked_copies")).unwrap();
    s.write_live("covers/extra.jpg", b"added later");

    prepare_restore(&zip, &s.config, &s.local).unwrap();
    assert_eq!(s.live_db(), db_bytes(b"newer"), "nothing live changes until the restart");
    assert_eq!(read_result(&s.config), None);

    apply_restore(&s.config, &s.local);
    assert_eq!(read_result(&s.config).as_deref(), Some(ACCOUNTS));
    assert!(!s.config.join(pending_name(ACCOUNTS_FILENAME)).exists());
    assert_eq!(s.live_db(), db_bytes(b"backed up"));
    assert!(!s.config.join(format!("{DB_FILENAME}-journal")).exists());
    assert_eq!(fs::read(s.local.join("attachments/r1/a.pdf")).unwrap(), b"attachment");
    assert_eq!(fs::read(s.local.join("linked_copies/r1.psd")).unwrap(), b"secured copy");
    assert!(!s.local.join("covers/extra.jpg").exists());
    assert!(!s.config.join(RESTORE_MARKER).exists());
  }

  #[test]
  fn an_empty_folder_in_the_backup_empties_the_live_one() {
    let s = Sandbox::new();
    let staging = s.snapshot("staging.db", b"x");
    let zip = s.root.join("backup.zip");
    export_to(&s.local, &staging, ACCOUNTS, &zip).unwrap();
    s.write_live("covers/added_later.jpg", b"x");

    prepare_restore(&zip, &s.config, &s.local).unwrap();
    apply_restore(&s.config, &s.local);

    assert!(!s.local.join("covers/added_later.jpg").exists());
  }

  fn old_format_zip(path: &Path, db: &[u8]) {
    let mut zip = ZipWriter::new(File::create(path).unwrap());
    zip.start_file(DB_FILENAME, SimpleFileOptions::default()).unwrap();
    zip.write_all(db).unwrap();
    zip.finish().unwrap();
  }

  #[test]
  fn a_backup_without_a_folder_leaves_the_live_one_alone() {
    let s = Sandbox::new();
    s.write_live("linked_copies/r1.psd", b"keep me");
    let zip = s.root.join("old.zip");
    old_format_zip(&zip, &db_bytes(b"old"));

    prepare_restore(&zip, &s.config, &s.local).unwrap();
    apply_restore(&s.config, &s.local);

    assert_eq!(s.live_db(), db_bytes(b"old"));
    assert_eq!(read_result(&s.config).as_deref(), Some(""), "still signals a restore, with no accounts");
    assert_eq!(fs::read(s.local.join("linked_copies/r1.psd")).unwrap(), b"keep me");
  }

  #[test]
  fn rejects_files_that_are_not_real_backups() {
    let s = Sandbox::new();
    let not_a_zip = s.root.join("not.zip");
    fs::write(&not_a_zip, b"hello").unwrap();
    assert_eq!(prepare_restore(&not_a_zip, &s.config, &s.local), Err("invalid_backup".to_string()));

    let not_a_db = s.root.join("fake.zip");
    old_format_zip(&not_a_db, b"this is definitely not a sqlite file");
    assert_eq!(prepare_restore(&not_a_db, &s.config, &s.local), Err("invalid_backup".to_string()));

    assert!(!s.config.join(pending_name(DB_FILENAME)).exists());
    assert!(!s.config.join(RESTORE_MARKER).exists());
  }

  #[test]
  fn an_interrupted_restore_never_replaces_live_data() {
    let s = Sandbox::new();
    fs::write(s.config.join(DB_FILENAME), db_bytes(b"live")).unwrap();
    s.write_live("attachments/r1/a.pdf", b"live attachment");

    // What a crash halfway through extraction leaves: pending files, no marker.
    fs::write(s.config.join(pending_name(DB_FILENAME)), b"half written").unwrap();
    fs::create_dir_all(s.local.join(pending_name("attachments"))).unwrap();

    apply_restore(&s.config, &s.local);

    assert_eq!(s.live_db(), db_bytes(b"live"));
    assert_eq!(fs::read(s.local.join("attachments/r1/a.pdf")).unwrap(), b"live attachment");
    assert!(!s.config.join(pending_name(DB_FILENAME)).exists());
    assert!(!s.local.join(pending_name("attachments")).exists());
    assert_eq!(read_result(&s.config), None);
  }

  #[test]
  fn a_failed_export_keeps_the_previous_backup() {
    let s = Sandbox::new();
    let zip = s.root.join("backup.zip");
    fs::write(&zip, b"previous backup").unwrap();

    let missing_snapshot = s.root.join("does_not_exist.db");
    assert!(export_to(&s.local, &missing_snapshot, ACCOUNTS, &zip).is_err());

    assert_eq!(fs::read(&zip).unwrap(), b"previous backup");
    assert!(!s.root.join("backup.zip.partial").exists());
  }
}
