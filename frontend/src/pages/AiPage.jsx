import React, { useMemo, useRef, useState } from 'react'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Checkbox,
  Divider,
  FormControlLabel,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { apiClient, LONG_RUNNING_AI_TIMEOUT_MS } from '../api/apiClient'

/* A basic AI chat room that can answer using SPARQL data. */
export function AiPage() {
  const [messages, setMessages] = useState(() => createInitialMessages())
  const [inputText, setInputText] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [isExecutingSparql, setIsExecutingSparql] = useState(false)
  const [expandedDebugPanel, setExpandedDebugPanel] = useState(null)
  const [isRulesCheckingEnabled, setIsRulesCheckingEnabled] = useState(true)

  const scrollAnchorRef = useRef(null)

  const lastAssistantMessage = useMemo(() => {
    const reversed = [...messages].reverse()
    return reversed.find((message) => message.role === 'assistant') || null
  }, [messages])

  /* Execute SPARQL directly (no AI) and update last assistant message results. */
  async function executeSparqlWithoutAi({ sparqlText }) {
    const normalizedSparqlText = String(sparqlText || '').trim()
    if (!normalizedSparqlText || isExecutingSparql) {
      return
    }

    if (!lastAssistantMessage || !lastAssistantMessage.id) {
      return
    }

    setIsExecutingSparql(true)
    setErrorMessage('')

    try {
      const response = await apiClient.post('/sparql', {
        queryText: normalizedSparqlText,
        includeOntology: true,
        includeData: true,
        maxRowsPerEntity: 200,
      })

      const data = response.data || {}
      const variables = Array.isArray(data.variables) ? data.variables : []
      const rows = Array.isArray(data.rows) ? data.rows : []
      const executionTimeMs = Number.isFinite(data.executionTimeMs) ? Number(data.executionTimeMs) : null

      setMessages((previous) =>
        previous.map((message) => {
          if (!message || message.id !== lastAssistantMessage.id) {
            return message
          }
          return {
            ...message,
            variables,
            rows,
            executionTimeMs,
          }
        }),
      )

      setExpandedDebugPanel('rows')
      setTimeout(scrollToBottom, 50)
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally {
      setIsExecutingSparql(false)
    }
  }

  /* Scroll the chat list to the bottom. */
  function scrollToBottom() {
    const element = scrollAnchorRef.current
    if (element && typeof element.scrollIntoView === 'function') {
      element.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  }

  /* Send the current input text to the backend. */
  async function sendMessage() {
    const normalizedInput = String(inputText || '').trim()
    if (!normalizedInput || isLoading) {
      return
    }

    setIsLoading(true)
    setErrorMessage('')

    setMessages((previous) => [
      ...previous,
      {
        id: `user:${Date.now()}`,
        role: 'user',
        text: normalizedInput,
        createdAtMs: Date.now(),
      },
    ])
    setInputText('')

    try {
      const response = await apiClient.post(
        '/ai/chat',
        {
          message: normalizedInput,
          rules_checking_enabled: isRulesCheckingEnabled,
        },
        { timeout: LONG_RUNNING_AI_TIMEOUT_MS },
      )
      const data = response.data || {}
      const rulesValidationFromResponse =
        data.rulesValidation && typeof data.rulesValidation === 'object' ? data.rulesValidation : null

      setMessages((previous) => [
        ...previous,
        {
          id: `assistant:${Date.now()}`,
          role: 'assistant',
          text: String(data.answerText || 'No answer.'),
          sparqlText: data.sparqlText ? String(data.sparqlText) : '',
          variables: Array.isArray(data.variables) ? data.variables : [],
          rows: Array.isArray(data.rows) ? data.rows : [],
          executionTimeMs: Number.isFinite(data.executionTimeMs) ? Number(data.executionTimeMs) : null,
          enabledRulesCount: Number.isFinite(data.enabledRulesCount) ? Number(data.enabledRulesCount) : null,
          rulesValidation: rulesValidationFromResponse,
          createdAtMs: Date.now(),
        },
      ])

      if (isRulesCheckingEnabled && rulesValidationFromResponse) {
        const conforms =
          rulesValidationFromResponse.conforms === true || rulesValidationFromResponse.conforms === false
            ? Boolean(rulesValidationFromResponse.conforms)
            : null
        if (conforms === false || expandedDebugPanel === null) {
          setExpandedDebugPanel('rules')
        }
      }

      setTimeout(scrollToBottom, 50)
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Stack spacing={2}>
      <Typography variant="h5">Query Studio</Typography>
      <Typography variant="body2" color="text.secondary">
        Ask questions in plain English. The assistant will generate SPARQL, query your graph, and summarize the result.
      </Typography>

      {errorMessage ? <Typography color="error">{errorMessage}</Typography> : null}

      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          gap: 2,
          alignItems: 'stretch',
        }}
      >
        <Card variant="outlined" sx={{ flex: 1, minWidth: 320 }}>
          <CardContent>
            <Stack spacing={1.5}>
              <Box
                sx={{
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 2,
                  p: 1.5,
                  height: 420,
                  overflowY: 'auto',
                  bgcolor: 'background.default',
                }}
              >
                <Stack spacing={1.5}>
                  {messages.map((message) => (
                    <ChatMessageBubble key={message.id} message={message} />
                  ))}
                  <div ref={scrollAnchorRef} />
                </Stack>
              </Box>

              <Divider />

              <Box sx={{ display: 'flex', flexDirection: 'row', gap: 1, alignItems: 'flex-start' }}>
                <TextField
                  label="Ask a question"
                  value={inputText}
                  onChange={(event) => setInputText(event.target.value)}
                  placeholder='Example: "List all contacts for Acme Corp"'
                  fullWidth
                  multiline
                  minRows={2}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                      event.preventDefault()
                      void sendMessage()
                    }
                  }}
                />
                <Button variant="contained" onClick={() => void sendMessage()} disabled={isLoading}>
                  {isLoading ? 'Thinking…' : 'Send'}
                </Button>
              </Box>

              <Typography variant="caption" color="text.secondary">
                Tip: Press Ctrl+Enter (or Cmd+Enter) to send.
              </Typography>

              <FormControlLabel
                control={
                  <Checkbox
                    checked={isRulesCheckingEnabled}
                    onChange={(event) => setIsRulesCheckingEnabled(event.target.checked)}
                    size="small"
                  />
                }
                label={
                  <Typography variant="caption" color="text.secondary">
                    Rules checking (run SHACL validation on each message)
                  </Typography>
                }
                sx={{ m: 0, userSelect: 'none' }}
              />
            </Stack>
          </CardContent>
        </Card>

        <Card
          variant="outlined"
          sx={{
            width: { xs: '100%', md: 520 },
            flexShrink: 0,
          }}
        >
          <CardContent>
            {lastAssistantMessage ? (
              <AssistantDebugPanels
                assistantMessage={lastAssistantMessage}
                expandedDebugPanel={expandedDebugPanel}
                setExpandedDebugPanel={setExpandedDebugPanel}
                isExecutingSparql={isExecutingSparql}
                onExecuteSparql={(sparqlText) => void executeSparqlWithoutAi({ sparqlText })}
              />
            ) : (
              <Typography variant="body2" color="text.secondary">
                Debug panels will appear here after the assistant replies.
              </Typography>
            )}
          </CardContent>
        </Card>
      </Box>
    </Stack>
  )
}

/* Render a single chat message bubble. */
function ChatMessageBubble({ message }) {
  const isUser = message?.role === 'user'
  const safeText = message?.text ? String(message.text) : ''
  const enabledRulesCount =
    message?.enabledRulesCount === null || message?.enabledRulesCount === undefined
      ? null
      : Number(message.enabledRulesCount)
  const rulesValidation = message?.rulesValidation && typeof message.rulesValidation === 'object' ? message.rulesValidation : null

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'row',
        justifyContent: isUser ? 'flex-end' : 'flex-start',
      }}
    >
      <Box
        sx={{
          maxWidth: '80%',
          px: 1.5,
          py: 1,
          borderRadius: 2,
          bgcolor: isUser ? 'rgba(25, 118, 210, 0.12)' : 'background.paper',
          border: '1px solid',
          borderColor: 'divider',
          whiteSpace: 'pre-wrap',
        }}
      >
        <Stack spacing={0.5}>
          <Box sx={{ display: 'flex', flexDirection: 'row', gap: 1, alignItems: 'center' }}>
            <Chip size="small" label={isUser ? 'You' : 'AI'} />
            {message?.executionTimeMs ? (
              <Typography variant="caption" color="text.secondary">
                {message.executionTimeMs}ms
              </Typography>
            ) : null}
            {!isUser && enabledRulesCount !== null ? (
              <Chip size="small" variant="outlined" label={`Rules: ${enabledRulesCount}`} />
            ) : null}
            {!isUser && rulesValidation ? (
              <Chip
                size="small"
                variant="outlined"
                label={rulesValidation.conforms ? 'Conforms' : 'Violations'}
              />
            ) : null}
          </Box>
          <Typography variant="body2">{safeText}</Typography>
        </Stack>
      </Box>
    </Box>
  )
}

/* Render debug panels (SPARQL + rows) for the last assistant message. */
function AssistantDebugPanels({
  assistantMessage,
  expandedDebugPanel,
  setExpandedDebugPanel,
  isExecutingSparql,
  onExecuteSparql,
}) {
  const sparqlText = assistantMessage?.sparqlText ? String(assistantMessage.sparqlText) : ''
  const variables = Array.isArray(assistantMessage?.variables) ? assistantMessage.variables : []
  const rows = Array.isArray(assistantMessage?.rows) ? assistantMessage.rows : []
  const rulesValidation =
    assistantMessage?.rulesValidation && typeof assistantMessage.rulesValidation === 'object'
      ? assistantMessage.rulesValidation
      : null

  return (
    <Stack spacing={1}>
      <Accordion
        expanded={expandedDebugPanel === 'sparql'}
        onChange={(event, isExpanded) => setExpandedDebugPanel(isExpanded ? 'sparql' : null)}
        disabled={!sparqlText}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="subtitle2">Generated SPARQL</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Box sx={{ display: 'flex', flexDirection: 'row', justifyContent: 'flex-end', mb: 1 }}>
            <Button
              variant="outlined"
              size="small"
              onClick={() => onExecuteSparql(sparqlText)}
              disabled={!sparqlText || isExecutingSparql}
              color="inherit"
              sx={{
                bgcolor: 'rgba(255, 255, 255, 0.75)',
                borderColor: 'divider',
                '&:hover': {
                  bgcolor: 'rgba(255, 255, 255, 0.92)',
                  borderColor: 'divider',
                },
              }}
            >
              {isExecutingSparql ? 'Executing…' : 'Execute'}
            </Button>
          </Box>
          <TextField
            value={sparqlText}
            multiline
            minRows={8}
            fullWidth
            InputProps={{ readOnly: true, sx: { fontFamily: 'monospace' } }}
          />
        </AccordionDetails>
      </Accordion>

      <Accordion
        expanded={expandedDebugPanel === 'rows'}
        onChange={(event, isExpanded) => setExpandedDebugPanel(isExpanded ? 'rows' : null)}
        disabled={rows.length === 0}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="subtitle2">Raw rows ({rows.length})</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <TextField
            value={JSON.stringify({ variables, rows }, null, 2)}
            multiline
            minRows={8}
            fullWidth
            InputProps={{ readOnly: true, sx: { fontFamily: 'monospace' } }}
          />
        </AccordionDetails>
      </Accordion>

      <Accordion
        expanded={expandedDebugPanel === 'rules'}
        onChange={(event, isExpanded) => setExpandedDebugPanel(isExpanded ? 'rules' : null)}
        disabled={!rulesValidation}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="subtitle2">Rules validation</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <TextField
            value={rulesValidation ? JSON.stringify(rulesValidation, null, 2) : ''}
            multiline
            minRows={6}
            fullWidth
            InputProps={{ readOnly: true, sx: { fontFamily: 'monospace' } }}
          />
        </AccordionDetails>
      </Accordion>
    </Stack>
  )
}

/* Create the initial message list shown on the AI page. */
function createInitialMessages() {
  return [
    {
      id: 'assistant:welcome',
      role: 'assistant',
      text:
        'Ask me a question about your data.\n\n' +
        'Examples:\n' +
        '- Show me all entities\n' +
        '- List 10 rows from contacts\n' +
        '- Find opportunities linked to an account\n',
      createdAtMs: Date.now(),
    },
  ]
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

