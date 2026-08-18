mod classifier;
mod commands;
mod identity;
mod orchestrator;
mod providers;
mod schema;
mod streaming;
mod types;

use tauri_plugin_sql::{Migration, MigrationKind};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![Migration {
        version: 1,
        description: "initialize noir desktop schema",
        sql: schema::INIT_SCHEMA,
        kind: MigrationKind::Up,
    }];

    tauri::Builder::default()
        .plugin(
            tauri_plugin_log::Builder::default()
                .level(log::LevelFilter::Info)
                .build(),
        )
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:noir.db", migrations)
                .build(),
        )
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            commands::execute_bash,
            commands::read_file,
            commands::write_file,
            commands::list_directory,
            commands::get_working_dir,
            commands::set_working_dir,
            streaming::stream_chat,
            orchestrator::run_agent,
            identity::generate_agent_tag,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
