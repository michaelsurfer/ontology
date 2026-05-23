import { Box, Stack, Typography } from '@mui/material';
import type { ReactNode } from 'react';

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
};

// Consistent page title row used across dashboard screens.
export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <Stack
      direction="row"
      justifyContent="space-between"
      alignItems="flex-start"
      spacing={2}
      sx={{ mb: 2.5 }}
      useFlexGap
      flexWrap="wrap"
    >
      <Box>
        <Typography variant="h4" component="h1" sx={{ color: 'text.primary' }}>
          {title}
        </Typography>
        {subtitle ? (
          <Typography variant="body1" color="text.secondary" sx={{ mt: 0.5, maxWidth: 720 }}>
            {subtitle}
          </Typography>
        ) : null}
      </Box>
      {actions ? (
        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
          {actions}
        </Stack>
      ) : null}
    </Stack>
  );
}
