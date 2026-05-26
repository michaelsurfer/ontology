import { useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Alert,
  Box,
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
import { McpProviderGuides } from './mcp/McpProviderGuides';

type PlaybookMcpConnectDialogProps = {
  open: boolean;
  playbookId: string;
  playbookName: string;
  entityNames?: string[];
  onClose: () => void;
};

// Build a short agent prompt that references this installed playbook pack.
function buildAgentPromptSnippet(playbookId: string, playbookName: string, entityNames: string[]): string {
  const entityHint =
    entityNames.length > 0
      ? ` Record types in this pack: ${entityNames.join(', ')}.`
      : '';

  return [
    `Use AnythingGraph MCP for the "${playbookName}" playbook pack.`,
    `Playbook id: ${playbookId}.${entityHint}`,
    'Call health_check, read resource anythinggraph://schema-summary, then get_entity for each record type.',
    'Create or update data with create_entity_row and create_row_relationship after schema relationships exist.',
  ].join(' ');
}

// Show how to connect MCP hosts (Cursor, Claude, OpenAI, others) to this installed playbook.
export function PlaybookMcpConnectDialog({
  open,
  playbookId,
  playbookName,
  entityNames = [],
  onClose,
}: PlaybookMcpConnectDialogProps) {
  const [copyMessage, setCopyMessage] = useState('');

  const agentPromptSnippet = useMemo(
    () => buildAgentPromptSnippet(playbookId, playbookName, entityNames),
    [playbookId, playbookName, entityNames],
  );

  async function copyToClipboard(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopyMessage(`Copied ${label}.`);
    } catch {
      setCopyMessage(`Could not copy ${label}.`);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>Connect via MCP — {playbookName}</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ mt: 0.5 }}>
          <Typography variant="body2" color="text.secondary">
            Use this playbook id with any MCP-capable host (Cursor, Claude Desktop, OpenAI Agents
            SDK, Windsurf, or custom orchestrators). The AnythingGraph server uses stdio — your
            host must launch <code>node</code> on <code>mcp-service/dist/index.js</code>.
          </Typography>

          {copyMessage ? <Alert severity="success">{copyMessage}</Alert> : null}

          <TextField
            label="Playbook id"
            value={playbookId}
            fullWidth
            InputProps={{
              readOnly: true,
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    aria-label="Copy playbook id"
                    onClick={() => void copyToClipboard(playbookId, 'playbook id')}
                  >
                    <ContentCopyIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />

          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
              1. Start services and build MCP
            </Typography>
            <Typography component="ul" variant="body2" color="text.secondary" sx={{ pl: 2.5, m: 0 }}>
              <li>
                <code>data-layer-service</code> on port <strong>8182</strong>
              </li>
              <li>
                <code>rdf-cache-service</code> on port <strong>8181</strong>
              </li>
              <li>
                <code>cd mcp-service && npm install && npm run build</code>
              </li>
            </Typography>
          </Box>

          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
              2. Connect your LLM host
            </Typography>
            <McpProviderGuides defaultExpandFirst showConfigOnceAtTop />
          </Box>

          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
              3. Use this playbook in the agent
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              After MCP connects, tell the agent to use playbook id <code>{playbookId}</code>.
              Typical tools: <code>list_entities</code>, <code>get_entity</code>, resource{' '}
              <code>anythinggraph://schema-summary</code>, then <code>create_entity_row</code> and{' '}
              <code>create_row_relationship</code>.
            </Typography>
            {entityNames.length > 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Installed record types:{' '}
                {entityNames.map((name) => (
                  <code key={name} style={{ marginRight: 6 }}>
                    {name}
                  </code>
                ))}
              </Typography>
            ) : null}
            <Box
              component="pre"
              sx={{
                m: 0,
                p: 2,
                bgcolor: 'grey.100',
                borderRadius: 1,
                overflow: 'auto',
                fontSize: 12,
                whiteSpace: 'pre-wrap',
              }}
            >
              {agentPromptSnippet}
            </Box>
            <Button
              size="small"
              variant="outlined"
              startIcon={<ContentCopyIcon />}
              onClick={() => void copyToClipboard(agentPromptSnippet, 'agent prompt')}
              sx={{ mt: 1 }}
            >
              Copy sample agent prompt
            </Button>
          </Box>

          <Alert severity="info">
            Bulk JSON ingest via HTTP webhook is still available from each workflow on the
            Workflows page. MCP is the recommended path for AI agents reading schema and writing
            records.
          </Alert>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button component={RouterLink} to="/settings/mcp" onClick={onClose}>
          MCP settings
        </Button>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
