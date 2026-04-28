import fs from 'node:fs'

/* Register `ontox sparql ...` commands. */
export function registerSparqlCommands({ program, createClientFromOptions, printOutput }) {
  const sparqlCommand = program.command('sparql').description('Run SPARQL queries')

  sparqlCommand
    .command('query')
    .description('Run a SPARQL query')
    .option('--file <path>', 'Read SPARQL query from a file')
    .option('--query <sparql>', 'SPARQL query text')
    .option('--include-ontology', 'Include ontology triples', true)
    .option('--no-include-ontology', 'Exclude ontology triples')
    .option('--include-data', 'Include data triples', false)
    .option('--max-rows-per-entity <n>', 'Max rows per entity for export', '200')
    .option('--json', 'Output JSON', true)
    .action(async (options) => {
      const queryText = readQueryText(options)
      const client = createClientFromOptions(program.opts())
      const result = await client.sparql.query({
        queryText,
        includeOntology: Boolean(options.includeOntology),
        includeData: Boolean(options.includeData),
        maxRowsPerEntity: Number(options.maxRowsPerEntity),
      })

      printOutput({ value: result, asJson: options.json })
    })
}

/* Read the SPARQL query from --query or --file. */
function readQueryText(options) {
  if (options.query) {
    return String(options.query)
  }
  if (options.file) {
    return fs.readFileSync(String(options.file), 'utf-8')
  }
  throw new Error('Provide --query or --file')
}

