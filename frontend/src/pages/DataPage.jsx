import React, { useEffect, useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import {
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import { apiClient } from '../api/apiClient'

/* Show a simple "tables" view for data navigation. */
export function DataPage() {
  const [entities, setEntities] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    void loadEntities({ setEntities, setIsLoading, setErrorMessage })
  }, [])

  return (
    <Stack spacing={2}>
      <Box sx={{ display: 'flex', flexDirection: 'row', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
        <Typography variant="h5" sx={{ flexGrow: 1 }}>
          Records
        </Typography>
        <Button component={RouterLink} to="/custom-entities" variant="outlined">
          Manage concepts
        </Button>
        <Button component={RouterLink} to="/automation" variant="contained">
          Ingest records
        </Button>
      </Box>

      <Typography variant="body2" color="text.secondary">
        Browse your concepts (tables) and open them to view and edit records.
      </Typography>

      {errorMessage ? <Typography color="error">{errorMessage}</Typography> : null}

      <Card variant="outlined">
        <CardContent>
          {entities.length === 0 && !isLoading ? (
            <Stack spacing={1}>
              <Typography variant="h6">No tables yet</Typography>
              <Typography variant="body2" color="text.secondary">
                Create an entity first (or ingest data and approve suggestions).
              </Typography>
              <Box sx={{ mt: 1 }}>
                <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
                  <Button component={RouterLink} to="/custom-entities" variant="contained">
                    Create entity
                  </Button>
                  <Button component={RouterLink} to="/automation" variant="outlined">
                    Ingest data
                  </Button>
                </Stack>
              </Box>
            </Stack>
          ) : (
            <Box sx={{ overflowX: 'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Table</TableCell>
                    <TableCell>Columns</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {entities.map((entity) => (
                    <TableRow key={entity.entity_name} hover>
                      <TableCell sx={{ minWidth: 180 }}>
                        <Typography variant="body2" sx={{ fontWeight: 800 }}>
                          {entity.display_name || entity.entity_name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {entity.entity_name}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ maxWidth: 520 }}>
                        <Typography variant="body2" color="text.secondary">
                          {(entity.columns || []).join(', ')}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
                          <Button
                            component={RouterLink}
                            to={`/custom/${entity.entity_name}`}
                            size="small"
                            variant="contained"
                          >
                            Open
                          </Button>
                          <Button
                            component={RouterLink}
                            to="/custom-entities"
                            size="small"
                            variant="text"
                            color="inherit"
                          >
                            Edit fields
                          </Button>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          )}


  
        </CardContent>
      </Card>
    </Stack>
  )
}

/* Load entities for the tables list. */
async function loadEntities({ setEntities, setIsLoading, setErrorMessage }) {
  setIsLoading(true)
  setErrorMessage('')
  try {
    const response = await apiClient.get('/entities')
    setEntities(Array.isArray(response.data) ? response.data : [])
  } catch (error) {
    setEntities([])
    setErrorMessage(getErrorMessage(error))
  } finally {
    setIsLoading(false)
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

