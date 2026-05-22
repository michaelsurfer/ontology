import { useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Typography,
} from '@mui/material';
import OpenInFullIcon from '@mui/icons-material/OpenInFull';
import CloseIcon from '@mui/icons-material/Close';

type TurtlePreviewPanelProps = {
  turtleText: string;
};

// Collapsed Turtle preview with a dialog for full-screen reading.
export function TurtlePreviewPanel({ turtleText }: TurtlePreviewPanelProps) {
  const [maximizedOpen, setMaximizedOpen] = useState(false);
  const lineCount = turtleText ? turtleText.split('\n').length : 0;
  const characterCount = turtleText.length;

  const preStyles = {
    m: 0,
    p: 2,
    bgcolor: 'grey.100',
    borderRadius: 1,
    overflow: 'auto',
    fontSize: 12,
    whiteSpace: 'pre-wrap' as const,
    wordBreak: 'break-word' as const,
  };

  return (
    <>
      <Card variant="outlined">
        <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                Turtle preview
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {lineCount.toLocaleString()} lines · {characterCount.toLocaleString()} characters
              </Typography>
            </Box>
            <IconButton
              size="small"
              aria-label="Expand Turtle preview"
              onClick={() => setMaximizedOpen(true)}
            >
              <OpenInFullIcon fontSize="small" />
            </IconButton>
          </Stack>
          <Box
            component="pre"
            sx={{
              ...preStyles,
              maxHeight: 72,
              overflow: 'hidden',
              position: 'relative',
              '&::after': {
                content: '""',
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 0,
                height: 28,
                background: 'linear-gradient(transparent, rgba(245, 245, 245, 1))',
                pointerEvents: 'none',
              },
            }}
          >
            {turtleText || '(empty)'}
          </Box>
        </CardContent>
      </Card>

      <Dialog
        open={maximizedOpen}
        onClose={() => setMaximizedOpen(false)}
        fullWidth
        maxWidth="lg"
        scroll="paper"
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="h6" component="span" sx={{ fontWeight: 700 }}>
              Turtle preview
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
              {lineCount.toLocaleString()} lines · {characterCount.toLocaleString()} characters
            </Typography>
          </Box>
          <IconButton aria-label="Close" onClick={() => setMaximizedOpen(false)} edge="end">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Box component="pre" sx={{ ...preStyles, maxHeight: '70vh' }}>
            {turtleText || '(empty)'}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMaximizedOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
