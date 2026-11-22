import test from 'node:test';
import assert from 'node:assert/strict';
import { renderStructuredCore, structuredPrompt } from '../spec-structured.mjs';
import { splitChapters } from '../blocks.mjs';

const spec={goals:['Schneller Zugriff'],nonGoals:['Keine Cloud'],roles:[{name:'Nutzer',rights:['Notizen lesen']}],
 flows:[{name:'Speichern',steps:['Eingeben','Speichern'],errors:['Leere Eingabe']}],
 requirements:[{feature:'Notizen',title:'Notiz erstellen',priority:'Muss',origin:'bestätigt',detail:'Notiz wird gespeichert',acceptance:['Wenn Text gültig, erscheint Notiz']}],
 nfr:[],ux:['Tastatur nutzbar'],data:[{entity:'Notiz',fields:['Titel','Text']}],interfaces:[],risks:['Datenverlust']};

test('deterministically renders all eight chapters and traceable requirements',()=>{
 const md=renderStructuredCore(spec,[{name:'Notizen'}]);
 assert.equal(splitChapters(md).chapters.length,8);
 assert.match(md,/FR-001 Notiz erstellen/);
 assert.match(md,/Abnahme:.*Wenn Text gültig/);
 assert.match(md,/Nutzer und Rollen/);
 assert.match(md,/NFR-/i);
 assert.ok(structuredPrompt.includes('JSON'));
});

test('rejects unknown features, missing coverage and missing acceptance',()=>{
 assert.throws(()=>renderStructuredCore(spec,[{name:'Notizen'},{name:'Export'}]),/Features ohne Anforderung/);
 assert.throws(()=>renderStructuredCore({...spec,requirements:[{...spec.requirements[0],feature:'fremd'}]},[{name:'Notizen'}]),/unbekanntes Feature/);
 assert.throws(()=>renderStructuredCore({...spec,requirements:[{...spec.requirements[0],acceptance:[]}]},[{name:'Notizen'}]),/Akzeptanzkriterium/);
});

test('normalizes formatting and assigns stable ordered IDs without accepting model-supplied IDs',()=>{
 const data={...spec,requirements:[{...spec.requirements[0],title:'A',id:'FR-999'}, {...spec.requirements[0],title:'B'}]};
 const md=renderStructuredCore(data,[{name:'Notizen'}]);
 assert.match(md,/FR-001 A/);assert.match(md,/FR-002 B/);
 assert.doesNotMatch(md,/FR-999/);
});
