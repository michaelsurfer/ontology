# policy-engine

Shared OSS access-control library for AnythingGraph core services.

## Single source of truth

Role definitions and field policies live in **`config/oss-roles.yaml`** inside this crate.  
Other services (`data-layer-service`, `rdf-cache-service`) must **not** read that file directly.

```rust
use policy_engine::OssPolicyConfig;

let policy = OssPolicyConfig::load()?;
policy.is_valid_role("viewer");
```

## Override (optional)

Set `POLICY_CONFIG_PATH` to point at a different YAML file. Only **policy-engine** reads this variable.

## Bundled OSS roles

| `id` | Purpose |
|------|---------|
| `viewer` | Read-only, non-sensitive fields |
| `editor` | Operational read/write |
| `analyst` | Operational + financial read |
| `admin` | Full read access |

Custom roles are an Enterprise feature.
