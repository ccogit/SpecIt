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

/**
 * Wie validateTraceability, aber ohne Abbruch: nennt die Lücken, damit ein fertiger Plan nicht nach
 * minutenlanger Erzeugung verworfen wird. ids = Zahl der Anforderungs-IDs in der Spezifikation.
 */
export function traceGaps(spec, plan) {
  const ids = requirementIds(spec);
  if (!ids.length) return { ids: 0, missing: [], unknown: [], untraced: [] };
  const known = new Set(ids), covered = new Set(), unknown = new Set(), untraced = [];
  for (const task of plan.tasks) {
    const refs = requirementIds(task.requirements.join(' '));
    if (!refs.length) untraced.push(task.id);
    for (const id of refs) (known.has(id) ? covered : unknown).add(id);
  }
  return { ids: ids.length, missing: ids.filter(id => !covered.has(id)), unknown: [...unknown], untraced };
}
