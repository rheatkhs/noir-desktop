use serde::Serialize;
use std::path::PathBuf;
use tauri::command;
use tokio::process::Command as TokioCommand;

// ─── Shell Execution ────────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct ShellOutput {
    pub stdout: String,
    pub stderr: String,
    pub exit_code: Option<i32>,
}

#[command]
pub async fn execute_bash(command: String, cwd: Option<String>) -> Result<ShellOutput, String> {
    let working_dir = cwd.unwrap_or_else(|| ".".into());

    #[cfg(target_os = "windows")]
    let output = TokioCommand::new("cmd")
        .args(["/C", &command])
        .current_dir(&working_dir)
        .output()
        .await
        .map_err(|e| format!("Failed to execute command: {e}"))?;

    #[cfg(not(target_os = "windows"))]
    let output = TokioCommand::new("sh")
        .args(["-c", &command])
        .current_dir(&working_dir)
        .output()
        .await
        .map_err(|e| format!("Failed to execute command: {e}"))?;

    Ok(ShellOutput {
        stdout: String::from_utf8_lossy(&output.stdout).into_owned(),
        stderr: String::from_utf8_lossy(&output.stderr).into_owned(),
        exit_code: output.status.code(),
    })
}

// ─── Filesystem Operations ──────────────────────────────────────

#[command]
pub async fn read_file(path: String) -> Result<String, String> {
    tokio::fs::read_to_string(&path)
        .await
        .map_err(|e| format!("Failed to read file '{path}': {e}"))
}

#[command]
pub async fn write_file(path: String, contents: String) -> Result<(), String> {
    if let Some(parent) = PathBuf::from(&path).parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| format!("Failed to create directories: {e}"))?;
    }
    tokio::fs::write(&path, contents)
        .await
        .map_err(|e| format!("Failed to write file '{path}': {e}"))
}

#[command]
pub async fn list_directory(path: String) -> Result<Vec<DirEntry>, String> {
    let mut entries = Vec::new();
    let mut read_dir = tokio::fs::read_dir(&path)
        .await
        .map_err(|e| format!("Failed to read directory '{path}': {e}"))?;

    while let Some(entry) = read_dir
        .next_entry()
        .await
        .map_err(|e| format!("Failed to read entry: {e}"))?
    {
        let metadata = entry
            .metadata()
            .await
            .map_err(|e| format!("Failed to read metadata: {e}"))?;

        entries.push(DirEntry {
            name: entry.file_name().to_string_lossy().into_owned(),
            is_dir: metadata.is_dir(),
            size: metadata.len(),
        });
    }

    entries.sort_by(|a, b| {
        b.is_dir.cmp(&a.is_dir).then(a.name.cmp(&b.name))
    });

    Ok(entries)
}

#[derive(Debug, Serialize)]
pub struct DirEntry {
    pub name: String,
    pub is_dir: bool,
    pub size: u64,
}

// ─── Utilities ──────────────────────────────────────────────────

#[command]
pub fn get_working_dir() -> Result<String, String> {
    std::env::current_dir()
        .map(|p| p.to_string_lossy().into_owned())
        .map_err(|e| format!("Failed to get working directory: {e}"))
}
