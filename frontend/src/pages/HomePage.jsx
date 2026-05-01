import React, { useEffect, useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { Box, Button, Card, CardContent, Typography, Stack, Chip } from '@mui/material'
import { apiClient } from '../api/apiClient'

/* Show a simple overview and suggested workflow. */
export function HomePage() {
  const [entitiesCount, setEntitiesCount] = useState(null)

  useEffect(() => {
    void loadEntitiesCount({ setEntitiesCount })
  }, [])

  return (
    <Stack spacing={2}>
      <Typography variant="h3" sx={{ fontWeight: 900, letterSpacing: 0.2 }}>
        Mission AI
      </Typography>
      <Typography variant="body1" color="text.secondary">
        The context layer that keeps AI accurate.
      </Typography>
      <Typography variant="body1" color="text.secondary">
        Create a shared understanding layer over your data so AI stays accurate and consistent.
      </Typography>

      {entitiesCount === 0 ? (
        <Card variant="outlined">
          <CardContent>
            <Typography variant="h6" sx={{ mb: 0.5 }}>
              Create your first entity
            </Typography>
            <Typography variant="body2" color="text.secondary">
              This project no longer ships with default CRM tables. Start by creating a custom entity
              (or ingest an event and approve suggestions).
            </Typography>

            <Box sx={{ mt: 2 }}>
              <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
                <Button component={RouterLink} to="/custom-entities" variant="contained">
                  Create entity
                </Button>
                <Button component={RouterLink} to="/automation" variant="outlined">
                  Ingest data (Automation)
                </Button>
                <Button component={RouterLink} to="/docs" variant="text">
                  View docs
                </Button>
              </Stack>
            </Box>
          </CardContent>
        </Card>
      ) : null}

      <Card variant="outlined">
        <CardContent>
          <Typography variant="h6" sx={{ mb: 1 }}>
            Suggested workflow
          </Typography>
          <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
            <Chip label="1) Create entities / ingest data" />
            <Chip label="2) Define relationships" />
            <Chip label="3) Export OWL/RDF (Turtle)" />
            <Chip label="4) View schema graph" />
          </Stack>

          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Note: The graph view is schema-level (tables/classes + object properties). Data-level
              graphs can be added next once the model is stable.
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </Stack>
  )
}

/* Load the entity count to decide whether to show onboarding CTA. */
async function loadEntitiesCount({ setEntitiesCount }) {
  try {
    const response = await apiClient.get('/entities')
    const entities = Array.isArray(response.data) ? response.data : []
    setEntitiesCount(entities.length)
  } catch (error) {
    setEntitiesCount(null)
  }
}

