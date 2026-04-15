// data/__tests__/json-loader.test.ts
import { describe, it, expect } from 'vitest';
import { createJsonLoader } from '../json-loader.js';

import runsJson from './fixtures/runs.json';
import run1Manifest from './fixtures/run-1-manifest.json';
import run1Day0ShardA from './fixtures/run-1-day-0-shard-a.json';
import run1Day0ShardB from './fixtures/run-1-day-0-shard-b.json';
import run1Day1 from './fixtures/run-1-day-1.json';
import run2Manifest from './fixtures/run-2-manifest.json';
import run2Day0 from './fixtures/run-2-day-0.json';
import run3Manifest from './fixtures/run-3-active-manifest.json';
import run3Day0 from './fixtures/run-3-active-day-0.json';
import run3Day1ShardA from './fixtures/run-3-active-day-1-shard-a.json';
import run3Day1ShardB from './fixtures/run-3-active-day-1-shard-b.json';

// Standard runDataDir keyed by paths the loader would receive from import.meta.glob.
const runDataDir = {
  'run-1/manifest.json': run1Manifest,
  'run-1/day-0-shard-a.json': run1Day0ShardA,
  'run-1/day-0-shard-b.json': run1Day0ShardB,
  'run-1/day-1.json': run1Day1,
  'run-2/manifest.json': run2Manifest,
  'run-2/day-0.json': run2Day0,
  'run-3/manifest.json': run3Manifest,
  'run-3/day-0.json': run3Day0,
  'run-3/day-1-shard-a.json': run3Day1ShardA,
  'run-3/day-1-shard-b.json': run3Day1ShardB,
};

function makeLoader(overrides: Partial<{ runsJson: any; runDataDir: Record<string, any> }> = {}) {
  return createJsonLoader({
    runsJson: overrides.runsJson ?? runsJson,
    runDataDir: overrides.runDataDir ?? runDataDir,
  });
}

// Legacy mock kept from the original test for the listRuns assertion.
const mockRunsJson = {
  runs: [
    {
      run_id: 'bcf25057-2c03-4e70-b147-169a95383f61',
      run_number: 19,
      name: 'Haiku 4.5 Evaluation',
      status: 'completed',
      tick_count: 272,
      agent_count: 7,
      agents_alive: 7,
      seed: 42,
      wall_clock_ms: 32640000,
      sim_days: 2.72,
      summary: 'First Haiku evaluation run.',
      created_at: '2026-04-11T23:47:00Z',
    },
  ],
};

describe('createJsonLoader', () => {
  describe('listRuns', () => {
    it('listRuns returns typed Run array', async () => {
      const loader = createJsonLoader({ runsJson: mockRunsJson, runDataDir: {} });
      const runs = await loader.listRuns();
      expect(runs).toHaveLength(1);
      expect(runs[0].id).toBe('bcf25057-2c03-4e70-b147-169a95383f61');
      expect(runs[0].status).toBe('completed');
      expect(runs[0].prng_seed).toBe(42);
    });

    it('sorts runs by run_number descending', async () => {
      const loader = makeLoader();
      const runs = await loader.listRuns();
      expect(runs).toHaveLength(3);
      expect(runs[0].run_number).toBe(3);
      expect(runs[1].run_number).toBe(2);
      expect(runs[2].run_number).toBe(1);
    });

    it('returns empty array when runsJson has no runs', async () => {
      const loader = createJsonLoader({ runsJson: {}, runDataDir: {} });
      const runs = await loader.listRuns();
      expect(runs).toEqual([]);
    });
  });

  describe('getRun', () => {
    it('happy path -- returns RunDetail with agents, days, relationships', async () => {
      const loader = makeLoader();
      const run = await loader.getRun('test-run-001');
      expect(run.id).toBe('test-run-001');
      expect(run.run_number).toBe(1);
      expect(run.agents).toHaveLength(2);
      expect(run.agents.map(a => a.name).sort()).toEqual(['Alice', 'Bob']);
      // Two days exported -- day 0 (deduped from two shards) + day 1.
      expect(run.days).toHaveLength(2);
      expect(run.days[0].sim_day).toBe(0);
      expect(run.days[1].sim_day).toBe(1);
      expect(run.relationships).toHaveLength(1);
    });

    it('day deduplication merges shards and widens tick range + sums counts', async () => {
      const loader = makeLoader();
      const run = await loader.getRun('test-run-001');
      const day0 = run.days.find(d => d.sim_day === 0)!;
      // Shard A tick_range [0,49] + shard B {start:50,end:99} -> [0,99]
      expect(day0.tick_range).toEqual([0, 99]);
      // decisions_today: 4 (shard A) + 2 (shard B) = 6
      expect(day0.decision_count).toBe(6);
      // conversations_today: 1 + 0 = 1
      expect(day0.conversation_count).toBe(1);
      // Narrative present on shard A; shard B had none -- existing narrative kept.
      expect(day0.narrative).toBe('Day 0 shard A narrative.');
    });

    it('aggregates relationships from shard data into normalized shape', async () => {
      const loader = makeLoader();
      const run = await loader.getRun('test-run-001');
      const rel = run.relationships[0];
      expect(rel.agent_a).toBe('Alice');
      expect(rel.agent_b).toBe('Bob');
      expect(rel.type).toBe('acquaintance');
      // Last-write-wins: shard B overwrites shard A's score=1 with score=2.
      expect(rel.score).toBe(2);
    });

    it('derives tick_count, sim_days, prng_seed from manifest when runs.json omits them', async () => {
      const lean = {
        runs: [
          {
            run_id: 'lean-001',
            run_number: 5,
            status: 'completed',
            // tick_count, sim_days, seed intentionally omitted -- loader falls back to manifest.
          },
        ],
      };
      const dir = {
        'run-5/manifest.json': {
          total_ticks: 250,
          config_snapshot: { clock: { ticks_per_day: 100 }, seed: 7 },
          agents_initial: [],
        },
      };
      const loader = createJsonLoader({ runsJson: lean, runDataDir: dir });
      const run = await loader.getRun('lean-001');
      expect(run.tick_count).toBe(250);
      expect(run.sim_days).toBeCloseTo(2.5);
      expect(run.prng_seed).toBe(7);
    });

    it('throws when run id is missing', async () => {
      const loader = makeLoader();
      await expect(loader.getRun('does-not-exist')).rejects.toThrow(/Run not found/);
    });

    it('handles corrupt manifest (missing fields) without throwing', async () => {
      // runs.json has tick_count + seed for test-run-001 so those carry through;
      // manifest is empty so agents_initial / config_snapshot fallbacks must not crash.
      const dir = {
        'run-1/manifest.json': {}, // empty manifest -- no agents, no config_snapshot
        'run-1/day-0.json': run1Day1,
      };
      const loader = createJsonLoader({ runsJson, runDataDir: dir });
      const run = await loader.getRun('test-run-001');
      expect(run.agents).toEqual([]);
      expect(run.days).toHaveLength(1);
      // prng_seed comes from runs.json (1337) -- empty manifest doesn't override.
      expect(run.prng_seed).toBe(1337);
      // model_config falls back to default empty routes when manifest lacks llm config.
      expect(run.model_config).toBeDefined();
    });

    it('falls back to mapRun default when manifest also lacks seed', async () => {
      const lean = {
        runs: [
          {
            run_id: 'noseed-001',
            run_number: 7,
            status: 'completed',
          },
        ],
      };
      const dir = {
        'run-7/manifest.json': { agents_initial: [] }, // no config_snapshot at all
      };
      const loader = createJsonLoader({ runsJson: lean, runDataDir: dir });
      const run = await loader.getRun('noseed-001');
      expect(run.prng_seed).toBe(0);
    });
  });

  describe('getDay', () => {
    it('happy path -- returns DayDetail with events, conversations, need_states', async () => {
      const loader = makeLoader();
      const day = await loader.getDay('test-run-001', 1);
      expect(day.sim_day).toBe(1);
      expect(day.tick_range).toEqual([100, 199]);
      expect(day.events).toHaveLength(2);
      expect(day.events[0].tick).toBe(110);
      expect(day.events[0].agent_name).toBe('Alice');
      expect(day.conversations).toEqual([]);
      expect(day.need_states).toHaveLength(2);
    });

    it('shard merging -- combines actions_summary, stats, tick_range across shards', async () => {
      const loader = makeLoader();
      const day = await loader.getDay('test-run-001', 0);
      // Tick range widened across shards.
      expect(day.tick_range).toEqual([0, 99]);
      // Stats summed: decisions 4+2=6, conversations 1+0=1, crafts 1+0=1, rest 0+1=1.
      expect(day.stats.decisions).toBe(6);
      expect(day.stats.conversations).toBe(1);
      expect(day.stats.crafts_attempted).toBe(1);
      expect(day.stats.rest_events).toBe(1);
    });

    it('actions_summary is flattened into ActivityEvent[] with agent_name attached (BL-201)', async () => {
      const loader = makeLoader();
      const day = await loader.getDay('test-run-001', 0);
      // Shard A: Alice 2 actions + Bob 2 actions = 4. Shard B: Alice 1 action. Total = 5.
      expect(day.events).toHaveLength(5);
      // Sorted ascending by tick.
      const ticks = day.events.map(e => e.tick);
      expect(ticks).toEqual([...ticks].sort((a, b) => a - b));
      // Each event carries agent_name from its parent agentSummary.
      const aliceEvents = day.events.filter(e => e.agent_name === 'Alice');
      const bobEvents = day.events.filter(e => e.agent_name === 'Bob');
      expect(aliceEvents).toHaveLength(3);
      expect(bobEvents).toHaveLength(2);
      // Outcome + action_type preserved.
      const craftEvent = day.events.find(e => e.action_type === 'craft');
      expect(craftEvent?.outcome).toBe('failed');
      expect(craftEvent?.target).toBe('spear');
    });

    it('filters internal needs (composite_modifier) and normalizes both object + array shapes', async () => {
      const loader = makeLoader();
      const day = await loader.getDay('test-run-001', 0);
      const alice = day.need_states.find(n => n.agent_name === 'Alice')!;
      // Needs object -> array; composite_modifier filtered out.
      expect(alice.needs.map(n => n.label).sort()).toEqual(['Hunger', 'Thirst']);
      const bob = day.need_states.find(n => n.agent_name === 'Bob')!;
      // Needs array shape preserved.
      expect(bob.needs.map(n => n.label).sort()).toEqual(['Hunger', 'Thirst']);
    });

    it('conversations are mapped through mapConversation', async () => {
      const loader = makeLoader();
      const day = await loader.getDay('test-run-001', 0);
      expect(day.conversations).toHaveLength(1);
      const conv = day.conversations[0];
      expect(conv.id).toBe('conv-001');
      expect(conv.participants).toEqual(['Alice', 'Bob']);
      expect(conv.turns).toHaveLength(2);
      expect(conv.relationship_changes).toHaveLength(1);
    });

    it('throws when day not exported', async () => {
      const loader = makeLoader();
      await expect(loader.getDay('test-run-001', 99)).rejects.toThrow(/Day 99 not found/);
    });

    it('throws when run id is missing', async () => {
      const loader = makeLoader();
      await expect(loader.getDay('nope', 0)).rejects.toThrow(/Run not found/);
    });
  });

  describe('getAgent', () => {
    it('happy path -- returns AgentProfile with stats, journal, decisions, relationships', async () => {
      const loader = makeLoader();
      const agent = await loader.getAgent('test-run-001', 'Alice');
      expect(agent.name).toBe('Alice');
      expect(agent.skills).toEqual(['Healing', 'Foraging']);
      expect(agent.backstory).toBe('A quiet healer who prefers solitude.');
      // Decisions: shard A (2) + shard B (1) + day 1 events filtered (1) = 4.
      expect(agent.stats.total_decisions).toBe(4);
      // One conversation with Alice as participant on day 0.
      expect(agent.stats.total_conversations).toBe(1);
      expect(agent.stats.memories_formed).toBe(1);
      expect(agent.journal_entries).toHaveLength(1);
      expect(agent.journal_entries[0].text).toBe('Found some berries today.');
      // Decisions sorted by tick ascending.
      const ticks = agent.decisions.map(d => d.tick);
      expect(ticks).toEqual([...ticks].sort((a, b) => a - b));
    });

    it('case-insensitive agent name lookup', async () => {
      const loader = makeLoader();
      const agent = await loader.getAgent('test-run-001', 'aLiCe');
      expect(agent.name).toBe('Alice');
    });

    it('agent with no journal/memories returns empty arrays (not undefined)', async () => {
      const lean = {
        runs: [
          {
            run_id: 'solo-001',
            run_number: 9,
            status: 'completed',
          },
        ],
      };
      const dir = {
        'run-9/manifest.json': {
          agents_initial: [
            {
              name: 'Solo',
              skills: [],
              personality_summary: 'Alone.',
              health_pct: 100,
              is_alive: true,
            },
          ],
        },
        'run-9/day-0.json': {
          sim_day: 0,
          tick_range: [0, 99],
          stats: {},
        },
      };
      const loader = createJsonLoader({ runsJson: lean, runDataDir: dir });
      const agent = await loader.getAgent('solo-001', 'Solo');
      expect(agent.journal_entries).toEqual([]);
      expect(agent.decisions).toEqual([]);
      expect(agent.relationships).toEqual([]);
      expect(agent.stats.total_decisions).toBe(0);
      expect(agent.stats.total_conversations).toBe(0);
      expect(agent.stats.memories_formed).toBe(0);
    });

    it('agent relationships filter contains only relationships involving the agent', async () => {
      const loader = makeLoader();
      const agent = await loader.getAgent('test-run-001', 'Bob');
      expect(agent.relationships).toHaveLength(1);
      expect(
        agent.relationships[0].agent_a === 'Bob' || agent.relationships[0].agent_b === 'Bob'
      ).toBe(true);
    });

    it('throws when agent not found in run', async () => {
      const loader = makeLoader();
      await expect(loader.getAgent('test-run-001', 'NoSuchAgent')).rejects.toThrow(
        /Agent NoSuchAgent not found/
      );
    });
  });

  describe('getRelationships', () => {
    it('happy path -- returns normalized Relationship[] from run shard data', async () => {
      const loader = makeLoader();
      const rels = await loader.getRelationships('test-run-001');
      expect(rels).toHaveLength(1);
      expect(rels[0]).toMatchObject({
        agent_a: 'Alice',
        agent_b: 'Bob',
        type: 'acquaintance',
      });
      expect(typeof rels[0].score).toBe('number');
    });

    it('legacy {agent_name, target_name, status, impression_score} shape is normalized', async () => {
      const loader = makeLoader();
      const rels = await loader.getRelationships('test-run-002');
      expect(rels).toHaveLength(1);
      // Legacy fields mapped: agent_name -> agent_a, target_name -> agent_b,
      // status -> type, impression_score -> score.
      expect(rels[0].agent_a).toBe('Cara');
      expect(rels[0].agent_b).toBe('Dan');
      expect(rels[0].type).toBe('rival');
      expect(rels[0].score).toBe(-2);
    });

    it('returns empty array when run has no relationships in any shard', async () => {
      const lean = {
        runs: [{ run_id: 'empty-001', run_number: 11, status: 'completed' }],
      };
      const dir = {
        'run-11/manifest.json': { agents_initial: [] },
        'run-11/day-0.json': { sim_day: 0, tick_range: [0, 99] },
      };
      const loader = createJsonLoader({ runsJson: lean, runDataDir: dir });
      const rels = await loader.getRelationships('empty-001');
      expect(rels).toEqual([]);
    });

    it('throws when run id is missing', async () => {
      const loader = makeLoader();
      await expect(loader.getRelationships('does-not-exist')).rejects.toThrow(/Run not found/);
    });
  });
});
