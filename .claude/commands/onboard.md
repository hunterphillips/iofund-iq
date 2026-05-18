---
name: onboard
description: Get familiar with the codebase by exploring structure, patterns, and documentation. Use when starting fresh on a project without prior context.
argument-hint: [area to focus on (optional)]
tools: Read, Bash, Grep, Glob, LS
---

# Onboard

You are joining a project for the first time. Your job is to efficiently build a mental model of the codebase so you can contribute effectively. Focus on understanding architecture, patterns, and conventions before diving into specifics. You can assume the current build and listing errors have already been tested unless specifically noted.

## Available Agents

Use these agents to accelerate exploration:

- **@agent-codebase-analyzer** — Understand overall architecture and structure
- **@agent-codebase-locator** — Find specific files, components, or functionality
- **@agent-pattern-finder** — Identify conventions and patterns used in the codebase

## Initial Response

When invoked, orient yourself:

```
I'm onboarding to this project. I'll systematically explore to understand:

1. What this project does and its core purpose
2. How the codebase is organized
3. Key patterns and conventions used
4. How to build, run, and test

I'll read existing documentation first, then use exploration agents to understand the code structure.
```

## Onboarding Process

### Step 1: Read Existing Documentation

Check for and read these files (in order of priority):

```bash
# Project-specific Claude instructions
cat .claude/CLAUDE.md 2>/dev/null
cat .claude/communication_guidelines.md 2>/dev/null

# Standard project docs
cat README.md 2>/dev/null
cat CONTRIBUTING.md 2>/dev/null
cat docs/ARCHITECTURE.md 2>/dev/null

# Package/dependency info
cat package.json 2>/dev/null | head -50
cat pyproject.toml 2>/dev/null
cat Cargo.toml 2>/dev/null
cat go.mod 2>/dev/null
```

### Step 2: Understand Project Structure

Use **@agent-codebase-analyzer** to map the high-level organization:

- Entry points (main files, index files)
- Core business logic location
- Test organization
- Configuration approach
- Dependency graph between modules

Supplement with manual exploration if needed:

```bash
# Top-level structure
ls -la

# Directory tree (depth 2-3)
find . -type d -not -path '*/\.*' -not -path '*/node_modules/*' -not -path '*/venv/*' -not -path '*/__pycache__/*' | head -40
```

### Step 3: Discover Patterns and Conventions

Use **@agent-pattern-finder** to identify:

- Naming conventions (files, functions, variables)
- Code organization within files
- Error handling patterns
- Import/module structure
- Testing patterns

Check for explicit configuration:

```bash
# Linting/formatting config
ls -la .eslintrc* .prettierrc* .editorconfig pyproject.toml .rustfmt.toml 2>/dev/null
```

### Step 4: Understand Development Workflow

```bash
# Build and run commands
cat Makefile 2>/dev/null | head -30
cat package.json 2>/dev/null | grep -A 20 '"scripts"'
cat justfile 2>/dev/null | head -30

# CI/CD setup
ls -la .github/workflows/ 2>/dev/null
cat .github/workflows/*.yml 2>/dev/null | head -50

# Git state (are we mid-work?)
git status 2>/dev/null
git branch 2>/dev/null
```

### Step 5: Build Mental Model

Synthesize your understanding into a mental model:

- **Purpose**: What problem does this solve?
- **Architecture**: How is it structured and why?
- **Data flow**: How does information move through the system?
- **Key abstractions**: What are the core concepts/entities?
- **Extension points**: Where would new features go?

Use **@agent-codebase-locator** to find specific components as questions arise.

## Output Format

Summarize your understanding:

```markdown
## Project Overview

**Purpose**: [What this project does in 1-2 sentences]

**Tech Stack**: [Languages, frameworks, key dependencies]

## Architecture

**Structure**:

- `src/` — [what's here]
- `lib/` — [what's here]
- `tests/` — [how tests are organized]

**Key Components**:

- [Component]: [responsibility]
- [Component]: [responsibility]

**Patterns Observed**:

- [Pattern]: [where/how it's used]

## Development

**Setup**: [how to get running]
**Build**: [build command]
**Test**: [test command]

## Ready to Contribute

I now understand the project structure and conventions. What would you like to work on?
```

## Focus Areas (Optional Argument)

If a specific area is provided, use **@agent-codebase-locator** to find relevant code and dive deeper:

- **`backend`** / **`api`**: Focus on server-side code, routes, data layer
- **`frontend`** / **`ui`**: Focus on components, state management, styling
- **`tests`**: Focus on test patterns, coverage, fixtures
- **`[directory]`**: Focus exploration on that specific directory

## Exploration Principles

- Get the full picture before diving into details
- Understand how pieces connect
- Trust explicit documentation over assumptions
- Prioritize entry points and core modules
- Use agents to accelerate discovery, then verify with direct reading

**Note conventions**:

- Observe patterns you should follow
- Identify project-specific idioms

## Quick Reference

```bash
# Find documentation
find . -name "README*" -o -name "*.md" | grep -v node_modules | head -20

# Understand dependencies
cat package.json | jq '.dependencies, .devDependencies' 2>/dev/null
cat requirements.txt 2>/dev/null
cat go.mod 2>/dev/null

# Find main entry points
find . -name "main.*" -o -name "index.*" -o -name "app.*" | grep -v node_modules | head -10

# Recent activity (what's being worked on)
git log --oneline -10 2>/dev/null
```

## Important Guidelines

- **Don't assume**: Let the codebase tell you its patterns
- **Read before exploring**: Documentation may answer your questions
- **Respect conventions**: Note patterns to follow in future contributions
- **Stay oriented**: Keep the big picture in mind as you explore details
- **Ask if unclear**: If something doesn't make sense, ask rather than guess

## Limitations

Some context may require user input:

- Business domain knowledge
- Historical decisions not documented
- Planned future direction
