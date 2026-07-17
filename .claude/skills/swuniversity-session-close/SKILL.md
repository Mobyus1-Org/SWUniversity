---
name: swuniversity-session-close
description: Use when the user wants to wrap up a coding session on the swuniversity repo (this project) and hand off to the next agent. Summarizes what changed, checks for unsaved learnings and uncommitted work. Only for THIS repo, not other SWU-named projects.
---

# SWUniversity Session Close

This repo has no single "project summary" doc to update — durable context lives in the
per-topic auto-memory files and, for card sets with one, the `<set>-implement.md` tracker.
This skill's job is to make sure both are actually current, then hand the user a clean summary.

## Steps

1. **Gather the session diff.**
   ```
   git status
   git diff HEAD --stat
   git log --oneline -10
   ```

2. **Check for unsaved memory-worthy learnings.** Scan back over the session for anything that
   matches the auto-memory triggers (a user correction/confirmation on approach, a non-obvious
   engine gotcha discovered, a project fact/deadline learned) that you have NOT yet written to
   `/Users/mariotorresjr/.claude/projects/-Users-mariotorresjr-Documents-GitHub-swuniversity/memory/`.
   Write any that are missing (see the memory-type definitions already governing this session —
   `feedback-*`, `engine-*`, `project-*`, `reference-*`). Don't write duplicates of what's already
   there; check `MEMORY.md` first.

3. **Update the relevant `<set>-implement.md` tracker**, if one exists for the set touched this
   session and it wasn't already updated card-by-card during implementation (the
   `implement-swu-card` skill normally does this per card — this is a safety-net check, not a
   redo).

4. **Verify test/lint status** if engine or component code changed: `npm test`, `npx tsc --noEmit`.
   Report pass/fail, don't just assert it.

5. **Report to the user:**
   - What changed this session (from the git diff/log), grouped sensibly (cards implemented,
     skills edited, engine mechanics added, etc.)
   - Any memory files written or updated
   - Test/lint status
   - Whether there are uncommitted changes — remind them they commit manually, never commit
     or push yourself
   - What the natural next task is, if one is obvious (e.g. remaining cards from a batch that
     hit the cap, a tracker's next-priority entry, an open question left unresolved)

## What NOT to do

- Don't invent or maintain a single running project-summary file — that's a different project's
  convention (SWUSim/Karabast), not this repo's.
- Don't commit or push.
- Don't pad the report with a full project overview — only the delta from this session.
