<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## AIO data integrity

- AIO is a general-purpose keyword audit. A keyword supplied in a screenshot or test is an example, not a product default, source dataset, or scoring rule.
- Never put example keywords, domains, excerpts, prices, ranks, scores, gaps, or invented conclusions in production AIO UI, including canvas/Three.js textures and loading illustrations. Empty/loading views use process labels; results use the current audit response only.
- Every new submission starts a new audit. Do not restore old runs or reuse artifacts across audits/users/keywords. Checkpoints and exact-text vector reuse are scoped to the current audit only.
- Changing an audit input invalidates its displayed output and rank inputs. Preserve notebook scoring thresholds and the rank/action workflow unless the user explicitly requests a change.
- Keep fixtures under `tests/` and out of production imports. Validate topic isolation with `tests/aio/test_isolation.py` and the workspace lifecycle with `tests/aio-workspace.test.ts` after changing the AIO flow.
