// utils/library.ts -- Pure helpers for the Library tier component (EMU-4 T2).
//
// Kept DOM-free so the component's branching logic can be unit-tested without
// jsdom or an Astro container renderer.  The Astro template in Library.astro
// calls these to pick the state, format the subtitle, and normalize the run
// list.
//
// Convention matches utils/now-running.ts (T1) and utils/agent-dashboard.ts (T3).

import type { Run } from '../data/types.js';

// Single source of truth for run lifecycle classification (EMU-13 T1, BL-231).
// Classification is status-based, NOT timestamp-based: the pipeline writes
// ended_at on ANY non-running transition (pause, TPK, error), so ended_at
// presence cannot indicate termination.  A run is "ended" IFF its status is
// one of the terminal statuses below.  Paused + running remain in the active
// tier.  Both the Library tier filter and RunCard's status badge derive from
// this predicate so the two UI surfaces cannot disagree (DC-14 RC4 history:
// prior ended_at-based predicate misclassified paused runs as ended).
const TERMINAL_STATUSES: ReadonlySet<Run['status']> = new Set([
  'ended',
  'completed',
  'aborted',
  'crashed',
]);

export function isEndedRun(run: Pick<Run, 'status'>): boolean {
  return TERMINAL_STATUSES.has(run.status);
}

// Badge text derived from the same tier predicate (EMU-5 T2 + EMU-12 paused
// coexistence + EMU-13 T4 defensive reorder).  Extracted so RunCard.astro's
// badge binding is testable without an Astro container renderer.  Order is
// belt-and-suspenders: the paused check runs BEFORE isEndedRun so even if
// 'paused' were accidentally added to TERMINAL_STATUSES, paused runs would
// still render PAUSED (BL-231).
export function runBadgeText(
  run: Pick<Run, 'status'>
): 'PAUSED' | 'ENDED' | 'RUNNING' {
  if (run.status === 'paused') return 'PAUSED';
  if (isEndedRun(run)) return 'ENDED';
  return 'RUNNING';
}

// EMU-14: badge CSS class derived from the same predicate stack as
// runBadgeText so RunCard + RunDetail cannot drift.  Paused wins first
// (belt-and-suspenders -- mirrors runBadgeText order), then ended, then
// running.  Single source of truth replaces the prior binary ternary in
// RunCard.astro and the inline three-way in RunDetail.astro.
export function runBadgeClass(
  run: Pick<Run, 'status'>
): 'em-badge em-badge--paused' | 'em-badge em-badge--ended' | 'em-badge em-badge--running' {
  if (run.status === 'paused') return 'em-badge em-badge--paused';
  if (isEndedRun(run)) return 'em-badge em-badge--ended';
  return 'em-badge em-badge--running';
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
