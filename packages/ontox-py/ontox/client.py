from .http import HttpClient
from .resources.entities import EntitiesResource
from .resources.sparql import SparqlResource
from .resources.rdf import RdfResource
from .resources.ingest import IngestResource
from .resources.suggestions import SuggestionsResource


class OntoXClient:
    def __init__(self, base_url=None, api_key=None, timeout_seconds=30):
        # Create a client for OntoX API.
        self.http_client = HttpClient(
            base_url=base_url,
            api_key=api_key,
            timeout_seconds=timeout_seconds,
        )
        self.entities = EntitiesResource(self.http_client)
        self.sparql = SparqlResource(self.http_client)
        self.rdf = RdfResource(self.http_client)
        self.ingest = IngestResource(self.http_client)
        self.suggestions = SuggestionsResource(self.http_client)

