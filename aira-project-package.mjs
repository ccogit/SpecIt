import { sha256, exportAira } from './aira-export.mjs';
import { readV2Predecessor, validateV2Restore, verifyAiraV2 } from './aira-v2-export.mjs';
import { zip } from './zip.mjs';

export function makeProjectRecord(files, mapping, migration, previous) {
  const {manifest, requirements, identities} = readV2Predecessor({manifest_bytes:files['manifest.json'], requirements_bytes:files['requirements.json']});
  const evidence = migration ?? previous?.snapshot?.migration;
  return {repo:manifest.repo, manifest_bytes:files['manifest.json'].toString('utf8'), requirements_bytes:files['requirements.json'].toString('utf8'),
    manifest_sha256:sha256(files['manifest.json']), mapping,
    snapshot:{plan:manifest.plan,requirements,highWater:identities.counters,...(evidence?{migration:evidence}:{})}};
}
export function verifyProjectPackage(files, previous, record) {
  // The full S1 verifier checks original bytes and projection for ordinary V2
  // packages. Initial V1 migration with tombstones needs the separately archived
  // migration evidence, which verifyAiraV2's two-argument API does not accept.
  if (record) validateV2Restore(record, JSON.parse(files['manifest.json']));
  if (previous || !record?.snapshot?.migration) return verifyAiraV2(files, previous ? [previous] : []);
  const {manifest, requirements, migration} = {manifest:JSON.parse(files['manifest.json']),requirements:JSON.parse(files['requirements.json']),migration:record.snapshot.migration};
  const confirmed_points = Object.fromEntries([...Object.entries(manifest.tasks),...manifest.blockers.map(b=>[b.id,b])].map(([id,b])=>[id,b.points]));
  const generated = exportAira({schema_version:2,plan_id:manifest.plan_id,repo:manifest.repo,revision:manifest.revision,
    plan:manifest.plan,target_minutes:manifest.target_minutes,previous_manifest_sha256:null,requirements,
    spec:files['SPEC.md'],artifacts:Object.fromEntries(manifest.artifacts.map(a=>[a.path,files[a.path]])),migration,
    approved:true,changes_approved:true,confirmed_points,confirmed_ids:[...manifest.plan.tasks,...requirements.requirements,...requirements.criteria,...requirements.tests,...requirements.decisions].map(x=>x.id)});
  if (Object.keys(generated).length !== Object.keys(files).length || Object.entries(generated).some(([name,bytes])=>!Buffer.isBuffer(files[name])||!bytes.equals(files[name])))
    throw Object.assign(Error('CONTENT_DRIFT'),{code:'CONTENT_DRIFT'});
  return true;
}
export function zipProjectFiles(files) {
  return zip(Object.keys(files).sort().map(name=>({name,data:files[name],mtime:new Date(1980,0,1)})));
}
