---
status: BUILDER_DONE
pi: EMU-14
type: bugfix-diagnostic
file_limit: 0
build_spec: docs/emu14-build-spec.md
updated_by: builder
updated_at: 2026-04-20T23:55:00Z
error: null
---

## BUILDER_DONE -- EMU-14

Final master SHA: <pending-push>

### Files changed
- data/json-loader.ts (mapRunWithManifest + getRun propagate manifest.status)
- components/RunCard.astro (three-way badge class via runBadgeClass helper)
- components/RunDetail.astro (refactored to runBadgeClass helper)
- utils/library.ts (new runBadgeClass helper -- single source of truth)
- data/__tests__/json-loader.test.ts (+3 loader invariant tests)
- docs/emu14-diagnostic.md (T0 output)
- docs/emu14-token-report.md

### Acceptance
- T0: diagnostic pinpointed mapRunWithManifest/getRun status-merge gap (Hypothesis 2)
- T1: surgical fix -- manifest.status now reaches merged Run.status in both
  mapRunWithManifest and getRun; RunCard + RunDetail share runBadgeClass
- T2: 3 new loader-path invariant tests proving manifest.status reaches
  runBadgeText + runBadgeClass at the merged-Run level
- T3: vitest 158/0, commit pushed to master

### Deviations
- Helper extraction taken (not inlined).  runBadgeClass lives in
  utils/library.ts alongside runBadgeText, matching the EMU-5 runBadgeText
  pattern.  RunCard + RunDetail now both call the helper so they cannot
  drift.  Slight extra churn in RunDetail.astro, but prevents a recurrence
  of the binary-vs-three-way asymmetry.

### Token total
~8k actual vs 10k estimated.  Breakdown in docs/emu14-token-report.md.

### Next
Planner dispatches DC-18 + ES-23 submodule bumps.  BL-007 fully closed
after both sites verify PAUSED badge on live Hub + detail surfaces.
