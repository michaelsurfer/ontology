mod models;
mod store;
mod turtle_export;

use axum::{
    body::Body,
    extract::{Path, State},
    http::{header, StatusCode},
    response::Response,
    routing::{get, post, put},
    Json, Router,
};
use models::{
    CreateEntityRelationshipRequest, CreateEntityRequest, CreateEntityRowRequest,
    CreateRelationshipRequest, TurtleExportRequest, UpdateEntityRelationshipRequest,
    UpdateEntityRequest, UpdateEntityRowRequest, UpdateRelationshipRequest,
};
use serde::Serialize;
use std::env;
use std::path::PathBuf;
use std::sync::Arc;
use store::{DataStore, StoreError};
use tracing_subscriber::EnvFilter;

#[derive(Clone)]
struct AppState {
    store: Arc<DataStore>,
}

#[derive(Debug, Serialize)]
struct ErrorBody {
    error: String,
}

// Map store errors to HTTP responses.
fn map_store_error(error: StoreError) -> (StatusCode, Json<ErrorBody>) {
    let (status, message) = match error {
        StoreError::BadRequest(message) => (StatusCode::BAD_REQUEST, message),
        StoreError::NotFound(message) => (StatusCode::NOT_FOUND, message),
        StoreError::Storage(message) => (StatusCode::INTERNAL_SERVER_ERROR, message),
    };
    (
        status,
        Json(ErrorBody {
            error: message,
        }),
    )
}

// Parse a path segment as u64.
fn parse_id_param(raw_id: &str, label: &str) -> Result<u64, (StatusCode, Json<ErrorBody>)> {
    raw_id.parse::<u64>().map_err(|_| {
        (
            StatusCode::BAD_REQUEST,
            Json(ErrorBody {
                error: format!("Invalid {label}: {raw_id}"),
            }),
        )
    })
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenvy::dotenv().ok();
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::from_default_env())
        .init();

    let database_path = read_database_path();
    let data_store = DataStore::open(&database_path)?;
    let shared_state = AppState {
        store: Arc::new(data_store),
    };

    let address = read_server_address();
    let application = build_router(shared_state);
    let listener = tokio::net::TcpListener::bind(&address).await?;
    tracing::info!("data-layer-service listening on {address} (db={})", database_path.display());

    axum::serve(listener, application).await?;
    Ok(())
}

// Build the HTTP router for entity, row, and relationship APIs.
fn build_router(state: AppState) -> Router {
    Router::new()
        .route("/health", get(health_handler))
        .route("/entities", get(list_entities_handler).post(create_entity_handler))
        .route(
            "/entities/:entity_id",
            get(get_entity_handler)
                .put(update_entity_handler)
                .delete(delete_entity_handler),
        )
        .route(
            "/entities/:entity_id/data",
            get(list_entity_data_handler).post(create_entity_row_handler),
        )
        .route(
            "/entities/:entity_id/data/:row_id",
            put(update_entity_row_handler).delete(delete_entity_row_handler),
        )
        .route(
            "/entity-relationships",
            get(list_entity_relationships_handler).post(create_entity_relationship_handler),
        )
        .route(
            "/entity-relationships/:entity_relationship_id",
            get(get_entity_relationship_handler)
                .put(update_entity_relationship_handler)
                .delete(delete_entity_relationship_handler),
        )
        .route(
            "/relationships",
            get(list_relationships_handler).post(create_relationship_handler),
        )
        .route(
            "/relationships/:relationship_id",
            put(update_relationship_handler).delete(delete_relationship_handler),
        )
        .route("/rdf/turtle", post(export_rdf_turtle_handler))
        .with_state(state)
}

// Read bind host/port from environment variables.
fn read_server_address() -> String {
    let host = env::var("DATA_LAYER_HOST").unwrap_or_else(|_| "127.0.0.1".to_string());
    let port = env::var("DATA_LAYER_PORT").unwrap_or_else(|_| "8182".to_string());
    format!("{host}:{port}")
}

// Read LMDB file path from environment variables.
fn read_database_path() -> PathBuf {
    let raw_path =
        env::var("DATA_LAYER_DB_PATH").unwrap_or_else(|_| "./data/data-layer-lmdb".to_string());
    PathBuf::from(raw_path)
}

// Lightweight health endpoint.
async fn health_handler() -> Json<serde_json::Value> {
    Json(serde_json::json!({ "ok": true }))
}

// POST /entities — create entity structure.
async fn create_entity_handler(
    State(state): State<AppState>,
    Json(payload): Json<CreateEntityRequest>,
) -> Result<Json<models::EntityDefinition>, (StatusCode, Json<ErrorBody>)> {
    state
        .store
        .create_entity(payload)
        .map(Json)
        .map_err(map_store_error)
}

// PUT /entities/:entity_id — update entity structure.
async fn update_entity_handler(
    State(state): State<AppState>,
    Path(entity_id_raw): Path<String>,
    Json(payload): Json<UpdateEntityRequest>,
) -> Result<Json<models::EntityDefinition>, (StatusCode, Json<ErrorBody>)> {
    let entity_id = parse_id_param(&entity_id_raw, "entity_id")?;
    state
        .store
        .update_entity(entity_id, payload)
        .map(Json)
        .map_err(map_store_error)
}

// GET /entities — list entity id and name.
async fn list_entities_handler(
    State(state): State<AppState>,
) -> Result<Json<Vec<models::EntitySummary>>, (StatusCode, Json<ErrorBody>)> {
    state
        .store
        .list_entities()
        .map(Json)
        .map_err(map_store_error)
}

// GET /entities/:entity_id — fetch full entity structure.
async fn get_entity_handler(
    State(state): State<AppState>,
    Path(entity_id_raw): Path<String>,
) -> Result<Json<models::EntityDefinition>, (StatusCode, Json<ErrorBody>)> {
    let entity_id = parse_id_param(&entity_id_raw, "entity_id")?;
    state
        .store
        .get_entity(entity_id)
        .map(Json)
        .map_err(map_store_error)
}

// GET /entities/:entity_id/data — list rows for an entity.
async fn list_entity_data_handler(
    State(state): State<AppState>,
    Path(entity_id_raw): Path<String>,
) -> Result<Json<Vec<models::EntityRowRecord>>, (StatusCode, Json<ErrorBody>)> {
    let entity_id = parse_id_param(&entity_id_raw, "entity_id")?;
    state
        .store
        .list_entity_rows(entity_id)
        .map(Json)
        .map_err(map_store_error)
}

// POST /entities/:entity_id/data — create a row.
async fn create_entity_row_handler(
    State(state): State<AppState>,
    Path(entity_id_raw): Path<String>,
    Json(payload): Json<CreateEntityRowRequest>,
) -> Result<Json<models::EntityRowRecord>, (StatusCode, Json<ErrorBody>)> {
    let entity_id = parse_id_param(&entity_id_raw, "entity_id")?;
    state
        .store
        .create_entity_row(entity_id, payload)
        .map(Json)
        .map_err(map_store_error)
}

// DELETE /entities/:entity_id — remove entity schema, rows, and related relationship records.
async fn delete_entity_handler(
    State(state): State<AppState>,
    Path(entity_id_raw): Path<String>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<ErrorBody>)> {
    let entity_id = parse_id_param(&entity_id_raw, "entity_id")?;
    state
        .store
        .delete_entity(entity_id)
        .map(|_| Json(serde_json::json!({ "ok": true, "deleted_entity_id": entity_id })))
        .map_err(map_store_error)
}

// DELETE /entities/:entity_id/data/:row_id — remove one row and touching link records.
async fn delete_entity_row_handler(
    State(state): State<AppState>,
    Path((entity_id_raw, row_id_raw)): Path<(String, String)>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<ErrorBody>)> {
    let entity_id = parse_id_param(&entity_id_raw, "entity_id")?;
    let row_id = parse_id_param(&row_id_raw, "row_id")?;
    state
        .store
        .delete_entity_row(entity_id, row_id)
        .map(|_| {
            Json(serde_json::json!({
                "ok": true,
                "deleted_entity_id": entity_id,
                "deleted_row_id": row_id
            }))
        })
        .map_err(map_store_error)
}

// PUT /entities/:entity_id/data/:row_id — update a row.
async fn update_entity_row_handler(
    State(state): State<AppState>,
    Path((entity_id_raw, row_id_raw)): Path<(String, String)>,
    Json(payload): Json<UpdateEntityRowRequest>,
) -> Result<Json<models::EntityRowRecord>, (StatusCode, Json<ErrorBody>)> {
    let entity_id = parse_id_param(&entity_id_raw, "entity_id")?;
    let row_id = parse_id_param(&row_id_raw, "row_id")?;
    state
        .store
        .update_entity_row(entity_id, row_id, payload)
        .map(Json)
        .map_err(map_store_error)
}

// POST /entity-relationships — define a relationship between two entity types (schema only).
async fn create_entity_relationship_handler(
    State(state): State<AppState>,
    Json(payload): Json<CreateEntityRelationshipRequest>,
) -> Result<Json<models::EntityRelationshipDefinition>, (StatusCode, Json<ErrorBody>)> {
    state
        .store
        .create_entity_relationship(payload)
        .map(Json)
        .map_err(map_store_error)
}

// GET /entity-relationships/:entity_relationship_id — fetch one entity relationship definition.
async fn get_entity_relationship_handler(
    State(state): State<AppState>,
    Path(entity_relationship_id_raw): Path<String>,
) -> Result<Json<models::EntityRelationshipDefinition>, (StatusCode, Json<ErrorBody>)> {
    let entity_relationship_id =
        parse_id_param(&entity_relationship_id_raw, "entity_relationship_id")?;
    state
        .store
        .get_entity_relationship(entity_relationship_id)
        .map(Json)
        .map_err(map_store_error)
}

// DELETE /entity-relationships/:entity_relationship_id — remove schema relationship.
async fn delete_entity_relationship_handler(
    State(state): State<AppState>,
    Path(entity_relationship_id_raw): Path<String>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<ErrorBody>)> {
    let entity_relationship_id =
        parse_id_param(&entity_relationship_id_raw, "entity_relationship_id")?;
    state
        .store
        .delete_entity_relationship(entity_relationship_id)
        .map(|_| {
            Json(serde_json::json!({
                "ok": true,
                "deleted_entity_relationship_id": entity_relationship_id
            }))
        })
        .map_err(map_store_error)
}

// PUT /entity-relationships/:entity_relationship_id — update entity relationship definition.
async fn update_entity_relationship_handler(
    State(state): State<AppState>,
    Path(entity_relationship_id_raw): Path<String>,
    Json(payload): Json<UpdateEntityRelationshipRequest>,
) -> Result<Json<models::EntityRelationshipDefinition>, (StatusCode, Json<ErrorBody>)> {
    let entity_relationship_id =
        parse_id_param(&entity_relationship_id_raw, "entity_relationship_id")?;
    state
        .store
        .update_entity_relationship(entity_relationship_id, payload)
        .map(Json)
        .map_err(map_store_error)
}

// GET /entity-relationships — list entity-level relationship definitions.
async fn list_entity_relationships_handler(
    State(state): State<AppState>,
) -> Result<Json<Vec<models::EntityRelationshipDefinition>>, (StatusCode, Json<ErrorBody>)> {
    state
        .store
        .list_entity_relationships()
        .map(Json)
        .map_err(map_store_error)
}

// POST /relationships — create a row-level relationship link.
async fn create_relationship_handler(
    State(state): State<AppState>,
    Json(payload): Json<CreateRelationshipRequest>,
) -> Result<Json<models::RelationshipRecord>, (StatusCode, Json<ErrorBody>)> {
    state
        .store
        .create_relationship(payload)
        .map(Json)
        .map_err(map_store_error)
}

// DELETE /relationships/:relationship_id — remove a row-level link.
async fn delete_relationship_handler(
    State(state): State<AppState>,
    Path(relationship_id_raw): Path<String>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<ErrorBody>)> {
    let relationship_id = parse_id_param(&relationship_id_raw, "relationship_id")?;
    state
        .store
        .delete_relationship(relationship_id)
        .map(|_| Json(serde_json::json!({ "ok": true, "deleted_relationship_id": relationship_id })))
        .map_err(map_store_error)
}

// PUT /relationships/:relationship_id — update a relationship link.
async fn update_relationship_handler(
    State(state): State<AppState>,
    Path(relationship_id_raw): Path<String>,
    Json(payload): Json<UpdateRelationshipRequest>,
) -> Result<Json<models::RelationshipRecord>, (StatusCode, Json<ErrorBody>)> {
    let relationship_id = parse_id_param(&relationship_id_raw, "relationship_id")?;
    state
        .store
        .update_relationship(relationship_id, payload)
        .map(Json)
        .map_err(map_store_error)
}

// GET /relationships — list all relationships.
async fn list_relationships_handler(
    State(state): State<AppState>,
) -> Result<Json<Vec<models::RelationshipRecord>>, (StatusCode, Json<ErrorBody>)> {
    state
        .store
        .list_relationships()
        .map(Json)
        .map_err(map_store_error)
}

// POST /rdf/turtle — export RDF Turtle from LMDB (all entities or a scoped subgraph).
async fn export_rdf_turtle_handler(
    State(state): State<AppState>,
    Json(payload): Json<TurtleExportRequest>,
) -> Result<Response, (StatusCode, Json<ErrorBody>)> {
    match turtle_export::turtle_from_lmdb(&state.store, &payload) {
        Ok(turtle_text) => Response::builder()
            .status(StatusCode::OK)
            .header(header::CONTENT_TYPE, "text/turtle; charset=utf-8")
            .body(Body::from(turtle_text))
            .map_err(|error| {
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(ErrorBody {
                        error: error.to_string(),
                    }),
                )
            }),
        Err(store_error) => Err(map_store_error(store_error)),
    }
}
