// Repository evidence is fetched by the server; the model may rank but cannot invent candidates.
const github='https://api.github.com/search/repositories';
const text=(value,max=300)=>String(value||'').trim().slice(0,max);
const idRegex=/\b(?:FR|NFR)-\d{3}\b/g;
const lowFrictionLicenses=new Set(['MIT','Apache-2.0','BSD-2-Clause','BSD-3-Clause','ISC','Zlib','Unlicense','CC0-1.0']);
const cleanQuery=q=>text(q,90).replace(/[^\p{L}\p{N}\s_.+#-]/gu,' ').replace(/\s+/g,' ').trim();
export function parseQueries(input){
  const queries=Array.isArray(input?.queries)?input.queries:[];
  return [...new Set(queries.map(cleanQuery).filter(q=>q.length>=3))].slice(0,3);
}
export function normalizeRepo(r){
  if(!r||r.archived||r.fork||typeof r.html_url!=='string'||!/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/?$/.test(r.html_url))return null;
  return {
    url:r.html_url.replace(/\/$/,''),
    name:text(r.full_name,120), description:text(r.description,350),
    license:text(r.license?.spdx_id,40)||'Unbekannt',
    stars:Number.isInteger(r.stargazers_count)?r.stargazers_count:0,
    updated:text(r.pushed_at,40),
    language:text(r.language,50),
    topics:Array.isArray(r.topics)?r.topics.filter(x=>typeof x==='string').slice(0,12):[],
  };
}
export async function searchRepositories(queries, fetcher=fetch){
  const candidates=new Map(), failures=[];
  const search=async query=>{
    const url=github+'?'+new URLSearchParams({q:query+' archived:false fork:false',sort:'stars',order:'desc',per_page:'12'});
    const res=await fetcher(url,{headers:{accept:'application/vnd.github+json','user-agent':'SpecIt-reuse-discovery'},signal:AbortSignal.timeout(15000)});
    if(!res.ok)throw Error('GitHub HTTP '+res.status);
    return (await res.json()).items||[];
  };
  for(const query of parseQueries({queries})){
    try{
      // GitHub verknüpft alle Wörter mit UND: Liefert eine lange Anfrage nichts, mit den ersten drei Wörtern erneut suchen.
      const words=query.split(' ');
      let items=await search(words.slice(0,5).join(' '));
      if(!items.length&&words.length>3)items=await search(words.slice(0,3).join(' '));
      for(const raw of items){
        const repo=normalizeRepo(raw);
        if(repo?.name&&!candidates.has(repo.url))candidates.set(repo.url,repo);
      }
    }catch(e){failures.push(query+': '+text(e.message,100))}
  }
  return {candidates:[...candidates.values()].slice(0,30),failures};
}
export function validateReuseAnalysis(data,candidates,spec=''){
  const lookup=new Map(candidates.map(c=>[c.url,c]));
  const results=[],seen=new Set();
  for(const raw of Array.isArray(data?.projects)?data.projects:[]){
    if(typeof raw?.url!=='string'||!lookup.has(raw.url)||seen.has(raw.url))continue;
    const repo=lookup.get(raw.url);
    const suggested=['einbeziehen','prüfen','nicht einbeziehen'].includes(raw.decision)?raw.decision:'prüfen';
    const decision=suggested==='einbeziehen'&&!lowFrictionLicenses.has(repo.license)?'prüfen':suggested;
    const knownIds=new Set(String(spec).match(idRegex)||[]);
    const functions=Array.isArray(raw.functions)?raw.functions.map(x=>text(x,140)).filter(Boolean).filter(x=>![...x.matchAll(idRegex)].some(match=>knownIds.size&&!knownIds.has(match[0]))).slice(0,6):[];
    if(!functions.length)continue;
    seen.add(raw.url);
    results.push({...repo,decision,functions,reason:text(raw.reason,500),risks:text(raw.risks,500),included:false});
    if(results.length>=6)break;
  }
  return results;
}
export function cleanSelections(input){
  if(!Array.isArray(input))return [];
  const seen=new Set(),out=[];
  for(const r of input.slice(0,10)){
    if(!r||typeof r.url!=='string'||!/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+$/.test(r.url)||seen.has(r.url))continue;
    seen.add(r.url);
    out.push({url:r.url,name:text(r.name,120),license:text(r.license,40),functions:(Array.isArray(r.functions)?r.functions:[]).map(f=>text(f,140)).filter(Boolean).slice(0,6)});
  }
  return out;
}
export function proposedQueryInstruction(){
  return 'Jede Suchanfrage besteht aus höchstens drei englischen Stichwörtern, das wichtigste zuerst – GitHub verknüpft alle Wörter mit UND, längere Anfragen liefern keine Treffer. Formuliere 2 bis 3 kompakte englische GitHub-Repository-Suchanfragen für Open-Source-Code, der die zentralen Funktionen dieser Software-Idee bereits abdeckt. Suche sowohl ähnliche Anwendungen als auch wiederverwendbare Bibliotheken; bevorzugt prägnante technische und fachliche Suchbegriffe. Keine erfundenen Repository-Namen oder Links. Nur JSON: {"queries":["...","..."]}.';
}
export function rankingInstruction(){
  return 'Bewerte ausschließlich die tatsächlich gefundenen GitHub-Repositories aus den übergebenen Daten. Empfiehl höchstens sechs Projekte, möglichst mit unterschiedlichen abgedeckten Funktionen. Ein Beschreibungstext beweist die tatsächliche Funktionsfähigkeit nicht. Prüfe Lizenz, letzte Code-Aktivität, technische Passung und Integrationsrisiko; unbekannte oder restriktive Lizenz nicht zur sofortigen Übernahme empfehlen. Ordne pro Projekt konkrete Funktionen bzw. bekannte FR-/NFR-IDs zu. Setze decision=einbeziehen nur bei plausibler technischer und rechtlicher Eignung; sonst prüfen oder nicht einbeziehen. Formuliere die Begründung einschließlich noch zu verifizierender Punkte. Ausschließlich JSON: {"projects":[{"url":"exakte GitHub-URL aus Kandidaten","decision":"einbeziehen|prüfen|nicht einbeziehen","functions":["abgedeckte Funktion (FR-001)"],"reason":"...","risks":"..."}]}.';
}
