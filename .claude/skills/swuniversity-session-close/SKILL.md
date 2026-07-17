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

6. **Self-retro — this is the self-improving step.** Before writing anything, read
   `.claude/skills/swuniversity-session-close/references/lessons-learned.md` in full (it's short;
   it's the accumulated output of this same step from every prior session). Then answer, as
   yourself, grounded in what actually happened in *this* session's transcript — not a generic
   or hypothetical answer:

   > What were some lessons learned from this session that could improve future development?

   Concretely look for:
   - Any point where you had to backtrack, redo work, or the user corrected your approach —
     what caused it, and what would have avoided it?
   - Any prior lesson from `lessons-learned.md` that this session either **confirmed working**
     (you followed it and it helped) or **violated/repeated** (the same mistake happened again
     despite being logged) — call this out explicitly by name, it's the most valuable signal
     the log can produce.
   - Anything about the codebase, workflow, or this very skill file that made the session slower
     or more error-prone than it needed to be.
   - Skip this step's write (but still note "no new lesson this session") if nothing concrete
     surfaced — don't manufacture a lesson to fill space.

7. **Write the self-retro to `references/lessons-learned.md`.** Append as a new dated entry
   (create the file with a one-line header if it doesn't exist yet) — never overwrite or delete
   prior entries; this file's value is entirely in the trend across sessions. Keep entries terse:
   date, then 1-4 bullet points. If a lesson is really a durable engine/feedback fact rather than
   a process observation, ALSO write it to the memory system per step 2 — the two aren't mutually
   exclusive, but `lessons-learned.md` is specifically for session-to-session process improvement,
   not a substitute for the memory system.

8. **Mention the retro to the user** in one line as part of the report (e.g. "logged a retro note
   about X to lessons-learned.md") — don't make them approve it, this step is autonomous.

## What NOT to do

- Don't invent or maintain a single running project-summary file — that's a different project's
  convention (SWUSim/Karabast), not this repo's.
- Don't commit or push.
- Don't pad the report with a full project overview — only the delta from this session.
- Don't ask the USER the retro question — it's for you to answer about your own performance
  this session, not a prompt to hand back to them.
- Don't skip reading `lessons-learned.md` before writing to it — writing without reading means
  you can't say whether a past lesson held or broke, which is the entire point of keeping it.
