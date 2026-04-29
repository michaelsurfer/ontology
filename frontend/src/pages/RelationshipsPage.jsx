import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
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
  IconButton,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import VisibilityIcon from '@mui/icons-material/Visibility'
import { apiClient } from '../api/apiClient'

/* Render UI to define and manage cross-table relationships (object properties). */
export function RelationshipsPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [relationships, setRelationships] = useState([])
  const [entities, setEntities] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingRelationship, setEditingRelationship] = useState(null)
  const [formData, setFormData] = useState(createEmptyRelationshipForm())
  const [hasAutoOpenedFromUrl, setHasAutoOpenedFromUrl] = useState(false)

  const editRelationshipIdFromUrl = searchParams.get('edit')

  const entityColumns = useMemo(() => {
    const map = new Map()
    for (const entity of entities) {
      map.set(entity.entity_name, entity.columns || ['id'])
    }
    return map
  }, [entities])

  useEffect(() => {
    void loadRelationships({ setRelationships, setIsLoading, setErrorMessage })
    void loadEntities({ setEntities, setErrorMessage })
  }, [])

  useEffect(() => {
    if (!editRelationshipIdFromUrl || hasAutoOpenedFromUrl) {
      return
    }

    if (!Array.isArray(relationships) || relationships.length === 0) {
      return
    }

    const relationshipToEdit = relationships.find(
      (relationship) => String(relationship.id) === String(editRelationshipIdFromUrl),
    )

    if (!relationshipToEdit) {
      return
    }

    openEditDialog({
      relationship: relationshipToEdit,
      setEditingRelationship,
      setFormData,
      setIsDialogOpen,
    })
    setHasAutoOpenedFromUrl(true)

    const nextSearchParams = new URLSearchParams(searchParams)
    nextSearchParams.delete('edit')
    setSearchParams(nextSearchParams, { replace: true })
  }, [
    editRelationshipIdFromUrl,
    hasAutoOpenedFromUrl,
    relationships,
    searchParams,
    setSearchParams,
    setEditingRelationship,
    setFormData,
    setIsDialogOpen,
  ])

  return (
    <Stack spacing={2}>
      <Box sx={{ display: 'flex', flexDirection: 'row', gap: 2, alignItems: 'center' }}>
        <Typography variant="h5" sx={{ flexGrow: 1 }}>
          Relationships
        </Typography>
        <Button
          variant="text"
          color="error"
          disabled={isLoading || relationships.length === 0}
          startIcon={<DeleteIcon />}
          onClick={() =>
            void deleteAllRelationshipsAndReload({
              setIsLoading,
              setErrorMessage,
              setRelationships,
            })
          }
        >
          Clear all
        </Button>
        <Button
          variant="contained"
          onClick={() =>
            openCreateDialog({
              setEditingRelationship,
              setFormData,
              setIsDialogOpen,
            })
          }
        >
          Add relationship
        </Button>
      </Box>

      <Card variant="outlined">
        <CardContent>
          <Typography variant="body2" color="text.secondary">
            A relationship is a join rule: subject (table.column) → predicate IRI → object
            (table.column). It becomes an OWL ObjectProperty and is also used to create RDF links
            between rows.
          </Typography>

          <Divider sx={{ my: 2 }} />

          {errorMessage ? <Typography color="error">{errorMessage}</Typography> : null}

          <Box sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>ID</TableCell>
                  <TableCell>Name</TableCell>
                  <TableCell>Subject</TableCell>
                  <TableCell>Object</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {relationships.map((relationship) => (
                  <TableRow key={relationship.id} hover>
                    <TableCell>{relationship.id}</TableCell>
                    <TableCell>{relationship.relationship_name}</TableCell>
                    <TableCell>
                      {relationship.subject_entity}.{relationship.subject_column}
                    </TableCell>
                    <TableCell>
                      {relationship.object_entity}.{relationship.object_column}
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1}>
                        <IconButton
                          size="small"
                          onClick={() => {
                            navigate(`/graph?focusRelationshipId=${encodeURIComponent(String(relationship.id))}`)
                          }}
                        >
                          <VisibilityIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() =>
                            openEditDialog({
                              relationship,
                              setEditingRelationship,
                              setFormData,
                              setIsDialogOpen,
                            })
                          }
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() =>
                            void deleteRelationshipAndReload({
                              relationshipId: relationship.id,
                              setIsLoading,
                              setErrorMessage,
                              setRelationships,
                            })
                          }
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
                {relationships.length === 0 && !isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5}>
                      <Typography variant="body2" color="text.secondary">
                        No relationships yet.
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </Box>
        </CardContent>
      </Card>

      <RelationshipDialog
        isOpen={isDialogOpen}
        editingRelationship={editingRelationship}
        formData={formData}
        setFormData={setFormData}
        entityColumns={entityColumns}
        onClose={() => setIsDialogOpen(false)}
        onSave={() =>
          void saveRelationshipAndReload({
            editingRelationship,
            formData,
            setIsLoading,
            setErrorMessage,
            setRelationships,
            setIsDialogOpen,
            setEditingRelationship,
          })
        }
      />
    </Stack>
  )
}

/* Render the relationship create/edit dialog. */
function RelationshipDialog({
  isOpen,
  editingRelationship,
  formData,
  setFormData,
  entityColumns,
  onClose,
  onSave,
}) {
  const subjectColumns = entityColumns.get(formData.subject_entity) || ['id']
  const objectColumns = entityColumns.get(formData.object_entity) || ['id']

  return (
    <Dialog open={isOpen} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>{editingRelationship ? 'Edit relationship' : 'Add relationship'}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
        <TextField
          label="Relationship name"
          value={formData.relationship_name}
          onChange={(event) =>
            setFormData((previousData) => ({ ...previousData, relationship_name: event.target.value }))
          }
          placeholder="Account has Contact"
          required
        />

        <Box sx={{ display: 'flex', flexDirection: 'row', gap: 2, flexWrap: 'wrap' }}>
          <TextField
            select
            label="Subject entity"
            value={formData.subject_entity}
            onChange={(event) =>
              setFormData((previousData) => ({
                ...previousData,
                subject_entity: event.target.value,
                subject_column: 'id',
              }))
            }
            sx={{ flex: '1 1 240px' }}
          >
            {Array.from(entityColumns.keys()).map((entityName) => (
              <MenuItem key={entityName} value={entityName}>
                {entityName}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            label="Subject column"
            value={formData.subject_column}
            onChange={(event) =>
              setFormData((previousData) => ({ ...previousData, subject_column: event.target.value }))
            }
            sx={{ flex: '1 1 240px' }}
          >
            {subjectColumns.map((columnName) => (
              <MenuItem key={columnName} value={columnName}>
                {columnName}
              </MenuItem>
            ))}
          </TextField>
        </Box>

        <TextField
          label="Predicate IRI (ObjectProperty)"
          value={formData.predicate_iri}
          onChange={(event) =>
            setFormData((previousData) => ({ ...previousData, predicate_iri: event.target.value }))
          }
          placeholder="http://example.com/ontology#hasContact"
          required
        />

        <Box sx={{ display: 'flex', flexDirection: 'row', gap: 2, flexWrap: 'wrap' }}>
          <TextField
            select
            label="Object entity"
            value={formData.object_entity}
            onChange={(event) =>
              setFormData((previousData) => ({
                ...previousData,
                object_entity: event.target.value,
                object_column: 'id',
              }))
            }
            sx={{ flex: '1 1 240px' }}
          >
            {Array.from(entityColumns.keys()).map((entityName) => (
              <MenuItem key={entityName} value={entityName}>
                {entityName}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            label="Object column"
            value={formData.object_column}
            onChange={(event) =>
              setFormData((previousData) => ({ ...previousData, object_column: event.target.value }))
            }
            sx={{ flex: '1 1 240px' }}
          >
            {objectColumns.map((columnName) => (
              <MenuItem key={columnName} value={columnName}>
                {columnName}
              </MenuItem>
            ))}
          </TextField>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
        <Button onClick={onSave} variant="contained">
          Save
        </Button>
      </DialogActions>
    </Dialog>
  )
}

/* Load entities for relationship dropdowns (custom entities only). */
async function loadEntities({ setEntities, setErrorMessage }) {
  try {
    const response = await apiClient.get('/entities')
    setEntities(Array.isArray(response.data) ? response.data : [])
  } catch (error) {
    setEntities([])
    if (setErrorMessage) {
      setErrorMessage(getErrorMessage(error))
    }
  }
}

/* Create a blank relationship form with safe defaults. */
function createEmptyRelationshipForm() {
  return {
    relationship_name: '',
    subject_entity: '',
    subject_column: 'id',
    predicate_iri: 'http://example.com/ontology#hasRelationship',
    object_entity: '',
    object_column: 'id',
  }
}

/* Load relationships from the backend. */
async function loadRelationships({ setRelationships, setIsLoading, setErrorMessage }) {
  setIsLoading(true)
  setErrorMessage('')
  try {
    const response = await apiClient.get('/relationships')
    setRelationships(Array.isArray(response.data) ? response.data : [])
  } catch (error) {
    setErrorMessage(getErrorMessage(error))
  } finally {
    setIsLoading(false)
  }
}

/* Open the dialog for creating a relationship. */
function openCreateDialog({ setEditingRelationship, setFormData, setIsDialogOpen }) {
  setEditingRelationship(null)
  setFormData(createEmptyRelationshipForm())
  setIsDialogOpen(true)
}

/* Open the dialog for editing a relationship. */
function openEditDialog({ relationship, setEditingRelationship, setFormData, setIsDialogOpen }) {
  setEditingRelationship(relationship)
  setFormData({
    relationship_name: relationship.relationship_name,
    subject_entity: relationship.subject_entity,
    subject_column: relationship.subject_column,
    predicate_iri: relationship.predicate_iri,
    object_entity: relationship.object_entity,
    object_column: relationship.object_column,
  })
  setIsDialogOpen(true)
}

/* Create or update a relationship, then reload the list. */
async function saveRelationshipAndReload({
  editingRelationship,
  formData,
  setIsLoading,
  setErrorMessage,
  setRelationships,
  setIsDialogOpen,
  setEditingRelationship,
}) {
  setIsLoading(true)
  setErrorMessage('')
  try {
    if (editingRelationship) {
      await apiClient.put(`/relationships/${editingRelationship.id}`, formData)
    } else {
      await apiClient.post('/relationships', formData)
    }
    setIsDialogOpen(false)
    setEditingRelationship(null)
    await loadRelationships({ setRelationships, setIsLoading, setErrorMessage })
  } catch (error) {
    setErrorMessage(getErrorMessage(error))
  } finally {
    setIsLoading(false)
  }
}

/* Delete a relationship and reload the list. */
async function deleteRelationshipAndReload({ relationshipId, setIsLoading, setErrorMessage, setRelationships }) {
  setIsLoading(true)
  setErrorMessage('')
  try {
    await apiClient.delete(`/relationships/${relationshipId}`)
    await loadRelationships({ setRelationships, setIsLoading, setErrorMessage })
  } catch (error) {
    setErrorMessage(getErrorMessage(error))
  } finally {
    setIsLoading(false)
  }
}

/* Delete all relationships and reload list. */
async function deleteAllRelationshipsAndReload({ setIsLoading, setErrorMessage, setRelationships }) {
  const shouldDelete = window.confirm(
    'Delete ALL relationships?\n\nThis will remove all join rules used for RDF links and the graph.',
  )
  if (!shouldDelete) {
    return
  }

  setIsLoading(true)
  setErrorMessage('')
  try {
    await apiClient.delete('/relationships', { params: { confirm: 'yes' } })
    await loadRelationships({ setRelationships, setIsLoading, setErrorMessage })
  } catch (error) {
    setErrorMessage(getErrorMessage(error))
  } finally {
    setIsLoading(false)
  }
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

