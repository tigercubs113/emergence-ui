// components/__tests__/Library.test.ts
//
// Tests the derivation helpers powering Library.astro (EMU-4 T2).
// Pattern mirrors NowRunning.test.ts: the Astro template is a thin wrapper
// around pure helpers in utils/library.ts, so the branch logic (empty / list),
// subtitle formatting, and Hub fallback decision are covered here without
// jsdom.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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

// EMU-13 T1 (BL-231): the tier predicate is STATUS-based, not ended_at-based.
// The pipeline writes ended_at on any non-running transition (pause, TPK,
// error) so it cannot indicate termination.  A run is "ended" IFF its status
// is one of {ended, completed, aborted, crashed}.  RunCard badge and Library
// tier derive from the same predicate so they can never disagree.
describe('isEndedRun (EMU-13 T1)', () => {
  it('classifies status=completed as ended', () => {
    expect(isEndedRun({ status: 'completed' })).toBe(true);
  });

  it('classifies status=ended as ended (EMU-13 new terminal status)', () => {
    expect(isEndedRun({ status: 'ended' })).toBe(true);
  });

  it('classifies status=aborted as ended', () => {
    expect(isEndedRun({ status: 'aborted' })).toBe(true);
  });

  it('classifies status=crashed as ended (EMU-13 new terminal status)', () => {
    expect(isEndedRun({ status: 'crashed' })).toBe(true);
  });

  it('classifies status=running as not ended', () => {
    expect(isEndedRun({ status: 'running' })).toBe(false);
  });

  it('classifies status=paused as not ended (stays in active tier)', () => {
    expect(isEndedRun({ status: 'paused' })).toBe(false);
  });

  it('ignores ended_at presence/absence -- status is the only signal', () => {
    // EMU-12 bug scenario: pipeline wrote ended_at on pause, but operator
    // expects the run to stay in the active tier.  Predicate must be status
    // based so ended_at on a paused run does NOT misclassify it as ended.
    const pausedWithEndedAt = makeRun({
      status: 'paused',
      ended_at: '2026-04-14T06:00:00Z',
    });
    expect(isEndedRun(pausedWithEndedAt)).toBe(false);

    // Inverse: status=completed but ended_at null -> still ended per status.
    const completedWithoutEndedAt = makeRun({
      status: 'completed',
      ended_at: null as any,
    });
    expect(isEndedRun(completedWithoutEndedAt)).toBe(true);

    // Running with a bogus ended_at -> still active per status.
    const runningWithEndedAt = makeRun({
      status: 'running',
      ended_at: '2026-04-14T06:00:00Z',
    });
    expect(isEndedRun(runningWithEndedAt)).toBe(false);
  });
});

describe('runBadgeText (EMU-13 T4)', () => {
  it('returns "ENDED" when status is a terminal status', () => {
    expect(runBadgeText(makeRun({ status: 'completed' }))).toBe('ENDED');
    expect(runBadgeText(makeRun({ status: 'ended' }))).toBe('ENDED');
    expect(runBadgeText(makeRun({ status: 'aborted' }))).toBe('ENDED');
    expect(runBadgeText(makeRun({ status: 'crashed' }))).toBe('ENDED');
  });

  it('returns "RUNNING" when status is running', () => {
    expect(runBadgeText(makeRun({ status: 'running' }))).toBe('RUNNING');
  });

  it('returns "PAUSED" when status is paused (EMU-12 paused coexistence)', () => {
    expect(runBadgeText(makeRun({ status: 'paused' }))).toBe('PAUSED');
  });

  // EMU-13 T4 defensive ordering: the paused check runs BEFORE isEndedRun,
  // so even if 'paused' were ever accidentally added to TERMINAL_STATUSES,
  // paused runs would still render PAUSED (belt-and-suspenders against
  // future refactor regressions).
  it('PAUSED wins over ENDED: status=paused always returns PAUSED regardless of ended_at', () => {
    expect(
      runBadgeText(makeRun({ status: 'paused', ended_at: '2026-04-14T06:00:00Z' }))
    ).toBe('PAUSED');
    expect(
      runBadgeText(makeRun({ status: 'paused', ended_at: null as any }))
    ).toBe('PAUSED');
    expect(
      runBadgeText(makeRun({ status: 'paused', ended_at: undefined as any }))
    ).toBe('PAUSED');
  });
});

// Invariant: for any run, runBadgeText never disagrees with isEndedRun.
// If a future refactor reintroduces ended_at-based branching, this matrix
// test will fail loudly.
describe('tier/badge invariant (EMU-13 T1 + T4)', () => {
  const matrix: Array<{ label: string; run: Run; expectedEnded: boolean }> = [
    {
      label: 'status=completed',
      run: makeRun({ status: 'completed', ended_at: '2026-04-14T06:00:00Z' }),
      expectedEnded: true,
    },
    {
      label: 'status=ended (EMU-13)',
      run: makeRun({ status: 'ended', ended_at: '2026-04-14T06:00:00Z' }),
      expectedEnded: true,
    },
    {
      label: 'status=aborted',
      run: makeRun({ status: 'aborted', ended_at: '2026-04-14T06:00:00Z' }),
      expectedEnded: true,
    },
    {
      label: 'status=crashed (EMU-13)',
      run: makeRun({ status: 'crashed', ended_at: '2026-04-14T06:00:00Z' }),
      expectedEnded: true,
    },
    {
      label: 'status=running + ended_at null',
      run: makeRun({ status: 'running', ended_at: null as any }),
      expectedEnded: false,
    },
    {
      label: 'status=paused + ended_at null (BL-228 paused run)',
      run: makeRun({ status: 'paused', ended_at: null as any }),
      expectedEnded: false,
    },
    {
      label: 'status=paused + ended_at set (EMU-12 bug scenario)',
      run: makeRun({ status: 'paused', ended_at: '2026-04-14T06:00:00Z' }),
      expectedEnded: false,
    },
    {
      label: 'status=running + ended_at set (contradiction -- status wins)',
      run: makeRun({ status: 'running', ended_at: '2026-04-14T06:00:00Z' }),
      expectedEnded: false,
    },
    {
      label: 'status=completed + ended_at null (contradiction -- status wins)',
      run: makeRun({ status: 'completed', ended_at: null as any }),
      expectedEnded: true,
    },
  ];

  for (const { label, run, expectedEnded } of matrix) {
    it(`tier and badge agree: ${label}`, () => {
      const tierEnded = isEndedRun(run);
      const badge = runBadgeText(run);
      expect(tierEnded).toBe(expectedEnded);
      // Invariant (EMU-13 T4 three-way with defensive paused short-circuit):
      //   - If status==paused -> badge is PAUSED regardless of tier.
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

// EMU-13 T4b: RunCard and RunDetail must derive badge text from the same
// helper so their rendered badges cannot disagree.  Astro SFCs are awkward
// to render under vitest, so assert via static import analysis -- both
// components must import runBadgeText from utils/library.  If either
// component stops importing it (regression to local branching), this test
// fails loudly.
describe('cross-component badge parity (EMU-13 T4b)', () => {
  const repoRoot = resolve(__dirname, '..', '..');
  function componentImportsRunBadgeText(relativePath: string): boolean {
    const src = readFileSync(resolve(repoRoot, relativePath), 'utf8');
    return /import\s*\{[^}]*\brunBadgeText\b[^}]*\}\s*from\s*['"][^'"]*utils\/library['"]/.test(
      src
    );
  }

  it('RunCard.astro imports runBadgeText from utils/library', () => {
    expect(componentImportsRunBadgeText('components/RunCard.astro')).toBe(true);
  });

  it('RunDetail.astro imports runBadgeText from utils/library', () => {
    expect(componentImportsRunBadgeText('components/RunDetail.astro')).toBe(true);
  });
});
