# Progress

state: in-progress
next action: read the browser-suite rerun (scratch e2e-run4.log), fix any remaining failure at the root, then run `pnpm verify`, stamp the ledger with `node scripts/ledger.mjs verify …`, commit and push

## Current slice
Design handoff port. Every screen now follows the Claude Design prototype (`oathsteps-handoff.zip`, live canvas with dark mode): `.o-*` system, Inter, five-step setup, Today plan, Practice library, recall/choice/varies cards with sheets, walkthrough + full mock, interview hub with voice/reading/writing/instructions/N-400, journey timeline with seven slots, four-stage guide, settings with appearance and typed delete, demo learner.

## Latest verified
- `pnpm test`: 78 unit tests pass (routing boundary, stop rules incl. walkthrough, answer matching, word diff, filing/milestone validation, journey slots, scheduler, plan, readiness, sync server, integrations, i18n).
- `pnpm typecheck`, `pnpm lint`: clean.
- `pnpm build`: passes.
- Dev-browser walkthrough at 375px in dark mode: Today, Practice, recall card, Journey render as designed.
- Browser suite run 3 (before locator fixes): 26 failures, all three causes were test locators (duplicated start button id, route announcer `role=alert`, ambiguous account label). Rerun in progress.

## Failures / open findings
- Browser suite rerun pending.
- Content is machine-checked only (owner gate).

## Resume procedure
1. Read this file, `.harness/features.json` and `.harness/decisions.md`.
2. `pnpm verify:quick` to confirm the tree still passes.
3. Continue from "next action". Update this file at every checkpoint.
