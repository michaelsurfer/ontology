import { executeWorkflowById } from '../workflow/runWorkflow.js';
import { extractDocumentForTemplate } from './extractDocumentForTemplate.js';
import { resolveInstalledTemplate } from './templateResolver.js';

// Extract an uploaded document and run the template primary workflow on the records.
export async function processTemplateDocument(options: {
  templateId: string;
  fileName: string;
  fileBuffer: Buffer;
  mimeType: string;
  dryRun?: boolean;
}) {
  const installedTemplate = await resolveInstalledTemplate(options.templateId);
  const extraction = await extractDocumentForTemplate({
    templateId: options.templateId,
    template: installedTemplate.template,
    primaryWorkflowId: installedTemplate.primaryWorkflowId,
    fileName: options.fileName,
    fileBuffer: options.fileBuffer,
    mimeType: options.mimeType,
  });

  if (extraction.records.length === 0) {
    throw new Error('No records were extracted from the file');
  }

  const workflowRun = await executeWorkflowById(
    installedTemplate.primaryWorkflowId,
    extraction.records,
    Boolean(options.dryRun),
  );

  return {
    ok: true,
    templateId: installedTemplate.template.id,
    templateName: installedTemplate.template.name,
    workflowId: installedTemplate.primaryWorkflowId,
    workflowName: installedTemplate.primaryWorkflowName,
    extraction,
    workflowRun,
  };
}
