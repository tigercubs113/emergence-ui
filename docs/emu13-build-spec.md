# EMU-13 -- BL-007 code-layer remediation pass 2 + BL-231 tier predicate

**Type:** bugfix + product-direction
**Files under edit:** `utils/library.ts`, `components/RunCard.astro`, `components/RunDetail.astro`, `data/json-loader.ts` (possibly `data/types.ts`).  Plus tests.
**Estimated tokens:** ~18k
**Passing floor:** `npx vitest run` passes, count >= 144 (EMU-12 baseline).  Zero failing.
**Failing set:** none.

## Background

EMU-12 shipped the BL-007 code-layer rebase cleanly but left two visible bugs, caught by DC-16 + ES-21 T3 visual verify:

1. **Badge ordering bug.**  Planner EMU-12 spec had `runBadgeText` ordered: `if isEndedRun > ENDED; if paused > PAUSED; else RUNNING`.  Since run-2's runs.json has `ended_at` present (string set during pause transition per DC-14 discovery), `isEndedRun` returns true and the paused check never runs.  Result: paused run renders "ENDED" badge.

2. **RunDetail stat-block binding incomplete.**  EMU-12 fixed binding on RunCard (hub) but RunDetail header card still reads `current_tick` / `sim_days` (live-run fields) which are absent on paused manifests.  Result: detail page shows Ticks=0, Sim Days=0 for run-2 despite manifest `tick_count=200`, `sim_days=2.0`.

3. **Opportunity: fast-track BL-231.**  Drew's DC-14 Q1/Q2 answers: `ended_at` is written on any non-running transition (pause, TPK, error); paused runs stay in NowRunning; tier predicate must be status-based, not ended_at-based.  If we refactor `isEndedRun` to check status-terminal set `{ended, completed, aborted, crashed}` rather than ended_at presence, the badge ordering bug DISSOLVES -- paused runs won't be "ended" per the predicate, so even the buggy ordering would give PAUSED.  Proper fix, not tactical.

## Task Index

| ID | Task | Est |
|---|---|---|
| T1 | Refactor `isEndedRun` predicate in `utils/library.ts` to use status-terminal set (BL-231) | 3k |
| T2 | Update `listActiveRuns` + `listEndedRuns` in loader to use the new predicate (BL-231 consumer wiring) | 3k |
| T3 | Fix `RunDetail.astro` stat-block binding -- fall back to `tick_count` / manifest `sim_days` when `current_tick` absent | 3k |
| T4 | Verify `runBadgeText` three-way still correct with new `isEndedRun`; reorder defensively so paused check precedes isEndedRun even if predicate changes | 2k |
| T5 | Tests: paused run in NowRunning, ended run in Library, paused badge, detail-page binding for paused manifest | 4k |
| T6 | `npx vitest run` green, suite grows from 144, commit + push master | 3k |

## Acceptance

- T1: `isEndedRun(run)` returns true IFF `run.status IN {ended, completed, aborted, crashed}`.  Returns false for `running` AND `paused`.  The `ended_at` field is no longer consulted by this predicate.  Update docstring / comment to reflect the product-direction (status-based, not timestamp-based).
- T2: `listActiveRuns` returns runs where `!isEndedRun(run)` (running + paused).  `listEndedRuns` returns runs where `isEndedRun(run)` (ended, completed, aborted, crashed).  Tests confirm paused run is in ACTIVE, ended run is in ENDED.
- T3: RunDetail header card reads tick count from `run.tick_count` (or whichever field the loader normalizes to, matching RunCard's binding in EMU-12).  For a paused run with manifest `tick_count=200`, the header displays 200, not 0.  Sim days derived or direct-bound consistently with RunCard.
- T4: `runBadgeText` returns "PAUSED" when `run.status === "paused"`.  Defensive ordering: paused check BEFORE isEndedRun, even though post-T1 isEndedRun wouldn't return true for paused.  Belt-and-suspenders against future status-enum changes.
- T5: at least 4 new tests covering the invariants above.  Existing tests still green.
- T6: vitest suite exits 0, count >= 144, one or more commits on master with ECHOIT trailer, pushed.

## Token Reporting Protocol

Standard.  `docs/emu13-token-report.md`.  Per-task + totals in BUILDER_DONE.

<!-- BUILDER READS ABOVE THIS LINE ONLY -->

## Task Details

### T1 -- Refactor isEndedRun

**File:** `utils/library.ts`

**Current (EMU-12):**
```ts
export function isEndedRun(run: Run): boolean {
  return run.ended_at != null;  // or similar ended_at-presence check
}
```

**Target:**
```ts
const ENDED_STATUSES = ["ended", "completed", "aborted", "crashed"] as const;
type EndedStatus = typeof ENDED_STATUSES[number];

export function isEndedRun(run: Run): boolean {
  return ENDED_STATUSES.includes(run.status as EndedStatus);
}
```

Verify `Run.status` type union in `data/types.ts` includes all four terminal states.  If `crashed` isn't in the union, add it (EMU-10 added paused; this may be an extension of that same work).  If it's there, no type change needed.

The `ended_at` field remains on the Run type (informational -- timestamp of last non-running transition) but is no longer the classifier.

### T2 -- Loader wiring

**File:** `data/json-loader.ts`

Find `listActiveRuns`, `listEndedRuns`, and any other consumer of the ended classification.  Replace any `ended_at`-based predicate with `isEndedRun(run)` calls (imported from `utils/library.ts`).

Verify: any Hub or tier component that filtered runs based on the old semantics now benefits from the new predicate without touching its code (as long as it consumed `listActiveRuns` / `listEndedRuns`).

### T3 -- RunDetail stat-block binding

**File:** `components/RunDetail.astro`

Find the stat-block header region (around line 100-150 if EMU-4 layout is unchanged).  Identify where it reads tick counts from run.current_tick or equivalent live-running field.

Replace with whatever field name the loader-normalized Run object exposes for tick count -- the same field RunCard uses post-EMU-12.  Look at RunCard's binding (commit `407bdfa` introduced mapRunWithManifest) for the canonical field name.  Probably `run.tick_count` but verify.

Sim days: if RunDetail computes it from tick_count (divide by 100, rounded to 0.1), replace any `current_tick`-based computation with the same formula using `tick_count`.

Do NOT introduce a new field.  Use whatever EMU-12's mapRunWithManifest already exposes.

### T4 -- runBadgeText defensive ordering

**File:** `utils/library.ts` (or wherever EMU-12 landed runBadgeText)

**Current (EMU-12 as shipped, buggy ordering):**
```ts
export function runBadgeText(run: Run): "ENDED" | "PAUSED" | "RUNNING" {
  if (isEndedRun(run)) return "ENDED";
  if (run.status === "paused") return "PAUSED";
  return "RUNNING";
}
```

**Target (defensive ordering):**
```ts
export function runBadgeText(run: Run): "ENDED" | "PAUSED" | "RUNNING" {
  if (run.status === "paused") return "PAUSED";
  if (isEndedRun(run)) return "ENDED";
  return "RUNNING";
}
```

Post-T1, paused is no longer in the ENDED_STATUSES set, so `isEndedRun(pausedRun)` is false and the old ordering would work.  But defensive reorder prevents future regression if someone adds paused to ENDED_STATUSES by accident.

### T5 -- Tests

Add to `components/__tests__/Library.test.ts` or create `utils/__tests__/library.test.ts` if cleaner:

1. `isEndedRun(pausedRun)` returns false.
2. `isEndedRun(runningRun)` returns false.
3. `isEndedRun(endedRun)` returns true.
4. `listActiveRuns([paused, running, ended])` returns [paused, running].
5. `listEndedRuns([paused, running, ended])` returns [ended].
6. `runBadgeText(pausedRun)` returns "PAUSED".
7. RunDetail stat-block fixture: paused manifest with tick_count=200, current_tick absent > component renders "200".

If Astro component test harness unavailable (no container renderer per EMU-4 pattern), extract the binding into a pure helper function in `utils/` and test that helper.  Consistent with EMU-4's pattern.

### T6 -- Gate + push

```bash
npx vitest run
```

Exit 0, >= 144 tests (144 was EMU-12 baseline; T5 adds ~7+ new tests).

Commit per task or batched, your call.  Reference BL-007 + BL-231 + EMU-13 in messages.  Preserve ECHOIT trailer.

Fast-forward push to master.  Capture final SHA in BUILDER_DONE.

## Scope discipline

- Do NOT implement BL-232 (freshness predicate / staleness badge).  That's a separate PI needing Drew product input on threshold value.
- Do NOT touch project-emergence pipeline side (BL-344 writes ended_at semantics).  That's cross-repo; separate project PI.
- Do NOT touch any consumer site (drewconrad.us / echoit-site).  Submodule bump PIs (DC-17 / ES-22) are planner's job after this lands.
- If the Run.status type union needs extension (e.g., adding `crashed` if absent), do it minimally and note in deviations.

## Reference

- DC-16 BUILDER_BLOCKED evidence: `D:\Clanker\drewconrad.us\docs\pipeline-handoff.md` (recent) -- badge + detail symptoms.
- ES-21 BUILDER_BLOCKED evidence: `D:\Clanker\echoit-site\docs\pipeline-handoff.md` (recent) -- same symptoms confirmed cross-site.
- BL-231 backlog entry: `D:\Clanker\backlogs\emergence-ui.md`.
- Drew product direction on DC-14 questions: `D:\Clanker\drewconrad.us\docs\dc14-findings.md` + drewconrad-us backlog BL-007 body.
- EMU-12 commits: `407bdfa` / `9ecec23` / `0de9fed` / `fea594d`.
