use serde::Deserialize;
use std::collections::HashMap;

/// Field-level read rule for one field on one entity.
/// Lists the role ids that are allowed to read this field.
/// If a field has no rule entry it is readable by all roles.
#[derive(Debug, Clone, Deserialize)]
pub struct FieldReadRule {
    /// Role ids that may read this field.
    /// Example: ["analyst", "admin"]
    pub read: Vec<String>,
}

/// All field rules for a single entity type.
/// Key: field_name (snake_case, matches entity definition).
pub type EntityFieldPolicies = HashMap<String, FieldReadRule>;

/// The complete set of field policies loaded from oss-roles.yaml.
/// Key: entity name (snake_case). Value: per-field rules.
pub type FieldPolicies = HashMap<String, EntityFieldPolicies>;

/// Decide whether a given role may read a specific field on a specific entity.
/// Returns true (allow) when:
///   - No rule exists for the entity, or
///   - No rule exists for the specific field, or
///   - The role id is in the field's allowed read list.
pub fn role_can_read_field(
    field_policies: &FieldPolicies,
    role_id: &str,
    entity_name: &str,
    field_name: &str,
) -> bool {
    let Some(entity_policies) = field_policies.get(entity_name) else {
        // No policy entry for this entity — allow all roles.
        return true;
    };

    let Some(field_rule) = entity_policies.get(field_name) else {
        // No policy entry for this field — allow all roles.
        return true;
    };

    // Field has an explicit rule; check if this role is in the allowed list.
    field_rule.read.iter().any(|allowed_role| allowed_role == role_id)
}

/// Filter a flat map of field name → value, keeping only fields the role may read.
/// Returns a new map with forbidden fields removed.
pub fn filter_fields_for_role(
    field_policies: &FieldPolicies,
    role_id: &str,
    entity_name: &str,
    fields: HashMap<String, serde_json::Value>,
) -> HashMap<String, serde_json::Value> {
    fields
        .into_iter()
        .filter(|(field_name, _value)| {
            role_can_read_field(field_policies, role_id, entity_name, field_name)
        })
        .collect()
}
