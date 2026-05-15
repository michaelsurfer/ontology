use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EntityFieldDefinition {
    pub id: u64,
    pub field_name: String,
    pub field_type: String,
    pub is_required: bool,
    pub is_active: bool,
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
