---
name: swuniversity-session-start
description: Use when starting a coding session on the swuniversity repo (this project) — the Next.js SWU learning app with a full rules engine. Orients the agent to current git state, memory, and open work before touching any files. Only for THIS repo, not other SWU-named projects.
---

# SWUniversity Session Start

Orient before doing anything else. This repo already auto-loads `.claude/CLAUDE.md` (stack, layout, conventions, repo rules) — do not re-derive that here. This skill covers the parts that are NOT auto-loaded.

## Steps

1. **Read the memory index.** `MEMORY.md` at
   `/Users/mariotorresjr/.claude/projects/-Users-mariotorresjr-Documents-GitHub-swuniversity/memory/MEMORY.md`
   is not auto-injected — read it explicitly. It's a one-line-per-entry index into topic files
   (engine gotchas, feedback/conventions, project facts). Pull the specific memory files relevant
   to whatever the user is about to ask for (e.g. if the task is a card batch, check
   `engine-*` and `feedback-*` entries before writing engine code).

2. **Read the retro log.**
   `.claude/skills/swuniversity-session-close/references/lessons-learned.md` is the accumulated
   self-retro from every prior session's close (see that skill's step 6) — short, dated, process
   lessons. Read it and actually apply the most recent entries this session; this is what makes
   the session-start/session-close pair self-improving instead of session-close just writing
   into a file nobody reads.

3. **Check git state.**
   ```
   git status
   git log --oneline -10
   ```
   Note the current branch, whether the tree is clean, and whether recent commits already cover
   in-flight work (the user commits manually — never assume uncommitted work is abandoned).

4. **Check open implementation trackers.** `ls *.md` in the repo root for `<set>-implement.md`
   files (e.g. `sor-implement.md`). These track per-card implementation status for a given card
   set. If one exists for the set in question, read its summary table before starting card work —
   it tells you what's done vs. outstanding. Most sets (ASH, JTL, LOF, …) do NOT have one; for
   those, "what's next" is whatever the user pastes as a QA batch, not tracked in a file.

5. **Skim `mechanics.md`** (repo root) if the session involves engine mechanics rather than
   individual cards — it's a rules-coverage gap analysis (✅/⚠️/❌ per mechanic area) separate
   from the per-card trackers.

6. **Confirm test baseline if engine code will be touched.** `npm test` should be green before
   you start; if it isn't, that's pre-existing breakage to flag, not something to silently fix
   as a side effect of unrelated work.

## What NOT to do

- Don't re-read or restate `CLAUDE.md` content — it's already in context every session.
- Don't assume a single "project summary" doc exists — this repo's durable context lives in the
  memory system (many small topic files) plus the per-set tracker files, not one big file.
- Don't commit or push — repo rule, the user commits manually.
