import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

// Format a JSON-serializable value as MCP tool text content.
export function jsonToolResult(value: unknown): CallToolResult {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(value, null, 2),
      },
    ],
  };
}

// Format an error message as MCP tool text content (isError flag).
export function errorToolResult(message: string): CallToolResult {
  return {
    content: [
      {
        type: 'text',
        text: message,
      },
    ],
    isError: true,
  };
}
