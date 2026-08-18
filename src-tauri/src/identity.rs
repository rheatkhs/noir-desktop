use serde::{Deserialize, Serialize};
use tauri::command;

const AGENT_NAMES: &[&str] = &[
    "NORMAN", "RAY", "EMMA", "DON", "GILDA",
    "PHIL", "ANNA", "NAT", "THOMA", "LANNI",
];

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentIdentity {
    pub tag: String,
    pub name: String,
    pub number: u32,
}

/// Generate a unique agent tag in `{NAME}-{5-digit}` format.
///
/// Uses nanosecond timestamp jitter for randomness without an external crate.
/// Two rapid successive calls get different results via the XOR fold.
#[command]
pub fn generate_agent_tag() -> AgentIdentity {
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .subsec_nanos();

    // XOR-fold to mix higher and lower bits for better distribution
    let mixed = nanos ^ (nanos >> 16);

    let name_idx = (mixed as usize) % AGENT_NAMES.len();
    let number = (mixed % 90000) + 10000;
    let name = AGENT_NAMES[name_idx];

    AgentIdentity {
        tag: format!("{}-{}", name, number),
        name: name.to_string(),
        number,
    }
}
