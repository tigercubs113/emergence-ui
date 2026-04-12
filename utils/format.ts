// utils/format.ts -- Display formatting for Emergence data.

export function formatNeedLabel(raw: string): string {
  return raw
    .split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

export function formatDuration(ms: number): string {
  const totalMin = Math.floor(ms / 60000);
  const hours = Math.floor(totalMin / 60);
  const minutes = totalMin % 60;
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

export function formatTickRange(range: [number, number]): string {
  return `${range[0]}\u2013${range[1]}`;
}

export function formatNeedValue(value: number, max: number): string {
  return `${value.toFixed(1)} / ${max.toFixed(1)}`;
}
