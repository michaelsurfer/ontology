class SparqlResource:
    def __init__(self, http_client):
        self.http_client = http_client

    # Run a SPARQL query and return JSON bindings.
    def query(self, query_text, include_ontology=True, include_data=False, max_rows_per_entity=200):
        return self.http_client.request_json(
            "POST",
            "/api/sparql",
            body={
                "query": query_text,
                "includeOntology": bool(include_ontology),
                "includeData": bool(include_data),
                "maxRowsPerEntity": int(max_rows_per_entity),
            },
        )

