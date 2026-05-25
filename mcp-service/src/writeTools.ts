import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { dataLayerClient } from './dataLayerClient.js';
import { parseEntityFieldsJson, parseJsonObject } from './parseToolJson.js';
import { errorToolResult, jsonToolResult } from './toolResults.js';

// Register data-layer write MCP tools (entities, rows, schema and row relationships).
export function registerDataLayerWriteTools(server: McpServer): void {
  server.tool(
    'create_entity',
    'Create a record type (entity schema) with fields. Name must match ^[a-z][a-z0-9_]*$.',
    {
      name: z.string().describe('Entity name, e.g. crm_contact'),
      display_name: z.string().optional().describe('Human-readable label'),
      fields_json: z
        .string()
        .describe(
          'JSON array of fields, e.g. [{"field_name":"email","field_type":"TEXT","is_required":true}]',
        ),
    },
    async ({ name, display_name: displayName, fields_json: fieldsJson }) => {
      try {
        const fields = parseEntityFieldsJson(fieldsJson);
        return jsonToolResult(
          await dataLayerClient.createEntity({
            name: name.trim(),
            display_name: displayName?.trim() || undefined,
            fields,
          }),
        );
      } catch (error) {
        return errorToolResult(error instanceof Error ? error.message : String(error));
      }
    },
  );

  server.tool(
    'update_entity',
    'Update entity name, display name, and/or replace the field list.',
    {
      entity_id: z.number().describe('Entity id'),
      name: z.string().optional().describe('New entity name'),
      display_name: z.string().optional().describe('New display name'),
      fields_json: z
        .string()
        .optional()
        .describe('JSON array of fields (replaces all fields when provided)'),
    },
    async ({ entity_id: entityId, name, display_name: displayName, fields_json: fieldsJson }) => {
      try {
        const body: {
          name?: string;
          display_name?: string;
          fields?: ReturnType<typeof parseEntityFieldsJson>;
        } = {};

        if (name !== undefined && name.trim()) {
          body.name = name.trim();
        }
        if (displayName !== undefined) {
          body.display_name = displayName.trim();
        }
        if (fieldsJson !== undefined && fieldsJson.trim()) {
          body.fields = parseEntityFieldsJson(fieldsJson);
        }

        if (Object.keys(body).length === 0) {
          throw new Error('Provide at least one of name, display_name, or fields_json');
        }

        return jsonToolResult(await dataLayerClient.updateEntity(entityId, body));
      } catch (error) {
        return errorToolResult(error instanceof Error ? error.message : String(error));
      }
    },
  );

  server.tool(
    'delete_entity',
    'Delete a record type and all its rows and related relationship data.',
    { entity_id: z.number().describe('Entity id') },
    async ({ entity_id: entityId }) => {
      try {
        return jsonToolResult(await dataLayerClient.deleteEntity(entityId));
      } catch (error) {
        return errorToolResult(error instanceof Error ? error.message : String(error));
      }
    },
  );

  server.tool(
    'update_entity_row',
    'Update field values on an existing row.',
    {
      entity_id: z.number().describe('Entity id'),
      row_id: z.number().describe('Row id'),
      values_json: z.string().describe('JSON object of field values to store'),
    },
    async ({ entity_id: entityId, row_id: rowId, values_json: valuesJson }) => {
      try {
        const values = parseJsonObject(valuesJson, 'values_json');
        return jsonToolResult(await dataLayerClient.updateEntityRow(entityId, rowId, values));
      } catch (error) {
        return errorToolResult(error instanceof Error ? error.message : String(error));
      }
    },
  );

  server.tool(
    'delete_entity_row',
    'Delete one row and any row-level links that reference it.',
    {
      entity_id: z.number().describe('Entity id'),
      row_id: z.number().describe('Row id'),
    },
    async ({ entity_id: entityId, row_id: rowId }) => {
      try {
        return jsonToolResult(await dataLayerClient.deleteEntityRow(entityId, rowId));
      } catch (error) {
        return errorToolResult(error instanceof Error ? error.message : String(error));
      }
    },
  );

  server.tool(
    'get_entity_relationship',
    'Fetch one schema-level relationship between entity types by id.',
    { entity_relationship_id: z.number().describe('Entity relationship id') },
    async ({ entity_relationship_id: entityRelationshipId }) => {
      try {
        return jsonToolResult(await dataLayerClient.getEntityRelationship(entityRelationshipId));
      } catch (error) {
        return errorToolResult(error instanceof Error ? error.message : String(error));
      }
    },
  );

  server.tool(
    'create_entity_relationship',
    'Define a schema relationship between two entity types (required before row links).',
    {
      relationship_name: z.string().describe('Relationship name, e.g. employed_by'),
      subject_entity_id: z.number().describe('Subject entity id (source type)'),
      object_entity_id: z.number().describe('Object entity id (target type)'),
    },
    async ({
      relationship_name: relationshipName,
      subject_entity_id: subjectEntityId,
      object_entity_id: objectEntityId,
    }) => {
      try {
        return jsonToolResult(
          await dataLayerClient.createEntityRelationship({
            relationship_name: relationshipName.trim(),
            subject_entity_id: subjectEntityId,
            object_entity_id: objectEntityId,
          }),
        );
      } catch (error) {
        return errorToolResult(error instanceof Error ? error.message : String(error));
      }
    },
  );

  server.tool(
    'update_entity_relationship',
    'Update schema relationship name and/or subject/object entity ids.',
    {
      entity_relationship_id: z.number().describe('Entity relationship id'),
      relationship_name: z.string().optional(),
      subject_entity_id: z.number().optional(),
      object_entity_id: z.number().optional(),
    },
    async ({
      entity_relationship_id: entityRelationshipId,
      relationship_name: relationshipName,
      subject_entity_id: subjectEntityId,
      object_entity_id: objectEntityId,
    }) => {
      try {
        const body: {
          relationship_name?: string;
          subject_entity_id?: number;
          object_entity_id?: number;
        } = {};

        if (relationshipName !== undefined && relationshipName.trim()) {
          body.relationship_name = relationshipName.trim();
        }
        if (subjectEntityId !== undefined) {
          body.subject_entity_id = subjectEntityId;
        }
        if (objectEntityId !== undefined) {
          body.object_entity_id = objectEntityId;
        }

        if (Object.keys(body).length === 0) {
          throw new Error('Provide at least one field to update');
        }

        return jsonToolResult(
          await dataLayerClient.updateEntityRelationship(entityRelationshipId, body),
        );
      } catch (error) {
        return errorToolResult(error instanceof Error ? error.message : String(error));
      }
    },
  );

  server.tool(
    'delete_entity_relationship',
    'Delete a schema-level entity relationship definition.',
    { entity_relationship_id: z.number().describe('Entity relationship id') },
    async ({ entity_relationship_id: entityRelationshipId }) => {
      try {
        return jsonToolResult(await dataLayerClient.deleteEntityRelationship(entityRelationshipId));
      } catch (error) {
        return errorToolResult(error instanceof Error ? error.message : String(error));
      }
    },
  );

  server.tool(
    'create_row_relationship',
    'Link two rows using an existing schema relationship (same name and entity type pair).',
    {
      relationship_name: z.string().describe('Must match an entity relationship definition'),
      subject_entity_id: z.number().describe('Subject entity id'),
      object_entity_id: z.number().describe('Object entity id'),
      subject_row_id: z.number().describe('Subject row id'),
      object_row_id: z.number().describe('Object row id'),
    },
    async ({
      relationship_name: relationshipName,
      subject_entity_id: subjectEntityId,
      object_entity_id: objectEntityId,
      subject_row_id: subjectRowId,
      object_row_id: objectRowId,
    }) => {
      try {
        return jsonToolResult(
          await dataLayerClient.createRelationship({
            relationship_name: relationshipName.trim(),
            subject_entity_id: subjectEntityId,
            object_entity_id: objectEntityId,
            subject_row_id: subjectRowId,
            object_row_id: objectRowId,
          }),
        );
      } catch (error) {
        return errorToolResult(error instanceof Error ? error.message : String(error));
      }
    },
  );

  server.tool(
    'update_row_relationship',
    'Update an existing row-level link.',
    {
      relationship_id: z.number().describe('Row relationship id from list_row_relationships'),
      relationship_name: z.string().optional(),
      subject_entity_id: z.number().optional(),
      object_entity_id: z.number().optional(),
      subject_row_id: z.number().optional(),
      object_row_id: z.number().optional(),
    },
    async ({
      relationship_id: relationshipId,
      relationship_name: relationshipName,
      subject_entity_id: subjectEntityId,
      object_entity_id: objectEntityId,
      subject_row_id: subjectRowId,
      object_row_id: objectRowId,
    }) => {
      try {
        const body: {
          relationship_name?: string;
          subject_entity_id?: number;
          object_entity_id?: number;
          subject_row_id?: number;
          object_row_id?: number;
        } = {};

        if (relationshipName !== undefined && relationshipName.trim()) {
          body.relationship_name = relationshipName.trim();
        }
        if (subjectEntityId !== undefined) {
          body.subject_entity_id = subjectEntityId;
        }
        if (objectEntityId !== undefined) {
          body.object_entity_id = objectEntityId;
        }
        if (subjectRowId !== undefined) {
          body.subject_row_id = subjectRowId;
        }
        if (objectRowId !== undefined) {
          body.object_row_id = objectRowId;
        }

        if (Object.keys(body).length === 0) {
          throw new Error('Provide at least one field to update');
        }

        return jsonToolResult(await dataLayerClient.updateRelationship(relationshipId, body));
      } catch (error) {
        return errorToolResult(error instanceof Error ? error.message : String(error));
      }
    },
  );

  server.tool(
    'delete_row_relationship',
    'Delete one row-level relationship link.',
    { relationship_id: z.number().describe('Row relationship id') },
    async ({ relationship_id: relationshipId }) => {
      try {
        return jsonToolResult(await dataLayerClient.deleteRelationship(relationshipId));
      } catch (error) {
        return errorToolResult(error instanceof Error ? error.message : String(error));
      }
    },
  );
}
