// policy-engine: shared OSS access-control library for AnythingGraph.
//
// Single source of truth for OSS roles and field policies.
// Other services (data-layer-service, rdf-cache-service) must call OssPolicyConfig::load()
// and must not read oss-roles.yaml directly.
//
// Usage:
//   let policy = OssPolicyConfig::load()?;
//   policy.is_valid_role("viewer");
//   filter_fields_for_role(&policy.field_policies, role_id, entity_name, row_fields);

pub mod loader;
pub mod policy;
pub mod role;

// Re-export the most commonly used items at the crate root for convenience.
pub use loader::{OssPolicyConfig, PolicyError};
pub use policy::{filter_fields_for_role, role_can_read_field, FieldPolicies};
pub use role::{RoleDefinition, OSS_ROLE_IDS};

#[cfg(test)]
mod tests {
    use super::*;

    // Minimal YAML with all four roles and one field rule.
    const SAMPLE_YAML: &str = r#"
roles:
  - id: viewer
    display_name: Viewer
    description: Read-only, non-sensitive fields.
  - id: editor
    display_name: Editor
    description: Operational read/write, no sensitive data.
  - id: analyst
    display_name: Analyst
    description: Operational and financial read access.
  - id: admin
    display_name: Admin
    description: Full read access.

field_policies:
  employee:
    salary:
      read: [analyst, admin]
    name:
      read: [viewer, editor, analyst, admin]
"#;

    // Check that all four roles load correctly.
    #[test]
    fn test_loads_four_roles() {
        let config = OssPolicyConfig::load_from_yaml_str(SAMPLE_YAML).unwrap();
        assert_eq!(config.roles.len(), 4);
        assert!(config.is_valid_role("viewer"));
        assert!(config.is_valid_role("editor"));
        assert!(config.is_valid_role("analyst"));
        assert!(config.is_valid_role("admin"));
    }

    // Unknown roles should not be accepted.
    #[test]
    fn test_rejects_unknown_role() {
        let config = OssPolicyConfig::load_from_yaml_str(SAMPLE_YAML).unwrap();
        assert!(!config.is_valid_role("superadmin"));
        assert!(!config.is_valid_role("custom_role"));
    }

    // Bundled oss-roles.yaml should load via the crate default path.
    #[test]
    fn test_loads_bundled_default_config() {
        let config = OssPolicyConfig::load().unwrap();
        assert_eq!(config.roles.len(), 4);
        assert!(config.is_valid_role("admin"));
    }

    // analyst and admin may read salary; viewer and editor may not.
    #[test]
    fn test_salary_visible_to_analyst_and_admin() {
        let config = OssPolicyConfig::load_from_yaml_str(SAMPLE_YAML).unwrap();
        let policies = &config.field_policies;

        assert!(role_can_read_field(policies, "analyst", "employee", "salary"));
        assert!(role_can_read_field(policies, "admin", "employee", "salary"));
        assert!(!role_can_read_field(policies, "viewer", "employee", "salary"));
        assert!(!role_can_read_field(policies, "editor", "employee", "salary"));
    }

    // Fields with no rule should be readable by all roles.
    #[test]
    fn test_unlisted_field_is_open_to_all() {
        let config = OssPolicyConfig::load_from_yaml_str(SAMPLE_YAML).unwrap();
        let policies = &config.field_policies;

        // 'department' has no rule on 'employee' — all roles may read it.
        assert!(role_can_read_field(policies, "viewer", "employee", "department"));
        assert!(role_can_read_field(policies, "editor", "employee", "department"));
    }

    // Entities with no policy block are fully open to all roles.
    #[test]
    fn test_entity_with_no_policy_is_open() {
        let config = OssPolicyConfig::load_from_yaml_str(SAMPLE_YAML).unwrap();
        let policies = &config.field_policies;

        assert!(role_can_read_field(policies, "viewer", "invoice", "amount"));
        assert!(role_can_read_field(policies, "viewer", "invoice", "vendor"));
    }

    // filter_fields_for_role should strip forbidden fields and keep allowed ones.
    #[test]
    fn test_filter_fields_for_role() {
        let config = OssPolicyConfig::load_from_yaml_str(SAMPLE_YAML).unwrap();
        let policies = &config.field_policies;

        let mut row_fields = std::collections::HashMap::new();
        row_fields.insert("name".to_string(), serde_json::json!("Alice"));
        row_fields.insert("salary".to_string(), serde_json::json!(95000));
        row_fields.insert("department".to_string(), serde_json::json!("Engineering"));

        let viewer_view = filter_fields_for_role(policies, "viewer", "employee", row_fields.clone());
        assert!(viewer_view.contains_key("name"));
        assert!(viewer_view.contains_key("department"));
        assert!(!viewer_view.contains_key("salary"), "viewer must not see salary");

        let analyst_view = filter_fields_for_role(policies, "analyst", "employee", row_fields);
        assert!(analyst_view.contains_key("name"));
        assert!(analyst_view.contains_key("salary"), "analyst must see salary");
    }
}
