class RdfResource:
    def __init__(self, http_client):
        self.http_client = http_client

    # Export Turtle RDF from current platform data.
    def export_turtle(self, include_ontology=True, include_data=False, max_rows_per_entity=200):
        return self.http_client.request_text(
            "POST",
            "/api/rdf/export",
            body={
                "includeOntology": bool(include_ontology),
                "includeData": bool(include_data),
                "maxRowsPerEntity": int(max_rows_per_entity),
            },
        )

