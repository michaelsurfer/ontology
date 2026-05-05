import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  Switch,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import { useSearchParams, useNavigate } from 'react-router-dom'
import ReactFlow, {
  Background,
  Controls,
  Handle,
  Position,
  applyEdgeChanges,
  applyNodeChanges,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { apiClient } from '../api/apiClient'

const nodeTypes = {
  crmEntityNode: CrmEntityNode,
}

/* Visualize the schema relationships graph (classes + object properties). */
export function GraphPage() {
  const theme = useTheme()
  const [searchParams, setSearchParams] = useSearchParams()
  const focusRelationshipId = searchParams.get('focusRelationshipId')
  const [nodes, setNodes] = useState([])
  const [edges, setEdges] = useState([])
  const [selectedNodeId, setSelectedNodeId] = useState(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [reactFlowInstance, setReactFlowInstance] = useState(null)
  const lastAppliedFocusRelationshipIdRef = useRef(null)

  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingRelationshipId, setEditingRelationshipId] = useState(null)
  const [relationshipFormData, setRelationshipFormData] = useState(createEmptyRelationshipForm())
  const [showAdvancedFields, setShowAdvancedFields] = useState(false)

  const [baseIri, setBaseIri] = useState('http://example.com/context#')

  const [entities, setEntities] = useState([])

  const entityColumns = useMemo(() => {
    const map = new Map()
    for (const entity of entities) {
      map.set(entity.entity_name, entity.columns || ['id'])
    }
    return map
  }, [entities])

  /* Ignore selection if the node no longer exists (e.g. after graph reload). */
  const validSelectedNodeId = useMemo(() => {
    if (!selectedNodeId) {
      return null
    }
    const exists = nodes.some((node) => node.id === selectedNodeId)
    return exists ? selectedNodeId : null
  }, [selectedNodeId, nodes])

  /* Entity names linked by a primary relationship edge to the selected node. */
  const neighborIdsForSelection = useMemo(() => {
    if (!validSelectedNodeId) {
      return new Set()
    }
    const neighbors = new Set()
    for (const edge of edges) {
      if (edge.source === validSelectedNodeId) {
        neighbors.add(edge.target)
      }
      if (edge.target === validSelectedNodeId) {
        neighbors.add(edge.source)
      }
    }
    return neighbors
  }, [edges, validSelectedNodeId])

  /* Nodes with highlight metadata for the custom node renderer. */
  const nodesWithHighlight = useMemo(() => {
    return nodes.map((node) => {
      let highlightRole = null
      if (validSelectedNodeId) {
        if (node.id === validSelectedNodeId) {
          highlightRole = 'selected'
        } else if (neighborIdsForSelection.has(node.id)) {
          highlightRole = 'neighbor'
        }
      }
      return {
        ...node,
        data: {
          ...node.data,
          highlightRole,
        },
      }
    })
  }, [nodes, validSelectedNodeId, neighborIdsForSelection])

  /* Emphasize edges incident to the selected node (primary relationships). */
  const edgesWithHighlight = useMemo(() => {
    if (!validSelectedNodeId) {
      return edges
    }
    const defaultStroke = theme.palette.divider
    return edges.map((edge) => {
      const incident =
        edge.source === validSelectedNodeId || edge.target === validSelectedNodeId
      return {
        ...edge,
        style: {
          ...(edge.style || {}),
          stroke: incident ? theme.palette.primary.main : defaultStroke,
          strokeWidth: incident ? 3 : 1.5,
        },
        zIndex: incident ? 2 : 0,
      }
    })
  }, [edges, validSelectedNodeId, theme.palette.divider, theme.palette.primary.main])

  useEffect(() => {
    void loadGraph({ setNodes, setEdges, setErrorMessage, setIsLoading })
    void loadOntologySettings({ setBaseIri })
    void loadEntities({ setEntities })
  }, [])

  useEffect(() => {
    if (!focusRelationshipId) {
      lastAppliedFocusRelationshipIdRef.current = null
      return
    }

    if (lastAppliedFocusRelationshipIdRef.current === String(focusRelationshipId)) {
      return
    }

    if (!Array.isArray(nodes) || nodes.length === 0 || !Array.isArray(edges) || edges.length === 0) {
      return
    }

    const nextNodes = rearrangeNodesForFocusedRelationship({
      nodes,
      edges,
      focusRelationshipId,
    })

    if (!nextNodes) {
      return
    }

    lastAppliedFocusRelationshipIdRef.current = String(focusRelationshipId)
    setNodes(nextNodes)

    const nextSearchParams = new URLSearchParams(searchParams)
    nextSearchParams.delete('focusRelationshipId')
    setSearchParams(nextSearchParams, { replace: true })

    setTimeout(() => {
      if (reactFlowInstance && typeof reactFlowInstance.fitView === 'function') {
        reactFlowInstance.fitView({ padding: 0.2, duration: 450 })
      }
    }, 50)
  }, [focusRelationshipId, nodes, edges, reactFlowInstance, searchParams, setSearchParams])

  return (
    <Stack spacing={2}>
      <Box sx={{ display: 'flex', flexDirection: 'row', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
        <Typography variant="h5" sx={{ flexGrow: 1 }}>
          Context Map
        </Typography>
        <Button
          variant="text"
          color="inherit"
          onClick={() => {
            setNodes((previousNodes) => tidyLayoutNodes({ nodes: previousNodes, edges }))
            setTimeout(() => {
              if (reactFlowInstance && typeof reactFlowInstance.fitView === 'function') {
                reactFlowInstance.fitView({ padding: 0.2, duration: 450 })
              }
            }, 50)
          }}
          disabled={!Array.isArray(nodes) || nodes.length === 0}
        >
          Tidy layout
        </Button>
      </Box>
      <Typography variant="body2" color="text.secondary">
        This is a schema-level map: each node is a concept (table), and each edge is a connection you define.
      </Typography>

      {errorMessage ? <Typography color="error">{errorMessage}</Typography> : null}

      <Card variant="outlined">
        <CardContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Tip: drag a connection from one node to another to create a relationship. Click an edge to edit it. Click a
            node to highlight it and any directly related entities; click the background to clear. Click the same node
            again to deselect.
          </Typography>
          <Divider sx={{ mb: 2 }} />

          <Box sx={{ height: 560, width: '100%', borderRadius: 2, overflow: 'hidden' }}>
            <ReactFlow
              nodes={nodesWithHighlight}
              edges={edgesWithHighlight}
              nodeTypes={nodeTypes}
              fitView
              onInit={(instance) => setReactFlowInstance(instance)}
              onNodesChange={(changes) => setNodes((previousNodes) => applyNodeChanges(changes, previousNodes))}
              onEdgesChange={(changes) => setEdges((previousEdges) => applyEdgeChanges(changes, previousEdges))}
              onNodeClick={(event, node) => {
                event.stopPropagation()
                setSelectedNodeId((previous) => (previous === node.id ? null : node.id))
              }}
              onPaneClick={() => setSelectedNodeId(null)}
              onConnect={(connection) =>
                openCreateRelationshipDialogFromConnection({
                  connection,
                  baseIri,
                  entityColumns,
                  setEditingRelationshipId,
                  setRelationshipFormData,
                  setShowAdvancedFields,
                  setIsDialogOpen,
                })
              }
              onEdgeClick={(event, edge) => {
                event.preventDefault()
                openEditRelationshipDialogFromEdge({
                  edge,
                  setEditingRelationshipId,
                  setRelationshipFormData,
                  setShowAdvancedFields,
                  setIsDialogOpen,
                })
              }}
            >
              <Background />
              <Controls />
            </ReactFlow>
          </Box>
        </CardContent>
      </Card>

      <RelationshipDialog
        isOpen={isDialogOpen}
        isLoading={isLoading}
        baseIri={baseIri}
        entityColumns={entityColumns}
        entities={entities}
        showAdvancedFields={showAdvancedFields}
        setShowAdvancedFields={setShowAdvancedFields}
        editingRelationshipId={editingRelationshipId}
        formData={relationshipFormData}
        setFormData={setRelationshipFormData}
        onClose={() => setIsDialogOpen(false)}
        onSave={() =>
          void saveRelationshipAndReloadGraph({
            editingRelationshipId,
            formData: relationshipFormData,
            setErrorMessage,
            setIsLoading,
            setIsDialogOpen,
            setEditingRelationshipId,
            setShowAdvancedFields,
            setRelationshipFormData,
            setNodes,
            setEdges,
          })
        }
        onDelete={() =>
          void deleteRelationshipAndReloadGraph({
            editingRelationshipId,
            setErrorMessage,
            setIsLoading,
            setIsDialogOpen,
            setEditingRelationshipId,
            setShowAdvancedFields,
            setRelationshipFormData,
            setNodes,
            setEdges,
          })
        }
      />
    </Stack>
  )
}

/* Reposition nodes so a chosen relationship is centered. */
function rearrangeNodesForFocusedRelationship({ nodes, edges, focusRelationshipId }) {
  const relationshipIdText = String(focusRelationshipId || '').trim()
  if (!relationshipIdText) {
    return null
  }

  const focusEdge =
    edges.find((edge) => String(edge?.data?.relationship_id) === relationshipIdText) ||
    edges.find((edge) => String(edge?.id || '') === `rel-${relationshipIdText}`)

  if (!focusEdge) {
    return null
  }

  const sourceNodeId = String(focusEdge.source || '').trim()
  const targetNodeId = String(focusEdge.target || '').trim()
  if (!sourceNodeId || !targetNodeId) {
    return null
  }

  const centerX = 0
  const centerY = 0
  const focusHorizontalGap = 240
  const ringRadius = Math.max(420, 90 * nodes.length)

  const focusedIds = new Set([sourceNodeId, targetNodeId])
  const otherNodes = nodes.filter((node) => !focusedIds.has(node.id))

  const repositionedNodes = nodes.map((node) => {
    if (node.id === sourceNodeId) {
      return { ...node, position: { x: centerX - focusHorizontalGap, y: centerY } }
    }
    if (node.id === targetNodeId) {
      return { ...node, position: { x: centerX + focusHorizontalGap, y: centerY } }
    }
    return node
  })

  const total = otherNodes.length
  if (total === 0) {
    return repositionedNodes
  }

  const otherPositionsById = new Map()
  const angleStep = (Math.PI * 2) / total
  for (let index = 0; index < total; index += 1) {
    const node = otherNodes[index]
    const angle = -Math.PI / 2 + angleStep * index
    const x = centerX + Math.cos(angle) * ringRadius
    const y = centerY + Math.sin(angle) * ringRadius
    otherPositionsById.set(node.id, { x, y })
  }

  return repositionedNodes.map((node) => {
    const position = otherPositionsById.get(node.id)
    if (!position) {
      return node
    }
    return { ...node, position }
  })
}

/* Compute a simple non-overlapping layout for the current graph. */
function tidyLayoutNodes({ nodes, edges }) {
  const safeNodes = Array.isArray(nodes) ? nodes : []
  const safeEdges = Array.isArray(edges) ? edges : []

  const nodeById = new Map(safeNodes.map((node) => [node.id, node]))
  const degreesById = new Map(safeNodes.map((node) => [node.id, 0]))

  for (const edge of safeEdges) {
    const source = edge?.source
    const target = edge?.target
    if (!nodeById.has(source) || !nodeById.has(target)) {
      continue
    }
    degreesById.set(source, (degreesById.get(source) || 0) + 1)
    degreesById.set(target, (degreesById.get(target) || 0) + 1)
  }

  const adjacencyById = new Map(safeNodes.map((node) => [node.id, new Set()]))
  for (const edge of safeEdges) {
    const source = edge?.source
    const target = edge?.target
    if (!adjacencyById.has(source) || !adjacencyById.has(target)) {
      continue
    }
    adjacencyById.get(source).add(target)
    adjacencyById.get(target).add(source)
  }

  const visited = new Set()
  const components = []

  for (const node of safeNodes) {
    if (visited.has(node.id)) {
      continue
    }
    const queue = [node.id]
    visited.add(node.id)
    const componentIds = []

    while (queue.length > 0) {
      const id = queue.shift()
      componentIds.push(id)
      const neighbors = adjacencyById.get(id) || new Set()
      for (const neighborId of neighbors) {
        if (!visited.has(neighborId)) {
          visited.add(neighborId)
          queue.push(neighborId)
        }
      }
    }

    components.push(componentIds)
  }

  const horizontalGap = 320
  const verticalGap = 130
  const componentGapX = 520

  const positionsById = new Map()
  let componentOffsetX = 0

  for (const componentIds of components) {
    const rootId = componentIds
      .slice()
      .sort((a, b) => (degreesById.get(b) || 0) - (degreesById.get(a) || 0))[0]

    const levelById = new Map()
    const queue = [rootId]
    levelById.set(rootId, 0)

    while (queue.length > 0) {
      const currentId = queue.shift()
      const currentLevel = levelById.get(currentId) || 0
      const neighbors = Array.from(adjacencyById.get(currentId) || [])
      for (const neighborId of neighbors) {
        if (!componentIds.includes(neighborId)) {
          continue
        }
        if (!levelById.has(neighborId)) {
          levelById.set(neighborId, currentLevel + 1)
          queue.push(neighborId)
        }
      }
    }

    const nodesByLevel = new Map()
    for (const id of componentIds) {
      const level = levelById.has(id) ? levelById.get(id) : 0
      const list = nodesByLevel.get(level) || []
      list.push(id)
      nodesByLevel.set(level, list)
    }

    const levels = Array.from(nodesByLevel.keys()).sort((a, b) => a - b)
    let maxWidthLevels = 0

    for (const level of levels) {
      const idsInLevel = nodesByLevel.get(level) || []
      const sortedIdsInLevel = idsInLevel
        .slice()
        .sort((a, b) => String(a).localeCompare(String(b)))

      maxWidthLevels = Math.max(maxWidthLevels, sortedIdsInLevel.length)

      const startY = -((sortedIdsInLevel.length - 1) * verticalGap) / 2
      for (let index = 0; index < sortedIdsInLevel.length; index += 1) {
        const id = sortedIdsInLevel[index]
        positionsById.set(id, {
          x: componentOffsetX + level * horizontalGap,
          y: startY + index * verticalGap,
        })
      }
    }

    const componentWidth = Math.max(1, levels.length) * horizontalGap
    const componentExtra = maxWidthLevels > 2 ? (maxWidthLevels - 2) * 80 : 0
    componentOffsetX += componentWidth + componentExtra + componentGapX
  }

  return safeNodes.map((node) => {
    const position = positionsById.get(node.id)
    if (!position) {
      return node
    }
    return { ...node, position }
  })
}

/* Load the schema graph nodes and edges from the backend. */
async function loadGraph({ setNodes, setEdges, setErrorMessage, setIsLoading }) {
  setIsLoading(true)
  setErrorMessage('')
  try {
    const response = await apiClient.get('/graph/schema')
    const data = response.data || {}
    const loadedNodes = Array.isArray(data.nodes) ? data.nodes : []
    const loadedEdges = Array.isArray(data.edges) ? data.edges : []

    const nodesWithType = loadedNodes.map((node) => ({
      ...node,
      type: 'crmEntityNode',
    }))

    setEdges(loadedEdges)
    setNodes(tidyLayoutNodes({ nodes: nodesWithType, edges: loadedEdges }))
  } catch (error) {
    setErrorMessage(getErrorMessage(error))
  } finally {
    setIsLoading(false)
  }
}

/* Render an entity node with visible connection handles. */
function CrmEntityNode({ data }) {
  const navigate = useNavigate()
  const theme = useTheme()
  const highlightRole = data?.highlightRole

  const highlightStyles =
    highlightRole === 'selected'
      ? {
          border: `2px solid ${theme.palette.primary.main}`,
          bgcolor: alpha(theme.palette.primary.main, 0.12),
          boxShadow: theme.shadows[6],
        }
      : highlightRole === 'neighbor'
        ? {
            border: `2px solid ${theme.palette.info.main}`,
            bgcolor: alpha(theme.palette.info.main, 0.12),
            boxShadow: theme.shadows[3],
          }
        : {
            border: '1px solid',
            borderColor: 'divider',
            boxShadow: 1,
          }

  return (
    <Box
      sx={{
        px: 1.25,
        py: 1,
        bgcolor: highlightRole ? undefined : 'background.paper',
        borderRadius: 2,
        minWidth: 160,
        ...highlightStyles,
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        style={{
          width: 18,
          height: 18,
          borderRadius: 999,
          background: '#1976d2',
          border: '2px solid white',
        }}
      />
      <Handle
        type="source"
        position={Position.Right}
        style={{
          width: 18,
          height: 18,
          borderRadius: 999,
          background: '#1976d2',
          border: '2px solid white',
        }}
      />
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, alignItems: 'stretch' }}>
        <Typography
          variant="subtitle2"
          sx={{ fontWeight: 700, textAlign: 'center', lineHeight: 1.2 }}
        >
          {data?.label || 'Entity'}
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'row', justifyContent: 'center' }}>
          <Button
            size="small"
            variant="text"
            onClick={(event) => {
              event.stopPropagation()
              const entityName = data?.entity_name || data?.label
              if (entityName) {
                navigate(`/custom/${entityName}`)
              }
            }}
          >
            Open
          </Button>
        </Box>
      </Box>
    </Box>
  )
}

/* Load ontology settings (base IRI) to generate predicate IRIs. */
async function loadOntologySettings({ setBaseIri }) {
  try {
    const response = await apiClient.get('/ontology/settings')
    const baseIri = response.data?.base_iri
    if (typeof baseIri === 'string' && baseIri.trim()) {
      setBaseIri(baseIri.trim())
    }
  } catch (error) {
    // fall back to default base IRI
  }
}

/* Load all entities (builtin + custom) and their columns for relationship editing. */
async function loadEntities({ setEntities }) {
  try {
    const response = await apiClient.get('/entities')
    const data = Array.isArray(response.data) ? response.data : []
    setEntities(data)
  } catch (error) {
    setEntities([])
  }
}

/* Render a relationship create/edit dialog (link table is always created on the server). */
function RelationshipDialog({
  isOpen,
  isLoading,
  baseIri,
  entityColumns,
  entities,
  showAdvancedFields,
  setShowAdvancedFields,
  editingRelationshipId,
  formData,
  setFormData,
  onClose,
  onSave,
  onDelete,
}) {
  const entitiesForDropdown = Array.isArray(entities) ? entities : []
  const subjectColumns = entityColumns.get(formData.subject_entity) || ['id']
  const objectColumns = entityColumns.get(formData.object_entity) || ['id']
  const hasLinkTableInForm = Boolean(String(formData.junction_entity || '').trim())

  return (
    <Dialog open={isOpen} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>{editingRelationshipId ? 'Edit relationship' : 'Create relationship'}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
        <Typography variant="body2" color="text.secondary">
          A link table is created automatically for each relationship (two integer columns for the from/to row ids). Edit
          membership rows on the Relationships page. RDF and this graph use these links.
        </Typography>

        <TextField
          label="Relationship name"
          value={formData.relationship_name}
          onChange={(event) => {
            const nextName = event.target.value
            setFormData((previous) => ({
              ...previous,
              relationship_name: nextName,
              predicate_iri: previous.predicate_iri || buildPredicateIri(baseIri, nextName),
            }))
          }}
          placeholder='Example: "Account has Contact"'
          required
        />

        <Box sx={{ display: 'flex', flexDirection: 'row', gap: 2, flexWrap: 'wrap' }}>
          <TextField
            select
            label="From entity"
            value={formData.subject_entity}
            onChange={(event) => {
              const nextSubjectEntity = event.target.value
              const suggestions = suggestJoinColumns({
                subjectEntity: nextSubjectEntity,
                objectEntity: formData.object_entity,
                entityColumns,
              })
              setFormData((previous) => ({
                ...previous,
                subject_entity: nextSubjectEntity,
                subject_column: suggestions.subject_column,
                object_column: suggestions.object_column,
              }))
            }}
            sx={{ flex: '1 1 260px' }}
          >
            <MenuItem value="">
              <em>Select entity</em>
            </MenuItem>
            {entitiesForDropdown.map((entity) => (
              <MenuItem key={entity.entity_name} value={entity.entity_name}>
                {entity.display_name}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            label="To entity"
            value={formData.object_entity}
            onChange={(event) => {
              const nextObjectEntity = event.target.value
              const suggestions = suggestJoinColumns({
                subjectEntity: formData.subject_entity,
                objectEntity: nextObjectEntity,
                entityColumns,
              })

              setFormData((previous) => ({
                ...previous,
                object_entity: nextObjectEntity,
                subject_column: suggestions.subject_column,
                object_column: suggestions.object_column,
              }))
            }}
            sx={{ flex: '1 1 260px' }}
          >
            <MenuItem value="">
              <em>Select entity</em>
            </MenuItem>
            {entitiesForDropdown.map((entity) => (
              <MenuItem key={entity.entity_name} value={entity.entity_name}>
                {entity.display_name}
              </MenuItem>
            ))}
          </TextField>
        </Box>

        <Typography variant="subtitle2">Join keys</Typography>
        <Box sx={{ display: 'flex', flexDirection: 'row', gap: 2, flexWrap: 'wrap' }}>
          <TextField
            select
            label={`From column (${formData.subject_entity || 'subject'})`}
            value={formData.subject_column}
            onChange={(event) => setFormData((previous) => ({ ...previous, subject_column: event.target.value }))}
            sx={{ flex: '1 1 260px' }}
            disabled={!formData.subject_entity}
          >
            {subjectColumns.map((columnName) => (
              <MenuItem key={columnName} value={columnName}>
                {columnName}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label={`To column (${formData.object_entity || 'object'})`}
            value={formData.object_column}
            onChange={(event) => setFormData((previous) => ({ ...previous, object_column: event.target.value }))}
            sx={{ flex: '1 1 260px' }}
            disabled={!formData.object_entity}
          >
            {objectColumns.map((columnName) => (
              <MenuItem key={columnName} value={columnName}>
                {columnName}
              </MenuItem>
            ))}
          </TextField>
        </Box>

        <Typography variant="body2" color="text.secondary">
          Link table columns store values that match <b>{formData.subject_entity || 'from'}</b>.
          {formData.subject_column || 'id'} and <b>{formData.object_entity || 'to'}</b>.
          {formData.object_column || 'id'}.
        </Typography>

        {hasLinkTableInForm ? (
          <Typography variant="body2">
            Link table: <b>{formData.junction_entity}</b> — <b>{formData.junction_subject_column}</b>,{' '}
            <b>{formData.junction_object_column}</b>. Add rows from Relationships (link icon).
          </Typography>
        ) : (
          <Typography variant="body2" color="text.secondary">
            {editingRelationshipId
              ? 'Saving creates a link table if this edge did not have one yet.'
              : 'Saving creates a link table from the relationship name and entities (hidden from Objects).'}
          </Typography>
        )}

        <FormControlLabel
          control={<Switch checked={showAdvancedFields} onChange={(event) => setShowAdvancedFields(event.target.checked)} />}
          label="Show advanced fields"
        />

        {showAdvancedFields ? (
          <TextField
            label="Predicate IRI (ObjectProperty)"
            value={formData.predicate_iri}
            onChange={(event) => setFormData((previous) => ({ ...previous, predicate_iri: event.target.value }))}
            helperText={`Usually generated from Base IRI (${baseIri})`}
            required
          />
        ) : null}
      </DialogContent>
      <DialogActions>
        {editingRelationshipId ? (
          <Button
            color="error"
            onClick={onDelete}
            disabled={isLoading}
            sx={{ mr: 'auto' }}
          >
            Delete
          </Button>
        ) : null}
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
        <Button
          onClick={onSave}
          variant="contained"
          disabled={isLoading || !canSaveRelationshipForm(formData)}
        >
          Save relationship
        </Button>
      </DialogActions>
    </Dialog>
  )
}

/* Default relationship form state. */
function createEmptyRelationshipForm() {
  return {
    relationship_name: '',
    subject_entity: '',
    subject_column: 'id',
    predicate_iri: '',
    object_entity: '',
    object_column: 'id',
    junction_entity: '',
    junction_subject_column: '',
    junction_object_column: '',
  }
}

/* Open create dialog based on a newly created graph connection. */
function openCreateRelationshipDialogFromConnection({
  connection,
  baseIri,
  entityColumns,
  setEditingRelationshipId,
  setRelationshipFormData,
  setShowAdvancedFields,
  setIsDialogOpen,
}) {
  const subjectEntity = String(connection.source || '').trim()
  const objectEntity = String(connection.target || '').trim()

  const suggestions = suggestJoinColumns({ subjectEntity, objectEntity, entityColumns })
  const relationshipName = suggestRelationshipName({ subjectEntity, objectEntity })
  const predicateIri = buildPredicateIri(baseIri, relationshipName)

  setEditingRelationshipId(null)
  setShowAdvancedFields(false)
  setRelationshipFormData({
    relationship_name: relationshipName,
    subject_entity: subjectEntity || '',
    subject_column: suggestions.subject_column,
    predicate_iri: predicateIri,
    object_entity: objectEntity || '',
    object_column: suggestions.object_column,
    junction_entity: '',
    junction_subject_column: '',
    junction_object_column: '',
  })
  setIsDialogOpen(true)
}

/* Open edit dialog when the user clicks an existing edge. */
function openEditRelationshipDialogFromEdge({
  edge,
  setEditingRelationshipId,
  setRelationshipFormData,
  setShowAdvancedFields,
  setIsDialogOpen,
}) {
  const relationshipId = edge?.data?.relationship_id || parseRelationshipIdFromEdgeId(edge?.id)
  setEditingRelationshipId(relationshipId || null)
  setShowAdvancedFields(true)

  setRelationshipFormData({
    relationship_name: edge?.data?.relationship_name || edge?.label || '',
    subject_entity: edge?.data?.subject_entity || edge?.source || '',
    subject_column: edge?.data?.subject_column || 'id',
    predicate_iri: edge?.data?.predicate_iri || '',
    object_entity: edge?.data?.object_entity || edge?.target || '',
    object_column: edge?.data?.object_column || 'id',
    junction_entity: edge?.data?.junction_entity || '',
    junction_subject_column: edge?.data?.junction_subject_column || '',
    junction_object_column: edge?.data?.junction_object_column || '',
  })

  setIsDialogOpen(true)
}

/* Persist relationship and reload graph from backend. */
async function saveRelationshipAndReloadGraph({
  editingRelationshipId,
  formData,
  setErrorMessage,
  setIsLoading,
  setIsDialogOpen,
  setEditingRelationshipId,
  setShowAdvancedFields,
  setRelationshipFormData,
  setNodes,
  setEdges,
}) {
  setIsLoading(true)
  setErrorMessage('')
  try {
    const payload = normalizeRelationshipPayload(formData)

    if (editingRelationshipId) {
      await apiClient.put(`/relationships/${editingRelationshipId}`, payload)
    } else {
      await apiClient.post('/relationships', payload)
    }

    setIsDialogOpen(false)
    setEditingRelationshipId(null)
    setShowAdvancedFields(false)
    setRelationshipFormData(createEmptyRelationshipForm())

    await loadGraph({ setNodes, setEdges, setErrorMessage, setIsLoading })
  } catch (error) {
    setErrorMessage(getErrorMessage(error))
  } finally {
    setIsLoading(false)
  }
}

/* Delete a relationship and reload graph from backend. */
async function deleteRelationshipAndReloadGraph({
  editingRelationshipId,
  setErrorMessage,
  setIsLoading,
  setIsDialogOpen,
  setEditingRelationshipId,
  setShowAdvancedFields,
  setRelationshipFormData,
  setNodes,
  setEdges,
}) {
  if (!editingRelationshipId) {
    return
  }

  const shouldDelete = window.confirm(
    'Delete this relationship? This will remove the edge and affect RDF exports and SPARQL results.',
  )
  if (!shouldDelete) {
    return
  }

  setIsLoading(true)
  setErrorMessage('')
  try {
    await apiClient.delete(`/relationships/${editingRelationshipId}`)

    setIsDialogOpen(false)
    setEditingRelationshipId(null)
    setShowAdvancedFields(false)
    setRelationshipFormData(createEmptyRelationshipForm())

    await loadGraph({ setNodes, setEdges, setErrorMessage, setIsLoading })
  } catch (error) {
    setErrorMessage(getErrorMessage(error))
  } finally {
    setIsLoading(false)
  }
}

/* Normalize relationship data before sending to backend (link table is server-managed). */
function normalizeRelationshipPayload(formData) {
  const safeFormData = formData && typeof formData === 'object' ? formData : {}
  return {
    relationship_name: String(safeFormData.relationship_name || '').trim(),
    subject_entity: String(safeFormData.subject_entity || '').trim(),
    subject_column: String(safeFormData.subject_column || '').trim(),
    predicate_iri: String(safeFormData.predicate_iri || '').trim(),
    object_entity: String(safeFormData.object_entity || '').trim(),
    object_column: String(safeFormData.object_column || '').trim(),
  }
}

/* Whether the relationship dialog has enough information to save. */
function canSaveRelationshipForm(formData) {
  const safeFormData = formData && typeof formData === 'object' ? formData : {}
  return Boolean(
    String(safeFormData.relationship_name || '').trim() &&
      String(safeFormData.subject_entity || '').trim() &&
      String(safeFormData.object_entity || '').trim() &&
      String(safeFormData.subject_column || '').trim() &&
      String(safeFormData.object_column || '').trim() &&
      String(safeFormData.predicate_iri || '').trim(),
  )
}

/* Suggest join keys based on common CRM FK patterns. */
function suggestJoinColumns({ subjectEntity, objectEntity, entityColumns }) {
  const subjectColumns = entityColumns.get(subjectEntity) || ['id']
  const objectColumns = entityColumns.get(objectEntity) || ['id']

  const subjectSingular = singularizeEntityName(subjectEntity)
  const objectSingular = singularizeEntityName(objectEntity)

  const objectFkToSubject = `${subjectSingular}_id`
  if (objectColumns.includes(objectFkToSubject)) {
    return { subject_column: 'id', object_column: objectFkToSubject }
  }

  const subjectFkToObject = `${objectSingular}_id`
  if (subjectColumns.includes(subjectFkToObject)) {
    return { subject_column: subjectFkToObject, object_column: 'id' }
  }

  return { subject_column: 'id', object_column: 'id' }
}

/* Suggest a human-friendly relationship name based on source and target. */
function suggestRelationshipName({ subjectEntity, objectEntity }) {
  const targetName = titleCase(singularizeEntityName(objectEntity))
  return `${titleCase(singularizeEntityName(subjectEntity))} has ${targetName}`
}

/* Build a predicate IRI from a base IRI and a relationship name. */
function buildPredicateIri(baseIri, relationshipName) {
  const safeBaseIri = String(baseIri || '').trim() || 'http://example.com/context#'
  const localName = toCamelCase(String(relationshipName || '').trim() || 'hasRelationship')
  return `${safeBaseIri}${localName}`
}

/* Convert an edge id like rel-12 into numeric id. */
function parseRelationshipIdFromEdgeId(edgeId) {
  const match = String(edgeId || '').match(/^rel-(\d+)$/)
  return match ? Number(match[1]) : null
}

/* Convert an entity name like opportunities into opportunity. */
function singularizeEntityName(entityName) {
  const name = String(entityName || '').trim()
  if (name.endsWith('ies')) {
    return `${name.slice(0, -3)}y`
  }
  if (name.endsWith('s')) {
    return name.slice(0, -1)
  }
  return name
}

/* Convert a phrase into camelCase for predicate local names. */
function toCamelCase(value) {
  const words = String(value || '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(/\s+/g)
    .filter(Boolean)

  if (words.length === 0) {
    return 'hasRelationship'
  }

  return (
    words[0].toLowerCase() +
    words
      .slice(1)
      .map((word) => word.slice(0, 1).toUpperCase() + word.slice(1).toLowerCase())
      .join('')
  )
}

/* Title-case a word for labels. */
function titleCase(value) {
  const safeValue = String(value || '')
  return safeValue ? safeValue.slice(0, 1).toUpperCase() + safeValue.slice(1) : safeValue
}

/* Convert an Axios error into a readable string. */
function getErrorMessage(error) {
  if (error && typeof error === 'object') {
    const response = error.response
    if (response && response.data && typeof response.data === 'object' && response.data.error) {
      return String(response.data.error)
    }
    if (error.message) {
      return String(error.message)
    }
  }
  return 'Request failed'
}

