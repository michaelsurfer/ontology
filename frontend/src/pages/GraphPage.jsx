import React, { useEffect, useMemo, useState } from 'react'
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
import { useNavigate } from 'react-router-dom'
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
  const [nodes, setNodes] = useState([])
  const [edges, setEdges] = useState([])
  const [errorMessage, setErrorMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingRelationshipId, setEditingRelationshipId] = useState(null)
  const [relationshipFormData, setRelationshipFormData] = useState(createEmptyRelationshipForm())
  const [showAdvancedFields, setShowAdvancedFields] = useState(false)

  const [baseIri, setBaseIri] = useState('http://example.com/ontology#')

  const [entities, setEntities] = useState([])

  const entityColumns = useMemo(() => {
    const map = new Map()
    for (const entity of entities) {
      map.set(entity.entity_name, entity.columns || ['id'])
    }
    return map
  }, [entities])

  useEffect(() => {
    void loadGraph({ setNodes, setEdges, setErrorMessage, setIsLoading })
    void loadOntologySettings({ setBaseIri })
    void loadEntities({ setEntities })
  }, [])

  return (
    <Stack spacing={2}>
      <Typography variant="h5">Relationship Graph</Typography>
      <Typography variant="body2" color="text.secondary">
        This graph is schema-level: each node is a CRM table mapped to an OWL Class, and each edge
        is a user-defined relationship mapped to an OWL ObjectProperty.
      </Typography>

      {errorMessage ? <Typography color="error">{errorMessage}</Typography> : null}

      <Card variant="outlined">
        <CardContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Tip: drag a connection from one node to another to create a relationship. Click an edge to edit it.
          </Typography>
          <Divider sx={{ mb: 2 }} />

          <Box sx={{ height: 560, width: '100%', borderRadius: 2, overflow: 'hidden' }}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              fitView
              onNodesChange={(changes) => setNodes((previousNodes) => applyNodeChanges(changes, previousNodes))}
              onEdgesChange={(changes) => setEdges((previousEdges) => applyEdgeChanges(changes, previousEdges))}
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

/* Load the schema graph nodes and edges from the backend. */
async function loadGraph({ setNodes, setEdges, setErrorMessage, setIsLoading }) {
  setIsLoading(true)
  setErrorMessage('')
  try {
    const response = await apiClient.get('/graph/schema')
    const data = response.data || {}
    const loadedNodes = Array.isArray(data.nodes) ? data.nodes : []
    setNodes(
      loadedNodes.map((node) => ({
        ...node,
        type: 'crmEntityNode',
      })),
    )
    setEdges(Array.isArray(data.edges) ? data.edges : [])
  } catch (error) {
    setErrorMessage(getErrorMessage(error))
  } finally {
    setIsLoading(false)
  }
}

/* Render an entity node with visible connection handles. */
function CrmEntityNode({ data }) {
  const navigate = useNavigate()

  return (
    <Box
      sx={{
        px: 1.25,
        py: 1,
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        minWidth: 160,
        boxShadow: 1,
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
      <Box sx={{ display: 'flex', flexDirection: 'row', gap: 1, alignItems: 'center' }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, flexGrow: 1 }}>
          {data?.label || 'Entity'}
        </Typography>
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

/* Render a relationship create/edit dialog. */
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

  return (
    <Dialog open={isOpen} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>{editingRelationshipId ? 'Edit relationship' : 'Create relationship'}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Define a relationship between two CRM entities. We will use your join keys to generate RDF links and an OWL ObjectProperty.
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
            label={`From column (${formData.subject_entity})`}
            value={formData.subject_column}
            onChange={(event) => setFormData((previous) => ({ ...previous, subject_column: event.target.value }))}
            sx={{ flex: '1 1 260px' }}
          >
            {subjectColumns.map((columnName) => (
              <MenuItem key={columnName} value={columnName}>
                {columnName}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label={`To column (${formData.object_entity})`}
            value={formData.object_column}
            onChange={(event) => setFormData((previous) => ({ ...previous, object_column: event.target.value }))}
            sx={{ flex: '1 1 260px' }}
          >
            {objectColumns.map((columnName) => (
              <MenuItem key={columnName} value={columnName}>
                {columnName}
              </MenuItem>
            ))}
          </TextField>
        </Box>

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
        <Button onClick={onSave} variant="contained" disabled={isLoading}>
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
    subject_entity: 'accounts',
    subject_column: 'id',
    predicate_iri: '',
    object_entity: 'contacts',
    object_column: 'account_id',
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
    subject_entity: subjectEntity || 'accounts',
    subject_column: suggestions.subject_column,
    predicate_iri: predicateIri,
    object_entity: objectEntity || 'contacts',
    object_column: suggestions.object_column,
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
    subject_entity: edge?.data?.subject_entity || edge?.source || 'accounts',
    subject_column: edge?.data?.subject_column || 'id',
    predicate_iri: edge?.data?.predicate_iri || '',
    object_entity: edge?.data?.object_entity || edge?.target || 'contacts',
    object_column: edge?.data?.object_column || 'id',
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

/* Normalize relationship data before sending to backend. */
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
  const safeBaseIri = String(baseIri || '').trim() || 'http://example.com/ontology#'
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

