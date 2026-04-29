import React, { useMemo } from 'react'
import { Box, Card, CardContent, Chip, Stack, Typography } from '@mui/material'

/* Show the list of available integration connectors (UI-only). */
export function IntegrationsPage() {
  const connectors = useMemo(() => {
    return getIntegrationConnectors()
  }, [])

  const connectorCardWidthPixels = 320

  return (
    <Stack spacing={2}>
      <Box sx={{ display: 'flex', flexDirection: 'row', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
        <Typography variant="h4" sx={{ fontWeight: 900, letterSpacing: 0.2 }}>
          Integrations
        </Typography>
        <Chip size="small" label="Beta" color="warning" variant="outlined" />
      </Box>

      <Typography variant="body2" color="text.secondary">
        Connect external systems to FaistOS. This page is UI-only for now.
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'row', gap: 2, flexWrap: 'wrap', alignItems: 'stretch' }}>
        {connectors.map((connector) => (
          <IntegrationConnectorCard key={connector.key} connector={connector} cardWidthPixels={connectorCardWidthPixels} />
        ))}
      </Box>
    </Stack>
  )
}

/* Render a single integration connector card. */
function IntegrationConnectorCard({ connector, cardWidthPixels }) {
  const safeConnector = connector && typeof connector === 'object' ? connector : {}
  const title = String(safeConnector.title || 'Integration')
  const description = String(safeConnector.description || '')
  const category = String(safeConnector.category || 'Connector')
  const status = String(safeConnector.status || 'Coming soon')

  return (
    <Card
      variant="outlined"
      sx={{
        width: { xs: '100%', sm: cardWidthPixels || 320 },
        flex: { xs: '1 1 100%', sm: `0 0 ${cardWidthPixels || 320}px` },
      }}
    >
      <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Box sx={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', gap: 1 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>
            {title}
          </Typography>
          <Chip size="small" label={status} variant="outlined" />
        </Box>

        <Typography variant="caption" color="text.secondary">
          {category}
        </Typography>

        <Typography variant="body2" color="text.secondary">
          {description}
        </Typography>
      </CardContent>
    </Card>
  )
}

/* Provide the list of connector entries. */
function getIntegrationConnectors() {
  return [
    {
      key: 'gmail',
      title: 'Gmail',
      category: 'Email',
      status: 'Coming soon',
      description: 'Sync messages and contacts to enrich object context and relationship signals.',
    },
    {
      key: 'microsoft-365',
      title: 'Microsoft 365',
      category: 'Email & Calendar',
      status: 'Coming soon',
      description: 'Connect Outlook mail/calendar and directory data to power unified context.',
    },
    {
      key: 'salesforce',
      title: 'Salesforce',
      category: 'CRM',
      status: 'Coming soon',
      description: 'Ingest CRM objects and relationships to keep sales context consistent.',
    },
    {
      key: 'hubspot',
      title: 'HubSpot',
      category: 'CRM',
      status: 'Coming soon',
      description: 'Bring in contacts, companies, deals, and lifecycle events.',
    },
    {
      key: 'databricks',
      title: 'Databricks',
      category: 'Lakehouse',
      status: 'Coming soon',
      description: 'Connect to curated tables to build a governed context layer for AI.',
    },
    {
      key: 'snowflake',
      title: 'Snowflake',
      category: 'Data warehouse',
      status: 'Coming soon',
      description: 'Ingest analytical datasets and align them with FaistOS objects and relationships.',
    },
    {
      key: 'postgres',
      title: 'PostgreSQL',
      category: 'Database',
      status: 'Coming soon',
      description: 'Connect operational tables for real-time context updates.',
    },
    {
      key: 'slack',
      title: 'Slack',
      category: 'Collaboration',
      status: 'Coming soon',
      description: 'Capture decisions and references to improve shared understanding.',
    },
    {
      key: 'zendesk',
      title: 'Zendesk',
      category: 'Support',
      status: 'Coming soon',
      description: 'Connect tickets and customer issues to account and product context.',
    },
  ]
}

