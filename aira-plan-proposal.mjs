import {allocateRequirementIdentity,restoreRequirementHighWater} from './aira-requirement-identities.mjs';
import {validatePlan,projectRequirementsPlan} from './planner.mjs';

// Pure V2 proposal adapter: state and mapping are provided by the caller.
// Browser persistence and original package verification stay outside the planner.
export function proposeRequirementPlan(draft, {plan_id, previous = null, mapping = {}, migration = null, decisions = []} = {}) {
  if (!/^[A-Za-z0-9][A-Za-z0-9-]{0,23}$/.test(plan_id ?? '')) throw Error('Ungültige Plan-ID.');
  if (previous && previous.requirements.plan_id !== plan_id || previous && migration) throw Error('Unpassender Vorgänger.');
  if (!mapping || typeof mapping !== 'object' || Array.isArray(mapping)) throw Error('Ungültige ID-Zuordnung.');
  draft = validatePlan(draft);
  const revision = previous ? previous.requirements.revision + 1 : 1;
  const data = {schema_version:2, plan_id, revision, requirements:[], criteria:[], tests:[], decisions:[], exceptions:[], retired_ids:[]};
  const known = new Map();
  const remember = (kind, entries) => entries.forEach(entry => known.set(entry.id, {kind, entry}));
  if (previous) {
    remember('task',previous.plan.tasks);
    for (const [kind,key] of [['requirement','requirements'],['decision','decisions'],['criterion','criteria'],['test','tests']]) remember(kind,previous.requirements[key]);
    data.retired_ids = structuredClone(previous.requirements.retired_ids);
  } else if (migration) {
    for (const raw of migration.manifest_bytes) {
      const m = JSON.parse(raw);
      remember('task',m.plan.tasks);
      remember('decision',m.blockers);
    }
  }
  let highWater = restoreRequirementHighWater(previous?.highWater ?? {}, [...known.keys()], data.retired_ids.map(x=>x.id));
  const used = new Set(), proposalKeys = {};
  const key = (...parts) => JSON.stringify(parts);
  const cmp = (a,b) => a < b ? -1 : a > b ? 1 : 0;
  const sorted = xs => [...new Set(xs)].sort(cmp);
  const pick = (k, ns, owner) => {
    let id = Object.hasOwn(mapping,k) ? mapping[k] : null;
    if (id !== null && id !== '') {
      const expected = ns==='T'||ns==='B' ? ns : ns+(owner?'-'+owner:'')+'-';
      if (!known.has(id) || !id.startsWith(expected) || used.has(id) ||
          (ns==='T' && known.get(id).kind!=='task') || (ns==='B' && known.get(id).kind!=='decision')) throw Error('Ungültige oder doppelte fachliche Zuordnung: '+id);
    } else {
      const next = allocateRequirementIdentity(highWater,ns,owner);
      id = next.id; highWater = next.highWater;
    }
    used.add(id); proposalKeys[k]=id; return id;
  };
  const taskMap = new Map();
  for (const t of [...draft.tasks].sort((a,b)=>cmp(a.id,b.id))) taskMap.set(t.id,pick(key('T',t.id,t.title,t.goal),'T'));
  const requirementMap = new Map();
  for (const text of sorted(draft.tasks.flatMap(t=>t.requirements))) {
    const ns = /^(?:NFR(?:[- :]|$)|nichtfunktional)/i.test(text)?'NFR':'FR';
    const id = pick(key(ns,text),ns);
    const old = known.get(id)?.entry;
    data.requirements.push({id,text,mandatory:old?.mandatory??true,state:old?.state??'approved'});
    requirementMap.set(text,id);
  }
  const plan = {...draft,tasks:draft.tasks.map(t=>({...t,id:taskMap.get(t.id),dependsOn:t.dependsOn.map(id=>taskMap.get(id)),requirements:[...new Set(t.requirements.map(text=>requirementMap.get(text)))]}))};
  const byText = new Map();
  for (const t of draft.tasks) for (const text of t.blockedBy) {
    if (!byText.has(text)) byText.set(text,new Set());
    byText.get(text).add(t.id);
  }
  for (const entry of decisions) {
    if (!entry || typeof entry.text!=='string' || !entry.text.trim() || !Array.isArray(entry.task_ids) || !entry.task_ids.length || entry.task_ids.some(id=>!taskMap.has(id))) throw Error('Klärungszuordnung fehlt.');
    if (!byText.has(entry.text)) byText.set(entry.text,new Set());
    entry.task_ids.forEach(id=>byText.get(entry.text).add(id));
  }
  for (const text of sorted([...byText.keys()])) {
    const id=pick(key('B',text),'B');
    const task_ids=sorted([...byText.get(text)].map(x=>taskMap.get(x)));
    const old=known.get(id)?.entry;
    data.decisions.push({id,text,task_ids,requirement_ids:sorted(plan.tasks.filter(t=>task_ids.includes(t.id)).flatMap(t=>t.requirements)),state:'open',resolution:null,evidence_ref:null,confirmed_by:null,confirmed_at:null,
      ...(old?.state==='resolved'&&old.text===text?{state:old.state,resolution:old.resolution,evidence_ref:old.evidence_ref,confirmed_by:old.confirmed_by,confirmed_at:old.confirmed_at}: {})});
  }
  const addEvidence = (owner, acceptance, tests, requirements, decision_id) => {
    if (new Set(acceptance).size!==acceptance.length || new Set(tests).size!==tests.length) throw Error('Doppelte Kriterien oder Tests für '+owner);
    const ac = new Map(), tc = new Map();
    for (const text of sorted(acceptance)) ac.set(text,pick(key('AC',owner,text),'AC',owner));
    for (const description of sorted(tests)) tc.set(description,pick(key('TC',owner,description),'TC',owner));
    const criterion_ids=acceptance.map(text=>ac.get(text));
    for (const text of acceptance) data.criteria.push({id:ac.get(text),task_id:owner,requirement_ids:[...requirements],text,verification:decision_id?'manual':'test',decision_id});
    for (const description of tests) data.tests.push({id:tc.get(description),task_id:owner,criterion_ids:[...criterion_ids],description});
  };
  for (const d of [...data.decisions].sort((a,b)=>cmp(a.id,b.id))) addEvidence(d.id,['Bestätigte Entscheidung dokumentiert.'],['Bestätigung und Dokumentation prüfen.'],[],d.id);
  for (const t of [...plan.tasks].sort((a,b)=>cmp(a.id,b.id))) addEvidence(t.id,t.acceptance,t.tests,t.requirements,null);
  for (const [id,{kind}] of known) if (!used.has(id)) data.retired_ids.push({id,kind,reason:'',retired_revision:revision});
  data.requirements.sort((a,b)=>cmp(a.id,b.id)); data.decisions.sort((a,b)=>cmp(a.id,b.id));
  data.retired_ids.sort((a,b)=>cmp(a.id,b.id));
  if(previous) data.exceptions=structuredClone(previous.requirements.exceptions.filter(e=>used.has(e.requirement_id)));
  return {plan:projectRequirementsPlan(plan,data),requirements:data,mapping:proposalKeys,confirmedIds:[]};
}
