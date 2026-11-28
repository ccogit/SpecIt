import {restoreRequirementHighWater, checkRequirementCoverage} from './aira-requirement-identities.mjs';

const kindPatterns = {
  task: /^T/, requirement: /^(FR|NFR)-/, decision: /^B/, criterion: /^AC-/, test: /^TC-/,
};
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const text = value => typeof value === 'string' && value.trim().length > 0;
const canonical = value => Array.isArray(value) ? value.map(canonical)
  : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])])) : value;
const equal = (a,b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));

function records(plan, data) {
  const active = new Map();
  for (const [kind, entries] of [
    ['task', plan.tasks], ['requirement', data.requirements], ['decision', data.decisions],
    ['criterion', data.criteria], ['test', data.tests],
  ]) {
    assert(Array.isArray(entries), 'Missing identity list: ' + kind);
    for (const entry of entries) {
      assert(entry && typeof entry.id === 'string' && kindPatterns[kind].test(entry.id)
        && !active.has(entry.id), 'Missing, invalid or duplicate identity: ' + entry?.id);
      restoreRequirementHighWater({}, [entry.id], []);
      active.set(entry.id, {kind, entry});
    }
  }
  return active;
}

// The caller supplies explicit confirmations, never inferred from AI output.
// The returned snapshot is JSON-persistable and does not mutate its predecessor.
export function confirmRequirementRevision(plan, data, {previous = null, confirmedIds = []} = {}) {
  const active = records(plan, data);
  assert(data.schema_version === 2 && text(data.plan_id) && Number.isSafeInteger(data.revision)
    && data.revision > 0, 'Invalid revision');
  assert(Array.isArray(data.retired_ids) && Array.isArray(data.exceptions), 'Missing retirement or exception list');
  const retired = new Map();
  for (const entry of data.retired_ids) {
    assert(entry && Object.hasOwn(kindPatterns, entry.kind) && kindPatterns[entry.kind].test(entry.id)
      && text(entry.reason) && Number.isSafeInteger(entry.retired_revision) && entry.retired_revision > 0
      && entry.retired_revision <= data.revision && !retired.has(entry.id), 'Invalid tombstone: ' + entry?.id);
    retired.set(entry.id, entry);
  }
  const known = previous ? records(previous.plan, previous.requirements) : new Map();
  const priorRetired = previous ? previous.requirements.retired_ids : [];
  assert(previous ? previous.requirements.plan_id === data.plan_id
    && data.revision === previous.requirements.revision + 1 : data.revision === 1, 'Invalid revision sequence');
  assert(Array.isArray(confirmedIds) && new Set(confirmedIds).size === confirmedIds.length
    && confirmedIds.every(id => active.has(id)), 'Unknown or duplicate confirmation');
  const confirmed = new Set(confirmedIds);
  const oldCounters = restoreRequirementHighWater(previous?.highWater ?? {}, [...known.keys()], priorRetired.map(x => x.id));
  const highWater = restoreRequirementHighWater(oldCounters, [...active.keys()], [...retired.keys()]);
  for (const tombstone of priorRetired) assert(equal(retired.get(tombstone.id), tombstone), 'Changed or missing tombstone: ' + tombstone.id);
  for (const [id, value] of known) {
    if (!active.has(id)) assert(retired.get(id)?.retired_revision === data.revision && retired.get(id).kind === value.kind, 'Missing tombstone: ' + id);
  }
  for (const [id, tombstone] of retired) {
    if (!priorRetired.some(x => x.id === id)) assert(known.has(id) && tombstone.retired_revision === data.revision, 'Unknown tombstone: ' + id);
  }
  for (const [id, value] of active) {
    if (!known.has(id)) {
      const [key, n] = Object.entries(restoreRequirementHighWater({}, [id], []))[0];
      assert(n > (oldCounters[key] ?? 0), 'Reused identity: ' + id);
      assert(confirmed.has(id), 'Unconfirmed new identity: ' + id);
    } else if (!equal(known.get(id).entry, value.entry)) {
      assert(confirmed.has(id), 'Unconfirmed identity change: ' + id);
    }
  }
  const refs = (ids, kind, required = false) => {
    assert(Array.isArray(ids) && (!required || ids.length > 0) && new Set(ids).size === ids.length
      && ids.every(id => active.get(id)?.kind === kind), 'Missing, duplicate or unknown ' + kind + ' reference');
  };
  for (const t of plan.tasks) refs(t.requirements, 'requirement', true);
  for (const d of data.decisions) {
    refs(d.task_ids, 'task', true);
    refs(d.requirement_ids, 'requirement');
    const fields = [d.resolution,d.evidence_ref,d.confirmed_by,d.confirmed_at];
    assert(text(d.text) && (d.state === 'open' ? fields.every(x => x === null)
      : d.state === 'resolved' && fields.every(text)), 'Unconfirmed decision: ' + d.id);
  }
  for (const c of data.criteria) {
    const owner = active.get(c.task_id);
    assert(owner && ['task','decision'].includes(owner.kind) && c.id.startsWith('AC-' + c.task_id + '-'), 'Invalid criterion owner: ' + c.id);
    assert(owner.kind === 'task' ? c.decision_id === null : c.decision_id === c.task_id, 'Invalid criterion decision: ' + c.id);
    refs(c.requirement_ids, 'requirement', owner.kind === 'task');
    if (owner.kind === 'task') assert(c.requirement_ids.every(id => owner.entry.requirements.includes(id)), 'Criterion outside task requirements: ' + c.id);
    assert(text(c.text) && ['test','manual','inspection'].includes(c.verification), 'Invalid criterion: ' + c.id);
  }
  for (const t of data.tests) {
    assert(t.id.startsWith('TC-' + t.task_id + '-') && text(t.description), 'Invalid test: ' + t.id);
    refs(t.criterion_ids, 'criterion', true);
    assert(t.criterion_ids.every(id => active.get(id).entry.task_id === t.task_id), 'Cross-owner test: ' + t.id);
  }
  for (const [id, value] of active) if (['task','decision'].includes(value.kind)) {
    assert(data.criteria.some(c => c.task_id === id), 'Missing criterion: ' + id);
  }
  for (const c of data.criteria) if (c.verification === 'test') {
    assert(data.tests.some(t => t.criterion_ids.includes(c.id)), 'Missing test: ' + c.id);
  }
  for (const e of data.exceptions) assert(text(e.reason) && text(e.approved_by) && text(e.approved_at), 'Unconfirmed exception');
  checkRequirementCoverage(data.requirements, data.criteria.map(c => c.requirement_ids), data.exceptions.map(e => e.requirement_id));
  return JSON.parse(JSON.stringify({plan, requirements: data, highWater}));
}
