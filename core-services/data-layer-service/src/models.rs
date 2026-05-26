use serde::{Deserialize, Serialize};
use serde_json::Value;

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
}
