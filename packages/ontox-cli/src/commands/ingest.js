import fs from 'node:fs'

/* Register `ontox ingest ...` commands. */
export function registerIngestCommands({ program, createClientFromOptions, printOutput }) {
  const ingestCommand = program.command('ingest').description('Ingest real-time events')

  ingestCommand
    .command('events')
    .description('Send ingest events payload')
    .option('--file <path>', 'Read JSON payload from a file')
    .option('--json <payload>', 'JSON payload string')
    .option('--out-json', 'Output JSON', true)
    .action(async (options) => {
      const payload = readJsonPayload(options)
      const client = createClientFromOptions(program.opts())
      const result = await client.ingest.events(payload)
      printOutput({ value: result, asJson: Boolean(options.outJson) })
    })

  ingestCommand
    .command('list')
    .description('List recent ingest events')
    .option('--limit <n>', 'Limit', '100')
    .option('--out-json', 'Output JSON', true)
    .action(async (options) => {
      const client = createClientFromOptions(program.opts())
      const result = await client.ingest.listEvents({ limit: Number(options.limit) })
      printOutput({ value: result, asJson: Boolean(options.outJson) })
    })
}

/* Read a JSON payload from --json or --file. */
function readJsonPayload(options) {
  if (options.json) {
    return JSON.parse(String(options.json))
  }
  if (options.file) {
    return JSON.parse(fs.readFileSync(String(options.file), 'utf-8'))
  }
  throw new Error('Provide --json or --file')
}

