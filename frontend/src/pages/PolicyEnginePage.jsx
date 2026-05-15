import React, { useCallback, useMemo, useRef, useState } from 'react'
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Drawer,
  IconButton,
  Link,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Stack,
  Step,
  StepLabel,
  Stepper,
  TextField,
  Typography,
} from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import CloseIcon from '@mui/icons-material/Close'
import ReactFlow, { Background, Controls, Handle, Position } from 'reactflow'
import 'reactflow/dist/style.css'
import { apiClient, LONG_RUNNING_AI_TIMEOUT_MS } from '../api/apiClient'

const steps = ['Upload & extract documents', 'Describe policy & view graph']

/* Color map for policy node kinds. */
const KIND_COLOR_MAP = {
  obligation: '#1565c0',
  control: '#2e7d32',
  risk: '#b71c1c',
  actor: '#6a1b9a',
  data: '#e65100',
  process: '#00695c',
}

function kindColor(kind) {
  const normalizedKind = String(kind || '').toLowerCase().trim()
  return KIND_COLOR_MAP[normalizedKind] || '#546e7a'
}

/* Custom node rendered inside React Flow. */
function PolicyGraphNode({ data, selected }) {
  const theme = useTheme()
  const color = kindColor(data?.kind)
  const isSelected = Boolean(selected)

  return (
    <Box
      sx={{
        px: 1.5,
        py: 1,
        borderRadius: 2,
        border: '2px solid',
        borderColor: isSelected ? color : alpha(color, 0.4),
        bgcolor: isSelected ? alpha(color, theme.palette.mode === 'dark' ? 0.22 : 0.08) : 'background.paper',
        minWidth: 150,
        maxWidth: 220,
        boxShadow: isSelected ? 4 : 1,
        cursor: 'pointer',
        transition: 'border-color 0.15s, box-shadow 0.15s',
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        style={{ width: 10, height: 10, background: color, border: '2px solid white' }}
      />
      <Typography
        variant="subtitle2"
        sx={{ fontWeight: 700, textAlign: 'center', lineHeight: 1.3, color: isSelected ? color : 'text.primary' }}
      >
        {data?.label || 'Node'}
      </Typography>
      {data?.kind ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 0.5 }}>
          <Chip
            label={data.kind}
            size="small"
            sx={{
              height: 18,
              fontSize: 10,
              fontWeight: 700,
              bgcolor: alpha(color, 0.15),
              color: color,
              borderRadius: 1,
            }}
          />
        </Box>
      ) : null}
      <Handle
        type="source"
        position={Position.Right}
        style={{ width: 10, height: 10, background: color, border: '2px solid white' }}
      />
    </Box>
  )
}

const policyNodeTypes = {
  policyGraphNode: PolicyGraphNode,
}

/* A single labelled section inside the detail panel. */
function DetailSection({ title, children }) {
  return (
    <Box sx={{ mb: 2 }}>
      <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700, fontSize: 10, letterSpacing: 1 }}>
        {title}
      </Typography>
      <Box sx={{ mt: 0.5 }}>{children}</Box>
    </Box>
  )
}

/* Render a bulleted plain-text list. */
function BulletList({ items }) {
  if (!items || items.length === 0) {
    return (
      <Typography variant="body2" color="text.disabled">
        None identified
      </Typography>
    )
  }
  return (
    <Stack spacing={0.5}>
      {items.map((text, index) => (
        <Box key={index} sx={{ display: 'flex', flexDirection: 'row', gap: 1, alignItems: 'flex-start' }}>
          <Typography variant="body2" sx={{ mt: 0.1 }}>
            •
          </Typography>
          <Typography variant="body2">{text}</Typography>
        </Box>
      ))}
    </Stack>
  )
}

/* Side panel shown when a node is selected. */
function NodeDetailPanel({ node, edges, allNodes, onClose }) {
  const theme = useTheme()
  if (!node) {
    return null
  }

  const data = node.data || {}
  const color = kindColor(data.kind)

  const outgoingEdges = edges.filter((edge) => edge.source === node.id)
  const incomingEdges = edges.filter((edge) => edge.target === node.id)

  function resolveNodeLabel(nodeId) {
    const found = allNodes.find((n) => n.id === nodeId)
    return found?.data?.label || nodeId
  }

  return (
    <Box
      sx={{
        width: 360,
        height: '100%',
        overflowY: 'auto',
        p: 2.5,
        borderLeft: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start', gap: 1, mb: 2 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h6" sx={{ fontWeight: 800, color }}>
            {data.label || 'Node'}
          </Typography>
          {data.kind ? (
            <Chip
              label={data.kind}
              size="small"
              sx={{
                mt: 0.5,
                height: 20,
                fontSize: 11,
                fontWeight: 700,
                bgcolor: alpha(color, 0.14),
                color: color,
                borderRadius: 1,
              }}
            />
          ) : null}
        </Box>
        <IconButton size="small" onClick={onClose}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      <Divider sx={{ mb: 2 }} />

      {data.description ? (
        <DetailSection title="What this means">
          <Typography variant="body2">{data.description}</Typography>
        </DetailSection>
      ) : null}

      {data.owner ? (
        <DetailSection title="Owner / responsible party">
          <Typography variant="body2">{data.owner}</Typography>
        </DetailSection>
      ) : null}

      {data.teams && data.teams.length > 0 ? (
        <DetailSection title="Involved teams">
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
            {data.teams.map((team) => (
              <Chip key={team} label={team} size="small" variant="outlined" sx={{ borderRadius: 1 }} />
            ))}
          </Box>
        </DetailSection>
      ) : null}

      <DetailSection title="Key rules">
        <BulletList items={data.key_rules} />
      </DetailSection>

      <DetailSection title="Risk if ignored">
        <BulletList items={data.risks_if_ignored} />
      </DetailSection>

      {(outgoingEdges.length > 0 || incomingEdges.length > 0) ? (
        <DetailSection title="Connections">
          <Stack spacing={0.5}>
            {outgoingEdges.map((edge) => (
              <Box key={edge.id} sx={{ display: 'flex', flexDirection: 'row', gap: 0.75, alignItems: 'flex-start' }}>
                <Typography variant="body2" sx={{ mt: 0.1 }}>→</Typography>
                <Typography variant="body2">
                  <b>{edge.label || 'related to'}</b>{' '}
                  <Typography component="span" variant="body2" color="text.secondary">
                    {resolveNodeLabel(edge.target)}
                  </Typography>
                </Typography>
              </Box>
            ))}
            {incomingEdges.map((edge) => (
              <Box key={edge.id} sx={{ display: 'flex', flexDirection: 'row', gap: 0.75, alignItems: 'flex-start' }}>
                <Typography variant="body2" sx={{ mt: 0.1 }}>←</Typography>
                <Typography variant="body2" color="text.secondary">
                  {resolveNodeLabel(edge.source)}
                </Typography>
                <Typography variant="body2">
                  {' '}<b>{edge.label || 'related to'}</b>{' '}this
                </Typography>
              </Box>
            ))}
          </Stack>
        </DetailSection>
      ) : null}

      {data.source_clauses && data.source_clauses.length > 0 ? (
        <DetailSection title="Where this appears in the documents">
          <Stack spacing={0.5}>
            {data.source_clauses.map((clause, index) => (
              <Typography key={index} variant="body2">
                {clause.document ? <b>{clause.document}</b> : null}
                {clause.document && clause.section ? ' — ' : null}
                {clause.section || null}
              </Typography>
            ))}
          </Stack>
        </DetailSection>
      ) : null}
    </Box>
  )
}

/* Map entity local_id values to human-readable names for relationship display. */
function buildEntityNameLookup(entities) {
  const map = new Map()
  for (const entity of entities || []) {
    if (entity && entity.local_id) {
      map.set(String(entity.local_id), String(entity.name || entity.local_id).trim())
    }
  }
  return map
}

/* Right-side drawer: full extraction detail for a concept, relationship, or document summary (step 1). */
function ExtractionDetailDrawer({ detail, onClose }) {
  const open = Boolean(detail)
  const title = detail
    ? detail.view === 'summary'
      ? 'Document overview'
      : detail.view === 'entity'
        ? 'Concept detail'
        : 'Relationship detail'
    : ''

  return (
    <Drawer anchor="right" open={open} onClose={onClose} PaperProps={{ sx: { width: { xs: '100%', sm: 440 }, p: 0 } }}>
      {detail ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'flex-start',
              gap: 1,
              p: 2,
              borderBottom: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700 }}>
                {detail.fileName}
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 800, mt: 0.5 }}>
                {title}
              </Typography>
            </Box>
            <IconButton size="small" onClick={onClose} aria-label="Close">
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>

          <Box sx={{ flex: 1, overflowY: 'auto', p: 2 }}>
            {detail.view === 'summary' ? (
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                {detail.summary || 'No summary was returned for this file.'}
              </Typography>
            ) : null}

            {detail.view === 'entity' && detail.entity ? (
              <Stack spacing={2}>
                <Box>
                  <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700 }}>
                    Name
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 700 }}>
                    {detail.entity.name}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700 }}>
                    Internal reference id
                  </Typography>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                    {detail.entity.local_id}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700 }}>
                    Description
                  </Typography>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                    {detail.entity.description || 'No description was provided for this concept.'}
                  </Typography>
                </Box>
              </Stack>
            ) : null}

            {detail.view === 'relationship' && detail.relationship ? (
              <Stack spacing={2}>
                <Box>
                  <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700 }}>
                    How things connect
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 700 }}>
                    {detail.fromName} → {detail.relationship.label} → {detail.toName}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700 }}>
                    From concept
                  </Typography>
                  <Typography variant="body2">
                    {detail.fromName}{' '}
                    <Typography
                      component="span"
                      variant="caption"
                      sx={{ fontFamily: 'monospace', color: 'text.secondary' }}
                    >
                      ({detail.relationship.from_local_id})
                    </Typography>
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700 }}>
                    To concept
                  </Typography>
                  <Typography variant="body2">
                    {detail.toName}{' '}
                    <Typography
                      component="span"
                      variant="caption"
                      sx={{ fontFamily: 'monospace', color: 'text.secondary' }}
                    >
                      ({detail.relationship.to_local_id})
                    </Typography>
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700 }}>
                    Relationship label
                  </Typography>
                  <Typography variant="body2">{detail.relationship.label}</Typography>
                </Box>
                <Box>
                  <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700 }}>
                    Notes
                  </Typography>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                    {detail.relationship.notes || 'No additional notes for this relationship.'}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700 }}>
                    Relationship reference id
                  </Typography>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                    {detail.relationship.local_id}
                  </Typography>
                </Box>
              </Stack>
            ) : null}
          </Box>
        </Box>
      ) : null}
    </Drawer>
  )
}

/* Ephemeral policy workflow: upload → OpenAI extract → prompt → OpenAI graph (nothing saved to SQLite). */
export function PolicyEnginePage() {
  const [activeStep, setActiveStep] = useState(0)
  const [documents, setDocuments] = useState([])
  const [stepOneExtractionDetail, setStepOneExtractionDetail] = useState(null)
  const [policyPromptText, setPolicyPromptText] = useState('')
  const [graphPayload, setGraphPayload] = useState(null)
  const [graphError, setGraphError] = useState('')
  const [isGeneratingGraph, setIsGeneratingGraph] = useState(false)
  const [selectedNodeId, setSelectedNodeId] = useState(null)
  const fileInputRef = useRef(null)

  const allExtractionsFinished = useMemo(() => {
    if (documents.length === 0) {
      return false
    }
    return documents.every((row) => row.status === 'done' || row.status === 'error')
  }, [documents])

  const hasSuccessfulExtraction = useMemo(() => {
    return documents.some((row) => row.status === 'done' && row.extraction)
  }, [documents])

  const flowNodes = graphPayload?.nodes || []
  const flowEdges = graphPayload?.edges || []

  const selectedNode = useMemo(() => {
    if (!selectedNodeId) {
      return null
    }
    return flowNodes.find((node) => node.id === selectedNodeId) || null
  }, [selectedNodeId, flowNodes])

  /* Append files and run OpenAI extraction per file in parallel. */
  const processIncomingFiles = useCallback(async (fileArray) => {
    const list = Array.from(fileArray || []).filter(Boolean)
    if (list.length === 0) {
      return
    }

    const newRows = list.map((file) => ({
      clientId: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      fileName: file.name,
      status: 'extracting',
      extraction: null,
      errorMessage: '',
    }))

    setDocuments((previous) => [...previous, ...newRows])

    await Promise.all(
      list.map(async (file, index) => {
        const rowMeta = newRows[index]
        const formData = new FormData()
        formData.append('file', file)
        try {
          const response = await apiClient.post('/policy-engine/extract', formData, {
            timeout: LONG_RUNNING_AI_TIMEOUT_MS,
          })
          setDocuments((previous) =>
            previous.map((row) =>
              row.clientId === rowMeta.clientId
                ? { ...row, status: 'done', extraction: response.data || null, errorMessage: '' }
                : row,
            ),
          )
        } catch (error) {
          setDocuments((previous) =>
            previous.map((row) =>
              row.clientId === rowMeta.clientId
                ? { ...row, status: 'error', extraction: null, errorMessage: getAxiosErrorMessage(error) }
                : row,
            ),
          )
        }
      }),
    )
  }, [])

  function handleDrop(event) {
    event.preventDefault()
    event.stopPropagation()
    const files = event.dataTransfer?.files
    if (files && files.length > 0) {
      void processIncomingFiles(files)
    }
  }

  function handleDragOver(event) {
    event.preventDefault()
    event.stopPropagation()
  }

  async function handleGeneratePolicyGraph() {
    setGraphError('')
    setGraphPayload(null)
    setSelectedNodeId(null)
    const extractionsPayload = documents
      .filter((row) => row.status === 'done' && row.extraction)
      .map((row) => ({
        file_name: row.extraction.file_name || row.fileName,
        summary: row.extraction.summary || '',
        entities: row.extraction.entities || [],
        relationships: row.extraction.relationships || [],
      }))

    if (extractionsPayload.length === 0) {
      setGraphError('At least one successful extraction is required.')
      return
    }

    const trimmedPrompt = String(policyPromptText || '').trim()
    if (!trimmedPrompt) {
      setGraphError('Please describe the policy you want to create.')
      return
    }

    setIsGeneratingGraph(true)
    try {
      const response = await apiClient.post(
        '/policy-engine/graph',
        { policyPrompt: trimmedPrompt, extractions: extractionsPayload },
        { timeout: LONG_RUNNING_AI_TIMEOUT_MS },
      )
      setGraphPayload(response.data || null)
    } catch (error) {
      setGraphError(getAxiosErrorMessage(error))
    } finally {
      setIsGeneratingGraph(false)
    }
  }

  function handleNodeClick(_event, node) {
    setSelectedNodeId((previous) => (previous === node.id ? null : node.id))
  }

  function handlePaneClick() {
    setSelectedNodeId(null)
  }

  return (
    <>
    <Stack spacing={3}>
      <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Typography variant="h5" sx={{ flexGrow: 1 }}>
          Policy Engine
        </Typography>
      </Box>

      <Typography variant="body2" color="text.secondary">
        Upload policy documents for AI extraction, then describe the policy graph you want. Nothing on this page is
        saved to the database — data exists only in your browser session.
      </Typography>

      <Stepper activeStep={activeStep} alternativeLabel sx={{ maxWidth: 720 }}>
        {steps.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {activeStep === 0 ? (
        <Card variant="outlined">
          <CardContent>
            <Typography variant="h6">Step 1 — Documents</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Drag files here or choose files. Supported: plain text, Markdown, CSV/JSON as UTF-8, and PDF (text
              layers). Each file is sent to the server and extracted immediately.
            </Typography>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              hidden
              onChange={(event) => {
                void processIncomingFiles(event.target.files)
                event.target.value = ''
              }}
            />

            <Box
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              sx={{
                mt: 2,
                py: 4,
                px: 2,
                borderRadius: 2,
                border: '2px dashed',
                borderColor: 'divider',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 1.5,
                bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'grey.900' : 'grey.50'),
              }}
            >
              <CloudUploadIcon color="primary" sx={{ fontSize: 40 }} />
              <Typography variant="body2" color="text.secondary">
                Drop files here
              </Typography>
              <Button variant="outlined" onClick={() => fileInputRef.current && fileInputRef.current.click()}>
                Choose files
              </Button>
            </Box>

            {documents.length > 0 ? (
              <>
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle2">Extraction status</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, mb: 1 }}>
                  After each file finishes, click a concept chip or a relationship row to read the full extracted text.
                  Use “View document overview” for the model&apos;s short summary of the whole file.
                </Typography>
                <Stack spacing={0}>
                  {documents.map((row) => {
                    const extraction = row.extraction
                    const entities = extraction?.entities || []
                    const relationships = extraction?.relationships || []
                    const nameLookup = buildEntityNameLookup(entities)

                    return (
                      <Box
                        key={row.clientId}
                        sx={{
                          py: 1.5,
                          borderBottom: '1px solid',
                          borderColor: 'divider',
                          '&:last-of-type': { borderBottom: 'none' },
                        }}
                      >
                        <Box sx={{ display: 'flex', flexDirection: 'row', gap: 1, alignItems: 'flex-start' }}>
                          {row.status === 'extracting' ? (
                            <CircularProgress size={22} sx={{ flexShrink: 0, mt: 0.25 }} />
                          ) : null}
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                              {row.fileName}
                            </Typography>
                            {row.status === 'extracting' ? (
                              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                Extracting with OpenAI…
                              </Typography>
                            ) : null}
                            {row.status === 'error' ? (
                              <Typography variant="body2" color="error" sx={{ mt: 0.5 }}>
                                {row.errorMessage || 'Failed'}
                              </Typography>
                            ) : null}
                            {row.status === 'done' && extraction ? (
                              <Stack spacing={1.25} sx={{ mt: 1 }}>
                                <Box
                                  sx={{
                                    display: 'flex',
                                    flexDirection: 'row',
                                    flexWrap: 'wrap',
                                    gap: 1,
                                    alignItems: 'center',
                                  }}
                                >
                                  <Chip size="small" variant="outlined" label={`${entities.length} concepts`} />
                                  <Chip size="small" variant="outlined" label={`${relationships.length} relationships`} />
                                  {extraction.summary ? (
                                    <Link
                                      component="button"
                                      type="button"
                                      variant="body2"
                                      onClick={() =>
                                        setStepOneExtractionDetail({
                                          view: 'summary',
                                          fileName: row.fileName,
                                          summary: extraction.summary,
                                        })
                                      }
                                      sx={{ cursor: 'pointer', verticalAlign: 'middle' }}
                                    >
                                      View document overview
                                    </Link>
                                  ) : null}
                                </Box>
                                <Box>
                                  <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', mb: 0.5 }}>
                                    Concepts (click for full detail)
                                  </Typography>
                                  <Box
                                    sx={{
                                      display: 'flex',
                                      flexDirection: 'row',
                                      flexWrap: 'wrap',
                                      gap: 0.75,
                                      maxHeight: 140,
                                      overflowY: 'auto',
                                    }}
                                  >
                                    {entities.length === 0 ? (
                                      <Typography variant="caption" color="text.disabled">
                                        None extracted
                                      </Typography>
                                    ) : (
                                      entities.map((entity) => (
                                        <Chip
                                          key={entity.local_id}
                                          label={entity.name}
                                          size="small"
                                          color="primary"
                                          variant="outlined"
                                          onClick={() =>
                                            setStepOneExtractionDetail({
                                              view: 'entity',
                                              fileName: row.fileName,
                                              entity,
                                            })
                                          }
                                          sx={{ cursor: 'pointer' }}
                                        />
                                      ))
                                    )}
                                  </Box>
                                </Box>
                                <Box>
                                  <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', mb: 0.5 }}>
                                    Relationships (click a row for full detail)
                                  </Typography>
                                  {relationships.length === 0 ? (
                                    <Typography variant="caption" color="text.disabled">
                                      None extracted
                                    </Typography>
                                  ) : (
                                    <List dense disablePadding sx={{ maxHeight: 200, overflowY: 'auto' }}>
                                      {relationships.map((rel) => (
                                        <ListItem key={rel.local_id} disablePadding sx={{ py: 0 }}>
                                          <ListItemButton
                                            dense
                                            onClick={() =>
                                              setStepOneExtractionDetail({
                                                view: 'relationship',
                                                fileName: row.fileName,
                                                relationship: rel,
                                                fromName:
                                                  nameLookup.get(rel.from_local_id) || rel.from_local_id,
                                                toName: nameLookup.get(rel.to_local_id) || rel.to_local_id,
                                              })
                                            }
                                            sx={{ borderRadius: 1, alignItems: 'flex-start' }}
                                          >
                                            <ListItemText
                                              primaryTypographyProps={{ variant: 'body2' }}
                                              secondaryTypographyProps={{ variant: 'caption', color: 'text.secondary' }}
                                              primary={`${nameLookup.get(rel.from_local_id) || rel.from_local_id} → ${rel.label} → ${nameLookup.get(rel.to_local_id) || rel.to_local_id}`}
                                              secondary={rel.notes ? rel.notes : null}
                                            />
                                          </ListItemButton>
                                        </ListItem>
                                      ))}
                                    </List>
                                  )}
                                </Box>
                              </Stack>
                            ) : null}
                          </Box>
                        </Box>
                      </Box>
                    )
                  })}
                </Stack>
              </>
            ) : null}

            <Box sx={{ display: 'flex', flexDirection: 'row', justifyContent: 'flex-end', mt: 2 }}>
              <Button
                variant="contained"
                disabled={!allExtractionsFinished || !hasSuccessfulExtraction}
                onClick={() => {
                  setStepOneExtractionDetail(null)
                  setActiveStep(1)
                }}
              >
                Continue to step 2
              </Button>
            </Box>
          </CardContent>
        </Card>
      ) : (
        <Stack spacing={2}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="h6">Step 2 — Policy description & graph</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                Describe which entities matter, how they should relate, and any business rules. The model will build
                one consolidated graph from your prompt plus all successful extractions from step 1.
              </Typography>

              <TextField
                label="Policy instructions"
                placeholder="Example: Model data retention vs marketing use; show obligations on the vendor and the internal owner…"
                multiline
                minRows={5}
                fullWidth
                value={policyPromptText}
                onChange={(event) => setPolicyPromptText(event.target.value)}
                sx={{ mt: 2 }}
              />

              <Box sx={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: 1, mt: 2 }}>
                <Button variant="outlined" onClick={() => setActiveStep(0)}>
                  Back to uploads
                </Button>
                <Button
                  variant="contained"
                  disabled={isGeneratingGraph || !hasSuccessfulExtraction}
                  onClick={() => void handleGeneratePolicyGraph()}
                >
                  {isGeneratingGraph ? 'Generating graph…' : 'Create policy graph'}
                </Button>
                {isGeneratingGraph ? <CircularProgress size={24} sx={{ alignSelf: 'center' }} /> : null}
              </Box>

              {graphError ? (
                <Typography color="error" sx={{ mt: 1 }}>
                  {graphError}
                </Typography>
              ) : null}

              {graphPayload?.reasoning ? (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                  <b>Overview:</b> {graphPayload.reasoning}
                </Typography>
              ) : null}
            </CardContent>
          </Card>

          {flowNodes.length > 0 ? (
            <Card variant="outlined">
              <CardContent sx={{ p: '0 !important' }}>
                <Box
                  sx={{
                    display: 'flex',
                    flexDirection: 'row',
                    height: 560,
                    borderRadius: 2,
                    overflow: 'hidden',
                  }}
                >
                  {/* Graph canvas */}
                  <Box sx={{ flex: 1, minWidth: 0, position: 'relative' }}>
                    {!selectedNode ? (
                      <Typography
                        variant="caption"
                        color="text.disabled"
                        sx={{ position: 'absolute', top: 12, left: 14, zIndex: 5, pointerEvents: 'none' }}
                      >
                        Click any node to see its business details
                      </Typography>
                    ) : null}
                    <ReactFlow
                      key={flowNodes.map((node) => node.id).join('|')}
                      nodes={flowNodes}
                      edges={flowEdges}
                      nodeTypes={policyNodeTypes}
                      fitView
                      onNodeClick={handleNodeClick}
                      onPaneClick={handlePaneClick}
                      proOptions={{ hideAttribution: true }}
                    >
                      <Background />
                      <Controls />
                    </ReactFlow>
                  </Box>

                  {/* Detail side panel */}
                  {selectedNode ? (
                    <NodeDetailPanel
                      node={selectedNode}
                      edges={flowEdges}
                      allNodes={flowNodes}
                      onClose={() => setSelectedNodeId(null)}
                    />
                  ) : null}
                </Box>
              </CardContent>
            </Card>
          ) : null}

          {/* Kind legend */}
          {flowNodes.length > 0 ? (
            <Box sx={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: 1, px: 0.5 }}>
              {Object.entries(KIND_COLOR_MAP).map(([kind, color]) => (
                <Box key={kind} sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 0.5 }}>
                  <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: color, flexShrink: 0 }} />
                  <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'capitalize' }}>
                    {kind}
                  </Typography>
                </Box>
              ))}
            </Box>
          ) : null}
        </Stack>
      )}
    </Stack>
    <ExtractionDetailDrawer
      detail={stepOneExtractionDetail}
      onClose={() => setStepOneExtractionDetail(null)}
    />
    </>
  )
}

/* Read a useful error string from an Axios failure response. */
function getAxiosErrorMessage(error) {
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
