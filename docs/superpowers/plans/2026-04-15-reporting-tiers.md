# EMU-4: Reporting Tiers + Per-Agent Dashboard

**Sprint bundle:** EMU-4 (single PI)
**Theme:** Implement Now Running and Library tiers of DC-5 editorial pipeline, add per-agent dashboard, render `narrative` in DayDetail, finish BL-228 paused-card styling.
**Scope exclusions:** Showcase tier (Phase 2, pinned `featured.json` not in this PI).  Agent map view (future).  Opus/MJ editorial generation (out of UI lib scope).
**Source:** DC-5 architecture in `D:/Clanker/projects/drewconrad-us.md` L38-107.  Planner audit 2026-04-15 surfaced stubbed tiers, missing per-agent dashboard, narrative not rendered, BL-228 CSS gap.

## Passing floor + failing set (entry)

- **Test framework:** Vitest (not Jest).
- **Passing floor at entry:** 5 files / 59 tests (captured 2026-04-15 via `npx vitest run`).  Do not regress.
- **Failing set:** empty.
- **Exit target:** 6+ files, 70+ tests.  New loader functions and component logic get unit coverage.

## Test tier decisions

- **T1 (unit):** required for Task 5 loader additions (active/ended filters, 20-tick window aggregator).  Also required for any pure derivation helpers extracted during Tasks 1-4.
- **T2 (component):** required for Task 3 AgentDashboard (row rendering) and Task 1 NowRunning (tier composition).  Match `RunDetail-search.test.ts` pattern (render Astro component, query DOM).
- **T3 (contract):** not required.
- **T4 (smoke):** not required -- host-site integration verified downstream in drewconrad.us EMU-4.1 (separate PI).

## Commit convention

`EMU-4: [summary]` short imperative subject.  Every commit message ends with the ECHOIT framework footer from `CLAUDE.md`:

```
Built Using E.C.H.O.I.T framework - Planned by Opus 4.6, Architected by Opus 4.6, Security Audit by Opus 4.6, Code Supervisor Opus 4.6, Code by Opus 4.6, Doc Review by Haiku 4.5
```

## Token reporting

Every subagent returns `Tokens: [actual]`.  Write `docs/emu4-token-report.md` with per-task estimated vs actual.  Keep to the EMU-3 format.

## Parallelism

Tasks 1, 2, 4, 5 are largely independent (different files, different CSS classes).  Task 3 depends on Task 5's per-agent 20-tick getter landing first.  Recommended: run T5 first, then T1/T2/T3/T4 in parallel subagents.

---

## Task Index

| # | Task | Files | AC summary |
|---|------|-------|-----------|
| 1 | NowRunning tier component + 20-tick dispatch summary | `components/NowRunning.astro` (new), `components/Hub.astro` (wire) | Filters runs where `ended_at IS NULL`; renders above Library; embeds 20-tick dispatch card (conversation count + action count + last-action-per-agent); blank state when no active run |
| 2 | Library tier component | `components/Library.astro` (new), `components/Hub.astro` (wire) | Filters runs where `ended_at IS NOT NULL`; reuses existing `RunCard` grid; Hub orchestrates Showcase(stub) + NowRunning + Library |
| 3 | AgentDashboard per-agent row grid | `components/AgentDashboard.astro` (new), embedded in NowRunning | One row per agent: name, hunger, thirst, rest, location (x,y), latest_action; reads from new loader getter; renders blank state if no agent data |
| 4 | DayDetail narrative + paused styling (BL-228) | `components/DayDetail.astro`, `styles/emergence.css` | Narrative section above ActivityFeed when `day.narrative` present; `.em-badge--paused` already styled (verify) + new `.em-card--paused` border/badge treatment for paused RunCards |
| 5 | Loader additions + tests | `data/json-loader.ts`, `data/loader.ts`, `data/__tests__/json-loader.test.ts`, new fixtures | Three new DataLoader methods: `listActiveRuns()`, `listEndedRuns()`, `getActiveRunDashboard(runId)`.  Unit tests cover active/ended filter + latest-20-tick window aggregation.  Fixtures include one active (ended_at=null) and one ended (ended_at=ISO) run |

<!-- BUILDER READS ABOVE THIS LINE ONLY -->

---

## Task Details

### Task 5 -- Loader additions + tests (RUN FIRST)

**Why first:** Tasks 1 and 3 depend on new getters.  Land loader + tests before UI.

**File edits:**

1. `data/types.ts` -- extend `Run` with optional `ended_at: string | null` (ISO timestamp, null for active).  Update fixtures accordingly.  If Supabase migration adds the column, this matches (BL-127 / PIP-56 surfaces it in runs.json export).  Keep field optional so legacy fixtures don't break.

2. `data/types.ts` -- add new interface:

```ts
export interface DispatchSummary {
  run_id: string;
  run_number: number;
  window_start_tick: number;
  window_end_tick: number;
  conversation_count: number;
  action_count: number;
  last_actions: { agent_name: string; tick: number; action_type: string; target: string | null }[];
  agent_dashboard: AgentDashboardRow[];
}

export interface AgentDashboardRow {
  agent_name: string;
  hunger: number;
  thirst: number;
  rest: number;
  location: { x: number; y: number } | null;
  latest_action: { tick: number; action_type: string; target: string | null } | null;
}
```

3. `data/loader.ts` -- add three methods to the `DataLoader` interface:

```ts
listActiveRuns(): Promise<Run[]>;       // ended_at IS NULL
listEndedRuns(): Promise<Run[]>;        // ended_at IS NOT NULL
getActiveRunDashboard(runId: string): Promise<DispatchSummary | null>;
```

4. `data/json-loader.ts` -- implement the three methods:
   - `listActiveRuns`: `listRuns()` filtered where `ended_at == null`.  A run is active only if `ended_at` is explicitly null/undefined.
   - `listEndedRuns`: `listRuns()` filtered where `ended_at` is a non-empty string.
   - `getActiveRunDashboard(runId)`: find the run's day shards, pick shards with the highest `tick_range[1]` values spanning the most recent 20 ticks, aggregate:
     - `window_start_tick` = max(0, highest_tick - 20)
     - `window_end_tick` = highest_tick
     - `conversation_count` = sum of shard.conversations in window
     - `action_count` = sum of shard.actions_summary[*].actions in window
     - `last_actions` = per-agent latest action in window (dedupe by agent_name)
     - `agent_dashboard` = per-agent current state from the latest shard's `agent_states` (needs.hunger, needs.thirst, needs.rest; location from `agent_states[*].location` if present, null otherwise; latest_action matches `last_actions` lookup)
   - Return null if run has no shards yet.

5. Map `ended_at` through `mapRun` in json-loader.

**Tests (T1):**

File: extend `data/__tests__/json-loader.test.ts` or create `data/__tests__/json-loader-tiers.test.ts`.

- `listActiveRuns` returns only runs with `ended_at == null`.
- `listEndedRuns` returns only runs with `ended_at` set.
- `listActiveRuns` on empty runs array returns empty array.
- `getActiveRunDashboard` happy path: run with 2 shards, last 20 ticks aggregated correctly (conversation_count, action_count match fixture).
- `getActiveRunDashboard` per-agent dashboard has one row per agent in final shard's `agent_states`.
- `getActiveRunDashboard` returns null for a run with no shards.
- `getActiveRunDashboard` respects 20-tick window boundary: actions older than window are excluded from `last_actions`.

**Fixtures:** add `data/__tests__/fixtures/run-3-active-manifest.json` and `run-3-active-day-0.json` with `ended_at: null` and realistic agent_states.  Update `runs.json` fixture to include one active + one ended.

**Deviation gate:** if shards don't expose `agent_states` with `location`, render location as `null` and don't block.  Location is nice-to-have, coords only -- no map.

---

### Task 1 -- NowRunning tier component

**File:** `components/NowRunning.astro` (new).

**Props:**

```ts
interface Props {
  activeRuns: Run[];
  dashboard: DispatchSummary | null;  // null when no active run
  basePath: string;
}
```

**Render:**

1. If `activeRuns.length === 0`: render blank state card "No active run.  Drew is between simulations."  (Per DC-5: blank state acceptable.)

2. Otherwise for the single active run (expect exactly one per DC-5 run lifecycle; if multiple, render each):
   - Section header `em-h2` "Now Running"
   - Featured `RunCard` for the active run (reuse existing RunCard, not a new card).
   - 20-tick dispatch summary card (subsection):
     - Header: "Last 20 ticks (T{window_start}-T{window_end})"
     - Two stat boxes: conversation_count, action_count (use `.em-stat`)
     - "Recent actions" list: `last_actions` -- one line per agent `T{tick} {agent_name} {action_type}{:target}` (reuse `.em-feed-item` classes)
   - Embed `<AgentDashboard rows={dashboard.agent_dashboard} />` below the dispatch summary.

3. If `dashboard` is null but `activeRuns` has entries: render the RunCard only and a muted "Dashboard data not yet available" line.

**Styling:** reuse existing `em-card`, `em-stat`, `em-feed-item`.  No new CSS tokens needed.

**Hub.astro wire:** (see Task 2 for full Hub composition)

**Tests (T2):** `components/__tests__/NowRunning.test.ts`
- Renders blank state when activeRuns empty.
- Renders dispatch summary header with window range when dashboard provided.
- Embeds AgentDashboard rows (assert row count matches dashboard.agent_dashboard.length).

---

### Task 2 -- Library tier component

**File:** `components/Library.astro` (new).

**Props:**

```ts
interface Props {
  endedRuns: Run[];
  basePath: string;
}
```

**Render:**

1. Section header `em-h2` "Library".
2. Subtitle: count `"{n} ended runs"` using `em-subtitle`.
3. If empty: "No ended runs yet."
4. Otherwise: map `endedRuns` to `<RunCard run={r} basePath={basePath} />`.

**Hub.astro changes:**

- Hub becomes the tier orchestrator.  New props:

```ts
interface Props {
  activeRuns: Run[];
  endedRuns: Run[];
  dashboard: DispatchSummary | null;
  basePath: string;
}
```

- Body order:
  1. Hero + Attribution + "What we changed" panels (preserve).
  2. `<!-- Showcase: Phase 2 stub -->` HTML comment + TODO marker for future `featured.json`.  No component rendered.
  3. `<NowRunning activeRuns={activeRuns} dashboard={dashboard} basePath={basePath} />`
  4. `<Library endedRuns={endedRuns} basePath={basePath} />`
- Remove the existing flat `runs.map(run => <RunCard .../>)` loop from Hub.
- Consuming sites (drewconrad.us and echoit-site) must call `loader.listActiveRuns()`, `loader.listEndedRuns()`, `loader.getActiveRunDashboard(activeRunId)` and pass to Hub.  Update host-site integration is OUT OF SCOPE for this PI -- host sites still pass `runs` array currently.  **Keep `runs` prop as optional fallback** so existing host pages don't break:

```ts
interface Props {
  runs?: Run[];                      // legacy fallback
  activeRuns?: Run[];
  endedRuns?: Run[];
  dashboard?: DispatchSummary | null;
  basePath: string;
}
```

If `activeRuns`/`endedRuns` are undefined and `runs` is passed, fall back to rendering the old flat list under Library (preserves current site behavior until drewconrad.us ships the follow-up PI).

**Tests (T2):** `components/__tests__/Library.test.ts`
- Renders empty state when endedRuns empty.
- Renders one RunCard per ended run.
- Hub renders NowRunning + Library when new props passed.
- Hub falls back to flat render when only `runs` is passed (legacy path).

---

### Task 3 -- AgentDashboard component

**File:** `components/AgentDashboard.astro` (new).

**Props:**

```ts
interface Props {
  rows: AgentDashboardRow[];
}
```

**Render:**

A table-like grid.  Columns: Agent | Hunger | Thirst | Rest | Location | Latest Action.

Use a CSS grid, not a `<table>` (matches existing `em-grid-*` conventions).  Add a new class `em-dashboard-grid` with 6 columns; fall back to stacked rows at mobile breakpoint (matches existing `@media (max-width: 768px)` pattern).

Each row:
- Agent: `.em-h3` name.
- Hunger/Thirst/Rest: value as `avg {value}/{max}` using `formatNeedValue` from `utils/format.ts` (max assumed 5 per existing NeedStates convention).  Color tint when value <= 1 (use `var(--em-danger)`).
- Location: `(x, y)` coords or `--` when null.
- Latest Action: `T{tick} {action_type}{:target}` or `--` when null.

Blank state: "No agent data available yet."

**Embed:** inside `NowRunning.astro` below the dispatch summary.

**Tests (T2):** `components/__tests__/AgentDashboard.test.ts`
- Renders one row per input row.
- Renders `--` for null location / null latest_action.
- Applies danger color class when a need value <= 1 (assert style or class).

**CSS additions** (`styles/emergence.css`):

```css
.em-dashboard-grid {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1fr 1.5fr 2fr;
  gap: 8px 12px;
  font-size: 13px;
}
.em-dashboard-grid__header {
  color: var(--em-text-dim);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 1px;
}
.em-dashboard-grid__critical { color: var(--em-danger); }
@media (max-width: 768px) {
  .em-dashboard-grid { grid-template-columns: 1fr 1fr; }
}
```

---

### Task 4 -- DayDetail narrative + paused card styling (BL-228)

**File A:** `components/DayDetail.astro`.

Insert a new section between the day header and Activity Feed, gated on `day.narrative` being truthy:

```astro
{day.narrative && (
  <section class="em-section">
    <div class="em-h2">Narrative</div>
    <div class="em-subtitle" style="line-height: 1.7;">{day.narrative}</div>
  </section>
)}
```

Note: `DayDetail` currently reads from `DayDetailType` which does NOT have `narrative` (only `DaySummary` does).  Extend `DayDetail` type in `data/types.ts` with optional `narrative: string | null`.  Update `json-loader.getDay()` to merge narrative across shards (first non-null wins, matching the getRun dayMap pattern).

**File B:** `styles/emergence.css`.

Current `.em-badge--paused` exists (L53).  Add a complementary card-level treatment for paused runs:

```css
.em-card--paused {
  border-color: #c8b450;
  border-left-width: 3px;
}
```

Update `RunCard.astro` to apply `em-card em-card--paused` when `run.status === 'paused'`:

```astro
const cardClass = run.status === 'paused' ? 'em-card em-card--paused' : 'em-card';
```

**Tests (T2):** extend existing `components/__tests__/` with
- `DayDetail` renders narrative section when provided, hides when null.
- `RunCard` applies `em-card--paused` class when status is paused.

---

## BLOCKED protocol

Set `status: BUILDER_BLOCKED` for:
- `ended_at` column not present in any runs.json fixture and PIP-56 BL-127 hasn't landed -- builder cannot verify Task 5 end-to-end.  **Mitigation first:** code against the filter anyway, add fixtures with manual `ended_at` values, note the coupling in exit report.  Block only if filter design itself is ambiguous.
- `agent_states` shard shape doesn't include needs in the hunger/thirst/rest format expected -- surface the actual shape and request dashboard-row mapping decision.
- AgentDashboard location data is structurally different from `{x, y}` -- request format clarification before rendering.

Small naming/path ambiguities: resolve via one-line investigation, proceed.

## Verification checklist (before BUILDER_DONE)

- [ ] `npx vitest run` passes 6+ files / 70+ tests (no regression below 59).
- [ ] All 5 tasks committed with `EMU-4:` prefix and ECHOIT footer.
- [ ] `docs/emu4-token-report.md` written.
- [ ] Hub legacy `runs` prop fallback still renders (Hub.test or manual visual check).
- [ ] New fixtures include both active and ended runs.
- [ ] No changes to `D:/Clanker/` outside `emergence-ui/`.
