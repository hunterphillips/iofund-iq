---
description: Resume work by loading project context and previous session state
argument-hint: [specific task or question (optional)]
---

# Resume Session

Pick up where we left off on this project.

## Step 1: Load Context

Read these files in order:

1. **Project context**: `.claude/CLAUDE.md` — understand the codebase, stack, and workflows
2. **Session state**: `.claude/pickup.md` — what was in progress, recent changes, open threads

## Step 2: Orient

After reading, briefly confirm:

- What was being worked on
- Current status (complete, in progress, blocked)
- Any uncommitted changes or pending decisions

## Step 3: Continue

$ARGUMENTS

If no specific task provided, ask what to focus on next based on the pickup context.

## Tools Available

Use these agents as needed to investigate the codebase:

- `@.claude/agents/codebase-analyzer.md` — understand how code works
- `@.claude/agents/codebase-locator.md` — find relevant files and components

## Guidelines

- Don't re-explain project basics already covered in CLAUDE.md
- Reference pickup.md context naturally, don't recite it back verbatim
- If pickup.md is missing or empty, note this and ask for direction
- Prioritize continuity—pick up the thread, don't start fresh
