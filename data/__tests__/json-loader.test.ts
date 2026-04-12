// data/__tests__/json-loader.test.ts
import { describe, it, expect, vi } from 'vitest';
import { createJsonLoader } from '../json-loader.js';

// Mock the file system reads that Astro's import.meta.glob would provide.
// In real usage, the host site passes the resolved data to the loader.

describe('createJsonLoader', () => {
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

  it('listRuns returns typed Run array', async () => {
    const loader = createJsonLoader({ runsJson: mockRunsJson, runDataDir: {} });
    const runs = await loader.listRuns();
    expect(runs).toHaveLength(1);
    expect(runs[0].id).toBe('bcf25057-2c03-4e70-b147-169a95383f61');
    expect(runs[0].status).toBe('completed');
    expect(runs[0].prng_seed).toBe(42);
  });
});
