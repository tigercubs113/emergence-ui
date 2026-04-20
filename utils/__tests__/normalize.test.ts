// utils/__tests__/normalize.test.ts
import { describe, it, expect } from 'vitest';
import {
  normalizeTickRange,
  normalizePersonality,
  normalizeStatus,
  filterInternalNeeds,
} from '../normalize.js';

describe('normalizeTickRange', () => {
  it('passes through tuple unchanged', () => {
    expect(normalizeTickRange([0, 99])).toEqual([0, 99]);
  });

  it('converts {start, end} object to tuple', () => {
    expect(normalizeTickRange({ start: 0, end: 99 })).toEqual([0, 99]);
  });

  it('returns [0, 0] for null/undefined', () => {
    expect(normalizeTickRange(null)).toEqual([0, 0]);
    expect(normalizeTickRange(undefined)).toEqual([0, 0]);
  });
});

describe('normalizePersonality', () => {
  it('returns personality_summary when available', () => {
    const agent = {
      personality: '{"traits":{"Patient":8},"backstory":"A quiet healer."}',
      personality_summary: 'A quiet healer.',
    };
    expect(normalizePersonality(agent)).toBe('A quiet healer.');
  });

  it('extracts backstory from JSON when summary missing', () => {
    const agent = {
      personality: '{"traits":{"Patient":8},"backstory":"A quiet healer."}',
    };
    expect(normalizePersonality(agent)).toBe('A quiet healer.');
  });

  it('returns empty string for unparseable personality', () => {
    const agent = { personality: 'not json' };
    expect(normalizePersonality(agent)).toBe('');
  });
});

describe('normalizeStatus', () => {
  it('normalizes status strings', () => {
    expect(normalizeStatus('running')).toBe('running');
    expect(normalizeStatus('completed')).toBe('completed');
    expect(normalizeStatus('RUNNING')).toBe('running');
    expect(normalizeStatus(undefined)).toBe('running');
  });

  // EMU-13 T1 (BL-231): 'ended' and 'crashed' are terminal statuses added
  // to Run.status; they must pass through normalizeStatus untouched so the
  // loader's status-based tiering can classify them correctly.  'paused'
  // must also pass through (operator pause coexists with the active tier).
  it('passes through EMU-13 terminal statuses without coercing to running', () => {
    expect(normalizeStatus('ended')).toBe('ended');
    expect(normalizeStatus('crashed')).toBe('crashed');
    expect(normalizeStatus('paused')).toBe('paused');
    expect(normalizeStatus('aborted')).toBe('aborted');
    // Case insensitive -- upstream may emit uppercase.
    expect(normalizeStatus('ENDED')).toBe('ended');
    expect(normalizeStatus('Crashed')).toBe('crashed');
  });

  it('coerces unknown status to running (defensive default)', () => {
    expect(normalizeStatus('zombied')).toBe('running');
    expect(normalizeStatus('')).toBe('running');
  });
});

describe('filterInternalNeeds', () => {
  it('removes composite_modifier', () => {
    const needs = [
      { label: 'Thirst', value: 2.1, max: 5 },
      { label: 'Composite_modifier', value: 1.25, max: 5 },
      { label: 'Hunger', value: 3.4, max: 5 },
    ];
    const result = filterInternalNeeds(needs);
    expect(result).toHaveLength(2);
    expect(result.map(n => n.label)).toEqual(['Thirst', 'Hunger']);
  });
});
