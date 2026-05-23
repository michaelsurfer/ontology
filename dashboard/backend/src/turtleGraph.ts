import { Parser } from 'n3';
import type { EntitySummary, GraphEdge, GraphNode, GraphViewModel } from './types.js';

const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
const OWL_CLASS = 'http://www.w3.org/2002/07/owl#Class';
const OWL_OBJECT_PROPERTY = 'http://www.w3.org/2002/07/owl#ObjectProperty';
const RDFS_DOMAIN = 'http://www.w3.org/2000/01/rdf-schema#domain';
const RDFS_RANGE = 'http://www.w3.org/2000/01/rdf-schema#range';

// Shorten an IRI for graph node labels.
function shortLabel(iri: string): string {
  const trimmed = iri.trim();
  if (trimmed.startsWith('<') && trimmed.endsWith('>')) {
    return shortLabel(trimmed.slice(1, -1));
  }
  const hashIndex = trimmed.lastIndexOf('#');
  const slashIndex = trimmed.lastIndexOf('/');
  const markerIndex = Math.max(hashIndex, slashIndex);
  if (markerIndex >= 0 && markerIndex < trimmed.length - 1) {
    return trimmed.slice(markerIndex + 1);
  }
  return trimmed;
}

// Build a React Flow friendly graph from Turtle text.
export function buildGraphFromTurtle(turtleText: string): GraphViewModel {
  const parser = new Parser();
  const quadList = parser.parse(turtleText);

  const nodeMap = new Map<string, GraphNode>();
  const edgeList: GraphEdge[] = [];
  const classNodes = new Set<string>();
  const instanceNodes = new Set<string>();
  const propertyNodes = new Set<string>();

  const ensureNode = (nodeId: string, label: string, kind: GraphNode['kind']) => {
    if (!nodeMap.has(nodeId)) {
      nodeMap.set(nodeId, { id: nodeId, label, kind });
    }
  };

  const addEdge = (source: string, target: string, labelText: string) => {
    if (source === target) {
      return;
    }
    const edgeId = `${source}::${labelText}::${target}`;
    if (edgeList.some((edge) => edge.id === edgeId)) {
      return;
    }
    edgeList.push({
      id: edgeId,
      source,
      target,
      label: labelText,
    });
  };

  for (const quad of quadList) {
    const subject = quad.subject.value;
    const predicate = quad.predicate.value;
    const objectValue =
      quad.object.termType === 'Literal' ? quad.object.value : quad.object.value;

    if (predicate === RDF_TYPE && objectValue === OWL_CLASS) {
      classNodes.add(subject);
      ensureNode(subject, shortLabel(subject), 'class');
      continue;
    }

    if (predicate === RDF_TYPE && objectValue !== OWL_CLASS && objectValue !== OWL_OBJECT_PROPERTY) {
      instanceNodes.add(subject);
      if (classNodes.has(objectValue) || objectValue.includes('#') || objectValue.includes('/')) {
        ensureNode(objectValue, shortLabel(objectValue), 'class');
      }
      continue;
    }

    if (predicate === RDF_TYPE && objectValue === OWL_OBJECT_PROPERTY) {
      propertyNodes.add(subject);
      ensureNode(subject, shortLabel(subject), 'property');
      continue;
    }

    if (predicate === RDFS_DOMAIN || predicate === RDFS_RANGE) {
      if (propertyNodes.has(subject)) {
        ensureNode(subject, shortLabel(subject), 'property');
        ensureNode(objectValue, shortLabel(objectValue), 'class');
        addEdge(
          subject,
          objectValue,
          predicate === RDFS_DOMAIN ? 'domain' : 'range',
        );
      }
      continue;
    }

    if (quad.object.termType === 'NamedNode') {
      const subjectKind = classNodes.has(subject)
        ? 'class'
        : propertyNodes.has(subject)
          ? 'property'
          : 'instance';
      const objectKind = classNodes.has(objectValue)
        ? 'class'
        : propertyNodes.has(objectValue)
          ? 'property'
          : 'instance';

      if (subjectKind === 'instance' || objectKind === 'instance') {
        continue;
      }

      ensureNode(subject, shortLabel(subject), subjectKind);
      ensureNode(objectValue, shortLabel(objectValue), objectKind);
      addEdge(subject, objectValue, shortLabel(predicate));
    }
  }

  const schemaNodes = Array.from(nodeMap.values()).filter((node) => node.kind !== 'instance');
  const schemaNodeIds = new Set(schemaNodes.map((node) => node.id));
  const schemaEdges = edgeList.filter(
    (edge) => schemaNodeIds.has(edge.source) && schemaNodeIds.has(edge.target),
  );

  return {
    nodes: schemaNodes,
    edges: schemaEdges,
  };
}

// Convert snake_case entity names to PascalCase (matches data-layer Turtle export).
function toPascalCase(snakeCaseName: string): string {
  const parts = snakeCaseName.split('_').filter((segment) => segment.length > 0);
  if (parts.length === 0) {
    return 'Entity';
  }
  return parts
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join('');
}

// Attach entity ids to class nodes using PascalCase labels from Turtle class IRIs.
export function attachEntityIdsToClassNodes(
  graph: GraphViewModel,
  entities: EntitySummary[],
): GraphViewModel {
  const entityIdByClassLabel = new Map<string, number>();
  for (const entity of entities) {
    entityIdByClassLabel.set(toPascalCase(entity.name), entity.id);
  }

  return {
    ...graph,
    nodes: graph.nodes.map((node) => {
      if (node.kind !== 'class') {
        return node;
      }
      const entityId = entityIdByClassLabel.get(node.label);
      if (!entityId) {
        return node;
      }
      return { ...node, entityId };
    }),
  };
}
