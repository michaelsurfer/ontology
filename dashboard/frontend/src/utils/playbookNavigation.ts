import type { Location } from 'react-router-dom';
import type { PlaybookSummary } from '../types/playbook';

export type PlaybookNavigationState = {
  playbookReturnPath: string;
  playbookId: string;
  playbookName: string;
};

// Route for the full-page installed playbook explorer.
export function buildPlaybookInstalledViewPath(playbookId: string): string {
  return `/playbooks/${playbookId}/view`;
}

// Build router state so entity/workflow pages can show Back to playbook view.
export function buildPlaybookNavigationState(playbook: Pick<PlaybookSummary, 'id' | 'name'>): PlaybookNavigationState {
  return {
    playbookReturnPath: buildPlaybookInstalledViewPath(playbook.id),
    playbookId: playbook.id,
    playbookName: playbook.name,
  };
}

// Read playbook return context from a downstream navigation (entity, workflow, etc.).
export function readPlaybookNavigationState(location: Location): PlaybookNavigationState | null {
  const state = location.state;
  if (!state || typeof state !== 'object') {
    return null;
  }

  const candidate = state as Partial<PlaybookNavigationState>;
  if (
    typeof candidate.playbookReturnPath === 'string' &&
    candidate.playbookReturnPath.startsWith('/playbooks/') &&
    typeof candidate.playbookId === 'string' &&
    typeof candidate.playbookName === 'string'
  ) {
    return {
      playbookReturnPath: candidate.playbookReturnPath,
      playbookId: candidate.playbookId,
      playbookName: candidate.playbookName,
    };
  }

  return null;
}
