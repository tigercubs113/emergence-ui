---
status: IDLE
pi: EMU-13
type: bugfix-product-direction
file_limit: 0
build_spec: docs/emu13-build-spec.md
updated_by: planner
updated_at: 2026-04-20T22:55:00Z
error: null
---

## EMU-13 CLOSED

Planner reviewed builder report.  All tasks PASS plus one bonus fix (T4b: RunDetail badge also routed through runBadgeText for cross-component consistency).  Final master SHA: `44ae086`.  Vitest 155/0.

### Commits on emergence-ui master

- `44ae086` EMU-13: status-based isEndedRun + defensive runBadgeText + RunDetail stat-block binding + normalize.ts fix + tests

### Resolution map

- **BL-007 code layer:** FULLY remediated.  Status-based predicate, correct PAUSED rendering everywhere, RunDetail stat-block binding.  DC-17 + ES-22 submodule bumps will propagate to consumer sites.
- **BL-231 (status-based tier predicate):** RESOLVED via EMU-13 T1+T2.
- **BL-232 (freshness predicate):** still open; Drew input on threshold value needed.
- **BL-344 (project-emergence pipeline ended_at writes):** still open; cross-repo.

### Scope-creep notes

T4b (RunDetail badge consistency) and the normalize.ts allow-list fix were not in the spec but strictly necessary for T1 to work end-to-end.  Builder flagged both in deviations.  Planner accepts.

### Bonus catch

`normalizeStatus` was coercing 'ended' + 'crashed' to 'running', which would have silently broken T1 predicate at the loader layer.  T5 tests caught it.  Good systematic fix.

### Next

Planner dispatches DC-17 + ES-22 submodule bumps in parallel, both pointing at `44ae086`.  Expected T3 success on both this time (badge PAUSED, detail page stat-block populated for run-2).

---

## Prior handoff content follows:

## EMU-13 BUILDER_DONE summary

Final master SHA: 44ae086

### Files changed
- utils/library.ts (TERMINAL_STATUSES + status-based isEndedRun + defensive runBadgeText)
- utils/normalize.ts (allow 'ended' + 'crashed' in normalizeStatus)
- data/types.ts (Run.status union: added 'ended' + 'crashed')
- data/json-loader.ts (comments + getRun tickCount `??`->`||` fix)
- components/RunDetail.astro (badge via runBadgeText + em-badge--paused class)
- Tests: +11 across 4 test files
- docs/emu13-token-report.md (new)

### Acceptance
- T1: isEndedRun status-based ok
- T2: listActive/EndedRuns use new predicate ok
- T3: RunDetail stat-block reads tick_count/sim_days via getRun fix ok
- T4: runBadgeText defensive ordering (paused > ended > running) ok
- T4b: RunDetail badge uses runBadgeText (consistency with RunCard) ok
- T5: 155 passing / 0 failing (was 144, +11)
- T6: vitest green, commit pushed to master, single-commit delta

### Deviations
- T4b added beyond spec to close BL-007 pass-2 loop (RunDetail badge was still binary isEndedRun post-EMU-12; would have shown "RUNNING" for paused runs on detail pages while RunCard showed "PAUSED").  Closed via single-line swap to runBadgeText + em-badge--paused class.
- T5 discovered + fixed normalizeStatus allow-list bug.  T1 extended Run.status union with 'ended' + 'crashed' but normalizer was coercing those to 'running', silently breaking T1 classification at the loader layer.  Scope-creep but strictly necessary for T1 to work end-to-end.
- Single commit (not per-task) since changes are tightly coupled.  Bundles code + tests + token report + handoff flip for atomic BUILDER_DONE state.

### Token total
~8.7k actual vs 18k estimated.  Breakdown in docs/emu13-token-report.md.

### Next
BL-231 resolved.  Planner dispatches DC-17 (drewconrad.us submodule bump) + ES-22 (echoit-site submodule bump) to propagate.  BL-232 (freshness predicate) + BL-344 (PE pipeline ended_at writes) remain open.
