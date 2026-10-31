#[cfg(desktop)]
use tauri::Manager;
use tauri_plugin_sql::{Migration, MigrationKind};

mod backup;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let migrations = vec![
    Migration {
      version: 1,
      description: "create_initial_tables",
      sql: include_str!("../migrations/0001_init.sql"),
      kind: MigrationKind::Up,
    },
    Migration {
      version: 2,
      description: "add_lineage_columns",
      sql: include_str!("../migrations/0002_lineage.sql"),
      kind: MigrationKind::Up,
    },
    Migration {
      version: 3,
      description: "add_external_link_columns",
      sql: include_str!("../migrations/0003_external_links.sql"),
      kind: MigrationKind::Up,
    },
    Migration {
      version: 4,
      description: "add_fork_column",
      sql: include_str!("../migrations/0004_fork.sql"),
      kind: MigrationKind::Up,
    },
    Migration {
      version: 5,
      description: "add_projects",
      sql: include_str!("../migrations/0005_projects.sql"),
      kind: MigrationKind::Up,
    },
    Migration {
      version: 6,
      description: "add_drafts",
      sql: include_str!("../migrations/0006_drafts.sql"),
      kind: MigrationKind::Up,
    },
    Migration {
      version: 7,
      description: "remove_fork_column",
      sql: include_str!("../migrations/0007_remove_fork.sql"),
      kind: MigrationKind::Up,
    },
    Migration {
      version: 8,
      description: "remove_lineage_columns",
      sql: include_str!("../migrations/0008_remove_lineage.sql"),
      kind: MigrationKind::Up,
    },
    Migration {
      version: 9,
      description: "attachments_no_relic_fk",
      sql: include_str!("../migrations/0009_attachments_no_relic_fk.sql"),
      kind: MigrationKind::Up,
    },
    Migration {
      version: 10,
      description: "add_trash",
      sql: include_str!("../migrations/0010_trash.sql"),
      kind: MigrationKind::Up,
    },
    Migration {
      version: 11,
      description: "add_death_cause",
      sql: include_str!("../migrations/0011_death_cause.sql"),
      kind: MigrationKind::Up,
    },
  ];

  let builder = tauri::Builder::default();

  // Must be the first plugin registered. A second launch hands its args
  // to this callback instead of opening its own window/storage context —
  // without this, two windows writing to the same localStorage/IndexedDB
  // profile can silently overwrite each other's saves.
  #[cfg(desktop)]
  let builder = builder
    .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
      if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.set_focus();
      }
    }))
    .plugin(tauri_plugin_oauth::init());

  builder
    .plugin(
      tauri_plugin_sql::Builder::default()
        .add_migrations("sqlite:archivo_muerto.db", migrations)
        .build(),
    )
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_opener::init())
    .plugin(tauri_plugin_http::init())
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_process::init())
    .invoke_handler(tauri::generate_handler![
      backup::export_backup,
      backup::import_backup,
      backup::read_restore_result,
      backup::clear_restore_result
    ])
    .setup(|app| {
      // Must run before the frontend's first Database.load() call.
      backup::apply_pending_restore(app.handle());
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while building tauri application");
}
