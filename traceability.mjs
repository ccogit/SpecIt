// Consistency gate for AI-generated plans. Legacy specifications without requirement IDs
// remain supported, but identified requirements must be traceable end-to-end.
const idPattern = /\b(?:FR|NFR)-\d{3}\b/g;
export const requirementIds = text => [...new Set(String(text || '').match(idPattern) || [])];

export function validateTraceability(spec, plan) {
  const ids = requirementIds(spec);
  if (!ids.length) return plan; // Existing imported specs can be unstructured.
  const known = new Set(ids), covered = new Set();
  for (const task of plan.tasks) {
    const refs = requirementIds(task.requirements.join(' '));
    if (!refs.length) throw Error('Task ' + task.id + ' enthält keinen Bezug auf eine Anforderungs-ID.');
    for (const id of refs) {
      if (!known.has(id)) throw Error('Task ' + task.id + ' verweist auf unbekannte Anforderung ' + id + '.');
      covered.add(id);
    }
  }
  const missing = ids.filter(id => !covered.has(id));
  if (missing.length) throw Error('Anforderungen ohne Implementierungs-Task: ' + missing.join(', ') + '.');
  return plan;
}
