// utils/__tests__/format.test.ts
import { describe, it, expect } from 'vitest';
import {
  formatNeedLabel,
  formatDuration,
  formatTickRange,
  formatNeedValue,
} from '../format.js';

describe('formatNeedLabel', () => {
  it('converts snake_case to Title Case', () => {
    expect(formatNeedLabel('health_safety')).toBe('Health Safety');
    expect(formatNeedLabel('self_respect')).toBe('Self Respect');
    expect(formatNeedLabel('meaning_seeking')).toBe('Meaning Seeking');
  });

  it('handles already-formatted labels', () => {
    expect(formatNeedLabel('Thirst')).toBe('Thirst');
    expect(formatNeedLabel('Air')).toBe('Air');
  });
});

describe('formatDuration', () => {
  it('formats ms to human readable', () => {
    expect(formatDuration(3600000)).toBe('1h 0m');
    expect(formatDuration(32640000)).toBe('9h 4m');
    expect(formatDuration(180000)).toBe('3m');
  });
});

describe('formatTickRange', () => {
  it('formats tuple as string', () => {
    expect(formatTickRange([0, 99])).toBe('0\u201399');
    expect(formatTickRange([100, 199])).toBe('100\u2013199');
  });
});

describe('formatNeedValue', () => {
  it('formats raw 0-5 value with one decimal', () => {
    expect(formatNeedValue(2.1, 5)).toBe('2.1 / 5.0');
    expect(formatNeedValue(0, 5)).toBe('0.0 / 5.0');
  });
});
