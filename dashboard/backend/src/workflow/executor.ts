import { dataLayerClient } from '../dataLayerClient.js';
import type { EntityDefinition, EntityRelationshipDefinition, EntityRowRecord } from '../types.js';
import { buildEntityRowIfMatched, scoreEntityCandidates } from './entityResolver.js';
import { normalizeBodyToRecords } from './recordUtils.js';
import { applyFieldMappingsToRecords, normalizeFieldMappings } from './fieldMapper.js';
import { normalizeValidationRules, validateRecordAgainstRules } from './fieldValidator.js';
import { planRelationshipLinks } from './relationshipResolver.js';
import type {
  EntitiesNodeData,
  FallbackNodeData,
  FallbackRecordResult,
  FieldMapperNodeData,
  RelationshipsNodeData,
  TriggerNodeData,
  ValidateNodeData,
  WorkflowExecutionResult,
  WorkflowGraph,
  WorkflowGraphEdge,
  WorkflowGraphNode,
  WorkflowNodeType,
  RecordEntityRows,
} from './types.js';

// Find the first node of a given type in the workflow graph.
function findFirstNodeByType(graph: WorkflowGraph, nodeType: WorkflowNodeType): WorkflowGraphNode | null {
  return graph.nodes.find((node) => node.type === nodeType) || null;
}

// Read the single entity id from an Entities node (supports legacy entityIds array).
function resolveEntityIdsFromEntitiesNode(entitiesData: EntitiesNodeData): number[] {
  const singleEntityId = entitiesData.entityId;
  if (singleEntityId !== undefined && singleEntityId !== null && Number.isFinite(singleEntityId)) {
    return [Number(singleEntityId)];
  }

  const legacyIds = (entitiesData.entityIds || []).filter((value) => Number.isFinite(value));
  if (legacyIds.length > 0) {
    return [Number(legacyIds[0])];
  }

  return [];
}

// Return outgoing edges from a node, optionally filtered by source handle.
function getOutgoingEdges(
  graph: WorkflowGraph,
  sourceNodeId: string,
  sourceHandle?: string,
): WorkflowGraphEdge[] {
  return graph.edges.filter((edge) => {
    if (edge.source !== sourceNodeId) {
      return false;
    }
    if (sourceHandle === undefined) {
      return true;
    }
    const edgeHandle = edge.sourceHandle || 'success';
    return edgeHandle === sourceHandle;
  });
}

// Walk workflow graph from trigger and execute each node in order.
export async function executeWorkflowGraph(options: {
  graph: WorkflowGraph;
  inputBody: unknown;
  dryRun: boolean;
}): Promise<WorkflowExecutionResult> {
  let records = normalizeBodyToRecords(options.inputBody);
  const nodeLogs: WorkflowExecutionResult['nodeLogs'] = [];
  const entityResults: WorkflowExecutionResult['entityResults'] = [];
  const relationshipResults: WorkflowExecutionResult['relationshipResults'] = [];
  const validationResults: WorkflowExecutionResult['validationResults'] = [];
  const fallbackRecords: FallbackRecordResult[] = [];

  const recordEntityRows: RecordEntityRows = {};
  const failedRecordIndexes = new Set<number>();
  const recordFailureReasons = new Map<number, string>();

  const triggerNode = findFirstNodeByType(options.graph, 'trigger');
  if (!triggerNode) {
    throw new Error('Workflow must include a Trigger node');
  }

  const triggerData = triggerNode.data as TriggerNodeData;
  nodeLogs.push({
    nodeId: triggerNode.id,
    nodeType: 'trigger',
    message: `Trigger (${triggerData.triggerType || 'manual'}) accepted ${records.length} record(s)`,
  });

  let currentNodeIds = getOutgoingEdges(options.graph, triggerNode.id).map((edge) => edge.target);
  const visitedNodeIds = new Set<string>();

  while (currentNodeIds.length > 0) {
    const nextNodeIds: string[] = [];

    for (const nodeId of currentNodeIds) {
      if (visitedNodeIds.has(nodeId)) {
        continue;
      }
      visitedNodeIds.add(nodeId);

      const workflowNode = options.graph.nodes.find((node) => node.id === nodeId);
      if (!workflowNode) {
        continue;
      }

      if (workflowNode.type === 'field_mapper') {
        const fieldMapperData = workflowNode.data as FieldMapperNodeData;
        const mappings = normalizeFieldMappings(fieldMapperData.mappings);
        const mappingResult = applyFieldMappingsToRecords(records, mappings);
        records = mappingResult.records;

        nodeLogs.push({
          nodeId: workflowNode.id,
          nodeType: 'field_mapper',
          message:
            mappings.length === 0
              ? 'Field Mapper has no rules; records passed through unchanged'
              : `Field Mapper applied ${mappingResult.appliedMappingCount} mapping(s) across ${records.length} record(s)`,
        });

        nextNodeIds.push(...getOutgoingEdges(options.graph, workflowNode.id).map((edge) => edge.target));
      } else if (workflowNode.type === 'validate') {
        const validateData = workflowNode.data as ValidateNodeData;
        const rules = normalizeValidationRules(validateData.rules);
        let passCount = 0;
        let failCount = 0;

        for (let recordIndex = 0; recordIndex < records.length; recordIndex += 1) {
          if (failedRecordIndexes.has(recordIndex)) {
            continue;
          }

          const validationOutcome = validateRecordAgainstRules(records[recordIndex], rules);
          validationResults.push({
            recordIndex,
            ok: validationOutcome.ok,
            failures: validationOutcome.failures,
            dryRun: options.dryRun,
          });

          if (validationOutcome.ok) {
            passCount += 1;
          } else {
            failCount += 1;
            failedRecordIndexes.add(recordIndex);
            recordFailureReasons.set(recordIndex, validationOutcome.summaryReason);
          }
        }

        nodeLogs.push({
          nodeId: workflowNode.id,
          nodeType: 'validate',
          message:
            rules.length === 0
              ? 'Validate node has no rules; all records passed through'
              : `Validate node: ${passCount} passed, ${failCount} failed (${rules.length} rule(s))`,
        });

        const successTargets = getOutgoingEdges(options.graph, workflowNode.id, 'success').map(
          (edge) => edge.target,
        );
        const failureTargets = getOutgoingEdges(options.graph, workflowNode.id, 'failure').map(
          (edge) => edge.target,
        );

        if (successTargets.length > 0) {
          nextNodeIds.push(...successTargets);
        }
        if (failureTargets.length > 0 && failCount > 0) {
          nextNodeIds.push(...failureTargets);
        } else if (successTargets.length === 0 && failureTargets.length === 0) {
          const defaultTargets = getOutgoingEdges(options.graph, workflowNode.id).map((edge) => edge.target);
          nextNodeIds.push(...defaultTargets);
        }
      } else if (workflowNode.type === 'entities') {
        const entitiesData = workflowNode.data as EntitiesNodeData;
        const entityIds = resolveEntityIdsFromEntitiesNode(entitiesData);
        const minMatchScore = Number(entitiesData.minMatchScore ?? 1);

        const entityDefinitions: EntityDefinition[] = [];
        for (const entityId of entityIds) {
          entityDefinitions.push(await dataLayerClient.getEntity(entityId));
        }

        let insertedCount = 0;

        for (let recordIndex = 0; recordIndex < records.length; recordIndex += 1) {
          if (failedRecordIndexes.has(recordIndex)) {
            continue;
          }

          const payloadObject = records[recordIndex];
          let recordMapped = false;

          const candidates = scoreEntityCandidates(entityDefinitions, payloadObject);
          for (const candidate of candidates) {
            const rowBuild = buildEntityRowIfMatched(candidate, payloadObject, minMatchScore);
            if (!rowBuild.ok) {
              continue;
            }

            recordMapped = true;
            let rowId: number | undefined;

            if (!options.dryRun) {
              const createdRow = await dataLayerClient.createEntityRow(candidate.entityId, rowBuild.rowValues);
              rowId = createdRow.id;
              insertedCount += 1;
            }

            if (!recordEntityRows[recordIndex]) {
              recordEntityRows[recordIndex] = {};
            }
            recordEntityRows[recordIndex][candidate.entityName] = {
              entityId: candidate.entityId,
              entityName: candidate.entityName,
              rowId: rowId || -1,
              values: rowBuild.rowValues,
            };

            entityResults.push({
              recordIndex,
              entityId: candidate.entityId,
              entityName: candidate.entityName,
              rowId,
              ok: true,
              matchScore: candidate.score,
              dryRun: options.dryRun,
            });
          }

          if (!recordMapped) {
            failedRecordIndexes.add(recordIndex);
            recordFailureReasons.set(recordIndex, 'entity_mapping_failed');
          }
        }

        nodeLogs.push({
          nodeId: workflowNode.id,
          nodeType: 'entities',
          message: `Entities node mapped ${entityResults.length} entity row(s); ${failedRecordIndexes.size} record(s) need fallback`,
        });

        const successTargets = getOutgoingEdges(options.graph, workflowNode.id, 'success').map(
          (edge) => edge.target,
        );
        const failureTargets = getOutgoingEdges(options.graph, workflowNode.id, 'failure').map(
          (edge) => edge.target,
        );

        if (successTargets.length > 0) {
          nextNodeIds.push(...successTargets);
        }
        if (failureTargets.length > 0 && failedRecordIndexes.size > 0) {
          nextNodeIds.push(...failureTargets);
        } else if (successTargets.length === 0 && failureTargets.length === 0) {
          const defaultTargets = getOutgoingEdges(options.graph, workflowNode.id).map((edge) => edge.target);
          nextNodeIds.push(...defaultTargets);
        }
      } else if (workflowNode.type === 'relationships') {
        const relationshipsData = workflowNode.data as RelationshipsNodeData;
        const entityRelationshipId = Number(relationshipsData.entityRelationshipId);
        const payloadLinkField = String(relationshipsData.payloadLinkField || '').trim();
        const objectEntityField = String(relationshipsData.objectEntityField || '').trim();

        if (!Number.isFinite(entityRelationshipId) || entityRelationshipId <= 0) {
          nodeLogs.push({
            nodeId: workflowNode.id,
            nodeType: 'relationships',
            message: 'Relationships node requires an entity relationship to be selected',
          });
        } else if (!payloadLinkField) {
          nodeLogs.push({
            nodeId: workflowNode.id,
            nodeType: 'relationships',
            message: 'Relationships node requires an incoming JSON field for object lookup',
          });
        } else if (!objectEntityField) {
          nodeLogs.push({
            nodeId: workflowNode.id,
            nodeType: 'relationships',
            message: 'Relationships node requires an object entity field for matching',
          });
        } else {
          const allDefinitions = await dataLayerClient.listEntityRelationships();
          const relationshipDefinition = allDefinitions.find(
            (definition) => definition.id === entityRelationshipId,
          );

          if (!relationshipDefinition) {
            nodeLogs.push({
              nodeId: workflowNode.id,
              nodeType: 'relationships',
              message: `Entity relationship id ${entityRelationshipId} not found`,
            });
          } else {
            const objectRowsCache = new Map<number, EntityRowRecord[]>();
            objectRowsCache.set(
              relationshipDefinition.object_entity_id,
              await dataLayerClient.listEntityRows(relationshipDefinition.object_entity_id),
            );

            const linkPlans = planRelationshipLinks({
              records,
              recordEntityRows,
              relationshipDefinition,
              payloadLinkField,
              objectEntityField,
              objectRowsCache,
            });

            let createdLinks = 0;
            for (const linkPlan of linkPlans) {
              let relationshipId: number | undefined;
              if (!options.dryRun) {
                const created = await dataLayerClient.createRelationship({
                  relationship_name: linkPlan.relationshipName,
                  subject_entity_id: linkPlan.subjectEntityId,
                  object_entity_id: linkPlan.objectEntityId,
                  subject_row_id: linkPlan.subjectRowId,
                  object_row_id: linkPlan.objectRowId,
                });
                relationshipId = created.id;
                createdLinks += 1;
              }

              relationshipResults.push({
                recordIndex: linkPlan.recordIndex,
                relationshipName: linkPlan.relationshipName,
                subjectEntityId: linkPlan.subjectEntityId,
                objectEntityId: linkPlan.objectEntityId,
                subjectRowId: linkPlan.subjectRowId,
                objectRowId: linkPlan.objectRowId,
                ok: true,
                relationshipId,
                dryRun: options.dryRun,
              });
            }

            nodeLogs.push({
              nodeId: workflowNode.id,
              nodeType: 'relationships',
              message: `Relationships (${relationshipDefinition.relationship_name}): ${payloadLinkField} → object.${objectEntityField}; planned ${linkPlans.length} link(s), created ${createdLinks}`,
            });
          }
        }

        nextNodeIds.push(...getOutgoingEdges(options.graph, workflowNode.id).map((edge) => edge.target));
      } else if (workflowNode.type === 'fallback') {
        const fallbackData = workflowNode.data as FallbackNodeData;
        const action =
          fallbackData.action === 'stop' ? 'stop' : 'landing_zone';

        for (const recordIndex of failedRecordIndexes) {
          fallbackRecords.push({
            recordIndex,
            reason: recordFailureReasons.get(recordIndex) || 'workflow_failed',
            payload: records[recordIndex],
          });
        }

        const actionLabel =
          action === 'landing_zone' ? 'send to landing zone' : 'stop (no landing zone write)';
        nodeLogs.push({
          nodeId: workflowNode.id,
          nodeType: 'fallback',
          message: `Fallback (${actionLabel}) captured ${fallbackRecords.length} record(s)`,
        });

        nextNodeIds.push(...getOutgoingEdges(options.graph, workflowNode.id).map((edge) => edge.target));
      }
    }

    currentNodeIds = [...new Set(nextNodeIds)];
  }

  return {
    ok: true,
    dryRun: options.dryRun,
    recordsProcessed: records.length,
    entitiesInserted: entityResults.filter((result) => result.ok && !options.dryRun).length,
    relationshipsCreated: relationshipResults.filter((result) => result.ok && !options.dryRun).length,
    validationFailedCount: validationResults.filter((result) => !result.ok).length,
    fallbackCount: fallbackRecords.length,
    entityResults,
    relationshipResults,
    validationResults,
    fallbackRecords,
    nodeLogs,
  };
}
