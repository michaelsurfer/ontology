import axios from 'axios'

/* Default request timeout (simple CRUD / short queries). */
const DEFAULT_TIMEOUT_MS = 15000

/*
 * Long-running AI endpoints (multi-step planner, NL→SPARQL→LLM) routinely exceed 15s.
 * Override per request with this value so the browser does not abort early.
 */
export const LONG_RUNNING_AI_TIMEOUT_MS = 180000

/* Create a shared Axios client for calling the backend API. */
export function createApiClient() {
  return axios.create({
    baseURL: '/api',
    timeout: DEFAULT_TIMEOUT_MS,
  })
}

export const apiClient = createApiClient()

