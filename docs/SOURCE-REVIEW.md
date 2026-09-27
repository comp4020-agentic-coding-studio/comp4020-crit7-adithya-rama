# Source review and ambiguity register

Reviewed snapshot: 27 September 2026. Raw responses are cached locally in ignored `.data/source-cache`. Committed metadata and source extracts retain URLs, retrieval times and SHA-256 hashes. The application serves its snapshot without contacting ANU during planning.

## Coverage
- 11,430 program, course, major, minor and specialisation metadata entries across 2025–2027.
- Two Master of Computing commencement cohorts; seven formal specialisations for each, with 14 independent full-degree and near-miss test scenarios.
- 174 course/year source extracts. Compound conditions are encoded only where reviewed; unreviewed and topic-specific conditions remain unknown.
- The public API uses `SelectedYear`. Wrong years, conflicting identifiers and empty responses are rejected before promotion.
- `ShowAll=true` returns more entries than the API's reported total for some endpoints (for example, 2025 courses: 3,118 returned versus 500 reported); some subplan totals also disagree. The manifest records both. Whitespace-only identical duplicates are collapsed; conflicting duplicates fail. This is the complete returned snapshot, not a claim that ANU's inconsistent totals have been independently reconciled.

## Decisions grounded in official sources
The formal [2025 MCOMP rules](https://programsandcourses.anu.edu.au/2025/program/7706XMCOMP) and [2026 rules](https://programsandcourses.anu.edu.au/2026/program/7706XMCOMP) determine compulsory courses and elective space. University electives have no invented 6000-level minimum. Specialisation allocations consume units once; aggregate level requirements inspect those same units.

The [computing substitution page](https://systems.anu.edu.au/students/continuing/substitutions/computing-course-substitutions/) determines effective teaching years, including COMP8280 for COMP8260, COMP8020 for COMP8539 in HCCM, and ENGN8100 recognition within professional/software specialisations. Prerequisite checks remain separate. Personal decisions preserve program, cohort, period, status, reference and date.

[COMP8715](https://programsandcourses.anu.edu.au/2026/course/COMP8715) needs two consecutive six-unit attempts. [COMP8020](https://programsandcourses.anu.edu.au/2026/course/COMP8020) permits repeated different topics; missing or repeated topic names do not establish additional credit.

## Unresolved source wording
| Issue | Behaviour |
| --- | --- |
| 2026 formal program list includes Software Development, while a separate links section still includes Professional Computing | Offer the seven formal pathways. Preserve the old PCOM page as source evidence; do not advertise it as an eighth reviewed 2026 pathway. |
| 2026 project wording says a maximum of 12 units, while explanatory text describes a capstone | Encode the published maximum, flag plans below 12 project units for confirmation, withhold a clean completion claim. |
| Data Science says 12 units at 8000 level but its options include further 8000 courses | Flag an allocation above 12 specialisation-level units for confirmation. The 2026 option list excludes STAT6039; 2025 includes it. |
| COMP8350 substitution names HCCC-SPEC, whereas the postgraduate pathway is HCCM-SPEC | Do not silently extend it. The separately explicit COMP8539 → COMP8020 HCCM substitution is supported. |
| Permission, GPA, topic-specific conditions and unclear program equivalence | Display the original source and “needs confirmation”; a prerequisite waiver does not override program membership or incompatibilities. |
| Future offerings | Published future entries are indicative; absent data is unknown. |

## Maintaining releases
Edit authored definitions in `scripts/build-rules.mjs`, regenerate, and freeze with `scripts/freeze-release.mjs`. Once frozen, changing the same release is rejected. A new release needs a new identifier in the importer, builder and catalogue module, and a new frozen file. Retain old files and database catalogue rows. Saved plans select their own frozen rule release; the explicit refresh action rechecks a new release. Seeding never deletes user records.

The deterministic search has a bounded state budget. Reaching the bound means “needs confirmation”, never a completion certificate. Source review is a prototype implementation review, not university approval.
