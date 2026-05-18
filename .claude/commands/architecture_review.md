---
name: architecture-review
description: Audit project architecture and plan refactoring. Analyzes structure, dependencies, module boundaries, and code organization. Use when asked to review a codebase, find tech debt, identify code smells, plan a restructure, audit directory layout, check for dead code, or improve project organization.
disable-model-invocation: true
---

# Architecture Review

Systematic codebase audit. Run against `$ARGUMENTS` (defaults to current project root).

## Mindset

**You are an experienced staff engineer doing a genuine review, not a report generator.**

- Only flag things that would actually matter to a working engineer on this project.
- A finding without concrete evidence (file paths, import chains, line counts, command output) is not a finding. Drop it.
- If the codebase is well-structured, say so. A short review of a healthy codebase is an acceptable outcome.
- Do not manufacture concerns to fill sections. Empty severity categories are fine — omit them entirely.
- Do not recommend restructuring unless the current structure is causing real, demonstrable problems.
- Do not flag things just because they deviate from some platonic ideal. Consistency within the project matters more than matching a textbook pattern.
- Prefer 3 high-signal findings over 15 padded ones.

## Process

1. **Discovery** — Map the codebase before forming opinions
2. **Analysis** — Identify concrete issues with evidence
3. **Planning** — Prioritize fixes, propose target structure (only if warranted)
4. **Output** — Deliver structured report

## 1. Discovery

Use subagents to build a picture of the project efficiently.

### Map the structure

Use `codebase-locator` to get a full map of the project layout, entry points, and file organization. Ask it to locate implementation files, test files, configuration, and type definitions for the project root.

### Check for circular dependencies and coupling hotspots

```bash
# Circular dependencies (install if needed: npm i -D madge)
npx madge --circular --extensions ts,tsx src/

# Most-imported files (coupling hotspots)
grep -r "from ['\"]" src/ --include='*.ts' --include='*.tsx' | \
  sed "s/.*from ['\"]//;s/['\"].*//" | sort | uniq -c | sort -rn | head -20
```

### Check for dead code

```bash
# Unused exports and files (install if needed: npm i -D knip)
npx knip --include files,exports,dependencies 2>/dev/null

# Fallback
npx ts-prune 2>/dev/null

# Unused dependencies
npx depcheck 2>/dev/null
```

### Size hotspots

```bash
find src -name '*.ts' -o -name '*.tsx' | xargs wc -l | sort -rn | head -20
```

### Understand how things connect

For any areas that look potentially problematic from the discovery above (high coupling, large files, circular deps), use `codebase-analyzer` to trace the actual data flow and understand how components interact. Don't analyze things that look fine.

### Check for pattern consistency

If the codebase appears to use multiple conflicting approaches for the same thing (e.g., two different API patterns, mixed naming conventions), use `codebase-pattern-finder` to find concrete examples and understand the scope of the inconsistency. Only do this if discovery surfaced actual signals — don't go hunting for inconsistencies.

## 2. Analysis

Evaluate discovery findings. **Only flag items where you have concrete evidence** — file paths, import chains, line counts, command output. If you can't point to it in the code, it's not a finding.

### What to look for

- Circular dependencies (from madge output — these are always worth flagging)
- God modules that everything imports (from coupling hotspot analysis)
- Files that are unreasonably large and doing too many things
- Dead code (unused files, exports, dependencies from knip/depcheck)
- Inconsistent patterns that create confusion (only if genuinely inconsistent, not just "different from what I'd choose")
- Layer violations where they'd cause real problems (e.g., UI directly hitting the database)
- Configuration scattered across many files with no central source of truth

### What NOT to flag

- Stylistic preferences that don't affect maintainability
- Patterns that are internally consistent even if unconventional
- Small files or directories that aren't hurting anything
- Absence of patterns the project doesn't need yet
- Things that are "technically" an anti-pattern but aren't causing problems here

### Severity

| Severity     | Criteria                                                         |
| ------------ | ---------------------------------------------------------------- |
| **Critical** | Actively causing bugs or blocking development                    |
| **High**     | Significant maintenance burden — engineers are feeling this pain |
| **Medium**   | Slows development noticeably, worth addressing when nearby       |
| **Low**      | Minor friction, fix opportunistically                            |

If nothing reaches a severity level, omit that level. Don't stretch findings to fill categories.

## 3. Planning

### Should you even recommend restructuring?

**Yes, if** there are concrete symptoms: developers can't find code, simple changes touch many files, circular deps are endemic, tests are hard to write because of coupling, new features require copying boilerplate.

**No, if** the motivation is aesthetic, a deadline is approaching, there are no tests to verify the refactoring, or the team hasn't agreed on a target. Say the codebase is in reasonable shape and move on.

### If restructuring is warranted

Keep recommendations grounded in what the project actually is. A 20-file Express API doesn't need DDD. A solo-dev side project doesn't need strict module boundaries.

Migration is always incremental:

1. Create target structure alongside existing
2. Move one module at a time, update imports after each move
3. Run tests after every move
4. Update import aliases (tsconfig paths) to minimize diffs
5. Delete old locations only after verification

```bash
# Verify no broken imports after moves
npx tsc --noEmit
```

## 4. Output

```markdown
# Architecture Review: [Project Name]

## Overview

- **Type:** [Web App / API / Library / Monorepo]
- **Stack:** [languages, frameworks, key dependencies]
- **Size:** ~X files, ~Y lines
- **Current structure:** [Feature-based / Layer-based / Mixed / Ad-hoc]
- **Overall health:** [Healthy / Some concerns / Needs attention]

## Findings

[Only include severity levels that have findings. Omit empty levels.]

### Critical

1. **[Issue]** — [Evidence]. Recommendation: [specific fix].

### High

1. ...

## Dead Code

[Only include if knip/depcheck/ts-prune found meaningful results]

- **Unused files:** [list]
- **Unused exports:** [count and notable examples]
- **Unused dependencies:** [list]

## Recommendations

[Only include timeframes that have items. Omit empty ones.]

### Immediate

- [ ] [Action]

### Short-term

- [ ] [Action]

### Longer-term

- [ ] [Action]

## Proposed Structure

[Only include if restructuring is genuinely recommended. Otherwise omit entirely.]

## Migration Steps

[Only include if restructuring is recommended. Each step independently mergeable.]
```

### Report rules

- Every finding must cite specific files, line counts, or command output.
- Omit sections with nothing to report. A short review is a good review.
- Recommendations must be actionable — "extract X from Y into Z", not "improve separation of concerns."
- If the codebase is in good shape, the review should be short and say so.
