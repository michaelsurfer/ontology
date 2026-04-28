import React, { useState } from 'react'
import {
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  FormControlLabel,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { apiClient } from '../api/apiClient'

/* Render an RDF/OWL export UI that returns Turtle text. */
export function RdfExportPage() {
  const [includeOntology, setIncludeOntology] = useState(true)
  const [includeData, setIncludeData] = useState(true)
  const [maxRowsPerEntity, setMaxRowsPerEntity] = useState(200)
  const [turtleText, setTurtleText] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  return (
    <Stack spacing={2}>
      <Typography variant="h5">RDF / OWL Export</Typography>
      <Typography variant="body2" color="text.secondary">
        Export as Turtle. Ontology export includes OWL Classes + ObjectProperties + DatatypeProperties
        with domain/range. Data export includes individuals from CRM rows.
      </Typography>

      <Card variant="outlined">
        <CardContent>
          <Stack spacing={2}>
            <Box sx={{ display: 'flex', flexDirection: 'row', gap: 2, flexWrap: 'wrap' }}>
              <FormControlLabel
                control={<Checkbox checked={includeOntology} onChange={(e) => setIncludeOntology(e.target.checked)} />}
                label="Include ontology (OWL)"
              />
              <FormControlLabel
                control={<Checkbox checked={includeData} onChange={(e) => setIncludeData(e.target.checked)} />}
                label="Include data (instances)"
              />
              <TextField
                label="Max rows per entity"
                type="number"
                value={maxRowsPerEntity}
                onChange={(event) => setMaxRowsPerEntity(Number(event.target.value))}
                sx={{ width: 200 }}
              />
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'row', gap: 2, flexWrap: 'wrap' }}>
              <Button
                variant="contained"
                disabled={isLoading}
                onClick={() =>
                  void runExport({
                    includeOntology,
                    includeData,
                    maxRowsPerEntity,
                    setTurtleText,
                    setErrorMessage,
                    setIsLoading,
                  })
                }
              >
                Generate Turtle
              </Button>
              <Button
                variant="outlined"
                disabled={!turtleText}
                onClick={() => downloadTextFile({ fileName: 'export.ttl', text: turtleText })}
              >
                Download .ttl
              </Button>
            </Box>

            {errorMessage ? <Typography color="error">{errorMessage}</Typography> : null}

            <TextField
              label="Turtle output"
              value={turtleText}
              onChange={(event) => setTurtleText(event.target.value)}
              multiline
              minRows={18}
              sx={{ fontFamily: 'monospace' }}
            />
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  )
}

/* Call the backend export endpoint and store the returned Turtle text. */
async function runExport({
  includeOntology,
  includeData,
  maxRowsPerEntity,
  setTurtleText,
  setErrorMessage,
  setIsLoading,
}) {
  setIsLoading(true)
  setErrorMessage('')
  try {
    const response = await apiClient.post(
      '/rdf/export',
      { includeOntology, includeData, maxRowsPerEntity },
      { responseType: 'text' },
    )
    setTurtleText(typeof response.data === 'string' ? response.data : '')
  } catch (error) {
    setErrorMessage(getErrorMessage(error))
  } finally {
    setIsLoading(false)
  }
}

/* Download the given text as a local file. */
function downloadTextFile({ fileName, text }) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
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

