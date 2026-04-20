# EMU-12 -- BL-230 integration: rebase emu5-bl007-preserve + resolve json-loader conflict

**Type:** rebase + conflict resolution + renumber
**Files under edit:** rebase of branch `emu5-bl007-preserve` onto current origin/master.  Primary conflict in `data/json-loader.ts`.  Commit messages renumbered from "EMU-5" > "EMU-12".
**Estimated tokens:** ~15k
**Passing floor:** vitest suite passes, count >= 141 (EMU-5-preserve baseline) + whatever EMU-11 added (if any).  Zero failing tests.
**Failing set:** none.

## Background

On 2026-04-20 planner dispatched an "EMU-5" PI for BL-007 remediation without realizing:
1. Local emergence-ui master was stale at `86c263c` (EMU-4 plan catch-up, 2026-04-15).
2. Origin master had advanced to `77d9b34` (EMU-11: json-loader tolerates string model_config).
3. The label "EMU-5" was already used by `a1858ab EMU-5: feat: Hub, Attribution, and RunCard components` (first-generation numbering).

Builder shipped `cfd36c5` + close `da6dbeb` against the stale base.  Merge to origin blocked by content conflict in `data/json-loader.ts`.  Planner preserved the work on branch `emu5-bl007-preserve` (pushed to origin), hard-reset master, filed this integration PI.

Current origin/master: `f4da508` (EMU-11 + planner preservation note).
Preserve branch: `emu5-bl007-preserve` @ `da6dbeb` (contains `cfd36c5` EMU-5 work + close commit).

## Task Index

| ID | Task | Est |
|---|---|---|
| T1 | Fetch + inspect.  `git fetch origin`, `git log origin/master..emu5-bl007-preserve`, `git diff origin/master emu5-bl007-preserve -- data/json-loader.ts` to understand conflict shape | 2k |
| T2 | Rebase branch onto origin/master.  Resolve `data/json-loader.ts` conflict by combining EMU-11's string-model_config tolerance with EMU-5's mapRunWithManifest + orphan filter + dedup warn | 5k |
| T3 | Renumber commits.  Rewrite messages on the rebased commits: "EMU-5: ..." > "EMU-12: ..." | 2k |
| T4 | Verify paused-status coexistence with EMU-10.  EMU-10 added 'paused' to normalizeStatus + Run type + badge CSS.  Our tier/badge reconciliation (isEndedRun-based badge derivation) must not clobber paused badge styling | 2k |
| T5 | Run full vitest suite.  Floor 141 (our baseline on branch) + any EMU-11 net-additions.  Zero failing.  Fix any tests broken by the rebase (fixture drift, import changes) | 3k |
| T6 | Fast-forward push to origin master.  Delete preservation branch once merge is clean | 1k |

## Acceptance

- T1: conflict diff captured in a scratchpad or comment.  You can describe the two sides' intents in 2-3 sentences each before attempting resolution.
- T2: `git rebase origin/master` completes with the json-loader conflict resolved.  Both EMU-11's and EMU-5's semantics preserved.  Specifically: the loader still tolerates string `model_config` fields AND still does `mapRunWithManifest` + orphan filter + dedup warn.  No silent dropping of either side's functionality.
- T3: all commit messages on the new linear history reference EMU-12 (not EMU-5).  Co-author trailer preserved.  If the old `EMU-5` commits combined multiple tasks into one message, the renumbered message should match.
- T4: vitest suite exercises paused-status scenarios and shows paused badge/card still renders correctly.  If no existing test covers "paused run, Library tier" add one -- it's the open question that motivated the reconciliation concern.
- T5: `npx vitest run` exits 0.  Test count >= 141.  Zero failing.
- T6: `git push origin master` succeeds.  Preservation branch deleted from origin (`git push origin --delete emu5-bl007-preserve`) AND local.

## Scope discipline

- Do NOT add new features.  This is integration-only.
- Do NOT touch files outside the rebase conflict set and incidental test fixture updates.
- Do NOT force-push master.  Fast-forward only.  If rebase produces a non-linear result, stop and set BUILDER_BLOCKED.
- If the json-loader conflict has a non-trivial semantic tradeoff (e.g., the two sides legitimately disagree on data shape), set BUILDER_BLOCKED with the tradeoff laid out.  Planner / Drew resolves.
- Freshness predicate + paused-tier-membership product direction is OUT of scope for this PI.  That's a separate product-decision PI after Drew answers the open questions.

## Token Reporting Protocol

Standard.  Builder writes `docs/emu12-token-report.md` before BUILDER_DONE.  Handoff includes total + delta %.

<!-- BUILDER READS ABOVE THIS LINE ONLY -->

## Task Details

### T1 -- Fetch + inspect

```bash
git fetch origin
git log --oneline origin/master..emu5-bl007-preserve
git log --oneline emu5-bl007-preserve..origin/master
git diff origin/master emu5-bl007-preserve -- data/json-loader.ts
```

Expected:
- Branch-ahead commits: `cfd36c5` (EMU-5 source + tests) and `da6dbeb` (EMU-5 close).  The close commit touches only handoff; not source.
- Master-ahead commits (not on branch): `77d9b34` EMU-11 (json-loader string model_config) and `f4da508` (preservation note).
- Conflict in `data/json-loader.ts`: EMU-5 added `mapRunWithManifest` helper + orphan filter (`listRuns` filters entries with no matching manifest + `console.warn` dedup).  EMU-11 added tolerance for `model_config` field being a string instead of object.

Deliverable: 2-3 sentence summary of each side's intent, pasted into the BUILDER_DONE report for planner review.

### T2 -- Rebase + resolve

```bash
git checkout emu5-bl007-preserve
git rebase origin/master
```

When conflict surfaces in `data/json-loader.ts`:

1. Read the three-way conflict markers.
2. Identify the two regions of change.  Expected: they're in DIFFERENT functions (string model_config = probably inside the mapping/normalize step for a single run; mapRunWithManifest = around the loader method level).  If they're in the same function, the resolution is more involved.
3. Manual resolution combining both: keep EMU-11's string-tolerance check AND EMU-5's mapRunWithManifest / orphan filter / dedup warn.
4. Stage resolved file: `git add data/json-loader.ts`.
5. Continue rebase: `git rebase --continue`.
6. If a second conflict surfaces (e.g., in tests), same approach: combine intents.

**Safety check:** after rebase, `npx vitest run -- data/__tests__/json-loader.test.ts` (focused).  Any test failure indicates a semantic regression in the resolution.  Fix before moving to T3.

### T3 -- Renumber

After clean rebase:

```bash
git rebase -i origin/master
# Mark both commits as 'reword'
# Edit messages:
#   cfd36c5 "EMU-5: BL-007 remediation -- stat-block binding, tier/badge, orphan filter + tests"
#   > "EMU-12: BL-007 remediation -- stat-block binding, tier/badge, orphan filter + tests"
#   da6dbeb "EMU-5: close PI -- handoff IDLE"
#   > "EMU-12: close PI -- handoff IDLE + integration rebase from emu5-bl007-preserve"
```

Note: `-i` is forbidden by tool constraints.  Use `git rebase --exec` or `git filter-branch` or simply amend each commit individually via checkout + amend.  Suggested non-interactive approach:

```bash
# After rebase, do a cherry-pick-like rewrite:
git reset --soft HEAD~2
git commit -m "EMU-12: ..." --reuse-message=<old-SHA1>  # adjust for each
# (exact commands: subagent figures out cleanest approach)
```

The handoff file content itself (`docs/pipeline-handoff.md`) will need an update for the EMU-12 close note.  Apply as part of the same close commit.

Preserve the full ECHOIT trailer per repo convention.

### T4 -- EMU-10 paused coexistence check

EMU-10 commit (`8edbdfa`) added `'paused'` to:
- `normalizeStatus` in `data/json-loader.ts` (or wherever it lives)
- `Run.status` type union in `data/types.ts`
- `em-badge--paused` CSS rule

Our tier/badge reconciliation (new `runBadgeText` helper that derives from `isEndedRun`) currently returns binary ENDED / RUNNING.  Check:

1. If `isEndedRun(pausedRun)` returns `false` (paused is not terminal), badge reads "RUNNING" -- wrong.
2. If it returns `true`, badge reads "ENDED" -- also wrong.

Paused is a third state.  EMU-10 intended the badge to say "PAUSED".  Our EMU-5/EMU-12 reconciliation must handle this.

**Resolution:** extend `runBadgeText` to three-way:

```ts
function runBadgeText(run: Run): "ENDED" | "RUNNING" | "PAUSED" {
  if (isEndedRun(run)) return "ENDED";
  if (run.status === "paused") return "PAUSED";
  return "RUNNING";
}
```

Verify `em-badge--paused` + `em-card--paused` CSS classes still apply via existing RunCard conditional (EMU-4 left that wiring in place).  Tests should cover: ended run > ENDED, paused run > PAUSED, running run > RUNNING.

### T5 -- Suite verification

```bash
npx vitest run
```

Expected: >= 141 passing, 0 failing.  If EMU-11 added tests (check origin/master commit diff), baseline may be higher.

If any test failure:
- Fixture drift: update fixtures to match current data schema.
- Import path changes: update imports.
- Semantic regression: roll back to T2 resolution, reconsider.

### T6 -- Push + cleanup

After all tests green:

```bash
git checkout master
git merge --ff-only emu5-bl007-preserve   # fast-forward only, no merge commit
git push origin master
git push origin --delete emu5-bl007-preserve
git branch -D emu5-bl007-preserve
```

If fast-forward fails (divergence re-emerged mid-PI), STOP and set BUILDER_BLOCKED.

Capture final master SHA in BUILDER_DONE.  Planner will use it for consumer-site submodule bumps (drewconrad.us DC-16 + echoit-site future PI).

## Reference

- Preserve branch: `emu5-bl007-preserve` on origin.
- Integration backlog item: `D:\Clanker\backlogs\emergence-ui.md` BL-230.
- DC-14 findings for semantic context: `D:\Clanker\drewconrad.us\docs\dc14-findings.md` (commit `b08e78c` on drewconrad.us master).
- Original EMU-5 build spec: `docs/emu5-build-spec.md` (preserved, don't delete -- historical reference).
