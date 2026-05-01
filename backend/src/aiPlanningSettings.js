import { getDatabase } from './database.js'
import { DEFAULT_PLANNER_SYSTEM_PROMPT } from './aiPlanningDefaults.js'

/* Read the planner system prompt from SQLite, or fall back to the built-in default. */
export function getPlannerSystemPrompt() {
  const database = getDatabase()
  const row = database.prepare('SELECT planner_system_prompt FROM ai_planning_settings WHERE id = 1').get()
  const stored = row?.planner_system_prompt
  if (stored !== undefined && stored !== null && String(stored).trim().length > 0) {
    return String(stored).trim()
  }
  return DEFAULT_PLANNER_SYSTEM_PROMPT
}

/* Persist the planner system prompt (must be non-empty). */
export function setPlannerSystemPrompt(promptText) {
  const database = getDatabase()
  const text = String(promptText ?? '').trim()
  if (!text) {
    throw new Error('planner_system_prompt must not be empty')
  }

  const upsert = database.prepare(`
    INSERT INTO ai_planning_settings (id, planner_system_prompt, updated_at)
    VALUES (1, ?, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      planner_system_prompt = excluded.planner_system_prompt,
      updated_at = excluded.updated_at
  `)
  upsert.run(text)

  return getPlannerSystemPromptRow()
}

/* Return full row for API responses. */
export function getPlannerSystemPromptRow() {
  const database = getDatabase()
  return database.prepare('SELECT id, planner_system_prompt, updated_at FROM ai_planning_settings WHERE id = 1').get()
}
