# Git submodules

Major components live in separate repositories and are linked here as **submodules**:

| Path | Repository |
|------|------------|
| `core-services/` | https://github.com/anythingGraph/anythingGraph-core |
| `dashboard/` | https://github.com/anythingGraph/anythingGraph-dashboard |
| `mcp-service/` | https://github.com/anythingGraph/anythingGraph-mcp-service |
| `website/` | https://github.com/anythingGraph/website |

The monorepo lives at [anythingGraph/AnythingGraph](https://github.com/anythingGraph/AnythingGraph). A personal mirror may also exist at [K-Murti/ontology](https://github.com/K-Murti/ontology) (GitHub username: **K-Murti**).

## Clone

```bash
git clone --recurse-submodules https://github.com/anythingGraph/AnythingGraph.git
cd AnythingGraph
```

If you cloned without `--recurse-submodules`:

```bash
git submodule update --init --recursive
```

## Pull latest in all submodules

```bash
git pull
git submodule update --init --recursive
# or, to also fetch latest remote branches inside each submodule:
git submodule foreach git pull origin main
```

(Use `master` instead of `main` if a submodule’s default branch differs.)

## Work inside a submodule

```bash
cd core-services
git checkout -b my-feature
# ... edit, commit ...
git push -u origin my-feature
cd ..
git add core-services
git commit -m "chore: bump core-services submodule"
```

The parent repo records **which commit** each submodule points to; bump the submodule when you want the monorepo to pin a newer release.

## History split

These submodule repos were populated from this monorepo’s history using `git subtree split` on each path, then `git push` to the targets. Further development can happen in either the standalone repo or via submodule bumps in the monorepo.
