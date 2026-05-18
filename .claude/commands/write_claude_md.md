---
name: write_claude_md
description: Drafts a CLAUDE.md file for the current project based on codebase analysis or prior architecture discussion.
---

# Write CLAUDE.md

Your task is to draft a CLAUDE.md file that onboards future AI agents to this codebase.

## Core Principles

1. **Less is more**: Aim for <200 lines. Every line must earn its place.
2. **Universal applicability**: Only include information relevant to _every_ session.
3. **Pointers over copies**: Reference file paths, not code snippets (they go stale).
4. **Progressive disclosure**: Point to docs/READMEs for domain-specific details rather than inlining them.
5. **Not a linter**: Omit code style rules—linters handle that. LLMs learn conventions from the codebase itself.

## What to Include

Structure the file around three questions:

### WHAT (The Map)

- Tech stack and key frameworks
- Project structure overview (especially for monorepos)
- Key directories and their purposes

### WHY (The Purpose)

- What the project does in 1-2 sentences
- What the major components/services are for

### HOW (The Workflows)

- How to install dependencies
- How to run the project locally
- How to run tests/typechecks/linting
- How to verify changes work
- Any non-obvious tooling (e.g., `bun` instead of `node`, `pnpm` instead of `npm`)

## What to Exclude

- Overly explicit code style guidelines
- Exhaustive command references (agent can discover these)
- Domain-specific instructions (put in separate docs, reference them)
- Overly specific code snippets (they become outdated)
- Rarely-needed procedures (e.g., database migrations, deployment steps—link to docs instead)

## Process

1. **Gather context**: Review package.json/pyproject.toml, directory structure, existing READMEs, and any prior conversation about architecture.
2. **Identify essentials**: What does an agent need to know in _every_ session?
3. **Draft concisely**: Write in terse, scannable prose. Use short bullet points.
4. **Add doc pointers**: If detailed docs exist (or should exist), reference them rather than duplicating content.

## Output Format

```markdown
# Project Name

[1-2 sentence description of what this project is/does]

## Stack

- [Key technologies, frameworks, languages]

## Structure

- `src/` - [purpose]
- `packages/` - [purpose if monorepo]
- [other key directories]

## Development

### Setup

[Essential setup commands]

### Running

[How to run locally]

### Verification

[How to run tests, typechecks, build]

## Additional Context

- [Pointer to doc]: [brief description of when to read it]
- [Pointer to doc]: [brief description of when to read it]
```

## Remember

- A 100-line CLAUDE.md that's universally relevant beats a 1000-line file full of edge cases.
- If you're unsure whether to include something, leave it out. The agent can ask or discover it.
- This file is read on _every_ session—treat context window space as precious.
