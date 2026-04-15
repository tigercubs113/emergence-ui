// components/__tests__/NowRunning.test.ts
//
// Tests the derivation helpers powering NowRunning.astro (EMU-4 T1).
// Pattern mirrors AgentDashboard.test.ts: the Astro template is a thin wrapper
// around pure helpers in utils/now-running.ts, so the branch logic
// (blank / no-dashboard / dashboard), window header formatting, and recent
// action formatting are covered here without jsdom.

import { describe, it, expect } from 'vitest';
import type {
  AgentDashboardRow,
  DispatchSummary,
  Run,
} from '../../data/types.js';
import {
  deriveNowRunningState,
  formatRecentActionLine,
  formatWindowHeader,
  normalizeRecentActions,
  pickFeaturedActiveRun,
} from '../../utils/now-running.js';

function makeRun(overrides: Partial<Run> = {}): Run {
  return {
    id: 'bcf25057-2c03-4e70-b147-169a95383f61',
    run_number: 21,
    name: 'Active Run',
    status: 'running',
    tick_count: 160,
    sim_days: 1.0,
    agent_count: 4,
    agents_alive: 4,
    prng_seed: 42,
    wall_clock_ms: 123456,
    model_config: { routes: {}, fallback: { provider: 'anthropic', model: 'haiku' } },
    summary: 'Shakedown run',
    created_at: '2026-04-14T12:00:00Z',
    ended_at: null,
    ...overrides,
  };
}

function makeAgentRow(overrides: Partial<AgentDashboardRow> = {}): AgentDashboardRow {
  return {
    agent_name: 'Eve',
    hunger: 3,
    thirst: 3,
    rest: 3,
    location: { x: 0, y: 0 },
    latest_action: { tick: 160, action_type: 'scout', target: null },
    ...overrides,
  };
}

function makeDashboard(overrides: Partial<DispatchSummary> = {}): DispatchSummary {
  return {
    run_id: 'bcf25057-2c03-4e70-b147-169a95383f61',
    run_number: 21,
    window_start_tick: 140,
    window_end_tick: 160,
    conversation_count: 3,
    action_count: 17,
    last_actions: [
      { agent_name: 'Eve', tick: 158, action_type: 'drink', target: 'stream' },
      { agent_name: 'Finn', tick: 160, action_type: 'scout', target: null },
    ],
    agent_dashboard: [makeAgentRow({ agent_name: 'Eve' }), makeAgentRow({ agent_name: 'Finn' })],
    ...overrides,
  };
}

describe('pickFeaturedActiveRun', () => {
  it('returns the only run when exactly one is active', () => {
    const run = makeRun();
    expect(pickFeaturedActiveRun([run])).toBe(run);
  });

  it('returns the first run when several are active (DC-5 edge case)', () => {
    const a = makeRun({ run_number: 21 });
    const b = makeRun({ run_number: 22 });
    expect(pickFeaturedActiveRun([a, b])).toBe(a);
  });

  it('returns null for empty, null, or undefined input', () => {
    expect(pickFeaturedActiveRun([])).toBeNull();
    expect(pickFeaturedActiveRun(null)).toBeNull();
    expect(pickFeaturedActiveRun(undefined)).toBeNull();
  });
});

describe('deriveNowRunningState', () => {
  it('returns blank state when there are no active runs', () => {
    expect(deriveNowRunningState([], null)).toEqual({ kind: 'blank' });
    expect(deriveNowRunningState(null, null)).toEqual({ kind: 'blank' });
    expect(deriveNowRunningState(undefined, makeDashboard())).toEqual({ kind: 'blank' });
  });

  it('returns no-dashboard state when active runs exist but dashboard is null', () => {
    const runs = [makeRun()];
    const state = deriveNowRunningState(runs, null);
    expect(state.kind).toBe('no-dashboard');
    if (state.kind === 'no-dashboard') {
      expect(state.runs).toBe(runs);
    }
  });

  it('returns no-dashboard state when dashboard is undefined', () => {
    const runs = [makeRun()];
    const state = deriveNowRunningState(runs, undefined);
    expect(state.kind).toBe('no-dashboard');
  });

  it('returns dashboard state when active runs and dashboard both provided', () => {
    const runs = [makeRun()];
    const dashboard = makeDashboard();
    const state = deriveNowRunningState(runs, dashboard);
    expect(state.kind).toBe('dashboard');
    if (state.kind === 'dashboard') {
      expect(state.runs).toBe(runs);
      expect(state.dashboard).toBe(dashboard);
      // Embedded AgentDashboard will render one row per dashboard agent.
      expect(state.dashboard.agent_dashboard).toHaveLength(2);
    }
  });
});

describe('formatWindowHeader', () => {
  it('formats the tick window as "T{start}-T{end}"', () => {
    expect(formatWindowHeader(140, 160)).toBe('T140-T160');
    expect(formatWindowHeader(0, 20)).toBe('T0-T20');
  });

  it('does not clamp or reorder the inputs (trusts the loader)', () => {
    expect(formatWindowHeader(5, 5)).toBe('T5-T5');
  });
});

describe('formatRecentActionLine', () => {
  it('formats "T{tick} {agent} {type}:{target}" when target is set', () => {
    expect(
      formatRecentActionLine({ agent_name: 'Eve', tick: 158, action_type: 'drink', target: 'stream' })
    ).toBe('T158 Eve drink:stream');
  });

  it('drops the colon segment when target is null or empty', () => {
    expect(
      formatRecentActionLine({ agent_name: 'Finn', tick: 160, action_type: 'scout', target: null })
    ).toBe('T160 Finn scout');
    expect(
      formatRecentActionLine({ agent_name: 'Finn', tick: 160, action_type: 'scout', target: '' })
    ).toBe('T160 Finn scout');
  });
});

describe('normalizeRecentActions', () => {
  it('returns the input list unchanged when all entries are valid', () => {
    const actions = [
      { agent_name: 'Eve', tick: 158, action_type: 'drink', target: 'stream' },
      { agent_name: 'Finn', tick: 160, action_type: 'scout', target: null },
    ];
    expect(normalizeRecentActions(actions)).toEqual(actions);
  });

  it('drops malformed entries (missing agent_name, tick, or action_type)', () => {
    const actions = [
      { agent_name: 'Eve', tick: 158, action_type: 'drink', target: 'stream' },
      // @ts-expect-error -- intentional bad data
      { agent_name: 'Finn', action_type: 'scout', target: null },
      // @ts-expect-error -- intentional bad data
      { agent_name: '', tick: 160, action_type: '', target: null },
    ];
    const out = normalizeRecentActions(actions as DispatchSummary['last_actions']);
    expect(out).toHaveLength(2);
    expect(out[0].agent_name).toBe('Eve');
  });

  it('returns empty array for null/undefined/non-array input', () => {
    expect(normalizeRecentActions(null)).toEqual([]);
    expect(normalizeRecentActions(undefined)).toEqual([]);
    // @ts-expect-error -- guarding against bad upstream data
    expect(normalizeRecentActions('nope')).toEqual([]);
  });
});
