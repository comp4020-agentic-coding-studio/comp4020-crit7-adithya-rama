# Validation and demonstration

## Local evidence
- `pnpm check`: 150 tests passed, with no type errors, warnings or hints (27 September 2026).
- 14 full 96-unit completion fixtures and 14 corresponding near misses, one pair per supported specialisation/cohort. Expected course lists were checked against the captured requirement prose.
- Imported-year, duplicate-ID, credit/exemption, pending/failed study, credit caps, chronological prerequisites, co-requisites, incompatible study, repeat topics, consecutive projects, substitutions, unsupported programs, ownership and competing-edit checks.
- Migration test begins with the original 0000/0001 database, preserves its message and account, and applies the new migrations twice.
- `pnpm check:browser`: Chromium journeys at **1920×1080** and **390×844**. Axe checks include real contrast; page widths show no horizontal overflow on home, catalogue search/details, registration, sources, About, authenticated plan, study and review. Keyboard skip link and visible focus were exercised.
- Both browser journeys test an isolated demo, move a year-limited substitution, replace it with COMP6670 passing contribution/eligibility/availability checks, save and reload, simulate a failed save and retry, add history, adopt the demo into an account, sign out/in, print styling, and restart the server against the same database.
- Machine-readable result: [browser-results.json](browser-results.json). Screenshots: [desktop home](screenshots/desktop-home.png), [desktop plan](screenshots/desktop-plan.png), [phone home](screenshots/mobile-home.png), [phone plan](screenshots/mobile-plan.png).
- The in-app browser runtime could not start in this Windows sandbox. Browser evidence was therefore produced with Chromium through Playwright in WSL.
- Automated checks support the prototype; they are not ANU certification or exhaustive human accessibility testing.

## Demonstration
1. Open the app and choose **Explore an example plan**.
2. Observe the **2025** degree-rules badge while planning **2026**.
3. Inspect COMP8020's contribution and separate permission condition.
4. Move it to 2027: the 2026 substitution no longer applies automatically.
5. Remove that choice, add COMP6670 to Semester 2 2026, and inspect its three checks.
6. Reload, save the demo to a separate prototype account, sign out and sign back in.
7. Open the printable review to see completed, projected and unresolved requirements together.

## Deployment
Starter deployment and its saved-message persistence were verified before implementation. The first planner deployment exposed a 256 MB Fly memory failure during account saving. The correction serialises password hashing, caps the allocation search at 20,000 visits, and limits Node's old heap to 80 MB with a 2 MB semi-space. The course-managed machine size and volume remain unchanged. All full-degree fixtures still pass at the reduced search bound; a bound reached returns uncertainty.

The corrected deployment completed on 27 September 2026. A secure HttpOnly session and its saved fictional plan, created before redeployment, were recovered unchanged afterward using `scripts/live-persistence.mjs`. Probe cookies stay only in ignored `.data`. Fly's CLI DNS probe timed out, but the HTTPS application was reachable; the subsequent live browser suite passed at both required viewports, including demo adoption, account sign-in, academic history, corrected course choices and failed-save retry. See [live-browser-results.json](live-browser-results.json).

## Submission
Working cutoff supplied by course-start output: Wednesday 30 September 2026, 08:30 Canberra. This has not yet been independently reconfirmed by course tooling. Reconfirm before publication. Commits are local and unsigned; pushing and publication remain with the student.
