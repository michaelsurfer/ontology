import axios from 'axios'

/* Create a shared Axios client for calling the backend API. */
export function createApiClient() {
  return axios.create({
    baseURL: '/api',
    timeout: 15000,
  })
}

export const apiClient = createApiClient()

