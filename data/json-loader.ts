// data/json-loader.ts -- Static JSON implementation of DataLoader.
// Reads from pre-resolved data passed in by the host site.
// The host site uses Astro's import.meta.glob or fs reads to load the JSON,
// then passes it to createJsonLoader().

import type { DataLoader } from './loader.js';
import type {
  Run,
  RunDetail,
  DayDetail,
  AgentProfile,
  Relationship,
  ModelConfig,
} from './types.js';
import {
  normalizeTickRange,
  normalizePersonality,
  normalizeStatus,
  filterInternalNeeds,
} from '../utils/normalize.js';
import { formatNeedLabel } from '../utils/format.js';

interface JsonLoaderConfig {
  runsJson: any;                          // Contents of runs.json
  runDataDir: Record<string, any>;        // run-N/manifest.json + day files keyed by path
}

export function createJsonLoader(config: JsonLoaderConfig): DataLoader {
  const { runsJson, runDataDir } = config;

  function mapRun(raw: any): Run {
    return {
      id: raw.run_id,
      run_number: raw.run_number,
      name: raw.name ?? `Run ${raw.run_number}`,
      status: normalizeStatus(raw.status),
      tick_count: raw.tick_count ?? 0,
      sim_days: raw.sim_days ?? 0,
      agent_count: raw.agent_count ?? 0,
      agents_alive: raw.agents_alive ?? raw.agent_count ?? 0,
      prng_seed: raw.seed ?? raw.prng_seed ?? 0,
      wall_clock_ms: raw.wall_clock_ms ?? 0,
      model_config: raw.model_config ?? { routes: {}, fallback: { provider: '', model: '' } },
      summary: raw.summary ?? '',
      created_at: raw.created_at ?? '',
    };
  }

  function mapAgent(raw: any): import('./types.js').AgentSummary {
    return {
      id: raw.id ?? raw.agent_id ?? '',
      name: raw.name,
      skills: raw.skills ?? [],
      backstory: normalizePersonality(raw),
      health_pct: raw.health_pct ?? raw.health ?? 100,
      is_alive: raw.is_alive ?? true,
      occupation: raw.occupation ?? raw.skills?.[0] ?? '',
    };
  }

  function mapDay(raw: any): import('./types.js').DaySummary {
    return {
      sim_day: raw.sim_day ?? 0,
      tick_range: normalizeTickRange(raw.tick_range),
      decision_count: raw.stats?.decisions_today ?? raw.decision_count ?? 0,
      conversation_count: raw.stats?.conversations_today ?? raw.conversation_count ?? 0,
      narrative: raw.narrative ?? null,
    };
  }

  return {
    async listRuns(): Promise<Run[]> {
      return (runsJson.runs ?? []).map(mapRun);
    },

    async getRun(id: string): Promise<RunDetail> {
      const rawRun = (runsJson.runs ?? []).find((r: any) => r.run_id === id);
      if (!rawRun) throw new Error(`Run not found: ${id}`);

      // Find manifest for this run
      const manifestKey = Object.keys(runDataDir).find(k =>
        k.includes(`run-${rawRun.run_number}`) && k.includes('manifest')
      );
      const manifest = manifestKey ? runDataDir[manifestKey] : {};

      // Find day files for this run
      const dayKeys = Object.keys(runDataDir).filter(k =>
        k.includes(`run-${rawRun.run_number}`) && !k.includes('manifest')
      );
      const dayFiles = dayKeys.map(k => runDataDir[k]).filter(Boolean);

      const agents = (manifest.agents_initial ?? manifest.initial_agents ?? []).map(mapAgent);
      const days = dayFiles.map(mapDay).sort((a: any, b: any) => a.sim_day - b.sim_day);

      // Deduplicate days by sim_day (multiple shards per day -> one entry)
      const dayMap = new Map<number, import('./types.js').DaySummary>();
      for (const d of days) {
        const existing = dayMap.get(d.sim_day);
        if (!existing) {
          dayMap.set(d.sim_day, d);
        } else {
          // Merge: widen tick range, sum counts
          existing.tick_range = [
            Math.min(existing.tick_range[0], d.tick_range[0]),
            Math.max(existing.tick_range[1], d.tick_range[1]),
          ];
          existing.decision_count += d.decision_count;
          existing.conversation_count += d.conversation_count;
          if (!existing.narrative && d.narrative) existing.narrative = d.narrative;
        }
      }

      return {
        ...mapRun(rawRun),
        agents,
        days: Array.from(dayMap.values()).sort((a, b) => a.sim_day - b.sim_day),
        relationships: manifest.relationships ?? [],
      };
    },

    async getDay(runId: string, day: number): Promise<DayDetail> {
      const rawRun = (runsJson.runs ?? []).find((r: any) => r.run_id === runId);
      if (!rawRun) throw new Error(`Run not found: ${runId}`);

      // Collect all shard files for this day
      const dayKeys = Object.keys(runDataDir).filter(k =>
        k.includes(`run-${rawRun.run_number}`) && !k.includes('manifest')
      );
      const shards = dayKeys
        .map(k => runDataDir[k])
        .filter((d: any) => d && d.sim_day === day);

      if (shards.length === 0) throw new Error(`Day ${day} not found in run ${runId}`);

      // Merge shards into one DayDetail
      const events: import('./types.js').ActivityEvent[] = [];
      const conversations: import('./types.js').Conversation[] = [];
      const needStates: import('./types.js').AgentNeedSnapshot[] = [];
      let tickStart = Infinity;
      let tickEnd = -Infinity;
      let stats = { decisions: 0, conversations: 0, crafts_attempted: 0, rest_events: 0 };

      for (const shard of shards) {
        const tr = normalizeTickRange(shard.tick_range);
        tickStart = Math.min(tickStart, tr[0]);
        tickEnd = Math.max(tickEnd, tr[1]);
        stats.decisions += shard.stats?.decisions_today ?? 0;
        stats.conversations += shard.stats?.conversations_today ?? 0;
        stats.crafts_attempted += shard.stats?.crafts_attempted ?? 0;
        stats.rest_events += shard.stats?.rest_events ?? 0;

        if (shard.events) events.push(...shard.events);
        if (shard.conversations) conversations.push(...shard.conversations);
        if (shard.agent_states) {
          for (const agent of shard.agent_states) {
            needStates.push({
              agent_name: agent.name,
              needs: filterInternalNeeds(
                (agent.needs ?? []).map((n: any) => ({
                  label: formatNeedLabel(n.label ?? n.sub_need ?? n.key),
                  value: n.current_value ?? n.value ?? 0,
                  max: n.max ?? 5,
                }))
              ),
            });
          }
        }
      }

      return {
        sim_day: day,
        tick_range: [tickStart, tickEnd],
        stats,
        events: events.sort((a, b) => a.tick - b.tick),
        conversations,
        need_states: needStates,
      };
    },

    async getAgent(runId: string, name: string): Promise<AgentProfile> {
      const run = await this.getRun(runId);
      const agent = run.agents.find(a => a.name.toLowerCase() === name.toLowerCase());
      if (!agent) throw new Error(`Agent ${name} not found in run ${runId}`);

      // Collect agent-specific data from day files
      const rawRun = (runsJson.runs ?? []).find((r: any) => r.run_id === runId);
      const dayKeys = Object.keys(runDataDir).filter(k =>
        k.includes(`run-${rawRun.run_number}`) && !k.includes('manifest')
      );
      const allShards = dayKeys.map(k => runDataDir[k]).filter(Boolean);

      const decisions: import('./types.js').ActivityEvent[] = [];
      const journalEntries: import('./types.js').JournalEntry[] = [];
      let totalConversations = 0;
      let memoriesFormed = 0;

      for (const shard of allShards) {
        if (shard.events) {
          decisions.push(
            ...shard.events.filter((e: any) => e.agent_name === agent.name)
          );
        }
        if (shard.journals) {
          journalEntries.push(
            ...shard.journals
              .filter((j: any) => j.agent_name === agent.name)
              .map((j: any) => ({ sim_day: shard.sim_day, text: j.text }))
          );
        }
        if (shard.conversations) {
          totalConversations += shard.conversations.filter(
            (c: any) => c.participants?.includes(agent.name)
          ).length;
        }
        if (shard.memories) {
          memoriesFormed += shard.memories.filter(
            (m: any) => m.agent_name === agent.name
          ).length;
        }
      }

      const agentRelationships = run.relationships.filter(
        r => r.agent_a === agent.name || r.agent_b === agent.name
      );

      return {
        ...agent,
        stats: {
          total_decisions: decisions.length,
          total_conversations: totalConversations,
          memories_formed: memoriesFormed,
        },
        journal_entries: journalEntries,
        relationships: agentRelationships,
        decisions: decisions.sort((a, b) => a.tick - b.tick),
      };
    },

    async getRelationships(runId: string): Promise<Relationship[]> {
      const run = await this.getRun(runId);
      return run.relationships;
    },
  };
}
