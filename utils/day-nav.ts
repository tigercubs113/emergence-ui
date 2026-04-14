// utils/day-nav.ts -- Prev/next day derivation for DayDetail navigation.
// Replaces arithmetic (sim_day +/- 1) which broke on non-contiguous day exports
// (e.g., a run that exports days 0, 1, 3, 5 must skip the missing days).

export interface PrevNext {
  prev: number | null;
  next: number | null;
}

/**
 * Given the current sim_day and the sorted list of available sim_days for the
 * run, return the prev/next day numbers for navigation links.
 *
 * - Returns nulls for both if dayList is empty or current day is not in list.
 * - Returns null for prev if current is first day.
 * - Returns null for next if current is last day.
 */
export function derivePrevNext(currentDay: number, dayList: number[]): PrevNext {
  if (!dayList || dayList.length === 0) return { prev: null, next: null };
  const idx = dayList.indexOf(currentDay);
  if (idx === -1) return { prev: null, next: null };
  return {
    prev: idx > 0 ? dayList[idx - 1] : null,
    next: idx < dayList.length - 1 ? dayList[idx + 1] : null,
  };
}
