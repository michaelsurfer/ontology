import rdf from '@zazuko/env-node'
import SHACLValidator from 'rdf-validate-shacl'
import { Parser } from 'n3'

import { createRdfTurtleExport } from './rdfExport.js'
import { createShaclTurtleExport } from './shaclExport.js'

/* Validate the current CRM→RDF graph against stored SHACL rules. */
export async function validateCurrentGraphAgainstRules({ includeOntology, includeData, maxRowsPerEntity }) {
  const shapesTurtle = await createShaclTurtleExport()
  const dataTurtle = await createRdfTurtleExport({
    includeOntology: Boolean(includeOntology),
    includeData: Boolean(includeData),
    maxRowsPerEntity: Number.isFinite(maxRowsPerEntity) ? Number(maxRowsPerEntity) : 200,
  })

  const shapesDataset = parseTurtleToDataset(String(shapesTurtle || ''))
  const dataDataset = parseTurtleToDataset(String(dataTurtle || ''))

  const validator = new SHACLValidator(shapesDataset, { factory: rdf })
  const report = await validator.validate(dataDataset)

  return {
    conforms: Boolean(report.conforms),
    results: (report.results || []).map((result) => ({
      message: normalizeShaclMessage(result.message),
      path: normalizeRdfTerm(result.path),
      focusNode: normalizeRdfTerm(result.focusNode),
      severity: normalizeRdfTerm(result.severity),
      sourceConstraintComponent: result.sourceConstraintComponent
        ? normalizeRdfTerm(result.sourceConstraintComponent)
        : null,
      sourceShape: normalizeRdfTerm(result.sourceShape),
    })),
  }
}

/* Normalize a SHACL message (often an array of RDF literals) into a string. */
function normalizeShaclMessage(messageValue) {
  if (!messageValue) {
    return null
  }

  if (Array.isArray(messageValue)) {
    const parts = messageValue.map((item) => normalizeRdfTerm(item)).filter(Boolean)
    return parts.length > 0 ? parts.join(' • ') : null
  }

  return normalizeRdfTerm(messageValue)
}

/* Convert an RDF/JS term (or string) into a stable string. */
function normalizeRdfTerm(term) {
  if (term === null || term === undefined) {
    return null
  }

  if (typeof term === 'string') {
    return term
  }

  if (typeof term === 'object') {
    if (typeof term.value === 'string') {
      return term.value
    }
    if (typeof term.id === 'string') {
      return term.id
    }
    if (typeof term.termType === 'string') {
      // Last-resort for RDF/JS Terms that don't expose .value
      return String(term)
    }
  }

  return String(term)
}

/* Parse Turtle text into an RDF/JS dataset using N3 Parser. */
function parseTurtleToDataset(turtleText) {
  const parser = new Parser()
  const quads = parser.parse(String(turtleText || ''))
  const dataset = rdf.dataset()
  dataset.addAll(quads)
  return dataset
}

