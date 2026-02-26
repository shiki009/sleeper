# Sleeper Agent Pipelines

## Quick Reference

| Pipeline | Command | When to Use | Stages |
|----------|---------|-------------|--------|
| **Feature** | `@sleeper-orchestrator` | New feature touching multiple layers | planner -> architect -> implementor -> tester -> reviewer |
| **Bugfix** | `@sleeper-bug-orchestrator` | Bug report, unknown root cause | triager -> fixer -> tester -> reviewer |
| **Hotfix** | `@sleeper-hotfix-orchestrator` | Bug with known root cause, needs fast fix | fixer -> reviewer |
| **Refactor** | `@sleeper-refactor-orchestrator` | Restructure code, preserve behavior | analyzer -> executor -> tester -> reviewer |

## How Pipelines Work

### 1. You describe the work

Tell the orchestrator what you need in natural language:

```
@sleeper-orchestrator Add MLB support with excitement scoring
@sleeper-bug-orchestrator The football excitement scores seem too low for Champions League games
@sleeper-hotfix-orchestrator The NBA API route is missing the standings parallel fetch
@sleeper-refactor-orchestrator Extract shared ESPN API client logic from the three sport-specific clients
```

### 2. The orchestrator creates a work directory

Each pipeline type has its own directory:

```
.planning/
  features/{slug}/      -- feature pipeline
  bugs/{slug}/          -- bugfix pipeline
  hotfixes/{slug}/      -- hotfix pipeline
  refactors/{slug}/     -- refactor pipeline
```

### 3. Agents run in sequence

The orchestrator spawns one agent at a time. Each agent:
- Reads its instructions from `.claude/agents/sleeper-{name}.md`
- Reads predecessor artifacts from the work directory
- Does its work (investigation, code changes, testing, review)
- Writes its output artifact to the work directory
- Reports status: `complete`, `blocked`, or `failed`

### 4. Artifacts pass between agents

Agents communicate through markdown files with YAML frontmatter:

```yaml
---
feature: add-mlb-support
stage: planner
status: complete
produced_by: sleeper-planner
consumed_by: sleeper-architect
---
```

The orchestrator tracks everything in `PIPELINE-STATE.md`:

```
| # | Stage | Agent | Status | Started | Completed | Artifact |
|---|-------|-------|--------|---------|-----------|----------|
| 1 | Plan | sleeper-planner | complete | 12:00 | 12:02 | 01-SPEC.md |
| 2 | Architect | sleeper-architect | running | 12:02 | | 02-ARCHITECTURE.md |
| 3 | Implement | sleeper-implementor | pending | | | 03-IMPLEMENTATION.md |
```

### 5. The reviewer decides the outcome

Every pipeline ends with the reviewer. Three possible verdicts:
- **pass** -- ship it
- **pass-with-warnings** -- ship it, but address the warnings
- **fail** -- the orchestrator determines which stage to re-run

## Running Individual Agents

You can run any agent standalone without a pipeline:

```
# Investigation only
@sleeper-bug-triager Investigate why NHL overtime games aren't getting high enough scores

# Code review only
@sleeper-reviewer Review lib/scoring/nba.ts against Sleeper conventions

# Quick analysis
@sleeper-refactor-analyzer Map all dependencies of lib/api/football-data.ts
```

When running standalone, tell the agent where to write its output.

## Choosing the Right Pipeline

```
"I need a new feature"                    -> @sleeper-orchestrator (feature)
"Something is broken, not sure why"       -> @sleeper-bug-orchestrator (bugfix)
"Something is broken, I know the cause"   -> @sleeper-hotfix-orchestrator (hotfix)
"I want to restructure this code"         -> @sleeper-refactor-orchestrator (refactor)
"Single-file fix, trivial change"         -> just do it directly, no pipeline needed
```

## Coverage

Every development workflow is covered by either a pipeline or a direct action:

| Workflow | Covered? | How |
|----------|----------|-----|
| Build a new feature | yes | Feature pipeline |
| Add a new sport | yes | Feature pipeline |
| Fix a bug (unknown cause) | yes | Bugfix pipeline |
| Fix a bug (known cause, fast) | yes | Hotfix pipeline |
| Restructure / consolidate code | yes | Refactor pipeline |
| Code review | yes | `@sleeper-reviewer` standalone |
| Investigation only | yes | `@sleeper-bug-triager` standalone |
| Dependency analysis | yes | `@sleeper-refactor-analyzer` standalone |
| Single-file edit | yes | Direct edit, no pipeline needed |
| Config changes | yes | Direct edit, no pipeline needed |

## Agent Inventory

### Feature Pipeline (6 agents)
| Agent | Role | Writes Code? |
|-------|------|-------------|
| `sleeper-orchestrator` | Coordinates feature pipeline | No |
| `sleeper-planner` | Writes feature spec | No |
| `sleeper-architect` | Designs technical approach | No |
| `sleeper-implementor` | Implements all code (API clients, scoring, routes, components, pages) | Yes |
| `sleeper-tester` | Writes tests | Yes |
| `sleeper-reviewer` | Reviews all changes | No (read-only) |

### Bugfix Pipeline (3 new + reuses tester, reviewer)
| Agent | Role | Writes Code? |
|-------|------|-------------|
| `sleeper-bug-orchestrator` | Coordinates bugfix pipeline | No |
| `sleeper-bug-triager` | Investigates root cause | No (read-only) |
| `sleeper-bug-fixer` | Implements minimal fix | Yes |

### Refactor Pipeline (3 new + reuses tester, reviewer)
| Agent | Role | Writes Code? |
|-------|------|-------------|
| `sleeper-refactor-orchestrator` | Coordinates refactor pipeline | No |
| `sleeper-refactor-analyzer` | Maps dependencies, plans steps | No (read-only) |
| `sleeper-refactor-executor` | Executes refactor changes | Yes |

### Hotfix Pipeline (1 new + reuses bug-fixer, reviewer)
| Agent | Role | Writes Code? |
|-------|------|-------------|
| `sleeper-hotfix-orchestrator` | Fast-track fix, skip triage | No |

**Total: 13 agent files, 4 pipelines**

## Shared Agents

Some agents are reused across pipelines:

| Agent | Used By |
|-------|---------|
| `sleeper-tester` | feature, bugfix, refactor |
| `sleeper-reviewer` | feature, bugfix, hotfix, refactor |
| `sleeper-bug-fixer` | bugfix, hotfix |

## Key Differences from DB-Backed Projects

This project has **no database**, so:
- No migration pipeline (no DB schema to manage)
- No db-engineer agent (no SQL migrations)
- No backend agent (no server actions, no schemas, no auth)
- The **implementor** agent handles all code across every layer
- Feature pipeline is: planner -> architect -> **implementor** -> tester -> reviewer (5 stages, not 7)
