use crate::models::{
    CreateEntityFieldRequest, CreateEntityRequest, CreateEntityRowRequest, CreateRelationshipRequest,
    EntityDefinition, EntityFieldDefinition, EntityRowRecord, EntitySummary, RelationshipRecord,
    UpdateEntityRequest, UpdateEntityRowRequest, UpdateRelationshipRequest,
};
use heed::types::{Bytes, Str};
use heed::{Database, Env, EnvOpenOptions, RwTxn};
use serde_json::{Map, Value};
use std::path::Path;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};
use thiserror::Error;

const META_COUNTERS_KEY: &str = "meta/counters";
const ENTITY_NAME_PREFIX: &str = "entity/name/";
const ENTITY_DEF_PREFIX: &str = "entity/def/";
const ENTITY_ROW_COUNTER_PREFIX: &str = "entity/row_counter/";
const ENTITY_ROW_PREFIX: &str = "entity/row/";
const RELATIONSHIP_DEF_PREFIX: &str = "relationship/def/";

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
struct MetaCounters {
    next_entity_id: u64,
    next_relationship_id: u64,
    next_entity_field_id: u64,
}

#[derive(Debug, Error)]
pub enum StoreError {
    #[error("bad request: {0}")]
    BadRequest(String),
    #[error("not found: {0}")]
    NotFound(String),
    #[error("storage error: {0}")]
    Storage(String),
}

#[derive(Clone)]
pub struct DataStore {
    env: Arc<Env>,
    db: Database<Str, Bytes>,
}

impl DataStore {
    // Open (or create) the LMDB environment and primary database.
    pub fn open(database_path: &Path) -> Result<Self, StoreError> {
        std::fs::create_dir_all(database_path)
            .map_err(|error| StoreError::Storage(error.to_string()))?;

        let environment = unsafe {
            EnvOpenOptions::new()
                .map_size(256 * 1024 * 1024)
                .max_dbs(4)
                .open(database_path)
        }
        .map_err(|error| StoreError::Storage(error.to_string()))?;

        let mut write_transaction = environment
            .write_txn()
            .map_err(|error| StoreError::Storage(error.to_string()))?;
        let database = environment
            .create_database(&mut write_transaction, None)
            .map_err(|error| StoreError::Storage(error.to_string()))?;
        write_transaction
            .commit()
            .map_err(|error| StoreError::Storage(error.to_string()))?;

        Ok(Self {
            env: Arc::new(environment),
            db: database,
        })
    }

    // Create a new entity definition with auto-increment id and validated fields.
    pub fn create_entity(&self, request: CreateEntityRequest) -> Result<EntityDefinition, StoreError> {
        let normalized_name = normalize_entity_name(&request.name)?;
        let normalized_fields = normalize_field_requests(&request.fields)?;
        let display_name = normalize_display_name(request.display_name.as_deref(), &normalized_name);

        let mut write_transaction = self.begin_write_transaction()?;
        if self.entity_name_exists(&write_transaction, &normalized_name)? {
            return Err(StoreError::BadRequest(format!(
                "Entity already exists: {normalized_name}"
            )));
        }

        let mut counters = self.read_counters(&write_transaction)?;
        let entity_id = counters.next_entity_id;
        counters.next_entity_id = counters.next_entity_id.saturating_add(1);

        let fields = build_field_definitions(&mut counters, normalized_fields);
        let created_at_ms = current_time_ms()?;
        let entity_definition = EntityDefinition {
            id: entity_id,
            name: normalized_name.clone(),
            display_name,
            fields,
            created_at_ms,
        };

        self.write_entity_definition(&mut write_transaction, &entity_definition)?;
        self.put_entity_name_index(&mut write_transaction, &normalized_name, entity_id)?;
        self.write_row_counter(&mut write_transaction, entity_id, 1)?;
        self.write_counters(&mut write_transaction, &counters)?;
        write_transaction
            .commit()
            .map_err(|error| StoreError::Storage(error.to_string()))?;

        Ok(entity_definition)
    }

    // Update an existing entity definition (name, display name, and/or fields).
    pub fn update_entity(
        &self,
        entity_id: u64,
        request: UpdateEntityRequest,
    ) -> Result<EntityDefinition, StoreError> {
        let mut write_transaction = self.begin_write_transaction()?;
        let mut entity_definition = self
            .read_entity_definition(&write_transaction, entity_id)?
            .ok_or_else(|| StoreError::NotFound(format!("Entity not found: {entity_id}")))?;

        if let Some(next_name_raw) = request.name {
            let next_name = normalize_entity_name(&next_name_raw)?;
            if next_name != entity_definition.name
                && self.entity_name_exists(&write_transaction, &next_name)?
            {
                return Err(StoreError::BadRequest(format!(
                    "Entity already exists: {next_name}"
                )));
            }

            self.delete_entity_name_index(&mut write_transaction, &entity_definition.name)?;
            self.put_entity_name_index(&mut write_transaction, &next_name, entity_id)?;
            entity_definition.name = next_name;
        }

        if let Some(display_name_raw) = request.display_name {
            entity_definition.display_name =
                normalize_display_name(Some(display_name_raw.as_str()), &entity_definition.name);
        }

        if let Some(field_requests) = request.fields {
            let normalized_fields = normalize_field_requests(&field_requests)?;
            let mut counters = self.read_counters(&write_transaction)?;
            entity_definition.fields = build_field_definitions(&mut counters, normalized_fields);
            self.write_counters(&mut write_transaction, &counters)?;
        }

        self.write_entity_definition(&mut write_transaction, &entity_definition)?;
        write_transaction
            .commit()
            .map_err(|error| StoreError::Storage(error.to_string()))?;

        Ok(entity_definition)
    }

    // Return all entities as id + name summaries.
    pub fn list_entities(&self) -> Result<Vec<EntitySummary>, StoreError> {
        let read_transaction = self.begin_read_transaction()?;
        let mut summaries = Vec::new();

        let mut cursor = self
            .db
            .prefix_iter(&read_transaction, ENTITY_DEF_PREFIX)
            .map_err(|error| StoreError::Storage(error.to_string()))?;

        while let Some((_key, value_bytes)) = cursor
            .next()
            .transpose()
            .map_err(|error| StoreError::Storage(error.to_string()))?
        {
            let entity_definition: EntityDefinition = decode_json(value_bytes)?;
            summaries.push(EntitySummary {
                id: entity_definition.id,
                name: entity_definition.name,
            });
        }

        summaries.sort_by(|left, right| left.id.cmp(&right.id));
        Ok(summaries)
    }

    // Return one entity definition by id.
    pub fn get_entity(&self, entity_id: u64) -> Result<EntityDefinition, StoreError> {
        let read_transaction = self.begin_read_transaction()?;
        self.read_entity_definition(&read_transaction, entity_id)?
            .ok_or_else(|| StoreError::NotFound(format!("Entity not found: {entity_id}")))
    }

    // Insert a row for an entity and return the stored record.
    pub fn create_entity_row(
        &self,
        entity_id: u64,
        request: CreateEntityRowRequest,
    ) -> Result<EntityRowRecord, StoreError> {
        let mut write_transaction = self.begin_write_transaction()?;
        let entity_definition = self
            .read_entity_definition(&write_transaction, entity_id)?
            .ok_or_else(|| StoreError::NotFound(format!("Entity not found: {entity_id}")))?;

        let normalized_values =
            normalize_row_values(&entity_definition, request.values, false)?;

        let row_id = self.read_row_counter(&write_transaction, entity_id)?;
        let created_at_ms = current_time_ms()?;
        let row_record = EntityRowRecord {
            id: row_id,
            entity_id,
            values: normalized_values,
            created_at_ms,
        };

        self.write_entity_row(&mut write_transaction, entity_id, &row_record)?;
        self.write_row_counter(
            &mut write_transaction,
            entity_id,
            row_id.saturating_add(1),
        )?;
        write_transaction
            .commit()
            .map_err(|error| StoreError::Storage(error.to_string()))?;

        Ok(row_record)
    }

    // Update an existing entity row.
    pub fn update_entity_row(
        &self,
        entity_id: u64,
        row_id: u64,
        request: UpdateEntityRowRequest,
    ) -> Result<EntityRowRecord, StoreError> {
        let mut write_transaction = self.begin_write_transaction()?;
        let entity_definition = self
            .read_entity_definition(&write_transaction, entity_id)?
            .ok_or_else(|| StoreError::NotFound(format!("Entity not found: {entity_id}")))?;

        let mut row_record = self
            .read_entity_row(&write_transaction, entity_id, row_id)?
            .ok_or_else(|| {
                StoreError::NotFound(format!("Row not found: entity={entity_id} row={row_id}"))
            })?;

        row_record.values = normalize_row_values(&entity_definition, request.values, true)?;
        self.write_entity_row(&mut write_transaction, entity_id, &row_record)?;
        write_transaction
            .commit()
            .map_err(|error| StoreError::Storage(error.to_string()))?;

        Ok(row_record)
    }

    // Return all rows for an entity id.
    pub fn list_entity_rows(&self, entity_id: u64) -> Result<Vec<EntityRowRecord>, StoreError> {
        let read_transaction = self.begin_read_transaction()?;
        if self
            .read_entity_definition(&read_transaction, entity_id)?
            .is_none()
        {
            return Err(StoreError::NotFound(format!("Entity not found: {entity_id}")));
        }

        let row_prefix = format!("{ENTITY_ROW_PREFIX}{entity_id}/");
        let mut rows = Vec::new();
        let mut cursor = self
            .db
            .prefix_iter(&read_transaction, &row_prefix)
            .map_err(|error| StoreError::Storage(error.to_string()))?;

        while let Some((_key, value_bytes)) = cursor
            .next()
            .transpose()
            .map_err(|error| StoreError::Storage(error.to_string()))?
        {
            let row_record: EntityRowRecord = decode_json(value_bytes)?;
            rows.push(row_record);
        }

        rows.sort_by(|left, right| left.id.cmp(&right.id));
        Ok(rows)
    }

    // Create a relationship link between two entity rows.
    pub fn create_relationship(
        &self,
        request: CreateRelationshipRequest,
    ) -> Result<RelationshipRecord, StoreError> {
        let relationship_name = normalize_relationship_name(&request.relationship_name)?;

        let mut write_transaction = self.begin_write_transaction()?;
        self.ensure_entity_exists(&write_transaction, request.subject_entity_id)?;
        self.ensure_entity_exists(&write_transaction, request.object_entity_id)?;
        self.ensure_row_exists(
            &write_transaction,
            request.subject_entity_id,
            request.subject_row_id,
        )?;
        self.ensure_row_exists(
            &write_transaction,
            request.object_entity_id,
            request.object_row_id,
        )?;

        let mut counters = self.read_counters(&write_transaction)?;
        let relationship_id = counters.next_relationship_id;
        counters.next_relationship_id = counters.next_relationship_id.saturating_add(1);

        let relationship_record = RelationshipRecord {
            id: relationship_id,
            relationship_name,
            subject_entity_id: request.subject_entity_id,
            object_entity_id: request.object_entity_id,
            subject_row_id: request.subject_row_id,
            object_row_id: request.object_row_id,
            created_at_ms: current_time_ms()?,
        };

        self.write_relationship(&mut write_transaction, &relationship_record)?;
        self.write_counters(&mut write_transaction, &counters)?;
        write_transaction
            .commit()
            .map_err(|error| StoreError::Storage(error.to_string()))?;

        Ok(relationship_record)
    }

    // Update an existing relationship link.
    pub fn update_relationship(
        &self,
        relationship_id: u64,
        request: UpdateRelationshipRequest,
    ) -> Result<RelationshipRecord, StoreError> {
        let mut write_transaction = self.begin_write_transaction()?;
        let mut relationship_record = self
            .read_relationship(&write_transaction, relationship_id)?
            .ok_or_else(|| {
                StoreError::NotFound(format!("Relationship not found: {relationship_id}"))
            })?;

        if let Some(relationship_name_raw) = request.relationship_name {
            relationship_record.relationship_name =
                normalize_relationship_name(&relationship_name_raw)?;
        }

        let next_subject_entity_id = request
            .subject_entity_id
            .unwrap_or(relationship_record.subject_entity_id);
        let next_object_entity_id = request
            .object_entity_id
            .unwrap_or(relationship_record.object_entity_id);
        let next_subject_row_id = request
            .subject_row_id
            .unwrap_or(relationship_record.subject_row_id);
        let next_object_row_id = request
            .object_row_id
            .unwrap_or(relationship_record.object_row_id);

        self.ensure_entity_exists(&write_transaction, next_subject_entity_id)?;
        self.ensure_entity_exists(&write_transaction, next_object_entity_id)?;
        self.ensure_row_exists(
            &write_transaction,
            next_subject_entity_id,
            next_subject_row_id,
        )?;
        self.ensure_row_exists(
            &write_transaction,
            next_object_entity_id,
            next_object_row_id,
        )?;

        relationship_record.subject_entity_id = next_subject_entity_id;
        relationship_record.object_entity_id = next_object_entity_id;
        relationship_record.subject_row_id = next_subject_row_id;
        relationship_record.object_row_id = next_object_row_id;

        self.write_relationship(&mut write_transaction, &relationship_record)?;
        write_transaction
            .commit()
            .map_err(|error| StoreError::Storage(error.to_string()))?;

        Ok(relationship_record)
    }

    // Return all relationship records.
    pub fn list_relationships(&self) -> Result<Vec<RelationshipRecord>, StoreError> {
        let read_transaction = self.begin_read_transaction()?;
        let mut relationships = Vec::new();

        let mut cursor = self
            .db
            .prefix_iter(&read_transaction, RELATIONSHIP_DEF_PREFIX)
            .map_err(|error| StoreError::Storage(error.to_string()))?;

        while let Some((_key, value_bytes)) = cursor
            .next()
            .transpose()
            .map_err(|error| StoreError::Storage(error.to_string()))?
        {
            let relationship_record: RelationshipRecord = decode_json(value_bytes)?;
            relationships.push(relationship_record);
        }

        relationships.sort_by(|left, right| left.id.cmp(&right.id));
        Ok(relationships)
    }

    fn begin_read_transaction(&self) -> Result<heed::RoTxn, StoreError> {
        self.env
            .read_txn()
            .map_err(|error| StoreError::Storage(error.to_string()))
    }

    fn begin_write_transaction(&self) -> Result<RwTxn, StoreError> {
        self.env
            .write_txn()
            .map_err(|error| StoreError::Storage(error.to_string()))
    }

    fn read_counters(&self, transaction: &RwTxn) -> Result<MetaCounters, StoreError> {
        let maybe_bytes = self
            .db
            .get(transaction, META_COUNTERS_KEY)
            .map_err(|error| StoreError::Storage(error.to_string()))?;

        if let Some(bytes) = maybe_bytes {
            return decode_json(bytes);
        }

        Ok(MetaCounters {
            next_entity_id: 1,
            next_relationship_id: 1,
            next_entity_field_id: 1,
        })
    }

    fn write_counters(&self, transaction: &mut RwTxn, counters: &MetaCounters) -> Result<(), StoreError> {
        let encoded = encode_json(counters)?;
        self.db
            .put(transaction, META_COUNTERS_KEY, &encoded)
            .map_err(|error| StoreError::Storage(error.to_string()))
    }

    fn entity_name_exists(&self, transaction: &RwTxn, entity_name: &str) -> Result<bool, StoreError> {
        let key = format!("{ENTITY_NAME_PREFIX}{entity_name}");
        let exists = self
            .db
            .get(transaction, &key)
            .map_err(|error| StoreError::Storage(error.to_string()))?
            .is_some();
        Ok(exists)
    }

    fn put_entity_name_index(
        &self,
        transaction: &mut RwTxn,
        entity_name: &str,
        entity_id: u64,
    ) -> Result<(), StoreError> {
        let key = format!("{ENTITY_NAME_PREFIX}{entity_name}");
        let value = entity_id.to_string();
        self.db
            .put(transaction, &key, value.as_bytes())
            .map_err(|error| StoreError::Storage(error.to_string()))
    }

    fn delete_entity_name_index(
        &self,
        transaction: &mut RwTxn,
        entity_name: &str,
    ) -> Result<(), StoreError> {
        let key = format!("{ENTITY_NAME_PREFIX}{entity_name}");
        self.db
            .delete(transaction, &key)
            .map_err(|error| StoreError::Storage(error.to_string()))?;
        Ok(())
    }

    fn write_entity_definition(
        &self,
        transaction: &mut RwTxn,
        entity_definition: &EntityDefinition,
    ) -> Result<(), StoreError> {
        let key = format!("{ENTITY_DEF_PREFIX}{}", entity_definition.id);
        let encoded = encode_json(entity_definition)?;
        self.db
            .put(transaction, &key, &encoded)
            .map_err(|error| StoreError::Storage(error.to_string()))
    }

    fn read_entity_definition(
        &self,
        transaction: &heed::RoTxn,
        entity_id: u64,
    ) -> Result<Option<EntityDefinition>, StoreError> {
        let key = format!("{ENTITY_DEF_PREFIX}{entity_id}");
        let maybe_bytes = self
            .db
            .get(transaction, &key)
            .map_err(|error| StoreError::Storage(error.to_string()))?;

        if let Some(bytes) = maybe_bytes {
            return decode_json(bytes);
        }
        Ok(None)
    }

    fn read_row_counter(&self, transaction: &RwTxn, entity_id: u64) -> Result<u64, StoreError> {
        let key = format!("{ENTITY_ROW_COUNTER_PREFIX}{entity_id}");
        let maybe_bytes = self
            .db
            .get(transaction, &key)
            .map_err(|error| StoreError::Storage(error.to_string()))?;

        if let Some(bytes) = maybe_bytes {
            let counter_text = String::from_utf8(bytes.to_owned())
                .map_err(|error| StoreError::Storage(error.to_string()))?;
            let counter_value = counter_text
                .parse::<u64>()
                .map_err(|error| StoreError::Storage(error.to_string()))?;
            return Ok(counter_value);
        }

        Ok(1)
    }

    fn write_row_counter(
        &self,
        transaction: &mut RwTxn,
        entity_id: u64,
        next_row_id: u64,
    ) -> Result<(), StoreError> {
        let key = format!("{ENTITY_ROW_COUNTER_PREFIX}{entity_id}");
        let value = next_row_id.to_string();
        self.db
            .put(transaction, &key, value.as_bytes())
            .map_err(|error| StoreError::Storage(error.to_string()))
    }

    fn write_entity_row(
        &self,
        transaction: &mut RwTxn,
        entity_id: u64,
        row_record: &EntityRowRecord,
    ) -> Result<(), StoreError> {
        let key = format!("{ENTITY_ROW_PREFIX}{entity_id}/{}", row_record.id);
        let encoded = encode_json(row_record)?;
        self.db
            .put(transaction, &key, &encoded)
            .map_err(|error| StoreError::Storage(error.to_string()))
    }

    fn read_entity_row(
        &self,
        transaction: &heed::RoTxn,
        entity_id: u64,
        row_id: u64,
    ) -> Result<Option<EntityRowRecord>, StoreError> {
        let key = format!("{ENTITY_ROW_PREFIX}{entity_id}/{row_id}");
        let maybe_bytes = self
            .db
            .get(transaction, &key)
            .map_err(|error| StoreError::Storage(error.to_string()))?;

        if let Some(bytes) = maybe_bytes {
            return decode_json(bytes);
        }
        Ok(None)
    }

    fn write_relationship(
        &self,
        transaction: &mut RwTxn,
        relationship_record: &RelationshipRecord,
    ) -> Result<(), StoreError> {
        let key = format!("{RELATIONSHIP_DEF_PREFIX}{}", relationship_record.id);
        let encoded = encode_json(relationship_record)?;
        self.db
            .put(transaction, &key, &encoded)
            .map_err(|error| StoreError::Storage(error.to_string()))
    }

    fn read_relationship(
        &self,
        transaction: &heed::RoTxn,
        relationship_id: u64,
    ) -> Result<Option<RelationshipRecord>, StoreError> {
        let key = format!("{RELATIONSHIP_DEF_PREFIX}{relationship_id}");
        let maybe_bytes = self
            .db
            .get(transaction, &key)
            .map_err(|error| StoreError::Storage(error.to_string()))?;

        if let Some(bytes) = maybe_bytes {
            return decode_json(bytes);
        }
        Ok(None)
    }

    fn ensure_entity_exists(&self, transaction: &RwTxn, entity_id: u64) -> Result<(), StoreError> {
        if self.read_entity_definition(transaction, entity_id)?.is_some() {
            return Ok(());
        }
        Err(StoreError::NotFound(format!("Entity not found: {entity_id}")))
    }

    fn ensure_row_exists(
        &self,
        transaction: &RwTxn,
        entity_id: u64,
        row_id: u64,
    ) -> Result<(), StoreError> {
        if self.read_entity_row(transaction, entity_id, row_id)?.is_some() {
            return Ok(());
        }
        Err(StoreError::NotFound(format!(
            "Row not found: entity={entity_id} row={row_id}"
        )))
    }
}

// Build entity field definitions with auto-increment field ids.
fn build_field_definitions(
    counters: &mut MetaCounters,
    normalized_fields: Vec<NormalizedFieldRequest>,
) -> Vec<EntityFieldDefinition> {
    let mut field_definitions = Vec::new();
    for field in normalized_fields {
        let field_id = counters.next_entity_field_id;
        counters.next_entity_field_id = counters.next_entity_field_id.saturating_add(1);
        field_definitions.push(EntityFieldDefinition {
            id: field_id,
            field_name: field.field_name,
            field_type: field.field_type,
            is_required: field.is_required,
            is_active: true,
        });
    }
    field_definitions
}

struct NormalizedFieldRequest {
    field_name: String,
    field_type: String,
    is_required: bool,
}

// Normalize and validate field definitions for entity create/update.
fn normalize_field_requests(
    field_requests: &[CreateEntityFieldRequest],
) -> Result<Vec<NormalizedFieldRequest>, StoreError> {
    if field_requests.is_empty() {
        return Err(StoreError::BadRequest(
            "At least one field is required".to_string(),
        ));
    }

    let mut normalized_fields = Vec::new();
    let mut seen_names = std::collections::HashSet::new();

    for field_request in field_requests {
        let field_name = normalize_field_name(&field_request.field_name)?;
        if !seen_names.insert(field_name.clone()) {
            return Err(StoreError::BadRequest(format!(
                "Field names must be unique: {field_name}"
            )));
        }

        normalized_fields.push(NormalizedFieldRequest {
            field_name,
            field_type: normalize_field_type(&field_request.field_type)?,
            is_required: field_request.is_required.unwrap_or(false),
        });
    }

    Ok(normalized_fields)
}

// Normalize row values against active entity fields.
fn normalize_row_values(
    entity_definition: &EntityDefinition,
    values: Value,
    is_update: bool,
) -> Result<Value, StoreError> {
    let input_map = match values {
        Value::Object(map) => map,
        _ => {
            return Err(StoreError::BadRequest(
                "values must be a JSON object".to_string(),
            ))
        }
    };

    let active_fields: Vec<&EntityFieldDefinition> = entity_definition
        .fields
        .iter()
        .filter(|field| field.is_active)
        .collect();

    let mut output_map = Map::new();

    for field in active_fields {
        let field_present = input_map.contains_key(&field.field_name);
        if !field_present {
            if field.is_required && !is_update {
                return Err(StoreError::BadRequest(format!(
                    "Missing required field: {}",
                    field.field_name
                )));
            }
            continue;
        }

        let raw_value = input_map
            .get(&field.field_name)
            .cloned()
            .unwrap_or(Value::Null);

        if raw_value.is_null() {
            if field.is_required {
                return Err(StoreError::BadRequest(format!(
                    "Field cannot be null: {}",
                    field.field_name
                )));
            }
            output_map.insert(field.field_name.clone(), Value::Null);
            continue;
        }

        let coerced_value = coerce_field_value(&field.field_type, &raw_value)?;
        output_map.insert(field.field_name.clone(), coerced_value);
    }

    Ok(Value::Object(output_map))
}

// Coerce JSON values to the declared field type.
fn coerce_field_value(field_type: &str, raw_value: &Value) -> Result<Value, StoreError> {
    match field_type {
        "INTEGER" => {
            if let Some(number) = raw_value.as_i64() {
                return Ok(Value::Number(number.into()));
            }
            if let Some(number_text) = raw_value.as_str() {
                let parsed = number_text
                    .parse::<i64>()
                    .map_err(|_| StoreError::BadRequest("Invalid INTEGER value".to_string()))?;
                return Ok(Value::Number(parsed.into()));
            }
            Err(StoreError::BadRequest("Invalid INTEGER value".to_string()))
        }
        "REAL" => {
            if let Some(number) = raw_value.as_f64() {
                return Ok(serde_json::json!(number));
            }
            if let Some(number_text) = raw_value.as_str() {
                let parsed = number_text
                    .parse::<f64>()
                    .map_err(|_| StoreError::BadRequest("Invalid REAL value".to_string()))?;
                return Ok(serde_json::json!(parsed));
            }
            Err(StoreError::BadRequest("Invalid REAL value".to_string()))
        }
        _ => {
            if raw_value.is_string() {
                return Ok(raw_value.clone());
            }
            Ok(Value::String(raw_value.to_string()))
        }
    }
}

// Normalize entity names to lowercase snake_case identifiers.
fn normalize_entity_name(raw_name: &str) -> Result<String, StoreError> {
    let normalized_name = raw_name.trim().to_lowercase();
    if !is_valid_identifier(&normalized_name) {
        return Err(StoreError::BadRequest(
            "Entity name must match /^[a-z][a-z0-9_]*$/".to_string(),
        ));
    }
    Ok(normalized_name)
}

// Normalize field names to lowercase snake_case identifiers.
fn normalize_field_name(raw_name: &str) -> Result<String, StoreError> {
    let normalized_name = raw_name.trim().to_lowercase();
    if !is_valid_identifier(&normalized_name) {
        return Err(StoreError::BadRequest(
            "Field name must match /^[a-z][a-z0-9_]*$/".to_string(),
        ));
    }

    if normalized_name == "id" || normalized_name == "created_at" {
        return Err(StoreError::BadRequest(format!(
            "Field name is reserved: {normalized_name}"
        )));
    }

    Ok(normalized_name)
}

// Normalize relationship names (non-empty trimmed text).
fn normalize_relationship_name(raw_name: &str) -> Result<String, StoreError> {
    let normalized_name = raw_name.trim().to_string();
    if normalized_name.is_empty() {
        return Err(StoreError::BadRequest(
            "relationship_name is required".to_string(),
        ));
    }
    Ok(normalized_name)
}

// Normalize display names with fallback to entity name.
fn normalize_display_name(display_name: Option<&str>, entity_name: &str) -> String {
    let trimmed = display_name.unwrap_or(entity_name).trim();
    if trimmed.is_empty() {
        entity_name.to_string()
    } else {
        trimmed.to_string()
    }
}

// Restrict field types to the same allowlist used by the JS backend.
fn normalize_field_type(raw_type: &str) -> Result<String, StoreError> {
    let normalized_type = raw_type.trim().to_uppercase();
    if normalized_type != "TEXT" && normalized_type != "INTEGER" && normalized_type != "REAL" {
        return Err(StoreError::BadRequest(
            "field_type must be one of: TEXT, INTEGER, REAL".to_string(),
        ));
    }
    Ok(normalized_type)
}

// Validate identifier pattern shared with the JS backend.
fn is_valid_identifier(value: &str) -> bool {
    if value.is_empty() {
        return false;
    }
    let mut characters = value.chars();
    let Some(first_character) = characters.next() else {
        return false;
    };
    if !first_character.is_ascii_lowercase() {
        return false;
    }
    characters.all(|character| character.is_ascii_lowercase() || character.is_ascii_digit() || character == '_')
}

// Return current UTC milliseconds since UNIX epoch.
fn current_time_ms() -> Result<u128, StoreError> {
    let now = SystemTime::now();
    let duration = now
        .duration_since(UNIX_EPOCH)
        .map_err(|error| StoreError::Storage(error.to_string()))?;
    Ok(duration.as_millis())
}

fn encode_json<T: serde::Serialize>(value: &T) -> Result<Vec<u8>, StoreError> {
    serde_json::to_vec(value).map_err(|error| StoreError::Storage(error.to_string()))
}

fn decode_json<T: serde::de::DeserializeOwned>(bytes: &[u8]) -> Result<T, StoreError> {
    serde_json::from_slice(bytes).map_err(|error| StoreError::Storage(error.to_string()))
}
