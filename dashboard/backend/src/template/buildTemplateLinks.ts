// Build API paths for public ingest endpoints tied to an installed template.
export function buildTemplatePublicPaths(_templateId: string, workflowId: number) {
  return {
    publicWebhookPath: `/api/workflows/${workflowId}/webhook`,
  };
}
