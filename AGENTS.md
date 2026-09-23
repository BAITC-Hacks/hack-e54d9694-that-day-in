# Working agreement

- Before each meaningful work stage, fetch all origin branches and pull the current upstream branch. Inspect changes from main and other codex branches; merge only compatible changes. Never overwrite another developer's changes.
- Commit and push completed, verified stages. Do not force push. Developer 1 coordinates integration.
- The sole authoritative dataset is `dataset/dataset.json`: five districts, ten indicators, fourteen measures, eight quarters, five distinct measures, at most two per direction. AI explains the deterministic score; it does not grade it.
- `codex/contracts` (c4b8ca1) and `codex/dataset-prep` (57e31e9) were migrated to the authoritative dataset and integrated into `codex/ui`. Never resurrect their older six-district/80:20 catalog from historical commits.
- Developer 1 owns project setup, dependencies, pages, components, client UI, public assets, browser tests, README and deployment.
- Developer 2 owns shared domain contracts, data adapters, simulation, AI, API routes, unit/API tests and model documentation.
- Never put secrets in Git. Keep backend packages out of browser bundles.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
