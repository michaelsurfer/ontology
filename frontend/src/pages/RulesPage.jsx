import React, { useEffect, useMemo, useState } from 'react'
import {
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
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

/* Let users define ontology rules (SHACL constraints) and validate exported RDF. */
export function RulesPage() {
  const [rules, setRules] = useState([])
  const [entities, setEntities] = useState([])
  const [errorMessage, setErrorMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingRule, setEditingRule] = useState(null)
  const [formData, setFormData] = useState(createEmptyRuleForm())

  const [validationReport, setValidationReport] = useState(null)

  const entityColumns = useMemo(() => {
    const map = new Map()
    for (const entity of entities) {
      map.set(entity.entity_name, entity.columns || ['id'])
    }
    return map
  }, [entities])

  useEffect(() => {
    void loadRules({ setRules, setErrorMessage, setIsLoading })
    void loadEntities({ setEntities })
  }, [])

  return (
    <Stack spacing={2}>
      <Box sx={{ display: 'flex', flexDirection: 'row', gap: 2, alignItems: 'center' }}>
        <Typography variant="h5" sx={{ flexGrow: 1 }}>
          Rules (SHACL)
        </Typography>
        <Button
          variant="contained"
          onClick={() =>
            openCreateDialog({
              setEditingRule,
              setFormData,
              setIsDialogOpen,
            })
          }
        >
          Add rule
        </Button>
      </Box>

      <Typography variant="body2" color="text.secondary">
        Rules are exported as SHACL shapes and can be used to validate your CRM→RDF graph.
      </Typography>

      {errorMessage ? <Typography color="error">{errorMessage}</Typography> : null}

      <Card variant="outlined">
        <CardContent>
          <Stack spacing={2}>
            <Box sx={{ display: 'flex', flexDirection: 'row', gap: 2, flexWrap: 'wrap' }}>
              <Button
                variant="outlined"
                onClick={() => window.open('/api/shacl/export', '_blank')}
              >
                Export SHACL (.ttl)
              </Button>
              <Button
                variant="contained"
                onClick={() =>
                  void validateGraph({
                    setValidationReport,
                    setErrorMessage,
                    setIsLoading,
                  })
                }
              >
                Validate current RDF
              </Button>
              <Button
                variant="text"
                color="inherit"
                onClick={() => setValidationReport(null)}
              >
                Clear report
              </Button>
            </Box>

            {validationReport ? (
              <ValidationReport report={validationReport} />
            ) : null}

            <Divider />

            <Box sx={{ overflowX: 'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>ID</TableCell>
                    <TableCell>Name</TableCell>
                    <TableCell>Target</TableCell>
                    <TableCell>Kind</TableCell>
                    <TableCell>Property IRI</TableCell>
                    <TableCell>Enabled</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rules.map((rule) => (
                    <TableRow key={rule.id} hover>
                      <TableCell>{rule.id}</TableCell>
                      <TableCell>{rule.rule_name}</TableCell>
                      <TableCell>{rule.target_entity}</TableCell>
                      <TableCell>{rule.rule_kind}</TableCell>
                      <TableCell sx={{ maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {rule.property_iri}
                      </TableCell>
                      <TableCell>{rule.is_enabled ? 'Yes' : 'No'}</TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={1}>
                          <IconButton
                            size="small"
                            onClick={() =>
                              openEditDialog({
                                rule,
                                setEditingRule,
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
                              void deleteRuleAndReload({
                                ruleId: rule.id,
                                setRules,
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
                  {rules.length === 0 && !isLoading ? (
                    <TableRow>
                      <TableCell colSpan={7}>
                        <Typography variant="body2" color="text.secondary">
                          No rules yet.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </Box>
          </Stack>
        </CardContent>
      </Card>

      <RuleDialog
        isOpen={isDialogOpen}
        editingRule={editingRule}
        formData={formData}
        setFormData={setFormData}
        entityColumns={entityColumns}
        entities={entities}
        onClose={() => setIsDialogOpen(false)}
        onSave={() =>
          void saveRuleAndReload({
            editingRule,
            formData,
            setRules,
            setErrorMessage,
            setIsLoading,
            setIsDialogOpen,
            setEditingRule,
          })
        }
      />
    </Stack>
  )
}

/* Render a validation report summary and results list. */
function ValidationReport({ report }) {
  const results = Array.isArray(report.results) ? report.results : []

  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="h6">Validation report</Typography>
        <Typography variant="body2" color="text.secondary">
          Conforms: {report.conforms ? 'Yes' : 'No'} • Results: {results.length} • Execution:{' '}
          {report.executionTimeMs ?? '?'} ms
        </Typography>

        {results.length > 0 ? (
          <Box sx={{ mt: 2, overflowX: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Message</TableCell>
                  <TableCell>Focus node</TableCell>
                  <TableCell>Path</TableCell>
                  <TableCell>Severity</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {results.slice(0, 50).map((result, index) => (
                  <TableRow key={index} hover>
                    <TableCell sx={{ maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {result.message || ''}
                    </TableCell>
                    <TableCell sx={{ maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {result.focusNode || ''}
                    </TableCell>
                    <TableCell sx={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {result.path || ''}
                    </TableCell>
                    <TableCell sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {result.severity || ''}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        ) : null}
      </CardContent>
    </Card>
  )
}

/* Render dialog for creating/editing a rule. */
function RuleDialog({ isOpen, editingRule, formData, setFormData, entityColumns, entities, onClose, onSave }) {
  const targetColumns = entityColumns.get(formData.target_entity) || ['id']
  const allowedValuesText = Array.isArray(formData.allowed_values) ? formData.allowed_values.join('\n') : ''

  const kindOptions = [
    { id: 'minCount', label: 'Required (min count)' },
    { id: 'datatype', label: 'Datatype' },
    { id: 'pattern', label: 'Pattern (regex)' },
    { id: 'in', label: 'Allowed values (in-list)' },
  ]

  return (
    <Dialog open={isOpen} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>{editingRule ? 'Edit rule' : 'Add rule'}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
        <TextField
          label="Rule name"
          value={formData.rule_name}
          onChange={(event) => setFormData((prev) => ({ ...prev, rule_name: event.target.value }))}
          required
        />

        <Box sx={{ display: 'flex', flexDirection: 'row', gap: 2, flexWrap: 'wrap' }}>
          <TextField
            select
            label="Target entity"
            value={formData.target_entity}
            onChange={(event) => {
              const nextEntity = event.target.value
              setFormData((prev) => ({
                ...prev,
                target_entity: nextEntity,
                property_iri: prev.property_iri,
              }))
            }}
            sx={{ flex: '1 1 260px' }}
          >
            {entities.map((entity) => (
              <MenuItem key={entity.entity_name} value={entity.entity_name}>
                {entity.display_name || entity.entity_name}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            label="Rule kind"
            value={formData.rule_kind}
            onChange={(event) => setFormData((prev) => ({ ...prev, rule_kind: event.target.value }))}
            sx={{ flex: '1 1 260px' }}
          >
            {kindOptions.map((option) => (
              <MenuItem key={option.id} value={option.id}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
        </Box>

        <TextField
          label="Property IRI (path)"
          value={formData.property_iri}
          onChange={(event) => setFormData((prev) => ({ ...prev, property_iri: event.target.value }))}
          placeholder="http://example.com/ontology#accountName"
          required
        />

        {formData.rule_kind === 'minCount' ? (
          <Box sx={{ display: 'flex', flexDirection: 'row', gap: 2, flexWrap: 'wrap' }}>
            <TextField
              label="Min count"
              type="number"
              value={formData.min_count ?? 1}
              onChange={(event) => setFormData((prev) => ({ ...prev, min_count: Number(event.target.value) }))}
              sx={{ width: 200 }}
            />
            <TextField
              label="Max count (optional)"
              type="number"
              value={formData.max_count ?? ''}
              onChange={(event) =>
                setFormData((prev) => ({
                  ...prev,
                  max_count: event.target.value === '' ? null : Number(event.target.value),
                }))
              }
              sx={{ width: 220 }}
            />
          </Box>
        ) : null}

        {formData.rule_kind === 'datatype' ? (
          <TextField
            label="Datatype IRI"
            value={formData.datatype_iri || ''}
            onChange={(event) => setFormData((prev) => ({ ...prev, datatype_iri: event.target.value }))}
            placeholder="http://www.w3.org/2001/XMLSchema#string"
            required
          />
        ) : null}

        {formData.rule_kind === 'pattern' ? (
          <TextField
            label="Pattern (regex)"
            value={formData.pattern || ''}
            onChange={(event) => setFormData((prev) => ({ ...prev, pattern: event.target.value }))}
            placeholder="^.+@.+\\..+$"
            required
          />
        ) : null}

        {formData.rule_kind === 'in' ? (
          <TextField
            label="Allowed values (one per line)"
            value={allowedValuesText}
            onChange={(event) =>
              setFormData((prev) => ({
                ...prev,
                allowed_values: event.target.value
                  .split('\n')
                  .map((value) => value.trim())
                  .filter(Boolean),
              }))
            }
            multiline
            minRows={4}
          />
        ) : null}

        <TextField
          label="Message (optional)"
          value={formData.message || ''}
          onChange={(event) => setFormData((prev) => ({ ...prev, message: event.target.value }))}
          placeholder="Human-friendly error message"
        />

        <FormControlLabel
          control={
            <Checkbox
              checked={Boolean(formData.is_enabled)}
              onChange={(event) => setFormData((prev) => ({ ...prev, is_enabled: event.target.checked ? 1 : 0 }))}
            />
          }
          label="Enabled"
        />

        <Typography variant="caption" color="text.secondary">
          Note: For now, the UI focuses on simple property constraints. More advanced SHACL (node constraints, property paths, SPARQL constraints) can be added later.
        </Typography>
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

/* Create a blank rule form. */
function createEmptyRuleForm() {
  return {
    rule_name: '',
    target_entity: 'accounts',
    rule_kind: 'minCount',
    property_iri: 'http://example.com/ontology#accountName',
    datatype_iri: 'http://www.w3.org/2001/XMLSchema#string',
    pattern: '^.+$',
    allowed_values: [],
    min_count: 1,
    max_count: null,
    message: null,
    severity_iri: null,
    is_enabled: 1,
  }
}

/* Load rules from backend. */
async function loadRules({ setRules, setErrorMessage, setIsLoading }) {
  setIsLoading(true)
  setErrorMessage('')
  try {
    const response = await apiClient.get('/rules')
    setRules(Array.isArray(response.data) ? response.data : [])
  } catch (error) {
    setErrorMessage(getErrorMessage(error))
  } finally {
    setIsLoading(false)
  }
}

/* Load entities (custom entities only) so rules can target them. */
async function loadEntities({ setEntities }) {
  try {
    const response = await apiClient.get('/entities')
    setEntities(Array.isArray(response.data) ? response.data : [])
  } catch (error) {
    setEntities([])
  }
}

/* Open create dialog. */
function openCreateDialog({ setEditingRule, setFormData, setIsDialogOpen }) {
  setEditingRule(null)
  setFormData(createEmptyRuleForm())
  setIsDialogOpen(true)
}

/* Open edit dialog. */
function openEditDialog({ rule, setEditingRule, setFormData, setIsDialogOpen }) {
  setEditingRule(rule)
  setFormData({
    rule_name: rule.rule_name || '',
    target_entity: rule.target_entity || 'accounts',
    rule_kind: rule.rule_kind || 'minCount',
    property_iri: rule.property_iri || '',
    datatype_iri: rule.datatype_iri || '',
    pattern: rule.pattern || '',
    allowed_values: parseAllowedValues(rule.allowed_values_json),
    min_count: rule.min_count,
    max_count: rule.max_count,
    message: rule.message || null,
    severity_iri: rule.severity_iri || null,
    is_enabled: rule.is_enabled ? 1 : 0,
  })
  setIsDialogOpen(true)
}

/* Create/update rule then reload list. */
async function saveRuleAndReload({
  editingRule,
  formData,
  setRules,
  setErrorMessage,
  setIsLoading,
  setIsDialogOpen,
  setEditingRule,
}) {
  setIsLoading(true)
  setErrorMessage('')
  try {
    const payload = normalizeRulePayload(formData)
    if (editingRule) {
      await apiClient.put(`/rules/${editingRule.id}`, payload)
    } else {
      await apiClient.post('/rules', payload)
    }

    setIsDialogOpen(false)
    setEditingRule(null)
    await loadRules({ setRules, setErrorMessage, setIsLoading })
  } catch (error) {
    setErrorMessage(getErrorMessage(error))
  } finally {
    setIsLoading(false)
  }
}

/* Delete rule then reload list. */
async function deleteRuleAndReload({ ruleId, setRules, setErrorMessage, setIsLoading }) {
  const shouldDelete = window.confirm('Delete this rule?')
  if (!shouldDelete) {
    return
  }

  setIsLoading(true)
  setErrorMessage('')
  try {
    await apiClient.delete(`/rules/${ruleId}`)
    await loadRules({ setRules, setErrorMessage, setIsLoading })
  } catch (error) {
    setErrorMessage(getErrorMessage(error))
  } finally {
    setIsLoading(false)
  }
}

/* Validate the current RDF graph against rules. */
async function validateGraph({ setValidationReport, setErrorMessage, setIsLoading }) {
  setIsLoading(true)
  setErrorMessage('')
  try {
    const response = await apiClient.post('/shacl/validate', {
      includeOntology: true,
      includeData: true,
      maxRowsPerEntity: 200,
    })
    setValidationReport(response.data || null)
  } catch (error) {
    setErrorMessage(getErrorMessage(error))
  } finally {
    setIsLoading(false)
  }
}

/* Convert form data into backend payload. */
function normalizeRulePayload(formData) {
  const safeFormData = formData && typeof formData === 'object' ? formData : {}

  return {
    rule_name: String(safeFormData.rule_name || '').trim(),
    target_entity: String(safeFormData.target_entity || '').trim(),
    rule_kind: String(safeFormData.rule_kind || '').trim(),
    property_iri: String(safeFormData.property_iri || '').trim(),
    datatype_iri: safeFormData.datatype_iri ? String(safeFormData.datatype_iri).trim() : null,
    pattern: safeFormData.pattern ? String(safeFormData.pattern).trim() : null,
    allowed_values: Array.isArray(safeFormData.allowed_values) ? safeFormData.allowed_values : null,
    min_count: safeFormData.min_count === null || safeFormData.min_count === undefined ? null : Number(safeFormData.min_count),
    max_count: safeFormData.max_count === null || safeFormData.max_count === undefined ? null : Number(safeFormData.max_count),
    message: safeFormData.message ? String(safeFormData.message).trim() : null,
    severity_iri: safeFormData.severity_iri ? String(safeFormData.severity_iri).trim() : null,
    is_enabled: safeFormData.is_enabled ? 1 : 0,
  }
}

/* Parse allowed values JSON stored by backend. */
function parseAllowedValues(allowedValuesJson) {
  try {
    const parsed = JSON.parse(String(allowedValuesJson || '[]'))
    return Array.isArray(parsed) ? parsed : []
  } catch (error) {
    return []
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

