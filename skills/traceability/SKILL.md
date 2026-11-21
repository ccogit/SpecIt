---
name: traceability
description: Keep domain vocabulary, source decisions, requirements, acceptance criteria and implementation tasks aligned.
source: https://github.com/urban/agent-skills-spec-pack
upstream-license: CC0-1.0
adaptation: SpecIt SPEC.md and task JSON
---
# Traceability and contract consistency

Adapted from **urban/agent-skills-spec-pack** (CC0-1.0), notably its contract-first artifact and traceability practices. SpecIt retains its existing portable one-file specification instead of the upstream multi-artifact pack.

## Apply
- Canonical domain language is defined by the approved idea and interview. Use exactly the same role names, entities, statuses and business terms throughout the specification and tasks.
- Use requirement IDs as stable links: FR-### for behavior, NFR-### for quality. Do not invent an ID reference to a requirement that does not appear in the specification.
- Keep source provenance: confirmed decision, adopted default (assumption), or open decision. While specifying, the decision mode given in the instruction sets how much is decided by assumption and how much stays open; follow it and mark every own decision as an assumption. While planning nothing stays open: the plan decides remaining details and lists them.
- Carry scope and non-goals into downstream work; tasks may implement, test or clarify requirements, not expand them.
- Map every requirement to acceptance coverage and a downstream task. Any uncovered requirement or contradictory choice is a review finding.
- Dependencies must describe real implementation order, not invent repository structure. Reuse existing names and interface contracts across tasks.
- If a required detail is absent, explicitly state the gap and its impact instead of inventing a fact.

## Consistency gate
Check bidirectional traceability: every task cites actual requirement IDs, every required function is represented by a task, acceptance criteria are objectively testable, and every decision the plan made is listed with its reason.
