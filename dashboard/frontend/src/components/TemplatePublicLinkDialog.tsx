import { useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';

type TemplatePublicLinkDialogProps = {
  open: boolean;
  templateName: string;
  webhookPath: string | null;
  onClose: () => void;
};

// Show the public workflow webhook URL for JSON ingest.
export function TemplatePublicLinkDialog({
  open,
  templateName,
  webhookPath,
  onClose,
}: TemplatePublicLinkDialogProps) {
  const [copyMessage, setCopyMessage] = useState('');

  const webhookUrl = webhookPath ? `${window.location.origin}${webhookPath}` : '';

  async function copyToClipboard(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopyMessage(`Copied ${label}.`);
    } catch {
      setCopyMessage(`Could not copy ${label}.`);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Public webhook — {templateName}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          <Typography variant="body2" color="text.secondary">
            POST structured JSON to this URL. Send an array of record objects or{' '}
            <code>{'{ "records": [ ... ] }'}</code>. The template ingest workflow validates,
            maps fields, creates rows, and links relationships.
          </Typography>

          {copyMessage ? <Alert severity="success">{copyMessage}</Alert> : null}

          {webhookUrl ? (
            <TextField
              label="Workflow webhook (JSON ingest)"
              value={webhookUrl}
              fullWidth
              InputProps={{
                readOnly: true,
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label="Copy webhook URL"
                      onClick={() => void copyToClipboard(webhookUrl, 'webhook URL')}
                    >
                      <ContentCopyIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
          ) : (
            <Alert severity="warning">Webhook URL is not available until the template is installed.</Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
