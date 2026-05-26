use serde::{Deserialize, Deserializer, Serialize};
use serde_json::Value;
use std::fmt;

/// Deserialize a field read role from a string, legacy string array, or empty value.
fn deserialize_read_role_field<'de, DeserializerImpl>(
    deserializer: DeserializerImpl,
) -> Result<String, DeserializerImpl::Error>
where
    DeserializerImpl: Deserializer<'de>,
{
    struct ReadRoleFieldVisitor;

    impl<'de> serde::de::Visitor<'de> for ReadRoleFieldVisitor {
        type Value = String;

        fn expecting(&self, formatter: &mut fmt::Formatter) -> fmt::Result {
            formatter.write_str("a role id string, array of role ids, or empty value")
        }

        fn visit_str<E>(self, value: &str) -> Result<String, E>
        where
            E: serde::de::Error,
        {
            Ok(value.trim().to_string())
        }

        fn visit_string<E>(self, value: String) -> Result<String, E>
        where
            E: serde::de::Error,
        {
            Ok(value.trim().to_string())
        }

        fn visit_seq<A>(self, mut sequence: A) -> Result<String, A::Error>
        where
            A: serde::de::SeqAccess<'de>,
        {
            let first_role = sequence
                .next_element::<String>()?
                .unwrap_or_default()
                .trim()
                .to_string();
            while sequence.next_element::<serde::de::IgnoredAny>()?.is_some() {}
            Ok(first_role)
        }

        fn visit_none<E>(self) -> Result<String, E>
        where
            E: serde::de::Error,
        {
            Ok(String::new())
        }

        fn visit_unit<E>(self) -> Result<String, E>
        where
            E: serde::de::Error,
        {
            Ok(String::new())
        }
    }

    deserializer.deserialize_any(ReadRoleFieldVisitor)
}

/// Deserialize optional read_role from request JSON (string, array, or omitted).
fn deserialize_optional_read_role<'de, DeserializerImpl>(
    deserializer: DeserializerImpl,
) -> Result<Option<String>, DeserializerImpl::Error>
where
    DeserializerImpl: Deserializer<'de>,
{
    let parsed = Option::<serde_json::Value>::deserialize(deserializer)?;
    match parsed {
        None => Ok(None),
        Some(Value::String(role_id)) => {
            let trimmed = role_id.trim().to_string();
            if trimmed.is_empty() {
                Ok(Some(String::new()))
            } else {
                Ok(Some(trimmed))
            }
        }
        Some(Value::Array(role_ids)) => {
            let first_role = role_ids
                .first()
                .and_then(|value| value.as_str())
                .unwrap_or("")
                .trim()
                .to_string();
            Ok(Some(first_role))
        }
        Some(Value::Null) => Ok(Some(String::new())),
        Some(_) => Err(serde::de::Error::custom(
            "read_role must be a string, array of role ids, or null",
        )),
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EntityFieldDefinition {
    pub id: u64,
    pub field_name: String,
    pub field_type: String,
    pub is_required: bool,
    pub is_active: bool,
    /// Human-readable description for AI extraction and documentation.
    #[serde(default)]
    pub description: String,
    /// Example value shown to agents when mapping incoming data.
    #[serde(default)]
    pub example: String,
    /// Hint for how to locate or format this field in source documents.
    #[serde(default)]
    pub extraction_hint: String,
    /// When true, this field is the primary business identifier for rows.
    #[serde(default)]
    pub is_identifier: bool,
    /// Role id allowed to read this field. Empty means all OSS roles may read it.
    #[serde(default, deserialize_with = "deserialize_read_role_field")]
    pub read_role: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EntityDefinition {
    pub id: u64,
    pub name: String,
    pub display_name: String,
    pub fields: Vec<EntityFieldDefinition>,
    pub created_at_ms: u128,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EntitySummary {
    pub id: u64,
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EntityRowRecord {
    pub id: u64,
    pub entity_id: u64,
    pub values: Value,
    pub created_at_ms: u128,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RelationshipRecord {
    pub id: u64,
    pub relationship_name: String,
    pub subject_entity_id: u64,
    pub object_entity_id: u64,
    pub subject_row_id: u64,
    pub object_row_id: u64,
    pub created_at_ms: u128,
}

/// Schema-level relationship between two entity types (no row ids).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EntityRelationshipDefinition {
    pub id: u64,
    pub relationship_name: String,
    pub subject_entity_id: u64,
    pub object_entity_id: u64,
    pub created_at_ms: u128,
}

#[derive(Debug, Deserialize)]
pub struct CreateEntityRequest {
    pub name: String,
    pub display_name: Option<String>,
    pub fields: Vec<CreateEntityFieldRequest>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateEntityRequest {
    pub name: Option<String>,
    pub display_name: Option<String>,
    pub fields: Option<Vec<CreateEntityFieldRequest>>,
}

#[derive(Debug, Deserialize)]
pub struct CreateEntityFieldRequest {
    pub field_name: String,
    pub field_type: String,
    pub is_required: Option<bool>,
    pub description: Option<String>,
    pub example: Option<String>,
    pub extraction_hint: Option<String>,
    pub is_identifier: Option<bool>,
    /// Role id allowed to read this field. Empty or omitted means all OSS roles.
    #[serde(default, deserialize_with = "deserialize_optional_read_role")]
    pub read_role: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateEntityRowRequest {
    pub values: Value,
}

#[derive(Debug, Deserialize)]
pub struct UpdateEntityRowRequest {
    pub values: Value,
}

#[derive(Debug, Deserialize)]
pub struct CreateEntityRelationshipRequest {
    pub relationship_name: String,
    pub subject_entity_id: u64,
    pub object_entity_id: u64,
}

#[derive(Debug, Deserialize)]
pub struct UpdateEntityRelationshipRequest {
    pub relationship_name: Option<String>,
    pub subject_entity_id: Option<u64>,
    pub object_entity_id: Option<u64>,
}

#[derive(Debug, Deserialize)]
pub struct CreateRelationshipRequest {
    pub relationship_name: String,
    pub subject_entity_id: u64,
    pub object_entity_id: u64,
    pub subject_row_id: u64,
    pub object_row_id: u64,
}

#[derive(Debug, Deserialize)]
pub struct UpdateRelationshipRequest {
    pub relationship_name: Option<String>,
    pub subject_entity_id: Option<u64>,
    pub object_entity_id: Option<u64>,
    pub subject_row_id: Option<u64>,
    pub object_row_id: Option<u64>,
}

#[derive(Debug, Deserialize)]
#[serde(untagged)]
pub enum TurtleEntityIdsPayload {
    /// JSON string `"*"`: export all entities and relationships from LMDB.
    Wildcard(String),
    /// Entity ids to export; scope expands to related entities via stored relationships.
    Ids(Vec<u64>),
}

#[derive(Debug, Deserialize)]
pub struct TurtleExportRequest {
    /// Numeric ids, or the string `"*"` for the full graph.
    #[serde(default)]
    pub entity_ids: Option<TurtleEntityIdsPayload>,
    /// Entity names (e.g. `"corporation"`, `"employee"`) — resolved to ids before relationship expansion.
    #[serde(default)]
    pub entity_names: Option<Vec<String>>,
    /// OSS role id used to filter exported field values. Defaults to `viewer` when omitted.
    #[serde(default)]
    pub role_id: Option<String>,
}
