#!/usr/bin/env bash
# Start AnythingGraph platform services for local development.
# Usage: ./scripts/start-all.sh
# Press Ctrl+C to stop all services.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

declare -a SERVICE_PIDS=()

# Stop every background service started by this script.
cleanup() {
  local exit_code=$?
  echo ""
  echo "Stopping all services..."
  for process_id in "${SERVICE_PIDS[@]}"; do
    if kill -0 "$process_id" 2>/dev/null; then
      kill -TERM "$process_id" 2>/dev/null || true
      pkill -TERM -P "$process_id" 2>/dev/null || true
    fi
  done
  sleep 1
  for process_id in "${SERVICE_PIDS[@]}"; do
    if kill -0 "$process_id" 2>/dev/null; then
      kill -KILL "$process_id" 2>/dev/null || true
      pkill -KILL -P "$process_id" 2>/dev/null || true
    fi
  done
  wait 2>/dev/null || true
  echo "All services stopped."
  exit "$exit_code"
}

trap cleanup SIGINT SIGTERM EXIT

# Free a local TCP port if a previous AnythingGraph process is still bound.
free_port() {
  local port_number="$1"
  local process_ids
  process_ids=$(lsof -ti :"$port_number" 2>/dev/null || true)
  if [ -z "$process_ids" ]; then
    return 0
  fi
  echo "Freeing port ${port_number} (stopping existing listener)..."
  # shellcheck disable=SC2086
  kill -TERM $process_ids 2>/dev/null || true
  sleep 1
  process_ids=$(lsof -ti :"$port_number" 2>/dev/null || true)
  if [ -n "$process_ids" ]; then
    # shellcheck disable=SC2086
    kill -KILL $process_ids 2>/dev/null || true
  fi
}

# Run a command in a service directory with prefixed log lines.
start_service() {
  local service_name="$1"
  local service_directory="$2"
  shift 2

  echo "Starting ${service_name}..."
  (
    cd "$ROOT_DIR/$service_directory"
    "$@" 2>&1 | while IFS= read -r log_line; do
      printf '[%s] %s\n' "$service_name" "$log_line"
    done
  ) &

  SERVICE_PIDS+=($!)
}

# Optional short wait for HTTP services to bind (Rust compile may take longer on first run).
wait_for_port() {
  local port_number="$1"
  local service_label="$2"
  local max_attempts=60
  local attempt=0

  while [ "$attempt" -lt "$max_attempts" ]; do
    if nc -z 127.0.0.1 "$port_number" 2>/dev/null; then
      echo "${service_label} is listening on port ${port_number}."
      return 0
    fi
    attempt=$((attempt + 1))
    sleep 1
  done

  echo "Warning: ${service_label} did not open port ${port_number} within ${max_attempts}s (may still be compiling)."
  return 0
}

if ! command -v cargo >/dev/null 2>&1; then
  echo "Error: cargo is required (install Rust from https://rustup.rs/)."
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "Error: npm is required."
  exit 1
fi

echo "AnythingGraph — starting all services from ${ROOT_DIR}"
echo ""

free_port 8182
free_port 8181
free_port 8183

# 1–3: Rust services (dashboard and MCP depend on these URLs).
start_service "data-layer" "core-services/data-layer-service" cargo run
start_service "rdf-cache" "core-services/rdf-cache-service" cargo run

wait_for_port 8182 "data-layer-service"
wait_for_port 8181 "rdf-cache-service"

start_service "connector" "core-services/connector-service" cargo run

wait_for_port 8183 "connector-service"

# 3–4: Dashboard API + UI (uses concurrently in dashboard/package.json).
start_service "dashboard" "dashboard" npm run dev

# 5: MCP stdio server (for Cursor; also runs idle until an MCP host connects).
start_service "mcp" "mcp-service" npm run dev

echo ""
echo "Services (give dashboard a few seconds if frontend is still starting):"
echo "  Dashboard UI:      http://127.0.0.1:5183"
echo "  Dashboard API:     http://127.0.0.1:5180"
echo "  data-layer:        http://127.0.0.1:8182"
echo "  rdf-cache:         http://127.0.0.1:8181"
echo "  connector-service: http://127.0.0.1:8183"
echo "  mcp-service:       stdio (configure Cursor → Settings → MCP or .cursor/mcp.json)"
echo ""
echo "Press Ctrl+C to stop all services."
echo ""

wait
