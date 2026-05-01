import React, { useMemo, useState } from 'react'
import {
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  FormControlLabel,
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

/* Provide a SPARQL editor and show results from the backend. */
export function SparqlPage() {
  const sparqlTemplates = useMemo(() => getSparqlTemplates(), [])
  const [selectedTemplateId, setSelectedTemplateId] = useState(sparqlTemplates[0]?.id || 'classes')

  const selectedTemplate = useMemo(() => {
    return sparqlTemplates.find((template) => template.id === selectedTemplateId) || sparqlTemplates[0]
  }, [sparqlTemplates, selectedTemplateId])

  const [queryText, setQueryText] = useState(selectedTemplate?.queryText || '')
  const [includeOntology, setIncludeOntology] = useState(Boolean(selectedTemplate?.includeOntology))
  const [includeData, setIncludeData] = useState(Boolean(selectedTemplate?.includeData))
  const [maxRowsPerEntity, setMaxRowsPerEntity] = useState(200)

  const [variables, setVariables] = useState([])
  const [rows, setRows] = useState([])
  const [executionTimeMs, setExecutionTimeMs] = useState(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  return (
    <Stack spacing={2}>
      <Typography variant="h5">SPARQL console</Typography>
      <Typography variant="body2" color="text.secondary">
        Run queries against your context layer to explore connected data.
      </Typography>

      <Card variant="outlined">
        <CardContent>
          <Stack spacing={2}>
            <Box sx={{ display: 'flex', flexDirection: 'row', gap: 2, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <TextField
                select
                label="Templates"
                value={selectedTemplateId}
                onChange={(event) => {
                  const nextTemplateId = event.target.value
                  setSelectedTemplateId(nextTemplateId)

                  const template =
                    sparqlTemplates.find((item) => item.id === nextTemplateId) || sparqlTemplates[0]

                  loadTemplateIntoEditor({
                    template,
                    setQueryText,
                    setIncludeOntology,
                    setIncludeData,
                  })

                  setVariables([])
                  setRows([])
                  setErrorMessage('')
                  setExecutionTimeMs(null)
                }}
                sx={{ width: 360 }}
              >
                {sparqlTemplates.map((template) => (
                  <MenuItem key={template.id} value={template.id}>
                    {template.title}
                  </MenuItem>
                ))}
              </TextField>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, flex: '1 1 420px' }}>
                <Typography variant="body2" color="text.secondary">
                  {selectedTemplate?.description || ''}
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'row', gap: 1, flexWrap: 'wrap' }}>
                  <Button
                    variant="text"
                    color="inherit"
                    onClick={() => {
                      setVariables([])
                      setRows([])
                      setErrorMessage('')
                      setExecutionTimeMs(null)
                    }}
                  >
                    Clear results
                  </Button>
                </Box>
              </Box>
            </Box>

            <TextField
              label="SPARQL query"
              value={queryText}
              onChange={(event) => setQueryText(event.target.value)}
              multiline
              minRows={12}
              sx={{ fontFamily: 'monospace' }}
            />

            <Box sx={{ display: 'flex', flexDirection: 'row', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
              <FormControlLabel
                control={<Checkbox checked={includeOntology} onChange={(e) => setIncludeOntology(e.target.checked)} />}
                label="Include model triples"
              />
              <FormControlLabel
                control={<Checkbox checked={includeData} onChange={(e) => setIncludeData(e.target.checked)} />}
                label="Include instance data triples"
              />
              <TextField
                label="Max rows per entity"
                type="number"
                value={maxRowsPerEntity}
                onChange={(event) => setMaxRowsPerEntity(Number(event.target.value))}
                sx={{ width: 200 }}
              />
              <Button
                variant="contained"
                disabled={isLoading}
                onClick={() =>
                  void runSparqlQuery({
                    queryText,
                    includeOntology,
                    includeData,
                    maxRowsPerEntity,
                    setVariables,
                    setRows,
                    setExecutionTimeMs,
                    setErrorMessage,
                    setIsLoading,
                  })
                }
              >
                Run query
              </Button>
              <Button
                variant="outlined"
                disabled={!rows || rows.length === 0}
                onClick={() => downloadTextFile({ fileName: 'sparql-results.json', text: JSON.stringify({ variables, rows }, null, 2) })}
              >
                Download JSON
              </Button>
            </Box>

            {errorMessage ? <Typography color="error">{errorMessage}</Typography> : null}
            {executionTimeMs !== null ? (
              <Typography variant="body2" color="text.secondary">
                Execution time: {executionTimeMs} ms. Rows: {rows.length}.
              </Typography>
            ) : null}

            <ResultsTable variables={variables} rows={rows} />
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  )
}

/* Render query results as a table of bindings. */
function ResultsTable({ variables, rows }) {
  const safeVariables = Array.isArray(variables) ? variables : []
  const safeRows = Array.isArray(rows) ? rows : []

  if (safeRows.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        No results yet.
      </Typography>
    )
  }

  const displayVariables = safeVariables.length > 0 ? safeVariables : Object.keys(safeRows[0] || {})

  return (
    <Box sx={{ overflowX: 'auto' }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            {displayVariables.map((variableName) => (
              <TableCell key={variableName}>{variableName}</TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {safeRows.map((row, index) => (
            <TableRow key={index} hover>
              {displayVariables.map((variableName) => (
                <TableCell key={variableName} sx={{ maxWidth: 420, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {row?.[variableName] ?? ''}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  )
}

/* Load a template query and its recommended options into the editor. */
function loadTemplateIntoEditor({ template, setQueryText, setIncludeOntology, setIncludeData }) {
  if (!template) {
    return
  }

  setQueryText(template.queryText || '')

  if (typeof template.includeOntology === 'boolean') {
    setIncludeOntology(template.includeOntology)
  }

  if (typeof template.includeData === 'boolean') {
    setIncludeData(template.includeData)
  }
}

/* Call the backend SPARQL endpoint and update UI state. */
async function runSparqlQuery({
  queryText,
  includeOntology,
  includeData,
  maxRowsPerEntity,
  setVariables,
  setRows,
  setExecutionTimeMs,
  setErrorMessage,
  setIsLoading,
}) {
  setIsLoading(true)
  setErrorMessage('')
  setExecutionTimeMs(null)
  try {
    const response = await apiClient.post('/sparql', {
      query: queryText,
      includeOntology,
      includeData,
      maxRowsPerEntity,
    })

    const data = response.data || {}
    setVariables(Array.isArray(data.variables) ? data.variables : [])
    setRows(Array.isArray(data.rows) ? data.rows : [])
    setExecutionTimeMs(typeof data.executionTimeMs === 'number' ? data.executionTimeMs : null)
  } catch (error) {
    setErrorMessage(getErrorMessage(error))
    setVariables([])
    setRows([])
  } finally {
    setIsLoading(false)
  }
}

/* Provide built-in SPARQL templates that match this project's default context namespace. */
function getSparqlTemplates() {
  return [
    {
      id: 'classes',
      title: 'List OWL classes (schema)',
      description: 'Shows all OWL Classes generated from your CRM entity mappings.',
      includeOntology: true,
      includeData: false,
      queryText: `PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX owl: <http://www.w3.org/2002/07/owl#>
PREFIX ex: <http://example.com/context#>

SELECT ?class ?label
WHERE {
  ?class rdf:type owl:Class .
  OPTIONAL { ?class rdfs:label ?label }
}
ORDER BY ?class
LIMIT 50
`,
    },
    {
      id: 'relationships',
      title: 'List object properties (relationships)',
      description: 'Shows OWL ObjectProperties (your relationship definitions) and their domain/range.',
      includeOntology: true,
      includeData: false,
      queryText: `PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX owl: <http://www.w3.org/2002/07/owl#>

SELECT ?property ?label ?domain ?range
WHERE {
  ?property rdf:type owl:ObjectProperty .
  OPTIONAL { ?property rdfs:label ?label }
  OPTIONAL { ?property rdfs:domain ?domain }
  OPTIONAL { ?property rdfs:range ?range }
}
ORDER BY ?property
LIMIT 100
`,
    },
    {
      id: 'acme-contacts',
      title: 'All contacts for account "Acme Corp"',
      description:
        'Find all Contacts linked to the Account named "Acme Corp". This uses the object property ex:hasContact generated from your relationship definitions.',
      includeOntology: false,
      includeData: true,
      queryText: `PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX ex: <http://example.com/context#>

SELECT ?contact ?firstName ?lastName ?email
WHERE {
  ?account rdf:type ex:Account .
  ?account ex:hasContact ?contact .
  VALUES ?accountName { "Acme Corp"@en "Acme Corp" }
  ?account ex:accountName ?accountName .

  OPTIONAL { ?contact ex:firstName ?firstName }
  OPTIONAL { ?contact ex:lastName ?lastName }
  OPTIONAL { ?contact ex:email ?email }
}
ORDER BY ?lastName ?firstName
LIMIT 200
`,
    },
    {
      id: 'all-triples-sample',
      title: 'Sample triples (debug)',
      description: 'Quickly inspect some triples to confirm what is in the graph.',
      includeOntology: true,
      includeData: false,
      queryText: `SELECT ?s ?p ?o WHERE { ?s ?p ?o } LIMIT 20`,
    },
  ]
}

/* Download the given text as a local file. */
function downloadTextFile({ fileName, text }) {
  const blob = new Blob([text], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)

  const anchorElement = document.createElement('a')
  anchorElement.href = url
  anchorElement.download = fileName
  anchorElement.click()

  URL.revokeObjectURL(url)
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

