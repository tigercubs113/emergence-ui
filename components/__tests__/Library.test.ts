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
  isEndedRun,
  runBadgeText,
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

// EMU-5 T2: the tier predicate and the RunCard badge must derive from a
// single source of truth so the badge can never contradict the tier a run
// was classified into (DC-14 RC4).
describe('isEndedRun (EMU-5 T2)', () => {
  it('classifies a run with a non-empty ended_at string as ended', () => {
    expect(isEndedRun({ ended_at: '2026-04-14T06:00:00Z' })).toBe(true);
  });

  it('classifies a run with ended_at === null as not ended', () => {
    expect(isEndedRun({ ended_at: null as any })).toBe(false);
  });

  it('classifies a run with ended_at === undefined as not ended', () => {
    expect(isEndedRun({ ended_at: undefined as any })).toBe(false);
  });

  it('classifies a run with an empty-string ended_at as not ended', () => {
    expect(isEndedRun({ ended_at: '' as any })).toBe(false);
  });

  it('ignores raw status field -- ended_at is the only signal', () => {
    // Classic DC-14 RC4 shape: raw.status == "running" but ended_at set.
    const contradiction = makeRun({
      status: 'running',
      ended_at: '2026-04-14T06:00:00Z',
    });
    expect(isEndedRun(contradiction)).toBe(true);
    // Inverse: status completed but ended_at null -> still active per predicate.
    const reverse = makeRun({ status: 'completed', ended_at: null as any });
    expect(isEndedRun(reverse)).toBe(false);
  });
});

describe('runBadgeText (EMU-5 T2)', () => {
  it('returns "ENDED" when ended_at is a non-empty string', () => {
    expect(runBadgeText(makeRun({ ended_at: '2026-04-14T06:00:00Z' }))).toBe('ENDED');
  });

  it('returns "RUNNING" when ended_at is null', () => {
    expect(runBadgeText(makeRun({ ended_at: null as any }))).toBe('RUNNING');
  });

  it('returns "RUNNING" when ended_at is undefined', () => {
    expect(runBadgeText(makeRun({ ended_at: undefined as any }))).toBe('RUNNING');
  });

  // EMU-12 T4 paused coexistence: three-way badge must surface PAUSED
  // (added to normalizeStatus by EMU-10) before falling through to the
  // ENDED/RUNNING tier split.  Paused runs stay in the active tier but
  // the badge reflects the operator-visible pause.
  it('returns "PAUSED" when status is paused and ended_at is null (EMU-12 T4)', () => {
    expect(runBadgeText(makeRun({ status: 'paused', ended_at: null as any }))).toBe('PAUSED');
  });

  it('returns "PAUSED" when status is paused regardless of undefined ended_at (EMU-12 T4)', () => {
    expect(runBadgeText(makeRun({ status: 'paused', ended_at: undefined as any }))).toBe('PAUSED');
  });

  it('PAUSED takes precedence over ENDED when status=paused + ended_at set (EMU-12 T4)', () => {
    // Defensive: if upstream ever writes both, operator pause wins at the badge
    // level since Library tier already filtered the run to active via isEndedRun.
    // This test documents the precedence rule.
    expect(runBadgeText(makeRun({ status: 'paused', ended_at: '2026-04-14T06:00:00Z' }))).toBe('PAUSED');
  });
});

// Invariant: for any run, runBadgeText never disagrees with isEndedRun.
// If a future refactor reintroduces status-field branching, this matrix
// test will fail loudly.
describe('tier/badge invariant (EMU-5 T2)', () => {
  const matrix: Array<{ label: string; run: Run; expectedEnded: boolean }> = [
    {
      label: 'completed + ended_at ISO string',
      run: makeRun({ status: 'completed', ended_at: '2026-04-14T06:00:00Z' }),
      expectedEnded: true,
    },
    {
      label: 'running + ended_at null',
      run: makeRun({ status: 'running', ended_at: null as any }),
      expectedEnded: false,
    },
    {
      label: 'paused + ended_at null (BL-228 paused run)',
      run: makeRun({ status: 'paused', ended_at: null as any }),
      expectedEnded: false,
    },
    {
      label: 'contradiction -- running + ended_at set (DC-14 RC4)',
      run: makeRun({ status: 'running', ended_at: '2026-04-14T06:00:00Z' }),
      expectedEnded: true,
    },
    {
      label: 'contradiction -- completed + ended_at null',
      run: makeRun({ status: 'completed', ended_at: null as any }),
      expectedEnded: false,
    },
    {
      label: 'ended_at empty string (legacy bad data)',
      run: makeRun({ status: 'completed', ended_at: '' as any }),
      expectedEnded: false,
    },
  ];

  for (const { label, run, expectedEnded } of matrix) {
    it(`tier and badge agree: ${label}`, () => {
      const tierEnded = isEndedRun(run);
      const badge = runBadgeText(run);
      expect(tierEnded).toBe(expectedEnded);
      // Invariant (EMU-12 T4 adjusted for paused three-way):
      //   - If status==paused -> badge is PAUSED regardless of tier (paused
      //     short-circuits at the badge; run stays in active tier).
      //   - Else: badge "ENDED" iff tier ended, "RUNNING" otherwise.
      if (run.status === 'paused') {
        expect(badge).toBe('PAUSED');
      } else {
        expect(badge === 'ENDED').toBe(tierEnded);
        expect(badge === 'RUNNING').toBe(!tierEnded);
      }
    });
  }
});
