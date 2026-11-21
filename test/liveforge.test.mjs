import test from 'node:test';
import assert from 'node:assert/strict';
import {buildLiveConcept,mountLivePreview} from '../liveforge.mjs';

test('the local preview picks a domain and respects the 15-minute scope',()=>{
  const m=buildLiveConcept({idea:'Immobilien verwalten und vermarkten',creativity:0,durLevel:1,autonomy:0});
  assert.equal(m.domain,'property');assert.equal(m.level,1);assert.equal(m.autonomy,0);
  assert.deepEqual(m.views.map(v=>v.id),['list']);assert.equal(m.rows.length,3);
});
test('explicit wishes are not silently deleted to meet a short time budget',()=>{
  const m=buildLiveConcept({idea:'Immobilien verwalten mit Kalender und Statistik',creativity:0,durLevel:1});
  assert.equal(m.scopeConflict,true);assert.ok(m.views.some(v=>v.id==='calendar'));assert.ok(m.views.some(v=>v.id==='analytics'));
});
test('negative requests are not added back through creativity',()=>{
  const m=buildLiveConcept({idea:'Immobilien verwalten ohne Kalender',creativity:4,durLevel:8});
  assert.equal(m.domain,'property');assert.ok(!m.views.some(v=>v.id==='calendar'));
});
test('names, devices, tone, counts and review all reach the local brief',()=>{
  const base={idea:'Teammitglieder auslosen',project:'TeamMix',durLevel:8};
  const m=buildLiveConcept({...base,tone:4,autonomy:100,creativity:4,layoutOn:true,layoutCount:2,logoCount:3,nameCount:5,reviewBy:'codex',reviewModel:'test-model',layoutDevice:'MOBILE',layoutTheme:'DARK'});
  const descriptions=Object.fromEntries(m.descriptions);
  assert.equal(m.primary,'pairs');assert.equal(m.title,'TeamMix');assert.equal(m.phone,true);assert.equal(m.theme,'DARK');assert.equal(m.logo,true);
  assert.ok(descriptions['Stitch-Layouts'].includes('2'));assert.ok(descriptions.Logo.includes('3'));assert.ok(descriptions.Name.includes('5'));
  assert.ok(descriptions.Review.includes('test-model'));assert.ok(descriptions.Entscheidungsmodus.includes('Annahmen'));
  for(const change of [{tone:4},{autonomy:100},{creativity:4},{durLevel:1},{layoutOn:true,layoutCount:2},{logoCount:2},{nameCount:1},{project:'Neu'},{reviewBy:'codex'},{layoutTheme:'DARK'},{layoutDevice:'MOBILE'}]){
    assert.notDeepEqual(buildLiveConcept(base).descriptions,buildLiveConcept({...base,...change}).descriptions);
  }
});
test('confirmed decisions, defaults, exclusions and extra requirements have distinct provenance',()=>{
  const m=buildLiveConcept({idea:'Aufgaben planen',features:[{name:'Export',on:false}],extras:['CSV vermeiden'],questions:[{question:'Nutzer?',state:'decided',choice:[0],options:['Team']},{question:'Ablage?',state:'default',choice:[0],options:['Lokal']},{question:'Offen?',state:'open',choice:[0],options:['Nicht bestätigt']}]});
  assert.ok(m.descriptions.some(([k,v])=>k==='Entschieden'&&v.includes('Team')));
  assert.ok(m.descriptions.some(([k,v])=>k==='Annahme / Standard'&&v.includes('Lokal')));
  assert.ok(m.descriptions.some(([k,v])=>k==='Nicht-Ziel'&&v==='Export'));
  assert.ok(m.descriptions.some(([k,v])=>k==='Zusatzanforderung'&&v==='CSV vermeiden'));
  assert.ok(!m.descriptions.some(([,v])=>v.includes('Nicht bestätigt')));
});
test('unknown and empty ideas remain provisional; input is plain text',()=>{
  assert.equal(buildLiveConcept({idea:''}).idea,'');
  const m=buildLiveConcept({idea:'<script>alert(1)</script>',creativity:0});
  assert.equal(m.domain,'generic');assert.equal(m.rows.length,0);
  assert.equal(m.descriptions[0][1],'<script>alert(1)</script>');
});

// A minimal DOM test double exercises the renderer's actual event handlers. A browser
// smoke test is still needed for CSS, focus and integration with the legacy SVG.
function makeDOM(){
  class Element{
    constructor(tag,doc){this.tagName=tag;this.ownerDocument=doc;this.children=[];this.dataset={};this.attrs={};this.value='';this._text='';this.hidden=false}
    set textContent(v){this._text=String(v);this.children=[]}
    get textContent(){return this._text+this.children.map(c=>c.textContent).join('')}
    append(...nodes){for(const n of nodes){n.parent=this;this.children.push(n)}}
    replaceChildren(...nodes){this.children=[];this._text='';this.append(...nodes)}
    setAttribute(k,v){this.attrs[k]=String(v)}
    remove(){if(this.parent)this.parent.children=this.parent.children.filter(x=>x!==this)}
    closest(k){for(let n=this;n;n=n.parent){if(k==='.lfq'&&n.className==='lfq')return n}return null}
    querySelector(k){return descendants(this).find(n=>n.tagName===k)||null}
  }
  const doc={createElement(tag){return new Element(tag,doc)},getElementById(id){return descendants(doc.head).find(n=>n.id===id)||null}};
  doc.head=doc.createElement('head');const panel=doc.createElement('section');panel.className='lfq';const root=doc.createElement('div');panel.append(root);
  return {doc,panel,root};
}
function descendants(n){return [n,...n.children.flatMap(descendants)]}
function button(root,label){return descendants(root).find(n=>n.tagName==='button'&&n.textContent===label)}
test('the preview supports real local interactions and retains them across design updates',()=>{
  const {panel,root}=makeDOM(),engine=mountLivePreview(root),s={idea:'Immobilien verwalten',creativity:0,durLevel:4};
  engine.update(s);assert.equal(panel.hidden,false);
  const search=descendants(root).find(x=>x.type==='search');assert.ok(search);
  search.value='Essen';search.oninput();assert.ok(root.textContent.includes('Wohnung am Park'));assert.ok(!root.textContent.includes('Stadthaus'));
  button(root,'Offen').onclick();assert.ok(button(root,'Erledigt'));
  button(root,'Details').onclick();assert.ok(root.textContent.includes('Standort: Essen'));
  engine.update({...s,tone:4,project:'ImmoDesk',layoutTheme:'DARK'});
  assert.ok(root.textContent.includes('ImmoDesk'));assert.ok(button(root,'Erledigt'));assert.ok(root.textContent.includes('Standort: Essen'));
  assert.equal(descendants(root).find(x=>x.type==='search'),search);
  engine.update({...s,idea:''});assert.equal(panel.hidden,true);
  engine.update(s);assert.equal(panel.hidden,false);assert.ok(!button(root,'Erledigt'));
});
test('form submission adds a sandbox-only row without rebuilding the whole application',()=>{
  const {root}=makeDOM(),engine=mountLivePreview(root);
  engine.update({idea:'Ein Formular zur Erfassung',creativity:0});
  const form=descendants(root).find(n=>n.tagName==='form');assert.ok(form);
  form.children[0].value='Testdatensatz';form.children[1].value='Notiz';
  form.onsubmit({preventDefault(){}});
  assert.ok(root.textContent.includes('1 lokale Einträge'));
});
