# Expert review of OathSteps content

OathSteps says "machine-checked, not yet expert-reviewed" on every screen that shows official wording. This protocol is how that sentence is replaced with a true statement. Nothing in the app flips it without a recorded review.

## Who can review what

| Scope | What it covers | Who |
|---|---|---|
| `civics-2025`, `civics-2008` | 228 questions and answers copied from two USCIS PDFs | A licensed U.S. immigration attorney, or a DOJ-accredited representative at a recognized organization. A careful spot check is enough; a program already checks counts, numbering and file hashes. |
| `guide` | The 18-step preparation guide and its source links | The same kind of reviewer. This is where legal accuracy matters most. |
| `english` | Reading and writing sentences, officer instructions, vocabulary, conversation prompts | An adult ESL or civics instructor, ideally also read by the attorney for the interview statements. |
| Privacy notice and Terms | `src/components/Legal.tsx` | A lawyer with privacy and consumer-terms experience. Recorded with `LEGAL_REVIEWED_ON`, not here. |

These are different skills. One person's approval of one scope does not cover another.

## Finding a reviewer

- USCIS lists how to find legal help, including nonprofit and DOJ-recognized organizations: https://www.uscis.gov/avoid-scams/find-legal-services
- Immigrant-serving nonprofits and legal aid offices sometimes review educational material for free or at low cost. Law-school immigration clinics are another source. Bar association referral services can find a private attorney for a fixed-fee scope.
- Offer a bounded task: the packet below, a deadline, and a clear yes/no per scope. Say plainly that OathSteps is a free study tool and that the reviewer is not being asked to take on clients or give advice to learners.
- Ask whether they consent to being named. Their credential and the date appear in the app. Their name stays in this repository only with their consent; if they decline, ask them to confirm in writing and record the credential only, with a note, and keep the signed message outside the repository.

## Steps

1. Generate the packet: `pnpm content:review-packet`. It writes `content/review/out/` (not committed): `OathSteps-content-review-packet.pdf` (about 40 pages, Letter landscape, with check boxes, comment columns and a sign-off page; print it or annotate it on screen), plus `REVIEW-PACKET.md` and the same material as spreadsheets (`questions-2025.csv`, `questions-2008.csv`, `guide.csv`, `english-and-interview.csv`). Give the reviewer the PDF and, if they want to verify wording, the two source PDFs in `content/sources/`.
2. The reviewer marks the spreadsheets and says, per scope, approve or what must change.
3. Fix what they found. Wording from USCIS is never edited by hand: change the parser rules in `content/scripts/ingest-rules.ts` and re-run `pnpm content:ingest`. Guide and English text are edited in their JSON files. Then generate a new packet. **Any change to a scope's content changes its content reference, and an approval only covers the content reference it names.**
4. Record each approval as a file in `content/review/records/`, for example `2026-11-02-guide.json`:

   ```json
   {
     "scope": "guide",
     "contentRef": "<the sha256 printed by pnpm content:review-packet for this scope>",
     "result": "approved",
     "reviewer": { "name": "Full Name", "credential": "Licensed attorney, State", "organization": "Optional" },
     "reviewedOn": "2026-11-02",
     "notes": "Optional. Conditions or scope limits the reviewer stated."
   }
   ```

   `result` is `approved` or `changes-requested`. Only `approved` counts.
5. Apply it:
   - Civics packs: `pnpm content:ingest`. The pack's `review` block is filled from the matching record (credential and date only).
   - Guide and English: set `review.humanReviewed` to `true` in `content/guide/stages.json` or `content/english/tasks.json`. For the guide also set `review.humanReviewedAt` (the review date) and `review.reviewerCredential`.
6. `pnpm content:validate` must pass. It fails if a flag says reviewed without a record that matches the current text, or if a record exists but the pack was not regenerated.
7. `pnpm verify`, commit, deploy. Settings, the question source sheet and the guide now show "Reviewed {date} by {credential}".
8. `pnpm release:check` shows which scopes are still open.

## What the app never does

It does not present a review as covering text that changed afterwards, show the reviewer's name, or claim a legal review of anything the record does not name.
