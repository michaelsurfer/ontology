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
  Select,
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
import { useParams, Link as RouterLink, useNavigate } from 'react-router-dom'
import { apiClient } from '../api/apiClient'
import { crmEntities, getCrmEntity } from '../constants/crmSchema'

/* Render a CRUD UI for a single CRM entity. */
export function CrmEntityPage() {
  const params = useParams()
  const entityName = params.entityName
  const navigate = useNavigate()

  const entity = useMemo(() => getCrmEntity(entityName), [entityName])

  const [entitiesList, setEntitiesList] = useState([])
  const [rows, setRows] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingRow, setEditingRow] = useState(null)
  const [formData, setFormData] = useState({})

  useEffect(() => {
    void loadAllEntities({ setEntitiesList })
  }, [])

  useEffect(() => {
    if (!entity) {
      void redirectToCustomEntityIfExists({ entityName, navigate })
      return
    }

    void loadRows(entity.entityName, { setIsLoading, setRows, setErrorMessage })
  }, [entity, entityName, navigate])

  if (!entity) {
    return (
      <Stack spacing={2}>
        <Typography variant="h5">Records</Typography>
        <Typography color="error">Unknown entity: {entityName}</Typography>
      </Stack>
    )
  }

  return (
    <Stack spacing={2}>
      <Box sx={{ display: 'flex', flexDirection: 'row', gap: 2, alignItems: 'center' }}>
        <Typography variant="h5" sx={{ flexGrow: 1 }}>
          {entity.label}
        </Typography>

        <Button variant="contained" onClick={() => openCreateDialog({ setEditingRow, setFormData, setIsDialogOpen })}>
          Add {entity.label.slice(0, -1)}
        </Button>
      </Box>

      <Card variant="outlined">
        <CardContent>
          <Stack direction="row" spacing={2} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
            <Typography variant="body2" color="text.secondary">
              Switch table:
            </Typography>
            <Select size="small" value={entity.entityName} sx={{ minWidth: 220 }}>
              {entitiesList.map((item) => (
                <MenuItem
                  key={item.key}
                  component={RouterLink}
                  to={item.to}
                  value={item.value}
                >
                  {item.label}
                </MenuItem>
              ))}
            </Select>
          </Stack>

          <Divider sx={{ my: 2 }} />

          {errorMessage ? (
            <Typography color="error">{errorMessage}</Typography>
          ) : null}

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Showing up to 200 rows. (Seed data is included for the first run.)
            </Typography>

            <Box sx={{ overflowX: 'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>ID</TableCell>
                    {entity.fields.map((field) => (
                      <TableCell key={field.name}>{field.label}</TableCell>
                    ))}
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id} hover>
                      <TableCell>{row.id}</TableCell>
                      {entity.fields.map((field) => (
                        <TableCell key={field.name}>{formatValue(row[field.name])}</TableCell>
                      ))}
                      <TableCell>
                        <Stack direction="row" spacing={1}>
                          <IconButton
                            size="small"
                            onClick={() =>
                              openEditDialog({
                                row,
                                entity,
                                setEditingRow,
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
                              void deleteRowAndReload({
                                entityName: entity.entityName,
                                rowId: row.id,
                                setIsLoading,
                                setRows,
                                setErrorMessage,
                              })
                            }
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                  {rows.length === 0 && !isLoading ? (
                    <TableRow>
                      <TableCell colSpan={entity.fields.length + 2}>
                        <Typography variant="body2" color="text.secondary">
                          No rows yet.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </Box>
          </Box>
        </CardContent>
      </Card>

      <EntityRowDialog
        entity={entity}
        isOpen={isDialogOpen}
        editingRow={editingRow}
        formData={formData}
        setFormData={setFormData}
        onClose={() => setIsDialogOpen(false)}
        onSave={() =>
          void saveRowAndReload({
            entity,
            editingRow,
            formData,
            setIsLoading,
            setRows,
            setErrorMessage,
            setIsDialogOpen,
            setEditingRow,
          })
        }
      />
    </Stack>
  )
}

/* Load all entities (builtin + custom) for the switcher dropdown. */
async function loadAllEntities({ setEntitiesList }) {
  try {
    const response = await apiClient.get('/entities')
    const entities = Array.isArray(response.data) ? response.data : []

    const items = entities.map((entity) => {
      const isCustom = Boolean(entity.is_custom)
      return {
        key: `${isCustom ? 'custom' : 'crm'}:${entity.entity_name}`,
        label: isCustom ? `${entity.display_name} (Custom)` : entity.display_name,
        value: entity.entity_name,
        to: isCustom ? `/custom/${entity.entity_name}` : `/crm/${entity.entity_name}`,
      }
    })

    setEntitiesList(items)
  } catch (error) {
    // fall back to built-in CRM entities only
    setEntitiesList(
      crmEntities.map((crmEntity) => ({
        key: `crm:${crmEntity.entityName}`,
        label: crmEntity.label,
        value: crmEntity.entityName,
        to: `/crm/${crmEntity.entityName}`,
      })),
    )
  }
}

/* If the entity is not builtin CRM, try redirecting to custom table page. */
async function redirectToCustomEntityIfExists({ entityName, navigate }) {
  const safeEntityName = String(entityName || '').trim()
  if (!safeEntityName) {
    return
  }

  try {
    await apiClient.get(`/custom-entities/${safeEntityName}`)
    navigate(`/custom/${safeEntityName}`, { replace: true })
  } catch (error) {
    // stay on this page; show unknown entity
  }
}

/* Render a dialog for creating or editing a row. */
function EntityRowDialog({ entity, isOpen, editingRow, formData, setFormData, onClose, onSave }) {
  return (
    <Dialog open={isOpen} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{editingRow ? `Edit ${entity.label.slice(0, -1)}` : `Add ${entity.label.slice(0, -1)}`}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
        {entity.fields.map((field) => (
          <TextField
            key={field.name}
            label={field.label}
            value={formData[field.name] ?? ''}
            onChange={(event) =>
              setFormData((previousData) => ({
                ...previousData,
                [field.name]: field.type === 'number' ? normalizeNumber(event.target.value) : event.target.value,
              }))
            }
            required={Boolean(field.required)}
            multiline={Boolean(field.multiline)}
            minRows={field.multiline ? 3 : undefined}
            type={field.type === 'number' ? 'number' : 'text'}
          />
        ))}
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

/* Load rows for an entity and update UI state. */
async function loadRows(entityName, { setIsLoading, setRows, setErrorMessage }) {
  setIsLoading(true)
  setErrorMessage('')
  try {
    const response = await apiClient.get(`/${entityName}`)
    setRows(Array.isArray(response.data) ? response.data : [])
  } catch (error) {
    setErrorMessage(getErrorMessage(error))
  } finally {
    setIsLoading(false)
  }
}

/* Open dialog for creating a new row. */
function openCreateDialog({ setEditingRow, setFormData, setIsDialogOpen }) {
  setEditingRow(null)
  setFormData({})
  setIsDialogOpen(true)
}

/* Open dialog for editing an existing row. */
function openEditDialog({ row, entity, setEditingRow, setFormData, setIsDialogOpen }) {
  setEditingRow(row)
  const nextFormData = {}
  for (const field of entity.fields) {
    nextFormData[field.name] = row[field.name]
  }
  setFormData(nextFormData)
  setIsDialogOpen(true)
}

/* Save (create or update) a row, then reload the table. */
async function saveRowAndReload({
  entity,
  editingRow,
  formData,
  setIsLoading,
  setRows,
  setErrorMessage,
  setIsDialogOpen,
  setEditingRow,
}) {
  setIsLoading(true)
  setErrorMessage('')
  try {
    if (editingRow) {
      await apiClient.put(`/${entity.entityName}/${editingRow.id}`, formData)
    } else {
      await apiClient.post(`/${entity.entityName}`, formData)
    }

    setIsDialogOpen(false)
    setEditingRow(null)
    await loadRows(entity.entityName, { setIsLoading, setRows, setErrorMessage })
  } catch (error) {
    setErrorMessage(getErrorMessage(error))
  } finally {
    setIsLoading(false)
  }
}

/* Delete a row and reload the table. */
async function deleteRowAndReload({ entityName, rowId, setIsLoading, setRows, setErrorMessage }) {
  setIsLoading(true)
  setErrorMessage('')
  try {
    await apiClient.delete(`/${entityName}/${rowId}`)
    await loadRows(entityName, { setIsLoading, setRows, setErrorMessage })
  } catch (error) {
    setErrorMessage(getErrorMessage(error))
  } finally {
    setIsLoading(false)
  }
}

/* Format a table cell value for display. */
function formatValue(value) {
  if (value === null || value === undefined) {
    return ''
  }
  return String(value)
}

/* Normalize a numeric input value into number or null. */
function normalizeNumber(value) {
  if (value === '') {
    return null
  }
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : null
}

/* Convert an Axios error into a readable string. */
function getErrorMessage(error) {
  if (error && typeof error === 'object') {
    const response = error.response
    if (response && response.data && typeof response.data === 'object') {
      if (response.data.error) {
        return String(response.data.error)
      }
    }
    if (error.message) {
      return String(error.message)
    }
  }
  return 'Request failed'
}

