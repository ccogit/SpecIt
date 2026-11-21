---
name: specification
description: Produce a coherent, testable product specification with requirement IDs and complete scope boundaries.
source: https://github.com/github/spec-kit
upstream-license: MIT
adaptation: SpecIt single-document SPEC.md workflow
---
# Specification authoring

Adapted from the spec-first methodology of **GitHub Spec Kit** (GitHub, MIT). This adaptation produces one portable SPEC.md rather than adopting Spec Kit's CLI, file tree or slash commands.

## Apply
- Specify **what** the product must do and **why**, before deciding **how** to implement it.
- Use the canonical terms of the interview consistently. Separate confirmed requirements, assumed defaults and open decisions.
- Structure the Markdown document with: Ziel und Nicht-Ziele; Stakeholder und Rollen; Kernabläufe und Randfälle; Funktionale Anforderungen; Nichtfunktionale Anforderungen; UX und Barrierefreiheit; Daten und Schnittstellen; Technische Randbedingungen; Risiken; Akzeptanzkriterien; Offene Entscheidungen.
- Give every functional requirement a stable unique ID FR-001, FR-002, ... and every nonfunctional requirement NFR-001, NFR-002, ... . State priority and provenance (confirmed decision / assumed default) for each requirement.
- Describe user-visible behavior and observable results. Use technical architecture only where constraints justify it; label proposed alternatives and unresolved design as such.
- Every major workflow must include failures, permissions, relevant empty states and data handling. Do not invent screens, metrics, vendors, storage methods or compliance claims. Own feature ideas are allowed only to the degree the instruction grants and are marked as „Vorschlag der KI“.
- For each requirement provide at least one checkable acceptance criterion referencing its ID; define the condition and expected behavior, avoiding words such as "intuitiv", "schnell" or "sicher" without measurable criteria.

## Consistency gate
Before output, check: goals match scope; role permissions match flows; data model matches functions; interfaces match workflows; no requirement is silently contradicted, duplicated or invented; every requirement has an acceptance criterion; what stays open and what is decided by assumption follows the decision mode given in the instruction (in auto mode nothing stays open and every own decision is marked as an assumption). If source inputs conflict, document the conflict and how it was resolved, or why it stays open.
