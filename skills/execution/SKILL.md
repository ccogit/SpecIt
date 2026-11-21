---
name: execution
description: Break approved specifications into bounded, traceable, independently verifiable agent work packages.
source: https://github.com/github/spec-kit
upstream-license: MIT
adaptation: SpecIt existing task JSON contract
---
# Specification to execution plan

Adapted from the plan/tasks workflow of **GitHub Spec Kit** (GitHub, MIT); uses SpecIt's existing JSON task format, not Spec Kit commands.

## Apply
- Plan from confirmed specification requirements; reference the exact FR-### and NFR-### identifiers from SPEC.md in the task requirements arrays.
- Keep tasks small and individually delegable with a clear goal, scope and explicit non-scope, outputs, checkable acceptance and tests.
- Separate architecture/interface contracts from dependent implementation; integration and regression tests are first-class deliverables.
- Represent prerequisites as a directed acyclic dependency graph. Minimize overlapping write areas and document shared contracts before parallel execution.
- Flag any affected task blocked by unresolved decisions, missing domain details or unapproved technology choices.
- Do not claim existing files, libraries, endpoints or architecture that are not actually established in the specification or repository context.
- Cover each confirmed requirement with at least one task. Never turn a suggestion or assumed default into a silently approved requirement.

## Consistency gate
Before output, verify IDs, task dependency consistency, coverage of scope and non-goals, acceptance/test completeness and visibility of blockers. Return only the JSON requested by SpecIt's planner prompt.
