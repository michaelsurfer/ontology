import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Link,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { mcpHostGuides, mcpStdioConfigJson } from './mcpConfigSnippet';

type McpProviderGuidesProps = {
  /** When true, only the Cursor section is expanded initially. */
  defaultExpandFirst?: boolean;
  /** Show the shared JSON config block inside each panel (or once at top). */
  showConfigInEachPanel?: boolean;
  showConfigOnceAtTop?: boolean;
};

// Render setup instructions for Cursor, Claude, OpenAI, and other MCP hosts.
export function McpProviderGuides({
  defaultExpandFirst = true,
  showConfigInEachPanel = false,
  showConfigOnceAtTop = true,
}: McpProviderGuidesProps) {
  return (
    <Box>
      {showConfigOnceAtTop ? (
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
            Stdio MCP server config (all hosts)
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Replace <code>&lt;absolute-path&gt;</code> with the full path to this AnythingGraph
            repository. Use the built entrypoint after <code>npm run build</code> in mcp-service.
          </Typography>
          <ConfigPreBlock jsonText={mcpStdioConfigJson} />
        </Box>
      ) : null}

      {mcpHostGuides.map((hostGuide, index) => (
        <Accordion
          key={hostGuide.hostId}
          defaultExpanded={defaultExpandFirst && index === 0}
          disableGutters
          sx={{
            border: '1px solid',
            borderColor: 'divider',
            '&:not(:last-child)': { borderBottom: 0 },
            '&:before': { display: 'none' },
          }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              {hostGuide.title}
            </Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ pt: 0 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              <strong>Config:</strong> {hostGuide.configPath}
            </Typography>
            <Typography component="ol" variant="body2" color="text.secondary" sx={{ pl: 2.5, m: 0, mb: 1 }}>
              {hostGuide.steps.map((step) => (
                <li key={step} style={{ marginBottom: 4 }}>
                  {step}
                </li>
              ))}
            </Typography>
            {hostGuide.notes?.map((note) => (
              <Typography key={note} variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                • {note}
              </Typography>
            ))}
            {hostGuide.docUrl ? (
              <Typography variant="body2" sx={{ mt: 1 }}>
                <Link href={hostGuide.docUrl} target="_blank" rel="noopener noreferrer">
                  {hostGuide.docLabel || hostGuide.docUrl}
                </Link>
              </Typography>
            ) : null}
            {showConfigInEachPanel ? (
              <Box sx={{ mt: 1.5 }}>
                <ConfigPreBlock jsonText={mcpStdioConfigJson} />
              </Box>
            ) : null}
          </AccordionDetails>
        </Accordion>
      ))}
    </Box>
  );
}

// Monospace JSON block for MCP config snippets.
function ConfigPreBlock({ jsonText }: { jsonText: string }) {
  return (
    <Box
      component="pre"
      sx={{
        m: 0,
        p: 2,
        bgcolor: 'grey.100',
        borderRadius: 1,
        overflow: 'auto',
        fontSize: 12,
      }}
    >
      {jsonText}
    </Box>
  );
}
