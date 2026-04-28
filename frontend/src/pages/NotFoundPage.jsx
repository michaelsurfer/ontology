import React from 'react'
import { Button, Stack, Typography } from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'

/* Render a simple not-found page for unknown routes. */
export function NotFoundPage() {
  return (
    <Stack spacing={2}>
      <Typography variant="h5">Page not found</Typography>
      <Typography variant="body2" color="text.secondary">
        The page you requested does not exist.
      </Typography>
      <Button component={RouterLink} to="/" variant="contained">
        Go home
      </Button>
    </Stack>
  )
}

