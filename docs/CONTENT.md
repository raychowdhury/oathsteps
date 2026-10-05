# Content pipeline

## Sources

`content/sources/SOURCES.json` records every official document with URL, SHA-256, retrieval time and the SHA-256 of the extracted text:

- `2025-128q.pdf`: USCIS M-1778 (09/25), 128 Civics Questions and Answers (2025 version).
- `2008-100q.pdf`: USCIS Civics Questions for the Naturalization Test (2008 test, rev. 01/19).
- Federal Register 2025-18050 and 8 CFR Part 312 pages (retrieved as client-rendered shells; kept as retrieval records).

Text extraction: `pnpm content:extract` (pypdf via `uv`). The `.txt` files are committed so ingestion is reproducible without Python.

## Ingestion

`pnpm content:ingest` parses the text into `content/packs/civics-2025.json` and `civics-2008.json`:

- Stable ids `2025-001` … `2025-128`, `2008-001` … `2008-100`, official order and section labels.
- Official prompt and answer wording verbatim; bracketed notes separated into `note`.
- `requiredCount` inferred from "Name two", "What are three …" wording (reviewed; overrides live in `ingest-rules.ts`).
- `special: true` for the asterisked 65/20 questions (20 per bank).
- `dynamic` for the 18 questions whose answers change (officeholders, state capital, party of the President, number of justices). Each carries an official lookup URL. The app never generates these answers.
- `version` = bank + first 8 hex of the content hash, `contentHash` over the content (everything except `review`), `generatedAt`. The `review` block is filled from review records, see below.

## Validation

`pnpm content:validate` exits nonzero if: source hashes drift, counts are not 128/20/8 and 100/20/10, ids or numbering break, a prompt looks truncated, an answer is empty, `requiredCount` exceeds the answers, a varying answer lacks a dynamic rule, the content hash does not match (someone edited a pack by hand), a pack, the guide or the English material claims human review without an approved review record for exactly that content, a review record exists but the pack was not regenerated, a review record is malformed, or a guide source is not on an official domain.

The project PostToolUse hook runs this check whenever a content file changes.

## Review levels

Each pack, the guide and the English material carry `review.machineChecked` and `review.humanReviewed`. Everything in this release is machine-checked only, and the screens say so. A human review is a record in `content/review/records/` that names the exact content by hash, so later edits cannot inherit an old approval. `pnpm content:review-packet` builds what a reviewer works from. The full procedure, who can review which scope and how to find a reviewer are in [content/review/REVIEW.md](../content/review/REVIEW.md).

## Updating official content

1. Download the new PDF into `content/sources/`, update `SOURCES.json` (URL, hashes, retrieval time), run `pnpm content:extract`.
2. Run `pnpm content:ingest` and `pnpm content:validate`. Fix parser rules in `ingest-rules.ts` if wording changed.
3. Review the diff of the pack JSON by hand; every changed question needs an owner's sign-off.
4. Commit and deploy. Attempts store `packVersion`, so historic results keep their revision. Learners see the new pack version in Settings.

**Rollback**: `git revert` the content commit and redeploy. No data migration is needed.

## Dynamic answers

Dynamic questions show an official lookup and a form where the learner records the answer they confirmed, the region it applies to and the date they checked. Unconfirmed dynamic questions are practiced but recorded as prompted (never advance mastery), excluded from mock scoring and multiple choice, and listed under "needs another attempt" on the Readiness screen. A ZIP code can span districts, so the representative lookup tells the learner to confirm their address on house.gov; no address is stored.

## Correction reports

"Report a problem with this answer" on any card stores a local report (question id, pack version, message). Reports are included in the JSON export and synced to an account if one exists. Triage them weekly: verify against the official source, fix the parser or source, release a new pack version, and note the change in `.harness/decisions.md`. There is no affected-user notification mechanism yet; the pack version shown in Settings is the signal that content changed.
