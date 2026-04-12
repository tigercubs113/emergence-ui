# Emergence UI Merge -- Design Spec

**Date:** 2026-04-12
**Status:** Draft
**Scope:** Merge Project Emergence display pages across echoit.ai, drewconrad.us, and the research dashboard into a shared component library.

---

## Problem

Three surfaces display Project Emergence simulation data today:

1. **echoit.ai/emergence/** -- Astro static site on Vercel
2. **drewconrad.us/project-emergence/** -- Astro static site on Vercel
3. **Research dashboard** -- Vite+React app reading live from local Supabase

All three are broken in different ways.  A site audit on 2026-04-12 found 23 bugs across echoit.ai and drewconrad.us (4 blocking, 8 major).  Root cause: each site has its own rendering code consuming export JSON in shapes the templates don't expect.  The research dashboard is a separate React app with no shared code.  Maintaining three independent renderers for the same data is unsustainable.

## Goals

- One component library renders Emergence data everywhere
- Both public sites show identical Emergence pages (mirrored)
- Each site keeps its own non-Emergence content (echoit.ai product pages, drewconrad.us portfolio)
- Architecture supports future migration from static JSON to live Supabase (config change, not rewrite)
- Park et al. "Generative Agents" (2023) attribution is prominent, not a footnote
- Agent count is not hardcoded (currently 7, target eventually 1000+)
- Export contract bugs from the site audit are fixed at the source

## Non-Goals

- Live real-time dashboard (deferred, architecture supports it)
- Pixel-art map page (current map page is being replaced, not reskinned)
- Modifying non-Emergence pages on either site
- Research dashboard React app rewrite (that comes with the Live migration)

---

## Architecture: Git Submodule

A new `emergence-ui` repo mounted as a git submodule at `src/emergence/` in both sites.

**Why submodule over alternatives:**
- NPM package is over-engineered for 2 consumers (publish workflow, version management overhead)
- Copy script risks drift with two builder terminals operating on both repos
- Submodule makes shared code visibly shared with a clean boundary for future Live migration

### Submodule Structure

```
emergence-ui/
  components/             # Astro components
    Hub.astro             # /project-emergence/ hub page content
    RunDetail.astro       # /run/:id/ run detail content
    DayDetail.astro       # /run/:id/day/:n/ day detail content
    AgentProfile.astro    # /run/:id/agent/:name/ agent profile content
    RunCard.astro         # Run listing card (used on hub)
    AgentCard.astro       # Agent cast card (used on run detail)
    ActivityFeed.astro    # Tick-by-tick event feed (used on day detail)
    ConversationBlock.astro
    NeedStates.astro      # Maslow need display (filtered, formatted)
    RelationshipGraph.tsx # Interactive force-directed graph (React island)
    Attribution.astro     # Park et al. standing-on-shoulders block
  data/
    types.ts              # Canonical data types (Run, Agent, Day, etc.)
    loader.ts             # DataLoader interface
    json-loader.ts        # Static JSON implementation (current)
    supabase-loader.ts    # Live DB implementation (future, stubbed)
  styles/
    emergence.css         # All Emergence-specific styles
  utils/
    format.ts             # Need labels, percentages, durations, Title Case
    normalize.ts          # tick_range, personality, status normalization
```

### Host Site Integration

Each host site:
1. Mounts `emergence-ui` as submodule at `src/emergence/`
2. Creates thin page files in `src/pages/project-emergence/` that import the submodule components
3. Passes site-specific layout wrapper (header/footer from the host site)
4. Configures which DataLoader to use (json-loader for now)

Example page file in echoit-site:
```astro
---
import Layout from '../../layouts/Layout.astro';
import Hub from '../../emergence/components/Hub.astro';
import { createJsonLoader } from '../../emergence/data/json-loader';
const loader = createJsonLoader();
const runs = await loader.listRuns();
---
<Layout title="Project Emergence">
  <Hub runs={runs} />
</Layout>
```

---

## Page Structure

### /project-emergence/ -- Hub Page

Three zones:
1. **Hero** -- "AI agents in a world governed by Maslow's hierarchy of needs.  No scripts, no rails -- just survival, cooperation, and whatever emerges."  No agent count in the hero (scales from 7 to 1000+).
2. **Attribution** -- "Standing on the shoulders of Generative Agents."  Links to Park et al. arXiv paper + GitHub repo.  Summary of what Project Emergence inherited vs changed.  2x2 grid: Behavioral Model (Maslow's hierarchy), Tick Engine (three-layer: biological, cognitive, social), Survival Systems (crafting, resources, recipes, skill progression), LLM Routing (multi-model cognitive pipeline).
3. **Run listing** -- Cards showing: run name, run ID hash, model used, tick count, sim days, agent count, PRNG seed, status badge, one-line summary.

### /project-emergence/run/:id/ -- Run Detail

- **Header:** Run name, full UUID, status badge
- **Metadata row:** Ticks, sim days, agents (alive/total), PRNG seed, wall clock duration
- **LLM routing config:** Per-run factual model assignments by call type
- **Agent cast:** Grid of cards (backstory, skills, health bar).  Each links to agent profile.  Component uses pagination/filtering when agent count exceeds 20 (grid for small casts, searchable list for large).  Future-proofs for 1000+.
- **Chronicle:** Day-indexed timeline.  Each day shows tick range, narrative summary, decision count, conversation count.  Links to day detail.
- **Relationship graph:** Force-directed with labeled edges, color-coded by relationship type (friend, acquaintance, close friend, rival), edge weight reflects score.

### /project-emergence/run/:id/day/:n/ -- Day Detail

- **Day header:** Day number, tick range, stat row (decisions, conversations, crafts, rest events)
- **Activity feed:** Chronological event stream with tick numbers, agent names, action types, conversation snippets.  Paginated for high-event days.
- **Conversations:** Full transcript blocks with speaker names, turn count, end reason, relationship changes.
- **Need states:** End-of-day Maslow needs (top 5 physiological + safety).  Raw 0-5 scale, no percentage conversion.  Internal fields filtered.

### /project-emergence/run/:id/agent/:name/ -- Agent Profile (NEW)

- **Agent header:** Name, skills, backstory (from personality_summary), avatar placeholder
- **Stat row:** Health, total decisions, conversations, memories formed
- **Journal:** Chronological journal entries by sim day, styled as diary entries
- **Relationships:** List of known agents with relationship type, score, and trajectory
- **Decision timeline:** Chronological decision list with tick numbers and outcomes

### /project-emergence/live/ -- Live Dashboard (DEFERRED)

Placeholder page.  Architecture supports it via supabase-loader.ts.  Not built in this iteration.

### Removed

- `/project-emergence/run/:id/ticks-X-Y/` -- Tick-shard pages.  These were an export pipeline artifact (20-tick shards), not a meaningful unit.  Replaced by day/:n/ pages where 1 sim day = 100 ticks.

---

## DataLoader Interface

```typescript
interface DataLoader {
  listRuns(): Promise<Run[]>
  getRun(id: string): Promise<RunDetail>
  getDay(runId: string, day: number): Promise<DayDetail>
  getAgent(runId: string, name: string): Promise<AgentProfile>
  getRelationships(runId: string): Promise<Relationship[]>
}
```

**json-loader.ts** (current): Reads from `public/emergence/runs.json` + `public/emergence/run-N/*.json`.  Normalizes data through `normalize.ts` before returning typed objects.

**supabase-loader.ts** (future): Reads from Supabase client.  Same interface, same return types.  Host site picks the loader via config.  Components never know the difference.

---

## Export Contract

The export pipeline in project-emergence writes JSON that json-loader consumes.  These rules fix the 23 audit bugs at the source:

| Field | Rule | Audit Bug Fixed |
|-------|------|-----------------|
| `tick_range` | Always `[start, end]` tuple | #1 undefined-undefined |
| `personality_summary` | Always populated with human-readable backstory | #2 raw JSON dump |
| `personality` | Raw JSON kept for data consumers, never rendered | #2 |
| `manifest.status` | Synced with `runs.json.status` at export time | #3 stale RUNNING badge |
| `narrative` | Populated string or field omitted entirely, never null | #7 "No narrative recorded" |
| `needs` | Raw 0-5 scale, Title Case labels, `composite_modifier` filtered | #9 #10 #11 500% values |
| `conversations` | Full transcript with speaker names, turn count, end reason | #3 "No data available" |
| `sim_day` | Canonical sort key for day ordering | #8 broken chronicle sort |
| `agents_initial` | Single array, no duplication | #15 duplicate arrays |

The `normalize.ts` utility in emergence-ui handles any residual shape mismatches defensively (belt and suspenders), but the export should be correct at the source.

---

## Attribution Design

Prominent block on the hub page:

> **Standing on the shoulders of Generative Agents**
>
> Project Emergence builds on the foundational work of Park et al. (2023) -- "Generative Agents: Interactive Simulacra of Human Behavior."  Their architecture for memory, reflection, and planning is the base layer we inherited.  We rebuilt the tick engine, replaced their behavioral model with Maslow's hierarchy of needs, added a full crafting system with resources, recipes, and skill progression, and redesigned the cognitive pipeline for multi-model LLM routing.  Their work made ours possible.
>
> [Read the paper (arXiv)](https://arxiv.org/abs/2304.03442) | [Their GitHub](https://github.com/joonspk-research/generative_agents)

Not a footer.  Not a badge.  A full content block between the hero and the run listing.

---

## Design Constraints (from audit)

These are not a punch list -- the old code is being replaced.  These are constraints on the new build to avoid repeating the same mistakes:

1. Never render raw JSON to the page.  Always use typed, formatted fields.
2. Never display internal engine fields (composite_modifier, raw need keys) in the UI.
3. Need values are 0-5 scale.  Never multiply by 100 for display.
4. Need labels are Title Case with spaces ("Health Safety" not "Health_safety").
5. Tick ranges come from data, not computed from shard filenames.
6. Status must be consistent across manifest and run listing.
7. Agent cast component must not assume a fixed small N.  Grid below 20 agents, searchable list above 20.
8. Relationship graph must have visible edges with labels and a legend.
9. Mobile: no component should create unbounded vertical scroll from iterating over all agents x all needs.

---

## Deployment

Both sites are Astro on Vercel.  No infrastructure changes.

- **Build trigger:** Vercel builds on push.  The existing export pipeline pushes JSON to both site repos every 20 ticks during a run.  Each push triggers a Vercel rebuild, so the public pages update incrementally as the simulation progresses.
- **No new services:** No Supabase exposure, no new APIs, no new hosting.
- **Incremental updates:** Visitors see new data within minutes of each 20-tick export cycle.  No manual intervention required during a run.

---

## Future: Live Migration Path

When ready to move from static to live:

1. Add `supabase-loader.ts` to emergence-ui implementing the DataLoader interface
2. Host site switches loader config from `json-loader` to `supabase-loader`
3. Expose Supabase with RLS policies (read-only public access to simulation tables)
4. Components render identically -- they consume the same typed data regardless of source
5. The `/live/` page becomes the real-time dashboard with the React research panels

This is a config change + one new file, not a rewrite.
