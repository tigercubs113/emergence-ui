# emergence-ui -- Architecture Map

Relocated from CLAUDE.md during the v2 builder-CLAUDE.md re-baseline (file structure does not belong in CLAUDE.md; subagents read this map for orientation, main context never loads it).

## Repo Structure

```
emergence-ui/
  components/       # Astro components (Hub, RunDetail, DayDetail, AgentProfile, etc.)
  data/             # DataLoader interface, json-loader, types
  styles/           # Shared CSS
  utils/            # Format + normalize utilities
  utils/__tests__/  # Vitest tests
  data/__tests__/   # Vitest tests
```
