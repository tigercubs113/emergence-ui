// components/__tests__/AgentDashboard.test.ts
//
// Tests the derivation helpers powering AgentDashboard.astro (EMU-4 T3).
// Pattern mirrors RunDetail-search.test.ts: the Astro template is a thin
// wrapper around pure helpers in utils/agent-dashboard.ts, so tests exercise
// those helpers directly without jsdom or an Astro container renderer.

import { describe, it, expect } from 'vitest';
import type { AgentDashboardRow } from '../../data/types.js';
import {
  CRITICAL_THRESHOLD,
  NEED_MAX,
  deriveDashboardRow,
  deriveDashboardRows,
  formatDashboardAction,
  formatDashboardLocation,
  formatDashboardNeed,
  isCriticalNeed,
} from '../../utils/agent-dashboard.js';

function makeRow(overrides: Partial<AgentDashboardRow> = {}): AgentDashboardRow {
  return {
    agent_name: 'Eve',
    hunger: 3,
    thirst: 3,
    rest: 3,
    location: { x: 0, y: 0 },
    latest_action: { tick: 10, action_type: 'scout', target: null },
    ...overrides,
  };
}

describe('isCriticalNeed', () => {
  it('flags values at or below the threshold', () => {
    expect(isCriticalNeed(0)).toBe(true);
    expect(isCriticalNeed(0.5)).toBe(true);
    expect(isCriticalNeed(CRITICAL_THRESHOLD)).toBe(true);
  });

  it('does not flag values above the threshold', () => {
    expect(isCriticalNeed(1.01)).toBe(false);
    expect(isCriticalNeed(2)).toBe(false);
    expect(isCriticalNeed(NEED_MAX)).toBe(false);
  });

  it('returns false for non-numeric input', () => {
    // @ts-expect-error -- guarding against bad upstream data.
    expect(isCriticalNeed(undefined)).toBe(false);
    // @ts-expect-error -- guarding against bad upstream data.
    expect(isCriticalNeed(null)).toBe(false);
  });
});

describe('formatDashboardNeed', () => {
  it('formats the need as "value / max" with one decimal', () => {
    expect(formatDashboardNeed(2)).toBe('2.0 / 5.0');
    expect(formatDashboardNeed(0.5)).toBe('0.5 / 5.0');
    expect(formatDashboardNeed(5)).toBe('5.0 / 5.0');
  });
});

describe('formatDashboardLocation', () => {
  it('formats {x,y} tuples with parens and a space after the comma', () => {
    expect(formatDashboardLocation({ x: 9, y: 14 })).toBe('(9, 14)');
    expect(formatDashboardLocation({ x: 0, y: 0 })).toBe('(0, 0)');
    expect(formatDashboardLocation({ x: -1, y: 7 })).toBe('(-1, 7)');
  });

  it('returns "--" when location is null or missing', () => {
    expect(formatDashboardLocation(null)).toBe('--');
    expect(formatDashboardLocation(undefined)).toBe('--');
  });

  it('returns "--" when coordinates are not numbers', () => {
    // @ts-expect-error -- guarding against bad upstream data.
    expect(formatDashboardLocation({ x: '1', y: 2 })).toBe('--');
    // @ts-expect-error -- guarding against bad upstream data.
    expect(formatDashboardLocation({ x: 1 })).toBe('--');
  });
});

describe('formatDashboardAction', () => {
  it('formats action with target as "T{tick} {type}:{target}"', () => {
    expect(
      formatDashboardAction({ tick: 152, action_type: 'drink', target: 'stream' })
    ).toBe('T152 drink:stream');
    expect(
      formatDashboardAction({ tick: 150, action_type: 'eat', target: 'fish' })
    ).toBe('T150 eat:fish');
  });

  it('omits the colon/target when target is null', () => {
    expect(
      formatDashboardAction({ tick: 42, action_type: 'rest', target: null })
    ).toBe('T42 rest');
  });

  it('returns "--" when action is null', () => {
    expect(formatDashboardAction(null)).toBe('--');
    expect(formatDashboardAction(undefined)).toBe('--');
  });

  it('returns "--" when action_type is empty', () => {
    expect(formatDashboardAction({ tick: 1, action_type: '', target: null })).toBe('--');
  });
});

describe('deriveDashboardRow', () => {
  it('produces the view object a template needs for a normal row', () => {
    const view = deriveDashboardRow(
      makeRow({
        agent_name: 'Eve',
        hunger: 2,
        thirst: 0.5,
        rest: 2,
        location: { x: 9, y: 14 },
        latest_action: { tick: 152, action_type: 'drink', target: 'stream' },
      })
    );
    expect(view).toEqual({
      agent_name: 'Eve',
      hunger_display: '2.0 / 5.0',
      thirst_display: '0.5 / 5.0',
      rest_display: '2.0 / 5.0',
      hunger_critical: false,
      thirst_critical: true,  // 0.5 <= 1
      rest_critical: false,
      location_display: '(9, 14)',
      action_display: 'T152 drink:stream',
    });
  });

  it('marks all three needs critical when each is at or below the threshold', () => {
    const view = deriveDashboardRow(makeRow({ hunger: 0, thirst: 1, rest: 0.5 }));
    expect(view.hunger_critical).toBe(true);
    expect(view.thirst_critical).toBe(true);
    expect(view.rest_critical).toBe(true);
  });

  it('renders "--" for null location and null latest_action', () => {
    const view = deriveDashboardRow(
      makeRow({ location: null, latest_action: null })
    );
    expect(view.location_display).toBe('--');
    expect(view.action_display).toBe('--');
  });
});

describe('deriveDashboardRows', () => {
  it('maps one view per input row in order', () => {
    const rows: AgentDashboardRow[] = [
      makeRow({ agent_name: 'Eve', hunger: 2 }),
      makeRow({ agent_name: 'Finn', hunger: 4 }),
    ];
    const views = deriveDashboardRows(rows);
    expect(views).toHaveLength(2);
    expect(views[0].agent_name).toBe('Eve');
    expect(views[1].agent_name).toBe('Finn');
  });

  it('returns empty array for null or undefined input (blank state signal)', () => {
    expect(deriveDashboardRows(null)).toEqual([]);
    expect(deriveDashboardRows(undefined)).toEqual([]);
  });

  it('returns empty array when given an empty rows array', () => {
    expect(deriveDashboardRows([])).toEqual([]);
  });

  it('propagates critical-need flags correctly across multiple rows', () => {
    const rows: AgentDashboardRow[] = [
      makeRow({ agent_name: 'Eve', hunger: 0.5 }),
      makeRow({ agent_name: 'Finn', hunger: 3 }),
    ];
    const views = deriveDashboardRows(rows);
    expect(views[0].hunger_critical).toBe(true);
    expect(views[1].hunger_critical).toBe(false);
  });
});
