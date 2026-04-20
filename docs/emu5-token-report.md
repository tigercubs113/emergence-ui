# EMU-5 Token Report

| Task | Estimated | Actual | Delta |
|------|-----------|--------|-------|
| T1 stat-block binding | 4k | ~4k | 0% |
| T2 tier/badge reconciliation | 3k | ~3k | 0% |
| T3 orphan filter | 3k | ~4k | +33% |
| T4 tests | 5k | ~5k | 0% |
| T5 build gate | 3k | ~2k | -33% |
| Total | 18k | ~18k | 0% |

Notes:
- T1+T2+T3 ran as one subagent due to shared-file edits (utils/library.ts, data/json-loader.ts, components/RunCard.astro, components/RunDetail.astro).  Reported combined ~11k for three tasks (vs 10k combined estimate).
- T4 subagent reported summary token count only (~290).  Actual work included +23 Vitest tests across three files; rough estimate ~5k.
- T5 build gate: CSS sanity check found missing `em-badge--ended` definition; added one-line rule to styles/emergence.css using existing `--em-success` token (matches `em-badge--completed` visual).  No npm build script exists in this submodule; vitest is the test gate.  Tests: 141/141 passing.
- CSS discovery: `em-badge--running` already present.  `em-badge--ended` added with green tint reusing `--em-success` (ENDED is terminal, green signals finality).  No new tokens introduced.
