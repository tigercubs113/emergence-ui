# EMU-13 Token Report

| Task | Estimated | Actual |
|------|-----------|--------|
| T1 isEndedRun refactor | 3k | ~1k |
| T2 loader wiring | 3k | ~1k |
| T3 RunDetail binding | 3k | ~1k |
| T4 runBadgeText defensive order | 2k | ~0.5k |
| T4b RunDetail badge consistency | - | ~0.2k |
| T5 tests | 4k | ~3k |
| T6 gate + push | 3k | ~2k |
| Total | 18k | ~8.7k |

Notes:
- T4b follow-up dispatched after T1-T4 impl flagged RunDetail badge divergence (still binary isEndedRun, not runBadgeText).  Closed the loop for single-source badge consistency.
- T5 discovered normalizeStatus allow-list didn't include 'ended' or 'crashed' (T1 extended Run.status union but normalizer coerced them to 'running').  Fixed in utils/normalize.ts.
- No CSS changes.  em-badge--paused already in styles/emergence.css.
- Single commit bundles code + tests + token report + handoff flip for atomic BUILDER_DONE state.
