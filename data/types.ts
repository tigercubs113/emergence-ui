// data/types.ts -- Canonical types for all Emergence display data.
// Components consume these types regardless of data source (JSON or Supabase).

export interface Run {
  id: string;           // Full UUID (bcf25057-2c03-4e70-b147-169a95383f61)
  run_number: number;   // Sequential display number (19)
  name: string;         // Human label ("Haiku 4.5 Evaluation")
  status: 'running' | 'paused' | 'completed' | 'aborted';
  tick_count: number;
  sim_days: number;
  agent_count: number;
  agents_alive: number;
  prng_seed: number;
  wall_clock_ms: number;
  model_config: ModelConfig;
  summary: string;      // One-line description
  created_at: string;   // ISO timestamp
  ended_at?: string | null;  // ISO timestamp when run ended; null/undefined means still active
}

export interface AgentDashboardRow {
  agent_name: string;
  hunger: number;
  thirst: number;
  rest: number;
  location: { x: number; y: number } | null;
  latest_action: { tick: number; action_type: string; target: string | null } | null;
}

export interface DispatchSummary {
  run_id: string;
  run_number: number;
  window_start_tick: number;
  window_end_tick: number;
  conversation_count: number;
  action_count: number;
  last_actions: {
    agent_name: string;
    tick: number;
    action_type: string;
    target: string | null;
  }[];
  agent_dashboard: AgentDashboardRow[];
}

export interface ModelConfig {
  routes: Record<string, { provider: string; model: string }>;
  fallback: { provider: string; model: string };
}

export interface RunDetail extends Run {
  agents: AgentSummary[];
  days: DaySummary[];
  relationships: Relationship[];
}

export interface AgentSummary {
  id: string;
  name: string;
  skills: string[];       // Primary skills, Title Case
  backstory: string;      // Human-readable personality_summary
  health_pct: number;     // 0-100
  is_alive: boolean;
  occupation: string;
}

export interface DaySummary {
  sim_day: number;
  tick_range: [number, number];  // Always a tuple
  decision_count: number;
  conversation_count: number;
  narrative: string | null;
}

export interface DayDetail {
  sim_day: number;
  tick_range: [number, number];
  stats: {
    decisions: number;
    conversations: number;
    crafts_attempted: number;
    rest_events: number;
  };
  events: ActivityEvent[];
  conversations: Conversation[];
  need_states: AgentNeedSnapshot[];
}

export interface ActivityEvent {
  tick: number;
  agent_name: string;
  action_type: string;
  target: string | null;
  detail: string | null;
  outcome: 'success' | 'failed' | null;
}

export interface Conversation {
  id: string;
  participants: string[];    // Agent names
  turns: ConversationTurn[];
  end_reason: string;
  relationship_changes: RelationshipChange[];
}

export interface ConversationTurn {
  speaker: string;
  text: string;
}

export interface RelationshipChange {
  agent_a: string;
  agent_b: string;
  old_type: string;
  new_type: string;
  old_score: number;
  new_score: number;
}

export interface Relationship {
  agent_a: string;
  agent_b: string;
  type: string;         // acquaintance, friend, close_friend, rival
  score: number;
}

export interface AgentProfile {
  id: string;
  name: string;
  skills: string[];
  backstory: string;
  health_pct: number;
  is_alive: boolean;
  occupation: string;
  stats: {
    total_decisions: number;
    total_conversations: number;
    memories_formed: number;
  };
  journal_entries: JournalEntry[];
  relationships: Relationship[];
  decisions: ActivityEvent[];
}

export interface JournalEntry {
  sim_day: number;
  text: string;
}

export interface AgentNeedSnapshot {
  agent_name: string;
  needs: { label: string; value: number; max: number }[];
}
