# Feature docs

One file per feature: **what it does and the rules it enforces**, in plain language, so a human or an
AI can understand a feature without reading its code.

| Feature            | Doc                      | Status               |
| ------------------ | ------------------------ | -------------------- |
| Auth (admin)       | [auth.md](auth.md)       | Built                |
| Country            | [country.md](country.md) | Built                |
| Plan (single trip) | [plan.md](plan.md)       | Spec — not built yet |

Order of work and project-wide decisions live in the root `ROADMAP.md`, not here.

## What goes where

| File                                | Answers                                            |
| ----------------------------------- | -------------------------------------------------- |
| `../../ROADMAP.md` (root)           | What we build, in what order, decisions locked     |
| `docs/features/<feature>.md` (this) | What a feature does: data, rules, endpoints, flows |
| `AGENTS.md`                         | How to write the code                              |
| `src/features/docs/spec/` (OpenAPI) | Exact request/response shapes                      |

Don't repeat another file's content — link to it. Duplicates drift.

## Workflow

1. **Before coding** a feature, write (or update) its doc and agree on it. Commit it on its own
   (`docs(<feature>): ...`).
2. Build the feature against the doc.
3. If a rule changes while building, update the doc **in the same commit** as the code.
4. If the doc and the code disagree, the code wins — fix the doc.

## Template

Keep it short — roughly one or two screens. Use the sections that apply; skip the rest.

```md
# <Feature>

> Status: Spec | Built — code in `src/features/<feature>/`

## Purpose

What it does, for whom. One paragraph.

## Out of scope

What it deliberately does not do (and where that lives instead, if anywhere).

## Data model

Tables, key fields, relations. Point to the `.prisma` file instead of pasting it.

## Business rules

Numbered, testable statements ("Tiers of one plan must not overlap").

## Endpoints

| Method | Path | Who | What |
| ------ | ---- | --- | ---- |

Shapes live in OpenAPI — list routes and their purpose only.

## Interactions

What other features read from / write to this one.

## Open questions

Undecided points, with a proposal.
```
