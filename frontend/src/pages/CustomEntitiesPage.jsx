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
  useMediaQuery,
  useTheme,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import { Link as RouterLink } from 'react-router-dom'
import { apiClient } from '../api/apiClient'
import emptyEntitiesIllustrationUrl from '../assets/entities-empty.svg'

/* Allow users to create custom entities (real SQL tables) and browse them. */
export function CustomEntitiesPage() {
  const theme = useTheme()
  const isSmallViewport = useMediaQuery(theme.breakpoints.down('md'))

  const [entities, setEntities] = useState([])
  const [errorMessage, setErrorMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [formData, setFormData] = useState(createEmptyEntityForm())

  const [isFieldsDialogOpen, setIsFieldsDialogOpen] = useState(false)
  const [activeEntity, setActiveEntity] = useState(null)
  const [newFieldFormData, setNewFieldFormData] = useState(createEmptyField())

  useEffect(() => {
    void loadCustomEntities({ setEntities, setErrorMessage, setIsLoading })
  }, [])

  const canCreate = useMemo(() => {
    const entityNameErrorText = getEntityNameErrorText({
      entityName: formData.entity_name,
      existingEntities: entities,
    })
    if (entityNameErrorText) {
      return false
    }
    if (!formData.entity_name.trim()) {
      return false
    }
    if (!formData.display_name.trim()) {
      return false
    }
    if (formData.fields.length === 0) {
      return false
    }
    if (formData.fields.some((field) => !field.field_name.trim())) {
      return false
    }
    return true
  }, [formData, entities])

  const entityNameErrorText = useMemo(() => {
    return getEntityNameErrorText({ entityName: formData.entity_name, existingEntities: entities })
  }, [formData.entity_name, entities])

  return (
    <Stack spacing={2}>
      <Box sx={{ display: 'flex', flexDirection: 'row', gap: 2, alignItems: 'center' }}>
        <Typography variant="h5" sx={{ flexGrow: 1 }}>
          Objects
        </Typography>
        <Button variant="contained" onClick={() => setIsDialogOpen(true)}>
          Create object
        </Button>
      </Box>

      <Typography variant="body2" color="text.secondary">
        Define Objects schemas can be used in the Context Map,
        Standards Export, SPARQL console, and Guardrails.
      </Typography>

      {errorMessage ? <Typography color="error">{errorMessage}</Typography> : null}

      <Card variant="outlined">
        <CardContent>
          {entities.length === 0 && !isLoading ? (
            <Stack spacing={2} sx={{ alignItems: 'center', textAlign: 'center', py: 3 }}>
              <Box
                component="img"
                src={emptyEntitiesIllustrationUrl}
                alt="No entities yet"
                sx={{ width: '100%', maxWidth: 520, height: 'auto' }}
              />
              <Box>
                <Typography variant="h6">No entities yet</Typography>
                <Typography variant="body2" color="text.secondary">
                  Create an entity, or ingest real-time data and approve suggestions to generate entities automatically.
                </Typography>
              </Box>
              <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap', justifyContent: 'center' }}>
                <Button variant="contained" onClick={() => setIsDialogOpen(true)}>
                  Create entity
                </Button>
                <Button component={RouterLink} to="/automation" variant="outlined">
                  Ingest data
                </Button>
              </Stack>
            </Stack>
          ) : (
            <Box sx={{ overflowX: 'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Entity name</TableCell>
                    <TableCell>Display name</TableCell>
                    <TableCell>Fields</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {entities.map((entity) => (
                    <TableRow key={entity.entity_name} hover>
                      <TableCell>{entity.entity_name}</TableCell>
                      <TableCell>{entity.display_name}</TableCell>
                      <TableCell>{(entity.fields || []).length}</TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={1}>
                          <Button
                            component={RouterLink}
                            to={`/custom/${entity.entity_name}`}
                            size="small"
                            variant="outlined"
                          >
                            Open table
                          </Button>
                          <Button
                            size="small"
                            variant="text"
                            startIcon={<EditIcon />}
                            onClick={() => {
                              setActiveEntity(entity)
                              setNewFieldFormData(createEmptyField())
                              setIsFieldsDialogOpen(true)
                            }}
                          >
                            Manage fields
                          </Button>
                          <Button
                            size="small"
                            color="error"
                            variant="text"
                            startIcon={<DeleteIcon />}
                            onClick={() =>
                              void deleteEntityAndReload({
                                entityName: entity.entity_name,
                                setEntities,
                                setErrorMessage,
                                setIsLoading,
                              })
                            }
                          >
                            Delete entity
                          </Button>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        fullWidth
        fullScreen={isSmallViewport}
        maxWidth="lg"
        scroll="paper"
        PaperProps={{ sx: { maxHeight: isSmallViewport ? '100%' : '90vh' } }}
      >
        <DialogTitle>Create custom entity</DialogTitle>
        <DialogContent
          dividers
          sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}
        >
          <TextField
            label="Entity name (table name)"
            value={formData.entity_name}
            onChange={(event) => setFormData((prev) => ({ ...prev, entity_name: event.target.value }))}
            error={Boolean(entityNameErrorText)}
            helperText={
              entityNameErrorText || 'Must match: /^[a-z][a-z0-9_]*$/ (example: "projects")'
            }
            required
          />
          <TextField
            label="Display name"
            value={formData.display_name}
            onChange={(event) => setFormData((prev) => ({ ...prev, display_name: event.target.value }))}
            required
          />

          <Divider />

          <Box sx={{ display: 'flex', flexDirection: 'row', gap: 4, alignItems: 'center' }}>
            <Typography variant="h6" sx={{ flexGrow: 1 }}>
              Fields
            </Typography>
            <Button
              startIcon={<AddIcon />}
              variant="outlined"
              onClick={() =>
                setFormData((prev) => ({
                  ...prev,
                  fields: [...prev.fields, createEmptyField()],
                }))
              }
            >
              Add field
            </Button>
          </Box>

          <Typography variant="body2" color="text.secondary">
            System fields are created automatically: <b>id</b> (INTEGER, auto-increment). You do not need to add it and you
            cannot edit or delete it.
          </Typography>

          <Stack
            spacing={1}
            sx={{
              maxHeight: isSmallViewport ? 'unset' : 520,
              overflowY: isSmallViewport ? 'visible' : 'auto',
              pr: isSmallViewport ? 0 : 1,
            }}
          >
            {formData.fields.map((field, index) => (
              <Box
                key={index}
                sx={{
                  display: 'flex',
                  flexDirection: 'row',
                  gap: 2,
                  py: 1,
                  flexWrap: 'wrap',
                  alignItems: 'center',
                }}
              >
                <TextField
                  label="Field name"
                  value={field.field_name}
                  onChange={(event) =>
                    setFormData((prev) => ({
                      ...prev,
                      fields: prev.fields.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, field_name: event.target.value } : item,
                      ),
                    }))
                  }
                  sx={{ flex: '1 1 240px' }}
                  placeholder="example: account_id"
                  required
                />

                <TextField
                  select
                  label="Type"
                  value={field.field_type}
                  onChange={(event) =>
                    setFormData((prev) => ({
                      ...prev,
                      fields: prev.fields.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, field_type: event.target.value } : item,
                      ),
                    }))
                  }
                  sx={{ width: 200 }}
                >
                  <MenuItem value="TEXT">TEXT</MenuItem>
                  <MenuItem value="INTEGER">INTEGER</MenuItem>
                  <MenuItem value="REAL">REAL</MenuItem>
                </TextField>

                <TextField
                  select
                  label="Required"
                  value={field.is_required ? 'yes' : 'no'}
                  onChange={(event) =>
                    setFormData((prev) => ({
                      ...prev,
                      fields: prev.fields.map((item, itemIndex) =>
                        itemIndex === index
                          ? { ...item, is_required: event.target.value === 'yes' }
                          : item,
                      ),
                    }))
                  }
                  sx={{ width: 160 }}
                >
                  <MenuItem value="no">No</MenuItem>
                  <MenuItem value="yes">Yes</MenuItem>
                </TextField>

                <IconButton
                  onClick={() =>
                    setFormData((prev) => ({
                      ...prev,
                      fields: prev.fields.filter((_, itemIndex) => itemIndex !== index),
                    }))
                  }
                >
                  <DeleteIcon />
                </IconButton>
              </Box>
            ))}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setIsDialogOpen(false)
              setFormData(createEmptyEntityForm())
            }}
            color="inherit"
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={!canCreate}
            onClick={() =>
              void createEntityAndReload({
                formData,
                setEntities,
                setErrorMessage,
                setIsLoading,
                setIsDialogOpen,
                setFormData,
              })
            }
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={isFieldsDialogOpen}
        onClose={() => setIsFieldsDialogOpen(false)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>Manage fields: {activeEntity?.display_name}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <Typography variant="body2" color="text.secondary">
            This will add real SQL columns (safe). Disabling a field hides it from the UI and RDF export.
          </Typography>

          <Divider />

          <Typography variant="h6">Add new field</Typography>
          <Box sx={{ display: 'flex', flexDirection: 'row', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
            <TextField
              label="Field name"
              value={newFieldFormData.field_name}
              onChange={(event) => setNewFieldFormData((prev) => ({ ...prev, field_name: event.target.value }))}
              sx={{ flex: '1 1 260px' }}
              placeholder="example: external_id"
            />
            <TextField
              select
              label="Type"
              value={newFieldFormData.field_type}
              onChange={(event) => setNewFieldFormData((prev) => ({ ...prev, field_type: event.target.value }))}
              sx={{ width: 200 }}
            >
              <MenuItem value="TEXT">TEXT</MenuItem>
              <MenuItem value="INTEGER">INTEGER</MenuItem>
              <MenuItem value="REAL">REAL</MenuItem>
            </TextField>
            <TextField
              select
              label="Required"
              value={newFieldFormData.is_required ? 'yes' : 'no'}
              onChange={(event) =>
                setNewFieldFormData((prev) => ({ ...prev, is_required: event.target.value === 'yes' }))
              }
              sx={{ width: 160 }}
            >
              <MenuItem value="no">No</MenuItem>
              <MenuItem value="yes">Yes</MenuItem>
            </TextField>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              disabled={!activeEntity || !newFieldFormData.field_name.trim()}
              onClick={() =>
                void addFieldAndReload({
                  entityName: activeEntity?.entity_name,
                  field: newFieldFormData,
                  setEntities,
                  setActiveEntity,
                  setErrorMessage,
                  setIsLoading,
                  setNewFieldFormData,
                })
              }
            >
              Add
            </Button>
          </Box>

          <Divider />

          <Typography variant="h6">Existing fields</Typography>
          <Box sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Field</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Required</TableCell>
                  <TableCell>Active</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                <TableRow hover>
                  <TableCell>
                    <b>id</b>
                  </TableCell>
                  <TableCell>INTEGER (auto-increment)</TableCell>
                  <TableCell>Yes</TableCell>
                  <TableCell>
                    <TextField select size="small" value="yes" disabled sx={{ width: 120 }}>
                      <MenuItem value="yes">Yes</MenuItem>
                      <MenuItem value="no">No</MenuItem>
                    </TextField>
                  </TableCell>
                </TableRow>
                {(activeEntity?.fields || []).map((field) => (
                  <TableRow key={field.id} hover>
                    <TableCell>{field.field_name}</TableCell>
                    <TableCell>{field.field_type}</TableCell>
                    <TableCell>{field.is_required ? 'Yes' : 'No'}</TableCell>
                    <TableCell>
                      <TextField
                        select
                        size="small"
                        value={field.is_active ? 'yes' : 'no'}
                        onChange={(event) =>
                          void updateFieldAndReload({
                            entityName: activeEntity?.entity_name,
                            fieldId: field.id,
                            patch: { is_active: event.target.value === 'yes' ? 1 : 0 },
                            setEntities,
                            setActiveEntity,
                            setErrorMessage,
                            setIsLoading,
                          })
                        }
                        sx={{ width: 120 }}
                      >
                        <MenuItem value="yes">Yes</MenuItem>
                        <MenuItem value="no">No</MenuItem>
                      </TextField>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsFieldsDialogOpen(false)} color="inherit">
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  )
}

/* Create a blank custom entity form state. */
function createEmptyEntityForm() {
  return {
    entity_name: '',
    display_name: '',
    fields: [createEmptyField()],
  }
}

/* Create a blank field entry. */
function createEmptyField() {
  return {
    field_name: '',
    field_type: 'TEXT',
    is_required: false,
  }
}

/* Validate the entity name for format and uniqueness against existing entities. */
function getEntityNameErrorText({ entityName, existingEntities }) {
  const normalized = String(entityName || '').trim().toLowerCase()
  if (!normalized) {
    return ''
  }

  if (!/^[a-z][a-z0-9_]*$/.test(normalized)) {
    return 'Invalid format. Use: /^[a-z][a-z0-9_]*$/'
  }

  const list = Array.isArray(existingEntities) ? existingEntities : []
  const exists = list.some((entity) => String(entity?.entity_name || '').trim().toLowerCase() === normalized)
  if (exists) {
    return `Entity name already exists: ${normalized}`
  }

  return ''
}

/* Fetch all custom entities from backend. */
async function loadCustomEntities({ setEntities, setErrorMessage, setIsLoading }) {
  setIsLoading(true)
  setErrorMessage('')
  try {
    const response = await apiClient.get('/custom-entities')
    setEntities(Array.isArray(response.data) ? response.data : [])
  } catch (error) {
    setErrorMessage(getErrorMessage(error))
  } finally {
    setIsLoading(false)
  }
}

/* Create an entity then reload list. */
async function createEntityAndReload({
  formData,
  setEntities,
  setErrorMessage,
  setIsLoading,
  setIsDialogOpen,
  setFormData,
}) {
  setIsLoading(true)
  setErrorMessage('')
  try {
    await apiClient.post('/custom-entities', formData)
    await loadCustomEntities({ setEntities, setErrorMessage, setIsLoading })
    setIsDialogOpen(false)
    setFormData(createEmptyEntityForm())
  } catch (error) {
    setErrorMessage(getErrorMessage(error))
  } finally {
    setIsLoading(false)
  }
}

/* Add a field to an existing custom entity, then reload entities list. */
async function addFieldAndReload({
  entityName,
  field,
  setEntities,
  setActiveEntity,
  setErrorMessage,
  setIsLoading,
  setNewFieldFormData,
}) {
  if (!entityName) {
    return
  }

  setIsLoading(true)
  setErrorMessage('')
  try {
    const response = await apiClient.post(`/custom-entities/${entityName}/fields`, field)
    const updatedEntity = response.data

    await loadCustomEntities({ setEntities, setErrorMessage, setIsLoading })
    setActiveEntity(updatedEntity || null)
    setNewFieldFormData(createEmptyField())
  } catch (error) {
    setErrorMessage(getErrorMessage(error))
  } finally {
    setIsLoading(false)
  }
}

/* Update a field (active/required) then reload entities list. */
async function updateFieldAndReload({
  entityName,
  fieldId,
  patch,
  setEntities,
  setActiveEntity,
  setErrorMessage,
  setIsLoading,
}) {
  if (!entityName || !fieldId) {
    return
  }

  setIsLoading(true)
  setErrorMessage('')
  try {
    const response = await apiClient.put(`/custom-entities/${entityName}/fields/${fieldId}`, patch)
    const updatedEntity = response.data
    await loadCustomEntities({ setEntities, setErrorMessage, setIsLoading })
    setActiveEntity(updatedEntity || null)
  } catch (error) {
    setErrorMessage(getErrorMessage(error))
  } finally {
    setIsLoading(false)
  }
}

/* Delete a custom entity and reload list. */
async function deleteEntityAndReload({ entityName, setEntities, setErrorMessage, setIsLoading }) {
  const safeEntityName = String(entityName || '').trim()
  const shouldDelete = window.confirm(
    `Delete entity "${safeEntityName}"?\n\nThis will drop the SQL table and remove mappings/relationships that reference it.`,
  )
  if (!shouldDelete) {
    return
  }

  setIsLoading(true)
  setErrorMessage('')
  try {
    await apiClient.delete(`/custom-entities/${safeEntityName}`)
    await loadCustomEntities({ setEntities, setErrorMessage, setIsLoading })
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

