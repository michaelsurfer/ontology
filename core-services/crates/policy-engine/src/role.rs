use serde::{Deserialize, Serialize};

/// A single built-in OSS role as read from oss-roles.yaml.
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct RoleDefinition {
    /// Machine-readable id used in headers, env vars, and partition keys.
    /// Example: "viewer", "editor", "analyst", "admin"
    pub id: String,

    /// Human-friendly label shown in the dashboard role picker.
    pub display_name: String,

    /// Short description shown in the UI and documentation.
    pub description: String,
}

/// Convenience: return the four OSS role ids as static strings.
/// Useful for quick allowlist checks without loading the YAML.
pub const OSS_ROLE_IDS: &[&str] = &["viewer", "editor", "analyst", "admin"];
