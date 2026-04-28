class IngestResource:
    def __init__(self, http_client):
        self.http_client = http_client

    # Send ingest events (webhook/SDK front door).
    def events(self, payload):
        return self.http_client.request_json("POST", "/api/ingest/events", body=payload)

    # List recent ingest events (debug/audit).
    def list_events(self, limit=100):
        return self.http_client.request_json("GET", f"/api/ingest/events?limit={int(limit)}")

