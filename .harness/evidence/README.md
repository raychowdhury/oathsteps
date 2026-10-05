# Evidence

`latest.json` is written by `pnpm verify` (`scripts/verify.mjs`) and is the only file here that git tracks. Each run records the commit, whether the tree was dirty, Node version, mode, and per-check `status` (`passed`, `failed`, `skipped`), exit code, duration and the tail of the output. Dated copies are kept locally and ignored by git.

Rules the ledger follows:

- A feature in `features.json` is `verified` only when its `evidence` array cites a `latest.json` recorded for the current commit (the runner prints a warning when that is not the case).
- `skipped` is never `passed`. A required check that is skipped fails the run.
- Browser evidence: Playwright traces and screenshots for failures land in `test-results/`; the HTML report in `playwright-report/`. Both are ignored by git and uploaded as CI artifacts.
- Manual walkthroughs are summarized in `progress.md` with the date, viewport and flow covered. They supplement, never replace, the recorded checks.
- No secrets, emails, dates of real applicants or learner answers belong in this folder.
