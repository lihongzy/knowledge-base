# Issue tracker: Local Markdown

Issues and specs for this repository live as Markdown files in `.scratch/`.

## Conventions

- One feature per directory: `.scratch/<feature-slug>/`.
- The feature specification is `.scratch/<feature-slug>/spec.md`.
- Implementation issues live at `.scratch/<feature-slug>/issues/<NN>-<slug>.md`, numbered from `01`; do not combine them into one ticket file.
- Record triage state near the top of each issue as `Status:` using the role strings in `triage-labels.md`.
- Append discussion under a `## Comments` heading.

## Publishing and reading issues

When a skill says to publish an issue, create the relevant file under `.scratch/<feature-slug>/`. When it says to fetch an issue, read the referenced file path or number.

## Wayfinding operations

- Map: `.scratch/<effort>/map.md` records notes, decisions, and open questions.
- Child ticket: `.scratch/<effort>/issues/NN-<slug>.md` includes `Type:` (`research`, `prototype`, `grilling`, or `task`) and `Status:` (`claimed` or `resolved`).
- Dependencies: list them as `Blocked by: NN, NN`; a ticket is unblocked when every listed ticket is resolved.
- Frontier: choose the lowest-numbered open, unblocked, unclaimed issue.
- Claim: set `Status: claimed` before work begins.
- Resolve: add an `## Answer` section, set `Status: resolved`, and add a context pointer to the map's decisions.
