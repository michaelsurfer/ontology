/* Create a consistent error for API failures. */
export function createOntoXApiError({ message, status, details }) {
  const error = new Error(message || 'OntoX API error')
  error.name = 'OntoXApiError'
  error.status = status
  error.details = details
  return error
}

