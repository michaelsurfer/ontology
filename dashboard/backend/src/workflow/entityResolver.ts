import type { EntityDefinition } from '../types.js';
import { extractRowForEntity, matchScoreForEntity } from './recordUtils.js';

export type EntityMatchCandidate = {
  entityId: number;
  entityName: string;
  activeFieldNames: string[];
  score: number;
  coverage: number;
};

// Score one payload record against a list of allowed entity definitions.
export function scoreEntityCandidates(
  entityDefinitions: EntityDefinition[],
  payloadObject: Record<string, unknown>,
): EntityMatchCandidate[] {
  const candidates: EntityMatchCandidate[] = [];

  for (const entityDefinition of entityDefinitions) {
    const activeFieldNames = entityDefinition.fields
      .filter((field) => field.is_active !== false)
      .map((field) => field.field_name)
      .filter(Boolean);

    if (activeFieldNames.length === 0) {
      continue;
    }

    const score = matchScoreForEntity(payloadObject, activeFieldNames);
    const coverage = activeFieldNames.length === 0 ? 0 : score / activeFieldNames.length;

    candidates.push({
      entityId: entityDefinition.id,
      entityName: entityDefinition.name,
      activeFieldNames,
      score,
      coverage,
    });
  }

  candidates.sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }
    if (right.coverage !== left.coverage) {
      return right.coverage - left.coverage;
    }
    return left.entityName.localeCompare(right.entityName);
  });

  return candidates;
}

// Extract insertable row values when the entity meets the minimum score.
export function buildEntityRowIfMatched(
  candidate: EntityMatchCandidate,
  payloadObject: Record<string, unknown>,
  minMatchScore: number,
): { ok: true; rowValues: Record<string, unknown> } | { ok: false; reason: string } {
  if (candidate.score < minMatchScore) {
    return { ok: false, reason: `score_below_threshold_${candidate.score}_lt_${minMatchScore}` };
  }

  const rowValues = extractRowForEntity(payloadObject, candidate.activeFieldNames);
  if (Object.keys(rowValues).length === 0) {
    return { ok: false, reason: 'no_field_values_extracted' };
  }

  return { ok: true, rowValues };
}
