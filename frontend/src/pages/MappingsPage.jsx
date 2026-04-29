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
import { apiClient } from '../api/apiClient'

/* Render UI for editing ontology settings and entity mappings. */
export function MappingsPage() {
  const [settings, setSettings] = useState(null)
  const [entityMappings, setEntityMappings] = useState([])
  const [propertyMappings, setPropertyMappings] = useState([])
  const [entities, setEntities] = useState([])
  const [errorMessage, setErrorMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingMapping, setEditingMapping] = useState(null)
  const [mappingFormData, setMappingFormData] = useState({ class_iri: '', subject_iri_template: '' })

  const [isPropertyDialogOpen, setIsPropertyDialogOpen] = useState(false)
  const [editingPropertyMapping, setEditingPropertyMapping] = useState(null)
  const [propertyFormData, setPropertyFormData] = useState(createEmptyPropertyMappingForm())

  useEffect(() => {
    void loadMappings({ setSettings, setEntityMappings, setPropertyMappings, setErrorMessage, setIsLoading })
    void loadEntities({ setEntities })
  }, [])

  const columnsByEntityName = useMemo(() => {
    const map = {}
    for (const entity of entities) {
      map[entity.entity_name] = Array.isArray(entity.columns) ? entity.columns : ['id']
    }
    return map
  }, [entities])

  return (
    <Stack spacing={2}>
      <Typography variant="h5">Identifiers &amp; Naming</Typography>
      <Typography variant="body2" color="text.secondary">
        Control naming and identifiers for your shared context layer: base namespace, IDs, and how
        records get stable identifiers.
      </Typography>

      {errorMessage ? <Typography color="error">{errorMessage}</Typography> : null}

      <Card variant="outlined">
        <CardContent>
          <Typography variant="h6" sx={{ mb: 1 }}>
            Context settings
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'row', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
            <TextField
              label="Base IRI"
              value={settings?.base_iri || ''}
              onChange={(event) =>
                setSettings((previousSettings) => ({ ...(previousSettings || {}), base_iri: event.target.value }))
              }
              sx={{ flex: '1 1 520px' }}
            />
            <Button
              variant="contained"
              disabled={isLoading || !settings}
              onClick={() =>
                void saveSettings({
                  baseIri: settings?.base_iri,
                  setSettings,
                  setErrorMessage,
                  setIsLoading,
                })
              }
            >
              Save settings
            </Button>
          </Box>

          <Divider sx={{ my: 2 }} />

          <Box sx={{ display: 'flex', flexDirection: 'row', gap: 2, alignItems: 'center' }}>
            <Typography variant="h6" sx={{ flexGrow: 1 }}>
              Entity mappings
            </Typography>
            <Button
              size="small"
              color="error"
              variant="text"
              startIcon={<DeleteIcon />}
              disabled={isLoading || entityMappings.length === 0}
              onClick={() =>
                void deleteAllEntityMappingsAndReload({
                  setErrorMessage,
                  setIsLoading,
                  setEntityMappings,
                })
              }
            >
              Clear all
            </Button>
          </Box>

          <Box sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Entity</TableCell>
                  <TableCell>OWL Class IRI</TableCell>
                  <TableCell>Subject IRI template</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {entityMappings.map((mapping) => (
                  <TableRow key={mapping.entity_name} hover>
                    <TableCell>{mapping.entity_name}</TableCell>
                    <TableCell sx={{ maxWidth: 340, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {mapping.class_iri}
                    </TableCell>
                    <TableCell sx={{ maxWidth: 340, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {mapping.subject_iri_template}
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() =>
                            openEditDialog({
                              mapping,
                              setEditingMapping,
                              setMappingFormData,
                              setIsDialogOpen,
                            })
                          }
                        >
                          Edit
                        </Button>
                        <Button
                          size="small"
                          color="error"
                          variant="text"
                          startIcon={<DeleteIcon />}
                          onClick={() =>
                            void deleteEntityMappingAndReload({
                              entityName: mapping.entity_name,
                              setErrorMessage,
                              setIsLoading,
                              setEntityMappings,
                            })
                          }
                        >
                          Delete
                        </Button>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
                {entityMappings.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4}>
                      <Typography variant="body2" color="text.secondary">
                        No mappings found.
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </Box>

          <Divider sx={{ my: 2 }} />

          <Box sx={{ display: 'flex', flexDirection: 'row', gap: 2, alignItems: 'center' }}>
            <Typography variant="h6" sx={{ flexGrow: 1 }}>
              Property mappings (column → DatatypeProperty)
            </Typography>
            <Button
              size="small"
              color="error"
              variant="text"
              startIcon={<DeleteIcon />}
              disabled={isLoading || propertyMappings.length === 0}
              onClick={() =>
                void deleteAllPropertyMappingsAndReload({
                  setErrorMessage,
                  setIsLoading,
                  setPropertyMappings,
                })
              }
            >
              Clear all
            </Button>
            <Button
              size="small"
              variant="contained"
              onClick={() =>
                openCreatePropertyMappingDialog({
                  setEditingPropertyMapping,
                  setPropertyFormData,
                  setIsPropertyDialogOpen,
                })
              }
            >
              Add property mapping
            </Button>
          </Box>

          <Box sx={{ overflowX: 'auto', mt: 1 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Entity</TableCell>
                  <TableCell>Column</TableCell>
                  <TableCell>Property IRI</TableCell>
                  <TableCell>Datatype IRI</TableCell>
                  <TableCell>Lang</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {propertyMappings.map((propertyMapping) => (
                  <TableRow
                    key={`${propertyMapping.entity_name}.${propertyMapping.column_name}`}
                    hover
                  >
                    <TableCell>{propertyMapping.entity_name}</TableCell>
                    <TableCell>{propertyMapping.column_name}</TableCell>
                    <TableCell sx={{ maxWidth: 340, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {propertyMapping.property_iri}
                    </TableCell>
                    <TableCell sx={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {propertyMapping.datatype_iri || ''}
                    </TableCell>
                    <TableCell>{propertyMapping.language_tag || ''}</TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1}>
                        <IconButton
                          size="small"
                          onClick={() =>
                            openEditPropertyMappingDialog({
                              propertyMapping,
                              setEditingPropertyMapping,
                              setPropertyFormData,
                              setIsPropertyDialogOpen,
                            })
                          }
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() =>
                            void deletePropertyMappingAndReload({
                              entityName: propertyMapping.entity_name,
                              columnName: propertyMapping.column_name,
                              setErrorMessage,
                              setIsLoading,
                              setPropertyMappings,
                            })
                          }
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
                {propertyMappings.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6}>
                      <Typography variant="body2" color="text.secondary">
                        No property mappings found.
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </Box>
        </CardContent>
      </Card>

      <EntityMappingDialog
        isOpen={isDialogOpen}
        mapping={editingMapping}
        formData={mappingFormData}
        setFormData={setMappingFormData}
        onClose={() => setIsDialogOpen(false)}
        onSave={() =>
          void saveEntityMapping({
            mapping: editingMapping,
            formData: mappingFormData,
            setErrorMessage,
            setIsLoading,
            setEntityMappings,
            setIsDialogOpen,
          })
        }
      />

      <PropertyMappingDialog
        isOpen={isPropertyDialogOpen}
        editingPropertyMapping={editingPropertyMapping}
        formData={{
          ...propertyFormData,
          _availableEntities: entities,
          _columnsByEntityName: columnsByEntityName,
        }}
        setFormData={setPropertyFormData}
        onClose={() => setIsPropertyDialogOpen(false)}
        onSave={() =>
          void savePropertyMappingAndReload({
            editingPropertyMapping,
            formData: propertyFormData,
            setErrorMessage,
            setIsLoading,
            setPropertyMappings,
            setIsPropertyDialogOpen,
            setEditingPropertyMapping,
          })
        }
      />
    </Stack>
  )
}

/* Render a dialog for editing one entity mapping. */
function EntityMappingDialog({ isOpen, mapping, formData, setFormData, onClose, onSave }) {
  return (
    <Dialog open={isOpen} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>Edit mapping: {mapping?.entity_name}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
        <TextField
          label="OWL Class IRI"
          value={formData.class_iri}
          onChange={(event) => setFormData((previousData) => ({ ...previousData, class_iri: event.target.value }))}
        />
        <TextField
          label="Subject IRI template"
          value={formData.subject_iri_template}
          onChange={(event) =>
            setFormData((previousData) => ({ ...previousData, subject_iri_template: event.target.value }))
          }
          helperText="Use {id} to insert the row id. Example: http://example.com/resource/accounts/{id}"
        />
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

/* Render a dialog for creating or editing one property mapping. */
function PropertyMappingDialog({
  isOpen,
  editingPropertyMapping,
  formData,
  setFormData,
  onClose,
  onSave,
}) {
  const availableEntities = (formData._availableEntities || []).map((item) => item.entity_name)
  const currentEntityName = availableEntities.includes(formData.entity_name)
    ? formData.entity_name
    : availableEntities[0] || ''

  const columnsByEntityName = formData._columnsByEntityName || {}
  const availableColumns = currentEntityName ? columnsByEntityName[currentEntityName] || ['id'] : ['id']

  return (
    <Dialog open={isOpen} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>{editingPropertyMapping ? 'Edit property mapping' : 'Add property mapping'}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
        <Box sx={{ display: 'flex', flexDirection: 'row', gap: 2, flexWrap: 'wrap' }}>
          <TextField
            select
            label="Entity"
            value={currentEntityName}
            disabled={Boolean(editingPropertyMapping)}
            onChange={(event) =>
              setFormData((previousData) => ({
                ...previousData,
                entity_name: event.target.value,
                column_name: 'id',
              }))
            }
            sx={{ flex: '1 1 260px' }}
          >
            {(formData._availableEntities || []).map((entity) => (
              <MenuItem key={entity.entity_name} value={entity.entity_name}>
                {entity.display_name || entity.entity_name}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            label="Column"
            value={formData.column_name}
            disabled={Boolean(editingPropertyMapping)}
            onChange={(event) =>
              setFormData((previousData) => ({ ...previousData, column_name: event.target.value }))
            }
            sx={{ flex: '1 1 260px' }}
          >
            {availableColumns.map((columnName) => (
              <MenuItem key={columnName} value={columnName}>
                {columnName}
              </MenuItem>
            ))}
          </TextField>
        </Box>

        <TextField
          label="Property IRI"
          value={formData.property_iri}
          onChange={(event) => setFormData((previousData) => ({ ...previousData, property_iri: event.target.value }))}
          required
        />

        <Box sx={{ display: 'flex', flexDirection: 'row', gap: 2, flexWrap: 'wrap' }}>
          <TextField
            label="Datatype IRI (optional)"
            value={formData.datatype_iri || ''}
            onChange={(event) =>
              setFormData((previousData) => ({
                ...previousData,
                datatype_iri: event.target.value || null,
              }))
            }
            sx={{ flex: '1 1 360px' }}
            helperText="Example: http://www.w3.org/2001/XMLSchema#decimal"
          />
          <TextField
            label="Language tag (optional)"
            value={formData.language_tag || ''}
            onChange={(event) =>
              setFormData((previousData) => ({
                ...previousData,
                language_tag: event.target.value || null,
              }))
            }
            sx={{ flex: '1 1 180px' }}
            helperText="Example: en"
          />
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

/* Load ontology settings, entity mappings, and property mappings. */
async function loadMappings({ setSettings, setEntityMappings, setPropertyMappings, setErrorMessage, setIsLoading }) {
  setIsLoading(true)
  setErrorMessage('')
  try {
    const [settingsResponse, entitiesResponse, propertiesResponse] = await Promise.all([
      apiClient.get('/ontology/settings'),
      apiClient.get('/mappings/entities'),
      apiClient.get('/mappings/properties'),
    ])
    setSettings(settingsResponse.data || null)
    setEntityMappings(Array.isArray(entitiesResponse.data) ? entitiesResponse.data : [])
    setPropertyMappings(Array.isArray(propertiesResponse.data) ? propertiesResponse.data : [])
  } catch (error) {
    setErrorMessage(getErrorMessage(error))
  } finally {
    setIsLoading(false)
  }
}

/* Load entities (custom entities only) so property mapping dialog can offer columns. */
async function loadEntities({ setEntities }) {
  try {
    const response = await apiClient.get('/entities')
    setEntities(Array.isArray(response.data) ? response.data : [])
  } catch (error) {
    setEntities([])
  }
}

/* Save the ontology settings (base IRI). */
async function saveSettings({ baseIri, setSettings, setErrorMessage, setIsLoading }) {
  setIsLoading(true)
  setErrorMessage('')
  try {
    const response = await apiClient.put('/ontology/settings', { base_iri: baseIri })
    setSettings(response.data || null)
  } catch (error) {
    setErrorMessage(getErrorMessage(error))
  } finally {
    setIsLoading(false)
  }
}

/* Open mapping edit dialog. */
function openEditDialog({ mapping, setEditingMapping, setMappingFormData, setIsDialogOpen }) {
  setEditingMapping(mapping)
  setMappingFormData({
    class_iri: mapping.class_iri || '',
    subject_iri_template: mapping.subject_iri_template || '',
  })
  setIsDialogOpen(true)
}

/* Save entity mapping and reload list. */
async function saveEntityMapping({ mapping, formData, setErrorMessage, setIsLoading, setEntityMappings, setIsDialogOpen }) {
  if (!mapping) {
    return
  }

  setIsLoading(true)
  setErrorMessage('')
  try {
    await apiClient.put(`/mappings/entities/${mapping.entity_name}`, formData)
    const entitiesResponse = await apiClient.get('/mappings/entities')
    setEntityMappings(Array.isArray(entitiesResponse.data) ? entitiesResponse.data : [])
    setIsDialogOpen(false)
  } catch (error) {
    setErrorMessage(getErrorMessage(error))
  } finally {
    setIsLoading(false)
  }
}

/* Delete an entity mapping and reload list. */
async function deleteEntityMappingAndReload({ entityName, setErrorMessage, setIsLoading, setEntityMappings }) {
  const safeEntityName = String(entityName || '').trim()
  const shouldDelete = window.confirm(`Delete entity mapping for "${safeEntityName}"?`)
  if (!shouldDelete) {
    return
  }

  setIsLoading(true)
  setErrorMessage('')
  try {
    await apiClient.delete(`/mappings/entities/${safeEntityName}`)
    const entitiesResponse = await apiClient.get('/mappings/entities')
    setEntityMappings(Array.isArray(entitiesResponse.data) ? entitiesResponse.data : [])
  } catch (error) {
    setErrorMessage(getErrorMessage(error))
  } finally {
    setIsLoading(false)
  }
}

/* Delete all entity mappings and reload list. */
async function deleteAllEntityMappingsAndReload({ setErrorMessage, setIsLoading, setEntityMappings }) {
  const shouldDelete = window.confirm(
    'Delete ALL entity mappings?\n\nThis can break RDF export and SPARQL until you add mappings back.',
  )
  if (!shouldDelete) {
    return
  }

  setIsLoading(true)
  setErrorMessage('')
  try {
    await apiClient.delete('/mappings/entities', { params: { confirm: 'yes' } })
    const entitiesResponse = await apiClient.get('/mappings/entities')
    setEntityMappings(Array.isArray(entitiesResponse.data) ? entitiesResponse.data : [])
  } catch (error) {
    setErrorMessage(getErrorMessage(error))
  } finally {
    setIsLoading(false)
  }
}

/* Create an empty property mapping form. */
function createEmptyPropertyMappingForm() {
  return {
    entity_name: '',
    column_name: 'id',
    property_iri: 'http://example.com/context#propertyName',
    datatype_iri: null,
    language_tag: null,
    _availableEntities: [],
    _columnsByEntityName: {},
  }
}

/* Open dialog for creating a property mapping. */
function openCreatePropertyMappingDialog({ setEditingPropertyMapping, setPropertyFormData, setIsPropertyDialogOpen }) {
  setEditingPropertyMapping(null)
  setPropertyFormData(createEmptyPropertyMappingForm())
  setIsPropertyDialogOpen(true)
}

/* Open dialog for editing a property mapping. */
function openEditPropertyMappingDialog({ propertyMapping, setEditingPropertyMapping, setPropertyFormData, setIsPropertyDialogOpen }) {
  setEditingPropertyMapping(propertyMapping)
  setPropertyFormData({
    entity_name: propertyMapping.entity_name,
    column_name: propertyMapping.column_name,
    property_iri: propertyMapping.property_iri,
    datatype_iri: propertyMapping.datatype_iri || null,
    language_tag: propertyMapping.language_tag || null,
    _availableEntities: [],
    _columnsByEntityName: {},
  })
  setIsPropertyDialogOpen(true)
}

/* Save a property mapping and reload list. */
async function savePropertyMappingAndReload({
  editingPropertyMapping,
  formData,
  setErrorMessage,
  setIsLoading,
  setPropertyMappings,
  setIsPropertyDialogOpen,
  setEditingPropertyMapping,
}) {
  setIsLoading(true)
  setErrorMessage('')
  try {
    const entityName = formData.entity_name
    const columnName = formData.column_name

    await apiClient.put(`/mappings/properties/${entityName}/${columnName}`, {
      property_iri: formData.property_iri,
      datatype_iri: formData.datatype_iri,
      language_tag: formData.language_tag,
    })

    const propertiesResponse = await apiClient.get('/mappings/properties')
    setPropertyMappings(Array.isArray(propertiesResponse.data) ? propertiesResponse.data : [])

    setIsPropertyDialogOpen(false)
    setEditingPropertyMapping(null)
  } catch (error) {
    setErrorMessage(getErrorMessage(error))
  } finally {
    setIsLoading(false)
  }
}

/* Delete a property mapping and reload list. */
async function deletePropertyMappingAndReload({ entityName, columnName, setErrorMessage, setIsLoading, setPropertyMappings }) {
  setIsLoading(true)
  setErrorMessage('')
  try {
    await apiClient.delete(`/mappings/properties/${entityName}/${columnName}`)
    const propertiesResponse = await apiClient.get('/mappings/properties')
    setPropertyMappings(Array.isArray(propertiesResponse.data) ? propertiesResponse.data : [])
  } catch (error) {
    setErrorMessage(getErrorMessage(error))
  } finally {
    setIsLoading(false)
  }
}

/* Delete all property mappings and reload list. */
async function deleteAllPropertyMappingsAndReload({ setErrorMessage, setIsLoading, setPropertyMappings }) {
  const shouldDelete = window.confirm(
    'Delete ALL property mappings?\n\nThis can break RDF export and SPARQL until you add mappings back.',
  )
  if (!shouldDelete) {
    return
  }

  setIsLoading(true)
  setErrorMessage('')
  try {
    await apiClient.delete('/mappings/properties', { params: { confirm: 'yes' } })
    const propertiesResponse = await apiClient.get('/mappings/properties')
    setPropertyMappings(Array.isArray(propertiesResponse.data) ? propertiesResponse.data : [])
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

