import { useCallback, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from '@mui/material';
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';
import { WorkflowRunResultView } from './workflow/WorkflowRunResultView';
import { ontologyApi } from '../api/client';
import type { WorkflowExecutionResult } from '../types/workflow';

type TemplateOpenDialogProps = {
  open: boolean;
  templateId: string;
  templateName: string;
  onClose: () => void;
  onProcessed?: () => void;
};

// Dialog for drag-and-drop upload, extraction, and workflow ingest for an installed template.
export function TemplateOpenDialog({
  open,
  templateId,
  templateName,
  onClose,
  onProcessed,
}: TemplateOpenDialogProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [processing, setProcessing] = useState(false);
  const [workflowResult, setWorkflowResult] = useState<WorkflowExecutionResult | null>(null);

  const resetDialogState = useCallback(() => {
    setSelectedFile(null);
    setDragActive(false);
    setErrorMessage('');
    setStatusMessage('');
    setProcessing(false);
    setWorkflowResult(null);
  }, []);

  function handleClose() {
    resetDialogState();
    onClose();
  }

  function acceptFile(file: File | null) {
    if (!file) {
      return;
    }
    setSelectedFile(file);
    setErrorMessage('');
    setStatusMessage('');
    setWorkflowResult(null);
  }

  function handleDragOver(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragActive(true);
  }

  function handleDragLeave(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragActive(false);
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragActive(false);
    const droppedFile = event.dataTransfer.files?.[0] || null;
    acceptFile(droppedFile);
  }

  async function handleProcessFile() {
    if (!selectedFile) {
      setErrorMessage('Choose a file to upload.');
      return;
    }

    setProcessing(true);
    setErrorMessage('');
    setStatusMessage('Extracting document and running workflow…');
    setWorkflowResult(null);

    try {
      const response = await ontologyApi.processTemplateDocument(templateId, selectedFile);
      setStatusMessage(
        `${response.data.extraction.summary} Processed ${response.data.extraction.records.length} record(s) through "${response.data.workflowName}".`,
      );
      setWorkflowResult(response.data.workflowRun.result);
      onProcessed?.();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Document processing failed');
      setStatusMessage('');
    } finally {
      setProcessing(false);
    }
  }

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="md">
      <DialogTitle>Open {templateName}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          <Typography variant="body2" color="text.secondary">
            Upload a document or data file. The system extracts fields for this template&apos;s record
            type and passes rows into its ingest workflow.
          </Typography>

          {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}
          {statusMessage ? <Alert severity="info">{statusMessage}</Alert> : null}

          <Box
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            sx={{
              border: '2px dashed',
              borderColor: dragActive ? 'primary.main' : 'divider',
              borderRadius: 2,
              bgcolor: dragActive ? 'action.hover' : 'background.paper',
              p: 4,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              cursor: 'pointer',
            }}
            onClick={() => {
              const input = document.getElementById('template-file-input') as HTMLInputElement | null;
              input?.click();
            }}
          >
            <CloudUploadOutlinedIcon sx={{ fontSize: 40, color: 'primary.main', mb: 1 }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              Drag and drop a file here
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              or click to browse
            </Typography>
            <Typography variant="caption" color="text.secondary">
              JSON, CSV, TXT, PDF (PDF and text use OpenAI when configured)
            </Typography>
            <input
              id="template-file-input"
              type="file"
              hidden
              accept=".json,.csv,.txt,.pdf,application/json,text/csv,text/plain,application/pdf"
              onChange={(event) => acceptFile(event.target.files?.[0] || null)}
            />
          </Box>

          {selectedFile ? (
            <Typography variant="body2">
              Selected file: <strong>{selectedFile.name}</strong> ({Math.round(selectedFile.size / 1024)}{' '}
              KB)
            </Typography>
          ) : null}

          {workflowResult ? <WorkflowRunResultView result={workflowResult} /> : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={processing}>
          Close
        </Button>
        <Button
          variant="contained"
          onClick={() => void handleProcessFile()}
          disabled={processing || !selectedFile}
          startIcon={processing ? <CircularProgress size={16} color="inherit" /> : null}
        >
          {processing ? 'Processing…' : 'Extract and run workflow'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
