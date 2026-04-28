/* Register `ontox entities ...` commands. */
export function registerEntitiesCommands({ program, createClientFromOptions, printOutput }) {
  const entitiesCommand = program.command('entities').description('Work with entities')

  entitiesCommand
    .command('list')
    .description('List builtin + custom entities')
    .option('--json', 'Output JSON', false)
    .action(async (options) => {
      const client = createClientFromOptions(program.opts())
      const entities = await client.entities.list()
      printOutput({ value: entities, asJson: options.json })
    })
}

