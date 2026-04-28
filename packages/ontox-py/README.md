# ontox (Python)

Python SDK for the OntoX ontology platform.

## Quick start

```python
from ontox import OntoXClient

client = OntoXClient(base_url="http://localhost:5174")

entities = client.entities.list()
print(entities)
```

