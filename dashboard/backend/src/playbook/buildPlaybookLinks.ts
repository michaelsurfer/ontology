// Build API paths for public ingest endpoints tied to an installed playbook.
export function buildPlaybookPublicPaths(_playbookId: string, workflowId: number) {
  return {
    publicWebhookPath: `/api/workflows/${workflowId}/webhook`,
  };
}
