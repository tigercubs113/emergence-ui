# EMU-14 T0 Diagnostic -- paused badge gap

## Finding

`mapRunWithManifest` in `data/json-loader.ts` merges manifest values for
`tick_count`, `sim_days`, `agent_count`, `prng_seed`, and `wall_clock_ms`,
but it does NOT merge `status`.  `status` is sourced exclusively from the
`runs.json` row via `mapRun` (L116: `status: normalizeStatus(raw.status)`).
On the live pipeline, `runs.json` does not get rewritten when a run
transitions to paused -- only the on-disk `manifest.json` does -- so the
merged `Run` object carries `status: "running"` from the stale `runs.json`
row even when the manifest says `"paused"`.  `runBadgeText` and the
badge-class derivation both see `status === "running"` and emit the
RUNNING badge.  Secondary defect: `RunCard.astro` L21 `badgeClass` has a
binary `ended ? --ended : --running` ternary with no paused branch,
so even if status were correctly `"paused"`, the CSS class would still
fall back to `em-badge--running` on the Hub card (text via `runBadgeText`
would render "PAUSED" correctly, but class would mismatch).

## Trace

Paused Run-2 flowing through pipeline (manifest `status: "paused"`,
runs.json row `status: "running"` -- the live shape):

1. `runs.json` row arrives at loader: `status = "running"`.
2. `manifest.json` arrives at loader: `status = "paused"` (not consulted
   for status anywhere in the loader).
3. `mapRun(raw)` runs (`data/json-loader.ts:107-128`).  L116:
   `status: normalizeStatus(raw.status)` -- input is `"running"` from the
   runs.json row.  Manifest is never read for status.
4. `normalizeStatus("running")` (`utils/normalize.ts:29-49`) -- allow-list
   matches `completed | aborted | paused | ended | crashed`; `"running"`
   falls through to the L48 fallback `return 'running'`.  Output:
   `"running"`.  (Allow-list DOES contain `"paused"`; normalizeStatus is
   NOT the bug.)
5. `mapRunWithManifest(raw)` (`data/json-loader.ts:85-105`) builds `base`
   from `mapRun`, then spreads manifest values.  Spread only covers
   `tick_count | sim_days | agent_count | prng_seed | wall_clock_ms`.
   Status from `base` survives unchanged.  Final merged `run.status =
   "running"`.
6. Hub -> RunCard.astro receives `run.status = "running"`.  L19-21:
   `ended = isEndedRun(run)` is `false`.  `badgeText = runBadgeText(run)`
   returns `"RUNNING"` (paused branch L40 of utils/library.ts never
   fires because status is not "paused").  `badgeClass = ended ?
   em-badge--ended : em-badge--running` resolves to
   `em-badge em-badge--running`.
7. Live HTML: `<div class="em-badge em-badge--running">RUNNING</div>`.
   Matches the observed DC-17 + ES-22 live output.
8. RunDetail.astro same path (L18 `runBadgeText(run)` + L21 class ternary).
   Same `status = "running"` input.  Same RUNNING output.

## Root cause

**Hypothesis 2 is correct.**  The loader reads status from the runs.json
row only; the manifest's status is never consulted, so a paused run whose
runs.json row still says `"running"` never reaches `runBadgeText` with
`"paused"`.  A secondary RunCard-only defect (Hypothesis 3) compounds the
issue: `badgeClass` L21 has no paused branch even when status is correct.

## Recommended fix

Two surgical edits:

1. **`data/json-loader.ts:85-105` -- `mapRunWithManifest`**.  Add
   `status: normalizeStatus(manifest.status ?? base.status)` to the
   returned object so the manifest's status wins when present, falling
   back to the runs.json row's status.  Same precedence model already
   used for the other five numeric fields in this function (manifest
   trumps stale runs.json).  Mirror the same change in `getRun`
   (`data/json-loader.ts:264-279`) where `base` is spread into the
   `RunDetail` return.  Pattern: `status: normalizeStatus(manifest.status
   ?? base.status)`.

2. **`components/RunCard.astro:21` -- `badgeClass`**.  Replace the binary
   ternary with a three-way derivation matching `RunDetail.astro` L20-25:
   ```
   const badgeClass =
     run.status === 'paused'
       ? 'em-badge em-badge--paused'
       : ended
         ? 'em-badge em-badge--ended'
         : 'em-badge em-badge--running';
   ```
   Or extract to a `runBadgeClass(run)` helper in `utils/library.ts`
   so RunCard + RunDetail share one source of truth (matches the
   `runBadgeText` pattern).

## Test gap

Unit test `runBadgeText(makeRun({ status: 'paused' }))` passed because
the test constructed a `Run` in memory with `status: "paused"` directly,
bypassing the loader entirely.  The live pipeline shape (runs.json row
lagging the manifest) was never exercised end-to-end.  Tier test
`data/__tests__/json-loader-tiers.test.ts:138` uses
`{ run_id: 'r-paused', run_number: 2, status: 'paused', ended_at: null }`
-- status in the runs.json fixture is already `"paused"`, so the loader
never has to pull status from the manifest.  Live HTML diverges because
live `runs.json` status is `"running"` while live manifest status is
`"paused"`.

Live-render invariant test that would have caught it: fixture with
runs.json row `{ status: "running" }` AND manifest `{ status: "paused" }`
for the same run_number, assert `loader.listActiveRuns()[0].status ===
"paused"` AND `runBadgeText(loader.getRun(id)) === "PAUSED"` AND the
derived badge class token resolves to `em-badge--paused`.  This exercises
the runs.json-vs-manifest precedence that the current tests skip.
