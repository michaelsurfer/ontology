import { installTemplate } from './installTemplate.js';
import { listTemplateSummaries, normalizeTemplateId } from './listTemplates.js';

// CLI entry: install one template by id (filename without .json).
async function runInstallTemplateCli() {
  const templateIdArgument = process.argv[2];

  if (!templateIdArgument || templateIdArgument === '--list') {
    const templates = listTemplateSummaries();
    console.log('Available templates:');
    for (const template of templates) {
      console.log(`  - ${template.id}: ${template.name}`);
      console.log(`    ${template.description}`);
    }
    if (!templateIdArgument) {
      console.log('\nUsage: npm run template:install -- <template-id>');
      process.exit(templateIdArgument === '--list' ? 0 : 1);
    }
    return;
  }

  const templateId = normalizeTemplateId(templateIdArgument);
  console.log(`Installing template: ${templateId}...`);

  const result = await installTemplate(templateId);
  console.log(JSON.stringify(result, null, 2));
}

runInstallTemplateCli().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
