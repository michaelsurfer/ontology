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
  documentUploadPath: string | null;
  onClose: () => void;
};

// Show public API URLs for webhook ingest and document upload.
export function TemplatePublicLinkDialog({
  open,
  templateName,
  webhookPath,
  documentUploadPath,
  onClose,
}: TemplatePublicLinkDialogProps) {
  const [copyMessage, setCopyMessage] = useState('');

  const webhookUrl = webhookPath ? `${window.location.origin}${webhookPath}` : '';
  const documentUploadUrl = documentUploadPath
    ? `${window.location.origin}${documentUploadPath}`
    : '';

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
      <DialogTitle>Public link — {templateName}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          <Typography variant="body2" color="text.secondary">
            Share these URLs with external systems. Webhook accepts JSON (POST). Document upload
            accepts multipart file (POST, field name <strong>file</strong>).
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
          ) : null}

          {documentUploadUrl ? (
            <TextField
              label="Document upload (file ingest)"
              value={documentUploadUrl}
              fullWidth
              InputProps={{
                readOnly: true,
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label="Copy document upload URL"
                      onClick={() => void copyToClipboard(documentUploadUrl, 'document URL')}
                    >
                      <ContentCopyIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
          ) : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
