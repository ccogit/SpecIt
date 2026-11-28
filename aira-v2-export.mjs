import {artifactPath, sha256} from './aira-export.mjs';
import {codepointCompare} from './aira-identities.mjs';
import {checkRequirementCoverage, restoreRequirementHighWater} from './aira-requirement-identities.mjs';
import {canonicalV2Json, projectV2EvidenceLine} from './aira-v2-projection.mjs';
import {validatePlan} from './planner.mjs';

function requireValue(condition, code, field) {
  if (!condition) throw Object.assign(new Error('Aira V2: ' + field), {code});
}

const schema = (condition, field) => requireValue(condition, 'INVALID_SCHEMA', field);
const identity = (condition, field) => requireValue(condition, 'ID_CONFLICT', field);
const history = (condition, field) => requireValue(condition, 'HISTORY_CONFLICT', field);
const plain = value => value != null && Object.getPrototypeOf(value) === Object.prototype;
const text = value => typeof value === 'string' && value.isWellFormed() && !value.includes('\r') && Boolean(value.trim());
const hash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const bullets = values => values.length ? values.map(value => '- ' + value).join('\n') : '- (keine)';
const section = (name, body) => '## ' + name + '\n\n' + body;

function canonical(value, field) {
  try {
    return canonicalV2Json(value);
  } catch {
    schema(false, field);
  }
}

function canonicalManifest(manifest) {
  const json = canonicalV2Json(manifest);
  // The branched reference retains the fractional digit for a whole-minute target.
  return json.replace(/^(  "target_minutes": [0-9]+),$/m, '$1.0,');
}

function bytes(value, field) {
  schema(value instanceof Uint8Array || typeof value === 'string' && value.isWellFormed(), field);
  return Buffer.from(value);
}

function activeIds(plan, requirements) {
  return [...plan.tasks, ...requirements.requirements, ...requirements.decisions,
    ...requirements.criteria, ...requirements.tests].map(entry => entry.id);
}

function validateIdentities(plan, requirements) {
  const active = activeIds(plan, requirements);
  const retired = requirements.retired_ids.map(entry => entry.id);
  let counters;
  try {
    counters = restoreRequirementHighWater({}, active, retired);
  } catch {
    identity(false, 'active or retired identities');
  }
  return {active, retired, counters};
}

function references(ids, targets, field) {
  schema(Array.isArray(ids) && new Set(ids).size === ids.length && ids.every(id => targets.has(id)), field);
}

function validateRequirements(plan, data) {
  const {requirements, decisions, criteria, tests, exceptions, retired_ids} = data;
  schema([requirements, decisions, criteria, tests, exceptions, retired_ids].every(
    list => Array.isArray(list) && list.every(plain)), 'requirements.json lists');
  const identities = validateIdentities(plan, data);
  const taskIds = new Set(plan.tasks.map(task => task.id));
  const requirementIds = new Set(requirements.map(entry => entry.id));
  const byDecision = new Map(decisions.map(decision => [decision.id, decision]));
  const openByTask = new Map(plan.tasks.map(task => [task.id, []]));
  for (const decision of decisions) {
    identity(decision.id.startsWith('B'), 'decision identity');
    schema(text(decision.text), 'decision text');
    references(decision.task_ids, taskIds, 'decision tasks');
    references(decision.requirement_ids, requirementIds, 'decision requirements');
    const confirmation = [decision.resolution, decision.confirmed_by, decision.confirmed_at, decision.evidence_ref];
    schema(decision.state === 'open' && confirmation.every(value => value === null)
      || decision.state === 'resolved' && confirmation.every(text), 'decision confirmation');
    if (decision.state === 'open') {
      for (const id of decision.task_ids) openByTask.get(id).push(decision);
    }
  }
  for (const task of plan.tasks) {
    references(task.requirements, requirementIds, 'plan task requirements');
    const decisionTexts = openByTask.get(task.id).map(decision => decision.text).sort(codepointCompare);
    schema(canonicalV2Json(decisionTexts) === canonicalV2Json([...task.blockedBy].sort(codepointCompare)),
      'open decisions for ' + task.id);
  }
  const criteriaByOwner = new Map();
  for (const criterion of criteria) {
    const {id, task_id, decision_id, requirement_ids} = criterion;
    identity(id.startsWith('AC-' + task_id + '-'), 'criterion owner identity');
    schema(taskIds.has(task_id) ? decision_id === null : byDecision.has(task_id) && decision_id === task_id,
      'criterion owner and decision');
    schema(text(criterion.text) && text(criterion.verification), 'criterion text and verification');
    references(requirement_ids, requirementIds, 'criterion requirements');
    if (!criteriaByOwner.has(task_id)) criteriaByOwner.set(task_id, new Set());
    criteriaByOwner.get(task_id).add(id);
  }
  for (const entry of tests) {
    identity(entry.id.startsWith('TC-' + entry.task_id + '-'), 'test owner identity');
    schema((taskIds.has(entry.task_id) || byDecision.has(entry.task_id)) && text(entry.description),
      'test owner and description');
    references(entry.criterion_ids, criteriaByOwner.get(entry.task_id) ?? new Set(), 'test criteria');
  }
  schema(requirements.every(entry => text(entry.text)), 'requirement text');
  schema(retired_ids.every(entry => text(entry.kind) && text(entry.reason)
    && Number.isSafeInteger(entry.retired_revision) && entry.retired_revision > 0
    && entry.retired_revision <= data.revision), 'retired identity metadata');
  try {
    checkRequirementCoverage(requirements, criteria.map(entry => entry.requirement_ids),
      exceptions.map(entry => entry.requirement_id));
  } catch (error) {
    schema(false, error.message);
  }
  return {openByTask, identities};
}

function validateHistory(input, identities) {
  const {previous, revision, previous_manifest_sha256, plan_id, repo} = input;
  if (revision === 1) {
    history(previous == null && previous_manifest_sha256 === null, 'initial revision predecessor');
    return;
  }
  const manifest = previous?.manifest;
  const requirements = previous?.requirements;
  history(hash(previous_manifest_sha256) && manifest?.schema_version === 2 && requirements?.schema_version === 2
    && manifest.plan_id === plan_id && manifest.repo === repo && manifest.revision === revision - 1
    && requirements.plan_id === plan_id && requirements.revision === manifest.revision
    && sha256(canonicalManifest(manifest)) === previous_manifest_sha256
    && sha256(canonicalV2Json(requirements)) === manifest.requirements_sha256, 'predecessor binding');
  const prior = validateIdentities(manifest.plan, requirements);
  const active = new Set(identities.active);
  const retired = new Set(identities.retired);
  const priorActive = new Set(prior.active);
  history(prior.active.every(id => active.has(id) || retired.has(id))
    && prior.retired.every(id => retired.has(id)), 'identity continuity');
  for (const id of identities.active) {
    if (!priorActive.has(id)) {
      const [namespace, counter] = Object.entries(restoreRequirementHighWater({}, [id], []))[0];
      identity(counter > (prior.counters[namespace] ?? 0), 'reused identity: ' + id);
    }
  }
}

function addArtifacts(files, sources) {
  schema(plain(sources), 'artifact sources');
  const paths = Object.keys(sources).sort(codepointCompare);
  const lowerPaths = new Set(paths.map(path => path.toLowerCase()));
  requireValue(lowerPaths.size === paths.length, 'INVALID_PATH', 'colliding artifact paths');
  return paths.map(path => {
    try {
      artifactPath(path);
    } catch {
      requireValue(false, 'INVALID_PATH', 'artifact path: ' + path);
    }
    const parts = path.toLowerCase().split('/');
    requireValue(parts.every((_, i) => !lowerPaths.has(parts.slice(0, i).join('/'))),
      'INVALID_PATH', 'artifact parent is a file: ' + path);
    files[path] = bytes(sources[path], path);
    return {path, sha256: sha256(files[path])};
  });
}

function evidence(entries, owner, field) {
  return entries.filter(entry => entry.task_id === owner)
    .map(entry => projectV2EvidenceLine(entry.id, entry[field])).join('').slice(0, -1) || '- (keine)';
}

/** Project checked inputs into freshly allocated UTF-8 files. previous holds the
 * checked predecessor's manifest and requirements data. Optional hash and draft
 * assertions bind supplied expectations to the generated bytes.
 */
export function buildAiraV2Export(input) {
  const {schema_version = 2, plan_id, revision, repo, plan, target_minutes, confirmed_points,
    spec, requirements, artifacts: sources = {}, previous_manifest_sha256 = null} = input;
  requireValue(schema_version === 2 && requirements?.schema_version === 2, 'VERSION_MISMATCH', 'schema version');
  schema(typeof plan_id === 'string' && /^[A-Za-z0-9][A-Za-z0-9-]{0,23}$/.test(plan_id), 'plan ID');
  schema(typeof repo === 'string' && /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo)
    && repo.split('/').every(part => part !== '.' && part !== '..') && !/\.git$/i.test(repo), 'repository');
  schema(Number.isSafeInteger(revision) && revision >= 1 && requirements.plan_id === plan_id
    && requirements.revision === revision, 'plan and requirements revision');
  schema(target_minutes === null || Number.isFinite(target_minutes) && target_minutes > 0, 'target minutes');
  let validated;
  try {
    validated = validatePlan(plan);
  } catch {
    schema(false, 'plan');
  }
  const planJson = canonical(plan, 'plan JSON');
  schema(planJson === canonicalV2Json(validated) && !containsCR(plan), 'normalized plan');
  schema(plan.tasks.every(task => !/[\p{Cc}\u2028\u2029|;\\]/u.test(task.title)), 'task titles');
  const {openByTask, identities} = validateRequirements(plan, requirements);
  validateHistory({...input, previous_manifest_sha256}, identities);

  const files = Object.create(null);
  files['SPEC.md'] = bytes(spec, 'SPEC.md');
  try {
    new TextDecoder('utf-8', {fatal: true, ignoreBOM: true}).decode(files['SPEC.md']);
  } catch {
    schema(false, 'SPEC.md UTF-8');
  }
  schema(!files['SPEC.md'].subarray(0, 3).equals(Buffer.from([239, 187, 191])), 'SPEC.md BOM');
  const spec_sha256 = sha256(files['SPEC.md']);
  requireValue(!Object.hasOwn(input, 'spec_sha256') || input.spec_sha256 === spec_sha256,
    'INVALID_HASH', 'SPEC.md hash');
  const artifacts = addArtifacts(files, sources);
  files['requirements.json'] = Buffer.from(canonical(requirements, 'requirements JSON'));
  const requirements_sha256 = sha256(files['requirements.json']);
  requireValue(!Object.hasOwn(input, 'requirements_sha256') || input.requirements_sha256 === requirements_sha256,
    'INVALID_HASH', 'requirements.json hash');
  const refs = [
    '../SPEC.md (SHA-256: ' + spec_sha256 + ')',
    '../manifest.json',
    '../requirements.json (SHA-256: ' + requirements_sha256 + ')',
    ...artifacts.map(({path, sha256}) => '../' + path + ' (SHA-256: ' + sha256 + ')'),
  ];

  const open = requirements.decisions.filter(decision => decision.state === 'open')
    .sort((a, b) => codepointCompare(a.id, b.id));
  const order = [...open.map(decision => decision.id), ...plan.waves.flatMap(wave => [...wave].sort(codepointCompare))];
  schema(order.length <= 99 && plain(confirmed_points) && Object.keys(confirmed_points).length === order.length
    && order.every(id => Object.hasOwn(confirmed_points, id) && [1, 2, 3, 5, 8].includes(confirmed_points[id])),
  'confirmed story points and work item count');
  const tasks = {};
  const blockers = [];
  const mappings = new Map();
  const draftPaths = [];
  for (const [index, id] of order.entries()) {
    const task = plan.tasks.find(entry => entry.id === id);
    const decision = open.find(entry => entry.id === id);
    const prefix = 'SpecIt ' + plan_id + ' ' + id + ' – ';
    const mapping = {
      epic_title: prefix + (task ? task.title : 'Entscheidung klären'),
      item_title: prefix + (task ? 'Umsetzung: ' + task.title : 'Entscheidung dokumentieren'),
      file: 'draft/' + String(index + 1).padStart(2, '0') + '-' + id + '.md',
      points: confirmed_points[id],
    };
    if (task) tasks[id] = mapping;
    else blockers.push({id, decision: decision.text, ...mapping});
    mappings.set(id, mapping);
    const sections = [
      section('Ziel', task ? task.goal : decision.text),
      section('Ausgangslage', plan.summary),
      ...(task ? [
        section('Anforderungen', bullets(task.requirements)),
        section('Features', bullets(task.features)),
        section('Umfang', bullets(task.scope)),
        section('Nicht im Umfang', bullets(task.outOfScope)),
        section('Schnittstellen', bullets(task.interfaces)),
        section('Liefergegenstände', bullets(task.deliverables)),
      ] : [
        section('Umfang', '- Entscheidung fachlich klären und dokumentieren.'),
        section('Nicht im Umfang', '- Keine Umsetzung abhängiger Tasks.'),
      ]),
      section('Acceptance', evidence(requirements.criteria, id, 'text')),
      section('Tests', evidence(requirements.tests, id, 'description')),
      ...(task ? [
        section('Festlegungen', bullets(plan.decisions)),
        section('Offene Entscheidungen', bullets(task.blockedBy)),
        section('Abhängigkeiten', bullets(task.dependsOn)),
      ] : []),
      section('Referenzen', bullets(refs)),
    ];
    const header = ['# ' + mapping.item_title, 'Epic: ' + mapping.epic_title, 'Umfang: ' + mapping.points].join('\n');
    files[mapping.file] = Buffer.from([header, ...sections].join('\n\n') + '\n');
    draftPaths.push(mapping.file);
  }
  const rows = order.map(id => {
    const task = plan.tasks.find(entry => entry.id === id);
    const dependencies = task ? [...task.dependsOn, ...openByTask.get(id).map(decision => decision.id)] : [];
    const blockedBy = dependencies.sort(codepointCompare).map(dep => mappings.get(dep).epic_title).join('; ');
    return '| ' + mappings.get(id).epic_title + ' | ' + (blockedBy || '–') + ' | – |';
  });
  const epics = 'draft/EPICS.md';
  files[epics] = Buffer.from(['| Epic | Blocked by | Status |', '| --- | --- | --- |', ...rows].join('\n') + '\n');
  draftPaths.push(epics);
  const draft_files = draftPaths.map(path => ({path, sha256: sha256(files[path])}));
  if (Object.hasOwn(input, 'draft_files')) {
    requireValue(Array.isArray(input.draft_files) && input.draft_files.length === draftPaths.length
      && draftPaths.every((path, i) => input.draft_files[i]?.path === path), 'INVALID_PATH', 'draft paths');
    requireValue(draft_files.every(({sha256}, i) => input.draft_files[i].sha256 === sha256),
      'INVALID_HASH', 'draft hashes');
  }
  const manifest = {schema_version, mode: 'aira', plan_id, revision, previous_manifest_sha256, repo, plan: validated,
    spec_sha256, requirements_sha256, target_minutes, tasks, blockers, artifacts, draft_files,
    ...(target_minutes === null ? {target_minutes_reason: 'not_available'} : {})};
  files['manifest.json'] = Buffer.from(canonicalManifest(manifest));
  return {files, manifest, order};
}

function containsCR(value) {
  if (typeof value === 'string') return value.includes('\r');
  return value !== null && typeof value === 'object' && Object.values(value).some(containsCR);
}
