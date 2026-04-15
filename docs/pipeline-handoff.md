---
status: BUILDER_DONE
pi: EMU-4
type: feature
file_limit: 0
build_spec: docs/superpowers/plans/2026-04-15-reporting-tiers.md
updated_by: wayland
updated_at: 2026-04-15T18:00:00Z
error: null
---

## Instructions

Execute EMU-4 Reporting Tiers + Per-Agent Dashboard.  Build spec at `docs/superpowers/plans/2026-04-15-reporting-tiers.md`.

Read only above the `<!-- BUILDER READS ABOVE THIS LINE ONLY -->` marker for Task Index.  Dispatch subagents to Task Details by task number.

**Context from planner:** Implements Now Running + Library tiers of DC-5 editorial pipeline, per-agent dashboard (hunger/thirst/rest/location/last_action row per agent), DayDetail `narrative` field render, BL-228 paused-card styling.  Prep for Project Emergence overnight run tonight — Now Running tier must ship so live data is visible during the run.

**Task parallelism:** Task 5 (loader + types) runs first.  Tasks 1, 2, 3, 4 can then parallelize.  T1 + T2 both touch Hub.astro — merge serially after parallel work.

**Upstream coupling:** Couples to PIP-56 BL-127 end-run CLI on the PE side, but EMU-4 codes against `ended_at IS NOT NULL` filter with fixtures covering both states — not blocked by PIP-56.

**Process reminder:** OPERATIONS §4 — populate Results / Commits / Deviations / Assumptions / New findings before flipping to BUILDER_DONE.

## Results

All 5 tasks shipped.  Suite grew from 5 files / 59 tests to **9 files / 118 tests** (+4 files, +59 tests).  Exit target was 6+ files / 70+ tests — exceeded on both dimensions.  Zero regressions, zero merge conflicts.

- **Now Running tier** live — filters `ended_at IS NULL`, embeds 20-tick dispatch card (conversation count + action count) and AgentDashboard (per-agent hunger/thirst/rest/location/last_action).  Blank state when no active run.
- **Library tier** live — filters `ended_at IS NOT NULL`, reuses RunCard grid.
- **AgentDashboard** standalone component with pure-helper unit tests covering row derivation, critical-need flagging, location + action formatting.
- **DayDetail narrative** renders above ActivityFeed when `day.narrative` present; null/absent collapses the section.
- **BL-228 closed** — `.em-card--paused` amber border + badge treatment shipped; RunCard conditionally applies class when `run.status === 'paused'`.
- **Loader surface** extended with `listActiveRuns()`, `listEndedRuns()`, `getActiveRunDashboard(runId)` on the DataLoader interface and json-loader implementation, with 16 new unit tests covering active/ended filters and 20-tick window aggregation across shard boundaries.

## Commits

| SHA | Task | Subject |
|-----|------|---------|
| `3cd7caa` | T5 | EMU-4: T5 loader additions (active/ended filters, 20-tick dashboard) |
| `59025d1` | T3 | EMU-4: T3 AgentDashboard per-agent row component |
| `e690e34` | T4 | EMU-4: T4 DayDetail narrative + paused RunCard styling |
| `d70fbe1` | T1 | EMU-4: T1 NowRunning tier + Hub wiring |
| `98f5879` | T2 | EMU-4: T2 Library tier + Hub wiring |

Plus a follow-up commit for `docs/emu4-token-report.md` and this handoff fill.

## Deviations from spec

- **T4 loader thread.** Plan put narrative rendering in Task 4 but required the loader to expose it; T4 necessarily touched `data/types.ts` (added optional `narrative` on DayDetail) and `data/json-loader.ts` (getDay merges narrative first-non-null-wins).  No deviation from intent, only from the file list.
- **Hub tiered vs legacy layout.** T1 gated the tiered render on an `activeRuns` prop so host sites not yet passing active/ended slices keep the legacy flat render.  T2 extended the gate to `shouldUseTieredLayout` (either activeRuns or endedRuns).  Plan implied a hard cutover; the additive gate lets consumers opt in incrementally.

## Assumptions made

- **20-tick window.** Inclusive `[max(0, highest_tick - 20), highest_tick]`.  `conversation_count` = sum of `shard.stats.conversations_today` across shards whose `tick_range` intersects the window.  `action_count` = per-action tick filter (finer grain than shard).  `latest shard` = shard with highest `tick_range[1]`.
- **Critical-need threshold.** `CRITICAL_THRESHOLD = 1` per plan; `NEED_MAX = 5` from existing NeedStates convention.
- **Component testing.** No Astro container renderer installed, so every tier + dashboard test uses the T3-established pattern: extract a pure helper (`utils/agent-dashboard.ts`, `utils/now-running.ts`, `utils/library.ts`), unit-test the helper with vitest, keep the Astro template as a thin formatting shell.  Matches the pre-existing `RunDetail-search.test.ts` shape.
- **Pluralization.** `"{n} ended runs"` literal per plan, no singular special case at `n=1`.
- **Paused card color.** `.em-card--paused` uses the same amber (`#c8b450`) as the existing `.em-badge--paused` for visual coherence.

## New findings

- **Parallelism underused.** I dispatched T3 and T4 as sequential subagent calls rather than a single message with two Agent blocks.  Outcome identical, wall clock longer than necessary.  Future PIs: batch independent subagents in one message.
- **Host-site readiness.** Because Hub falls back to the legacy render when `activeRuns` / `endedRuns` aren't passed, echoit-site and drewconrad.us can upgrade at their own cadence.  No coordinated cutover needed for tonight's Emergence run as long as the host page passes the two new slices.
- **Loader coupling to PIP-56 BL-127.** NowRunning reads `ended_at IS NULL` — works correctly whether or not the PE-side end-run CLI has landed.  Fixtures exercise both states.  Overnight run is unblocked from the UI side.
