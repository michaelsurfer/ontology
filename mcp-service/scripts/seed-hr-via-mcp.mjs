/**
 * Seed one corporation and random employees via AnythingGraph MCP (stdio).
 */
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const serverEntryPath = join(scriptDirectory, '..', 'dist', 'index.js');

const companyName = 'Northwind Dynamics Ltd';
const companyCountry = 'US';

const randomEmployees = [
  { full_name: 'Elena Vasquez', job_title: 'Chief People Officer', email: 'elena.vasquez@northwind.example' },
  { full_name: 'Marcus Chen', job_title: 'Engineering Manager', email: 'marcus.chen@northwind.example' },
  { full_name: 'Priya Nair', job_title: 'Senior Software Engineer', email: 'priya.nair@northwind.example' },
  { full_name: 'James Okonkwo', job_title: 'HR Business Partner', email: 'james.okonkwo@northwind.example' },
  { full_name: 'Sofia Lindstrom', job_title: 'Talent Acquisition Lead', email: 'sofia.lindstrom@northwind.example' },
  { full_name: 'David Kim', job_title: 'Payroll Specialist', email: 'david.kim@northwind.example' },
];

function extractTextFromToolResult(toolResult) {
  const textParts = (toolResult.content || [])
    .filter((part) => part && part.type === 'text' && typeof part.text === 'string')
    .map((part) => part.text);
  return textParts.join('\n');
}

function parseToolJson(toolResult, toolName) {
  const text = extractTextFromToolResult(toolResult);
  if (toolResult.isError) {
    throw new Error(`${toolName} failed: ${text}`);
  }
  return JSON.parse(text);
}

async function callTool(client, name, argumentsObject) {
  const result = await client.callTool({ name, arguments: argumentsObject });
  return parseToolJson(result, name);
}

async function findEntityByName(client, entityName) {
  const entities = await callTool(client, 'list_entities', {});
  const match = entities.find((row) => row.name === entityName);
  return match || null;
}

async function ensureEntity(client, entityName, displayName, fieldsJson) {
  const existing = await findEntityByName(client, entityName);
  if (existing) {
    console.log(`Entity already exists: ${entityName} (id ${existing.id})`);
    return existing.id;
  }

  const created = await callTool(client, 'create_entity', {
    name: entityName,
    display_name: displayName,
    fields_json: fieldsJson,
  });
  console.log(`Created entity: ${entityName} (id ${created.id})`);
  return created.id;
}

async function ensureEntityRelationship(client, relationshipName, subjectEntityId, objectEntityId) {
  const allDefinitions = await callTool(client, 'list_entity_relationships', {});
  const match = allDefinitions.find(
    (row) =>
      row.relationship_name === relationshipName &&
      row.subject_entity_id === subjectEntityId &&
      row.object_entity_id === objectEntityId,
  );
  if (match) {
    console.log(`Schema relationship already exists: ${relationshipName} (id ${match.id})`);
    return match.id;
  }

  const created = await callTool(client, 'create_entity_relationship', {
    relationship_name: relationshipName,
    subject_entity_id: subjectEntityId,
    object_entity_id: objectEntityId,
  });
  console.log(`Created schema relationship: ${relationshipName} (id ${created.id})`);
  return created.id;
}

async function runHrSeed() {
  const transport = new StdioClientTransport({
    command: 'node',
    args: [serverEntryPath],
    env: {
      DATA_LAYER_URL: process.env.DATA_LAYER_URL || 'http://127.0.0.1:8182',
      RDF_CACHE_URL: process.env.RDF_CACHE_URL || 'http://127.0.0.1:8181',
    },
    stderr: 'pipe',
  });

  const client = new Client({ name: 'hr-seed-via-mcp', version: '1.0.0' });
  await client.connect(transport);

  const health = await callTool(client, 'health_check', {});
  console.log('Health:', health);

  const corporationFieldsJson = JSON.stringify([
    {
      field_name: 'corporation_name',
      field_type: 'TEXT',
      is_required: true,
      is_identifier: true,
      description: 'Company name',
    },
    { field_name: 'country', field_type: 'TEXT', description: 'HQ country' },
  ]);

  const employeeFieldsJson = JSON.stringify([
    {
      field_name: 'full_name',
      field_type: 'TEXT',
      is_required: true,
      is_identifier: true,
      description: 'Employee name',
    },
    { field_name: 'job_title', field_type: 'TEXT', description: 'Role' },
    { field_name: 'email', field_type: 'TEXT', description: 'Work email' },
  ]);

  const corporationEntityId = await ensureEntity(
    client,
    'corporation',
    'Corporation',
    corporationFieldsJson,
  );
  const employeeEntityId = await ensureEntity(client, 'employee', 'Employee', employeeFieldsJson);

  await ensureEntityRelationship(client, 'employed_by', employeeEntityId, corporationEntityId);

  const corporationRow = await callTool(client, 'create_entity_row', {
    entity_id: corporationEntityId,
    values_json: JSON.stringify({
      corporation_name: companyName,
      country: companyCountry,
    }),
  });
  console.log(`Created corporation row id ${corporationRow.id}: ${companyName}`);

  for (const employee of randomEmployees) {
    const employeeRow = await callTool(client, 'create_entity_row', {
      entity_id: employeeEntityId,
      values_json: JSON.stringify({
        full_name: employee.full_name,
        job_title: employee.job_title,
        email: employee.email,
      }),
    });

    const link = await callTool(client, 'create_row_relationship', {
      relationship_name: 'employed_by',
      subject_entity_id: employeeEntityId,
      object_entity_id: corporationEntityId,
      subject_row_id: employeeRow.id,
      object_row_id: corporationRow.id,
    });

    console.log(
      `  Employee ${employeeRow.id}: ${employee.full_name} — employed_by → corp ${corporationRow.id} (link ${link.id})`,
    );
  }

  const summary = await client.readResource({ uri: 'anythinggraph://schema-summary' });
  const summaryText = summary.contents?.[0]?.text || '{}';
  const parsed = JSON.parse(summaryText);
  console.log('\nSchema summary entities:', parsed.entities?.length ?? 0);
  console.log('Row relationships:', parsed.row_relationships?.length ?? 0);

  await client.close();
  console.log('\nHR seed via MCP completed.');
}

runHrSeed().catch((error) => {
  console.error('\nHR seed failed:', error);
  process.exit(1);
});
