---
status: BUILDER_DONE
pi: EMU-3
type: bugfix
file_limit: 0
build_spec: docs/superpowers/plans/2026-04-14-ui-bugs.md
updated_by: wayland
updated_at: 2026-04-14T15:45:00Z
error: null
---

## Instructions

Execute EMU-3 UI bug sweep -- bundles BL-206 (agent search filter) + BL-207 (day prev/next) + BL-209 (json-loader test coverage).

**Plan:** `docs/superpowers/plans/2026-04-14-ui-bugs.md`

Read only above the `<!-- BUILDER READS ABOVE THIS LINE ONLY -->` marker for the Task Index.  Dispatch subagents to Task Details below the marker by task number.

### Goal

Close three isolated emergence-ui defects from the merge code review: decorative search input, broken prev/next on non-contiguous days, thin json-loader test coverage.

### Scope

4 tasks (3 fix + 1 closure).  All changes stay inside `D:/Clanker/emergence-ui/`.  No upstream (PE) changes required.

### Test tier decisions

- T1 (unit) + T2 (component/integration): required per task.
- T3 (contract): not required.
- T4 (smoke): not required.

### Passing floor + failing set (BL-163)

- **Framework:** Vitest (not Jest).
- **Entry capture:** `npm test 2>&1 | tail -5` before Task 1 dispatch.
- **Exit requirement:** passing count holds or improves; failing set must not grow.  If there's a pre-existing failing set, flag it in Results.

### Commit prefix: EMU-3

Match EMU-2 commit style (fb23963).  emergence-ui does NOT use the PE ECHOIT framework line in commits.

### Token reporting

Every subagent returns `Tokens: [actual]` in summary.  Write `docs/emu3-token-report.md` with per-task estimated vs actual.  Total + delta % land in this handoff at BUILDER_DONE.

### Path verification summary (planner recon)

- `components/RunDetail.astro` L82: `<input type="text" placeholder="Search agents..." class="em-search" ...>` -- search target.
- `components/DayDetail.astro` L17-18: arithmetic prev/next.  Gap: skipped days 404.
- `data/json-loader.ts`: 330 lines.  `data/__tests__/json-loader.test.ts`: 36 lines, 1 test.
- Existing components: ActivityFeed, AgentCard, AgentProfile, Attribution, ConversationBlock, DayDetail, Hub, NeedStates, RunCard, RunDetail.
- Check `AgentCard.astro` for the agent-card root class name before wiring the search filter (search script needs it).

### Backlog closure -- planner handles

Builder does **not** touch `D:/Clanker/backlogs/project-emergence.md` (emergence-ui BLs live there per convention).  Builder does **not** create backlog files in emergence-ui repo.  Planner handles BL-206, BL-207, BL-209 status transitions + header counts on receipt of BUILDER_DONE.

### BLOCKED protocol

Set BUILDER_BLOCKED with question + options for:
- `dayList` not easily derivable from existing data layer (architectural question).
- AgentCard class names diverge unexpectedly and fix path unclear.
- Test framework quirks (Vitest jsdom / Astro interop) that block a case.

Small path/name ambiguities: one-line check, proceed.

## Results

**All three tasks DONE.**  No BLOCKED, no deviations from the plan that changed scope.

### Commits (on master, ahead of origin by 4)

- `ab4bc7e` -- EMU-3: client-side filter for agent cast search input (Task 1, BL-206)
- `b058871` -- EMU-3: prev/next from actual day list (Task 2, BL-207)
- `76c4c56` -- EMU-3: expand json-loader test coverage to all exports (Task 3, BL-209)
- (pending) EMU-3: token report + BUILDER_DONE

### Passing floor + exit

- Entry: 3 files / 14 tests passing.
- Exit: 5 files / **59 tests passing**.  Net +45 tests.
- No failing set at entry; none at exit.

### Per-BL summary

| BL | Task | Files touched | Tests added |
|----|------|----|----|
| BL-206 | Agent search filter | `components/RunDetail.astro`, `components/AgentCard.astro`, `utils/agent-search.ts` (new), `components/__tests__/RunDetail-search.test.ts` (new) | 8 |
| BL-207 | DayDetail prev/next | `components/DayDetail.astro`, `utils/day-nav.ts` (new), `utils/__tests__/day-nav.test.ts` (new) | 12 |
| BL-209 | json-loader coverage | `data/__tests__/json-loader.test.ts` (+540 lines), 7 new fixture files under `data/__tests__/fixtures/` | 24 |

### BREAKING CHANGE -- follow-up required for planner to route

**`DayDetail.astro` prop signature changed: `totalDays: number` -> `dayList: number[]`.**

Host-site call sites need a one-line prop update before they can bump this submodule.  The Task 2 subagent initially edited the host sites directly; those edits were reverted to respect builder-isolation (emergence-ui builder does not commit to sibling repos).  Planner should route follow-up build specs to the two host builders:

- **echoit-site** (`D:\Clanker\echoit-site\`) -- `src/pages/emergence/run/[n]/day/[d].astro` getStaticPaths + page template: replace `totalDays: detail.days.length` with `dayList: detail.days.map(d => d.sim_day).sort((a, b) => a - b)`, destructure `dayList` instead of `totalDays`, pass `dayList` to `<DayDetailComponent>`.
- **drewconrad.us** (`D:\Clanker\drewconrad.us\`) -- `src/pages/project-emergence/run/[n]/day/[d].astro`: same pattern.  Single-line change, already vetted by the Task 2 subagent.

### Minor finding -- not fixed per spec

`data/json-loader.ts` `mapRun` uses `??` for `tick_count`, `agent_count`, etc.  If `runs.json` ever explicitly sets those to literal `0`, the outer `||` manifest fallback in `getRun` can't override.  Purely theoretical for realistic data; documented in the coverage tests via field omission rather than `0`.  Log to backlog if it matters.

### Token totals

Detail in `docs/emu3-token-report.md`.  Subagent self-report: ~60,500.  Harness total across all three task subagents: 156,914 tokens / 88 tool uses / 449s.

### Backlog closure (planner)

BL-206, BL-207, BL-209 -- closure gate met.  Planner to transition status + adjust header counts.
