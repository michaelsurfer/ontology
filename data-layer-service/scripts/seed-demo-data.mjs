#!/usr/bin/env node

/**
 * Seeds employee + corporation entities, sample rows, and random relationships
 * via the data-layer-service HTTP API.
 *
 * Usage (service must be running):
 *   node scripts/seed-demo-data.mjs
 *
 * Optional:
 *   DATA_LAYER_URL=http://127.0.0.1:8182 node scripts/seed-demo-data.mjs
 */

const baseUrl = process.env.DATA_LAYER_URL ?? "http://127.0.0.1:8182";

const firstNames = [
  "Alex",
  "Blake",
  "Casey",
  "Dana",
  "Eden",
  "Frankie",
  "Gray",
  "Harper",
];
const lastNames = ["Nguyen", "Patel", "Garcia", "Brown", "Davis", "Lee", "Kim", "Walker"];
const domains = ["example.com", "sample.org", "mail.dev", "inbox.io"];

const companySuffixes = ["Labs", "Holdings", "Partners", "Group", "Industries", "Systems"];

const countries = ["USA", "Canada", "Germany", "Japan", "Brazil", "India", "Australia", "UK"];

// Send JSON and parse response; throw with status and body on failure.
async function sendJson(method, path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const responseText = await response.text();
  let parsed;
  try {
    parsed = responseText ? JSON.parse(responseText) : null;
  } catch {
    parsed = responseText;
  }

  if (!response.ok) {
    const detail = typeof parsed === "object" ? JSON.stringify(parsed) : parsed;
    throw new Error(`${method} ${path} failed (${response.status}): ${detail}`);
  }

  return parsed;
}

// List all entity summaries (id + name) from the API.
async function fetchEntitySummaries() {
  return sendJson("GET", "/entities");
}

// Resolve an entity id by exact name, or null if it is not in the list.
function findEntityIdByName(entitySummaries, entityName) {
  const match = entitySummaries.find((summary) => summary.name === entityName);
  return match ? match.id : null;
}

// Create an entity if missing; otherwise reuse the existing id (avoids 400 duplicate name).
async function ensureEntity(createPayload) {
  const summaries = await fetchEntitySummaries();
  const existingId = findEntityIdByName(summaries, createPayload.name);
  if (existingId !== null) {
    console.log(`Entity "${createPayload.name}" already exists, using id ${existingId}`);
    return { id: existingId, reused: true };
  }

  const created = await sendJson("POST", "/entities", createPayload);
  console.log(`Created entity "${createPayload.name}":`, created.id);
  return { id: created.id, reused: false };
}

// Return a random element from a non-empty array.
function pickRandom(items) {
  const index = Math.floor(Math.random() * items.length);
  return items[index];
}

// Build a pseudo-random phone number string for demos.
function randomPhone() {
  const area = 200 + Math.floor(Math.random() * 700);
  const mid = 200 + Math.floor(Math.random() * 700);
  const line = 1000 + Math.floor(Math.random() * 9000);
  return `${area}-${mid}-${line}`;
}

// Generate a few random employee value objects.
function buildRandomEmployees(count) {
  const rows = [];
  for (let index = 0; index < count; index += 1) {
    const first = pickRandom(firstNames);
    const last = pickRandom(lastNames);
    const name = `${index + 1}. ${first} ${last}`;
    const email = `${first.toLowerCase()}.${last.toLowerCase()}+${index}@${pickRandom(domains)}`;
    rows.push({
      values: {
        name,
        email,
        phone_number: randomPhone(),
      },
    });
  }
  return rows;
}

// Generate random corporation rows.
function buildRandomCorporations(count) {
  const rows = [];
  for (let index = 0; index < count; index += 1) {
    const base = pickRandom(lastNames);
    const name = `${base} ${pickRandom(companySuffixes)} #${index + 1}`;
    rows.push({
      values: {
        name,
        country: pickRandom(countries),
      },
    });
  }
  return rows;
}

// Run the full seed flow using existing public APIs.
async function main() {
  console.log(`Using API base: ${baseUrl}`);

  const employeeEnsure = await ensureEntity({
    name: "employee",
    display_name: "Employee",
    fields: [
      { field_name: "name", field_type: "TEXT", is_required: true },
      { field_name: "email", field_type: "TEXT", is_required: true },
      { field_name: "phone_number", field_type: "TEXT", is_required: false },
    ],
  });
  const employeeEntityId = employeeEnsure.id;

  const employeeRows = buildRandomEmployees(5);
  const employeeRowIds = [];
  for (const rowBody of employeeRows) {
    const created = await sendJson("POST", `/entities/${employeeEntityId}/data`, rowBody);
    employeeRowIds.push(created.id);
    console.log("  row", created.id, created.values);
  }

  const corporationEnsure = await ensureEntity({
    name: "corporation",
    display_name: "Corporation",
    fields: [
      { field_name: "name", field_type: "TEXT", is_required: true },
      { field_name: "country", field_type: "TEXT", is_required: true },
    ],
  });
  const corporationEntityId = corporationEnsure.id;

  const corporationRows = buildRandomCorporations(2);
  const corporationRowIds = [];
  for (const rowBody of corporationRows) {
    const created = await sendJson("POST", `/entities/${corporationEntityId}/data`, rowBody);
    corporationRowIds.push(created.id);
    console.log("  row", created.id, created.values);
  }

  const relationshipCount = 3 + Math.floor(Math.random() * 3);
  console.log(`Creating ${relationshipCount} random employee → corporation links`);

  for (let relationshipIndex = 0; relationshipIndex < relationshipCount; relationshipIndex += 1) {
    const subjectRowId = pickRandom(employeeRowIds);
    const objectRowId = pickRandom(corporationRowIds);
    const relationship = await sendJson("POST", "/relationships", {
      relationship_name: "works_at",
      subject_entity_id: employeeEntityId,
      object_entity_id: corporationEntityId,
      subject_row_id: subjectRowId,
      object_row_id: objectRowId,
    });
    console.log(
      "  relationship",
      relationship.id,
      `employee row ${relationship.subject_row_id} → corporation row ${relationship.object_row_id}`,
    );
  }

  console.log("Done.");
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
