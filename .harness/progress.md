# Progress

state: in-progress
next action: run unit tests and typecheck for the domain layer, then build the IndexedDB store and app shell (Setup → Today → Practice slice)

## Current slice
Domain layer (routing, scheduler, mock state machine, plan, readiness, answers) with unit tests.

## Latest verified
- Content ingestion + validation pass locally (128/20, 100/20, hashes match). Evidence: run `pnpm content:validate`.

## Failures / open findings
- none yet

## Resume procedure
1. Read this file, `.harness/features.json` and `.harness/decisions.md`.
2. `pnpm verify:quick` to confirm the tree still passes.
3. Continue from "next action". Update this file at every checkpoint.
