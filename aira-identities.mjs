// Shared by browser and exporter. Pure identity allocation, no I/O.
export function codepointCompare(a,b) {
  const aa=Array.from(a,c=>c.codePointAt(0)),bb=Array.from(b,c=>c.codePointAt(0));
  for(let i=0;i<Math.min(aa.length,bb.length);i++) if(aa[i]!==bb[i]) return aa[i]-bb[i];
  return aa.length-bb.length;
}
export function decisionsFor(plan,history=[]) {
  const previous=new Map();let highest=0;
  for(const m of history) for(const d of m.blockers){
    previous.set(d.decision,d.id);highest=Math.max(highest,Number(d.id.slice(1)));
  }
  return [...new Set(plan.tasks.flatMap(t=>t.blockedBy))].sort(codepointCompare).map(decision=>{
    const id=previous.get(decision)||'B'+String(++highest).padStart(2,'0');
    if(!/^B[0-9]{2}$/.test(id)) throw Error('Aira-Export: Klärungs-IDs erschöpft.');
    return {id,decision};
  }).sort((a,b)=>codepointCompare(a.id,b.id));
}
export function identityConflicts(plan,previous) {
  if(!previous)return [];
  const conflicts=[],byId=new Map(plan.tasks.map(t=>[t.id,t]));
  const current=new Set(plan.tasks.flatMap(t=>t.blockedBy));
  for(const t of previous.plan.tasks){
    const next=byId.get(t.id);
    if(!next){conflicts.push(t.id+': Task entfernt');continue}
    if(next.title!==t.title)conflicts.push(t.id+': Titel umbenannt');
    if(t.blockedBy.some(d=>!next.blockedBy.includes(d)))conflicts.push(t.id+': Klärungsabhängigkeit entfernt');
  }
  for(const d of previous.blockers)if(!current.has(d.decision))conflicts.push(d.id+': Entscheidung entfernt');
  return conflicts;
}

// Only suggestions, never confirmed points. Ignore malformed or ambiguous proposals.
export function pointSuggestions(plan,rawTasks){
  const out={};
  if(!Array.isArray(rawTasks))return out;
  for(const t of plan.tasks){
    const candidates=rawTasks.filter(x=>x&&x.id===t.id);
    if(candidates.length===1&&[1,2,3,5,8].includes(candidates[0].aira_points))out[t.id]=candidates[0].aira_points;
  }
  return out;
}

// JSON.parse alone silently accepts duplicate keys. Parse first for grammar, then
// scan the original tokens to reject duplicate object keys and nonfinite numbers.
export function parseAiraJson(raw){
  const invalid=()=>{throw Error('Aira-Export: ungültiges JSON oder doppelte Schlüssel.')};
  if(typeof raw!=='string')invalid();
  let result;
  try{result=JSON.parse(raw)}catch{invalid()}
  let i=0;
  const ws=()=>{while(i<raw.length&&/[ \t\r\n]/.test(raw[i]))i++};
  function string(){
    const start=i++;
    while(i<raw.length){
      if(raw[i]==='\\'){i+=2;continue}
      if(raw[i++]==='"')return JSON.parse(raw.slice(start,i));
    }
    invalid();
  }
  function scan(){
    ws();
    if(raw[i]==='{'){
      i++;ws();const seen=new Set();
      if(raw[i]==='}'){i++;return}
      while(i<raw.length){
        ws();const key=string();
        if(seen.has(key))invalid();seen.add(key);
        ws();i++;scan();ws();
        if(raw[i++]==='}')return;
      }
    }else if(raw[i]==='['){
      i++;ws();if(raw[i]===']'){i++;return}
      while(i<raw.length){scan();ws();if(raw[i++]==']')return}
    }else if(raw[i]==='"')string();
    else{
      const start=i;while(i<raw.length&&!/[,\]}\s]/.test(raw[i]))i++;
      const value=JSON.parse(raw.slice(start,i));
      if(typeof value==='number'&&!Number.isFinite(value))invalid();
    }
  }
  scan();return result;
}

// Compare manifest content, not property insertion order (downloaded JSON is canonical).
export function sameManifest(a,b){
  const ordered=x=>Array.isArray(x)?x.map(ordered):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort(codepointCompare).map(k=>[k,ordered(x[k])])):x;
  return JSON.stringify(ordered(a))===JSON.stringify(ordered(b));
}
