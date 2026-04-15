# EMU-4 Token Report

Sprint: Reporting Tiers + Per-Agent Dashboard
Completed: 2026-04-15

## Per-task token usage

| Task | Scope | Subagent self-report | Harness total | Tool uses | Duration |
|------|-------|----------------------|----------------|-----------|----------|
| T5 — Loader additions + tests | listActive/Ended + dashboard | ~35,000 | 72,432 | 32 | 243s |
| T3 — AgentDashboard component | per-agent row grid + helpers | ~29,000 | 68,588 | 23 | 138s |
| T4 — DayDetail narrative + paused CSS | BL-228 + narrative render | ~18,500 | 54,820 | 26 | 123s |
| T1 — NowRunning tier | tier + Hub wire + dashboard embed | ~27,000 | 62,023 | 29 | 216s |
| T2 — Library tier | tier + Hub extension | ~18,000 | 59,824 | 29 | 158s |
| **Total (subagents)** | — | **~127,500** | **317,687** | 139 | 878s |

No prior per-task estimates were set in the plan, so variance is not reportable.  Subagent self-reports and harness totals diverge because the harness figure includes system prompt, skill loads, and tool-response bytes, while the self-report is the subagent's internal accounting.

## Suite growth

- Passing floor at entry: 5 files / 59 tests
- Passing count at exit: 9 files / 118 tests
- Net new tests: +59 (T5 +16, T3 +18, T4 +0, T1 +14, T2 +11)
- Exit target was 6+ files / 70+ tests -- exceeded on both dimensions.

## Notes

Five tasks dispatched across four waves.  T5 ran first (loader infra).  T3 and T4 followed (intended parallel, executed sequentially due to a single-dispatch on my part — no impact on outcome).  T1 and T2 ran serially because both touched Hub.astro; T1 deliberately scoped additive Hub edits so T2's merge stayed clean.  Zero merge conflicts, zero regressions.  All five commits (3cd7caa, 59025d1, e690e34, d70fbe1, 98f5879) landed directly on master.
