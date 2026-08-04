# Design documentation

Everything the design team produced while building Rather Be Knee Deep. Start with `requirements.md`.

| File | What it is |
|---|---|
| `requirements.md` | **The living requirements record.** Shipped, agreed, proposed, deferred. Edited via the Claude project doc, mirrored here for version history. |
| `design-state.md` | Shared state: decisions log, open questions, design debt register, handoff chain between agents. |
| `brief.md` | The original design brief — problem, users, constraints, success criteria. |
| `brief-scope-revision-1.md` | Director's mid-project scope change. **Supersedes the brief on conflicts.** |
| `strategy.md` | Architecture, question flow, and both matching models. The matching logic lives here. |
| `personas.md` | Priya, Dana, Marcus, Jordan, and Nicole as a stress case. |
| `visual-system.md` | Tokens, type, spacing, components. Real values. |
| `badge-system.md` | The 52-motif badge library, assignment rules, palette rotation. |
| `copy-deck.md` | Every user-facing string and the register they're written in. |
| `motion-spec.md` | Durations, easings, and the reduced-motion path for each animation. |
| `inspiration-directions.md` | The three visual directions; Base Camp Bright was chosen. |
| `competitive-analysis.md` | What every other ski-recommendation tool does, and where the gaps are. |
| `build-notes.md` | Build log, verification evidence, deviations. |
| `reviews/` | Design critique, accessibility audit, heuristic evaluation, synthetic persona testing. |

## The rules that aren't negotiable

Written down because they're easy to break by accident:

1. **Never fabricate a hot take.** No take → no take block. Absence is honest; invention destroys the credibility the section exists to create.
2. **Never present historical data as a live forecast.** Labelled typical-season data is fine. Unlabelled is not.
3. **Hot takes carry no ranking weight.** Commentary only — ranking stays on the data.
4. **Mixed-ability scoring is a min-max bottleneck, never an average.** This is the product's main differentiator.
5. **Accessibility is built in, not added.** No sliders, no drag, no colour-only meaning, reduced motion as a real path.

## Working on this

Edit `src/`, never `public/index.html` — it's generated. Run `python build.py`, then the verification scripts in the repo root. Commit and push; GitHub Actions deploys automatically.
