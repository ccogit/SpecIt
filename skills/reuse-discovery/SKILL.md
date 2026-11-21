---
name: reuse-discovery
description: Research real open-source implementations before recommending greenfield development, assess license, maintenance, suitability and requirement coverage.
source: https://github.com/github/spec-kit
upstream-license: MIT
adaptation: SpecIt reuse-first repository research and evaluation
---
# Reuse-first software discovery

This SpecIt-specific skill extends the spec-first approach of GitHub Spec Kit: **search before building**. Research must use verified external repository search results, not the model's memory or generated links.

## Mandatory workflow
1. Extract the product's core functions and their FR-/NFR-IDs (where present), domain vocabulary, runtime/platform constraints and non-goals.
2. Search GitHub for existing maintained open-source projects, libraries, starter kits or reference implementations covering the core functions. Search broad alternatives, not only the complete app idea. Do not make a build-from-scratch recommendation before this check.
3. Evaluate real repositories only. Cite their exact GitHub URLs and license identifiers from search metadata; do not invent project names, versions, activity, stars, license permissions or code-level capabilities.
4. Map each candidate to specific functions or requirement IDs. Distinguish a full product reuse, component/library integration, and reference-only ideas; do not equate a text match with proof that the functionality works.
5. Evaluate license compatibility (including obligations and unknowns), maintenance, security/abandonment risk, architecture fit, integration effort, dependency risk and scope mismatch. A verified license is a prerequisite for a reuse recommendation, not sufficient approval.
6. Recommend a small shortlist with reasoned `einbeziehen` / `prüfen` / `nicht einbeziehen` decisions. Note what must still be built and what must be verified in code, tests and licensing before adoption. No blanket acceptance of all matches.

## Artifact and implementation contract
- Show the shortlist alongside SPEC.md with exact links, licensing, associated functions, risks and an actionable inclusion selection.
- Explicitly distinguish *suggested* reuse from *approved* reuse. Only user-selected projects may be treated as planned dependencies.
- Feed the selected shortlist into task planning with a preliminary audit/PoC task before implementing integrations, pinning approved versions and documenting license notices.
- If network research fails, state that research is incomplete. **Never hallucinate search results** or imply that a missing search means no reusable code exists.
