/* Register `ontox suggestions ...` commands. */
export function registerSuggestionsCommands({ program, createClientFromOptions, printOutput }) {
  const suggestionsCommand = program.command('suggestions').description('Review and publish suggestions')

  suggestionsCommand
    .command('list')
    .description('List suggestions')
    .option('--status <status>', 'Filter status: draft|approved|rejected|published')
    .option('--out-json', 'Output JSON', true)
    .action(async (options) => {
      const client = createClientFromOptions(program.opts())
      const result = await client.suggestions.list({ status: options.status || undefined })
      printOutput({ value: result, asJson: Boolean(options.outJson) })
    })

  suggestionsCommand
    .command('approve')
    .description('Approve a suggestion')
    .requiredOption('--id <id>', 'Suggestion id')
    .option('--out-json', 'Output JSON', true)
    .action(async (options) => {
      const client = createClientFromOptions(program.opts())
      const result = await client.suggestions.approve({ id: options.id })
      printOutput({ value: result, asJson: Boolean(options.outJson) })
    })

  suggestionsCommand
    .command('reject')
    .description('Reject a suggestion')
    .requiredOption('--id <id>', 'Suggestion id')
    .option('--out-json', 'Output JSON', true)
    .action(async (options) => {
      const client = createClientFromOptions(program.opts())
      const result = await client.suggestions.reject({ id: options.id })
      printOutput({ value: result, asJson: Boolean(options.outJson) })
    })

  suggestionsCommand
    .command('publish')
    .description('Publish all approved suggestions')
    .option('--out-json', 'Output JSON', true)
    .action(async (options) => {
      const client = createClientFromOptions(program.opts())
      const result = await client.suggestions.publishApproved()
      printOutput({ value: result, asJson: Boolean(options.outJson) })
    })

  suggestionsCommand
    .command('delete')
    .description('Delete a suggestion (only non-published)')
    .requiredOption('--id <id>', 'Suggestion id')
    .option('--out-json', 'Output JSON', true)
    .action(async (options) => {
      const client = createClientFromOptions(program.opts())
      const result = await client.suggestions.delete({ id: options.id })
      printOutput({ value: result, asJson: Boolean(options.outJson) })
    })

  suggestionsCommand
    .command('clear')
    .description('Bulk delete suggestions by status (draft/approved/rejected)')
    .requiredOption('--status <status>', 'Status: draft|approved|rejected')
    .option('--out-json', 'Output JSON', true)
    .action(async (options) => {
      const client = createClientFromOptions(program.opts())
      const result = await client.suggestions.deleteByStatus({ status: options.status })
      printOutput({ value: result, asJson: Boolean(options.outJson) })
    })
}

