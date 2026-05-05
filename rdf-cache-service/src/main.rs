use axum::{
    extract::State,
    http::StatusCode,
    routing::{get, post},
    Json, Router,
};
use oxigraph::io::RdfFormat;
use oxigraph::sparql::QueryResults;
use oxigraph::store::Store;
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use std::env;
use std::sync::Arc;
use std::time::{Instant, SystemTime, UNIX_EPOCH};
use thiserror::Error;
use tokio::sync::RwLock;
use tracing_subscriber::EnvFilter;

#[derive(Clone)]
struct AppState {
    cache: Arc<RwLock<RdfCache>>,
}

#[derive(Clone, Debug, Default)]
struct RdfCache {
    turtle: String,
    version: u64,
    updated_at_ms: u128,
}

#[derive(Debug, Deserialize)]
struct LoadCacheRequest {
    turtle: String,
    replace: Option<bool>,
}

#[derive(Debug, Serialize)]
struct LoadCacheResponse {
    ok: bool,
    version: u64,
    turtle_bytes: usize,
    updated_at_ms: u128,
}

#[derive(Debug, Serialize)]
struct GetCacheResponse {
    ok: bool,
    version: u64,
    turtle: String,
    turtle_bytes: usize,
    updated_at_ms: u128,
}

#[derive(Debug, Serialize)]
struct MetaCacheResponse {
    ok: bool,
    version: u64,
    turtle_bytes: usize,
    updated_at_ms: u128,
}

#[derive(Debug, Serialize)]
struct HealthResponse {
    ok: bool,
}

#[derive(Debug, Deserialize)]
struct SparqlQueryRequest {
    query: String,
}

#[derive(Debug, Serialize)]
struct SparqlQueryResponse {
    ok: bool,
    version: u64,
    variables: Vec<String>,
    rows: Vec<Map<String, Value>>,
    execution_time_ms: u128,
}

#[derive(Debug, Error)]
enum ApiError {
    #[error("bad request: {0}")]
    BadRequest(String),
    #[error("internal error: {0}")]
    Internal(String),
}

impl axum::response::IntoResponse for ApiError {
    fn into_response(self) -> axum::response::Response {
        let (status, message) = match self {
            ApiError::BadRequest(message) => (StatusCode::BAD_REQUEST, message),
            ApiError::Internal(message) => (StatusCode::INTERNAL_SERVER_ERROR, message),
        };
        let body = Json(serde_json::json!({ "error": message }));
        (status, body).into_response()
    }
}

// Return current UTC milliseconds since UNIX epoch.
fn current_time_ms() -> Result<u128, ApiError> {
    let now = SystemTime::now();
    let duration = now
        .duration_since(UNIX_EPOCH)
        .map_err(|error| ApiError::Internal(error.to_string()))?;
    Ok(duration.as_millis())
}

// Read bind address from env with sensible defaults.
fn read_server_address() -> String {
    let host = env::var("RDF_CACHE_HOST").unwrap_or_else(|_| "127.0.0.1".to_string());
    let port = env::var("RDF_CACHE_PORT").unwrap_or_else(|_| "8181".to_string());
    format!("{host}:{port}")
}

// Create the router and attach shared state.
fn build_router(state: AppState) -> Router {
    Router::new()
        .route("/health", get(health_handler))
        .route("/cache/load", post(load_cache_handler))
        .route("/cache/get", get(get_cache_handler))
        .route("/cache/meta", get(meta_cache_handler))
        .route("/cache/clear", post(clear_cache_handler))
        .route("/sparql/query", post(sparql_query_handler))
        .with_state(state)
}

// Lightweight health endpoint for readiness checks.
async fn health_handler() -> Json<HealthResponse> {
    Json(HealthResponse { ok: true })
}

// Replace or append Turtle content in the in-memory cache.
async fn load_cache_handler(
    State(state): State<AppState>,
    Json(payload): Json<LoadCacheRequest>,
) -> Result<Json<LoadCacheResponse>, ApiError> {
    let next_turtle = payload.turtle.trim();
    if next_turtle.is_empty() {
        return Err(ApiError::BadRequest("turtle is required".to_string()));
    }

    let should_replace = payload.replace.unwrap_or(true);
    let updated_at_ms = current_time_ms()?;

    let mut cache = state.cache.write().await;
    if should_replace || cache.turtle.is_empty() {
        cache.turtle = next_turtle.to_string();
    } else {
        cache.turtle.push('\n');
        cache.turtle.push_str(next_turtle);
    }
    cache.version = cache.version.saturating_add(1);
    cache.updated_at_ms = updated_at_ms;

    Ok(Json(LoadCacheResponse {
        ok: true,
        version: cache.version,
        turtle_bytes: cache.turtle.len(),
        updated_at_ms: cache.updated_at_ms,
    }))
}

// Return the full cached Turtle payload.
async fn get_cache_handler(State(state): State<AppState>) -> Json<GetCacheResponse> {
    let cache = state.cache.read().await;
    Json(GetCacheResponse {
        ok: true,
        version: cache.version,
        turtle: cache.turtle.clone(),
        turtle_bytes: cache.turtle.len(),
        updated_at_ms: cache.updated_at_ms,
    })
}

// Return only cache metadata for lightweight polling.
async fn meta_cache_handler(State(state): State<AppState>) -> Json<MetaCacheResponse> {
    let cache = state.cache.read().await;
    Json(MetaCacheResponse {
        ok: true,
        version: cache.version,
        turtle_bytes: cache.turtle.len(),
        updated_at_ms: cache.updated_at_ms,
    })
}

// Clear the cache explicitly.
async fn clear_cache_handler(State(state): State<AppState>) -> Result<Json<MetaCacheResponse>, ApiError> {
    let updated_at_ms = current_time_ms()?;
    let mut cache = state.cache.write().await;
    cache.turtle = String::new();
    cache.version = cache.version.saturating_add(1);
    cache.updated_at_ms = updated_at_ms;
    Ok(Json(MetaCacheResponse {
        ok: true,
        version: cache.version,
        turtle_bytes: 0,
        updated_at_ms: cache.updated_at_ms,
    }))
}

// Execute a SPARQL SELECT query against currently cached Turtle RDF data.
async fn sparql_query_handler(
    State(state): State<AppState>,
    Json(payload): Json<SparqlQueryRequest>,
) -> Result<Json<SparqlQueryResponse>, ApiError> {
    let query_text = payload.query.trim();
    if query_text.is_empty() {
        return Err(ApiError::BadRequest("query is required".to_string()));
    }

    let cache = state.cache.read().await;
    if cache.turtle.trim().is_empty() {
        return Err(ApiError::BadRequest("cache is empty; load Turtle first".to_string()));
    }

    let started_at = Instant::now();
    let store = build_store_from_cached_turtle(&cache.turtle)?;
    let query_result = store
        .query(query_text)
        .map_err(|error| ApiError::BadRequest(format!("invalid SPARQL query: {error}")))?;
    let (variables, rows) = collect_query_rows(query_result)?;
    let execution_time_ms = started_at.elapsed().as_millis();

    Ok(Json(SparqlQueryResponse {
        ok: true,
        version: cache.version,
        variables,
        rows,
        execution_time_ms,
    }))
}

// Build an in-memory Oxigraph store from Turtle text.
fn build_store_from_cached_turtle(turtle_text: &str) -> Result<Store, ApiError> {
    let store = Store::new().map_err(|error| ApiError::Internal(error.to_string()))?;
    store
        .load_from_reader(
            RdfFormat::Turtle,
            turtle_text.as_bytes(),
        )
        .map_err(|error| ApiError::BadRequest(format!("invalid Turtle in cache: {error}")))?;
    Ok(store)
}

// Convert Oxigraph query results into API-friendly variable and row lists.
fn collect_query_rows(query_result: QueryResults) -> Result<(Vec<String>, Vec<Map<String, Value>>), ApiError> {
    match query_result {
        QueryResults::Solutions(solutions) => {
            let variable_names_without_prefix: Vec<String> = solutions
                .variables()
                .iter()
                .map(|variable| variable.as_str().to_string())
                .collect();
            let variables: Vec<String> = variable_names_without_prefix
                .iter()
                .map(|name| format!("?{name}"))
                .collect();
            let mut rows = Vec::new();

            for next_solution in solutions {
                let solution = next_solution.map_err(|error| ApiError::Internal(error.to_string()))?;
                let mut row = Map::new();
                for (lookup_name, output_name) in variable_names_without_prefix.iter().zip(variables.iter()) {
                    let term_value = solution
                        .get(lookup_name.as_str())
                        .map(|term| Value::String(term.to_string()))
                        .unwrap_or(Value::Null);
                    row.insert(output_name.clone(), term_value);
                }
                rows.push(row);
            }
            Ok((variables, rows))
        }
        _ => {
            Err(ApiError::BadRequest(
                "only SELECT queries are supported on /sparql/query".to_string(),
            ))
        }
    }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenvy::dotenv().ok();
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::from_default_env())
        .init();

    let address = read_server_address();
    let state = AppState {
        cache: Arc::new(RwLock::new(RdfCache::default())),
    };

    let listener = tokio::net::TcpListener::bind(&address).await?;
    tracing::info!("rdf-cache-service listening on {address}");

    let app = build_router(state);
    axum::serve(listener, app).await?;
    Ok(())
}
