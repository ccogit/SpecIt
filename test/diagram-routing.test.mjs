import test from 'node:test';
import assert from 'node:assert/strict';
import { routeDiagram } from '../diagram-routing.mjs';
import { cleanArch, layoutStructure, layoutData } from '../diagrams.mjs';

const intersects = (a,b,r) => a.x===b.x
  ? a.x>r.x&&a.x<r.x+r.w&&Math.min(a.y,b.y)<r.y+r.h&&Math.max(a.y,b.y)>r.y
  : a.y===b.y&&a.y>r.y&&a.y<r.y+r.h&&Math.min(a.x,b.x)<r.x+r.w&&Math.max(a.x,b.x)>r.x;
function verify(routes,boxes,width,height) {
  for(const e of routes) {
    assert.ok(e?.points?.length>=2,'missing route');
    assert.match(e.d,/^M\d/);
    for(let i=1;i<e.points.length;i++){
      const a=e.points[i-1],b=e.points[i];
      assert.ok(a.x===b.x||a.y===b.y,e.from+'→'+e.to+': diagonal '+e.d);
      assert.ok(boxes.every(box=>!intersects(a,b,box)),e.from+'→'+e.to+': line crosses a node');
    }
    if(e.label) {
      assert.ok(Number.isFinite(e.lx)&&Number.isFinite(e.ly));
      assert.ok(e.lx>=0&&e.lx<=width&&e.ly>=0&&e.ly<=height);
      const half=Math.max(15,e.label.length*3.5+6);
      assert.ok(boxes.every(box=>e.lx+half<box.x+1||e.lx-half>box.x+box.w-1||e.ly+10<box.y+1||e.ly-10>box.y+box.h-1),e.label+': label overlaps a node');
    }
  }
}

test('complex architecture routes have no diagonals and do not run through boxes',()=>{
  const boxes=[
    ['bewohner',341,50],['admin',531,50],['inventar',151,190],['anfragen',341,190],['geraete',531,190],['verwaltung',721,190],
    ['verleih',341,330],['ereignisse',531,330],['json',436,470],
  ].map(([id,x,y])=>({id,x,y,w:168,h:46}));
  const edges=[
    ['bewohner','inventar','nutzt'],['bewohner','anfragen','nutzt'],['bewohner','geraete','nutzt'],['admin','verwaltung','nutzt'],
    ['inventar','verleih','fragt an'],['anfragen','verleih','zieht zurück'],['geraete','verleih','bestätigt'],
    ['verwaltung','ereignisse','pflegt'],['verleih','ereignisse','meldet'],
    ['verleih','json','speichert'],['ereignisse','json','protokolliert'],
  ].map(([from,to,label])=>({from,to,label}));
  const routes=routeDiagram(boxes,edges,{width:1050,height:580,mode:'structure'});
  assert.equal(routes.length,edges.length);
  verify(routes,boxes,1050,580);
});

test('data model preserves cardinality and relations without crossing entities',()=>{
  const boxes=[
    ['bewohner',34,34,114],['geraet',330,34,148],['leihe',626,34,148],
    ['ereignis',34,280,96],['kategorie',330,280,80],['wartung',626,280,96],
  ].map(([id,x,y,h])=>({id,x,y,h,w:176}));
  const edges=[
    ['bewohner','geraet','1:n','besitzt'],['bewohner','ereignis','1:n','empfängt'],['geraet','leihe','1:n','hat'],
    ['geraet','ereignis','1:n','betrifft'],['geraet','kategorie','n:m','ordnet zu'],['geraet','wartung','1:n','hat'],
    ['leihe','ereignis','1:n','löst aus'],
  ].map(([from,to,kind,label])=>({from,to,kind,label}));
  const routes=routeDiagram(boxes,edges,{width:840,height:430,mode:'data'});
  verify(routes,boxes,840,430);
  assert.deepEqual(routes.map(r=>[r.ca,r.cb]),[['1','n'],['1','n'],['1','n'],['1','n'],['n','m'],['1','n'],['1','n']]);
  assert.ok(routes.every(r=>Number.isFinite(r.pa.x)&&Number.isFinite(r.pb.y)));
});

test('the application uses the router in architecture and entity layouts',()=>{
  const model=cleanArch({
    structure:{nodes:[
      {id:'a',label:'Bewohner',kind:'actor'},{id:'b',label:'Inventar',kind:'ui'},{id:'c',label:'Verleihlogik',kind:'logic'},{id:'d',label:'Speicher',kind:'store'}
    ],edges:[{from:'a',to:'b',label:'nutzt'},{from:'b',to:'c',label:'fragt an'},{from:'c',to:'d',label:'speichert'}]},
    data:{entities:[
      {name:'Bewohner',attributes:['Name']},{name:'Gerät',attributes:['ID','Status']},{name:'Leihvorgang',attributes:['Datum']}
    ],relations:[{from:'Bewohner',to:'Gerät',kind:'1:n',label:'besitzt'},{from:'Gerät',to:'Leihvorgang',kind:'1:n',label:'hat'}]}
  });
  const arch=layoutStructure(model.structure),data=layoutData(model.data);
  verify(arch.edges,arch.nodes,arch.width,arch.height);
  verify(data.relations,data.entities,data.width,data.height);
  assert.equal(arch.edges.length,3);assert.equal(data.relations.length,2);
  assert.equal(data.relations[0].ca,'1');assert.equal(data.relations[0].cb,'n');
});
