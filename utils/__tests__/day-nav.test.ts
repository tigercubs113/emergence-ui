// utils/__tests__/day-nav.test.ts
// T1 unit tests: derivePrevNext helper.
// T2 integration: builds the same href strings the DayDetail.astro template uses
// and asserts they point to the correct day numbers given a mocked dayList.
import { describe, it, expect } from 'vitest';
import { derivePrevNext } from '../day-nav.js';

describe('derivePrevNext (T1 unit)', () => {
  it('contiguous list: middle day -> neighbors', () => {
    expect(derivePrevNext(2, [0, 1, 2, 3, 4])).toEqual({ prev: 1, next: 3 });
  });

  it('non-contiguous list: skips missing days (gap at 2 and 4)', () => {
    // Run exported days 0, 1, 3, 5 -- day 1 next must jump to 3, day 3 next to 5.
    expect(derivePrevNext(1, [0, 1, 3, 5])).toEqual({ prev: 0, next: 3 });
    expect(derivePrevNext(3, [0, 1, 3, 5])).toEqual({ prev: 1, next: 5 });
  });

  it('first day: prev is null, next is second', () => {
    expect(derivePrevNext(0, [0, 1, 3, 5])).toEqual({ prev: null, next: 1 });
  });

  it('last day: prev is second-to-last, next is null', () => {
    expect(derivePrevNext(5, [0, 1, 3, 5])).toEqual({ prev: 3, next: null });
  });

  it('single-day run: both null', () => {
    expect(derivePrevNext(0, [0])).toEqual({ prev: null, next: null });
  });

  it('empty dayList: both null', () => {
    expect(derivePrevNext(0, [])).toEqual({ prev: null, next: null });
  });

  it('current day not in list: both null (data error guard)', () => {
    expect(derivePrevNext(7, [0, 1, 3, 5])).toEqual({ prev: null, next: null });
  });

  it('non-zero starting day list', () => {
    // Some runs may not export day 0.
    expect(derivePrevNext(2, [2, 4, 6])).toEqual({ prev: null, next: 4 });
    expect(derivePrevNext(4, [2, 4, 6])).toEqual({ prev: 2, next: 6 });
    expect(derivePrevNext(6, [2, 4, 6])).toEqual({ prev: 4, next: null });
  });
});

describe('DayDetail prev/next link hrefs (T2 component-equivalent)', () => {
  // Mirrors the href expression in components/DayDetail.astro:
  //   `${runPath}/day/${prevDay}/`  and  `${runPath}/day/${nextDay}/`
  // We exercise the same dayList -> URL pipeline the template uses.
  function buildLinks(currentDay: number, dayList: number[], basePath: string, runNumber: number) {
    const runPath = `${basePath}/run/${runNumber}`;
    const { prev, next } = derivePrevNext(currentDay, dayList);
    return {
      prevHref: prev !== null ? `${runPath}/day/${prev}/` : null,
      nextHref: next !== null ? `${runPath}/day/${next}/` : null,
    };
  }

  it('non-contiguous dayList renders correct hrefs (no 404 to missing day 2)', () => {
    const links = buildLinks(1, [0, 1, 3, 5], '/emergence', 19);
    expect(links.prevHref).toBe('/emergence/run/19/day/0/');
    expect(links.nextHref).toBe('/emergence/run/19/day/3/');
  });

  it('first day hides prev link', () => {
    const links = buildLinks(0, [0, 1, 3], '/emergence', 19);
    expect(links.prevHref).toBeNull();
    expect(links.nextHref).toBe('/emergence/run/19/day/1/');
  });

  it('last day hides next link', () => {
    const links = buildLinks(3, [0, 1, 3], '/emergence', 19);
    expect(links.prevHref).toBe('/emergence/run/19/day/1/');
    expect(links.nextHref).toBeNull();
  });

  it('single-day run hides both links', () => {
    const links = buildLinks(0, [0], '/emergence', 19);
    expect(links.prevHref).toBeNull();
    expect(links.nextHref).toBeNull();
  });
});
