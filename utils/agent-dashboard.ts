// utils/agent-dashboard.ts -- Pure helpers for the AgentDashboard component (EMU-4 T3).
//
// Kept DOM-free so the component's derivation logic can be unit-tested without
// jsdom or an Astro container renderer.  The Astro template in
// AgentDashboard.astro calls these for each row.
//
// Convention matches the existing agent-search helpers (see RunDetail-search.test).

import type { AgentDashboardRow } from '../data/types.js';
import { formatNeedValue } from './format.js';

// Needs share a max of 5 per the NeedStates convention used elsewhere in the
// component library (see data/json-loader.ts mapDay path).
export const NEED_MAX = 5;

// A need is "critical" when the value is at or below 1 out of 5.  The plan spec
// says "Color tint when value <= 1" -- components apply the
// .em-dashboard-grid__critical class when this returns true.
export const CRITICAL_THRESHOLD = 1;

export function isCriticalNeed(value: number): boolean {
  return typeof value === 'number' && value <= CRITICAL_THRESHOLD;
}

export function formatDashboardNeed(value: number): string {
  // Matches NeedStates "avg X.X / Y.Y" display style (formatNeedValue output).
  return formatNeedValue(value, NEED_MAX);
}

export function formatDashboardLocation(
  location: { x: number; y: number } | null | undefined
): string {
  if (!location || typeof location.x !== 'number' || typeof location.y !== 'number') {
    return '--';
  }
  return `(${location.x}, ${location.y})`;
}

export function formatDashboardAction(
  action: { tick: number; action_type: string; target: string | null } | null | undefined
): string {
  if (!action || typeof action.tick !== 'number' || !action.action_type) {
    return '--';
  }
  const target = action.target ? `:${action.target}` : '';
  return `T${action.tick} ${action.action_type}${target}`;
}

// Full per-row derivation: everything the template needs to render one line.
// Keeping this here makes the Astro <template> body trivial and the logic
// 100% covered by unit tests.
export interface AgentDashboardRowView {
  agent_name: string;
  hunger_display: string;
  thirst_display: string;
  rest_display: string;
  hunger_critical: boolean;
  thirst_critical: boolean;
  rest_critical: boolean;
  location_display: string;
  action_display: string;
}

export function deriveDashboardRow(row: AgentDashboardRow): AgentDashboardRowView {
  return {
    agent_name: row.agent_name,
    hunger_display: formatDashboardNeed(row.hunger),
    thirst_display: formatDashboardNeed(row.thirst),
    rest_display: formatDashboardNeed(row.rest),
    hunger_critical: isCriticalNeed(row.hunger),
    thirst_critical: isCriticalNeed(row.thirst),
    rest_critical: isCriticalNeed(row.rest),
    location_display: formatDashboardLocation(row.location),
    action_display: formatDashboardAction(row.latest_action),
  };
}

export function deriveDashboardRows(
  rows: AgentDashboardRow[] | null | undefined
): AgentDashboardRowView[] {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  return rows.map(deriveDashboardRow);
}
