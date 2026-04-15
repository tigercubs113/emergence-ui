// data/loader.ts -- Interface that abstracts data source.
// json-loader.ts implements this for static JSON (current).
// supabase-loader.ts will implement this for live DB (future).

import type {
  Run,
  RunDetail,
  DayDetail,
  AgentProfile,
  Relationship,
  DispatchSummary,
} from './types.js';

export interface DataLoader {
  listRuns(): Promise<Run[]>;
  getRun(id: string): Promise<RunDetail>;
  getDay(runId: string, day: number): Promise<DayDetail>;
  getAgent(runId: string, name: string): Promise<AgentProfile>;
  getRelationships(runId: string): Promise<Relationship[]>;
  listActiveRuns(): Promise<Run[]>;                                 // ended_at IS NULL
  listEndedRuns(): Promise<Run[]>;                                  // ended_at IS NOT NULL
  getActiveRunDashboard(runId: string): Promise<DispatchSummary | null>;
}
