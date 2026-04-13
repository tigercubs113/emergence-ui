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
): 'running' | 'paused' | 'completed' | 'aborted' {
  const s = (status ?? 'running').toLowerCase();
  if (s === 'completed' || s === 'aborted' || s === 'paused') return s as 'completed' | 'aborted' | 'paused';
  return 'running';
}

export function filterInternalNeeds(
  needs: { label: string; value: number; max: number }[]
): { label: string; value: number; max: number }[] {
  return needs.filter(
    n => !INTERNAL_NEED_KEYS.includes(n.label.toLowerCase())
  );
}
