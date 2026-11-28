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
