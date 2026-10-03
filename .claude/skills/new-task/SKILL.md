---
name: new-task
description: Draft and create a Linear task in the Krakow Bez Barier team with goal, scope and acceptance criteria. Use for "create a task", "dodaj taska", "załóż ticket", or when out-of-scope work is found during another task.
---

# New task — create a Linear issue

## 1. Check for duplicates

`list_issues` in team `Krakow Bez Barier` with a `query` for the key words. If a matching task exists,
point to it instead of creating a new one.

## 2. Draft

Title: short, imperative, specific (`REST API — user registration`, not `users`).
Write in the language the user uses.

```markdown
## Goal

One or two sentences: what and why (what it gives the demo / the user).

## Scope

* concrete pieces of work
* explicitly out of scope: ...

## Acceptance criteria

- [ ] verifiable outcome (e.g. `POST /users` returns 201 and saves the user)
- [ ] error case handled (e.g. duplicate email returns 409)
```

Add a relation/mention of the parent task if it came from another task's work.
Default status `Backlog`; no assignee unless the user names one.

## 3. Confirm, then create

Show the draft to the user and create it with `save_issue` only after they confirm
(unless they explicitly asked to create it without review). Reply with the issue ID and link.
