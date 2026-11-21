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
- Plan from the specification's requirements; reference the exact FR-### and NFR-### identifiers from SPEC.md in the task requirements arrays.
- Keep tasks small and individually delegable with a clear goal, scope and explicit non-scope, outputs, checkable acceptance and tests.
- Separate architecture/interface contracts from dependent implementation; integration and regression tests are first-class deliverables.
- Represent prerequisites as a directed acyclic dependency graph. Minimize overlapping write areas and document shared contracts before parallel execution.
- The specification handed to planning is complete. Treat everything it states – including items marked as assumption or default – as binding. Where it leaves an implementation detail open, decide it in the way that best fits the specification, and state the decision in the plan's `decisions` list and in the requirements of the affected task. Do not block tasks and do not ask back.
- Do not claim existing files, libraries, endpoints or architecture that are not actually established in the specification or repository context.
- Cover each requirement of the specification with at least one task. Do not add product scope beyond the specification; deselected features and non-goals stay out.

## Consistency gate
Before output, verify IDs, task dependency consistency, coverage of scope and non-goals, acceptance/test completeness and that every decision the plan made is listed. Return only the JSON requested by SpecIt's planner prompt.
