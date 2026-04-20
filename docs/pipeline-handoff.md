---
status: BUILDER_DONE
pi: EMU-12
type: integration
file_limit: 0
build_spec: docs/emu12-build-spec.md
updated_by: builder
updated_at: 2026-04-20T21:55:00Z
error: null
---

## BUILDER_DONE -- EMU-12

Final master SHA: pending (this commit).  Will be recorded after push.
Commits on master:
- `407bdfa` EMU-12: BL-007 remediation rebased onto EMU-11
- `9ecec23` EMU-12 T4: runBadgeText three-way for paused coexistence
- (this commit) EMU-12: token report + BUILDER_DONE

### Conflict resolution

`data/json-loader.ts` conflicted in one hunk (the helper definition region
at the top of `createJsonLoader`).  Both sides were orthogonal in intent
and preserved verbatim: EMU-11's `normalizeModelConfig` helper kept,
followed by EMU-5's `warnedOrphans` Set + `findManifest` + `mapRunWithManifest`.
`mapRun` continues to call `normalizeModelConfig(raw.model_config)` -- EMU-11
string tolerance preserved.  `listRuns` uses `mapRunWithManifest` with
orphan filter + once-per-run dedup warn -- EMU-5 semantics preserved.  No
semantic tradeoff surfaced.

EMU-5's second commit (`da6dbeb`, handoff IDLE marker) was skipped during
rebase (conflicted on pipeline-handoff.md; superseded by this BUILDER_DONE).

### Test count

Before rebase (preserve branch): 141 passing, 0 failing.
After EMU-12 T4 paused coexistence: 144 passing, 0 failing (+3 PAUSED cases).

### Deviations

- T3 renumber: preserve branch had two commits; the handoff-close commit
  was dropped via `git rebase --skip` since it was a marker-only commit
  that would be superseded by BUILDER_DONE anyway.  Substantive commit
  (cfd36c5) was reworded to EMU-12 via `git commit --amend`; the T4
  paused work landed as a separate EMU-12 commit.  Net: two EMU-12
  commits on master instead of one squashed commit -- preserves clear
  separation between rebased-from-EMU-5 work and new-for-EMU-12 T4 work.
- No other deviations.

### Token total

~12k actual vs 15k estimated.  Breakdown in `docs/emu12-token-report.md`.

## EMU-12: BL-230 integration -- rebase emu5-bl007-preserve onto master

### Scope

Integration-only PI.  No new features.  Six tasks:

1. **T1:** Fetch + inspect.  `git log origin/master..emu5-bl007-preserve` + the json-loader conflict diff.
2. **T2:** Rebase `emu5-bl007-preserve` onto `origin/master`.  Resolve `data/json-loader.ts` conflict combining EMU-11's string-model_config tolerance with EMU-5's mapRunWithManifest + orphan filter + dedup warn.
3. **T3:** Renumber commit messages from "EMU-5: ..." > "EMU-12: ...".  Preserve ECHOIT trailer.
4. **T4:** Extend `runBadgeText` to three-way (ENDED / PAUSED / RUNNING) so EMU-10's paused-status handling coexists with our tier/badge reconciliation.
5. **T5:** Full vitest suite: >= 141 passing, 0 failing.
6. **T6:** Fast-forward push to master.  Delete preservation branch from origin + local.

### Spec

`docs/emu12-build-spec.md` -- two-tier format.

### Estimated budget

~15k tokens.  Per-task: T1 2k / T2 5k / T3 2k / T4 2k / T5 3k / T6 1k.

### Passing floor + failing set

- Passing floor: vitest suite >= 141 passing, 0 failing.  Fast-forward push succeeds.  Preservation branch deleted cleanly.
- Failing set: none.

### Planner notes

- Drew explicitly approved option (a) autonomous rebase.  Proceed without further confirmation.
- Conflict semantics expected to be orthogonal: EMU-11 touches model_config field normalization, EMU-5 touches manifest merge + orphan filter.  If they're actually colliding in the same function, BUILDER_BLOCKED with the tradeoff surfaced.
- T4 is load-bearing.  EMU-10's paused state needs a proper slot in the three-way badge logic.  Our original EMU-5 spec skipped paused for "product direction required" reasons; but since EMU-10 already shipped paused handling, inheriting that shape is the correct move.
- Freshness predicate (DC-14 option 5) still out of scope.  Drew has the 4 open product questions on his desk separately.

### Next gate

Builder reports BUILDER_DONE with final master SHA.  Planner writes DC-16 (drewconrad.us submodule bump) + ES-21 (echoit-site submodule bump) to propagate the fix to live sites.
