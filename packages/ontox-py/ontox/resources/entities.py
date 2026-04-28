class EntitiesResource:
    def __init__(self, http_client):
        self.http_client = http_client

    # List builtin + custom entities with columns.
    def list(self):
        return self.http_client.request_json("GET", "/api/entities")

