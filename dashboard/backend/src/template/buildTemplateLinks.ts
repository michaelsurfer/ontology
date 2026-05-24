// Build API paths for public ingest endpoints tied to an installed template.
export function buildTemplatePublicPaths(templateId: string, workflowId: number) {
  return {
    publicWebhookPath: `/api/workflows/${workflowId}/webhook`,
    publicDocumentUploadPath: `/api/templates/${templateId}/process-document`,
  };
}
