// utils/library.ts -- Pure helpers for the Library tier component (EMU-4 T2).
//
// Kept DOM-free so the component's branching logic can be unit-tested without
// jsdom or an Astro container renderer.  The Astro template in Library.astro
// calls these to pick the state, format the subtitle, and normalize the run
// list.
//
// Convention matches utils/now-running.ts (T1) and utils/agent-dashboard.ts (T3).

import type { Run } from '../data/types.js';

// Single source of truth for run lifecycle classification (EMU-5 T2).
// A run is "ended" when runs.json (or the upstream source) has written a
// non-empty ISO string into ended_at.  null/undefined/empty string all mean
// the run is still active.  Both the Library tier filter and RunCard's status
// badge derive from this predicate so the two UI surfaces cannot disagree
// (DC-14 RC4: raw status=="running" while ended_at was a string -> badge
// contradicted tier).
export function isEndedRun(run: Pick<Run, 'ended_at'>): boolean {
  return typeof run.ended_at === 'string' && run.ended_at.length > 0;
}

// Badge text derived from the same tier predicate (EMU-5 T2 + EMU-12 paused
// coexistence).  Extracted so RunCard.astro's badge binding is testable
// without an Astro container renderer.  Three-way classification: PAUSED
// short-circuits on raw status (EMU-10 added 'paused' to normalizeStatus),
// then the tier predicate picks ENDED vs RUNNING.  Paused is orthogonal to
// tier membership -- a paused run is still "active" from Library's POV but
// the badge must reflect the operator-visible pause.
export function runBadgeText(
  run: Pick<Run, 'ended_at' | 'status'>
): 'PAUSED' | 'ENDED' | 'RUNNING' {
  if (run.status === 'paused') return 'PAUSED';
  return isEndedRun(run) ? 'ENDED' : 'RUNNING';
}

export type LibraryState =
  | { kind: 'empty' }
  | { kind: 'list'; runs: Run[] };

// Single source of truth for which UI branch Library.astro should render.
// Empty state when the loader returns zero ended runs; otherwise the list.
// null/undefined input is treated as an empty list (defensive against bad
// upstream data / legacy callers).
export function deriveLibraryState(
  endedRuns: Run[] | null | undefined
): LibraryState {
  const runs = Array.isArray(endedRuns) ? endedRuns : [];
  if (runs.length === 0) return { kind: 'empty' };
  return { kind: 'list', runs };
}

// Format the subtitle below the "Library" header.  Spec says "{n} ended runs"
// with no special-casing for 0/1, matching the flat listing convention used
// elsewhere in the library.  The component uses this helper so the exact
// string lives somewhere tests can assert against.
export function formatLibrarySubtitle(count: number): string {
  const n = typeof count === 'number' && count >= 0 ? Math.floor(count) : 0;
  return `${n} ended runs`;
}

// Hub-side decision: when `activeRuns`/`endedRuns` are undefined but the
// legacy `runs` prop is passed, the Hub falls back to the pre-EMU-4 flat
// render path.  Extracted here so the Hub template's condition is readable
// and tested.  Returns true when Hub should use the tiered path.
export function shouldUseTieredLayout(
  activeRuns: Run[] | null | undefined,
  endedRuns: Run[] | null | undefined
): boolean {
  return Array.isArray(activeRuns) || Array.isArray(endedRuns);
}
