# Emergence UI Merge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge Project Emergence display pages into a shared `emergence-ui` git submodule consumed by both echoit-site and drewconrad.us, with a DataLoader abstraction for future live migration.

**Architecture:** New `emergence-ui` repo with Astro components + TypeScript data layer.  Both sites mount it as a git submodule at `src/emergence/`.  Host sites provide thin page wrappers that import submodule components and pass a site-specific layout.  Static JSON data flows through a `json-loader` implementing the `DataLoader` interface.

**Tech Stack:** Astro 6.x, TypeScript, React (RelationshipGraph island only), CSS

**Spec:** `docs/superpowers/specs/2026-04-12-emergence-ui-merge-design.md`

**Repos touched:**
- `emergence-ui` (NEW) -- shared component library
- `project-emergence` (D:\Clanker\project-emergence) -- export pipeline fixes
- `echoit-site` (D:\Clanker\echoit-site) -- submodule integration
- `drewconrad.us` (D:\Clanker\drewconrad.us) -- submodule integration

---

## Task 0: Pre-Flight -- Align Astro Versions

**Problem:** echoit-site is Astro 5.7.10, drewconrad.us is Astro 6.1.1.  Submodule components must work in both.  Align both to Astro 6.x.

**Files:**
- Modify: `D:\Clanker\echoit-site\package.json`

- [ ] **Step 1: Upgrade echoit-site to Astro 6.x**

```bash
cd D:/clanker/echoit-site
npm install astro@latest
```

- [ ] **Step 2: Run the build to check for breaking changes**

```bash
npm run build
```

Expected: Clean build or list of migration issues to fix.  Astro 5→6 migration guide: https://docs.astro.build/en/guides/upgrade-to/v6/

- [ ] **Step 3: Fix any migration issues and verify dev server**

```bash
npm run dev
```

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: upgrade Astro to 6.x for emergence-ui submodule compatibility"
```

---

## Task 1: Create emergence-ui Repo + Types

**Files:**
- Create: `emergence-ui/data/types.ts`
- Create: `emergence-ui/data/loader.ts`
- Create: `emergence-ui/package.json`
- Create: `emergence-ui/tsconfig.json`

- [ ] **Step 1: Create the repo on GitHub**

```bash
gh repo create tigercubs113/emergence-ui --private --clone
cd emergence-ui
```

- [ ] **Step 2: Create package.json**

```json
{
  "name": "emergence-ui",
  "version": "0.1.0",
  "private": true,
  "type": "module"
}
```

- [ ] **Step 3: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "jsx": "react-jsx",
    "outDir": "./dist",
    "declaration": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["**/*.ts", "**/*.tsx", "**/*.astro"]
}
```

- [ ] **Step 4: Create canonical data types in data/types.ts**

```typescript
// data/types.ts -- Canonical types for all Emergence display data.
// Components consume these types regardless of data source (JSON or Supabase).

export interface Run {
  id: string;           // Full UUID (bcf25057-2c03-4e70-b147-169a95383f61)
  run_number: number;   // Sequential display number (19)
  name: string;         // Human label ("Haiku 4.5 Evaluation")
  status: 'running' | 'completed' | 'aborted';
  tick_count: number;
  sim_days: number;
  agent_count: number;
  agents_alive: number;
  prng_seed: number;
  wall_clock_ms: number;
  model_config: ModelConfig;
  summary: string;      // One-line description
  created_at: string;   // ISO timestamp
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
```

- [ ] **Step 5: Create DataLoader interface in data/loader.ts**

```typescript
// data/loader.ts -- Interface that abstracts data source.
// json-loader.ts implements this for static JSON (current).
// supabase-loader.ts will implement this for live DB (future).

import type {
  Run,
  RunDetail,
  DayDetail,
  AgentProfile,
  Relationship,
} from './types.js';

export interface DataLoader {
  listRuns(): Promise<Run[]>;
  getRun(id: string): Promise<RunDetail>;
  getDay(runId: string, day: number): Promise<DayDetail>;
  getAgent(runId: string, name: string): Promise<AgentProfile>;
  getRelationships(runId: string): Promise<Relationship[]>;
}
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: canonical types and DataLoader interface"
```

---

## Task 2: Normalize + Format Utilities

**Files:**
- Create: `emergence-ui/utils/normalize.ts`
- Create: `emergence-ui/utils/format.ts`
- Create: `emergence-ui/utils/__tests__/normalize.test.ts`
- Create: `emergence-ui/utils/__tests__/format.test.ts`

- [ ] **Step 1: Write failing tests for normalize.ts**

```typescript
// utils/__tests__/normalize.test.ts
import { describe, it, expect } from 'vitest';
import {
  normalizeTickRange,
  normalizePersonality,
  normalizeStatus,
  filterInternalNeeds,
} from '../normalize.js';

describe('normalizeTickRange', () => {
  it('passes through tuple unchanged', () => {
    expect(normalizeTickRange([0, 99])).toEqual([0, 99]);
  });

  it('converts {start, end} object to tuple', () => {
    expect(normalizeTickRange({ start: 0, end: 99 })).toEqual([0, 99]);
  });

  it('returns [0, 0] for null/undefined', () => {
    expect(normalizeTickRange(null)).toEqual([0, 0]);
    expect(normalizeTickRange(undefined)).toEqual([0, 0]);
  });
});

describe('normalizePersonality', () => {
  it('returns personality_summary when available', () => {
    const agent = {
      personality: '{"traits":{"Patient":8},"backstory":"A quiet healer."}',
      personality_summary: 'A quiet healer.',
    };
    expect(normalizePersonality(agent)).toBe('A quiet healer.');
  });

  it('extracts backstory from JSON when summary missing', () => {
    const agent = {
      personality: '{"traits":{"Patient":8},"backstory":"A quiet healer."}',
    };
    expect(normalizePersonality(agent)).toBe('A quiet healer.');
  });

  it('returns empty string for unparseable personality', () => {
    const agent = { personality: 'not json' };
    expect(normalizePersonality(agent)).toBe('');
  });
});

describe('normalizeStatus', () => {
  it('normalizes status strings', () => {
    expect(normalizeStatus('running')).toBe('running');
    expect(normalizeStatus('completed')).toBe('completed');
    expect(normalizeStatus('RUNNING')).toBe('running');
    expect(normalizeStatus(undefined)).toBe('running');
  });
});

describe('filterInternalNeeds', () => {
  it('removes composite_modifier', () => {
    const needs = [
      { label: 'Thirst', value: 2.1, max: 5 },
      { label: 'Composite_modifier', value: 1.25, max: 5 },
      { label: 'Hunger', value: 3.4, max: 5 },
    ];
    const result = filterInternalNeeds(needs);
    expect(result).toHaveLength(2);
    expect(result.map(n => n.label)).toEqual(['Thirst', 'Hunger']);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run utils/__tests__/normalize.test.ts
```

Expected: FAIL -- modules not found.

- [ ] **Step 3: Implement normalize.ts**

```typescript
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
): 'running' | 'completed' | 'aborted' {
  const s = (status ?? 'running').toLowerCase();
  if (s === 'completed' || s === 'aborted') return s;
  return 'running';
}

export function filterInternalNeeds(
  needs: { label: string; value: number; max: number }[]
): { label: string; value: number; max: number }[] {
  return needs.filter(
    n => !INTERNAL_NEED_KEYS.includes(n.label.toLowerCase())
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run utils/__tests__/normalize.test.ts
```

Expected: all PASS.

- [ ] **Step 5: Write failing tests for format.ts**

```typescript
// utils/__tests__/format.test.ts
import { describe, it, expect } from 'vitest';
import {
  formatNeedLabel,
  formatDuration,
  formatTickRange,
  formatNeedValue,
} from '../format.js';

describe('formatNeedLabel', () => {
  it('converts snake_case to Title Case', () => {
    expect(formatNeedLabel('health_safety')).toBe('Health Safety');
    expect(formatNeedLabel('self_respect')).toBe('Self Respect');
    expect(formatNeedLabel('meaning_seeking')).toBe('Meaning Seeking');
  });

  it('handles already-formatted labels', () => {
    expect(formatNeedLabel('Thirst')).toBe('Thirst');
    expect(formatNeedLabel('Air')).toBe('Air');
  });
});

describe('formatDuration', () => {
  it('formats ms to human readable', () => {
    expect(formatDuration(3600000)).toBe('1h 0m');
    expect(formatDuration(32640000)).toBe('9h 4m');
    expect(formatDuration(180000)).toBe('3m');
  });
});

describe('formatTickRange', () => {
  it('formats tuple as string', () => {
    expect(formatTickRange([0, 99])).toBe('0\u201399');
    expect(formatTickRange([100, 199])).toBe('100\u2013199');
  });
});

describe('formatNeedValue', () => {
  it('formats raw 0-5 value with one decimal', () => {
    expect(formatNeedValue(2.1, 5)).toBe('2.1 / 5.0');
    expect(formatNeedValue(0, 5)).toBe('0.0 / 5.0');
  });
});
```

- [ ] **Step 6: Implement format.ts**

```typescript
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
```

- [ ] **Step 7: Run all tests**

```bash
npx vitest run
```

Expected: all PASS.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: normalize and format utilities with tests"
```

---

## Task 3: JSON Loader

**Files:**
- Create: `emergence-ui/data/json-loader.ts`
- Create: `emergence-ui/data/__tests__/json-loader.test.ts`

- [ ] **Step 1: Write failing test for json-loader**

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run data/__tests__/json-loader.test.ts
```

Expected: FAIL -- module not found.

- [ ] **Step 3: Implement json-loader.ts**

```typescript
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

      // Deduplicate days by sim_day (multiple shards per day → one entry)
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
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: json-loader implementing DataLoader interface"
```

---

## Task 4: Shared Styles

**Files:**
- Create: `emergence-ui/styles/emergence.css`

- [ ] **Step 1: Create emergence.css**

Design token CSS file covering all components.  Dark theme.  Responsive.  Mobile-safe (no unbounded agent x needs iteration).

```css
/* emergence-ui/styles/emergence.css
   Shared styles for all Emergence components.
   Host site provides its own layout/header/footer. */

:root {
  --em-bg: #1a1a2e;
  --em-surface: rgba(255, 255, 255, 0.03);
  --em-border: #333;
  --em-text: #e0e0e0;
  --em-text-muted: #888;
  --em-text-dim: #666;
  --em-accent: #f0c040;
  --em-link: #7cacf8;
  --em-success: #50c878;
  --em-danger: #e05050;
  --em-radius: 8px;
  --em-radius-sm: 4px;
}

.em-container { max-width: 900px; margin: 0 auto; padding: 0 16px; }
.em-section { padding: 32px 0; border-bottom: 1px solid var(--em-border); }
.em-section:last-child { border-bottom: none; }

/* Typography */
.em-h1 { font-size: 24px; font-weight: bold; color: #fff; }
.em-h2 { font-size: 18px; font-weight: bold; color: #fff; margin-bottom: 16px; }
.em-h3 { font-size: 15px; font-weight: bold; color: #fff; }
.em-subtitle { color: var(--em-text-muted); font-size: 14px; line-height: 1.6; }
.em-label { font-size: 11px; color: var(--em-text-dim); text-transform: uppercase; letter-spacing: 1px; }
.em-mono { font-family: monospace; font-size: 13px; color: var(--em-text-muted); }

/* Cards */
.em-card {
  padding: 16px;
  background: var(--em-surface);
  border: 1px solid var(--em-border);
  border-radius: var(--em-radius);
  transition: border-color 0.2s;
}
.em-card:hover { border-color: var(--em-link); }
.em-card a { text-decoration: none; color: inherit; display: block; }

/* Badge */
.em-badge {
  display: inline-block;
  padding: 4px 10px;
  border-radius: var(--em-radius-sm);
  font-size: 12px;
  font-weight: bold;
}
.em-badge--completed { background: rgba(80, 200, 120, 0.15); color: var(--em-success); }
.em-badge--running { background: rgba(124, 172, 248, 0.15); color: var(--em-link); }
.em-badge--aborted { background: rgba(224, 80, 80, 0.15); color: var(--em-danger); }

/* Health bar */
.em-health-bar {
  height: 6px;
  background: var(--em-border);
  border-radius: 3px;
  overflow: hidden;
  margin-top: 8px;
}
.em-health-bar__fill {
  height: 100%;
  border-radius: 3px;
  background: var(--em-success);
}

/* Grid layouts */
.em-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.em-grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
.em-grid-5 { display: grid; grid-template-columns: repeat(5, 1fr); gap: 16px; }

/* Stat box */
.em-stat {
  padding: 10px;
  background: var(--em-surface);
  border-radius: 6px;
  text-align: center;
}
.em-stat__value { font-size: 20px; font-weight: bold; margin-top: 4px; }

/* Activity feed */
.em-feed-item { font-size: 13px; line-height: 2.2; color: var(--em-text-muted); }
.em-feed-item__tick { font-family: monospace; font-size: 11px; color: var(--em-text-dim); }
.em-feed-item__agent { color: var(--em-accent); }

/* Journal entry */
.em-journal {
  padding: 16px;
  background: var(--em-surface);
  border-radius: var(--em-radius);
  border-left: 3px solid var(--em-accent);
  margin-bottom: 8px;
}
.em-journal__text { font-size: 13px; color: var(--em-text-muted); font-style: italic; line-height: 1.5; }

/* Conversation block */
.em-conversation {
  padding: 12px;
  background: var(--em-surface);
  border-radius: var(--em-radius);
  margin-bottom: 8px;
}
.em-conversation__turn { font-size: 13px; color: var(--em-text-muted); font-style: italic; line-height: 1.5; }

/* Responsive */
@media (max-width: 768px) {
  .em-grid-4 { grid-template-columns: repeat(2, 1fr); }
  .em-grid-5 { grid-template-columns: repeat(2, 1fr); }
  .em-grid-2 { grid-template-columns: 1fr; }
}
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat: shared emergence CSS with design tokens and responsive grid"
```

---

## Task 5: Astro Components -- Hub + Attribution

**Files:**
- Create: `emergence-ui/components/Attribution.astro`
- Create: `emergence-ui/components/RunCard.astro`
- Create: `emergence-ui/components/Hub.astro`

- [ ] **Step 1: Create Attribution.astro**

```astro
---
// emergence-ui/components/Attribution.astro
// Park et al. "Generative Agents" (2023) attribution block.
---
<section class="em-section">
  <div class="em-container">
    <div style="display: flex; gap: 24px; align-items: flex-start;">
      <div style="flex-shrink: 0; width: 48px; height: 48px; background: #444; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 24px;">📄</div>
      <div>
        <div class="em-h3" style="margin-bottom: 4px;">Standing on the shoulders of Generative Agents</div>
        <p class="em-subtitle" style="margin-bottom: 12px;">
          Project Emergence builds on the foundational work of Park et al. (2023) &mdash;
          "Generative Agents: Interactive Simulacra of Human Behavior."
          Their architecture for memory, reflection, and planning is the base layer we inherited.
          We rebuilt the tick engine, replaced their behavioral model with Maslow's hierarchy of needs,
          added a full crafting system with resources, recipes, and skill progression,
          and redesigned the cognitive pipeline for multi-model LLM routing.
          Their work made ours possible.
        </p>
        <div style="display: flex; gap: 16px; font-size: 13px;">
          <a href="https://arxiv.org/abs/2304.03442" class="em-link" target="_blank" rel="noopener">📄 Read the paper (arXiv)</a>
          <a href="https://github.com/joonspk-research/generative_agents" class="em-link" target="_blank" rel="noopener">💻 Their GitHub</a>
        </div>
      </div>
    </div>
  </div>
</section>
```

- [ ] **Step 2: Create RunCard.astro**

```astro
---
// emergence-ui/components/RunCard.astro
import type { Run } from '../data/types';
import { formatDuration } from '../utils/format';

interface Props {
  run: Run;
  basePath: string;  // e.g. "/project-emergence" or "/emergence"
}

const { run, basePath } = Astro.props;
const href = `${basePath}/run/${run.run_number}/`;
const badgeClass = `em-badge em-badge--${run.status}`;
---
<a href={href} class="em-card" style="display: block; text-decoration: none; color: inherit; margin-bottom: 12px;">
  <div style="display: flex; justify-content: space-between; align-items: center;">
    <div>
      <div class="em-h3">{run.name}</div>
      <div class="em-mono" style="margin-top: 4px;">
        {run.id.slice(0, 8)} &middot; {run.tick_count} ticks &middot; {run.sim_days.toFixed(1)} days &middot; {run.agent_count} agents &middot; Seed {run.prng_seed}
      </div>
    </div>
    <div class={badgeClass}>{run.status.toUpperCase()}</div>
  </div>
  {run.summary && <div class="em-subtitle" style="margin-top: 8px;">{run.summary}</div>}
</a>
```

- [ ] **Step 3: Create Hub.astro**

```astro
---
// emergence-ui/components/Hub.astro
import type { Run } from '../data/types';
import Attribution from './Attribution.astro';
import RunCard from './RunCard.astro';

interface Props {
  runs: Run[];
  basePath: string;
}

const { runs, basePath } = Astro.props;
---
<div class="em-container">
  <!-- Hero -->
  <section class="em-section" style="text-align: center; padding: 48px 0;">
    <h1 class="em-h1" style="font-size: 28px;">Project Emergence</h1>
    <p class="em-subtitle" style="max-width: 600px; margin: 8px auto 0;">
      AI agents in a world governed by Maslow's hierarchy of needs.
      No scripts, no rails &mdash; just survival, cooperation, and whatever emerges.
    </p>
  </section>

  <!-- Attribution -->
  <Attribution />

  <!-- What we changed -->
  <section class="em-section">
    <div class="em-h2">What we changed</div>
    <div class="em-grid-2" style="gap: 16px;">
      <div class="em-card">
        <div class="em-label" style="color: var(--em-accent); margin-bottom: 4px;">Behavioral Model</div>
        <div class="em-subtitle">Maslow's hierarchy of needs replaces flat trait-based behavior</div>
      </div>
      <div class="em-card">
        <div class="em-label" style="color: var(--em-accent); margin-bottom: 4px;">Tick Engine</div>
        <div class="em-subtitle">Three-layer architecture: biological, cognitive, social</div>
      </div>
      <div class="em-card">
        <div class="em-label" style="color: var(--em-accent); margin-bottom: 4px;">Survival Systems</div>
        <div class="em-subtitle">Crafting, resources, recipes, and skill progression</div>
      </div>
      <div class="em-card">
        <div class="em-label" style="color: var(--em-accent); margin-bottom: 4px;">LLM Routing</div>
        <div class="em-subtitle">Multi-model cognitive pipeline: route each reasoning task to the right LLM tier</div>
      </div>
    </div>
  </section>

  <!-- Run listing -->
  <section class="em-section">
    <div class="em-h2">Simulation Runs</div>
    {runs.map(run => <RunCard run={run} basePath={basePath} />)}
  </section>
</div>
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: Hub, Attribution, and RunCard components"
```

---

## Task 6: Astro Components -- RunDetail + AgentCard

**Files:**
- Create: `emergence-ui/components/AgentCard.astro`
- Create: `emergence-ui/components/RunDetail.astro`

- [ ] **Step 1: Create AgentCard.astro**

```astro
---
// emergence-ui/components/AgentCard.astro
import type { AgentSummary } from '../data/types';

interface Props {
  agent: AgentSummary;
  href: string;
}

const { agent, href } = Astro.props;
---
<a href={href} class="em-card" style="display: block; text-decoration: none; color: inherit;">
  <div class="em-h3">{agent.name}</div>
  <div style="font-size: 12px; color: var(--em-accent); margin-top: 2px;">{agent.skills.join(' · ')}</div>
  <div class="em-subtitle" style="margin-top: 8px; line-height: 1.4;">{agent.backstory}</div>
  <div class="em-health-bar">
    <div class="em-health-bar__fill" style={`width: ${agent.health_pct}%`}></div>
  </div>
  <div style="font-size: 11px; color: var(--em-text-dim); margin-top: 4px;">
    Health {agent.health_pct}%{!agent.is_alive && ' · DEAD'}
  </div>
</a>
```

- [ ] **Step 2: Create RunDetail.astro**

```astro
---
// emergence-ui/components/RunDetail.astro
import type { RunDetail as RunDetailType } from '../data/types';
import { formatDuration, formatTickRange } from '../utils/format';
import AgentCard from './AgentCard.astro';

interface Props {
  run: RunDetailType;
  basePath: string;
}

const { run, basePath } = Astro.props;
const runPath = `${basePath}/run/${run.run_number}`;
---
<div class="em-container">
  <!-- Breadcrumb -->
  <div style="padding: 12px 0; font-size: 13px; color: var(--em-text-dim);">
    <a href={basePath} style="color: var(--em-link);">Project Emergence</a> &rarr; Run {run.run_number}
  </div>

  <!-- Header -->
  <section class="em-section">
    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
      <div>
        <h1 class="em-h1">{run.name}</h1>
        <div class="em-mono" style="margin-top: 8px;">{run.id}</div>
      </div>
      <div class={`em-badge em-badge--${run.status}`}>{run.status.toUpperCase()}</div>
    </div>

    <!-- Metadata -->
    <div class="em-grid-5" style="margin-top: 24px;">
      <div class="em-stat">
        <div class="em-label">Ticks</div>
        <div class="em-stat__value">{run.tick_count}</div>
      </div>
      <div class="em-stat">
        <div class="em-label">Sim Days</div>
        <div class="em-stat__value">{run.sim_days.toFixed(1)}</div>
      </div>
      <div class="em-stat">
        <div class="em-label">Agents</div>
        <div class="em-stat__value">{run.agents_alive} / {run.agent_count}</div>
        {run.agents_alive === run.agent_count &&
          <div style="font-size: 11px; color: var(--em-success);">all survived</div>
        }
      </div>
      <div class="em-stat">
        <div class="em-label">PRNG Seed</div>
        <div class="em-stat__value">{run.prng_seed}</div>
      </div>
      <div class="em-stat">
        <div class="em-label">Wall Clock</div>
        <div class="em-stat__value">{formatDuration(run.wall_clock_ms)}</div>
      </div>
    </div>

    <!-- LLM Routing -->
    {run.model_config && Object.keys(run.model_config.routes).length > 0 && (
      <div class="em-card" style="margin-top: 20px;">
        <div class="em-label" style="margin-bottom: 8px;">LLM Routing</div>
        <div class="em-grid-2" style="font-size: 13px; color: var(--em-text-muted);">
          {Object.entries(run.model_config.routes).map(([key, route]) => (
            <div><span style="color: var(--em-accent);">{key}:</span> {(route as any).model}</div>
          ))}
        </div>
      </div>
    )}
  </section>

  <!-- Agent Cast -->
  <section class="em-section">
    <div class="em-h2">The Cast</div>
    {run.agents.length <= 20 ? (
      <div class="em-grid-4">
        {run.agents.map(agent => (
          <AgentCard agent={agent} href={`${runPath}/agent/${agent.name.toLowerCase()}/`} />
        ))}
      </div>
    ) : (
      <div>
        <input type="text" placeholder="Search agents..." class="em-search"
          style="width: 100%; padding: 8px 12px; background: var(--em-surface); border: 1px solid var(--em-border); border-radius: var(--em-radius-sm); color: var(--em-text); margin-bottom: 12px;" />
        <div class="em-grid-4">
          {run.agents.slice(0, 20).map(agent => (
            <AgentCard agent={agent} href={`${runPath}/agent/${agent.name.toLowerCase()}/`} />
          ))}
        </div>
        <div class="em-subtitle" style="margin-top: 8px;">Showing 20 of {run.agents.length} agents</div>
      </div>
    )}
  </section>

  <!-- Chronicle -->
  <section class="em-section">
    <div class="em-h2">Chronicle</div>
    {run.days.map(day => (
      <a href={`${runPath}/day/${day.sim_day}/`} class="em-card" style="display: block; text-decoration: none; color: inherit; margin-bottom: 8px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div class="em-h3">
              Day {day.sim_day}
              <span style="color: var(--em-text-dim); font-weight: normal; font-size: 13px;">
                &mdash; Ticks {formatTickRange(day.tick_range)}
              </span>
            </div>
            {day.narrative && <div class="em-subtitle" style="margin-top: 4px;">{day.narrative}</div>}
          </div>
          <div style="text-align: right; font-size: 12px; color: var(--em-text-dim);">
            <div>{day.decision_count} decisions</div>
            <div>{day.conversation_count} conversations</div>
          </div>
        </div>
      </a>
    ))}
  </section>
</div>
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: RunDetail and AgentCard components"
```

---

## Task 7: Astro Components -- DayDetail

**Files:**
- Create: `emergence-ui/components/ActivityFeed.astro`
- Create: `emergence-ui/components/ConversationBlock.astro`
- Create: `emergence-ui/components/NeedStates.astro`
- Create: `emergence-ui/components/DayDetail.astro`

- [ ] **Step 1: Create ActivityFeed.astro**

```astro
---
import type { ActivityEvent } from '../data/types';

interface Props {
  events: ActivityEvent[];
  limit?: number;
}

const { events, limit = 50 } = Astro.props;
const displayed = events.slice(0, limit);
const remaining = events.length - limit;
---
<div>
  {displayed.map(e => (
    <div class="em-feed-item">
      <span class="em-feed-item__tick">T{e.tick}</span>{' '}
      <span class="em-feed-item__agent">{e.agent_name}</span>{' '}
      {e.action_type}{e.target ? `:${e.target}` : ''}
      {e.outcome === 'failed' && <span style="color: var(--em-danger);"> (failed)</span>}
      {e.detail && <span style="color: var(--em-text-dim);"> &mdash; {e.detail}</span>}
    </div>
  ))}
  {remaining > 0 && (
    <div style="color: var(--em-text-dim); font-size: 12px; margin-top: 4px;">
      ... {remaining} more events
    </div>
  )}
</div>
```

- [ ] **Step 2: Create ConversationBlock.astro**

```astro
---
import type { Conversation } from '../data/types';

interface Props {
  conversation: Conversation;
}

const { conversation } = Astro.props;
---
<div class="em-conversation">
  <div class="em-h3" style="font-size: 13px;">
    {conversation.participants.join(' ↔ ')}
    {conversation.relationship_changes.length > 0 && (
      <span style="color: var(--em-success); font-size: 11px; font-weight: normal; margin-left: 8px;">
        &rarr; {conversation.relationship_changes.map(rc => `${rc.old_type} to ${rc.new_type}`).join(', ')}
      </span>
    )}
  </div>
  <div style="font-size: 12px; color: var(--em-text-muted); margin-top: 2px;">
    {conversation.turns.length} turns &middot; ended: {conversation.end_reason}
  </div>
  <div style="margin-top: 8px;">
    {conversation.turns.map(turn => (
      <div class="em-conversation__turn">
        <strong style="color: var(--em-accent); font-style: normal;">{turn.speaker}:</strong> "{turn.text}"
      </div>
    ))}
  </div>
</div>
```

- [ ] **Step 3: Create NeedStates.astro**

```astro
---
import type { AgentNeedSnapshot } from '../data/types';
import { formatNeedValue } from '../utils/format';

interface Props {
  needStates: AgentNeedSnapshot[];
  topN?: number;
}

const { needStates, topN = 5 } = Astro.props;
// Show only top N physiological/safety needs per the spec
const PRIORITY_NEEDS = ['Thirst', 'Hunger', 'Rest', 'Shelter', 'Health', 'Health Safety', 'Air'];
---
<div class="em-grid-2">
  {PRIORITY_NEEDS.slice(0, topN).map(needLabel => {
    // Average across all agents for this need
    const values = needStates
      .flatMap(s => s.needs)
      .filter(n => n.label === needLabel);
    if (values.length === 0) return null;
    const avg = values.reduce((sum, v) => sum + v.value, 0) / values.length;
    const max = values[0].max;
    return (
      <div class="em-card" style="padding: 8px 12px;">
        <span style="color: var(--em-accent);">{needLabel}</span>
        <span style="color: var(--em-text-muted); float: right;">avg {formatNeedValue(avg, max)}</span>
      </div>
    );
  })}
</div>
```

- [ ] **Step 4: Create DayDetail.astro**

```astro
---
import type { DayDetail as DayDetailType } from '../data/types';
import { formatTickRange } from '../utils/format';
import ActivityFeed from './ActivityFeed.astro';
import ConversationBlock from './ConversationBlock.astro';
import NeedStates from './NeedStates.astro';

interface Props {
  day: DayDetailType;
  runNumber: number;
  totalDays: number;
  basePath: string;
}

const { day, runNumber, totalDays, basePath } = Astro.props;
const runPath = `${basePath}/run/${runNumber}`;
const prevDay = day.sim_day > 0 ? day.sim_day - 1 : null;
const nextDay = day.sim_day < totalDays - 1 ? day.sim_day + 1 : null;
---
<div class="em-container">
  <!-- Breadcrumb + nav -->
  <div style="padding: 12px 0; font-size: 12px; color: var(--em-text-dim); display: flex; justify-content: space-between;">
    <div>
      <a href={runPath} style="color: var(--em-link);">Run {runNumber}</a> &rarr; Day {day.sim_day}
    </div>
    <div>
      {prevDay !== null && <a href={`${runPath}/day/${prevDay}/`} style="color: var(--em-link);">&larr; Day {prevDay}</a>}
      {prevDay !== null && nextDay !== null && ' | '}
      {nextDay !== null && <a href={`${runPath}/day/${nextDay}/`} style="color: var(--em-link);">Day {nextDay} &rarr;</a>}
    </div>
  </div>

  <!-- Day header -->
  <section class="em-section">
    <h1 class="em-h1">
      Day {day.sim_day}
      <span style="color: var(--em-text-dim); font-size: 14px; font-weight: normal;">
        Ticks {formatTickRange(day.tick_range)}
      </span>
    </h1>
    <div style="display: flex; gap: 20px; margin-top: 12px; font-size: 13px; color: var(--em-text-muted);">
      <div><strong style="color: #fff;">{day.stats.decisions}</strong> decisions</div>
      <div><strong style="color: #fff;">{day.stats.conversations}</strong> conversations</div>
      <div><strong style="color: #fff;">{day.stats.crafts_attempted}</strong> crafts attempted</div>
      <div><strong style="color: #fff;">{day.stats.rest_events}</strong> rest events</div>
    </div>
  </section>

  <!-- Activity Feed -->
  <section class="em-section">
    <div class="em-h2">Activity Feed</div>
    <ActivityFeed events={day.events} />
  </section>

  <!-- Conversations -->
  {day.conversations.length > 0 && (
    <section class="em-section">
      <div class="em-h2">Conversations</div>
      {day.conversations.map(conv => <ConversationBlock conversation={conv} />)}
    </section>
  )}

  <!-- Need States -->
  {day.need_states.length > 0 && (
    <section class="em-section">
      <div class="em-h2">Need States (end of day)</div>
      <div style="font-size: 12px; color: var(--em-text-dim); margin-bottom: 8px;">
        Top 5 Maslow needs -- Physiological + Safety
      </div>
      <NeedStates needStates={day.need_states} />
    </section>
  )}
</div>
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: DayDetail, ActivityFeed, ConversationBlock, NeedStates components"
```

---

## Task 8: Astro Components -- AgentProfile

**Files:**
- Create: `emergence-ui/components/AgentProfile.astro`

- [ ] **Step 1: Create AgentProfile.astro**

```astro
---
import type { AgentProfile as AgentProfileType } from '../data/types';

interface Props {
  agent: AgentProfileType;
  runNumber: number;
  basePath: string;
}

const { agent, runNumber, basePath } = Astro.props;
const runPath = `${basePath}/run/${runNumber}`;
---
<div class="em-container">
  <!-- Breadcrumb -->
  <div style="padding: 12px 0; font-size: 12px; color: var(--em-text-dim);">
    <a href={runPath} style="color: var(--em-link);">Run {runNumber}</a> &rarr;
    <a href={runPath} style="color: var(--em-link);">Cast</a> &rarr; {agent.name}
  </div>

  <!-- Agent header -->
  <section class="em-section">
    <div style="display: flex; gap: 20px; align-items: flex-start;">
      <div style="width: 64px; height: 64px; background: linear-gradient(135deg, #4a7c4a, #2d4a2d); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 28px; flex-shrink: 0;">
        {agent.name.charAt(0)}
      </div>
      <div>
        <h1 class="em-h1">{agent.name}</h1>
        <div style="font-size: 13px; color: var(--em-accent); margin-top: 2px;">{agent.skills.join(' · ')}</div>
        <p class="em-subtitle" style="margin-top: 8px;">{agent.backstory}</p>
      </div>
    </div>

    <!-- Stats -->
    <div class="em-grid-4" style="margin-top: 20px;">
      <div class="em-stat">
        <div class="em-label">Health</div>
        <div class="em-stat__value" style={`color: ${agent.is_alive ? 'var(--em-success)' : 'var(--em-danger)'}`}>
          {agent.health_pct}%
        </div>
      </div>
      <div class="em-stat">
        <div class="em-label">Decisions</div>
        <div class="em-stat__value">{agent.stats.total_decisions}</div>
      </div>
      <div class="em-stat">
        <div class="em-label">Conversations</div>
        <div class="em-stat__value">{agent.stats.total_conversations}</div>
      </div>
      <div class="em-stat">
        <div class="em-label">Memories</div>
        <div class="em-stat__value">{agent.stats.memories_formed}</div>
      </div>
    </div>
  </section>

  <!-- Journal -->
  {agent.journal_entries.length > 0 && (
    <section class="em-section">
      <div class="em-h2">📖 Journal</div>
      {agent.journal_entries.map(entry => (
        <div class="em-journal">
          <div class="em-label">Day {entry.sim_day}</div>
          <div class="em-journal__text" style="margin-top: 4px;">{entry.text}</div>
        </div>
      ))}
    </section>
  )}

  <!-- Relationships -->
  {agent.relationships.length > 0 && (
    <section class="em-section">
      <div class="em-h2">Relationships</div>
      <div style="font-size: 13px; line-height: 2.2;">
        {agent.relationships.map(rel => {
          const other = rel.agent_a === agent.name ? rel.agent_b : rel.agent_a;
          const typeColor = rel.type === 'rival' ? 'var(--em-danger)'
            : rel.type.includes('friend') ? 'var(--em-success)'
            : 'var(--em-link)';
          return (
            <div>
              <a href={`${runPath}/agent/${other.toLowerCase()}/`} style={`color: var(--em-accent);`}>{other}</a>
              {' '}&mdash;{' '}
              <span style={`color: ${typeColor}`}>{rel.type.replace('_', ' ')}</span>
              {' '}<span style="color: var(--em-text-dim);">({rel.score.toFixed(1)})</span>
            </div>
          );
        })}
      </div>
    </section>
  )}

  <!-- Decision Timeline -->
  {agent.decisions.length > 0 && (
    <section class="em-section">
      <div class="em-h2">Decision Timeline</div>
      <div>
        {agent.decisions.slice(0, 50).map(d => (
          <div class="em-feed-item">
            <span class="em-feed-item__tick">T{d.tick}</span>{' '}
            {d.action_type}{d.target ? `:${d.target}` : ''}
            {d.outcome === 'failed' && <span style="color: var(--em-danger);"> (failed)</span>}
          </div>
        ))}
        {agent.decisions.length > 50 && (
          <div style="color: var(--em-text-dim); font-size: 12px; margin-top: 4px;">
            ... {agent.decisions.length - 50} more decisions
          </div>
        )}
      </div>
    </section>
  )}
</div>
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat: AgentProfile component"
```

---

## Task 9: Export Pipeline Fixes (project-emergence)

**Files:**
- Modify: `D:\Clanker\project-emergence\src\engine\export.ts`

This task fixes the export contract at the source.  The builder should read the current `export.ts` and make targeted fixes:

- [ ] **Step 1: Fix tick_range to always export as tuple**

In `export.ts`, find the `DayExport` interface (line ~31) and the code that writes `tick_range`.  Change from `{ start: number; end: number }` to `[number, number]`.  Update all write sites to use `[start, end]` tuple form.

- [ ] **Step 2: Add personality_summary to agent export**

Find where `AgentSnapshot` is built (line ~50).  Add `personality_summary` field that extracts the backstory from the personality JSON.

```typescript
// Add to agent snapshot construction:
personality_summary: (() => {
  try {
    const parsed = JSON.parse(agent.personality);
    return parsed.backstory ?? '';
  } catch {
    return '';
  }
})(),
```

- [ ] **Step 3: Sync manifest.status with runs.json**

Find `RunManifest` writing (line ~139).  When the manifest is written, read current status from `runs.json` and use that.  Or better: update both atomically in the same write path.

- [ ] **Step 4: Filter internal needs from export**

In the agent state export, filter out `composite_modifier` and any other internal fields.  Export need labels in Title Case with spaces.

- [ ] **Step 5: Deduplicate agents_initial**

Find manifest writing.  Export only `agents_initial` (remove `initial_agents` if present, or alias one to the other).  No duplicate arrays.

- [ ] **Step 6: Export conversation transcripts**

Ensure each day export includes full conversation data: `conversations[]` with `participants`, `turns` (speaker + text), `end_reason`, and `relationship_changes`.

- [ ] **Step 7: Run existing tests**

```bash
npm test
```

Expected: existing tests pass (export changes are additive/corrective, not behavioral).

- [ ] **Step 8: Commit**

```bash
git add src/engine/export.ts
git commit -m "PIP-49: fix export contract for emergence-ui (tick_range tuple, personality_summary, status sync, need filtering, conversation transcripts)"
```

---

## Task 10: Integrate into echoit-site

**Files:**
- Modify: `D:\Clanker\echoit-site\package.json` (if not already Astro 6)
- Create: `D:\Clanker\echoit-site\src\pages\emergence\index.astro` (replace)
- Create: `D:\Clanker\echoit-site\src\pages\emergence\run\[n].astro` (replace)
- Create: `D:\Clanker\echoit-site\src\pages\emergence\run\[n]\day\[d].astro` (replace)
- Create: `D:\Clanker\echoit-site\src\pages\emergence\run\[n]\agent\[name].astro` (new)
- Delete: `D:\Clanker\echoit-site\src\data\emergence\loader.ts` (old loader)
- Delete: `D:\Clanker\echoit-site\src\data\emergence\types\index.ts` (old types)

- [ ] **Step 1: Add emergence-ui as git submodule**

```bash
cd D:/clanker/echoit-site
git submodule add git@github.com:tigercubs113/emergence-ui.git src/emergence
```

- [ ] **Step 2: Create thin hub page**

```astro
---
// src/pages/emergence/index.astro
import Layout from '../../layouts/Layout.astro';
import Hub from '../../emergence/components/Hub.astro';
import { createJsonLoader } from '../../emergence/data/json-loader';
import '../../emergence/styles/emergence.css';

// Load run data from the local data directory
const runsJson = await import('../../data/emergence/runs/runs.json');
const runDataGlob = import.meta.glob('../../data/emergence/runs/**/*.json', { eager: true });
const runDataDir: Record<string, any> = {};
for (const [path, mod] of Object.entries(runDataGlob)) {
  runDataDir[path] = (mod as any).default ?? mod;
}

const loader = createJsonLoader({ runsJson: runsJson.default ?? runsJson, runDataDir });
const runs = await loader.listRuns();
---
<Layout title="Project Emergence | ECHOIT">
  <Hub runs={runs} basePath="/emergence" />
</Layout>
```

- [ ] **Step 3: Create thin run detail page**

```astro
---
// src/pages/emergence/run/[n].astro
import Layout from '../../../layouts/Layout.astro';
import RunDetailComponent from '../../../emergence/components/RunDetail.astro';
import { createJsonLoader } from '../../../emergence/data/json-loader';
import '../../../emergence/styles/emergence.css';

const { n } = Astro.params;
const runsJson = await import('../../../data/emergence/runs/runs.json');
const runDataGlob = import.meta.glob('../../../data/emergence/runs/**/*.json', { eager: true });
const runDataDir: Record<string, any> = {};
for (const [path, mod] of Object.entries(runDataGlob)) {
  runDataDir[path] = (mod as any).default ?? mod;
}

const loader = createJsonLoader({ runsJson: runsJson.default ?? runsJson, runDataDir });
const runs = await loader.listRuns();
const run = runs.find(r => r.run_number === Number(n));
if (!run) return Astro.redirect('/emergence/');
const detail = await loader.getRun(run.id);
---
<Layout title={`${detail.name} | Project Emergence`}>
  <RunDetailComponent run={detail} basePath="/emergence" />
</Layout>
```

- [ ] **Step 4: Create thin day detail page**

```astro
---
// src/pages/emergence/run/[n]/day/[d].astro
import Layout from '../../../../../layouts/Layout.astro';
import DayDetailComponent from '../../../../../emergence/components/DayDetail.astro';
import { createJsonLoader } from '../../../../../emergence/data/json-loader';
import '../../../../../emergence/styles/emergence.css';

const { n, d } = Astro.params;
const runsJson = await import('../../../../../data/emergence/runs/runs.json');
const runDataGlob = import.meta.glob('../../../../../data/emergence/runs/**/*.json', { eager: true });
const runDataDir: Record<string, any> = {};
for (const [path, mod] of Object.entries(runDataGlob)) {
  runDataDir[path] = (mod as any).default ?? mod;
}

const loader = createJsonLoader({ runsJson: runsJson.default ?? runsJson, runDataDir });
const runs = await loader.listRuns();
const run = runs.find(r => r.run_number === Number(n));
if (!run) return Astro.redirect('/emergence/');
const detail = await loader.getRun(run.id);
const day = await loader.getDay(run.id, Number(d));
---
<Layout title={`Day ${d} | ${detail.name}`}>
  <DayDetailComponent day={day} runNumber={Number(n)} totalDays={detail.days.length} basePath="/emergence" />
</Layout>
```

- [ ] **Step 5: Create thin agent profile page**

```astro
---
// src/pages/emergence/run/[n]/agent/[name].astro
import Layout from '../../../../../layouts/Layout.astro';
import AgentProfileComponent from '../../../../../emergence/components/AgentProfile.astro';
import { createJsonLoader } from '../../../../../emergence/data/json-loader';
import '../../../../../emergence/styles/emergence.css';

const { n, name } = Astro.params;
const runsJson = await import('../../../../../data/emergence/runs/runs.json');
const runDataGlob = import.meta.glob('../../../../../data/emergence/runs/**/*.json', { eager: true });
const runDataDir: Record<string, any> = {};
for (const [path, mod] of Object.entries(runDataGlob)) {
  runDataDir[path] = (mod as any).default ?? mod;
}

const loader = createJsonLoader({ runsJson: runsJson.default ?? runsJson, runDataDir });
const runs = await loader.listRuns();
const run = runs.find(r => r.run_number === Number(n));
if (!run) return Astro.redirect('/emergence/');
const agent = await loader.getAgent(run.id, name!);
---
<Layout title={`${agent.name} | ${run.name}`}>
  <AgentProfileComponent agent={agent} runNumber={Number(n)} basePath="/emergence" />
</Layout>
```

- [ ] **Step 6: Remove old Emergence code**

Delete the old loader, types, and any old components that are replaced by the submodule.

```bash
rm -f src/data/emergence/loader.ts src/data/emergence/types/index.ts
```

Remove old page files that are replaced (the tick-shard [slug].astro route).

- [ ] **Step 7: Build and verify**

```bash
npm run build
npm run dev
```

Visit http://localhost:4321/emergence/ and verify hub, run detail, day detail, and agent profile pages render.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: integrate emergence-ui submodule, replace old Emergence pages"
```

---

## Task 11: Integrate into drewconrad.us

Same pattern as Task 10 but for drewconrad.us.  Route prefix is `/project-emergence` instead of `/emergence`.

**Files:**
- Create: `D:\Clanker\drewconrad.us\src\pages\project-emergence\index.astro` (replace)
- Create: `D:\Clanker\drewconrad.us\src\pages\project-emergence\run\[n].astro` (replace)
- Create: `D:\Clanker\drewconrad.us\src\pages\project-emergence\run\[n]\day\[d].astro` (replace)
- Create: `D:\Clanker\drewconrad.us\src\pages\project-emergence\run\[n]\agent\[name].astro` (new)
- Delete: `D:\Clanker\drewconrad.us\src\data\emergence\loaders.ts` (old loader)
- Delete: `D:\Clanker\drewconrad.us\src\types\emergence.ts` (old types)

- [ ] **Step 1: Add emergence-ui as git submodule**

```bash
cd D:/clanker/drewconrad.us
git submodule add git@github.com:tigercubs113/emergence-ui.git src/emergence
```

- [ ] **Step 2: Create thin page files**

Same as Task 10 Steps 2-5, but:
- Layout import: `../../layouts/BaseLayout.astro`
- basePath: `"/project-emergence"`
- Data path: adjust relative imports to match drewconrad.us directory structure

- [ ] **Step 3: Remove old Emergence code**

```bash
rm -f src/data/emergence/loaders.ts src/types/emergence.ts
```

Remove old tick-shard page routes.

- [ ] **Step 4: Build and verify**

```bash
npm run build
npm run dev
```

Visit http://localhost:4321/project-emergence/ and verify all pages.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: integrate emergence-ui submodule, replace old Emergence pages"
```

---

## Task 12: End-to-End Verification

- [ ] **Step 1: Run echoit-site dev server and verify all pages**

```bash
cd D:/clanker/echoit-site && npm run dev
```

Check:
- [ ] Hub page renders with attribution, "what we changed", run cards
- [ ] Run cards show run ID hash, tick count, model, seed, status
- [ ] Run detail shows metadata row, LLM routing, agent cast, chronicle
- [ ] Agent cards show backstory (not raw JSON), health bar
- [ ] Day detail shows activity feed, conversations with transcripts, need states
- [ ] Agent profile shows journal, relationships, decision timeline
- [ ] No "undefined" in tick ranges
- [ ] No 500% need values
- [ ] No composite_modifier visible
- [ ] Mobile viewport (375px) has no unbounded scroll

- [ ] **Step 2: Run drewconrad.us dev server and verify same checklist**

```bash
cd D:/clanker/drewconrad.us && npm run dev
```

Same checklist as Step 1.

- [ ] **Step 3: Verify pages are visually identical between sites**

Compare screenshots or side-by-side browser windows.  Only difference should be the site chrome (header/footer).

- [ ] **Step 4: Push all repos**

```bash
cd D:/clanker/emergence-ui && git push origin main
cd D:/clanker/echoit-site && git push origin master
cd D:/clanker/drewconrad.us && git push origin master
```

- [ ] **Step 5: Verify Vercel deployments**

Check echoit.ai/emergence/ and drewconrad.us/project-emergence/ render correctly on production.
