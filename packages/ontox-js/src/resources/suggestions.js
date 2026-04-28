/* Create a suggestions resource for review-before-apply workflows. */
export function createSuggestionsResource({ httpClient }) {
  return {
    /* List suggestions. Optional: { status: 'draft'|'approved'|'rejected'|'published' }. */
    async list({ status } = {}) {
      return await httpClient.requestJson({
        method: 'GET',
        path: '/api/suggestions',
        query: status ? { status } : undefined,
      })
    },

    /* Approve a suggestion. */
    async approve({ id }) {
      return await httpClient.requestJson({
        method: 'POST',
        path: `/api/suggestions/${encodeURIComponent(id)}/approve`,
      })
    },

    /* Reject a suggestion. */
    async reject({ id }) {
      return await httpClient.requestJson({
        method: 'POST',
        path: `/api/suggestions/${encodeURIComponent(id)}/reject`,
      })
    },

    /* Publish all approved suggestions. */
    async publishApproved() {
      return await httpClient.requestJson({
        method: 'POST',
        path: '/api/suggestions/publish',
      })
    },

    /* Delete a suggestion by id (only non-published). */
    async delete({ id }) {
      return await httpClient.requestJson({
        method: 'DELETE',
        path: `/api/suggestions/${encodeURIComponent(id)}`,
      })
    },

    /* Bulk delete suggestions by status (never published). */
    async deleteByStatus({ status }) {
      return await httpClient.requestJson({
        method: 'DELETE',
        path: '/api/suggestions',
        query: { status },
      })
    },
  }
}

