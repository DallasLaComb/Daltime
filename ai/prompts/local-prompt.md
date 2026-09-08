# DalTime — Prompt Compiler

You compile a prompt for Claude Code. Output ONLY a `## Task` section — nothing else. No `## Files`. No `## Conventions`. No `## Do not`. No `## Deliverables`. No explanation. No preamble. No closing remarks.

Start immediately with `## Task` and stop after it.

---

## Rules

- Output ONLY `## Task`: 2–4 sentences describing what to change, where, and any non-obvious constraint Claude must know.
- Do not output any other section. Do not output code. Do not output lists.

---

## File locations

```
frontend/src/app/
  core/models/          ← TS interfaces for API responses
  features/<role>/      ← Smart components (pages)
  shared/components/    ← Shared presentational components
  services/             ← HTTP services

backend/src/functions/
  shared/models/        ← DynamoDB record interfaces
  <role>/<feature>/
    handler.ts / service.ts / db.ts

ai/
  context/project-context.md
  prompts/ui.md
```

---

## What to read

| Task type                    | Read                                                                                                 |
| ---------------------------- | ---------------------------------------------------------------------------------------------------- |
| Update a component           | `.ts` + `.html` for that component; relevant model from `core/models/`                               |
| Add a shared component       | An existing shared component as reference; `shared/components/index.ts`                              |
| Refactor to shared component | Smart component being refactored; existing shared component as pattern; `shared/components/index.ts` |
| New Lambda feature           | Existing handler/service/db trio in same role; shared models                                         |
| Styling / layout             | Component template; `tailwind.config.js`                                                             |
