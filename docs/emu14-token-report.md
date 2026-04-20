# EMU-14 Token Report

| Task | Estimated | Actual |
|------|-----------|--------|
| T0 diagnostic | 4k | ~3k |
| T1 narrow fix | 2k | ~2k |
| T2 live-render test | 3k | ~2k |
| T3 gate + push | 1k | ~1k |
| Total | 10k | ~8k |

## Notes

- Helper extraction taken: `runBadgeClass` now lives in `utils/library.ts`
  alongside `runBadgeText`.  RunCard + RunDetail both call it.  Removes the
  binary ternary in RunCard and the inline three-way in RunDetail, so the
  two surfaces cannot drift again.
- Fix sites: `mapRunWithManifest` (listing path) and `getRun` (detail path).
  Both now merge `status: manifest.status ? normalizeStatus(manifest.status)
  : base.status`.  Manifest wins; runs.json falls back; normalizeStatus
  preserves type safety.
- T2 added 3 loader-path tests under `manifest.status propagation (EMU-14)`:
  listRuns + getRun propagation + legacy-manifest fallback.
- vitest 158/0 (155 baseline + 3 new).
