# Process overview

I chose course selection because the information already exists, but students have to connect commencement-year rules, specialisations, course availability and their own history. My direction was to improve that decision, rather than keep inventing features.

The work builds on Opus's account foundation, [7ceef66](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-adithya-rama/commit/7ceef66). I asked the agent to recheck those commits and continue from them. The starter was deployed first and its saved-message flow checked before replacing the interface.

The next milestone grounded the catalogue and degree rules in public ANU sources: [e5dbbc6](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-adithya-rama/commit/e5dbbc6). Important corrections included keeping commencement and teaching years separate, treating exemptions as zero units, and limiting substitutions to their published year. Source-count discrepancies and ambiguous wording remain documented instead of being turned into certainty.

The working student journey is recorded in [37d8c54](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-adithya-rama/commit/37d8c54). Testing exposed an allocation error that used specialisation courses too early as electives. Full-degree and near-miss fixtures now cover every supported specialisation and cohort. Real-browser checks also caught a form-field collision that prevented failed-save recovery, and a low-contrast progress label.

Live testing additionally exposed a memory failure on the 256 MB Fly machine. Limiting runtime memory and serialising password hashing resolved it; the full deployed browser journey then passed. The evidence includes server persistence and ownership tests, migration preservation, and browser journeys at both marking viewports. [Validation notes](docs/VALIDATION.md) distinguish local checks from deployment proof. The reflection uses my own explanation of the breakthrough: understand the wider user situation first, then narrow the implementation to what helps.
