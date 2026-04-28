class SuggestionsResource:
    def __init__(self, http_client):
        self.http_client = http_client

    # List suggestions. Optional: status="draft|approved|rejected|published".
    def list(self, status=None):
        if status:
            return self.http_client.request_json("GET", f"/api/suggestions?status={status}")
        return self.http_client.request_json("GET", "/api/suggestions")

    # Approve a suggestion.
    def approve(self, suggestion_id):
        return self.http_client.request_json("POST", f"/api/suggestions/{suggestion_id}/approve")

    # Reject a suggestion.
    def reject(self, suggestion_id):
        return self.http_client.request_json("POST", f"/api/suggestions/{suggestion_id}/reject")

    # Publish all approved suggestions.
    def publish_approved(self):
        return self.http_client.request_json("POST", "/api/suggestions/publish")

    # Delete a suggestion (only non-published).
    def delete(self, suggestion_id):
        return self.http_client.request_json("DELETE", f"/api/suggestions/{suggestion_id}")

    # Bulk delete suggestions by status (never published).
    def delete_by_status(self, status):
        return self.http_client.request_json("DELETE", f"/api/suggestions?status={status}")

