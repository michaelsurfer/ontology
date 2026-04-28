import { Parser, Store } from 'n3'
import { Graph, HashMapDataset, PlanBuilder } from 'sparql-engine'

import { createRdfTurtleExport } from './rdfExport.js'

/* Execute a SPARQL query against the current in-memory RDF graph. */
export async function executeSparqlQuery({ queryText, exportOptions }) {
  const normalizedQueryText = String(queryText || '').trim()
  if (!normalizedQueryText) {
    throw new Error('queryText is required')
  }

  const turtleText = await createRdfTurtleExport(exportOptions || {})
  const store = buildStoreFromTurtle(turtleText)

  const graph = new InMemoryN3Graph(store)
  const dataset = new HashMapDataset('http://example.com/graph/default', graph)

  const planBuilder = new PlanBuilder(dataset)
  const iterator = planBuilder.build(normalizedQueryText)

  const bindingsRows = await collectBindings(iterator)
  const variables = getVariablesFromBindingsRows(bindingsRows)

  return {
    variables,
    rows: bindingsRows,
  }
}

/* Build an in-memory N3 Store from a Turtle string. */
function buildStoreFromTurtle(turtleText) {
  const parser = new Parser()
  const quads = parser.parse(String(turtleText || ''))
  return new Store(quads)
}

/* Collect query results from a sparql-engine iterator. */
function collectBindings(iterator) {
  return new Promise((resolve, reject) => {
    const rows = []

    iterator.subscribe(
      (bindings) => {
        if (bindings && typeof bindings.toObject === 'function') {
          rows.push(normalizeBindingsObject(bindings.toObject()))
          return
        }

        rows.push(bindings)
      },
      (error) => reject(error),
      () => resolve(rows),
    )
  })
}

/* Normalize bindings values into readable strings where possible. */
function normalizeBindingsObject(bindingsObject) {
  const normalizedBindings = {}
  const safeBindingsObject = bindingsObject && typeof bindingsObject === 'object' ? bindingsObject : {}

  for (const [variableName, value] of Object.entries(safeBindingsObject)) {
    normalizedBindings[variableName] = normalizeRdfValue(value)
  }

  return normalizedBindings
}

/* Convert a binding value into a stable string representation. */
function normalizeRdfValue(value) {
  if (value === null || value === undefined) {
    return null
  }

  if (typeof value === 'string') {
    return value
  }

  if (typeof value === 'object') {
    if (typeof value.id === 'string') {
      return value.id
    }
    if (typeof value.value === 'string') {
      return value.value
    }
  }

  return String(value)
}

/* Derive a variable list from returned rows. */
function getVariablesFromBindingsRows(bindingsRows) {
  const variablesSet = new Set()

  for (const row of bindingsRows) {
    if (!row || typeof row !== 'object') {
      continue
    }
    for (const variableName of Object.keys(row)) {
      variablesSet.add(variableName)
    }
  }

  return Array.from(variablesSet)
}

/* Convert a SPARQL triple pattern into N3 Store query terms. */
function formatTriplePattern(triplePattern) {
  const subject = triplePattern.subject.startsWith('?') ? null : triplePattern.subject
  const predicate = triplePattern.predicate.startsWith('?') ? null : triplePattern.predicate
  const object = triplePattern.object.startsWith('?') ? null : triplePattern.object
  return { subject, predicate, object }
}

/* A sparql-engine Graph implementation backed by an in-memory N3 Store. */
class InMemoryN3Graph extends Graph {
  constructor(store) {
    super()
    this.store = store
  }

  /* Find triples matching a triple pattern (null = wildcard). */
  find(triplePattern) {
    const { subject, predicate, object } = formatTriplePattern(triplePattern)
    const quads = this.store.getQuads(subject, predicate, object, null)
    return quads.map((quad) => ({
      subject: quad.subject.id,
      predicate: quad.predicate.id,
      object: quad.object.id,
    }))
  }

  /* Estimate cardinality of a triple pattern to improve query planning. */
  estimateCardinality(triplePattern) {
    const { subject, predicate, object } = formatTriplePattern(triplePattern)
    return Promise.resolve(this.store.countQuads(subject, predicate, object, null))
  }
}

