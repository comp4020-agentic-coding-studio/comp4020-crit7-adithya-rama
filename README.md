# Know what counts.

Programs & Courses — Study Planner is a student-built response to ANU's course-selection problem. It connects public catalogue information to the degree rules a student actually follows, their completed study, and their future choices.

This is an independent COMP4020 Crit 7 prototype. It has no ANUHub access and does not enrol students or certify graduation.

## Try it

Choose **Explore an example plan** for an isolated fictional Master of Computing student. Change a future choice, inspect its explanation, then reload. Create a separate prototype account to retain your example, or start your own plan and enter your academic history.

The catalogue includes 11,430 entries across 2025–2027. Students in any listed program can save manual plans. Automatic requirement checking supports Master of Computing commencing in 2025 or 2026, with seven specialisations for each cohort.

## What good looks like

A student should understand three separate questions: does a course contribute to the degree, can they enrol in it, and is it offered in their selected semester? An explanation and a source are more useful than an unexplained green tick.

Commencement-year rules stay fixed when browsing a different teaching year. Completed records and future selections are separate. Credit contributes only to permitted categories; exemptions carry zero units. Pending approvals, unknown prerequisites and indicative future offerings stay visible as uncertainty.

The interface uses a restrained catalogue layout, a semester map, and a printable review. Keyboard use, mobile layout, error recovery and persisted state are part of the product, not finishing touches.

## Grounding

- [MCOMP 2025](https://programsandcourses.anu.edu.au/2025/program/7706XMCOMP) and [MCOMP 2026](https://programsandcourses.anu.edu.au/2026/program/7706xmcomp)
- [Credit and exemptions](https://www.anu.edu.au/students/program-administration/program-management/get-course-credit-or-exemption)
- [Year-scoped computing substitutions](https://systems.anu.edu.au/students/continuing/substitutions/computing-course-substitutions/)
- [Crit 7 brief](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/crits/07-anu-system/)

Public source snapshots retain retrieval times and hashes. The importer validates years and duplicate identifiers; source-count discrepancies are recorded rather than hidden. Rule coverage and unresolved wording are documented in the repository.

## Boundaries

Records and individual approvals are entered by the student. This prototype cannot independently verify them. Unreviewed prerequisites remain unknown; no generative AI makes eligibility decisions. A projected plan depends on passing future study and obtaining any necessary permissions.

Automatic checking for other degrees, ANU authentication, transcript uploads, timetable clash detection and automatic whole-degree scheduling are outside this crit.

## Development

Use the pinned tools in WSL: `mise exec -- pnpm check` for type, build, HTTP and rule checks, and `mise exec -- pnpm check:evidence` for the submission record. SQLite migrations apply at startup. The Fly volume preserves the database across application deployments.

Keep the Fly token only in ignored `mise.local.toml`. Never use an ANUHub password for this prototype.

Browser verification: run `mise exec -- pnpm check:browser` after building. Install Chromium with `pnpm exec playwright install chromium` if needed. Source coverage and unresolved interpretations are recorded in [the source review](/sources).

