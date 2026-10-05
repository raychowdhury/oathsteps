# Conditional integrations

None of these run in this release. Each has a typed adapter contract in `src/server/integrations/contracts.ts`, a `disabled` implementation that reports `unavailable` (tested in `disabled.test.ts`), and a configuration gate. Setting a provider name other than `disabled` fails startup until a real adapter exists, so nothing can silently pretend to work.

| Integration | Env flag | Core fallback that already works | Needed before enabling |
|---|---|---|---|
| Speech transcription and feedback | `SPEECH_PROVIDER` | Oral self-assessment (recall cards, mock) | Provider credentials kept server-side; consent screen and retention controls; transcript shown to the learner; `inconclusive` outcomes; a consented, independently labeled holdout with false-acceptance < 2% and false-rejection < 5% (research-proposed gates) before any result is shown as feedback. Semantic grading stays experimental until then. |
| USCIS case status | `USCIS_STATUS_PROVIDER` | Manual Journey milestones | Organization eligibility and approval on the USCIS developer portal, sandbox then production onboarding, user authorization flow, receipt-number consent and secure storage. The contract requires transport failures to surface as `unavailable`, never as "no change". No scraping. |
| Payments (proposed $19.99 / 90-day coaching access) | `PAYMENTS_PROVIDER` | No checkout is shown | Provider in test mode with test keys, server-verified entitlement (`entitlement()` is the only source of truth), idempotent webhook handling keyed by event id, clear offer copy (duration, limits, no renewal surprises). The price is an unvalidated proposal from the research report. |
| Push reminders | `PUSH_PROVIDER` | In-app reminders and `.ics` export | VAPID keys, subscription storage with consent, a real scheduler process, delivery tests on supported platforms. Until then the app explicitly does not promise background notifications. |

## Adding an adapter

1. Implement the interface from `contracts.ts` in `src/server/integrations/<name>.ts`.
2. Register it in `providers()` in `disabled.ts` behind its env flag.
3. Add contract tests mirroring `disabled.test.ts`, plus a browser test for the consent and failure states.
4. Record the external verification (what was tested against the real provider, when, by whom) in `.harness/evidence/` and flip the matching `C-00x` feature in `.harness/features.json` only after that.
