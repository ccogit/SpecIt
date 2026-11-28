import { createHash, randomUUID } from 'node:crypto';
import { closeSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseAiraJson } from './aira-identities.mjs';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const fail = code => { throw Object.assign(new Error('Aira project store: ' + code), { code }); };
const check = (condition, code = 'INVALID_SCHEMA') => { if (!condition) fail(code); };
const id = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9-]{0,23}$/.test(value);
const repoName = value => typeof value === 'string' && /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(value)
  && value.split('/').every(part => part !== '.' && part !== '..') && !/\.git$/i.test(value);
const sha = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const canonical = value => Array.isArray(value) ? value.map(canonical) : plain(value)
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
const equal = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
const latest = project => project.history.at(-1)?.manifest_sha256 ?? null;

function json(bytes) {
  try {
    const text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
    const result = parseAiraJson(text);
    check(plain(result));
    return result;
  } catch { fail('INVALID_SCHEMA'); }
}

// File names are logical package keys only; they never become filesystem paths.
function validPath(path) {
  return typeof path === 'string' && (['manifest.json', 'requirements.json', 'SPEC.md'].includes(path)
    || /^(?:draft|artifacts)\/[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*$/.test(path)
    && path.split('/').every(part => part !== '.' && part !== '..'));
}

function inspect(files, binding) {
  check(plain(files));
  const paths = Object.keys(files);
  check(paths.length <= 1000 && paths.every(validPath), 'INVALID_PATH');
  check(new Set(paths.map(path => path.toLowerCase())).size === paths.length, 'INVALID_PATH');
  let size = 0;
  for (const path of paths) {
    check(files[path] instanceof Uint8Array);
    size += files[path].byteLength;
  }
  check(size <= 20 * 1024 * 1024, 'INVALID_SCHEMA');
  for (const path of ['manifest.json', 'requirements.json', 'SPEC.md']) check(Object.hasOwn(files, path), 'INVALID_PATH');
  const manifest = json(files['manifest.json']), requirements = json(files['requirements.json']);
  check(manifest.schema_version === 2 && manifest.mode === 'aira' && requirements.schema_version === 2, 'VERSION_MISMATCH');
  check(manifest.plan_id === binding.plan_id && manifest.repo === binding.repo, 'WRONG_TARGET');
  check(Number.isSafeInteger(manifest.revision) && manifest.revision > 0
    && requirements.revision === manifest.revision && requirements.plan_id === manifest.plan_id);
  check(manifest.previous_manifest_sha256 === null || sha(manifest.previous_manifest_sha256), 'HISTORY_CONFLICT');
  check(hash(files['SPEC.md']) === manifest.spec_sha256 && hash(files['requirements.json']) === manifest.requirements_sha256, 'INVALID_HASH');
  check(Array.isArray(manifest.artifacts) && Array.isArray(manifest.draft_files));
  const expected = new Set(['manifest.json', 'requirements.json', 'SPEC.md']);
  for (const [entries, prefix] of [[manifest.artifacts, 'artifacts/'], [manifest.draft_files, 'draft/']]) {
    for (const item of entries) {
      check(plain(item) && validPath(item.path) && item.path.startsWith(prefix)
        && !expected.has(item.path) && Object.hasOwn(files, item.path), 'INVALID_PATH');
      check(sha(item.sha256) && hash(files[item.path]) === item.sha256, 'INVALID_HASH');
      expected.add(item.path);
    }
  }
  check(expected.has('draft/EPICS.md') && expected.size === paths.length, 'INVALID_PATH');
  return { manifest, requirements, manifest_sha256: hash(files['manifest.json']) };
}
function encode(files) {
  check(plain(files));
  return Object.fromEntries(Object.entries(files).map(([key, bytes]) => {
    check(validPath(key), 'INVALID_PATH');
    check(bytes instanceof Uint8Array);
    return [key, Buffer.from(bytes).toString('base64')];
  }));
}
function decode(files) {
  check(plain(files));
  return Object.fromEntries(Object.entries(files).map(([key, bytes]) => {
    check(typeof bytes === 'string');
    const decoded = Buffer.from(bytes, 'base64');
    check(decoded.toString('base64') === bytes, 'INVALID_HASH');
    return [key, decoded];
  }));
}
function semantic({ manifest, requirements }) {
  const { revision, previous_manifest_sha256, requirements_sha256, draft_files, ...content } = manifest;
  const { revision: ignored, ...req } = requirements;
  return { content, requirements: req };
}
function chain(history, binding) {
  let previous = null;
  for (const [index, entry] of history.entries()) {
    const current = inspect(decode(entry.files), binding);
    check(current.manifest_sha256 === entry.manifest_sha256 && current.manifest.revision === index + 1
      && current.manifest.previous_manifest_sha256 === (previous?.manifest_sha256 ?? null), 'HISTORY_CONFLICT');
    if (previous) check(!equal(semantic(previous), semantic(current)), 'HISTORY_CONFLICT');
    previous = current;
  }
}
function regular(path) {
  try { check(lstatSync(path).isFile(), 'INVALID_PATH'); return true; }
  catch (error) { if (error.code === 'ENOENT') return false; throw error; }
}

// The root is supplied by trusted server configuration, never by an HTTP request.
// Single atomic index includes exact archived package bytes: a failed write cannot
// publish a revision without its package. No browser history is authoritative.
export function createProjectStore(root, { validatePackage } = {}) {
  const directory = resolve(root);
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  check(lstatSync(directory).isDirectory(), 'INVALID_PATH');
  const index = join(directory, 'projects.json'), lock = join(directory, 'write.lock');
  function read() {
    if (!regular(index)) return { version: 1, projects: [], active_project_id: null, selection: 0, local_run: null };
    const state = json(readFileSync(index));
    check(state.version === 1 && Array.isArray(state.projects));
    const ids = new Set(), plans = new Set(), repos = new Set();
    for (const p of state.projects) {
      check(id(p.project_id) && !ids.has(p.project_id) && ['standalone', 'aira'].includes(p.mode)
        && Number.isSafeInteger(p.generation) && p.generation >= 1 && Array.isArray(p.history));
      ids.add(p.project_id);
      check(p.source === undefined || plain(p.source) && sha(p.source.spec_sha256) && sha(p.source.plan_sha256));
      if (p.binding !== null) {
        check(id(p.binding.plan_id) && repoName(p.binding.repo) && !plans.has(p.binding.plan_id.toLowerCase())
          && !repos.has(p.binding.repo.toLowerCase()), 'HISTORY_CONFLICT');
        plans.add(p.binding.plan_id.toLowerCase());
        repos.add(p.binding.repo.toLowerCase());
        chain(p.history, p.binding);
      } else check(p.mode === 'standalone' && p.history.length === 0);
    }
    state.active_project_id ??= null;
    state.selection ??= 0;
    state.local_run ??= null;
    check(state.local_run === null || typeof state.local_run.owner === 'string' && typeof state.local_run.token === 'string');
    check(Number.isSafeInteger(state.selection) && state.selection >= 0
      && (state.active_project_id === null || ids.has(state.active_project_id)));
    return state;
  }
  function transaction(fn) {
    let fd;
    try { fd = openSync(lock, 'wx', 0o600); }
    catch (error) { if (error.code === 'EEXIST') fail('HISTORY_CONFLICT'); throw error; }
    const temp = join(directory, 'index-' + randomUUID() + '.tmp');
    try {
      const state = read(), result = fn(state);
      const out = openSync(temp, 'wx', 0o600);
      try { writeFileSync(out, JSON.stringify(state)); fsyncSync(out); } finally { closeSync(out); }
      renameSync(temp, index);
      // Directory fsync is not supported on all Windows filesystems.
      if (process.platform !== 'win32') {
        const dir = openSync(directory, 'r');
        try { fsyncSync(dir); } finally { closeSync(dir); }
      }
      return result;
    } finally {
      rmSync(temp, { force: true });
      closeSync(fd);
      rmSync(lock, { force: true });
    }
  }
  function get(state, project_id) {
    check(id(project_id));
    const p = state.projects.find(p => p.project_id === project_id);
    check(p, 'SOURCE_UNAVAILABLE');
    return p;
  }
  function summary(p) {
    return { project_id: p.project_id, mode: p.mode, binding: structuredClone(p.binding), generation: p.generation,
      revision: p.history.length, manifest_sha256: latest(p) };
  }
  function active(state) {
    return { selection: state.selection, project: state.active_project_id === null ? null : summary(get(state, state.active_project_id)),
      projects: state.projects.map(summary), local_run: state.local_run ?? null };
  }
  function denyBound(state, { plan_id, repo, spec, plan }) {
    const specHash = typeof spec === 'string' && spec.trim() ? hash(spec) : null;
    const planHash = plan ? hash(JSON.stringify(canonical(plan))) : null;
    check(!state.projects.some(p => p.binding && (
      typeof plan_id === 'string' && p.binding.plan_id.toLowerCase() === plan_id.toLowerCase()
      || typeof repo === 'string' && p.binding.repo.toLowerCase() === repo.trim().toLowerCase()
      || specHash && (p.source?.spec_sha256 === specHash || p.history.some(entry => json(decode(entry.files)['manifest.json']).spec_sha256 === specHash))
      || planHash && (p.source?.plan_sha256 === planHash || p.history.some(entry => { const plan = json(decode(entry.files)['manifest.json']).plan; return plan && hash(JSON.stringify(canonical(plan))) === planHash; }))
    )), 'POLICY_DENIED');
  }
  function assertRunInState(state, body) {
    check(plain(body) && (!Object.hasOwn(body, 'mode') || body.mode === 'standalone'), 'POLICY_DENIED');
    if (state.active_project_id !== null) {
      const p = get(state, state.active_project_id);
      check(p.mode === 'standalone' && p.binding === null, 'POLICY_DENIED');
      check(!Object.hasOwn(body, 'project_id') || body.project_id === p.project_id, 'POLICY_DENIED');
    } else check(!Object.hasOwn(body, 'project_id'), 'POLICY_DENIED');
    denyBound(state, body);
  }
  function idle(observation) {
    check(observation === 'idle', 'CONTEXT_UNAVAILABLE');
  }
  function validate(files, previous, record) {
    // Full V2 validation is deliberately an injected, trusted server dependency.
    // Never accept a client assertion that a package is valid.
    check(typeof validatePackage === 'function', 'CONTEXT_UNAVAILABLE');
    check(validatePackage(decode(encode(files)), previous ? decode(encode(previous)) : null, record ? structuredClone(record) : undefined) === true, 'INVALID_SCHEMA');
  }
  return {
    active: () => active(read()),
    // Project selection is an explicit, persisted server operation, not a flag on a run request.
    activate({ expected_selection, mode, binding, project_id, source, observation }) {
      return transaction(state => {
        check(state.selection === expected_selection, 'HISTORY_CONFLICT');
        check(!state.local_run, 'CONTEXT_UNAVAILABLE');
        idle(observation);
        check(['standalone', 'aira'].includes(mode));
        let p;
        if (mode === 'aira') {
          check(plain(binding) && Object.keys(binding).length === 2 && id(binding.plan_id) && repoName(binding.repo));
          p = state.projects.find(other => other.binding && other.binding.plan_id.toLowerCase() === binding.plan_id.toLowerCase());
          if (p) check(equal(p.binding, binding) && p.mode === 'aira' && (!project_id || project_id === p.project_id), 'WRONG_TARGET');
          else {
            check(!project_id && !state.projects.some(other => other.binding && other.binding.repo.toLowerCase() === binding.repo.toLowerCase()), 'WRONG_TARGET');
            check(typeof source?.spec === 'string' && source.spec.trim() && plain(source.plan));
            p = { project_id: randomUUID().replaceAll('-', '').slice(0,24), mode, binding, generation: 1, history: [],
              source: { spec_sha256: hash(source.spec), plan_sha256: hash(JSON.stringify(canonical(source.plan))) } };
            state.projects.push(p);
          }
        } else if (project_id) {
          p = get(state, project_id);
          check(p.mode === 'standalone' && p.binding === null, 'POLICY_DENIED');
          denyBound(state, source ?? {});
        } else {
          denyBound(state, source ?? {});
          p = { project_id: randomUUID().replaceAll('-', '').slice(0,24), mode, binding: null, generation: 1, history: [] };
          state.projects.push(p);
        }
        if (state.active_project_id !== p.project_id) {
          state.active_project_id = p.project_id;
          state.selection++;
        }
        return active(state);
      });
    },
    assertRun(body) { assertRunInState(read(), body); return true; },
    reserveRun(body, owner) {
      return transaction(state => {
        assertRunInState(state, body);
        check(!state.local_run, 'CONTEXT_UNAVAILABLE');
        const token = randomUUID();
        state.local_run = {owner, token};
        return token;
      });
    },
    releaseRun(owner, token) {
      return transaction(state => {
        check(state.local_run?.owner === owner && state.local_run.token === token, 'CONTEXT_UNAVAILABLE');
        state.local_run = null;
      });
    },
    list: () => read().projects.map(summary),
    get: project_id => summary(get(read(), project_id)),
    create(project_id) {
      check(id(project_id));
      return transaction(state => {
        check(!state.projects.some(p => p.project_id === project_id), 'HISTORY_CONFLICT');
        const p = { project_id, mode: 'standalone', binding: null, generation: 1, history: [] };
        state.projects.push(p); return summary(p);
      });
    },
    // observation is supplied by the trusted server's task/run state, not the browser.
    setMode(project_id, { mode, binding, expected_generation, observation }) {
      return transaction(state => {
        const p = get(state, project_id);
        check(p.generation === expected_generation, 'HISTORY_CONFLICT');
        idle(observation);
        check(p.mode === mode || !p.history.length, 'CONTEXT_UNAVAILABLE');
        check(['standalone', 'aira'].includes(mode));
        if (mode === 'aira') {
          check(plain(binding) && id(binding.plan_id) && repoName(binding.repo));
          const next = { plan_id: binding.plan_id, repo: binding.repo };
          check(p.binding === null || equal(p.binding, next), 'WRONG_TARGET');
          check(!state.projects.some(other => other !== p && other.binding &&
            (other.binding.plan_id.toLowerCase() === next.plan_id.toLowerCase()
              || other.binding.repo.toLowerCase() === next.repo.toLowerCase())), 'WRONG_TARGET');
          p.binding = next;
        }
        // An explicit mode change does not erase the binding/history. A bound
        // plan cannot be executed by the standalone runner, even after a switch.
        if (p.mode !== mode) { p.mode = mode; p.generation++; }
        return summary(p);
      });
    },
    // The caller MUST resolve project_id from trusted server context. An
    // absent/unknown identity is not evidence of a standalone project.
    assertStandalone({ project_id, plan_id, repo, spec }) {
      const state = read();
      check(id(project_id), 'POLICY_DENIED');
      const p = get(state, project_id);
      check(p.mode === 'standalone' && p.binding === null, 'POLICY_DENIED');
      const specHash = typeof spec === 'string' ? hash(spec) : null;
      check(!state.projects.some(p => p.binding && (
        typeof plan_id === 'string' && p.binding.plan_id.toLowerCase() === plan_id.toLowerCase()
        || typeof repo === 'string' && p.binding.repo.toLowerCase() === repo.toLowerCase()
        || specHash && p.history.some(entry => json(decode(entry.files)['manifest.json']).spec_sha256 === specHash)
      )), 'POLICY_DENIED');
      return true;
    },
    history(project_id) {
      return get(read(), project_id).history.map(entry => ({ manifest_sha256: entry.manifest_sha256, files: decode(entry.files), ...(entry.record ? { record: structuredClone(entry.record) } : {}) }));
    },
    restore(project_id, { packages, records, expected_generation, expected_head, expected_selection }) {
      return transaction(state => {
        const p = get(state, project_id);
        check(p.mode === 'aira' && p.binding, 'WRONG_TARGET');
        if (expected_selection !== undefined) check(state.active_project_id === project_id && state.selection === expected_selection, 'HISTORY_CONFLICT');
        check(p.generation === expected_generation && latest(p) === expected_head, 'HISTORY_CONFLICT');
        check(Array.isArray(packages) && packages.length >= p.history.length && packages.length > 0, 'HISTORY_CONFLICT');
        const candidate = [];
        for (const [i, files] of packages.entries()) {
          const copy = decode(encode(files)), current = inspect(copy, p.binding);
          const prev = candidate.at(-1);
          validate(copy, prev ? decode(prev.files) : null, records?.[i]);
          candidate.push({ manifest_sha256: current.manifest_sha256, files: encode(copy), ...(records?.[i] ? { record: structuredClone(records[i]) } : {}) });
        }
        chain(candidate, p.binding);
        check(p.history.every((entry, i) => equal(entry, candidate[i])), 'HISTORY_CONFLICT');
        p.history = candidate;
        return summary(p);
      });
    },
    append(project_id, { files, record, expected_generation, expected_head, expected_selection }) {
      return transaction(state => {
        const p = get(state, project_id);
        check(p.mode === 'aira' && p.binding, 'WRONG_TARGET');
        if (expected_selection !== undefined) check(state.active_project_id === project_id && state.selection === expected_selection, 'HISTORY_CONFLICT');
        check(p.generation === expected_generation && latest(p) === expected_head, 'HISTORY_CONFLICT');
        const copy = decode(encode(files)), current = inspect(copy, p.binding);
        const entry = { manifest_sha256: current.manifest_sha256, files: encode(copy), ...(record ? { record: structuredClone(record) } : {}) };
        const previous = p.history.at(-1);
        if (previous && equal(previous.files, entry.files)) {
          check(!record || equal(previous.record, entry.record), 'HISTORY_CONFLICT');
          return summary(p);
        }
        validate(copy, previous ? decode(previous.files) : null, record);
        chain([...p.history, entry], p.binding);
        p.history.push(entry);
        return summary(p);
      });
    },
  };
}
