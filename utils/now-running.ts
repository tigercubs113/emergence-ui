// utils/now-running.ts -- Pure helpers for the NowRunning tier (EMU-4 T1).
//
// Kept DOM-free so the component's branching logic can be unit-tested without
// jsdom or an Astro container renderer.  The Astro template in
// NowRunning.astro calls these to pick the active run, format the window
// header, and format the recent-actions feed.
//
// Matches the pattern established by utils/agent-dashboard.ts (T3) and
// utils/agent-search.ts (EMU-3 T1).

import type { DispatchSummary, Run } from '../data/types.js';

// The Hub may pass zero, one, or (edge case) many active runs.  DC-5 expects
// exactly one at a time but we render every active run defensively.  This
// helper lets the template pick a single "featured" run when only one exists
// without making callers do the indexing.
export function pickFeaturedActiveRun(activeRuns: Run[] | null | undefined): Run | null {
  if (!Array.isArray(activeRuns) || activeRuns.length === 0) return null;
  return activeRuns[0];
}

export type NowRunningState =
  | { kind: 'blank' }
  | { kind: 'no-dashboard'; runs: Run[] }
  | { kind: 'dashboard'; runs: Run[]; dashboard: DispatchSummary };

// Single source of truth for which UI branch NowRunning.astro should render.
// Keeps the Astro template readable and the decision unit-testable.
export function deriveNowRunningState(
  activeRuns: Run[] | null | undefined,
  dashboard: DispatchSummary | null | undefined
): NowRunningState {
  const runs = Array.isArray(activeRuns) ? activeRuns : [];
  if (runs.length === 0) return { kind: 'blank' };
  if (!dashboard) return { kind: 'no-dashboard', runs };
  return { kind: 'dashboard', runs, dashboard };
}

// Format the 20-tick window header, e.g. "T140-T160".  The plan spec literally
// says "Last 20 ticks (T{window_start}-T{window_end})" and the template uses
// this helper so the formatting lives somewhere tests can assert against.
export function formatWindowHeader(
  windowStartTick: number,
  windowEndTick: number
): string {
  return `T${windowStartTick}-T${windowEndTick}`;
}

// Format one "recent actions" line.  Shape mirrors the .em-feed-item lines in
// ActivityFeed: `T{tick} {agent_name} {action_type}{:target}`.  Target is
// optional; when null/empty the colon segment is dropped.
export function formatRecentActionLine(entry: {
  agent_name: string;
  tick: number;
  action_type: string;
  target: string | null;
}): string {
  const target = entry.target ? `:${entry.target}` : '';
  return `T${entry.tick} ${entry.agent_name} ${entry.action_type}${target}`;
}

// Normalize the recent actions list: drop entries missing required fields and
// keep input order.  The loader already dedupes per agent, so the component
// just needs to defensively filter malformed rows.
export function normalizeRecentActions(
  actions: DispatchSummary['last_actions'] | null | undefined
): DispatchSummary['last_actions'] {
  if (!Array.isArray(actions)) return [];
  return actions.filter(
    a => a && typeof a.agent_name === 'string' && typeof a.tick === 'number' && typeof a.action_type === 'string'
  );
}
