#!/usr/bin/env node

/**
 * Seed ~500 random CRM records (accounts, contacts, leads, opportunities,
 * invoices, purchase orders, support tickets) using the AnythingGraph MCP server
 * for row inserts (create_entity_row) and the data-layer HTTP API for
 * entity schemas and relationships (not exposed as MCP tools yet).
 *
 * Usage:
 *   node scripts/seed-crm-via-mcp.mjs
 *
 * Optional:
 *   DATA_LAYER_URL=http://127.0.0.1:8182 node scripts/seed-crm-via-mcp.mjs
 */

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const serverEntryPath = join(scriptDirectory, '..', 'dist', 'index.js');
const baseUrl = (process.env.DATA_LAYER_URL || 'http://127.0.0.1:8182').replace(/\/+$/, '');

const firstNames = [
  'Alex', 'Blake', 'Casey', 'Dana', 'Eden', 'Frankie', 'Gray', 'Harper', 'Jordan', 'Kelly',
  'Logan', 'Morgan', 'Parker', 'Quinn', 'Reese', 'Sam', 'Taylor', 'Avery', 'Cameron', 'Drew',
];
const lastNames = [
  'Nguyen', 'Patel', 'Garcia', 'Brown', 'Davis', 'Lee', 'Kim', 'Walker', 'Chen', 'Martinez',
  'Johnson', 'Williams', 'Singh', 'Okafor', 'Schmidt', 'Rossi', 'Tanaka', 'Silva', 'Khan', 'Murphy',
];
const industries = ['Technology', 'Healthcare', 'Finance', 'Retail', 'Manufacturing', 'Energy', 'Media', 'Logistics'];
const regions = ['North America', 'EMEA', 'APAC', 'LATAM'];
const accountStatuses = ['Active', 'Prospect', 'Churned', 'On Hold'];
const leadSources = ['Website', 'Referral', 'Trade Show', 'Cold Call', 'Partner', 'LinkedIn', 'Webinar'];
const leadStatuses = ['New', 'Contacted', 'Qualified', 'Unqualified', 'Converted'];
const oppStages = ['Prospecting', 'Qualification', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost'];
const invoiceStatuses = ['Draft', 'Sent', 'Paid', 'Overdue', 'Void'];
const poStatuses = ['Draft', 'Submitted', 'Approved', 'Received', 'Cancelled'];
const ticketPriorities = ['Low', 'Medium', 'High', 'Critical'];
const ticketStatuses = ['Open', 'In Progress', 'Waiting on Customer', 'Resolved', 'Closed'];
const ticketChannels = ['Email', 'Phone', 'Chat', 'Portal', 'Social'];
const currencies = ['USD', 'EUR', 'GBP', 'CAD', 'AUD'];
const companySuffixes = ['Labs', 'Holdings', 'Partners', 'Group', 'Industries', 'Systems', 'Corp', 'Solutions'];
const jobTitles = ['CEO', 'CTO', 'VP Sales', 'Account Manager', 'Support Engineer', 'Procurement Lead', 'CFO', 'Director'];

const ROW_COUNTS = {
  crm_account: 40,
  crm_contact: 80,
  crm_lead: 70,
  crm_opportunity: 70,
  crm_invoice: 80,
  crm_purchase_order: 60,
  crm_support_ticket: 100,
};

// Return a random element from a non-empty array.
function pickRandom(items) {
  return items[Math.floor(Math.random() * items.length)];
}

// Format a date as YYYY-MM-DD offset from today.
function randomDateString(daysBackMin, daysBackMax) {
  const offsetDays = daysBackMin + Math.floor(Math.random() * (daysBackMax - daysBackMin + 1));
  const date = new Date();
  date.setDate(date.getDate() - offsetDays);
  return date.toISOString().slice(0, 10);
}

// Send JSON to the data-layer HTTP API.
async function sendJson(method, path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const responseText = await response.text();
  let parsed = null;
  if (responseText) {
    try {
      parsed = JSON.parse(responseText);
    } catch {
      parsed = responseText;
    }
  }
  if (!response.ok) {
    const detail = typeof parsed === 'object' ? JSON.stringify(parsed) : parsed;
    throw new Error(`${method} ${path} failed (${response.status}): ${detail}`);
  }
  return parsed;
}

// Create an entity schema if it does not already exist.
async function ensureEntity(createPayload) {
  const summaries = await sendJson('GET', '/entities');
  const existing = summaries.find((summary) => summary.name === createPayload.name);
  if (existing) {
    console.log(`Entity "${createPayload.name}" already exists (id ${existing.id})`);
    return existing.id;
  }
  const created = await sendJson('POST', '/entities', createPayload);
  console.log(`Created entity "${createPayload.name}" (id ${created.id})`);
  return created.id;
}

// Create a schema-level relationship if missing.
async function ensureEntityRelationship(relationshipName, subjectEntityId, objectEntityId) {
  const definitions = await sendJson('GET', '/entity-relationships');
  const exists = definitions.some(
    (definition) =>
      definition.relationship_name === relationshipName &&
      definition.subject_entity_id === subjectEntityId &&
      definition.object_entity_id === objectEntityId,
  );
  if (exists) {
    console.log(`Schema relationship "${relationshipName}" already exists`);
    return;
  }
  await sendJson('POST', '/entity-relationships', {
    relationship_name: relationshipName,
    subject_entity_id: subjectEntityId,
    object_entity_id: objectEntityId,
  });
  console.log(`Created schema relationship "${relationshipName}"`);
}

// Parse JSON text from an MCP tool result.
function parseMcpToolJson(toolResult) {
  const textParts = (toolResult.content || [])
    .filter((part) => part && part.type === 'text' && typeof part.text === 'string')
    .map((part) => part.text);
  const combined = textParts.join('\n');
  if (toolResult.isError) {
    throw new Error(combined || 'MCP tool returned an error');
  }
  return JSON.parse(combined);
}

// Insert one row via AnythingGraph MCP create_entity_row.
async function createRowViaMcp(mcpClient, entityId, values) {
  const toolResult = await mcpClient.callTool({
    name: 'create_entity_row',
    arguments: {
      entity_id: entityId,
      values_json: JSON.stringify(values),
    },
  });
  return parseMcpToolJson(toolResult);
}

// Build random CRM row value objects per entity type.
function buildAccountRows(count) {
  const rows = [];
  for (let index = 0; index < count; index += 1) {
    const base = pickRandom(lastNames);
    rows.push({
      account_name: `${base} ${pickRandom(companySuffixes)} ${index + 1}`,
      industry: pickRandom(industries),
      region: pickRandom(regions),
      annual_revenue: Math.round(500000 + Math.random() * 9500000),
      status: pickRandom(accountStatuses),
    });
  }
  return rows;
}

function buildContactRows(count) {
  const rows = [];
  for (let index = 0; index < count; index += 1) {
    const first = pickRandom(firstNames);
    const last = pickRandom(lastNames);
    rows.push({
      first_name: first,
      last_name: last,
      email: `${first.toLowerCase()}.${last.toLowerCase()}+crm${index}@example.com`,
      phone: `${200 + Math.floor(Math.random() * 700)}-${200 + Math.floor(Math.random() * 700)}-${1000 + Math.floor(Math.random() * 9000)}`,
      job_title: pickRandom(jobTitles),
    });
  }
  return rows;
}

function buildLeadRows(count) {
  const rows = [];
  for (let index = 0; index < count; index += 1) {
    const first = pickRandom(firstNames);
    const last = pickRandom(lastNames);
    rows.push({
      lead_id: `LEAD-${10000 + index}`,
      company_name: `${pickRandom(lastNames)} ${pickRandom(companySuffixes)}`,
      contact_name: `${first} ${last}`,
      source: pickRandom(leadSources),
      status: pickRandom(leadStatuses),
      lead_score: Math.floor(Math.random() * 100),
    });
  }
  return rows;
}

function buildOpportunityRows(count) {
  const rows = [];
  for (let index = 0; index < count; index += 1) {
    rows.push({
      opportunity_name: `Deal ${index + 1} - ${pickRandom(industries)} Expansion`,
      stage: pickRandom(oppStages),
      amount: Math.round(5000 + Math.random() * 495000),
      close_date: randomDateString(-30, 120),
      probability: Math.floor(Math.random() * 100),
    });
  }
  return rows;
}

function buildInvoiceRows(count) {
  const rows = [];
  for (let index = 0; index < count; index += 1) {
    rows.push({
      invoice_number: `INV-${2025000 + index}`,
      amount: Math.round(500 + Math.random() * 99950),
      status: pickRandom(invoiceStatuses),
      due_date: randomDateString(-60, 90),
      currency: pickRandom(currencies),
    });
  }
  return rows;
}

function buildPurchaseOrderRows(count) {
  const rows = [];
  for (let index = 0; index < count; index += 1) {
    rows.push({
      po_number: `PO-${88000 + index}`,
      total_amount: Math.round(1000 + Math.random() * 199000),
      status: pickRandom(poStatuses),
      order_date: randomDateString(0, 180),
      vendor_name: `${pickRandom(lastNames)} Supply Co.`,
    });
  }
  return rows;
}

function buildSupportTicketRows(count) {
  const subjects = [
    'Login issue after password reset',
    'Billing discrepancy on last invoice',
    'API rate limit questions',
    'Feature request: bulk export',
    'Integration failure with ERP',
    'Cannot access admin dashboard',
    'Duplicate charge on subscription',
    'Performance degradation reported',
    'Need SSO configuration help',
    'Data sync delay between systems',
  ];
  const rows = [];
  for (let index = 0; index < count; index += 1) {
    rows.push({
      ticket_number: `TKT-${450000 + index}`,
      subject: pickRandom(subjects),
      priority: pickRandom(ticketPriorities),
      status: pickRandom(ticketStatuses),
      channel: pickRandom(ticketChannels),
    });
  }
  return rows;
}

// Insert many rows for one entity via MCP and return created row ids.
async function seedEntityRows(mcpClient, entityId, entityLabel, valueRows) {
  const rowIds = [];
  for (let index = 0; index < valueRows.length; index += 1) {
    const created = await createRowViaMcp(mcpClient, entityId, valueRows[index]);
    rowIds.push(created.id);
    if ((index + 1) % 25 === 0 || index + 1 === valueRows.length) {
      console.log(`  ${entityLabel}: ${index + 1}/${valueRows.length} rows inserted`);
    }
  }
  return rowIds;
}

// Create row-level links between CRM records.
async function seedRowRelationships(entityIds, rowIdsByEntity) {
  const links = [];

  for (const contactRowId of rowIdsByEntity.crm_contact) {
    links.push({
      relationship_name: 'belongs_to_account',
      subject_entity_id: entityIds.crm_contact,
      object_entity_id: entityIds.crm_account,
      subject_row_id: contactRowId,
      object_row_id: pickRandom(rowIdsByEntity.crm_account),
    });
  }

  for (const leadRowId of rowIdsByEntity.crm_lead) {
    links.push({
      relationship_name: 'associated_with_account',
      subject_entity_id: entityIds.crm_lead,
      object_entity_id: entityIds.crm_account,
      subject_row_id: leadRowId,
      object_row_id: pickRandom(rowIdsByEntity.crm_account),
    });
  }

  for (const opportunityRowId of rowIdsByEntity.crm_opportunity) {
    links.push({
      relationship_name: 'for_account',
      subject_entity_id: entityIds.crm_opportunity,
      object_entity_id: entityIds.crm_account,
      subject_row_id: opportunityRowId,
      object_row_id: pickRandom(rowIdsByEntity.crm_account),
    });
    links.push({
      relationship_name: 'primary_contact',
      subject_entity_id: entityIds.crm_opportunity,
      object_entity_id: entityIds.crm_contact,
      subject_row_id: opportunityRowId,
      object_row_id: pickRandom(rowIdsByEntity.crm_contact),
    });
  }

  for (const invoiceRowId of rowIdsByEntity.crm_invoice) {
    links.push({
      relationship_name: 'billed_to',
      subject_entity_id: entityIds.crm_invoice,
      object_entity_id: entityIds.crm_account,
      subject_row_id: invoiceRowId,
      object_row_id: pickRandom(rowIdsByEntity.crm_account),
    });
  }

  for (const poRowId of rowIdsByEntity.crm_purchase_order) {
    links.push({
      relationship_name: 'ordered_from_account',
      subject_entity_id: entityIds.crm_purchase_order,
      object_entity_id: entityIds.crm_account,
      subject_row_id: poRowId,
      object_row_id: pickRandom(rowIdsByEntity.crm_account),
    });
  }

  for (const ticketRowId of rowIdsByEntity.crm_support_ticket) {
    links.push({
      relationship_name: 'for_account',
      subject_entity_id: entityIds.crm_support_ticket,
      object_entity_id: entityIds.crm_account,
      subject_row_id: ticketRowId,
      object_row_id: pickRandom(rowIdsByEntity.crm_account),
    });
    links.push({
      relationship_name: 'submitted_by',
      subject_entity_id: entityIds.crm_support_ticket,
      object_entity_id: entityIds.crm_contact,
      subject_row_id: ticketRowId,
      object_row_id: pickRandom(rowIdsByEntity.crm_contact),
    });
  }

  console.log(`Creating ${links.length} row-level CRM relationships...`);
  for (let index = 0; index < links.length; index += 1) {
    await sendJson('POST', '/relationships', links[index]);
    if ((index + 1) % 50 === 0 || index + 1 === links.length) {
      console.log(`  relationships: ${index + 1}/${links.length}`);
    }
  }
}

async function main() {
  const totalRows = Object.values(ROW_COUNTS).reduce((sum, count) => sum + count, 0);
  console.log(`Seeding ${totalRows} CRM rows via AnythingGraph MCP (${baseUrl})`);

  const entityIds = {
    crm_account: await ensureEntity({
      name: 'crm_account',
      display_name: 'CRM Account',
      fields: [
        { field_name: 'account_name', field_type: 'TEXT', is_required: true, is_identifier: true },
        { field_name: 'industry', field_type: 'TEXT', is_required: true },
        { field_name: 'region', field_type: 'TEXT', is_required: true },
        { field_name: 'annual_revenue', field_type: 'INTEGER', is_required: false },
        { field_name: 'status', field_type: 'TEXT', is_required: true },
      ],
    }),
    crm_contact: await ensureEntity({
      name: 'crm_contact',
      display_name: 'CRM Contact',
      fields: [
        { field_name: 'first_name', field_type: 'TEXT', is_required: true },
        { field_name: 'last_name', field_type: 'TEXT', is_required: true },
        { field_name: 'email', field_type: 'TEXT', is_required: true, is_identifier: true },
        { field_name: 'phone', field_type: 'TEXT', is_required: false },
        { field_name: 'job_title', field_type: 'TEXT', is_required: false },
      ],
    }),
    crm_lead: await ensureEntity({
      name: 'crm_lead',
      display_name: 'CRM Lead',
      fields: [
        { field_name: 'lead_id', field_type: 'TEXT', is_required: true, is_identifier: true },
        { field_name: 'company_name', field_type: 'TEXT', is_required: true },
        { field_name: 'contact_name', field_type: 'TEXT', is_required: true },
        { field_name: 'source', field_type: 'TEXT', is_required: true },
        { field_name: 'status', field_type: 'TEXT', is_required: true },
        { field_name: 'lead_score', field_type: 'INTEGER', is_required: false },
      ],
    }),
    crm_opportunity: await ensureEntity({
      name: 'crm_opportunity',
      display_name: 'CRM Opportunity',
      fields: [
        { field_name: 'opportunity_name', field_type: 'TEXT', is_required: true, is_identifier: true },
        { field_name: 'stage', field_type: 'TEXT', is_required: true },
        { field_name: 'amount', field_type: 'INTEGER', is_required: true },
        { field_name: 'close_date', field_type: 'TEXT', is_required: false },
        { field_name: 'probability', field_type: 'INTEGER', is_required: false },
      ],
    }),
    crm_invoice: await ensureEntity({
      name: 'crm_invoice',
      display_name: 'CRM Invoice',
      fields: [
        { field_name: 'invoice_number', field_type: 'TEXT', is_required: true, is_identifier: true },
        { field_name: 'amount', field_type: 'INTEGER', is_required: true },
        { field_name: 'status', field_type: 'TEXT', is_required: true },
        { field_name: 'due_date', field_type: 'TEXT', is_required: false },
        { field_name: 'currency', field_type: 'TEXT', is_required: true },
      ],
    }),
    crm_purchase_order: await ensureEntity({
      name: 'crm_purchase_order',
      display_name: 'CRM Purchase Order',
      fields: [
        { field_name: 'po_number', field_type: 'TEXT', is_required: true, is_identifier: true },
        { field_name: 'total_amount', field_type: 'INTEGER', is_required: true },
        { field_name: 'status', field_type: 'TEXT', is_required: true },
        { field_name: 'order_date', field_type: 'TEXT', is_required: false },
        { field_name: 'vendor_name', field_type: 'TEXT', is_required: true },
      ],
    }),
    crm_support_ticket: await ensureEntity({
      name: 'crm_support_ticket',
      display_name: 'CRM Support Ticket',
      fields: [
        { field_name: 'ticket_number', field_type: 'TEXT', is_required: true, is_identifier: true },
        { field_name: 'subject', field_type: 'TEXT', is_required: true },
        { field_name: 'priority', field_type: 'TEXT', is_required: true },
        { field_name: 'status', field_type: 'TEXT', is_required: true },
        { field_name: 'channel', field_type: 'TEXT', is_required: true },
      ],
    }),
  };

  await ensureEntityRelationship('belongs_to_account', entityIds.crm_contact, entityIds.crm_account);
  await ensureEntityRelationship('associated_with_account', entityIds.crm_lead, entityIds.crm_account);
  await ensureEntityRelationship('for_account', entityIds.crm_opportunity, entityIds.crm_account);
  await ensureEntityRelationship('primary_contact', entityIds.crm_opportunity, entityIds.crm_contact);
  await ensureEntityRelationship('billed_to', entityIds.crm_invoice, entityIds.crm_account);
  await ensureEntityRelationship('ordered_from_account', entityIds.crm_purchase_order, entityIds.crm_account);
  await ensureEntityRelationship('for_account', entityIds.crm_support_ticket, entityIds.crm_account);
  await ensureEntityRelationship('submitted_by', entityIds.crm_support_ticket, entityIds.crm_contact);

  const transport = new StdioClientTransport({
    command: 'node',
    args: [serverEntryPath],
    env: {
      DATA_LAYER_URL: baseUrl,
      RDF_CACHE_URL: process.env.RDF_CACHE_URL || 'http://127.0.0.1:8181',
    },
    stderr: 'pipe',
  });

  const mcpClient = new Client({ name: 'crm-seed', version: '1.0.0' });
  console.log('Connecting to AnythingGraph MCP...');
  await mcpClient.connect(transport);

  const healthResult = await mcpClient.callTool({ name: 'health_check', arguments: {} });
  console.log('MCP health:', parseMcpToolJson(healthResult).ok ? 'ok' : healthResult);

  const rowIdsByEntity = {};

  console.log('Inserting CRM rows via create_entity_row...');
  rowIdsByEntity.crm_account = await seedEntityRows(
    mcpClient,
    entityIds.crm_account,
    'crm_account',
    buildAccountRows(ROW_COUNTS.crm_account),
  );
  rowIdsByEntity.crm_contact = await seedEntityRows(
    mcpClient,
    entityIds.crm_contact,
    'crm_contact',
    buildContactRows(ROW_COUNTS.crm_contact),
  );
  rowIdsByEntity.crm_lead = await seedEntityRows(
    mcpClient,
    entityIds.crm_lead,
    'crm_lead',
    buildLeadRows(ROW_COUNTS.crm_lead),
  );
  rowIdsByEntity.crm_opportunity = await seedEntityRows(
    mcpClient,
    entityIds.crm_opportunity,
    'crm_opportunity',
    buildOpportunityRows(ROW_COUNTS.crm_opportunity),
  );
  rowIdsByEntity.crm_invoice = await seedEntityRows(
    mcpClient,
    entityIds.crm_invoice,
    'crm_invoice',
    buildInvoiceRows(ROW_COUNTS.crm_invoice),
  );
  rowIdsByEntity.crm_purchase_order = await seedEntityRows(
    mcpClient,
    entityIds.crm_purchase_order,
    'crm_purchase_order',
    buildPurchaseOrderRows(ROW_COUNTS.crm_purchase_order),
  );
  rowIdsByEntity.crm_support_ticket = await seedEntityRows(
    mcpClient,
    entityIds.crm_support_ticket,
    'crm_support_ticket',
    buildSupportTicketRows(ROW_COUNTS.crm_support_ticket),
  );

  await seedRowRelationships(entityIds, rowIdsByEntity);

  console.log('Syncing RDF cache via MCP...');
  const syncResult = await mcpClient.callTool({ name: 'sync_rdf_cache', arguments: {} });
  console.log('sync_rdf_cache:', parseMcpToolJson(syncResult));

  await mcpClient.close();

  const entities = await sendJson('GET', '/entities');
  const schemaRels = await sendJson('GET', '/entity-relationships');
  const rowRels = await sendJson('GET', '/relationships');

  console.log('\n=== Seed complete ===');
  console.log('Entities:', entities.length);
  console.log('Schema relationships:', schemaRels.length);
  console.log('Row relationships:', rowRels.length);
  console.log('CRM rows inserted:', totalRows);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
