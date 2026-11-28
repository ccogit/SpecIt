import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';
import { airaZip } from '../aira-zip.mjs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const f=JSON.parse(read('./fixtures/specit_v1/blocked.json'));
const input={...f.source,approved:true,spec:f.expected_files['SPEC.md']};
function unzip(buf){
  const result={};let i=0;
  while(buf.readUInt32LE(i)===0x04034b50){
    const method=buf.readUInt16LE(i+8),size=buf.readUInt32LE(i+18),len=buf.readUInt16LE(i+26),extra=buf.readUInt16LE(i+28);
    const name=buf.subarray(i+30,i+30+len).toString(),start=i+30+len+extra,data=buf.subarray(start,start+size);
    result[name]=method===8?inflateRawSync(data).toString():data.toString();i=start+size;
  }
  return result;
}
test('Aira ZIP: Klärungs-Epics und getrennte Kontextdateien, reproduzierbar',()=>{
  const before=JSON.stringify(input),buf=airaZip(input);
  assert.deepEqual(unzip(buf),f.expected_files);
  assert.deepEqual(buf,airaZip(input));
  assert.equal(JSON.stringify(input),before);
  assert.throws(()=>airaZip({...input,approved:false}),/Freigabe/);
  const points={...input.confirmed_points};delete points.B01;
  assert.throws(()=>airaZip({...input,confirmed_points:points}),/Aira-Export/);
});
test('Eigene UI und API ohne Standalone-Start',()=>{
  const html=read('../public/index.html'),app=read('../public/app.mjs'),server=read('../server.mjs');
  for(const id of ['goAira','airaDialog','airaApprove','airaDownload','goDownload','goApprove','goDirect'])assert.match(html,new RegExp('id="'+id+'"'));
  const flow=app.slice(app.indexOf('// Separater Aira-Ablauf'),app.indexOf('// PDF: Druckvorschau'));
  assert.match(flow,/\/api\/aira\/export/);
  assert.doesNotMatch(flow,/\/api\/run|\/api\/repo|calib|goFlow\(|startRun\(/);
  const endpoint=server.slice(server.indexOf("if(req.url==='/api/aira/export')"),server.indexOf("if(req.url==='/api/run/download')"));
  assert.match(endpoint,/airaZip/);
  assert.doesNotMatch(endpoint,/startRun|calib|createRepo/);
  assert.match(app,/goDirect'\)\.onclick=\(\)=>goFlow\('direct'\)/);
});
