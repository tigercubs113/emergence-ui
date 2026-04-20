# EMU-5 -- BL-007 remediation: run-display rendering bugs

**Type:** code fix (emergence-ui submodule only)
**Files under edit:** `components/RunCard.astro`, `components/RunDetail.astro`, `components/Hub.astro` (or relevant tier source), `utils/library.ts`, `data/json-loader.ts`.  Plus tests.
**Estimated tokens:** ~18k
**Passing floor:** `npm test` existing suite remains green (current floor: 118+ tests passing per EMU-4 close).  `npm run build` exits 0.
**Failing set:** none (no failing tests at EMU-4 close).

## Background

BL-007 root causes discovered by DC-14 diagnostic (drewconrad.us `docs/dc14-findings.md`, commit `b08e78c`).  Three bugs live in emergence-ui:

1. **Stat-block field-binding bug (RC3):** Ticks and Sim Days render as 0 / 0.0 on hub cards and run pages even when the manifest has real data.  Example: run-2 has `tick_count: 200` but displays 0.  Cause: binding reads the wrong source (runs.json row where values are absent/0) instead of the merged manifest, or reads before manifest merge completes.

2. **Tier/badge contradiction (RC4):** run-2 classifies as Library tier (via `ended_at` being a string) but the status badge reads "RUNNING" (from the `status` field).  Two independent lifecycle signals written by different code paths; the UI surfaces both without reconciling.

3. **Orphan runs crash route (RC1 supporting fix):** `runs.json` contains entries (e.g. run_numbers 19, 20, 21, 22, 25) with no matching on-disk `run-N/` directory.  The primary fix is at the data layer (DC-15 prunes runs.json), but emergence-ui should also defend itself -- silently skip any run where manifest lookup fails rather than emitting a stub card or route.

Out of scope this PI:
- Freshness predicate (DC-14 quick-fix option 5) -- needs product direction on "paused in NowRunning vs Library" semantics.
- `ended_at` writeback semantics -- pipeline concern (PE-PIP-7X, backlog).

## Task Index

| ID | Task | Est |
|---|---|---|
| T1 | Fix stat-block field-binding in RunCard + RunDetail header -- bind `tick_count` / `sim_days` from merged manifest, not from runs.json row | 4k |
| T2 | Reconcile tier/badge -- derive badge text from the tier predicate in `utils/library.ts` rather than from raw `status` field | 3k |
| T3 | Defensive orphan filter -- in the loader or Hub layer, skip runs where manifest lookup fails.  Do not render cards or generate routes for orphans | 3k |
| T4 | Tests: add Vitest cases for (a) stat-block renders correct values from manifest, (b) tier/badge never contradict, (c) orphan runs filtered out of Hub and route generation | 5k |
| T5 | `npm test` passes full suite.  `npm run build` exits 0.  Commit and set BUILDER_DONE | 3k |

## Acceptance

- T1: for run-2 fixture (tick_count 200, sim_days 2), RunCard + RunDetail header render "200" and "2" (or equivalent).  No hardcoded workaround -- the binding must read from the data source that actually holds the values.
- T2: for any run, the tier classification and the badge text agree.  If library.ts says "ended," badge reads "ENDED" (or equivalent).  If "running," badge reads "RUNNING."  A single-source-of-truth predicate powers both.
- T3: for a runs.json entry with no on-disk manifest, the Hub does NOT render a card AND the dynamic `/run/[n]` route does NOT appear in getStaticPaths output.  Orphans vanish completely.
- T4: new tests cover all three fixes.  Existing tests still pass.
- T5: `npm test` green.  `npm run build` exits 0.  Changes committed.  Handoff BUILDER_DONE with commit SHAs.

## Token Reporting Protocol

- Each subagent reports `Tokens: [actual]` at summary end.
- Builder writes `docs/emu5-token-report.md` (per-task estimated vs actual) before BUILDER_DONE.
- Handoff BUILDER_DONE body includes total + delta %.

<!-- BUILDER READS ABOVE THIS LINE ONLY -->

## Task Details

### T1 -- Stat-block field binding fix

**Symptom:** run-2 has `tick_count: 200` in its `manifest.json` but RunCard and RunDetail header render "0" for ticks and "0.0" for sim days.  Same bug propagates to every run.

**Diagnostic steps:**
1. Read `components/RunCard.astro` -- find the prop/field accessor that supplies the tick count to the displayed stat block.  Is it `run.tick_count`, `run.ticks`, `run.manifest.tick_count`, or something else?
2. Read `components/RunDetail.astro` -- same question for the header stat block.
3. Read `data/json-loader.ts` -- find where the loader merges runs.json row data with manifest.json data.  Which field name does the merged object expose for tick count?
4. The fix is to bind RunCard/RunDetail stat values to the field that the loader actually populates from manifest.json.

**Acceptance:** test fixture with a run whose runs.json row has `tick_count: 0` (or missing) and whose manifest.json has `tick_count: 200` renders "200" on RunCard.  If the fields are named differently in runs.json vs manifest.json (schema drift), the loader normalizes to a single canonical field name and components read that.

**Sim days:** same treatment.  If it is derived (`tick_count / ticks_per_day`), verify the derivation uses the correct tick count.

### T2 -- Tier/badge reconciliation

**Symptom:** run-2 is in the Library tier (because `ended_at` is a string in its runs.json row) but RunCard's status badge reads "RUNNING" (because the `status` field is still `"running"`).  Two truths out of sync.

**Approach (per DC-14 quick-fix option 6, preferred variant):**
1. Read `utils/library.ts` -- find the tier predicate (likely something like `isEndedRun(run)` or inline `run.ended_at != null`).  That predicate is the single source of truth for lifecycle classification.
2. Read `components/RunCard.astro` -- find where the badge text is computed.  Replace the raw `status` field read with a call to the same tier predicate.
3. Define a tiny helper (or inline ternary) such that:
   ```ts
   const badgeText = isEndedRun(run) ? "ENDED" : "RUNNING";
   ```
   Or whatever label convention matches current copy.  Preserve any existing "PAUSED" styling if library.ts can distinguish paused-vs-running; if it cannot, badge is binary "ENDED" vs "RUNNING" with a backlog item for paused-badge refinement.

**Acceptance:** no possible input makes tier say X and badge say not-X.  Tests assert this invariant.

**Note on paused state:** DC-14 findings flagged that the product semantics of `ended_at` / paused are unclear.  EMU-5 does NOT attempt to invent a paused state.  If library.ts currently has no paused concept, the badge is binary.  Product direction for paused handling belongs in a future PI.

### T3 -- Defensive orphan filter

**Symptom:** `runs.json` contains entries for run_numbers (e.g. 19, 20, 21, 22, 25) with no corresponding on-disk `run-N/` directory.  Hub renders a card for each.  `/run/[n]` `getStaticPaths` emits a route for each.  Orphan routes render stubs with zero data -- this is the `/run/25` "no data + running" symptom.

**Approach (per DC-14 quick-fix option 2):**
1. In `data/json-loader.ts`, find the method that lists runs for the Hub (`listRuns`, `listActiveRuns`, `listEndedRuns`).  Add a filter: skip any run where the manifest lookup returns null / throws / hits the fallback path.  The filter MUST not silently swallow ALL errors -- only the specific "manifest not found" case.  Any other failure bubbles normally.
2. In the Hub wiring and/or the `/run/[n]` route's getStaticPaths, this filter automatically removes orphans.  Verify both call sites benefit from the loader-layer filter; if not, add an explicit filter at the route.
3. Log a warning (console.warn) when an orphan is filtered out, including the run_number -- so pipeline drift is observable without breaking the build.

**Acceptance:** test fixture with a runs.json entry for run_number 99 and no corresponding manifest file: Hub does not render a RunCard for it, getStaticPaths does not emit `/run/99/`.  Console warning emitted exactly once.

**Belt-and-suspenders:** DC-15 will also prune the orphans from runs.json (data-layer fix).  EMU-5's defensive filter is the submodule-layer defense against future pipeline re-drift (PE-PIP-7X is not yet shipped).

### T4 -- Tests

Add Vitest cases under the existing `__tests__` folders.  Minimum coverage:

**Stat-block (T1):**
- File: `components/__tests__/RunCard.test.ts` (create if absent) or `data/__tests__/json-loader.test.ts`
- Case: loader merges manifest `tick_count: 200` over runs.json `tick_count: 0` (or missing), RunCard receives 200 not 0
- Case: sim_days derived correctly

**Tier/badge (T2):**
- File: `components/__tests__/RunCard.test.ts`
- Case: ended run renders ENDED badge
- Case: running run renders RUNNING badge
- Invariant test: tier classification and badge text never disagree (property-style or matrix)

**Orphan filter (T3):**
- File: `data/__tests__/json-loader.test.ts` or `data/__tests__/json-loader-tiers.test.ts`
- Case: runs.json row with no manifest file is filtered out of listRuns
- Case: console.warn called once with the orphan run_number
- Case: other loader errors (I/O, parse) still throw normally

### T5 -- Build + test gate

1. `npm test` -- full Vitest suite must pass.  Current floor ~118 tests per EMU-4 close.  New tests land; floor grows.
2. `npm run build` -- exits 0 (Astro check + Astro build).
3. Commit per task or as one commit, your call.  Commit messages reference BL-007 and the task ID.
4. BUILDER_DONE body includes: file-path summary of changes, test count delta, commit SHAs, token report, any deviations.

## Scope discipline

- Do NOT modify runs.json.  That is DC-15 scope.
- Do NOT implement a freshness predicate or paused badge state.  Both need product direction.
- Do NOT add `ended_at` writeback logic.  That is PE-PIP-7X.
- Do NOT bump any consumer sites' submodule pointers.  That is DC-15 / ES-X.
- If any instruction here conflicts with current code state, STOP and set BUILDER_BLOCKED with the specific conflict -- do not guess.

## Reference

DC-14 findings doc: `D:\Clanker\drewconrad.us\docs\dc14-findings.md` (commit `b08e78c` on drewconrad.us master).  Read-only reference.  Contains verbatim code citations and line numbers for each root cause.
