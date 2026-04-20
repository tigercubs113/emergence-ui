// utils/normalize.ts -- Defensive normalization for export data shapes.

const INTERNAL_NEED_KEYS = ['composite_modifier'];

export function normalizeTickRange(
  raw: [number, number] | { start: number; end: number } | null | undefined
): [number, number] {
  if (!raw) return [0, 0];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'object' && 'start' in raw && 'end' in raw) {
    return [raw.start, raw.end];
  }
  return [0, 0];
}

export function normalizePersonality(
  agent: { personality?: string; personality_summary?: string }
): string {
  if (agent.personality_summary) return agent.personality_summary;
  if (!agent.personality) return '';
  try {
    const parsed = JSON.parse(agent.personality);
    return parsed.backstory ?? '';
  } catch {
    return '';
  }
}

export function normalizeStatus(
  status: string | undefined
): 'running' | 'paused' | 'completed' | 'aborted' | 'ended' | 'crashed' {
  // EMU-13 T1 (BL-231): the Run.status union was extended with 'ended' and
  // 'crashed' terminal statuses.  normalizeStatus must forward them through;
  // otherwise the loader's listEndedRuns/listActiveRuns tiering (which reads
  // status via isEndedRun) would coerce them to 'running' and misclassify
  // the run as active.  Allow-list matches utils/library.ts TERMINAL_STATUSES
  // plus {running, paused}.
  const s = (status ?? 'running').toLowerCase();
  if (
    s === 'completed' ||
    s === 'aborted' ||
    s === 'paused' ||
    s === 'ended' ||
    s === 'crashed'
  ) {
    return s as 'completed' | 'aborted' | 'paused' | 'ended' | 'crashed';
  }
  return 'running';
}

export function filterInternalNeeds(
  needs: { label: string; value: number; max: number }[]
): { label: string; value: number; max: number }[] {
  return needs.filter(
    n => !INTERNAL_NEED_KEYS.includes(n.label.toLowerCase())
  );
}
