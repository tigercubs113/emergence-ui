---
status: BUILDER_DONE
pi: EMU-2
type: bugfix
file_limit: 0
build_spec: inline
updated_by: builder
updated_at: 2026-04-12T13:45:00Z
error: null
---

## Instructions

Fix the three HIGH-priority data layer bugs in `data/json-loader.ts` found during code review.  These cause entire page sections to render empty.

### BL-201: getDay() Activity Feed empty

`getDay()` checks `shard.events` but export produces `shard.actions_summary[].actions[]`.  Flatten actions_summary into the events array the same way `getAgent()` already does (see lines ~237-252 for the pattern).

In the `getDay()` shard loop, after the conversations block, add:

```typescript
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
```

Remove the existing `if (shard.events) events.push(...)` block since this replaces it.

### BL-202: getDay() Need States empty

Loader checks `shard.agent_states` but export writes `shard.agents`.  Also, `agents[].needs` is a flat `Record<string, number>` (e.g. `{"hunger": 3.4}`) not `{label, value, max}[]`.

Replace the `if (shard.agent_states)` block with:

```typescript
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
```

### BL-203: Relationships not populated from shards

`getRun()` reads `manifest.relationships` which doesn't exist.  Relationships live in each shard as `{agent_name, target_name, status, impression_score}`.

In `getRun()`, aggregate relationships from shard data instead of the manifest:

```typescript
// After the dayMap loop, before the return
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
```

Then in the return object, replace `relationships: manifest.relationships ?? []` with `relationships: Array.from(relationshipMap.values())`.

### Test:

```bash
npx vitest run
```

Existing tests must pass.  Verify by checking the data structures manually:

```bash
node -e "
const fs = require('fs');
const d = JSON.parse(fs.readFileSync('../echoit-site/src/data/emergence/runs/run-19/ticks-0-19.json','utf8'));
console.log('Has actions_summary:', !!d.actions_summary);
console.log('Has agents:', !!d.agents);
console.log('Has relationships:', !!d.relationships);
"
```

### Commit prefix: EMU-2

When done, set BUILDER_DONE with list of changes made and any issues found.

## Results

All 3 HIGH-priority bugs fixed in `data/json-loader.ts`.  14/14 tests pass.  Real data shape verified against `echoit-site/src/data/emergence/runs/run-19/ticks-0-19.json` -- confirms `actions_summary`, `agents`, and `relationships` fields all present.

**Changes:**
- BL-201: `getDay()` now flattens `shard.actions_summary[].actions[]` into events array (same pattern as `getAgent()`)
- BL-202: `getDay()` now checks `shard.agents` in addition to `shard.agent_states`, and handles both `Record<string,number>` and `{label,value,max}[]` needs formats
- BL-203: `getRun()` now aggregates relationships from shard data instead of reading nonexistent `manifest.relationships`

## New Findings

No new issues found.

## Commits

- `fb23963` EMU-9: fix: getDay() activity feed, need states, and relationship aggregation
