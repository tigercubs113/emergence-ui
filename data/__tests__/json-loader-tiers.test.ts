// data/__tests__/json-loader-tiers.test.ts
// Covers Task 5 loader additions: listActiveRuns, listEndedRuns, getActiveRunDashboard.
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

function makeLoader() {
  return createJsonLoader({ runsJson, runDataDir });
}

describe('reporting tiers', () => {
  describe('listActiveRuns', () => {
    it('returns only runs with ended_at == null', async () => {
      const loader = makeLoader();
      const active = await loader.listActiveRuns();
      expect(active).toHaveLength(1);
      expect(active[0].id).toBe('test-run-003');
      expect(active[0].ended_at).toBeNull();
    });

    it('returns empty array when runsJson has no runs', async () => {
      const loader = createJsonLoader({ runsJson: {}, runDataDir: {} });
      const active = await loader.listActiveRuns();
      expect(active).toEqual([]);
    });

    it('treats undefined ended_at as active (legacy fixture compatibility)', async () => {
      const legacy = {
        runs: [
          { run_id: 'legacy-1', run_number: 1, status: 'running' },
          { run_id: 'legacy-2', run_number: 2, status: 'completed', ended_at: '2026-04-10T00:00:00Z' },
        ],
      };
      // EMU-5 T3: orphan filter requires a manifest per run_number.
      const loader = createJsonLoader({
        runsJson: legacy,
        runDataDir: {
          'run-1/manifest.json': {},
          'run-2/manifest.json': {},
        },
      });
      const active = await loader.listActiveRuns();
      expect(active).toHaveLength(1);
      expect(active[0].id).toBe('legacy-1');
    });

    // EMU-13 T2 (BL-231): paused runs stay in the active tier regardless of
    // whether ended_at is present (pipeline writes ended_at on pause too).
    // This test documents the paused coexistence contract against the loader.
    it('paused run appears in listActiveRuns (even with ended_at set)', async () => {
      const runsRow = {
        runs: [
          {
            run_id: 'paused-1',
            run_number: 1,
            status: 'paused',
            // ended_at deliberately present -- simulates EMU-12 pipeline bug.
            ended_at: '2026-04-14T06:00:00Z',
          },
          {
            run_id: 'ended-1',
            run_number: 2,
            status: 'ended',
            ended_at: '2026-04-14T07:00:00Z',
          },
        ],
      };
      const loader = createJsonLoader({
        runsJson: runsRow,
        runDataDir: {
          'run-1/manifest.json': {},
          'run-2/manifest.json': {},
        },
      });
      const active = await loader.listActiveRuns();
      expect(active).toHaveLength(1);
      expect(active[0].id).toBe('paused-1');
      expect(active[0].status).toBe('paused');
    });
  });

  describe('listEndedRuns', () => {
    it('returns only runs with ended_at set to a non-empty string', async () => {
      const loader = makeLoader();
      const ended = await loader.listEndedRuns();
      expect(ended).toHaveLength(2);
      const ids = ended.map(r => r.id).sort();
      expect(ids).toEqual(['test-run-001', 'test-run-002']);
    });

    it('returns empty array when runsJson has no ended runs', async () => {
      const onlyActive = {
        runs: [{ run_id: 'a-1', run_number: 1, status: 'running', ended_at: null }],
      };
      const loader = createJsonLoader({ runsJson: onlyActive, runDataDir: {} });
      const ended = await loader.listEndedRuns();
      expect(ended).toEqual([]);
    });

    it('sorts ended runs by run_number descending', async () => {
      const loader = makeLoader();
      const ended = await loader.listEndedRuns();
      expect(ended[0].run_number).toBe(2);
      expect(ended[1].run_number).toBe(1);
    });

    // EMU-13 T2 (BL-231): status-based classification.  All four terminal
    // statuses {ended, completed, aborted, crashed} must appear in the ended
    // tier and none in the active tier.  Paused + running stay active.
    it('classifies each terminal status into listEndedRuns and neither running/paused', async () => {
      const runsRow = {
        runs: [
          { run_id: 'r-run', run_number: 1, status: 'running', ended_at: null },
          { run_id: 'r-paused', run_number: 2, status: 'paused', ended_at: null },
          { run_id: 'r-ended', run_number: 3, status: 'ended', ended_at: 'x' },
          { run_id: 'r-completed', run_number: 4, status: 'completed', ended_at: 'x' },
          { run_id: 'r-aborted', run_number: 5, status: 'aborted', ended_at: 'x' },
          { run_id: 'r-crashed', run_number: 6, status: 'crashed', ended_at: 'x' },
        ],
      };
      const loader = createJsonLoader({
        runsJson: runsRow,
        runDataDir: {
          'run-1/manifest.json': {},
          'run-2/manifest.json': {},
          'run-3/manifest.json': {},
          'run-4/manifest.json': {},
          'run-5/manifest.json': {},
          'run-6/manifest.json': {},
        },
      });
      const active = await loader.listActiveRuns();
      const ended = await loader.listEndedRuns();

      const activeIds = active.map(r => r.id).sort();
      const endedIds = ended.map(r => r.id).sort();

      expect(activeIds).toEqual(['r-paused', 'r-run']);
      expect(endedIds).toEqual(['r-aborted', 'r-completed', 'r-crashed', 'r-ended']);

      // No overlap between tiers.
      for (const id of activeIds) expect(endedIds).not.toContain(id);
    });
  });

  describe('getActiveRunDashboard', () => {
    it('returns null for a run with no shards yet', async () => {
      const lean = {
        runs: [{ run_id: 'fresh-001', run_number: 99, status: 'running', ended_at: null }],
      };
      const dir = { 'run-99/manifest.json': { agents_initial: [] } };
      const loader = createJsonLoader({ runsJson: lean, runDataDir: dir });
      const dashboard = await loader.getActiveRunDashboard('fresh-001');
      expect(dashboard).toBeNull();
    });

    it('throws when run id is missing', async () => {
      const loader = makeLoader();
      await expect(loader.getActiveRunDashboard('does-not-exist')).rejects.toThrow(
        /Run not found/
      );
    });

    it('happy path -- aggregates last 20 ticks across shards', async () => {
      const loader = makeLoader();
      const dashboard = await loader.getActiveRunDashboard('test-run-003');
      expect(dashboard).not.toBeNull();
      expect(dashboard!.run_id).toBe('test-run-003');
      expect(dashboard!.run_number).toBe(3);
      // highest_tick = 155; window = [135, 155]
      expect(dashboard!.window_end_tick).toBe(155);
      expect(dashboard!.window_start_tick).toBe(135);
    });

    it('conversation_count sums conversations from shards whose tick_range overlaps the window', async () => {
      const loader = makeLoader();
      const dashboard = await loader.getActiveRunDashboard('test-run-003');
      // day-0 shard [0,99] excluded; day-1-a [100,140] overlaps (1 conv); day-1-b [141,155] in (2 conv).
      expect(dashboard!.conversation_count).toBe(3);
    });

    it('action_count counts only actions whose tick falls inside the 20-tick window', async () => {
      const loader = makeLoader();
      const dashboard = await loader.getActiveRunDashboard('test-run-003');
      // In-window actions: Eve 138, 145, 152 and Finn 150 = 4.  Eve tick 110, 125, 30, 10 excluded.
      expect(dashboard!.action_count).toBe(4);
    });

    it('last_actions holds per-agent latest in-window action (dedupes older actions by agent)', async () => {
      const loader = makeLoader();
      const dashboard = await loader.getActiveRunDashboard('test-run-003');
      const byName = Object.fromEntries(
        dashboard!.last_actions.map(a => [a.agent_name, a])
      );
      // Eve's latest in-window action is tick 152 drink stream.
      expect(byName['Eve']).toMatchObject({
        tick: 152,
        action_type: 'drink',
        target: 'stream',
      });
      // Finn's latest in-window action is tick 150 eat fish.
      expect(byName['Finn']).toMatchObject({
        tick: 150,
        action_type: 'eat',
        target: 'fish',
      });
      // One entry per agent, no duplicates.
      expect(dashboard!.last_actions).toHaveLength(2);
    });

    it('respects 20-tick window boundary -- actions older than window are excluded from last_actions', async () => {
      // Build a scenario where Eve's only action is at tick 50 and highest_tick is 200.
      // Window = [180, 200], so Eve's tick-50 action must NOT appear in last_actions.
      const bounded = {
        runs: [{ run_id: 'bound-1', run_number: 42, status: 'running', ended_at: null }],
      };
      const dir = {
        'run-42/manifest.json': { agents_initial: [] },
        'run-42/day-0.json': {
          sim_day: 0,
          tick_range: [0, 99],
          stats: { conversations_today: 0 },
          actions_summary: [
            {
              agent_name: 'Eve',
              actions: [{ tick: 50, action_type: 'scout', target: 'hills', outcome: 'success' }],
            },
          ],
          agent_states: [{ name: 'Eve', needs: {} }],
        },
        'run-42/day-1.json': {
          sim_day: 1,
          tick_range: [100, 200],
          stats: { conversations_today: 0 },
          actions_summary: [
            {
              agent_name: 'Finn',
              actions: [{ tick: 195, action_type: 'fish', target: 'lake', outcome: 'success' }],
            },
          ],
          agent_states: [
            { name: 'Eve', needs: {} },
            { name: 'Finn', needs: {} },
          ],
        },
      };
      const loader = createJsonLoader({ runsJson: bounded, runDataDir: dir });
      const dashboard = await loader.getActiveRunDashboard('bound-1');
      expect(dashboard!.window_start_tick).toBe(180);
      expect(dashboard!.window_end_tick).toBe(200);
      const names = dashboard!.last_actions.map(a => a.agent_name);
      expect(names).toContain('Finn');
      expect(names).not.toContain('Eve');
    });

    it('agent_dashboard has one row per agent in the latest shard agent_states', async () => {
      const loader = makeLoader();
      const dashboard = await loader.getActiveRunDashboard('test-run-003');
      expect(dashboard!.agent_dashboard).toHaveLength(2);
      const byName = Object.fromEntries(
        dashboard!.agent_dashboard.map(r => [r.agent_name, r])
      );
      // Latest shard is day-1-b (tick 155).
      expect(byName['Eve'].hunger).toBe(2.0);
      expect(byName['Eve'].thirst).toBe(0.5);
      expect(byName['Eve'].rest).toBe(2.0);
      expect(byName['Eve'].location).toEqual({ x: 9, y: 14 });
      expect(byName['Finn'].hunger).toBe(1.0);
      expect(byName['Finn'].thirst).toBe(3.0);
      expect(byName['Finn'].rest).toBe(3.5);
      expect(byName['Finn'].location).toEqual({ x: 3, y: 2 });
    });

    it('agent_dashboard latest_action matches last_actions lookup by agent_name', async () => {
      const loader = makeLoader();
      const dashboard = await loader.getActiveRunDashboard('test-run-003');
      const byName = Object.fromEntries(
        dashboard!.agent_dashboard.map(r => [r.agent_name, r])
      );
      expect(byName['Eve'].latest_action).toMatchObject({
        tick: 152,
        action_type: 'drink',
        target: 'stream',
      });
      expect(byName['Finn'].latest_action).toMatchObject({
        tick: 150,
        action_type: 'eat',
        target: 'fish',
      });
    });

    it('agent_dashboard renders location as null when shards lack location data', async () => {
      const noLoc = {
        runs: [{ run_id: 'noloc-1', run_number: 77, status: 'running', ended_at: null }],
      };
      const dir = {
        'run-77/manifest.json': { agents_initial: [] },
        'run-77/day-0.json': {
          sim_day: 0,
          tick_range: [0, 10],
          stats: {},
          actions_summary: [],
          agent_states: [
            { name: 'Solo', needs: { Hunger: 3, Thirst: 3, Rest: 3 } },
          ],
        },
      };
      const loader = createJsonLoader({ runsJson: noLoc, runDataDir: dir });
      const dashboard = await loader.getActiveRunDashboard('noloc-1');
      expect(dashboard!.agent_dashboard).toHaveLength(1);
      expect(dashboard!.agent_dashboard[0].location).toBeNull();
      expect(dashboard!.agent_dashboard[0].latest_action).toBeNull();
    });
  });
});
