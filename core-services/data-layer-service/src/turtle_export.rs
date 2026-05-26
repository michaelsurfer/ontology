use crate::models::{
    EntityDefinition, EntityRelationshipDefinition, TurtleEntityIdsPayload, TurtleExportRequest,
};
use crate::store::{DataStore, StoreError};
use serde_json::Value;
use std::collections::{HashMap, HashSet};
use std::env;

const DEFAULT_BASE_IRI: &str = "http://example.com/context#";
const DEFAULT_RESOURCE_IRI_PREFIX: &str = "http://example.com/resource/";

// Build Turtle describing scoped entities (schema), instance rows, and relationship links.
pub fn turtle_from_lmdb(store: &DataStore, export_request: &TurtleExportRequest) -> Result<String, StoreError> {
    let base_iri = read_base_iri();
    let resource_prefix = read_resource_prefix();

    let all_entity_definitions = store.list_entity_definitions()?;
    let entity_by_id: HashMap<u64, EntityDefinition> = all_entity_definitions
        .into_iter()
        .map(|entity_definition| (entity_definition.id, entity_definition))
        .collect();

    if export_request.entity_ids.is_none()
        && export_request
            .entity_names
            .as_ref()
            .map(|names| names.is_empty())
            .unwrap_or(true)
    {
        return Err(StoreError::BadRequest(
            "Provide entity_ids (or \"*\") and/or entity_names".to_string(),
        ));
    }

    let (scoped_entity_ids, scoped_relationship_links, scoped_entity_relationships, seed_entity_ids_for_summary) =
        resolve_export_scope(store, export_request, &entity_by_id)?;

    let mut lines: Vec<String> = Vec::new();
    append_export_summary_comment(
        &mut lines,
        &entity_by_id,
        &seed_entity_ids_for_summary,
        &scoped_entity_ids,
        &scoped_entity_relationships,
        &scoped_relationship_links,
    );
    lines.push("@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .".to_string());
    lines.push("@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .".to_string());
    lines.push("@prefix owl: <http://www.w3.org/2002/07/owl#> .".to_string());
    lines.push("@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .".to_string());
    lines.push(format!("@prefix ex: <{base_iri}> ."));
    lines.push(format!("@prefix res: <{resource_prefix}> ."));
    lines.push(String::new());

    let ontology_subject = turtle_node_for_full_iri(&base_iri);
    lines.push(format!("{ontology_subject} rdf:type owl:Ontology ."));

    let mut scoped_entity_map: Vec<(u64, EntityDefinition)> = Vec::new();
    for scoped_id in &scoped_entity_ids {
        if let Some(entity_definition) = entity_by_id.get(scoped_id) {
            scoped_entity_map.push((*scoped_id, entity_definition.clone()));
        }
    }
    scoped_entity_map.sort_by(|left, right| left.0.cmp(&right.0));

    append_ontology_for_entities(&mut lines, &scoped_entity_map, &base_iri);
    append_ontology_for_entity_relationships(
        &mut lines,
        &scoped_entity_relationships,
        &entity_by_id,
        &base_iri,
    );
    lines.push(String::new());

    append_instance_data_for_entities(
        store,
        &mut lines,
        &scoped_entity_map,
        &base_iri,
        &resource_prefix,
    );
    lines.push(String::new());

    append_relationship_triples(
        &mut lines,
        &scoped_entity_ids,
        &entity_by_id,
        &scoped_relationship_links,
        &base_iri,
        &resource_prefix,
    );

    Ok(lines.join("\n"))
}

// Resolve wildcard, numeric ids, and/or entity names into expanded scope + relationships.
fn resolve_export_scope(
    store: &DataStore,
    export_request: &TurtleExportRequest,
    entity_by_id: &HashMap<u64, EntityDefinition>,
) -> Result<
    (
        HashSet<u64>,
        Vec<crate::models::RelationshipRecord>,
        Vec<EntityRelationshipDefinition>,
        Vec<u64>,
    ),
    StoreError,
> {
    if let Some(TurtleEntityIdsPayload::Wildcard(wildcard_marker)) = &export_request.entity_ids {
        if wildcard_marker.trim() != "*" {
            return Err(StoreError::BadRequest(
                r#"Wildcard entity_ids must be the string "*""#.to_string(),
            ));
        }
        return Ok((
            entity_by_id.keys().copied().collect(),
            store.list_relationships()?,
            store.list_entity_relationships()?,
            Vec::new(),
        ));
    }

    let mut seed_entity_ids: Vec<u64> = Vec::new();

    if let Some(TurtleEntityIdsPayload::Ids(id_list)) = &export_request.entity_ids {
        for seed_id in id_list {
            if !entity_by_id.contains_key(seed_id) {
                return Err(StoreError::BadRequest(format!(
                    "Unknown entity id: {seed_id}"
                )));
            }
            seed_entity_ids.push(*seed_id);
        }
    }

    if let Some(name_list) = &export_request.entity_names {
        for raw_name in name_list {
            let normalized_name = raw_name.trim().to_lowercase();
            if normalized_name.is_empty() {
                continue;
            }
            let matching_id = entity_by_id
                .values()
                .find(|entity| entity.name == normalized_name)
                .map(|entity| entity.id);
            let Some(entity_id) = matching_id else {
                return Err(StoreError::BadRequest(format!(
                    "Unknown entity name: {normalized_name}"
                )));
            };
            seed_entity_ids.push(entity_id);
        }
    }

    seed_entity_ids.sort_unstable();
    seed_entity_ids.dedup();

    if seed_entity_ids.is_empty() {
        return Err(StoreError::BadRequest(
            "No entity ids or names to export".to_string(),
        ));
    }

    let (entity_scope, relationship_links, entity_relationships) =
        store.expand_entity_scope_full(&seed_entity_ids)?;
    Ok((
        entity_scope,
        relationship_links,
        entity_relationships,
        seed_entity_ids,
    ))
}

// Emit owl:ObjectProperty declarations for entity-level relationship definitions.
fn append_ontology_for_entity_relationships(
    lines: &mut Vec<String>,
    entity_relationships: &[EntityRelationshipDefinition],
    entity_by_id: &HashMap<u64, EntityDefinition>,
    base_iri: &str,
) {
    let owl_object_property = "<http://www.w3.org/2002/07/owl#ObjectProperty>";
    let rdf_type = "<http://www.w3.org/1999/02/22-rdf-syntax-ns#type>";
    let rdfs_domain = "<http://www.w3.org/2000/01/rdf-schema#domain>";
    let rdfs_range = "<http://www.w3.org/2000/01/rdf-schema#range>";

    let mut emitted_predicates = HashSet::new();

    for entity_relationship in entity_relationships {
        let Some(subject_entity) = entity_by_id.get(&entity_relationship.subject_entity_id) else {
            continue;
        };
        let Some(object_entity) = entity_by_id.get(&entity_relationship.object_entity_id) else {
            continue;
        };

        let predicate_iri = format!(
            "{}{}",
            base_iri,
            to_camel_case(&entity_relationship.relationship_name)
        );
        if !emitted_predicates.insert(predicate_iri.clone()) {
            continue;
        }

        let predicate_node = turtle_node_for_full_iri(&predicate_iri);
        lines.push(format!(
            "# Entity relationship: {} ({} -> {})",
            entity_relationship.relationship_name, subject_entity.name, object_entity.name
        ));
        lines.push(format!("{predicate_node} {rdf_type} {owl_object_property} ."));

        let subject_domain_iri = format!("{}{}", base_iri, to_pascal_case(&subject_entity.name));
        let object_range_iri = format!("{}{}", base_iri, to_pascal_case(&object_entity.name));
        lines.push(format!(
            "{predicate_node} {rdfs_domain} {} .",
            turtle_node_for_full_iri(&subject_domain_iri),
        ));
        lines.push(format!(
            "{predicate_node} {rdfs_range} {} .",
            turtle_node_for_full_iri(&object_range_iri),
        ));
        lines.push(format!(
            "{predicate_node} rdfs:label {} .",
            turtle_string_literal(&entity_relationship.relationship_name)
        ));
    }
}

// Document which seeds were requested and what was included after relationship expansion.
fn append_export_summary_comment(
    lines: &mut Vec<String>,
    entity_by_id: &HashMap<u64, EntityDefinition>,
    seed_entity_ids: &[u64],
    scoped_entity_ids: &HashSet<u64>,
    scoped_entity_relationships: &[EntityRelationshipDefinition],
    scoped_relationship_links: &[crate::models::RelationshipRecord],
) {
    let seed_labels: Vec<String> = seed_entity_ids
        .iter()
        .filter_map(|id| {
            entity_by_id
                .get(id)
                .map(|entity| format!("{} (id {})", entity.name, entity.id))
        })
        .collect();

    let mut scoped_labels: Vec<String> = scoped_entity_ids
        .iter()
        .filter_map(|id| entity_by_id.get(id).map(|entity| entity.name.clone()))
        .collect();
    scoped_labels.sort();

    lines.push(format!(
        "# RDF export — seeds: [{}]; expanded entities: [{}]; entity_relationships: {}; row_links: {}",
        seed_labels.join(", "),
        scoped_labels.join(", "),
        scoped_entity_relationships.len(),
        scoped_relationship_links.len()
    ));
    if scoped_entity_relationships.is_empty() && scoped_relationship_links.is_empty() {
        lines.push(
            "# No entity relationships or row links in LMDB for this scope. Define schema with POST /entity-relationships, link data with POST /relationships.".to_string(),
        );
    }
    lines.push(String::new());
}

// Resolve DATA_LAYER_BASE_IRI or use default ontology base URI.
fn read_base_iri() -> String {
    let trimmed = env::var("DATA_LAYER_BASE_IRI")
        .unwrap_or_else(|_| DEFAULT_BASE_IRI.to_string())
        .trim()
        .to_string();
    if trimmed.ends_with('#') {
        trimmed
    } else {
        format!("{trimmed}#")
    }
}

// Resolve DATA_LAYER_RESOURCE_IRI_PREFIX or default resource namespace.
fn read_resource_prefix() -> String {
    let trimmed = env::var("DATA_LAYER_RESOURCE_IRI_PREFIX")
        .unwrap_or_else(|_| DEFAULT_RESOURCE_IRI_PREFIX.to_string())
        .trim()
        .to_string();
    if trimmed.ends_with('/') {
        trimmed
    } else {
        format!("{trimmed}/")
    }
}

// Append OWL Class and DatatypeProperty declarations for each entity in scope.
fn append_ontology_for_entities(
    lines: &mut Vec<String>,
    scoped_entities: &[(u64, EntityDefinition)],
    base_iri: &str,
) {
    for (_entity_id, entity_definition) in scoped_entities {
        let class_iri = format!("{}{}", base_iri, to_pascal_case(&entity_definition.name));
        let class_node = turtle_node_for_full_iri(&class_iri);
        lines.push(format!("{class_node} rdf:type owl:Class ."));
        lines.push(format!(
            "{} rdfs:label {} .",
            class_node,
            turtle_string_literal(&entity_definition.display_name)
        ));

        for field in &entity_definition.fields {
            if !field.is_active {
                continue;
            }
            let property_iri = format!("{}{}", base_iri, to_camel_case(&field.field_name));
            let property_node = turtle_node_for_full_iri(&property_iri);
            let range_iri = xsd_range_for_field_type(&field.field_type);
            lines.push(format!("{property_node} rdf:type owl:DatatypeProperty ."));
            lines.push(format!("{property_node} rdfs:domain {class_node} ."));
            lines.push(format!("{property_node} rdfs:range <{range_iri}> ."));
        }
    }
}

// Append rdf:type and datatype property triples per row.
fn append_instance_data_for_entities(
    store: &DataStore,
    lines: &mut Vec<String>,
    scoped_entities: &[(u64, EntityDefinition)],
    base_iri: &str,
    resource_prefix: &str,
) {
    let rdf_type = "<http://www.w3.org/1999/02/22-rdf-syntax-ns#type>";

    for (entity_numeric_id, entity_definition) in scoped_entities {
        let class_iri = format!("{}{}", base_iri, to_pascal_case(&entity_definition.name));
        let class_node = turtle_node_for_full_iri(&class_iri);

        let row_records = match store.list_entity_rows(*entity_numeric_id) {
            Ok(rows) => rows,
            Err(_error) => continue,
        };
        for row_record in row_records {
            let row_node =
                turtle_row_resource(resource_prefix, &entity_definition.name, row_record.id);
            lines.push(format!("{row_node} {rdf_type} {class_node} ."));

            let Value::Object(value_map) = &row_record.values else {
                continue;
            };
            for field in &entity_definition.fields {
                if !field.is_active {
                    continue;
                }

                let property_iri = format!("{}{}", base_iri, to_camel_case(&field.field_name));
                let property_node = turtle_node_for_full_iri(&property_iri);

                let Some(cell_value) = value_map.get(&field.field_name) else {
                    continue;
                };

                if let Some(triple_object) = datatype_object_turtle_literal(cell_value, &field.field_type)
                {
                    lines.push(format!("{row_node} {property_node} {triple_object} ."));
                }
            }
        }
    }
}

// Append owl:ObjectProperty defs and row-to-row links for every relationship in scope.
fn append_relationship_triples(
    lines: &mut Vec<String>,
    scoped_entity_ids: &HashSet<u64>,
    entity_definitions_by_id: &HashMap<u64, EntityDefinition>,
    relationship_records: &[crate::models::RelationshipRecord],
    base_iri: &str,
    resource_prefix: &str,
) {
    let owl_object_property = "<http://www.w3.org/2002/07/owl#ObjectProperty>";
    let rdf_type = "<http://www.w3.org/1999/02/22-rdf-syntax-ns#type>";
    let rdfs_domain = "<http://www.w3.org/2000/01/rdf-schema#domain>";
    let rdfs_range = "<http://www.w3.org/2000/01/rdf-schema#range>";

    let mut emitted_predicates = HashSet::new();

    for relationship in relationship_records {
        if relationship.relationship_name.trim().is_empty() {
            continue;
        }

        let subject_entity_id = relationship.subject_entity_id;
        let object_entity_id = relationship.object_entity_id;

        let touches_export_scope = scoped_entity_ids.contains(&subject_entity_id)
            || scoped_entity_ids.contains(&object_entity_id);
        if !touches_export_scope {
            continue;
        }

        let Some(subject_entity) = entity_definitions_by_id.get(&subject_entity_id) else {
            continue;
        };
        let Some(object_entity) = entity_definitions_by_id.get(&object_entity_id) else {
            continue;
        };

        let predicate_iri = format!(
            "{}{}",
            base_iri,
            to_camel_case(&relationship.relationship_name)
        );

        if emitted_predicates.insert(predicate_iri.clone()) {
            let predicate_node = turtle_node_for_full_iri(&predicate_iri);
            lines.push(format!(
                "# Relationship type: {} ({} -> {})",
                relationship.relationship_name,
                subject_entity.name,
                object_entity.name
            ));
            lines.push(format!("{predicate_node} {rdf_type} {owl_object_property} ."));

            let subject_domain_iri = format!("{}{}", base_iri, to_pascal_case(&subject_entity.name));
            let object_range_iri = format!("{}{}", base_iri, to_pascal_case(&object_entity.name));
            lines.push(format!(
                "{predicate_node} {rdfs_domain} {} .",
                turtle_node_for_full_iri(&subject_domain_iri),
            ));
            lines.push(format!(
                "{predicate_node} {rdfs_range} {} .",
                turtle_node_for_full_iri(&object_range_iri),
            ));

            lines.push(format!(
                "{predicate_node} rdfs:label {} .",
                turtle_string_literal(&relationship.relationship_name)
            ));
        }

        let subject_resource = turtle_row_resource(
            resource_prefix,
            &subject_entity.name,
            relationship.subject_row_id,
        );
        let object_resource = turtle_row_resource(
            resource_prefix,
            &object_entity.name,
            relationship.object_row_id,
        );

        lines.push(format!(
            "# Link: {} row {} --[{}]--> {} row {}",
            subject_entity.name,
            relationship.subject_row_id,
            relationship.relationship_name,
            object_entity.name,
            relationship.object_row_id
        ));
        lines.push(format!(
            "{subject_resource} {} {object_resource} .",
            turtle_node_for_full_iri(&predicate_iri)
        ));
    }
}

fn turtle_row_resource(resource_prefix: &str, entity_name: &str, row_id: u64) -> String {
    turtle_node_for_full_iri(&format!("{resource_prefix}{entity_name}/{row_id}"))
}

fn turtle_node_for_full_iri(full_iri: &str) -> String {
    format!("<{full_iri}>")
}

fn turtle_string_literal(raw_text: &str) -> String {
    escape_lexical(raw_text)
}

fn escape_lexical(raw_text: &str) -> String {
    let mut escaped = String::with_capacity(raw_text.len() + 2);
    escaped.push('"');
    for character in raw_text.chars() {
        match character {
            '\\' => escaped.push_str("\\\\"),
            '"' => escaped.push_str("\\\""),
            '\n' => escaped.push_str("\\n"),
            '\r' => escaped.push_str("\\r"),
            '\t' => escaped.push_str("\\t"),
            _ if character <= '\u{1F}' => {
                escaped.push_str(&format!("\\u{:04X}", character as u32));
            }
            _ => escaped.push(character),
        }
    }
    escaped.push('"');
    escaped
}

fn datatype_object_turtle_literal(value: &Value, field_type: &str) -> Option<String> {
    if value.is_null() {
        return None;
    }

    Some(match field_type {
        "INTEGER" => {
            let lexical = if let Some(number) = value.as_i64() {
                number.to_string()
            } else if let Some(text) = value.as_str() {
                text.trim().to_string()
            } else {
                value.to_string()
            };
            format!(
                "\"{}\"^^xsd:integer",
                escape_inner_for_double_quoted(&lexical)
            )
        }
        "REAL" => {
            let lexical = if let Some(number) = value.as_f64() {
                format!("{number}")
            } else if let Some(text) = value.as_str() {
                text.trim().to_string()
            } else {
                value.to_string()
            };
            format!(
                "\"{}\"^^xsd:decimal",
                escape_inner_for_double_quoted(&lexical)
            )
        }
        _ => {
            let lexical = if let Some(text) = value.as_str() {
                text.to_string()
            } else {
                value.to_string()
            };
            format!("{}^^xsd:string", turtle_string_literal(&lexical))
        }
    })
}

fn escape_inner_for_double_quoted(raw_fragment: &str) -> String {
    let mut result = String::with_capacity(raw_fragment.len());
    for character in raw_fragment.chars() {
        match character {
            '\\' => result.push_str("\\\\"),
            '"' => result.push_str("\\\""),
            '\n' => result.push_str("\\n"),
            '\r' => result.push_str("\\r"),
            '\t' => result.push_str("\\t"),
            _ => result.push(character),
        }
    }
    result
}

fn xsd_range_for_field_type(field_type: &str) -> &'static str {
    match field_type {
        "INTEGER" => "http://www.w3.org/2001/XMLSchema#integer",
        "REAL" => "http://www.w3.org/2001/XMLSchema#decimal",
        _ => "http://www.w3.org/2001/XMLSchema#string",
    }
}

fn to_camel_case(snake_case_input: &str) -> String {
    let parts: Vec<&str> = snake_case_input
        .split('_')
        .filter(|segment| !segment.is_empty())
        .collect();

    if parts.is_empty() {
        return "property".to_string();
    }

    let mut result = parts[0].to_ascii_lowercase();
    for part in parts.iter().skip(1) {
        let mut chars = part.chars();
        if let Some(first) = chars.next() {
            result.push(first.to_ascii_uppercase());
            result.extend(chars.flat_map(|c| c.to_lowercase()));
        }
    }
    result
}

fn to_pascal_case(snake_case_input: &str) -> String {
    let parts: Vec<&str> = snake_case_input
        .split('_')
        .filter(|segment| !segment.is_empty())
        .collect();

    if parts.is_empty() {
        return "Entity".to_string();
    }

    let mut result = String::new();
    for part in parts {
        let mut chars = part.chars();
        if let Some(first) = chars.next() {
            result.push(first.to_ascii_uppercase());
            result.extend(chars.flat_map(|c| c.to_lowercase()));
        }
    }
    result
}
