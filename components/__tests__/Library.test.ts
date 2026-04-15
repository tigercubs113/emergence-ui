// components/__tests__/Library.test.ts
//
// Tests the derivation helpers powering Library.astro (EMU-4 T2).
// Pattern mirrors NowRunning.test.ts: the Astro template is a thin wrapper
// around pure helpers in utils/library.ts, so the branch logic (empty / list),
// subtitle formatting, and Hub fallback decision are covered here without
// jsdom.

import { describe, it, expect } from 'vitest';
import type { Run } from '../../data/types.js';
import {
  deriveLibraryState,
  formatLibrarySubtitle,
  shouldUseTieredLayout,
} from '../../utils/library.js';

function makeRun(overrides: Partial<Run> = {}): Run {
  return {
    id: 'bcf25057-2c03-4e70-b147-169a95383f61',
    run_number: 19,
    name: 'Haiku 4.5 Evaluation',
    status: 'completed',
    tick_count: 4800,
    sim_days: 10.0,
    agent_count: 6,
    agents_alive: 5,
    prng_seed: 42,
    wall_clock_ms: 987654,
    model_config: { routes: {}, fallback: { provider: 'anthropic', model: 'haiku' } },
    summary: 'Canonical ended run',
    created_at: '2026-04-10T12:00:00Z',
    ended_at: '2026-04-11T12:00:00Z',
    ...overrides,
  };
}

describe('deriveLibraryState', () => {
  it('returns empty state when endedRuns is an empty array', () => {
    expect(deriveLibraryState([])).toEqual({ kind: 'empty' });
  });

  it('returns empty state when endedRuns is null or undefined', () => {
    expect(deriveLibraryState(null)).toEqual({ kind: 'empty' });
    expect(deriveLibraryState(undefined)).toEqual({ kind: 'empty' });
  });

  it('returns list state carrying the input runs when non-empty', () => {
    const runs = [makeRun({ run_number: 19 }), makeRun({ run_number: 18 })];
    const state = deriveLibraryState(runs);
    expect(state.kind).toBe('list');
    if (state.kind === 'list') {
      expect(state.runs).toBe(runs);
      expect(state.runs).toHaveLength(2);
    }
  });

  it('preserves input order (loader is the ordering authority)', () => {
    const a = makeRun({ run_number: 19 });
    const b = makeRun({ run_number: 18 });
    const c = makeRun({ run_number: 17 });
    const state = deriveLibraryState([a, b, c]);
    if (state.kind === 'list') {
      expect(state.runs[0]).toBe(a);
      expect(state.runs[1]).toBe(b);
      expect(state.runs[2]).toBe(c);
    }
  });
});

describe('formatLibrarySubtitle', () => {
  it('formats the count as "{n} ended runs"', () => {
    expect(formatLibrarySubtitle(0)).toBe('0 ended runs');
    expect(formatLibrarySubtitle(1)).toBe('1 ended runs');
    expect(formatLibrarySubtitle(7)).toBe('7 ended runs');
  });

  it('floors fractional counts defensively', () => {
    expect(formatLibrarySubtitle(3.9)).toBe('3 ended runs');
  });

  it('returns "0 ended runs" for negative or non-numeric counts', () => {
    expect(formatLibrarySubtitle(-1)).toBe('0 ended runs');
    // @ts-expect-error -- guarding against bad upstream data
    expect(formatLibrarySubtitle('nope')).toBe('0 ended runs');
    // @ts-expect-error -- guarding against bad upstream data
    expect(formatLibrarySubtitle(undefined)).toBe('0 ended runs');
  });
});

describe('shouldUseTieredLayout', () => {
  it('returns true when activeRuns is an array (even empty)', () => {
    expect(shouldUseTieredLayout([], undefined)).toBe(true);
    expect(shouldUseTieredLayout([makeRun()], undefined)).toBe(true);
  });

  it('returns true when endedRuns is an array (even empty)', () => {
    expect(shouldUseTieredLayout(undefined, [])).toBe(true);
    expect(shouldUseTieredLayout(undefined, [makeRun()])).toBe(true);
  });

  it('returns true when both active and ended are provided', () => {
    expect(shouldUseTieredLayout([], [])).toBe(true);
  });

  it('returns false when neither active nor ended are provided (legacy path)', () => {
    expect(shouldUseTieredLayout(undefined, undefined)).toBe(false);
    expect(shouldUseTieredLayout(null, null)).toBe(false);
  });
});
