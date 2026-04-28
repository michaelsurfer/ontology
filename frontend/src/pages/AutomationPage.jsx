import React, { useEffect, useMemo, useState } from 'react'
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

/* Show ingestion endpoint, draft suggestions, and a publish workflow. */
export function AutomationPage() {
  const [statusFilter, setStatusFilter] = useState('draft')
  const [suggestions, setSuggestions] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [publishResult, setPublishResult] = useState(null)

  const [testEventJsonText, setTestEventJsonText] = useState(createDefaultTestEventJson())
  const [ingestResult, setIngestResult] = useState(null)

  useEffect(() => {
    void loadSuggestions({ statusFilter, setSuggestions, setErrorMessage, setIsLoading })
  }, [statusFilter])

  const suggestionCounts = useMemo(() => {
    const counts = { draft: 0, approved: 0, rejected: 0, published: 0 }
    for (const item of suggestions) {
      const key = String(item.status || '')
      if (counts[key] !== undefined) {
        counts[key] += 1
      }
    }
    return counts
  }, [suggestions])

  return (
    <Stack spacing={2}>
      <Box sx={{ display: 'flex', flexDirection: 'row', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
        <Typography variant="h5" sx={{ flexGrow: 1 }}>
          Automation
        </Typography>
        <TextField
          select
          size="small"
          label="Status"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          sx={{ width: 220 }}
        >
          <MenuItem value="draft">Draft</MenuItem>
          <MenuItem value="approved">Approved</MenuItem>
          <MenuItem value="rejected">Rejected</MenuItem>
          <MenuItem value="published">Published</MenuItem>
          <MenuItem value="">All</MenuItem>
        </TextField>
        <Button
          variant="outlined"
          onClick={() => void loadSuggestions({ statusFilter, setSuggestions, setErrorMessage, setIsLoading })}
        >
          Refresh
        </Button>
        <Button
          variant="text"
          color="error"
          disabled={isLoading || statusFilter !== 'draft'}
          onClick={() =>
            void deleteDraftSuggestionsAndReload({
              setErrorMessage,
              setIsLoading,
              statusFilter,
              setSuggestions,
            })
          }
        >
          Clear drafts
        </Button>
        <Button
          variant="contained"
          disabled={isLoading}
          onClick={() =>
            void publishApprovedAndReload({
              setPublishResult,
              setErrorMessage,
              setIsLoading,
              statusFilter,
              setSuggestions,
            })
          }
        >
          Publish approved
        </Button>
      </Box>

      <Typography variant="body2" color="text.secondary">
        This page supports “review before apply”. Data arrives via the ingestion endpoint, OntoX generates draft
        suggestions (entities, fields, relationships, rules), and you approve + publish them into the live ontology.
      </Typography>

      {errorMessage ? <Typography color="error">{errorMessage}</Typography> : null}

      <Card variant="outlined">
        <CardContent>
          <Typography variant="h6">Ingestion API</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Send events to <b>POST /api/ingest/events</b>. This stores raw events and generates draft suggestions.
          </Typography>

          <Divider sx={{ my: 2 }} />

          <Typography variant="subtitle2">Send a test event</Typography>
          <Typography variant="body2" color="text.secondary">
            Paste JSON and click “Ingest”. This is useful for demos and for building SDK/webhook payloads.
          </Typography>

          <TextField
            value={testEventJsonText}
            onChange={(event) => setTestEventJsonText(event.target.value)}
            multiline
            minRows={8}
            sx={{ mt: 1 }}
            fullWidth
            inputProps={{ style: { fontFamily: 'monospace' } }}
          />

          <Box sx={{ display: 'flex', flexDirection: 'row', gap: 1, mt: 1, flexWrap: 'wrap' }}>
            <Button
              variant="contained"
              disabled={isLoading}
              onClick={() =>
                void ingestTestEvent({
                  testEventJsonText,
                  setIngestResult,
                  setErrorMessage,
                  setIsLoading,
                  setStatusFilter,
                  setSuggestions,
                })
              }
            >
              Ingest
            </Button>
            <Button variant="text" color="inherit" onClick={() => setTestEventJsonText(createDefaultTestEventJson())}>
              Reset example
            </Button>
          </Box>

          {ingestResult ? (
            <Typography variant="body2" sx={{ mt: 1, fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
              {JSON.stringify(ingestResult, null, 2)}
            </Typography>
          ) : null}
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent>
          <Box sx={{ display: 'flex', flexDirection: 'row', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
            <Typography variant="h6" sx={{ flexGrow: 1 }}>
              Suggestions
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Draft: {suggestionCounts.draft} | Approved: {suggestionCounts.approved} | Published:{' '}
              {suggestionCounts.published}
            </Typography>
          </Box>

          <Divider sx={{ my: 2 }} />

          <Box sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>ID</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Title</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Confidence</TableCell>
                  <TableCell>AI summary</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {suggestions.map((item) => (
                  <TableRow key={item.id} hover>
                    <TableCell>{item.id}</TableCell>
                    <TableCell>{item.suggestion_type}</TableCell>
                    <TableCell sx={{ minWidth: 320 }}>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        {item.title}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                        {truncateJson(item.proposal)}
                      </Typography>
                    </TableCell>
                    <TableCell>{item.status}</TableCell>
                    <TableCell>{item.confidence === null || item.confidence === undefined ? '' : item.confidence}</TableCell>
                    <TableCell sx={{ minWidth: 240 }}>
                      <Typography variant="body2" color="text.secondary">
                        {item.ai_summary || ''}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
                        <Button
                          size="small"
                          variant="outlined"
                          disabled={isLoading || item.status === 'published'}
                          onClick={() =>
                            void approveSuggestionAndReload({
                              suggestionId: item.id,
                              statusFilter,
                              setSuggestions,
                              setErrorMessage,
                              setIsLoading,
                            })
                          }
                        >
                          Approve
                        </Button>
                        <Button
                          size="small"
                          variant="text"
                          color="error"
                          disabled={isLoading || item.status === 'published'}
                          onClick={() =>
                            void rejectSuggestionAndReload({
                              suggestionId: item.id,
                              statusFilter,
                              setSuggestions,
                              setErrorMessage,
                              setIsLoading,
                            })
                          }
                        >
                          Reject
                        </Button>
                        <Button
                          size="small"
                          variant="text"
                          color="error"
                          disabled={isLoading || item.status === 'published'}
                          onClick={() =>
                            void deleteSuggestionAndReload({
                              suggestionId: item.id,
                              statusFilter,
                              setSuggestions,
                              setErrorMessage,
                              setIsLoading,
                            })
                          }
                        >
                          Delete
                        </Button>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}

                {suggestions.length === 0 && !isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7}>
                      <Typography variant="body2" color="text.secondary">
                        No suggestions in this view yet. Ingest events to generate draft suggestions.
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </Box>
        </CardContent>
      </Card>

      {publishResult ? (
        <Card variant="outlined">
          <CardContent>
            <Typography variant="h6">Publish result</Typography>
            <Typography variant="body2" sx={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap', mt: 1 }}>
              {JSON.stringify(publishResult, null, 2)}
            </Typography>
          </CardContent>
        </Card>
      ) : null}
    </Stack>
  )
}

/* Load suggestions from the backend with optional status filtering. */
async function loadSuggestions({ statusFilter, setSuggestions, setErrorMessage, setIsLoading }) {
  setIsLoading(true)
  setErrorMessage('')
  try {
    const params = {}
    if (statusFilter) {
      params.status = statusFilter
    }
    const response = await apiClient.get('/suggestions', { params })
    setSuggestions(Array.isArray(response.data) ? response.data : [])
  } catch (error) {
    setErrorMessage(getErrorMessage(error))
  } finally {
    setIsLoading(false)
  }
}

/* Approve a suggestion then reload the list. */
async function approveSuggestionAndReload({
  suggestionId,
  statusFilter,
  setSuggestions,
  setErrorMessage,
  setIsLoading,
}) {
  setIsLoading(true)
  setErrorMessage('')
  try {
    await apiClient.post(`/suggestions/${suggestionId}/approve`)
    await loadSuggestions({ statusFilter, setSuggestions, setErrorMessage, setIsLoading })
  } catch (error) {
    setErrorMessage(getErrorMessage(error))
  } finally {
    setIsLoading(false)
  }
}

/* Reject a suggestion then reload the list. */
async function rejectSuggestionAndReload({
  suggestionId,
  statusFilter,
  setSuggestions,
  setErrorMessage,
  setIsLoading,
}) {
  setIsLoading(true)
  setErrorMessage('')
  try {
    await apiClient.post(`/suggestions/${suggestionId}/reject`)
    await loadSuggestions({ statusFilter, setSuggestions, setErrorMessage, setIsLoading })
  } catch (error) {
    setErrorMessage(getErrorMessage(error))
  } finally {
    setIsLoading(false)
  }
}

/* Publish all approved suggestions, then reload the list. */
async function publishApprovedAndReload({
  setPublishResult,
  setErrorMessage,
  setIsLoading,
  statusFilter,
  setSuggestions,
}) {
  setIsLoading(true)
  setErrorMessage('')
  setPublishResult(null)
  try {
    const response = await apiClient.post('/suggestions/publish')
    setPublishResult(response.data || null)
    await loadSuggestions({ statusFilter, setSuggestions, setErrorMessage, setIsLoading })
  } catch (error) {
    setErrorMessage(getErrorMessage(error))
  } finally {
    setIsLoading(false)
  }
}

/* Delete a suggestion, then reload the list. */
async function deleteSuggestionAndReload({
  suggestionId,
  statusFilter,
  setSuggestions,
  setErrorMessage,
  setIsLoading,
}) {
  const shouldDelete = window.confirm(`Delete suggestion #${suggestionId}?`)
  if (!shouldDelete) {
    return
  }

  setIsLoading(true)
  setErrorMessage('')
  try {
    await apiClient.delete(`/suggestions/${suggestionId}`)
    await loadSuggestions({ statusFilter, setSuggestions, setErrorMessage, setIsLoading })
  } catch (error) {
    setErrorMessage(getErrorMessage(error))
  } finally {
    setIsLoading(false)
  }
}

/* Bulk delete draft suggestions, then reload. */
async function deleteDraftSuggestionsAndReload({ setErrorMessage, setIsLoading, statusFilter, setSuggestions }) {
  const shouldDelete = window.confirm('Delete ALL draft suggestions? This cannot be undone.')
  if (!shouldDelete) {
    return
  }

  setIsLoading(true)
  setErrorMessage('')
  try {
    await apiClient.delete('/suggestions', { params: { status: 'draft' } })
    await loadSuggestions({ statusFilter, setSuggestions, setErrorMessage, setIsLoading })
  } catch (error) {
    setErrorMessage(getErrorMessage(error))
  } finally {
    setIsLoading(false)
  }
}

/* Ingest a test event JSON payload and switch to draft view. */
async function ingestTestEvent({
  testEventJsonText,
  setIngestResult,
  setErrorMessage,
  setIsLoading,
  setStatusFilter,
  setSuggestions,
}) {
  setIsLoading(true)
  setErrorMessage('')
  setIngestResult(null)
  try {
    const parsed = JSON.parse(String(testEventJsonText || '{}'))
    const response = await apiClient.post('/ingest/events', parsed)
    setIngestResult(response.data || null)
    setStatusFilter('draft')
    await loadSuggestions({
      statusFilter: 'draft',
      setSuggestions,
      setErrorMessage,
      setIsLoading,
    })
  } catch (error) {
    if (error instanceof SyntaxError) {
      setErrorMessage('Invalid JSON in test event')
    } else {
      setErrorMessage(getErrorMessage(error))
    }
  } finally {
    setIsLoading(false)
  }
}

/* Create a default ingestion event payload for testing. */
function createDefaultTestEventJson() {
  return JSON.stringify(
    {
      source: 'demo',
      events: [
        {
          entityType: 'ticket',
          operation: 'upsert',
          externalId: 'zendesk:ticket:123',
          occurredAt: new Date().toISOString(),
          attributes: {
            subject: 'Need help with my order',
            status: 'open',
            priority: 'high',
            requester_email: 'jane.doe@acme.example',
            order_external_id: 'shopify:order:1001',
          },
          links: [
            {
              predicate: 'relatedToOrder',
              targetEntityType: 'order',
              targetExternalId: 'shopify:order:1001',
            },
          ],
        },
      ],
    },
    null,
    2,
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

/* Truncate a proposal object into a compact preview string. */
function truncateJson(value) {
  const text = JSON.stringify(value || {})
  if (text.length <= 220) {
    return text
  }
  return `${text.slice(0, 220)}…`
}

