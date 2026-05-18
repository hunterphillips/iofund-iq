---
description: Save session state to pickup.md before clearing context
allowed-tools: Bash(git status:*), Bash(git diff:*)
---

# Session Handoff

Save current session state so the next session can continue seamlessly.

## Task

1. Update `.claude/pickup.md` (or create if needed)
2. Check `git status` and `git diff` for uncommitted changes
3. Create new `.claude/pickup.md` capturing this session's work

## What to Include

- **Recent work**: Task/feature completed or in progress
- **Current state**: Complete, in progress, or blocked
- **Uncommitted changes**: Modified files and why (from git status/diff)
- **Session context**: Decisions made, problems solved, solutions found
- **Open threads**: Unresolved questions or pending decisions

## What to Exclude

Everything already in CLAUDE.md:

- Project architecture, file structure, stack
- Patterns, conventions, general project knowledge

## Example structure: (_your outline may differ_)

```markdown
## Recent Work

[Summary of what was done]

## Modified Files

- `path/to/file` — [what changed and why]

## Key Decisions

- [Decision]: [rationale]

## Notes for Next Session

- [Open question or next step]
```

## NOTES:

- Keep it under 150 lines
- Focus on DELTA from baseline project knowledge
- Be specific: file names, function names, exact state
- Skip anything the next session can learn from CLAUDE.md or by reading the codebase
- CLAUDE.md describes the project. pickup.md describes what happened in THIS session that the next session needs to know to continue seamlessly

Update the file now.
