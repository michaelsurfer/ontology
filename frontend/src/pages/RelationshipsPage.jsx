import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  Divider,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
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
  const [linkDataRelationship, setLinkDataRelationship] = useState(null)

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
            Each relationship gets its own link table (two integer columns for the subject and object row ids). Add
            membership rows with the link icon. Link tables are omitted from Objects but appear here. RDF export and the
            graph use these joins.
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
                  <TableCell>Link table</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {relationships.map((relationship) => {
                  const hasJunctionTable = Boolean(String(relationship.junction_entity || '').trim())
                  return (
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
                        {String(relationship.junction_entity || '').trim() ? (
                          <Typography variant="body2">{relationship.junction_entity}</Typography>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            —
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        <Stack direction="row" spacing={1} sx={{ flexWrap: 'nowrap', alignItems: 'center' }}>
                          <IconButton
                            size="small"
                            onClick={() => {
                              navigate(`/graph?focusRelationshipId=${encodeURIComponent(String(relationship.id))}`)
                            }}
                          >
                            <VisibilityIcon fontSize="small" />
                          </IconButton>
                          <Tooltip
                            title={
                              hasJunctionTable
                                ? 'Add or edit link rows for this relationship'
                                : 'No link table yet — save the relationship after choosing subject and object to create one, or open edit on a legacy row.'
                            }
                          >
                            <Box component="span" sx={{ display: 'inline-flex' }}>
                              <IconButton
                                size="small"
                                disabled={!hasJunctionTable}
                                color={hasJunctionTable ? 'primary' : 'default'}
                                onClick={() => {
                                  if (!hasJunctionTable) {
                                    return
                                  }
                                  setLinkDataRelationship(relationship)
                                }}
                              >
                                <LinkIcon fontSize="small" />
                              </IconButton>
                            </Box>
                          </Tooltip>
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
                  )
                })}
                {relationships.length === 0 && !isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6}>
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

      <JunctionLinkDataDialog relationship={linkDataRelationship} onClose={() => setLinkDataRelationship(null)} />
    </Stack>
  )
}

/* Render the relationship create/edit dialog (link table is always created on the server). */
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
  const entityNames = Array.from(entityColumns.keys())
  const hasLinkTableInForm = Boolean(String(formData.junction_entity || '').trim())

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
          placeholder="Relationship label"
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
            <MenuItem value="">
              <em>Select entity</em>
            </MenuItem>
            {entityNames.map((entityName) => (
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
            disabled={!formData.subject_entity}
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
          placeholder="http://example.com/context#hasRelationship"
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
            <MenuItem value="">
              <em>Select entity</em>
            </MenuItem>
            {entityNames.map((entityName) => (
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
          Link table columns store values that match <b>{formData.subject_entity || 'subject'}</b>.
          {formData.subject_column || 'id'} and <b>{formData.object_entity || 'object'}</b>.
          {formData.object_column || 'id'} (usually primary keys).
        </Typography>

        {hasLinkTableInForm ? (
          <Typography variant="body2">
            Link table: <b>{formData.junction_entity}</b> — <b>{formData.junction_subject_column}</b>,{' '}
            <b>{formData.junction_object_column}</b>. Use the link icon on this relationship to add rows, or{' '}
            <b>/custom/{formData.junction_entity}</b>.
          </Typography>
        ) : (
          <Typography variant="body2" color="text.secondary">
            {editingRelationship
              ? 'Saving creates a link table if this row did not have one yet (for example legacy data).'
              : 'Saving creates a link table named from the relationship and entities (not listed under Objects).'}
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
        <Button
          onClick={onSave}
          variant="contained"
          disabled={!canSaveRelationshipFormRelationshipsPage(formData)}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  )
}

/* Pick a human-readable column to show next to each row id in link-table FK pickers. */
function resolveLabelColumnNameForEntity(entityMeta) {
  if (!entityMeta || !Array.isArray(entityMeta.fields)) {
    return null
  }
  const allFields = entityMeta.fields.filter((field) => field && field.field_name)
  const activeFields = allFields.filter((field) => Number(field.is_active ?? 1) === 1)
  const candidates = activeFields.length > 0 ? activeFields : allFields
  const names = candidates.map((field) => field.field_name)
  if (names.includes('name')) {
    return 'name'
  }
  if (names.includes('title')) {
    return 'title'
  }
  const textField = candidates.find((field) => String(field.field_type || '').toUpperCase() === 'TEXT')
  if (textField) {
    return textField.field_name
  }
  return null
}

/* Build sorted { id, label } options for a foreign-key dropdown from table rows. */
function buildForeignKeyPickOptionsFromRows({ rows, idColumn, labelColumn }) {
  const options = []
  for (const row of rows) {
    if (!row || row[idColumn] === undefined || row[idColumn] === null) {
      continue
    }
    const id = row[idColumn]
    let label = ''
    if (
      labelColumn &&
      row[labelColumn] !== undefined &&
      row[labelColumn] !== null &&
      String(row[labelColumn]).trim() !== ''
    ) {
      label = String(row[labelColumn])
    } else {
      label = `Row ${id}`
    }
    options.push({ id, label })
  }
  options.sort((a, b) => String(a.label).localeCompare(String(b.label), undefined, { sensitivity: 'base' }))
  return options
}

/* Parse what the user typed or the chip label into a stored id (supports "Name (id 12)" from the menu). */
function parseManualForeignKeyInput(displayString) {
  const trimmed = String(displayString || '').trim()
  if (!trimmed) {
    return ''
  }
  const match = trimmed.match(/\(id\s+([^)]+)\)\s*$/i)
  if (match) {
    return String(match[1]).trim()
  }
  return trimmed
}

/* One junction column that points at another entity: autocomplete by label, or type the id. */
function LinkTableForeignKeyField({
  field,
  entityName,
  idColumn,
  options,
  isLoading,
  rowFormData,
  setRowFormData,
}) {
  const fieldName = field.field_name
  const rawValue = rowFormData[fieldName] ?? ''
  const matchedOption = options.find((option) => String(option.id) === String(rawValue)) || null
  const autocompleteValue =
    matchedOption ?? (rawValue === '' || rawValue === undefined || rawValue === null ? null : String(rawValue))

  return (
    <Autocomplete
      freeSolo
      loading={isLoading}
      options={options}
      getOptionLabel={(option) => {
        if (typeof option === 'string') {
          return option
        }
        if (!option || option.id === undefined || option.id === null) {
          return ''
        }
        const labelPart =
          option.label && String(option.label).trim() ? String(option.label) : `id ${option.id}`
        return `${labelPart} (id ${option.id})`
      }}
      isOptionEqualToValue={(option, value) => {
        if (value && typeof value === 'object' && value.id !== undefined && value.id !== null) {
          return String(option.id) === String(value.id)
        }
        if (typeof value === 'string') {
          return String(option.id) === value
        }
        return false
      }}
      value={autocompleteValue}
      onChange={(event, newValue) => {
        if (newValue === null || newValue === undefined) {
          setRowFormData((previous) => ({ ...previous, [fieldName]: '' }))
          return
        }
        if (typeof newValue === 'string') {
          setRowFormData((previous) => ({ ...previous, [fieldName]: newValue.trim() }))
          return
        }
        setRowFormData((previous) => ({ ...previous, [fieldName]: String(newValue.id) }))
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          label={`${fieldName} → ${entityName}.${idColumn}`}
          helperText={
            isLoading
              ? 'Loading rows from related table…'
              : `Pick a row by name or type ${idColumn} manually.`
          }
          required={Boolean(field.is_required)}
          onBlur={(blurEvent) => {
            if (typeof params.onBlur === 'function') {
              params.onBlur(blurEvent)
            }
            const parsed = parseManualForeignKeyInput(blurEvent.target.value)
            if (parsed !== String(rawValue ?? '')) {
              setRowFormData((previous) => ({ ...previous, [fieldName]: parsed }))
            }
          }}
        />
      )}
    />
  )
}

/* Dialog to view and edit rows in a relationship's junction (link) table without leaving Relationships. */
function JunctionLinkDataDialog({ relationship, onClose }) {
  const junctionEntityName =
    relationship && String(relationship.junction_entity || '').trim()
      ? String(relationship.junction_entity).trim()
      : ''

  const [entity, setEntity] = useState(null)
  const [rows, setRows] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [isRowDialogOpen, setIsRowDialogOpen] = useState(false)
  const [editingRow, setEditingRow] = useState(null)
  const [rowFormData, setRowFormData] = useState({})
  const [subjectRowPickOptions, setSubjectRowPickOptions] = useState([])
  const [objectRowPickOptions, setObjectRowPickOptions] = useState([])
  const [isForeignKeyPickListsLoading, setIsForeignKeyPickListsLoading] = useState(false)

  /* Prefer active fields; tolerate string/number is_active from API; never hide all columns for link tables. */
  const fields = useMemo(() => {
    const allFields = entity?.fields ? entity.fields : []
    const active = allFields.filter((field) => Number(field?.is_active ?? 1) === 1)
    if (active.length > 0) {
      return active
    }
    return allFields.filter((field) => field.field_name && !['id', 'created_at'].includes(field.field_name))
  }, [entity])

  useEffect(() => {
    if (!relationship || !junctionEntityName) {
      setEntity(null)
      setRows([])
      setErrorMessage('')
      setIsRowDialogOpen(false)
      setEditingRow(null)
      setRowFormData({})
      return
    }

    void loadJunctionEntityAndRows({
      entityName: junctionEntityName,
      setEntity,
      setRows,
      setErrorMessage,
      setIsLoading,
    })
  }, [relationship, junctionEntityName])

  useEffect(() => {
    if (!relationship || !relationship.subject_entity || !relationship.object_entity) {
      setSubjectRowPickOptions([])
      setObjectRowPickOptions([])
      setIsForeignKeyPickListsLoading(false)
      return
    }

    let cancelled = false
    setIsForeignKeyPickListsLoading(true)

    async function loadForeignKeyPickLists() {
      const subjectEntityName = String(relationship.subject_entity)
      const objectEntityName = String(relationship.object_entity)
      const subjectIdColumn = String(relationship.subject_column || 'id')
      const objectIdColumn = String(relationship.object_column || 'id')

      try {
        const [subjectMetaResponse, objectMetaResponse, subjectRowsResponse, objectRowsResponse] = await Promise.all([
          apiClient.get(`/custom-entities/${encodeURIComponent(subjectEntityName)}`),
          apiClient.get(`/custom-entities/${encodeURIComponent(objectEntityName)}`),
          apiClient.get(`/custom/${encodeURIComponent(subjectEntityName)}`),
          apiClient.get(`/custom/${encodeURIComponent(objectEntityName)}`),
        ])

        if (cancelled) {
          return
        }

        const subjectLabelColumn = resolveLabelColumnNameForEntity(subjectMetaResponse.data)
        const objectLabelColumn = resolveLabelColumnNameForEntity(objectMetaResponse.data)

        setSubjectRowPickOptions(
          buildForeignKeyPickOptionsFromRows({
            rows: Array.isArray(subjectRowsResponse.data) ? subjectRowsResponse.data : [],
            idColumn: subjectIdColumn,
            labelColumn: subjectLabelColumn,
          }),
        )
        setObjectRowPickOptions(
          buildForeignKeyPickOptionsFromRows({
            rows: Array.isArray(objectRowsResponse.data) ? objectRowsResponse.data : [],
            idColumn: objectIdColumn,
            labelColumn: objectLabelColumn,
          }),
        )
      } catch (loadError) {
        if (!cancelled) {
          setSubjectRowPickOptions([])
          setObjectRowPickOptions([])
        }
      } finally {
        if (!cancelled) {
          setIsForeignKeyPickListsLoading(false)
        }
      }
    }

    void loadForeignKeyPickLists()

    return () => {
      cancelled = true
    }
  }, [
    relationship?.subject_entity,
    relationship?.object_entity,
    relationship?.subject_column,
    relationship?.object_column,
  ])

  const isMainDialogOpen = Boolean(relationship && junctionEntityName)

  if (!relationship) {
    return null
  }

  return (
    <>
      <Dialog
        open={isMainDialogOpen}
        onClose={onClose}
        fullWidth
        maxWidth="lg"
        disableEnforceFocus={isRowDialogOpen}
      >
        <DialogTitle>Link data — {relationship.relationship_name}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Table <b>{junctionEntityName}</b>: column <b>{relationship.junction_subject_column}</b> matches{' '}
            <b>
              {relationship.subject_entity}.{relationship.subject_column}
            </b>
            ; <b>{relationship.junction_object_column}</b> matches{' '}
            <b>
              {relationship.object_entity}.{relationship.object_column}
            </b>
            .
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'row', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
            <Button
              variant="contained"
              disabled={isLoading || !junctionEntityName || !entity}
              onClick={() => {
                setEditingRow(null)
                setRowFormData({})
                setIsRowDialogOpen(true)
              }}
            >
              Add link row
            </Button>
            <Button
              variant="outlined"
              disabled={isLoading || !junctionEntityName}
              onClick={() =>
                void loadJunctionEntityAndRows({
                  entityName: junctionEntityName,
                  setEntity,
                  setRows,
                  setErrorMessage,
                  setIsLoading,
                })
              }
            >
              Refresh
            </Button>
          </Box>

          {errorMessage ? <Typography color="error">{errorMessage}</Typography> : null}

          {!isLoading && entity && fields.length === 0 ? (
            <Typography color="error" variant="body2">
              No columns found for this link table. Check the server or database metadata for{' '}
              <b>{junctionEntityName}</b>.
            </Typography>
          ) : null}

          <Box sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>ID</TableCell>
                  {fields.map((field) => (
                    <TableCell key={field.field_name}>{field.field_name}</TableCell>
                  ))}
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id} hover>
                    <TableCell>{row.id}</TableCell>
                    {fields.map((field) => (
                      <TableCell key={field.field_name}>{formatJunctionTableCellValue(row[field.field_name])}</TableCell>
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
                            setRowFormData(nextFormData)
                            setIsRowDialogOpen(true)
                          }}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() =>
                            void deleteJunctionRowAndReload({
                              entityName: junctionEntityName,
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
                        No link rows yet. Add a row with the subject and object key values.
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </Box>

          <Typography variant="caption" color="text.secondary">
            Values are sent as text; SQLite coerces types where possible. Use the same ids as in the subject and object
            tables.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} color="inherit">
            Close
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={isRowDialogOpen}
        onClose={() => setIsRowDialogOpen(false)}
        fullWidth
        maxWidth="sm"
        disableEnforceFocus
      >
        <DialogTitle>{editingRow ? 'Edit link row' : 'Add link row'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <TextField
            label="id"
            value={editingRow?.id ?? ''}
            disabled
            helperText="System field (auto-increment integer)"
          />
          {fields.map((field) => {
            if (field.field_name === relationship.junction_subject_column) {
              return (
                <LinkTableForeignKeyField
                  key={field.field_name}
                  field={field}
                  entityName={relationship.subject_entity}
                  idColumn={relationship.subject_column || 'id'}
                  options={subjectRowPickOptions}
                  isLoading={isForeignKeyPickListsLoading}
                  rowFormData={rowFormData}
                  setRowFormData={setRowFormData}
                />
              )
            }
            if (field.field_name === relationship.junction_object_column) {
              return (
                <LinkTableForeignKeyField
                  key={field.field_name}
                  field={field}
                  entityName={relationship.object_entity}
                  idColumn={relationship.object_column || 'id'}
                  options={objectRowPickOptions}
                  isLoading={isForeignKeyPickListsLoading}
                  rowFormData={rowFormData}
                  setRowFormData={setRowFormData}
                />
              )
            }
            return (
              <TextField
                key={field.field_name}
                label={field.field_name}
                value={rowFormData[field.field_name] ?? ''}
                onChange={(event) =>
                  setRowFormData((previous) => ({
                    ...previous,
                    [field.field_name]: event.target.value,
                  }))
                }
                required={Boolean(field.is_required)}
              />
            )
          })}
          <Divider />
          <Typography variant="caption" color="text.secondary">
            {relationship.junction_subject_column}: {relationship.subject_entity} id; {relationship.junction_object_column}:{' '}
            {relationship.object_entity} id.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsRowDialogOpen(false)} color="inherit">
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={() =>
              void saveJunctionRowAndReload({
                entityName: junctionEntityName,
                editingRow,
                formData: rowFormData,
                setRows,
                setErrorMessage,
                setIsLoading,
                setIsRowDialogOpen,
              })
            }
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

/* Load junction table metadata and rows for the link-data dialog. */
async function loadJunctionEntityAndRows({ entityName, setEntity, setRows, setErrorMessage, setIsLoading }) {
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
    setEntity(null)
    setRows([])
  } finally {
    setIsLoading(false)
  }
}

/* Save or create a junction row, then reload the table. */
async function saveJunctionRowAndReload({
  entityName,
  editingRow,
  formData,
  setRows,
  setErrorMessage,
  setIsLoading,
  setIsRowDialogOpen,
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
    setIsRowDialogOpen(false)
  } catch (error) {
    setErrorMessage(getErrorMessage(error))
  } finally {
    setIsLoading(false)
  }
}

/* Delete a junction row after confirmation, then reload. */
async function deleteJunctionRowAndReload({ entityName, rowId, setRows, setErrorMessage, setIsLoading }) {
  const shouldDelete = window.confirm('Delete this link row?')
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

/* Format a cell value for the junction link table. */
function formatJunctionTableCellValue(value) {
  if (value === null || value === undefined) {
    return ''
  }
  return String(value)
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
    predicate_iri: 'http://example.com/context#hasRelationship',
    object_entity: '',
    object_column: 'id',
    junction_entity: '',
    junction_subject_column: '',
    junction_object_column: '',
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
    junction_entity: relationship.junction_entity || '',
    junction_subject_column: relationship.junction_subject_column || '',
    junction_object_column: relationship.junction_object_column || '',
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
    const payload = normalizeRelationshipPayloadForRelationshipsPage(formData)
    if (editingRelationship) {
      await apiClient.put(`/relationships/${editingRelationship.id}`, payload)
    } else {
      await apiClient.post('/relationships', payload)
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

/* Build request body for relationship create/update (link table is server-managed). */
function normalizeRelationshipPayloadForRelationshipsPage(formData) {
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

/* Whether the relationships dialog can submit. */
function canSaveRelationshipFormRelationshipsPage(formData) {
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

