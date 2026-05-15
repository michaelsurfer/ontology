import React, { useMemo } from 'react'
import {
  PlannerWorkspace,
  AI_PLANNING_WORKSPACE_DEFAULTS,
  createPlannerApis,
} from '../components/PlannerWorkspace'

/* AI Planning: planner workspace backed by /api/ai/plan and ai_planning_settings. */
export function AiPlanningPage() {
  const planApis = useMemo(() => createPlannerApis(), [])

  return (
    <PlannerWorkspace
      workspaceKey="global-planner"
      pageTitle="AI Planning"
      {...AI_PLANNING_WORKSPACE_DEFAULTS}
      planApis={planApis}
    />
  )
}
