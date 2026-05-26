use crate::policy::FieldPolicies;
use crate::role::RoleDefinition;
use serde::Deserialize;
use std::env;
use std::path::{Path, PathBuf};

/// Raw structure of oss-roles.yaml, used only for deserialization.
#[derive(Debug, Deserialize)]
struct OssRolesFile {
    roles: Vec<RoleDefinition>,

    /// Optional field policies block. Defaults to empty if omitted in YAML.
    #[serde(default)]
    field_policies: FieldPolicies,
}

/// The fully loaded OSS policy: roles + field visibility rules.
#[derive(Debug, Clone)]
pub struct OssPolicyConfig {
    /// All four built-in role definitions.
    pub roles: Vec<RoleDefinition>,

    /// Field-level read rules keyed by entity_name → field_name.
    pub field_policies: FieldPolicies,
}

impl OssPolicyConfig {
    /// Return the bundled default path to oss-roles.yaml inside this crate.
    pub fn default_config_path() -> PathBuf {
        PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("config/oss-roles.yaml")
    }

    /// Resolve which policy file to load.
    /// Uses POLICY_CONFIG_PATH when set, otherwise the bundled crate default.
    pub fn resolve_config_path() -> PathBuf {
        env::var("POLICY_CONFIG_PATH")
            .map(PathBuf::from)
            .unwrap_or_else(|_| Self::default_config_path())
    }

    /// Load OSS policy from the resolved config path.
    /// This is the entry point other services should use — they must not read YAML directly.
    pub fn load() -> Result<Self, PolicyError> {
        let config_path = Self::resolve_config_path();
        Self::load_from_file(&config_path)
    }

    /// Load policy from a YAML file at the given path.
    /// Intended for tests and advanced overrides inside policy-engine only.
    pub fn load_from_file(path: &Path) -> Result<Self, PolicyError> {
        let yaml_text = std::fs::read_to_string(path).map_err(|io_error| {
            PolicyError::FileRead {
                path: path.display().to_string(),
                message: io_error.to_string(),
            }
        })?;

        Self::load_from_yaml_str(&yaml_text)
    }

    /// Load policy from a YAML string (useful for tests or embedded defaults).
    pub fn load_from_yaml_str(yaml_text: &str) -> Result<Self, PolicyError> {
        let raw: OssRolesFile =
            serde_yaml::from_str(yaml_text).map_err(|parse_error| PolicyError::ParseFailed {
                message: parse_error.to_string(),
            })?;

        if raw.roles.is_empty() {
            return Err(PolicyError::NoRolesDefined);
        }

        Ok(OssPolicyConfig {
            roles: raw.roles,
            field_policies: raw.field_policies,
        })
    }

    /// Return the list of valid role ids (e.g. for partition-key validation).
    pub fn role_ids(&self) -> Vec<&str> {
        self.roles.iter().map(|role| role.id.as_str()).collect()
    }

    /// Return true if the given role id is defined in this config.
    pub fn is_valid_role(&self, role_id: &str) -> bool {
        self.roles.iter().any(|role| role.id == role_id)
    }
}

/// Errors that can occur while loading the OSS policy configuration.
#[derive(Debug, thiserror::Error)]
pub enum PolicyError {
    #[error("could not read policy file at '{path}': {message}")]
    FileRead { path: String, message: String },

    #[error("failed to parse oss-roles.yaml: {message}")]
    ParseFailed { message: String },

    #[error("oss-roles.yaml must define at least one role")]
    NoRolesDefined,
}
