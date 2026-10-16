# Team Protocol — Travel Agency (3 agents, 1 folder)

Root: `/home/anwar/Documents/grabio space/travel-agency/team/`
Context docs: `../README.md`, `../architecture.md`, `../backlog.md`, `../decision-log.md`, `../Airial-for-Travel-Agents.pdf`

## Roles
| Role | App | Does | Never does |
|------|-----|------|-----------|
| Planner (senior) | VS Code | Specs, tasks, reviews, priorities, UI/UX gate | Writes app code |
| Builder | Cursor | Implements tasks in `../web` and `../../functions` | Changes scope, marks own work "accepted" |
| Tester | Other app | Tests builds, writes bug reports | Fixes code, edits tasks |

## Folder map (who writes where)
| Folder / file | Writer | Reader | Purpose |
|---------------|--------|--------|---------|
| `STATUS.md` | Planner (owner); others append one line per event | All | Single board: slice, status, owner, last update |
| `tasks/` | Planner | Builder, Tester | One file per task: `S{n}-{slug}.md` |
| `builder-reports/` | Builder | Planner, Tester | One report per task: `S{n}-{slug}.report.md` |
| `test-reports/` | Tester | Planner, Builder | `S{n}-{slug}.test-{YYYYMMDD}.md` (+ screenshots in `test-reports/assets/`) |
| `planner-reviews/` | Planner | Builder, Tester | Verdict: `S{n}-{slug}.review.md` |

## Workflow
1. Planner writes `tasks/S{n}-*.md` and sets STATUS = `READY`.
2. Builder reads the task, sets STATUS = `BUILDING`, implements, writes the builder report, sets STATUS = `READY_FOR_TEST`.
3. Tester tests against the task's acceptance criteria, writes the test report, sets STATUS = `TESTED_PASS` or `TESTED_FAIL`.
4. Planner reviews code, UI and test report, writes the review, sets STATUS = `ACCEPTED` or `REWORK`.
5. On `REWORK`, the builder fixes only the listed items, then repeats from step 2.

STATUS values: `READY` > `BUILDING` > `READY_FOR_TEST` > `TESTED_PASS` / `TESTED_FAIL` > `ACCEPTED` / `REWORK` / `BLOCKED`.

## Rules for everyone
- Before starting, read `STATUS.md` and your task file. Do not start work that is not `READY` for you.
- Do not edit another role's files. Reply in your own folder.
- Questions or blockers: add a `BLOCKED` line in STATUS.md plus a `## Questions` section in your report. Do not guess.
- Never write passwords, tokens or API keys in any file here. Name the field in `/home/anwar/Documents/grabio space/.credentials.md` instead (check the monorepo root if it is not there).
- Staging URL and demo login live in `.credentials.md` under "Travel Agency — staging demo login".
- Real data only where a source exists; demo data must be clearly demo.
- No deploy or push without Anwar's explicit confirmation that tests passed.
- Short reports. Facts, file paths, evidence. No filler.

## UI gate (every slice)
Grabio design language, mobile-first on client-facing pages, loading/empty/error states, zero console errors, no new UI patterns without planner approval.
