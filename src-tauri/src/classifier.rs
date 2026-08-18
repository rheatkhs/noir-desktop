use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ActionClass {
    Safe,
    Destructive,
    Unknown,
}

impl ActionClass {
    pub fn as_str(&self) -> &str {
        match self {
            Self::Safe => "safe",
            Self::Destructive => "destructive",
            Self::Unknown => "unknown",
        }
    }
}

pub fn classify_action(tool_name: &str, input: &str) -> ActionClass {
    match tool_name {
        "read_file" | "list_directory" | "code_search" | "git_diff" => ActionClass::Safe,
        "write_file" | "create_directory" => ActionClass::Unknown,
        "execute_bash" => classify_bash_command(input),
        _ => ActionClass::Unknown,
    }
}

fn classify_bash_command(input: &str) -> ActionClass {
    let params: serde_json::Value = serde_json::from_str(input).unwrap_or_default();
    let command = params["command"]
        .as_str()
        .unwrap_or(input)
        .to_lowercase();

    let trimmed = command.trim();
    if trimmed.is_empty() {
        return ActionClass::Unknown;
    }

    // Check for redirect overwrite (but not append >>)
    if contains_redirect_overwrite(&command) {
        return ActionClass::Destructive;
    }

    let destructive_patterns: &[&str] = &[
        "rm ", "rm\t", "rmdir", "del ", "del\t", "format ",
        "mkfs", "dd if=", "chmod 777", "> /dev", "truncate",
        "shred", "wipefs", "kill -9", "pkill", "shutdown",
        "reboot", "halt", "poweroff",
    ];

    for pattern in destructive_patterns {
        if command.contains(pattern) {
            return ActionClass::Destructive;
        }
    }

    let safe_patterns: &[&str] = &[
        "ls", "cat ", "echo ", "pwd", "whoami", "which ",
        "git status", "git log", "git diff", "git branch",
        "head ", "tail ", "wc ", "grep ", "find ",
        "env", "printenv", "date", "uname",
    ];

    for pattern in safe_patterns {
        if trimmed.starts_with(pattern) || command.contains(&format!("| {pattern}")) {
            return ActionClass::Safe;
        }
    }

    ActionClass::Unknown
}

/// Detect `>` redirect-overwrite but not `>>` append or `2>` stderr redirect.
fn contains_redirect_overwrite(command: &str) -> bool {
    let bytes = command.as_bytes();
    for i in 0..bytes.len() {
        if bytes[i] == b'>' {
            // Skip >> (append)
            if i + 1 < bytes.len() && bytes[i + 1] == b'>' {
                continue;
            }
            // Skip 2> (stderr redirect) — check preceding char
            if i > 0 && bytes[i - 1] == b'2' {
                continue;
            }
            return true;
        }
    }
    false
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_safe_tools() {
        assert!(matches!(classify_action("read_file", "{}"), ActionClass::Safe));
        assert!(matches!(classify_action("list_directory", "{}"), ActionClass::Safe));
        assert!(matches!(classify_action("code_search", "{}"), ActionClass::Safe));
        assert!(matches!(classify_action("git_diff", "{}"), ActionClass::Safe));
    }

    #[test]
    fn test_destructive_bash() {
        let input = r#"{"command": "rm -rf /tmp/test"}"#;
        assert!(matches!(classify_bash_command(input), ActionClass::Destructive));
    }

    #[test]
    fn test_safe_bash() {
        let input = r#"{"command": "git status"}"#;
        assert!(matches!(classify_bash_command(input), ActionClass::Safe));
    }

    #[test]
    fn test_redirect_overwrite() {
        let input = r#"{"command": "echo hello > file.txt"}"#;
        assert!(matches!(classify_bash_command(input), ActionClass::Destructive));
    }

    #[test]
    fn test_append_not_destructive() {
        let input = r#"{"command": "echo hello >> file.txt"}"#;
        assert!(!matches!(classify_bash_command(input), ActionClass::Destructive));
    }

    #[test]
    fn test_unknown_bash() {
        let input = r#"{"command": "cargo build"}"#;
        assert!(matches!(classify_bash_command(input), ActionClass::Unknown));
    }

    #[test]
    fn test_write_file_unknown() {
        assert!(matches!(classify_action("write_file", "{}"), ActionClass::Unknown));
    }
}
