# EMU-14 -- Paused badge render fix (BL-007 pass 3, last mile)

**Type:** bugfix + diagnostic
**Files under edit:** TBD after T0 diagnosis.  Likely `utils/normalize.ts`, possibly `components/RunCard.astro` or `components/RunDetail.astro`.  Plus tests.
**Estimated tokens:** ~10k
**Passing floor:** `npx vitest run` passes with count >= 156 (EMU-13 baseline 155 + at least 1 new live-render test).  Zero failing.
**Failing set:** none.

## Background

EMU-13 shipped 5 fixes for BL-007.  4 of the 5 verified correct on both consumer sites (DC-17 + ES-22 bumps, 2026-04-20):
- `isEndedRun` status-based predicate: works (no ENDED badge on paused run anymore).
- `listActiveRuns` / `listEndedRuns` wiring: works (run-2 in NowRunning tier).
- RunDetail stat-block binding: works (Ticks=200, Sim Days=2.0 rendered).
- `normalizeStatus` allow-list extension for `ended` + `crashed`: works (no type errors).

The 5th fix -- three-way badge rendering "PAUSED" for paused runs -- **did not actually propagate to the live render**, despite:
- T5 unit test passing: `runBadgeText(pausedRun) === "PAUSED"` confirmed green.
- T4 defensive ordering: paused branch precedes isEndedRun branch.
- T4b: RunDetail badge routed through `runBadgeText`.

Post-bump live HTML shows `<span class="em-badge em-badge--running">RUNNING</span>` on both Hub card and detail page for run-2, whose manifest has `status: "paused"`.

**The bug is between the pure helper and the render path.**  Tests of the helper pass; the helper is not getting the string "paused" at render time.

## Diagnostic hypotheses (most to least likely)

1. **`normalizeStatus` coerces 'paused' to 'running'.**  EMU-13 extended the allow-list to include `ended` + `crashed` but may have inadvertently left `paused` out of the allow-list OR the normalization function uses a default-to-running fallback for any value not in the allow-list.  EMU-10 originally added `paused`; EMU-13 may have rewritten the allow-list and dropped it.
2. **Render path reads raw `run.status` from the wrong object.**  E.g., RunCard receives Run from `listActiveRuns` and reads `run.runs_json_status` (the runs.json entry) instead of `run.manifest_status` (the manifest) -- runs.json entry for run-2 may still say 'running' in the loader-normalized shape even though manifest says 'paused'.
3. **Component uses a CSS-class-first pattern that bypasses `runBadgeText`.**  E.g., `class={`em-badge em-badge--${run.status}`}` + separate text binding.  If `run.status` lost 'paused' via normalize, the CSS class falls through to `em-badge--running` even if `runBadgeText` text binding says "PAUSED" -- but the ES-22 + DC-17 builders confirmed the TEXT says "RUNNING" too, so this is less likely than #1 or #2.
4. **Fixture / type mismatch in tests gave false green.**  The T5 test's fixture may use a different shape than what flows through the real loader > component pipeline.

## Task Index

| ID | Task | Est |
|---|---|---|
| T0 | **Diagnostic trace.**  Dispatch subagent to follow one paused Run from `data/json-loader.ts` through `utils/library.ts` through RunCard + RunDetail render, identifying every status-consumption point.  Compare against post-EMU-13 `utils/normalize.ts` allow-list.  Report: where does the string "paused" turn into "running" (or fail to match "paused" literal)? | 4k |
| T1 | **Narrow fix per T0 finding.**  Most likely: add 'paused' to `normalizeStatus` allow-list if missing, OR re-route the render-path status binding through `runBadgeText`, OR both. | 2k |
| T2 | **Live-render invariant test.**  Extract the component's status-binding helper (or build a minimal integration test) that takes a manifest with status="paused", pushes it through the full loader > component pipeline, and asserts the rendered HTML (or pre-render model) contains `PAUSED` text AND `em-badge--paused` class.  This test would have caught the EMU-13 gap. | 3k |
| T3 | `npx vitest run` green, commit + push master. | 1k |

## Acceptance

- T0: Diagnostic report pinpoints the single line / branch where `status="paused"` fails to reach `runBadgeText`.  Report saved to `docs/emu14-diagnostic.md`.
- T1: Surgical fix addresses the T0 finding.  No scope creep beyond the identified bug.  If the fix is a single-line addition to the allow-list, commit it.  If it's a component-binding change, commit it.  If both are needed, both.
- T2: At least 1 new test that would have failed pre-fix and passes post-fix.  Test must exercise the render path, not just the pure helper (T5 already covers the pure helper).  If Astro component test harness is not available, extract the binding into a helper + test the helper with realistic loader-output fixtures.
- T3: Vitest exits 0, count >= 156, commit(s) on master with ECHOIT trailer, pushed.

## Token Reporting Protocol

Standard.  `docs/emu14-token-report.md`.

<!-- BUILDER READS ABOVE THIS LINE ONLY -->

## Task Details

### T0 -- Diagnostic trace

Dispatch a single `opus` diagnostic subagent.  Subagent brief:

> Follow a paused Run (manifest `status: "paused"`) through the emergence-ui render pipeline post-EMU-13.  Starting from `data/json-loader.ts` where the manifest is loaded, trace every point where `status` is read, normalized, compared, or rendered.  Identify the exact line / branch where "paused" becomes "running" in the badge output.
>
> Key files (start here, expand as needed):
> - `utils/normalize.ts` -- confirm allow-list for `normalizeStatus`.  List every string the function accepts.  List the default / fallback for non-matching inputs.
> - `utils/library.ts` -- `runBadgeText`, `isEndedRun`, status-consuming helpers.  Is `runBadgeText` called with manifest-derived status or runs.json-derived status?
> - `data/json-loader.ts` -- `mapRunWithManifest` and any sibling normalization.  When a Run object is assembled, which status source wins: manifest.status or runs.json entry status?
> - `components/RunCard.astro` -- badge CSS class binding.  Is it `run.status` directly or via `runBadgeText`?  If both text and class bind separately, are they in sync?
> - `components/RunDetail.astro` -- same questions as RunCard.
>
> Return: a single paragraph naming the exact fix site, plus a code block showing the current (broken) snippet and proposed fix.

Save the report to `docs/emu14-diagnostic.md`.  Main-context builder reads only the summary.

### T1 -- Narrow fix

Apply the fix identified in T0.  Scope discipline:

- If the fix is in `normalizeStatus`: add the missing literal to the allow-list.  Do NOT refactor the function.  Do NOT widen the type union unnecessarily (EMU-13 already did the type union).  Just the allow-list entry.
- If the fix is in the component binding: replace `run.status` reads in the badge markup with `runBadgeText(run)` for text AND a derived `em-badge--${statusToClassToken(run)}` for class.  Make a helper if the class-token logic is non-trivial.
- If the fix is in `mapRunWithManifest` / loader: ensure the assembled Run.status prefers manifest.status over any other source (manifest is source of truth for a specific run; runs.json entry can drift).
- If the fix requires more than 30 lines: STOP, set BUILDER_BLOCKED -- scope is wrong, need planner input.

### T2 -- Live-render invariant test

Add to the appropriate `__tests__` directory.  Test shape:

```ts
it("paused run renders PAUSED badge end-to-end", () => {
  // Realistic fixture: runs.json entry with status whatever PE writes,
  // manifest.json with status="paused", ended_at set.
  const run = mapRunWithManifest(
    { run_number: 2, status: "running", ended_at: "2026-04-20T..." }, // runs.json
    { status: "paused", tick_count: 200, sim_days: 2.0, ... }, // manifest
  );
  expect(runBadgeText(run)).toBe("PAUSED");
  // And if there's a CSS class helper:
  expect(runBadgeClass(run)).toBe("em-badge--paused");
});
```

If `runBadgeClass` doesn't exist yet, consider extracting it as part of T1 so it's testable.  Otherwise, stub the minimum scaffolding to assert the class binding matches the text binding.

### T3 -- Gate + push

```bash
npx vitest run
```

Exit 0, count >= 156.  Commit(s) on master with ECHOIT trailer.  Reference BL-007 + EMU-14 in messages.

Fast-forward push to master.  Capture final SHA in BUILDER_DONE.

## Scope discipline

- **Do NOT** rewrite `normalizeStatus` beyond the allow-list entry.
- **Do NOT** refactor RunCard / RunDetail beyond the badge binding.
- **Do NOT** touch BL-232 (freshness predicate) or BL-344 (PE pipeline).
- **Do NOT** attempt a "comprehensive" badge-system refactor.  The bug is narrow; the fix must be narrow.
- If T0 reveals that the bug is elsewhere (not the hypotheses), STOP and set BUILDER_BLOCKED with the finding.  Planner will re-scope.

## Reference

- EMU-13 spec: `docs/emu13-build-spec.md`.
- EMU-13 master commit: `44ae086`.
- DC-17 BLOCKED evidence: `D:\Clanker\drewconrad.us\docs\pipeline-handoff.md` (archived block).
- ES-22 BLOCKED evidence: `D:\Clanker\echoit-site\docs\pipeline-handoff.md` (archived block).
- Progress table across BL-007 sequence (from DC-17 BLOCKED report):

  | Symptom | Pre-DC-15 | DC-15 | DC-16 (EMU-12) | DC-17 (EMU-13) |
  |---|---|---|---|---|
  | Hub Run 2 Ticks | 0 | 0 | 200 | 200 |
  | Hub Run 2 Sim Days | 0.0 | 0.0 | 2.0 | 2.0 |
  | Hub Run 2 Badge | running | running | ENDED | **RUNNING (EMU-14 target)** |
  | /run/2 detail Ticks | 0 | 0 | 0 | 200 |
  | /run/2 detail Badge | RUNNING | RUNNING | ENDED | **RUNNING (EMU-14 target)** |

  EMU-14 target: badge renders `PAUSED` on both hub and detail page for run-2.
