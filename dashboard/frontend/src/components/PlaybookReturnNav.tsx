import { Link as RouterLink, useLocation } from 'react-router-dom';
import { Alert, Button, Stack, Typography } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { readPlaybookNavigationState } from '../utils/playbookNavigation';

type PlaybookReturnNavProps = {
  /** Optional extra context shown beside the back action (e.g. current record type). */
  currentSectionLabel?: string;
};

// Sticky breadcrumb-style bar when user navigated from an installed playbook view.
export function PlaybookReturnNav({ currentSectionLabel }: PlaybookReturnNavProps) {
  const location = useLocation();
  const playbookNavigation = readPlaybookNavigationState(location);

  if (!playbookNavigation) {
    return null;
  }

  return (
    <Alert
      severity="info"
      icon={false}
      sx={{
        mb: 2,
        py: 1.25,
        '& .MuiAlert-message': { width: '100%', p: 0 },
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        flexWrap="wrap"
        useFlexGap
        spacing={1}
      >
        <Stack direction="row" alignItems="center" spacing={1} useFlexGap flexWrap="wrap">
          <Button
            component={RouterLink}
            to={playbookNavigation.playbookReturnPath}
            size="small"
            startIcon={<ArrowBackIcon />}
            variant="outlined"
            sx={{ bgcolor: 'background.paper' }}
          >
            Back to {playbookNavigation.playbookName}
          </Button>
          {currentSectionLabel ? (
            <Typography variant="body2" color="text.secondary">
              {currentSectionLabel}
            </Typography>
          ) : null}
        </Stack>
        <Typography variant="caption" color="text.secondary">
          Playbook · {playbookNavigation.playbookId}
        </Typography>
      </Stack>
    </Alert>
  );
}
