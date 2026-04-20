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
  DispatchSummary,
  AgentDashboardRow,
} from './types.js';
import {
  normalizeTickRange,
  normalizePersonality,
  normalizeStatus,
  filterInternalNeeds,
} from '../utils/normalize.js';
import { formatNeedLabel } from '../utils/format.js';
import { isEndedRun } from '../utils/library.js';

interface JsonLoaderConfig {
  runsJson: any;                          // Contents of runs.json
  runDataDir: Record<string, any>;        // run-N/manifest.json + day files keyed by path
}

export function createJsonLoader(config: JsonLoaderConfig): DataLoader {
  const { runsJson, runDataDir } = config;

  function normalizeModelConfig(raw: any): ModelConfig {
    // Accept strings, objects missing `.routes`, or null/undefined; always return a valid ModelConfig.
    if (!raw) {
      return { routes: {}, fallback: { provider: '', model: '' } };
    }
    if (typeof raw === 'string') {
      // String form like "claude-cli:claude-haiku-4-5-20251001"
      const [providerRaw, ...modelParts] = raw.split(':');
      const model = modelParts.length > 0 ? modelParts.join(':') : raw;
      const provider = modelParts.length > 0 ? providerRaw : '';
      return {
        routes: {},
        fallback: { provider, model },
      };
    }
    if (typeof raw === 'object') {
      return {
        routes: raw.routes && typeof raw.routes === 'object' ? raw.routes : {},
        fallback: raw.fallback && typeof raw.fallback === 'object'
          ? { provider: raw.fallback.provider ?? '', model: raw.fallback.model ?? '' }
          : { provider: '', model: '' },
      };
    }
    return { routes: {}, fallback: { provider: '', model: '' } };
  }

  // EMU-5 T3: warn exactly once per orphan run_number per loader instance.
  // runs.json may reference run_numbers with no on-disk manifest (pipeline
  // drift, e.g. runs 19-22, 25 at time of DC-14).  We filter those out at
  // the loader layer so Hub and getStaticPaths both benefit, and log so
  // drift is observable without spamming the build output.
  const warnedOrphans = new Set<number>();

  // Locate a run's manifest object by run_number.  Returns undefined (NOT
  // an empty object) when no manifest key exists in runDataDir -- used by
  // the orphan filter.  getRun's existing behaviour (fallback to {}) is
  // preserved by callers that want it.
  function findManifest(runNumber: number): any | undefined {
    const manifestKey = Object.keys(runDataDir).find(k =>
      k.includes(`run-${runNumber}`) && k.includes('manifest')
    );
    if (!manifestKey) return undefined;
    return runDataDir[manifestKey];
  }

  // EMU-5 T1: merge manifest values over runs.json row so RunCard + any
  // listing-level consumer shows real tick_count / sim_days instead of 0.
  // runs.json tick_count / sim_days frequently lag the manifest (pipeline
  // only writes them on run end), so when runs.json says 0 or missing we
  // fall back to the manifest-derived value.  Mirrors getRun's derivation
  // (total_ticks + config_snapshot.clock.ticks_per_day).
  function mapRunWithManifest(raw: any): Run {
    const base = mapRun(raw);
    const manifest = findManifest(raw.run_number);
    if (!manifest) return base;

    const manifestTickCount = manifest.total_ticks ?? 0;
    const ticksPerDay = manifest.config_snapshot?.clock?.ticks_per_day ?? 100;
    const tickCount = base.tick_count || manifestTickCount;
    const simDays = base.sim_days || (tickCount
      ? parseFloat((tickCount / ticksPerDay).toFixed(1))
      : 0);

    return {
      ...base,
      // EMU-14: manifest.status wins over runs.json status.  runs.json rows
      // are not rewritten on pause (pipeline only updates numeric totals on
      // run end), so the manifest is the fresh source for lifecycle status.
      // Fall back to base.status (already normalized) when manifest lacks it.
      status: manifest.status ? normalizeStatus(manifest.status) : base.status,
      tick_count: tickCount,
      sim_days: simDays,
      agent_count: base.agent_count || (manifest.agents_initial ?? manifest.initial_agents ?? []).length,
      prng_seed: base.prng_seed || (manifest.config_snapshot?.seed ?? 0),
      wall_clock_ms: base.wall_clock_ms || (manifest.wall_clock_ms ?? 0),
    };
  }

  function mapRun(raw: any): Run {
    // ended_at: preserve null vs undefined distinction.  Legacy fixtures omit the field
    // entirely (undefined), which listActiveRuns treats as active.  Supabase export
    // sets the column to null while running and an ISO string when ended.
    const endedAt = raw.ended_at === undefined ? undefined : raw.ended_at;
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
      model_config: normalizeModelConfig(raw.model_config),
      summary: raw.summary ?? '',
      created_at: raw.created_at ?? '',
      ended_at: endedAt,
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

  function mapConversation(raw: any): import('./types.js').Conversation {
    const participants = (raw.participants ?? []).map((p: any) =>
      typeof p === 'string' ? p : p.name ?? ''
    );
    const turns = (raw.turns ?? []).map((t: any) => ({
      speaker: t.speaker ?? t.speaker_name ?? '',
      text: t.text ?? t.content ?? '',
    }));
    return {
      id: raw.id ?? raw.conversation_id ?? '',
      participants,
      turns,
      end_reason: raw.end_reason ?? '',
      relationship_changes: (raw.relationship_changes ?? []).map((rc: any) => ({
        agent_a: rc.agent_a ?? '',
        agent_b: rc.agent_b ?? '',
        old_type: rc.old_type ?? '',
        new_type: rc.new_type ?? '',
        old_score: rc.old_score ?? 0,
        new_score: rc.new_score ?? 0,
      })),
    };
  }

  return {
    async listRuns(): Promise<Run[]> {
      // EMU-5 T3: drop runs with no on-disk manifest (orphans from runs.json
      // drift).  Warn exactly once per orphan per process so the issue stays
      // observable.  EMU-5 T1: merged-manifest mapper fills tick_count /
      // sim_days from manifest when runs.json row is stale.
      const raw = (runsJson.runs ?? []) as any[];
      const kept: Run[] = [];
      for (const r of raw) {
        if (!findManifest(r.run_number)) {
          if (!warnedOrphans.has(r.run_number)) {
            warnedOrphans.add(r.run_number);
            // eslint-disable-next-line no-console
            console.warn(
              `[emergence-ui] runs.json references run_number ${r.run_number} but no manifest found; filtering from listing.`
            );
          }
          continue;
        }
        kept.push(mapRunWithManifest(r));
      }
      return kept.sort((a, b) => b.run_number - a.run_number);
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

      // EMU-13 T3: stat block must reflect persisted totals.  runs.json
      // frequently reports tick_count=0 for paused/mid-flight runs (pipeline
      // only writes it on run end), so fall back to manifest.total_ticks
      // using || (falsy-fallback) rather than ?? (null-only).  Mirrors
      // mapRunWithManifest's listing-level derivation so RunDetail's header
      // and RunCard's subtitle agree for paused runs with persisted ticks.
      const ticksPerDay = manifest.config_snapshot?.clock?.ticks_per_day ?? 100;
      const tickCount = rawRun.tick_count || manifest.total_ticks || 0;
      const agentCount = rawRun.agent_count || agents.length;
      const agentsAlive = rawRun.agents_alive || agents.filter((a: any) => a.is_alive).length;

      // Aggregate relationships from shard data
      const relationshipMap = new Map<string, any>();
      for (const df of dayFiles) {
        if (df.relationships) {
          for (const r of df.relationships) {
            const key = [r.agent_name, r.target_name].sort().join('::');
            relationshipMap.set(key, {
              agent_a: r.agent_name,
              agent_b: r.target_name,
              type: r.status ?? r.type ?? 'acquaintance',
              score: r.impression_score ?? r.score ?? 0,
            });
          }
        }
      }

      const base = mapRun(rawRun);
      return {
        ...base,
        // EMU-14: manifest.status wins over runs.json status (mirrors
        // mapRunWithManifest).  Keeps RunDetail's header badge in sync with
        // RunCard's badge for paused runs whose runs.json row still says
        // "running".
        status: manifest.status ? normalizeStatus(manifest.status) : base.status,
        tick_count: base.tick_count || tickCount,
        sim_days: base.sim_days || parseFloat((tickCount / ticksPerDay).toFixed(1)),
        agent_count: base.agent_count || agentCount,
        agents_alive: base.agents_alive || agentsAlive,
        prng_seed: base.prng_seed || (manifest.config_snapshot?.seed ?? 0),
        wall_clock_ms: base.wall_clock_ms || (manifest.wall_clock_ms ?? 0),
        model_config: Object.keys(base.model_config.routes).length > 0
          ? base.model_config
          : normalizeModelConfig(manifest.config_snapshot?.llm ?? base.model_config),
        agents,
        days: Array.from(dayMap.values()).sort((a, b) => a.sim_day - b.sim_day),
        relationships: Array.from(relationshipMap.values()),
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
      let narrative: string | null = null;

      for (const shard of shards) {
        // First non-null narrative wins (matches getRun dayMap merge pattern).
        if (!narrative && shard.narrative) narrative = shard.narrative;
        const tr = normalizeTickRange(shard.tick_range);
        tickStart = Math.min(tickStart, tr[0]);
        tickEnd = Math.max(tickEnd, tr[1]);
        stats.decisions += shard.stats?.decisions_today ?? shard.stats?.total_actions ?? 0;
        stats.conversations += shard.stats?.conversations_today ?? shard.stats?.conversations ?? 0;
        stats.crafts_attempted += shard.stats?.crafts_attempted ?? 0;
        stats.rest_events += shard.stats?.rest_events ?? 0;

        if (shard.actions_summary) {
          for (const agentSummary of shard.actions_summary) {
            if (agentSummary?.actions) {
              events.push(
                ...agentSummary.actions.map((a: any) => ({
                  tick: a.tick,
                  action_type: a.action_type,
                  target: a.target ?? '',
                  outcome: a.outcome ?? '',
                  agent_name: agentSummary.agent_name,
                }))
              );
            }
          }
        } else if (shard.events) {
          events.push(...shard.events);
        }
        if (shard.conversations) conversations.push(...shard.conversations.map(mapConversation));
        const agentStates = shard.agent_states ?? shard.agents;
        if (agentStates) {
          for (const agent of agentStates) {
            const rawNeeds = agent.needs ?? {};
            const needsArray = Array.isArray(rawNeeds)
              ? rawNeeds.map((n: any) => ({ label: n.label ?? n.name ?? '', value: n.value ?? 0, max: n.max ?? 5 }))
              : Object.entries(rawNeeds).map(([label, value]) => ({ label, value: value as number, max: 5 }));
            needStates.push({
              agent_name: agent.name,
              needs: filterInternalNeeds(needsArray),
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
        narrative,
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
        if (shard.actions_summary) {
          const agentSummary = shard.actions_summary.find((a: any) => a.agent_name === agent.name);
          if (agentSummary?.actions) {
            decisions.push(
              ...agentSummary.actions.map((a: any) => ({
                tick: a.tick,
                action_type: a.action_type,
                target: a.target ?? '',
                outcome: a.outcome ?? '',
                agent_name: agent.name,
              }))
            );
          }
        } else if (shard.events) {
          decisions.push(
            ...shard.events.filter((e: any) => e.agent_name === agent.name)
          );
        }
        if (shard.journals) {
          journalEntries.push(
            ...shard.journals
              .filter((j: any) => j.agent_name === agent.name)
              .map((j: any) => ({ sim_day: shard.sim_day, text: j.text ?? j.content ?? '' }))
          );
        }
        if (shard.conversations) {
          totalConversations += shard.conversations.filter(
            (c: any) => (c.participants ?? []).some((p: any) =>
              (typeof p === 'string' ? p : p.name) === agent.name
            )
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

    async listActiveRuns(): Promise<Run[]> {
      // Active = running OR paused (EMU-13 T2, BL-231).  Classification is
      // status-based via isEndedRun; paused runs stay in the active tier so
      // the operator can resume them from NowRunning.  Shares the predicate
      // with RunCard so no consumer can see a run classified differently
      // from another.  Orphan filter is applied by listRuns.
      const all = await this.listRuns();
      return all.filter(r => !isEndedRun(r));
    },

    async listEndedRuns(): Promise<Run[]> {
      // Ended = status in {ended, completed, aborted, crashed} (EMU-13 T2,
      // BL-231).  Single source of truth is isEndedRun in utils/library.ts;
      // RunCard badge reads the same predicate.  ended_at is no longer the
      // classifier (pipeline writes it on any non-running transition).
      // Orphan filter is applied by listRuns.
      const all = await this.listRuns();
      return all.filter(isEndedRun);
    },

    async getActiveRunDashboard(runId: string): Promise<DispatchSummary | null> {
      const rawRun = (runsJson.runs ?? []).find((r: any) => r.run_id === runId);
      if (!rawRun) throw new Error(`Run not found: ${runId}`);

      // Gather all day shards for this run.
      const dayKeys = Object.keys(runDataDir).filter(k =>
        k.includes(`run-${rawRun.run_number}`) && !k.includes('manifest')
      );
      const shards = dayKeys.map(k => runDataDir[k]).filter(Boolean);
      if (shards.length === 0) return null;

      // Normalize each shard's tick_range upfront.
      const normShards = shards.map((s: any) => ({
        raw: s,
        tick_range: normalizeTickRange(s.tick_range),
      }));

      // Highest tick across all shards defines the window end.
      const highestTick = normShards.reduce(
        (max, s) => Math.max(max, s.tick_range[1]),
        -Infinity
      );
      if (!Number.isFinite(highestTick)) return null;

      const windowEnd = highestTick;
      const windowStart = Math.max(0, highestTick - 20);

      // A shard overlaps the window if its tick_range intersects [windowStart, windowEnd].
      const inWindowShards = normShards.filter(
        s => s.tick_range[1] >= windowStart && s.tick_range[0] <= windowEnd
      );

      // Sum conversation counts across in-window shards.  Use stats.conversations_today
      // when present (matches getDay's shard merge rules).
      let conversationCount = 0;
      for (const s of inWindowShards) {
        const stats = s.raw.stats ?? {};
        conversationCount += stats.conversations_today ?? stats.conversations ?? 0;
      }

      // Walk every shard's actions_summary and keep actions whose tick is inside the window.
      // Dedupe last_actions by agent_name, preferring the highest tick.
      let actionCount = 0;
      const latestByAgent = new Map<string, { tick: number; action_type: string; target: string | null }>();
      for (const s of normShards) {
        const summary = s.raw.actions_summary;
        if (!Array.isArray(summary)) continue;
        for (const agentSummary of summary) {
          const agentName = agentSummary?.agent_name;
          if (!agentName || !Array.isArray(agentSummary.actions)) continue;
          for (const action of agentSummary.actions) {
            if (typeof action.tick !== 'number') continue;
            if (action.tick < windowStart || action.tick > windowEnd) continue;
            actionCount += 1;
            const prior = latestByAgent.get(agentName);
            if (!prior || action.tick > prior.tick) {
              latestByAgent.set(agentName, {
                tick: action.tick,
                action_type: action.action_type ?? '',
                target: action.target ?? null,
              });
            }
          }
        }
      }

      const lastActions = Array.from(latestByAgent.entries()).map(([agent_name, a]) => ({
        agent_name,
        tick: a.tick,
        action_type: a.action_type,
        target: a.target,
      }));

      // Latest shard (highest tick_range[1]) supplies the current agent_states snapshot.
      const latestShard = normShards.reduce((best, s) =>
        s.tick_range[1] > best.tick_range[1] ? s : best
      );
      const latestAgentStates = latestShard.raw.agent_states ?? latestShard.raw.agents ?? [];

      const agentDashboard: AgentDashboardRow[] = [];
      for (const agent of latestAgentStates) {
        if (!agent?.name) continue;
        const rawNeeds = agent.needs ?? {};
        // Normalize needs into a lookup by label.
        const needLookup: Record<string, number> = {};
        if (Array.isArray(rawNeeds)) {
          for (const n of rawNeeds) {
            if (n?.label) needLookup[String(n.label).toLowerCase()] = Number(n.value ?? 0);
          }
        } else if (rawNeeds && typeof rawNeeds === 'object') {
          for (const [label, value] of Object.entries(rawNeeds)) {
            needLookup[String(label).toLowerCase()] = Number(value ?? 0);
          }
        }

        const rawLoc = agent.location;
        const location =
          rawLoc && typeof rawLoc.x === 'number' && typeof rawLoc.y === 'number'
            ? { x: rawLoc.x, y: rawLoc.y }
            : null;

        const latest = latestByAgent.get(agent.name);
        const latestAction = latest
          ? { tick: latest.tick, action_type: latest.action_type, target: latest.target }
          : null;

        agentDashboard.push({
          agent_name: agent.name,
          hunger: needLookup['hunger'] ?? 0,
          thirst: needLookup['thirst'] ?? 0,
          rest: needLookup['rest'] ?? 0,
          location,
          latest_action: latestAction,
        });
      }

      return {
        run_id: rawRun.run_id,
        run_number: rawRun.run_number,
        window_start_tick: windowStart,
        window_end_tick: windowEnd,
        conversation_count: conversationCount,
        action_count: actionCount,
        last_actions: lastActions,
        agent_dashboard: agentDashboard,
      };
    },
  };
}
