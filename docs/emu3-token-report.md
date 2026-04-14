# EMU-3 Token Report

Sprint: BL-206 + BL-207 + BL-209
Completed: 2026-04-14

## Per-task token usage

| Task | BL | Subagent self-report | Harness total | Tool uses | Duration |
|------|----|----------------------|----------------|-----------|----------|
| 1 — Agent search filter | BL-206 | ~14,500 | 45,704 | 29 | 116s |
| 2 — DayDetail prev/next | BL-207 | ~22,000 | 53,126 | 32 | 143s |
| 3 — json-loader tests | BL-209 | ~24,000 | 58,084 | 27 | 190s |
| **Total (subagents)** | — | **~60,500** | **156,914** | 88 | 449s |

No prior per-task estimates were set in the plan, so variance is not reportable. Subagent self-reports and harness totals diverge because the harness figure includes system prompt, skill loads, and tool-response bytes, while the self-report is the subagent's internal accounting.

## Suite growth

- Passing floor at entry: 3 files / 14 tests
- Passing count at exit: 5 files / 59 tests
- Net new tests: +45 (Task 1: +8, Task 2: +12, Task 3: +24, +1 absorbed from pre-existing format coverage overlap)

## Notes

Three tasks dispatched in parallel. No merge conflicts between subagents. All three committed independently (ab4bc7e, b058871, 76c4c56) on master.
