import React, { useEffect, useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import {
  Box,
  Button,
  Card,
  CardContent,
  Divider,
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
import { apiClient } from '../api/apiClient'
import { CreateCustomEntityDialog } from '../components/CreateCustomEntityDialog.jsx'
import { buildInitialEntityFormFromLandingPayload } from '../customEntities/landingPayloadToEntityForm.js'

/* Show payloads that auto-inject could not route into a known Object (landing zone). */
export function LandingZonePage() {
  const [rows, setRows] = useState([])
  const [rowLimit, setRowLimit] = useState(100)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [entities, setEntities] = useState([])
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [createEntitySeedForm, setCreateEntitySeedForm] = useState(null)

  useEffect(() => {
    void loadLandingRows({ rowLimit, setRows, setErrorMessage, setIsLoading })
  }, [rowLimit])

  useEffect(() => {
    void loadEntitiesForDialog({ setEntities, setErrorMessage })
  }, [])

  return (
    <Stack spacing={2}>
      <Box sx={{ display: 'flex', flexDirection: 'row', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
        <Typography variant="h5" sx={{ flexGrow: 1 }}>
          Landing zone
        </Typography>
        <TextField
          select
          size="small"
          label="Rows"
          value={rowLimit}
          onChange={(event) => setRowLimit(Number(event.target.value))}
          sx={{ width: 120 }}
        >
          <MenuItem value={50}>50</MenuItem>
          <MenuItem value={100}>100</MenuItem>
          <MenuItem value={200}>200</MenuItem>
          <MenuItem value={500}>500</MenuItem>
        </TextField>
        <Button component={RouterLink} to="/custom-entities" variant="text" color="inherit">
          Objects
        </Button>
        <Button component={RouterLink} to="/automation" variant="text" color="inherit">
          Ingestion Pipelines
        </Button>
        <Button
          variant="outlined"
          disabled={isLoading}
          onClick={() =>
            void loadLandingRows({ rowLimit, setRows, setErrorMessage, setIsLoading })
          }
        >
          Refresh
        </Button>
      </Box>

      <Typography variant="body2" color="text.secondary">
        Payloads from <strong>POST /api/auto-inject</strong> that did not match any Object schema (or failed insert)
        are stored here for review. Fix your schemas or column names, then re-send traffic from{' '}
        <strong>Ingestion Pipelines</strong>.
      </Typography>

      {errorMessage ? <Typography color="error">{errorMessage}</Typography> : null}

      <Card variant="outlined">
        <CardContent>
          <Typography variant="h6">Unmatched payloads</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Source: <code>GET /api/auto-inject/unmapped</code>
          </Typography>

          <Divider sx={{ my: 2 }} />

          {rows.length === 0 && !isLoading ? (
            <Typography variant="body2" color="text.secondary">
              No rows in the landing zone. Unmatched auto-inject payloads will appear here.
            </Typography>
          ) : (
            <Box sx={{ overflowX: 'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>ID</TableCell>
                    <TableCell>Received</TableCell>
                    <TableCell>Source</TableCell>
                    <TableCell>Reason</TableCell>
                    <TableCell sx={{ minWidth: 280 }}>Payload</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id} hover>
                      <TableCell>{row.id}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatReceivedAt(row.created_at)}</TableCell>
                      <TableCell>{row.source || ''}</TableCell>
                      <TableCell sx={{ maxWidth: 280 }}>
                        <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>
                          {row.reason || ''}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography
                          variant="body2"
                          sx={{ fontFamily: 'monospace', fontSize: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                        >
                          {truncateJson(row.payload !== undefined ? row.payload : safeParsePayloadJson(row.payload_json))}
                        </Typography>
                      </TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => {
                            const payload =
                              row.payload !== undefined ? row.payload : safeParsePayloadJson(row.payload_json)
                            setCreateEntitySeedForm(buildInitialEntityFormFromLandingPayload(payload, row.id))
                            setIsCreateDialogOpen(true)
                          }}
                        >
                          Create object from payload
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          )}
        </CardContent>
      </Card>

      <CreateCustomEntityDialog
        open={isCreateDialogOpen}
        onClose={() => {
          setIsCreateDialogOpen(false)
          setCreateEntitySeedForm(null)
        }}
        entities={entities}
        initialFormData={createEntitySeedForm}
        onCreated={async () => {
          await loadEntitiesForDialog({ setEntities, setErrorMessage })
          await loadLandingRows({ rowLimit, setRows, setErrorMessage, setIsLoading })
        }}
      />
    </Stack>
  )
}

/* Load existing Objects so the create dialog can validate unique entity names. */
async function loadEntitiesForDialog({ setEntities, setErrorMessage }) {
  try {
    const response = await apiClient.get('/custom-entities')
    setEntities(Array.isArray(response.data) ? response.data : [])
  } catch (error) {
    setErrorMessage(getErrorMessage(error))
    setEntities([])
  }
}

/* Load recent landing-zone rows from the API. */
async function loadLandingRows({ rowLimit, setRows, setErrorMessage, setIsLoading }) {
  setIsLoading(true)
  setErrorMessage('')
  try {
    const response = await apiClient.get('/auto-inject/unmapped', {
      params: { limit: rowLimit },
    })
    setRows(Array.isArray(response.data) ? response.data : [])
  } catch (error) {
    setErrorMessage(getErrorMessage(error))
    setRows([])
  } finally {
    setIsLoading(false)
  }
}

/* Format SQLite / ISO timestamps for display in the table. */
function formatReceivedAt(value) {
  if (value === null || value === undefined || value === '') {
    return ''
  }
  const parsed = new Date(String(value))
  if (Number.isNaN(parsed.getTime())) {
    return String(value)
  }
  return parsed.toLocaleString()
}

/* Parse payload_json if the API did not attach a parsed payload field. */
function safeParsePayloadJson(payloadJson) {
  try {
    return JSON.parse(String(payloadJson || 'null'))
  } catch (error) {
    return null
  }
}

/* Shorten JSON for dense table cells. */
function truncateJson(value) {
  const text = JSON.stringify(value || {})
  if (text.length <= 400) {
    return text
  }
  return `${text.slice(0, 400)}…`
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
