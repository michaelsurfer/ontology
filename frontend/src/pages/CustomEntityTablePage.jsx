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
  Menu,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import LinkIcon from '@mui/icons-material/Link'
import { MenuItem, Select } from '@mui/material'
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom'
import { apiClient } from '../api/apiClient'

/* CRUD UI for one custom entity table. */
export function CustomEntityTablePage() {
  const params = useParams()
  const entityName = params.entityName
  const navigate = useNavigate()

  const [entity, setEntity] = useState(null)
  const [entitiesList, setEntitiesList] = useState([])
  const [rows, setRows] = useState([])
  const [relationships, setRelationships] = useState([])
  const [errorMessage, setErrorMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingRow, setEditingRow] = useState(null)
  const [formData, setFormData] = useState({})
  const [relationshipMenuAnchorElement, setRelationshipMenuAnchorElement] = useState(null)
  const [relationshipMenuHints, setRelationshipMenuHints] = useState([])

  /* Close the relationship picker menu. */
  function closeRelationshipMenu() {
    setRelationshipMenuAnchorElement(null)
    setRelationshipMenuHints([])
  }

  /* Navigate to the Relationships page and open a specific relationship. */
  function navigateToRelationshipEdit({ relationshipId }) {
    if (!relationshipId) {
      return
    }
    navigate(`/relationships?edit=${encodeURIComponent(String(relationshipId))}`)
  }

  /* Handle clicking a relationship indicator for a field. */
  function handleRelationshipIndicatorClick({ event, hints }) {
    if (event && typeof event.stopPropagation === 'function') {
      event.stopPropagation()
    }

    const safeHints = Array.isArray(hints) ? hints.filter(Boolean) : []
    if (safeHints.length === 0) {
      return
    }

    if (safeHints.length === 1 && safeHints[0].relationshipId) {
      navigateToRelationshipEdit({ relationshipId: safeHints[0].relationshipId })
      return
    }

    setRelationshipMenuAnchorElement(event?.currentTarget || null)
    setRelationshipMenuHints(safeHints)
  }

  const fields = useMemo(() => {
    const allFields = entity?.fields ? entity.fields : []
    return allFields.filter((field) => field.is_active)
  }, [entity])

  const relationshipHintsByFieldName = useMemo(() => {
    return buildRelationshipHintsByFieldName({ entityName, relationships })
  }, [entityName, relationships])

  useEffect(() => {
    void loadAllEntities({ setEntitiesList })
  }, [])

  useEffect(() => {
    if (!entityName) {
      return
    }
    void loadEntityAndRows({ entityName, setEntity, setRows, setErrorMessage, setIsLoading })
    void loadRelationships({ setRelationships })
  }, [entityName])

  return (
    <Stack spacing={2}>
      <Box sx={{ display: 'flex', flexDirection: 'row', gap: 2, alignItems: 'center' }}>
        <Typography variant="h5" sx={{ flexGrow: 1 }}>
          {entity?.display_name || entityName}
        </Typography>
        <Button
          variant="contained"
          onClick={() => {
            setEditingRow(null)
            setFormData({})
            setIsDialogOpen(true)
          }}
        >
          Add row
        </Button>
      </Box>

      <Typography variant="body2" color="text.secondary">
        Table: <b>{entityName}</b>
      </Typography>

      <Card variant="outlined">
        <CardContent>
          <Stack direction="row" spacing={2} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
            <Typography variant="body2" color="text.secondary">
              Switch table:
            </Typography>
            <Select size="small" value={entityName} sx={{ minWidth: 220 }}>
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
        </CardContent>
      </Card>

      {errorMessage ? <Typography color="error">{errorMessage}</Typography> : null}

      <Card variant="outlined">
        <CardContent>
          <Box sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>ID</TableCell>
                  {fields.map((field) => (
                    <TableCell key={field.field_name}>
                      <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 1 }}>
                        <Box component="span" sx={{ fontWeight: 700 }}>
                          {field.field_name}
                        </Box>
                        {relationshipHintsByFieldName.has(field.field_name) ? (
                          <Tooltip
                            arrow
                            placement="top"
                            title={formatRelationshipHintsTooltip(
                              relationshipHintsByFieldName.get(field.field_name),
                            )}
                          >
                            <IconButton
                              size="small"
                              onClick={(event) =>
                                handleRelationshipIndicatorClick({
                                  event,
                                  hints: relationshipHintsByFieldName.get(field.field_name),
                                })
                              }
                              sx={{ color: 'text.secondary' }}
                            >
                              <LinkIcon fontSize="inherit" />
                            </IconButton>
                          </Tooltip>
                        ) : null}
                      </Box>
                    </TableCell>
                  ))}
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id} hover>
                    <TableCell>{row.id}</TableCell>
                    {fields.map((field) => (
                      <TableCell key={field.field_name}>{formatValue(row[field.field_name])}</TableCell>
                    ))}
                    <TableCell>
                      <Stack direction="row" spacing={1}>
                        <IconButton
                          size="small"
                          onClick={() => {
                            setEditingRow(row)
                            const nextFormData = {}
                            for (const field of fields) {
                              nextFormData[field.field_name] = row[field.field_name]
                            }
                            setFormData(nextFormData)
                            setIsDialogOpen(true)
                          }}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() =>
                            void deleteRowAndReload({
                              entityName,
                              rowId: row.id,
                              setRows,
                              setErrorMessage,
                              setIsLoading,
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
                    <TableCell colSpan={fields.length + 2}>
                      <Typography variant="body2" color="text.secondary">
                        No rows yet.
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </Box>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onClose={() => setIsDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editingRow ? 'Edit row' : 'Add row'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          {fields.map((field) => (
            <TextField
              key={field.field_name}
              label={field.field_name}
              value={formData[field.field_name] ?? ''}
              onChange={(event) =>
                setFormData((prev) => ({
                  ...prev,
                  [field.field_name]: event.target.value,
                }))
              }
              required={Boolean(field.is_required)}
              helperText={formatRelationshipHintsHelperText(
                relationshipHintsByFieldName.get(field.field_name),
              )}
            />
          ))}
          <Divider />
          <Typography variant="caption" color="text.secondary">
            Note: Field types are stored in SQLite; the UI currently sends values as text and SQLite will coerce when possible.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsDialogOpen(false)} color="inherit">
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={() =>
              void saveRowAndReload({
                entityName,
                editingRow,
                formData,
                setRows,
                setErrorMessage,
                setIsLoading,
                setIsDialogOpen,
              })
            }
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Menu
        anchorEl={relationshipMenuAnchorElement}
        open={Boolean(relationshipMenuAnchorElement)}
        onClose={closeRelationshipMenu}
      >
        {relationshipMenuHints.map((hint) => (
          <MenuItem
            key={`${hint.relationshipId}:${hint.direction}:${hint.otherEntity}:${hint.otherColumn}`}
            onClick={() => {
              closeRelationshipMenu()
              navigateToRelationshipEdit({ relationshipId: hint.relationshipId })
            }}
            disabled={!hint.relationshipId}
          >
            {formatRelationshipHintMenuLabel(hint)}
          </MenuItem>
        ))}
      </Menu>
    </Stack>
  )
}

/* Load all entities (builtin + custom) for the switcher dropdown. */
async function loadAllEntities({ setEntitiesList }) {
  try {
    const response = await apiClient.get('/entities')
    const entities = Array.isArray(response.data) ? response.data : []

    const items = entities.map((entity) => {
      return {
        key: `custom:${entity.entity_name}`,
        label: entity.display_name,
        value: entity.entity_name,
        to: `/custom/${entity.entity_name}`,
      }
    })

    setEntitiesList(items)
  } catch (error) {
    setEntitiesList([])
  }
}

/* Load relationship definitions for relationship hints. */
async function loadRelationships({ setRelationships }) {
  try {
    const response = await apiClient.get('/relationships')
    setRelationships(Array.isArray(response.data) ? response.data : [])
  } catch (error) {
    setRelationships([])
  }
}

/* Load custom entity metadata and its rows. */
async function loadEntityAndRows({ entityName, setEntity, setRows, setErrorMessage, setIsLoading }) {
  setIsLoading(true)
  setErrorMessage('')
  try {
    const [entityResponse, rowsResponse] = await Promise.all([
      apiClient.get(`/custom-entities/${entityName}`),
      apiClient.get(`/custom/${entityName}`),
    ])
    setEntity(entityResponse.data || null)
    setRows(Array.isArray(rowsResponse.data) ? rowsResponse.data : [])
  } catch (error) {
    setErrorMessage(getErrorMessage(error))
  } finally {
    setIsLoading(false)
  }
}

/* Build a map from field name to relationship hint entries. */
function buildRelationshipHintsByFieldName({ entityName, relationships }) {
  const map = new Map()
  if (!entityName || !Array.isArray(relationships) || relationships.length === 0) {
    return map
  }

  for (const relationship of relationships) {
    if (!relationship || typeof relationship !== 'object') {
      continue
    }

    const relationshipName = relationship.relationship_name || 'Relationship'

    if (relationship.subject_entity === entityName && relationship.subject_column) {
      const fieldName = relationship.subject_column
      const hints = map.get(fieldName) || []
      hints.push({
        relationshipId: relationship.id,
        direction: 'outbound',
        relationshipName,
        otherEntity: relationship.object_entity,
        otherColumn: relationship.object_column,
      })
      map.set(fieldName, hints)
    }

    if (relationship.object_entity === entityName && relationship.object_column) {
      const fieldName = relationship.object_column
      const hints = map.get(fieldName) || []
      hints.push({
        relationshipId: relationship.id,
        direction: 'inbound',
        relationshipName,
        otherEntity: relationship.subject_entity,
        otherColumn: relationship.subject_column,
      })
      map.set(fieldName, hints)
    }
  }

  return map
}

/* Format one relationship hint for the picker menu label. */
function formatRelationshipHintMenuLabel(hint) {
  if (!hint || typeof hint !== 'object') {
    return 'Relationship'
  }

  const directionLabel = hint.direction === 'outbound' ? 'Links to' : 'Linked from'
  const target =
    hint.otherEntity && hint.otherColumn ? `${hint.otherEntity}.${hint.otherColumn}` : 'another field'
  const relationshipName = hint.relationshipName ? ` (${hint.relationshipName})` : ''
  return `${directionLabel} ${target}${relationshipName}`
}

/* Format relationship hints as a tooltip content. */
function formatRelationshipHintsTooltip(hints) {
  if (!Array.isArray(hints) || hints.length === 0) {
    return ''
  }

  const lines = hints
    .slice(0, 6)
    .map((hint) => {
      if (!hint || typeof hint !== 'object') {
        return null
      }
      const directionLabel = hint.direction === 'outbound' ? 'Links to' : 'Linked from'
      const target = hint.otherEntity && hint.otherColumn ? `${hint.otherEntity}.${hint.otherColumn}` : 'another field'
      return `${directionLabel} ${target} (${hint.relationshipName})`
    })
    .filter(Boolean)

  const extraCount = hints.length - lines.length
  if (extraCount > 0) {
    lines.push(`+${extraCount} more`)
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      <Box component="div" sx={{ fontWeight: 800 }}>
        Relationships
      </Box>
      {lines.map((line) => (
        <Box key={line} component="div">
          {line}
        </Box>
      ))}
    </Box>
  )
}

/* Format relationship hints as a compact helper text for a field input. */
function formatRelationshipHintsHelperText(hints) {
  if (!Array.isArray(hints) || hints.length === 0) {
    return undefined
  }

  const firstHint = hints[0]
  if (!firstHint || typeof firstHint !== 'object') {
    return undefined
  }

  if (firstHint.otherEntity && firstHint.otherColumn) {
    const directionLabel = firstHint.direction === 'outbound' ? 'Related to' : 'Referenced by'
    const moreCount = hints.length - 1
    return moreCount > 0
      ? `${directionLabel}: ${firstHint.otherEntity}.${firstHint.otherColumn} (+${moreCount} more)`
      : `${directionLabel}: ${firstHint.otherEntity}.${firstHint.otherColumn}`
  }

  return 'This field participates in a relationship.'
}

/* Save a row then reload rows list. */
async function saveRowAndReload({
  entityName,
  editingRow,
  formData,
  setRows,
  setErrorMessage,
  setIsLoading,
  setIsDialogOpen,
}) {
  setIsLoading(true)
  setErrorMessage('')
  try {
    if (editingRow) {
      await apiClient.put(`/custom/${entityName}/${editingRow.id}`, formData)
    } else {
      await apiClient.post(`/custom/${entityName}`, formData)
    }

    const rowsResponse = await apiClient.get(`/custom/${entityName}`)
    setRows(Array.isArray(rowsResponse.data) ? rowsResponse.data : [])
    setIsDialogOpen(false)
  } catch (error) {
    setErrorMessage(getErrorMessage(error))
  } finally {
    setIsLoading(false)
  }
}

/* Delete a row then reload. */
async function deleteRowAndReload({ entityName, rowId, setRows, setErrorMessage, setIsLoading }) {
  const shouldDelete = window.confirm('Delete this row?')
  if (!shouldDelete) {
    return
  }

  setIsLoading(true)
  setErrorMessage('')
  try {
    await apiClient.delete(`/custom/${entityName}/${rowId}`)
    const rowsResponse = await apiClient.get(`/custom/${entityName}`)
    setRows(Array.isArray(rowsResponse.data) ? rowsResponse.data : [])
  } catch (error) {
    setErrorMessage(getErrorMessage(error))
  } finally {
    setIsLoading(false)
  }
}

/* Format a value for display. */
function formatValue(value) {
  if (value === null || value === undefined) {
    return ''
  }
  return String(value)
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

