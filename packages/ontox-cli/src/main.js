#!/usr/bin/env node
import { Command } from 'commander'
import process from 'node:process'

import { OntoXClient } from 'ontox'
import { registerEntitiesCommands } from './commands/entities.js'
import { registerSparqlCommands } from './commands/sparql.js'
import { registerIngestCommands } from './commands/ingest.js'
import { registerSuggestionsCommands } from './commands/suggestions.js'

/* Create an OntoXClient from CLI options. */
function createClientFromOptions(options) {
  const baseUrl = options.baseUrl || process.env.ONTOX_BASE_URL || 'http://localhost:5174'
  const apiKey = options.apiKey || process.env.ONTOX_API_KEY || null

  return new OntoXClient({ baseUrl, apiKey })
}

/* Print output either as JSON or as text. */
function printOutput({ value, asJson }) {
  if (asJson) {
    process.stdout.write(`${JSON.stringify(value, null, 2)}\n`)
    return
  }

  if (typeof value === 'string') {
    process.stdout.write(`${value}\n`)
    return
  }

  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`)
}

/* Main CLI entry point. */
async function main() {
  const program = new Command()

  program
    .name('ontox')
    .description('OntoX CLI')
    .option('--base-url <url>', 'OntoX API base URL (default: http://localhost:5174)')
    .option('--api-key <key>', 'OntoX API key (or set ONTOX_API_KEY)')

  registerEntitiesCommands({ program, createClientFromOptions, printOutput })
  registerSparqlCommands({ program, createClientFromOptions, printOutput })
  registerIngestCommands({ program, createClientFromOptions, printOutput })
  registerSuggestionsCommands({ program, createClientFromOptions, printOutput })

  await program.parseAsync(process.argv)
}

main().catch((error) => {
  process.stderr.write(`${error?.message || String(error)}\n`)
  process.exit(1)
})

