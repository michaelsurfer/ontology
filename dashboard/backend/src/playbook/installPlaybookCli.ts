import { installPlaybook } from './installPlaybook.js';
import { listPlaybookSummaries, normalizePlaybookId } from './listPlaybooks.js';

// CLI entry: install one playbook by id (filename without .json).
async function runInstallPlaybookCli() {
  const playbookIdArgument = process.argv[2];

  if (!playbookIdArgument || playbookIdArgument === '--list') {
    const playbooks = listPlaybookSummaries();
    console.log('Available playbooks:');
    for (const playbook of playbooks) {
      console.log(`  - ${playbook.id}: ${playbook.name}`);
      console.log(`    ${playbook.description}`);
    }
    if (!playbookIdArgument) {
      console.log('\nUsage: npm run playbook:install -- <playbook-id>');
      process.exit(playbookIdArgument === '--list' ? 0 : 1);
    }
    return;
  }

  const playbookId = normalizePlaybookId(playbookIdArgument);
  console.log(`Installing playbook: ${playbookId}...`);

  const result = await installPlaybook(playbookId);
  console.log(JSON.stringify(result, null, 2));
}

runInstallPlaybookCli().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
